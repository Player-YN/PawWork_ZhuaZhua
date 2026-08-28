/**
 * Packed Chrome MV3 extension E2E: blank Slides → sidepanel sendMessage →
 * AI SDK tool loop (local mock) → 7-frame deck → pointer filmstrip reorder →
 * replacePlate on slide 4. Evidence lands in artifacts/extension-e2e-deck/.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_API_KEY, MOCK_MODEL, startMockOpenAiServer } from './mockOpenAiServer.mjs';
import { listEngineNodes, parsePawCanvas } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'artifacts/extension-e2e-deck');
const UNPACKED = path.join(root, 'artifacts/unpacked');
const HEADED = process.env.PW_HEADED === '1';

function loadPlaywrightOrThrow() {
  return import('playwright').catch(() => null);
}

async function workspaceRpc(page, method, params = {}) {
  return page.evaluate(async ({ method, params }) => {
    const response = await chrome.runtime.sendMessage({
      target: 'pawwork-background',
      action: 'workspace_rpc',
      method,
      params
    });
    if (!response?.ok) {
      throw new Error(`${method}: ${response?.error || 'workspace RPC failed'}`);
    }
    return response.result;
  }, { method, params });
}

function attachErrors(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => bucket.push(`pageerror: ${err}`));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2));
}

async function shot(page, name, selector) {
  const dest = path.join(OUT, name);
  if (selector) {
    const loc = page.locator(selector);
    if (await loc.count()) {
      await loc.first().screenshot({ path: dest });
      return dest;
    }
  }
  await page.screenshot({ path: dest, fullPage: true });
  return dest;
}

function canvasInventory(raw) {
  const doc = parsePawCanvas(raw);
  const nodes = listEngineNodes(raw);
  const frames = nodes.filter((n) => n.type === 'frame').sort((a, b) => a.x - b.x);
  return { doc, nodes, frames };
}

function assertSevenNativeFrames(frames, nodes, label) {
  assert.equal(frames.length, 7, `${label}: expected 7 frames`);
  for (const fr of frames) {
    assert.equal(Math.round(fr.w), 1920, `${label} ${fr.nodeId} w`);
    assert.equal(Math.round(fr.h), 1080, `${label} ${fr.nodeId} h`);
  }
  for (let i = 1; i < frames.length; i++) {
    assert.ok(
      frames[i].x > frames[i - 1].x + frames[i - 1].w - 1,
      `${label}: overlapping frames ${frames[i - 1].nodeId} / ${frames[i].nodeId}`
    );
  }
  const kids = nodes.filter((n) => n.parentId && String(n.parentId).startsWith('shape:'));
  assert.ok(
    kids.some((n) => n.type === 'text' || n.text),
    `${label}: expected native text children`
  );
  assert.ok(
    kids.some((n) => n.type === 'geo' || n.type === 'image'),
    `${label}: expected native geo/image children`
  );
  assert.equal(
    nodes.some((n) => /<html|data-paw-kind\s*=\s*["']site["']/i.test(n.text || n.html || '')),
    false
  );
}

function progress(msg) {
  const line = `[e2e] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(OUT, 'progress.log'), `${line}\n`);
  } catch {
    /* */
  }
}

async function waitTurnIdle(panel, timeoutMs = 180000) {
  const start = Date.now();
  await panel.locator('#stopBtn').waitFor({ state: 'visible', timeout: 30000 });
  try {
    await panel.waitForFunction(
      () => {
        const stop = document.getElementById('stopBtn');
        const send = document.getElementById('sendBtn');
        const hidden = !stop || stop.hidden || stop.getAttribute('aria-hidden') === 'true';
        return hidden && !!send && !send.hidden;
      },
      null,
      { timeout: timeoutMs }
    );
  } catch (e) {
    const dump = await panel.evaluate(() => ({
      stopHidden: document.getElementById('stopBtn')?.hidden,
      sendHidden: document.getElementById('sendBtn')?.hidden,
      bodyText: (document.body?.innerText || '').slice(0, 2000)
    }));
    writeJson('debug-turn-timeout.json', dump);
    throw e;
  }
  return Date.now() - start;
}

