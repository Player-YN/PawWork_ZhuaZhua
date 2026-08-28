/**
 * Playwright capture of the real mountDesignCanvas harness (repo-root server).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { QA_DECK_DIR } from './seed_semantic_deck.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

function startRepoServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/tests/session-workspace/harness/semantic-deck.html';
      const file = path.normalize(path.join(root, rel.replace(/^\//, '')));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500);
          res.end(String(err.message));
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, origin: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* try playwright-core */
  }
  try {
    return await import('playwright-core');
  } catch {
    return null;
  }
}

export async function captureSemanticDeck(outDir = QA_DECK_DIR) {
  const identity = JSON.parse(fs.readFileSync(path.join(outDir, 'identity.json'), 'utf8'));
  const { server, origin } = await startRepoServer();
  const shots = [];
  let consoleErrors = [];
  let mounted = false;
  try {
    const playwright = await loadPlaywright();
    if (!playwright?.chromium) {
      throw new Error(
        'playwright is not installed. Run `npm install` then `npm run playwright:install` (not part of baseline unit tests).'
      );
    }
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const failed = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('requestfailed', (req) => failed.push(`${req.url()} ${req.failure()?.errorText || ''}`));

    async function dumpFail(query) {
      const state = await page.evaluate(() => ({
        qa: window.__pawQa || null,
        title: document.title,
        engineKids: document.getElementById('engine')?.childElementCount || 0,
        hasTl: !!document.querySelector('.tl-container'),
        body: (document.body?.innerText || '').slice(0, 400)
      }));
      throw new Error(
        `tldraw did not mount ${query}: ${JSON.stringify({ state, consoleErrors, failed })}`
      );
    }

    async function open(query) {
      consoleErrors = [];
      failed.length = 0;
      await page.goto(`${origin}/tests/session-workspace/harness/semantic-deck.html${query}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      try {
        await page.waitForFunction(() => window.__pawQa && window.__pawQa.mounted, null, { timeout: 45000 });
      } catch {
        await dumpFail(query);
      }
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const el = document.getElementById('meta');
        if (el) el.style.display = 'none';
      });
      const state = await page.evaluate(() => window.__pawQa);
      if (!state?.mounted) await dumpFail(query);
      if ((state.errors || []).length) throw new Error(`harness errors: ${state.errors.join('; ')}`);
      mounted = true;
      return state;
    }

    async function shot(name, aliases = []) {
      const dest = path.join(outDir, name);
      const engine = page.locator('#engine');
      if (await engine.count()) await engine.screenshot({ path: dest });
      else await page.screenshot({ path: dest, fullPage: true });
      shots.push(dest);
      for (const alias of aliases) {
        const extra = path.join(outDir, alias);
        fs.copyFileSync(dest, extra);
        shots.push(extra);
      }
      return dest;
    }

    function assertStrip(boxes, label) {
      const frames = [...(boxes || [])].sort((a, b) => a.x - b.x);
      if (frames.length < 2) throw new Error(`${label}: expected multiple frames`);
      for (let i = 1; i < frames.length; i++) {
        if (!(frames[i].x > frames[i - 1].x + (frames[i - 1].w || 0) - 1)) {
          throw new Error(`${label}: overlapping/unordered ${JSON.stringify(frames)}`);
        }
      }
      return frames;
    }

    await open('?view=overview');
    const overviewState = await page.evaluate(() => ({
      boxes: window.__pawQa.frameBoxes || [],
      license: window.__pawQa.license || null,
      spreadFrames: window.__pawQa.spreadFrames
    }));
    if (overviewState.spreadFrames) throw new Error('harness-only spreading is forbidden');
    assertStrip(overviewState.boxes, 'overview');
    const palette = await page.evaluate(() => {
      const el = document.querySelector('.tl-container') || document.getElementById('engine');
      const cs = el ? getComputedStyle(el) : null;
      const editor = window.__pawQa?.editor;
      const theme = editor?.getTheme?.(editor.getCurrentThemeId?.() || 'default') || editor?.getCurrentTheme?.() || null;
      const colors = theme?.colors?.light || {};
      const pick = (name) => ({
        css: cs?.getPropertyValue(`--paw-theme-${name}`)?.trim() || cs?.getPropertyValue(`--paw-palette-${name}`)?.trim() || '',
        solid: colors[name]?.solid || colors[name] || ''
      });
      return {
        tldrawThemeId: window.__pawQa?.tldrawThemeId || '',
        fontSans: cs?.getPropertyValue('--tl-font-sans')?.trim() || '',
        fontSerif: cs?.getPropertyValue('--tl-font-serif')?.trim() || '',
        paper: pick('paper').css || pick('white').css,
        ink: pick('ink').css || pick('black').css,
        muted: pick('muted').css || pick('grey').css,
        accent: pick('accent').css || pick('red').css,
        accent2: pick('accent2').css || pick('orange').css,
        surface: pick('surface').css || pick('yellow').css,
        namedSolids: {
          black: colors.black?.solid || '',
          grey: colors.grey?.solid || '',
          white: colors.white?.solid || '',
          red: colors.red?.solid || '',
          orange: colors.orange?.solid || '',
          yellow: colors.yellow?.solid || '',
          'light-red': colors['light-red']?.solid || '',
          violet: colors.violet?.solid || '',
          'light-violet': colors['light-violet']?.solid || '',
          blue: colors.blue?.solid || '',
          green: colors.green?.solid || ''
        }
      };
    });
    fs.writeFileSync(path.join(outDir, 'palette.json'), JSON.stringify(palette, null, 2));
    await shot('overview.png', ['overview-v2.png']);
    await shot('overview-before-reorder.png');

    const reorder = await page.evaluate(() => {
      const api = window.__pawQa.api;
      const editor = window.__pawQa.editor;
      const before = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.type === 'frame')
        .map((s) => ({
          id: s.id,
          x: s.x,
          y: s.y,
          w: s.props?.w,
          h: s.props?.h,
          name: s.props?.name || ''
        }))
        .sort((a, b) => a.x - b.x);
      const childIdsBefore = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.parentId === 'shape:slide-2')
        .map((s) => s.id)
        .sort();
      const result = api.reorderSlides({ id: 'shape:slide-2', toIndex: 5, view: 'overview', animate: false });
      api.setSlideView?.('overview');
      api.fitContent?.({ animate: false });
      const after = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.type === 'frame')
        .map((s) => ({
          id: s.id,
          x: s.x,
          y: s.y,
          w: s.props?.w,
          h: s.props?.h,
          name: s.props?.name || ''
        }))
        .sort((a, b) => a.x - b.x);
      const childIdsAfter = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.parentId === 'shape:slide-2')
        .map((s) => s.id)
        .sort();
      const snap = editor.getSnapshot?.() || {};
      const store = snap.document?.store || snap.store || {};
      const persisted = Object.values(store)
        .filter((r) => r && r.typeName === 'shape' && r.type === 'frame')
        .map((r) => ({ id: r.id, x: r.x, y: r.y }))
        .sort((a, b) => a.x - b.x);
      const state = api.getSlideState?.() || {};
      return { before, after, result, childIdsBefore, childIdsAfter, persisted, state };
    });
    if (!reorder.result?.ok) throw new Error(`reorderSlides failed: ${JSON.stringify(reorder.result)}`);
    if (reorder.before.length !== 7 || reorder.after.length !== 7) {
      throw new Error(`reorder must keep 7 frames: ${JSON.stringify({ before: reorder.before.length, after: reorder.after.length })}`);
    }
    const beforeIds = reorder.before.map((f) => f.id).sort();
    const afterIds = reorder.after.map((f) => f.id).sort();
    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      throw new Error(`frame IDs changed: ${JSON.stringify({ beforeIds, afterIds })}`);
    }
    if (reorder.after[5]?.id !== 'shape:slide-2') {
      throw new Error(`slide-2 should be position 6: ${JSON.stringify(reorder.after.map((f) => f.id))}`);
    }
    assertStrip(reorder.after, 'after-reorder');
    if (JSON.stringify(reorder.childIdsBefore) !== JSON.stringify(reorder.childIdsAfter)) {
      throw new Error(`slide-2 children changed: ${JSON.stringify(reorder)}`);
    }
    if (reorder.persisted[5]?.id !== 'shape:slide-2') {
      throw new Error(`persisted snapshot order missed slide-2: ${JSON.stringify(reorder.persisted)}`);
    }
    if (reorder.state.frameId !== 'shape:slide-2') {
      throw new Error(`selected frame after reorder: ${JSON.stringify(reorder.state)}`);
    }
    if (!reorder.state.bounds || Math.abs(reorder.state.bounds.x - reorder.after[5].x) > 2) {
      throw new Error(`camera target missed new slide-2 box: ${JSON.stringify(reorder.state)}`);
    }
    await shot('overview-after-reorder.png');
    await open('?view=overview');

    const frames = ['slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5', 'slide-6', 'slide-7'];
    for (const id of frames) {
      await open(`?view=page&frame=shape:${id}`);
      await shot(`frame-${id}.png`, [`frame-v2-${id}.png`]);
    }

    await open('?snap=before&view=page&frame=shape:slide-4');
    await shot('slide-4-before.png', ['slide-4-v2-before.png']);
    const mid = await page.evaluate(() => {
      const api = window.__pawQa.api;
      const state = api.getSlideState?.() || {};
      const box = (window.__pawQa.frameBoxes || []).find((f) => f.id === 'shape:slide-4');
      return { frameId: state.frameId, bounds: state.bounds, box };
    });
    if (mid.frameId !== 'shape:slide-4') throw new Error(`camera pin missed slide-4: ${JSON.stringify(mid)}`);
    if (!mid.bounds || !mid.box || Math.abs(mid.bounds.x - mid.box.x) > 2) {
      throw new Error(`camera target is not the slide-4 box: ${JSON.stringify(mid)}`);
    }

    const structural = await page.evaluate(async () => {
      const api = window.__pawQa.api;
      const editor = window.__pawQa.editor;
      const beforeIds = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.type === 'frame')
        .map((s) => s.id);
      const dupId = api.duplicateSlide('shape:slide-4');
      const deleted = api.deleteSlide('shape:slide-2');
      api.setSlideView?.('overview');
      api.fitContent?.({ animate: false });
      const frames = (editor.getCurrentPageShapesSorted() || [])
        .filter((s) => s.type === 'frame')
        .map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.props?.w, h: s.props?.h, name: s.props?.name || '' }));
      return { beforeIds, dupId, deleted, frames };
    });
    if (!structural.dupId) throw new Error('duplicateSlide did not return an id');
    if (!structural.deleted) throw new Error('deleteSlide failed');
    if (structural.frames.some((f) => f.id === 'shape:slide-2')) throw new Error('delete did not remove slide-2');
    if (!structural.frames.some((f) => f.id === 'shape:slide-4')) throw new Error('slide-4 identity lost');
    if (!structural.frames.some((f) => f.id === structural.dupId)) throw new Error('duplicate missing after reflow');
    assertStrip(structural.frames, 'after-duplicate-delete');
    await shot('overview-after-edits.png');

    await open('?snap=after&view=page&frame=shape:slide-4');
    await shot('slide-4-after.png', ['slide-4-v2-after.png']);
    const afterName = await page.evaluate(() => {
      const box = (window.__pawQa.frameBoxes || []).find((f) => f.id === 'shape:slide-4');
      return box?.name || '';
    });
    if (afterName === '一次会话里的五件事') {
      throw new Error('stale slide-4 name after replacePlate');
    }

    if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(' | ')}`);

    const report = {
      origin,
      mounted,
      consoleErrors,
      shots,
      identity,
      overview: overviewState,
      reorder,
      mid,
      structural,
      afterName
    };
    fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(report, null, 2));
    await browser.close();
    return report;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  captureSemanticDeck()
    .then((r) => {
      console.log(`capture_semantic_deck: ok shots=${r.shots.length} mounted=${r.mounted}`);
      if (r.consoleErrors.length) console.warn(r.consoleErrors);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