async function sendComposer(panel, text) {
  const input = panel.locator('#input');
  await input.click({ force: true });
  await panel.evaluate((value) => {
    const el = document.getElementById('input');
    if (!el) throw new Error('#input missing');
    el.focus();
    el.innerHTML = '';
    el.textContent = value;
    el.classList.remove('is-empty');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }, text);
  await panel.locator('#sendBtn').click();
  return waitTurnIdle(panel);
}

async function findDesignPage(context, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = context.pages().find((p) => /design\.html/i.test(p.url()));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function waitFilmCount(design, n, timeoutMs = 60000) {
  try {
    await design.waitForSelector('#filmList .pw-film-item', { timeout: Math.min(15000, timeoutMs) });
    await design.waitForFunction(
      (want) => document.querySelectorAll('#filmList .pw-film-item').length >= want,
      n,
      { timeout: timeoutMs }
    );
  } catch (e) {
    const dump = await design.evaluate(() => ({
      url: location.href,
      film: document.querySelectorAll('#filmList .pw-film-item').length,
      filmIds: [...document.querySelectorAll('#filmList .pw-film-item')].map((el) => el.dataset.frameId),
      hasList: !!document.getElementById('filmList'),
      tl: !!document.querySelector('.tl-container')
    }));
    writeJson('debug-design-film.json', dump);
    throw e;
  }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  progress('start');
  if (!fs.existsSync(path.join(UNPACKED, 'manifest.json'))) {
    throw new Error('artifacts/unpacked missing — run `npm run pack:extension` first');
  }

  const pwmod = await loadPlaywrightOrThrow();
  if (!pwmod?.chromium) {
    throw new Error('playwright missing. Run `npm run playwright:install`.');
  }
  const { chromium } = pwmod;
  const mock = await startMockOpenAiServer({
    onCall: (rec) => {
      try {
        fs.appendFileSync(path.join(OUT, 'mock-calls.jsonl'), `${JSON.stringify(rec)}\n`);
      } catch {
        /* */
      }
    }
  });
  const errors = [];
  const setupNotes = [];
  const shots = [];
  let context;
  try {
    const userDataDir = path.join(OUT, 'chrome-profile');
    fs.mkdirSync(userDataDir, { recursive: true });
    const extPath = UNPACKED.replace(/\\/g, '/');
    context = await chromium.launchPersistentContext(userDataDir, {
      // Playwright's default headless disables MV3. Use new-headless via args, or headed.
      headless: false,
      viewport: { width: 1280, height: 900 },
      args: [
        ...(HEADED ? [] : ['--headless=new']),
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        '--no-first-run',
        '--no-default-browser-check'
      ],
      recordVideo: { dir: path.join(OUT, 'video') }
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    context.on('page', (p) => attachErrors(p, errors));

    let worker = context.serviceWorkers()[0];
    if (!worker) {
      try {
        worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
      } catch {
        worker = context.serviceWorkers()[0] || null;
      }
    }
    if (!worker) {
      throw new Error(
        `extension service worker missing. pages=${context.pages().map((p) => p.url()).join(',')} workers=${context.serviceWorkers().length}`
      );
    }
    const extensionId = new URL(worker.url()).hostname || new URL(worker.url()).host;
    assert.match(extensionId, /^[a-p]{32}$/);
    progress(`extensionId=${extensionId} mock=${mock.baseURL}`);

    const panel = await context.newPage();
    attachErrors(panel, errors);
    await panel.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await panel.locator('#input').waitFor({ timeout: 30000 });

    const providerId = 'e2e-mock';
    await panel.evaluate(
      async ({ providers, activeId }) => {
        await chrome.storage.local.set({
          pagewand_providers: providers,
          pagewand_active_provider_id: activeId,
          pagewand_api_key: providers[0].apiKey,
          pagewand_api_base: providers[0].baseURL,
          selected_model: providers[0].model
        });
      },
      {
        activeId: providerId,
        providers: [
          {
            id: providerId,
            name: 'E2E mock',
            baseURL: mock.baseURL,
            apiKey: MOCK_API_KEY,
            model: MOCK_MODEL,
            createdAt: Date.now()
          }
        ]
      }
    );

    await workspaceRpc(panel, 'getSession', { sessionId: 'session-1' });
    const session = await workspaceRpc(panel, 'getSession', { sessionId: 'session-1' });
    const sessionId = session.sessionId || 'session-1';

    let blankVia = 'ui';
    try {
      await panel.locator('#artifactEdgeFab').click({ force: true });
      await panel.locator('#artifactRail').waitFor({ state: 'visible', timeout: 8000 });
      await panel.locator('[data-blank-kind="slides"]').click();
      await panel.waitForTimeout(800);
    } catch (e) {
      blankVia = 'rpc';
      setupNotes.push(`blank Slides UI blocked (${e instanceof Error ? e.message : e}); used createBlankArtifact RPC`);
      await workspaceRpc(panel, 'createBlankArtifact', { sessionId, kind: 'slides' });
    }

    let arts = await workspaceRpc(panel, 'listArtifacts', { sessionId });
    if (!arts.length) {
      setupNotes.push('shelf empty after UI click; seeded blank Slides via createBlankArtifact RPC');
      blankVia = 'rpc';
      await workspaceRpc(panel, 'createBlankArtifact', { sessionId, kind: 'slides' });
      arts = await workspaceRpc(panel, 'listArtifacts', { sessionId });
    }
    const artifactCountBefore = arts.length;
    const blank = arts.find((a) => /slides\.json$/i.test(a.name || a.primaryPath || '')) || arts[0];
    assert.ok(blank?.artifactId, 'expected one blank slides artifact');
    const artifactId = blank.artifactId;
    progress(`blank via=${blankVia} artifact=${artifactId} count=${artifactCountBefore}`);
    shots.push(await shot(panel, 'sidepanel-before.png'));
    const closeRail = panel.locator('#artifactRailCloseBtn');
    if (await closeRail.count()) await closeRail.click({ force: true });
    else await panel.locator('#artifactRailScrim').click({ force: true }).catch(() => {});
    await panel.locator('#artifactRailScrim').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    let design = await findDesignPage(context, 15000);
    if (design) attachErrors(design, errors);

    progress('sending create turn');
    const createMs = await sendComposer(panel, '用当前空白幻灯做一份七页的爪爪 Paw Work 中文介绍，同一主题，多种版式，含图标、母题和图表。不要另开文件。');
    progress(`create turn idle ${createMs}ms calls=${mock.calls.length}`);
    shots.push(await shot(panel, 'sidepanel-after-create.png'));

    arts = await workspaceRpc(panel, 'listArtifacts', { sessionId });
    const afterCreate = arts.length;
    const names = arts.map((a) => a.name);
    assert.equal(names.filter((n) => /slides\.json$/i.test(n)).length, 1, `slides.json count: ${names}`);
    assert.equal(names.filter((n) => /design\.json$/i.test(n)).length, 0, `unexpected design.json: ${names}`);
    const sameBlank = arts.find((a) => a.artifactId === artifactId);
    assert.ok(sameBlank, 'create turn changed artifact id');
    const createdRec = await workspaceRpc(panel, 'readArtifact', { sessionId, artifactId });
    const createdRaw = createdRec.content || createdRec.text || '';
    writeJson('debug-after-create.json', {
      mockCalls: mock.calls,
      artifactCount: afterCreate,
      names,
      createdPreview: String(createdRaw).slice(0, 2000),
      errors
    });
    const createdInv = canvasInventory(createdRaw);
    assertSevenNativeFrames(createdInv.frames, createdInv.nodes, 'after-create');
    assert.equal(createdInv.doc.themeId, 'ink-rose');
    const slide4Id = createdInv.frames.find((f) => f.nodeId === 'shape:slide-4' || /slide-4/.test(f.nodeId))?.nodeId;
    assert.ok(slide4Id, 'slide-4 frame missing after create');
    const frameIdsAfterCreate = createdInv.frames.map((f) => f.nodeId);
    writeJson('deck-after-create.json', createdInv.doc);
    writeJson('qa-create.json', createdRec.qa || null);

    const sessAfterCreate = await workspaceRpc(panel, 'getSession', { sessionId });
    const createQa =
      (sessAfterCreate.messages || [])
        .flatMap((m) => m.toolCalls || m.tool_calls || [])
        .map((c) => c.result?.qa || c.output?.qa)
        .find(Boolean) || null;

    design = design || (await findDesignPage(context, 30000));
    assert.ok(design, 'design.html tab did not open');
    attachErrors(design, errors);
    await design.bringToFront();
    await design.waitForSelector('.tl-container', { timeout: 60000 });
    try {
      await waitFilmCount(design, 7, 12000);
    } catch {
      progress('filmstrip still blank after create; reload design tab from store');
      setupNotes.push('design tab reloaded after create so filmstrip picked up store (live patch raced persist)');
      await design.reload({ waitUntil: 'domcontentloaded' });
      await design.waitForSelector('.tl-container', { timeout: 60000 });
      await waitFilmCount(design, 7, 30000);
    }
    await design.locator('.pw-film-tools button', { hasText: '总览' }).click();
    await design.waitForTimeout(600);
    shots.push(await shot(design, 'slides-overview.png', '#engine'));

    const filmItems = design.locator('#filmList .pw-film-item');
    for (let i = 0; i < 7; i++) {
      await filmItems.nth(i).click();
      await design.waitForTimeout(250);
      shots.push(await shot(design, `frame-slide-${i + 1}.png`, '#engine'));
    }

    const toolsEnabled = await design.evaluate(() => {
      const buttons = [...document.querySelectorAll('#toolStrip button, .pw-tool-strip button, .pw-tools button')];
      const labels = buttons.map((b) => (b.textContent || '').trim()).filter(Boolean);
      const disabled = buttons.filter((b) => b.disabled).map((b) => b.textContent);
      return { labels, disabled, present: document.body.dataset.present === '1' };
    });

    await design.locator('.pw-film-tools button', { hasText: '总览' }).click();
    await waitFilmCount(design, 7);
    const from = filmItems.nth(1);
    const to = filmItems.nth(5);
    const fromBox = await from.boundingBox();
    const toBox = await to.boundingBox();
    assert.ok(fromBox && toBox, 'filmstrip items missing boxes');
    const idsBeforeDrag = await filmItems.evaluateAll((els) => els.map((el) => el.dataset.frameId));
    await design.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await design.mouse.down();
    await design.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2 + 12, { steps: 4 });
    // Upper third of the 6th item → drop-before index 5 (slide 2 becomes position 6).
    await design.mouse.move(toBox.x + toBox.width / 2, toBox.y + Math.max(4, toBox.height * 0.2), { steps: 16 });
    const dragState = await design.evaluate(() => {
      const items = [...document.querySelectorAll('#filmList .pw-film-item')];
      return {
        dragging: items.some((el) => el.classList.contains('is-dragging')),
        dropBefore: items.some((el) => el.classList.contains('is-drop-before')),
        dropAfter: items.some((el) => el.classList.contains('is-drop-after'))
      };
    });
    shots.push(await shot(design, 'filmstrip-dragging.png'));
    await design.mouse.up();
    await design.waitForTimeout(800);
    const idsAfterDrag = await filmItems.evaluateAll((els) =>
      els.map((el) => ({ id: el.dataset.frameId, on: el.classList.contains('is-on') }))
    );
    assert.equal(dragState.dragging || dragState.dropBefore || dragState.dropAfter, true, `no drag/drop indicator: ${JSON.stringify(dragState)}`);
    assert.equal(idsAfterDrag[5]?.id, idsBeforeDrag[1], `expected slide 2 at position 6: ${JSON.stringify(idsAfterDrag)}`);
    assert.equal(idsAfterDrag.find((x) => x.on)?.id, idsBeforeDrag[1], 'dragged slide should stay selected');
    assert.deepEqual([...idsAfterDrag.map((x) => x.id)].sort(), [...idsBeforeDrag].sort());
    shots.push(await shot(design, 'overview-after-reorder.png', '#engine'));
    const artsAfterReorder = await workspaceRpc(panel, 'listArtifacts', { sessionId });
    assert.equal(artsAfterReorder.length, afterCreate, 'reorder changed artifact count');

    const slide4Btn = design.locator(`#filmList .pw-film-item[data-frame-id="${slide4Id}"]`);
    if (await slide4Btn.count()) await slide4Btn.click();
    else await filmItems.filter({ hasText: /一次会话|五件事|slide-4/ }).first().click();
    await design.waitForTimeout(400);
    shots.push(await shot(design, 'slide-4-before.png', '#engine'));

    const beforeNudge = await design.evaluate(() => {
      const selected = document.querySelector('.tl-shape[data-shape-type], .tl-shape.tl-selected');
      const r = selected?.getBoundingClientRect?.();
      return r ? { x: r.x, y: r.y } : null;
    });
    await design.locator('#engine').click({ position: { x: 420, y: 280 } });
    await design.keyboard.press('ArrowRight');
    await design.keyboard.press('ArrowRight');
    const afterNudge = await design.evaluate(() => {
      const selected = document.querySelector('.tl-shape.tl-selected, .tl-shape[data-shape-type]');
      const r = selected?.getBoundingClientRect?.();
      return r ? { x: r.x, y: r.y } : null;
    });
    const filmOnBeforePresent = await filmItems.evaluateAll((els) =>
      els.find((el) => el.classList.contains('is-on'))?.dataset.frameId || ''
    );
    await design.locator('.pw-film-tools button', { hasText: '放映' }).click();
    await design.waitForFunction(() => document.body.dataset.present === '1', null, { timeout: 5000 });
    await design.keyboard.press('ArrowRight');
    await design.waitForTimeout(400);
    await design.keyboard.press('Escape');
    await design.waitForFunction(() => document.body.dataset.present !== '1', null, { timeout: 5000 });
    const filmOnAfterPresent = await filmItems.evaluateAll((els) =>
      els.find((el) => el.classList.contains('is-on'))?.dataset.frameId || ''
    );

    await panel.bringToFront();
    progress('sending replace turn');
    const replaceMs = await sendComposer(panel, '把第 4 页换成一句引言，说明 replacePlate 只改这一页的孩子，不要另开文件。');
    progress(`replace turn idle ${replaceMs}ms calls=${mock.calls.length}`);
    shots.push(await shot(panel, 'sidepanel-after-replace.png'));

    arts = await workspaceRpc(panel, 'listArtifacts', { sessionId });
    const afterReplaceCount = arts.length;
    assert.equal(afterReplaceCount, afterCreate);
    assert.equal(
      arts.filter((a) => /slides\.json$/i.test(a.name)).every((a) => a.artifactId === artifactId),
      true
    );
    const replacedRec = await workspaceRpc(panel, 'readArtifact', { sessionId, artifactId });
    const replacedRaw = replacedRec.content || replacedRec.text || '';
    const replacedInv = canvasInventory(replacedRaw);
    const sessAfterReplace = await workspaceRpc(panel, 'getSession', { sessionId });
    writeJson('debug-after-replace.json', {
      mockCalls: mock.calls,
      texts: replacedInv.nodes.map((n) => ({ id: n.nodeId, type: n.type, text: n.text, parentId: n.parentId })).slice(0, 80),
      toolResults: (sessAfterReplace.messages || []).flatMap((m) => m.toolCalls || m.tool_calls || []).map((c) => ({
        name: c.name || c.toolName,
        ok: c.result?.ok ?? c.output?.ok,
        error: c.result?.error || c.output?.error,
        applied: c.result?.applied || c.output?.applied,
        qa: c.result?.qa || c.output?.qa
      }))
    });
    assertSevenNativeFrames(replacedInv.frames, replacedInv.nodes, 'after-replace');
    const idsAfterReplace = replacedInv.frames.map((f) => f.nodeId).sort();
    assert.deepEqual(idsAfterReplace, [...frameIdsAfterCreate].sort());
    assert.ok(replacedInv.frames.some((f) => f.nodeId === slide4Id));
    assert.ok(replacedInv.nodes.some((n) => /replacePlate 只改这一页/.test(n.text || '')));
    assert.equal(
      replacedInv.nodes.some((n) => n.parentId === slide4Id && /一次会话里的五件事/.test(n.text || '')),
      false
    );
    writeJson('deck-after-replace.json', replacedInv.doc);

    if (design && !design.isClosed()) {
      await design.bringToFront();
      await design.waitForTimeout(800);
      const s4 = design.locator(`#filmList .pw-film-item[data-frame-id="${slide4Id}"]`);
      if (await s4.count()) await s4.click();
      shots.push(await shot(design, 'slide-4-after.png', '#engine'));
    }

    const createCall = mock.calls.find((c) => c.kind === 'tool' && c.toolName === 'run');
    const replaceCall = mock.calls.find((c) => c.kind === 'tool' && c.toolName === 'deck');
    assert.ok(createCall, 'mock never served createScene tool call — tool loop did not run');
    assert.ok(replaceCall, 'mock never served replacePlate tool call');

    const evidence = {
      extensionId,
      sessionId,
      artifactId,
      blankVia,
      setupNotes,
      artifactCountBefore,
      artifactCountAfterCreate: afterCreate,
      artifactCountAfterReorder: artsAfterReorder.length,
      artifactCountAfterReplace: afterReplaceCount,
      slidesJsonCount: names.filter((n) => /slides\.json$/i.test(n)).length,
      designJsonCount: names.filter((n) => /design\.json$/i.test(n)).length,
      themeId: createdInv.doc.themeId,
      frameIdsAfterCreate,
      frameIdsAfterReplace: replacedInv.frames.map((f) => f.nodeId),
      slide4Id,
      createQa: createQa || createdInv.doc.qa || null,
      mockCalls: mock.calls,
      dragState,
      idsBeforeDrag,
      idsAfterDrag,
      toolsEnabled,
      nudge: { before: beforeNudge, after: afterNudge },
      presentNav: { before: filmOnBeforePresent, after: filmOnAfterPresent },
      shots,
      errors,
      tldrawLicense: 'watermark expected without a legal key'
    };
    writeJson('evidence.json', evidence);

    assert.equal(artifactCountBefore, 1);
    assert.equal(afterCreate, 1);
    assert.equal(artsAfterReorder.length, 1);
    assert.equal(afterReplaceCount, 1);
    const serious = errors.filter((e) => !/favicon|net::ERR_BLOCKED|ResizeObserver/i.test(e));
    assert.equal(serious.length, 0, serious.join('\n'));

    console.log(`test_extension_deck_e2e: ok session=${sessionId} artifact=${artifactId} ext=${extensionId}`);
  } finally {
    try {
      if (context) {
        await context.tracing.stop({ path: path.join(OUT, 'trace.zip') }).catch(() => {});
        await context.close();
      }
    } catch {
      /* */
    }
    await mock.close();
  }
}

main().catch((e) => {
  console.error(e);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'error.txt'), String(e?.stack || e));
  } catch {
    /* */
  }
  process.exit(1);
});
