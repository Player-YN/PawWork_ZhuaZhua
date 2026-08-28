import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution, settleExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact, listArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { emptyPawCanvas, isPawCanvasDoc, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { htmlWritePolicy } from '../../src/agent/vnext/sessionWorkspace/htmlWritePolicy.js';
import {
  AMBIGUOUS_CANVAS,
  AMBIGUOUS_WORKBOOK,
  clearVisualCreationLedger
} from '../../src/agent/vnext/sessionWorkspace/visualCreationLedger.js';
import { aoaToCsv } from '../../src/preview/sheetCodec.js';
import { createLiveTabHost } from './liveTabHost.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const uglyFixture = JSON.parse(
  fs.readFileSync(path.join(here, 'fixtures/visual/ugly-wireframe.json'), 'utf8')
);

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  return { store, runtime, fs: guest, tools, sessionId, execution };
}

function seedWorkbook(store, guest, sessionId, { name = 'book.csv', focus = false, rows = [['列1'], ['keep']] } = {}) {
  const rec = createArtifact(store, guest, {
    sessionId,
    name,
    content: aoaToCsv(rows),
    mimeType: 'text/csv'
  });
  if (focus) {
    store.put('sessions', sessionId, {
      ...store.get('sessions', sessionId),
      activeWorkbook: {
        artifactId: rec.artifactId,
        overview: { sheets: [{ name: 'Sheet1', rowCount: rows.length }] }
      }
    });
  }
  return rec;
}

function workbookPayload(title, extra = {}) {
  return {
    op: 'createWorkbook',
    name: `${String(title || 'book').replace(/\s+/g, '_')}.csv`,
    sheets: [{ name: 'Sheet1', rows: [['列1'], [title]] }],
    ...extra
  };
}

function seedCanvas(store, guest, sessionId, { name = 'slides.json', shell = 'slides', focus = false } = {}) {
  const rec = createArtifact(store, guest, {
    sessionId,
    name,
    content: JSON.stringify(emptyPawCanvas({ shell, title: shell === 'slides' ? 'Slides' : 'Design' })),
    mimeType: 'application/json'
  });
  if (focus) {
    store.put('sessions', sessionId, {
      ...store.get('sessions', sessionId),
      activeHtml: { artifactId: rec.artifactId, selections: [{ nodeId: 'shape:frame' }] }
    });
  }
  return rec;
}

function deckPayload(title) {
  return {
    op: 'createScene',
    kind: 'deck',
    title,
    frames: [
      {
        id: 'slide-1',
        nodes: [
          { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
          { id: 'headline', type: 'headline', text: title, box: { x: 80, y: 80, w: 1600, h: 100 } }
        ]
      }
    ]
  };
}

function uglyDeckInput() {
  const frame = uglyFixture.frames[0];
  return {
    op: 'createScene',
    kind: 'deck',
    title: 'Q3 Strategy',
    frames: [
      {
        id: frame.id,
        size: { w: frame.w, h: frame.h },
        nodes: frame.nodes
      }
    ]
  };
}

function canvasCount(store, fs, sessionId, kind) {
  return listArtifacts(store, sessionId).filter((a) => {
    try {
      const text = fs.readFile(a.primaryPath);
      if (!isPawCanvasDoc(text)) return false;
      const doc = JSON.parse(text);
      const isDeck = doc.shell === 'slides';
      return kind === 'deck' ? isDeck : !isDeck;
    } catch {
      return false;
    }
  });
}

async function run() {
  {
    const { tools } = setup('s-ledger-schema');
    const props = tools.run.parameters?.properties || {};
    assert.ok(props.artifactMode, 'run schema documents artifactMode');
    assert.match(String(tools.run.description || ''), /artifactMode:"new"/);
    assert.match(String(tools.run.description || ''), /AMBIGUOUS_CANVAS/);
    assert.match(String(tools.run.description || ''), /AMBIGUOUS_WORKBOOK/);
    assert.match(String(props.artifactMode?.description || ''), /workbook/);
  }

  // 1. Empty session + 8 sequential createScene deck calls → exactly 1 slides artifact
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-eight');
    let firstId = '';
    for (let i = 0; i < 8; i++) {
      const made = await tools.run.execute(deckPayload(`Deck ${i + 1}`));
      assert.equal(made.ok, true, made.error);
      if (!firstId) firstId = made.artifactId;
      assert.equal(made.artifactId, firstId);
    }
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
    assert.equal(canvasCount(store, guest, sessionId, 'deck').length, 1);
  }

  // 2. First call QA fails → no ledger artifact; later valid creates exactly 1
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-qa-first');
    const failed = await tools.run.execute(uglyDeckInput());
    assert.equal(failed.ok, false);
    assert.equal(failed.code, 'CANVAS_QA_FAILED');
    assert.equal(runtime.listArtifacts(sessionId).length, 0);
    const made = await tools.run.execute(deckPayload('After QA'));
    assert.equal(made.ok, true, made.error);
    const again = await tools.run.execute(deckPayload('Repair'));
    assert.equal(again.ok, true, again.error);
    assert.equal(again.artifactId, made.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
    assert.equal(canvasCount(store, guest, sessionId, 'deck').length, 1);
  }

  // 3. First valid then 7 repairs / retries / nested commands → same artifact
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-repairs');
    const first = await tools.run.execute(deckPayload('Seed'));
    assert.equal(first.ok, true, first.error);
    for (let i = 0; i < 5; i++) {
      const repaired = await tools.run.execute(deckPayload(`Repair ${i}`));
      assert.equal(repaired.ok, true, repaired.error);
      assert.equal(repaired.artifactId, first.artifactId);
      assert.equal(repaired.reused, true);
    }
    const nested = await tools.run.execute({
      op: 'createScene',
      commands: [
        {
          op: 'createScene',
          kind: 'deck',
          title: 'Nested',
          frames: deckPayload('Nested').frames
        }
      ]
    });
    assert.equal(nested.ok, true, nested.error);
    assert.equal(nested.artifactId, first.artifactId);
    const lateFocus = await tools.run.execute({
      op: 'fromPage',
      kind: 'deck',
      title: 'From page',
      html: '<html><body><h1>页</h1><p>同一文件</p></body></html>'
    });
    if (lateFocus.ok) {
      assert.equal(lateFocus.artifactId, first.artifactId);
    }
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
    assert.equal(canvasCount(store, guest, sessionId, 'deck').length, 1);
  }

  // 4. One existing deck → reuse; multiple decks + no target → AMBIGUOUS, no mutation
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-one');
    const only = seedCanvas(store, guest, sessionId, { name: 'slides.json' });
    const reused = await tools.run.execute(deckPayload('唯一幻灯'));
    assert.equal(reused.ok, true, reused.error);
    assert.equal(reused.reused, true);
    assert.equal(reused.artifactId, only.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
  }
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-ambiguous');
    const a = seedCanvas(store, guest, sessionId, { name: 'slides.json' });
    const b = seedCanvas(store, guest, sessionId, { name: 'slides-2.json' });
    const beforeA = guest.readFile(a.primaryPath);
    const beforeB = guest.readFile(b.primaryPath);
    const before = runtime.listArtifacts(sessionId).length;
    const hit = await tools.run.execute(deckPayload('猜一个'));
    assert.equal(hit.ok, false);
    assert.equal(hit.code, AMBIGUOUS_CANVAS);
    assert.ok(Array.isArray(hit.candidates) && hit.candidates.length >= 2);
    assert.ok(hit.candidates.some((c) => c.artifactId === a.artifactId));
    assert.ok(hit.candidates.some((c) => c.artifactId === b.artifactId));
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.equal(guest.readFile(a.primaryPath), beforeA);
    assert.equal(guest.readFile(b.primaryPath), beforeB);
  }

  // 5. Explicit artifactId targets exactly that deck among several
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-explicit');
    seedCanvas(store, guest, sessionId, { name: 'slides-a.json' });
    const mid = seedCanvas(store, guest, sessionId, { name: 'slides-b.json' });
    seedCanvas(store, guest, sessionId, { name: 'slides-c.json' });
    const before = runtime.listArtifacts(sessionId).length;
    const hit = await tools.run.execute({
      ...deckPayload('指定中间'),
      artifactId: mid.artifactId
    });
    assert.equal(hit.ok, true, hit.error);
    assert.equal(hit.artifactId, mid.artifactId);
    assert.equal(hit.reused, true);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.match(guest.readFile(mid.primaryPath), /指定中间/);
  }

  // 6. artifactMode:new creates at most one additional deck, then reuses it
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-mode-new');
    const existing = seedCanvas(store, guest, sessionId, { name: 'slides.json', focus: true });
    const created = await tools.run.execute({
      ...deckPayload('第二份'),
      artifactMode: 'new'
    });
    assert.equal(created.ok, true, created.error);
    assert.notEqual(created.artifactId, existing.artifactId);
    assert.notEqual(created.reused, true);
    const extraId = created.artifactId;
    for (let i = 0; i < 4; i++) {
      const again = await tools.run.execute({
        ...deckPayload(`还要新的 ${i}`),
        artifactMode: 'new'
      });
      assert.equal(again.ok, true, again.error);
      assert.equal(again.artifactId, extraId);
    }
    const decks = canvasCount(store, guest, sessionId, 'deck');
    assert.equal(decks.length, 2);
    assert.equal(runtime.listArtifacts(sessionId).length, 2);
  }

  // 7. Poster vs deck remain separate kinds
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-kinds');
    const deck = seedCanvas(store, guest, sessionId, { name: 'slides.json', focus: true });
    const beforeBytes = guest.readFile(deck.primaryPath);
    const poster = await tools.run.execute({
      op: 'createScene',
      kind: 'poster',
      title: 'hiring',
      nodes: [{ id: 't', type: 'text', text: '海报', box: { x: 40, y: 40, w: 400, h: 60 } }]
    });
    assert.equal(poster.ok, true, poster.error);
    assert.equal(poster.kind, 'poster');
    assert.notEqual(poster.artifactId, deck.artifactId);
    assert.notEqual(poster.reused, true);
    assert.equal(guest.readFile(deck.primaryPath), beforeBytes);
    const poster2 = await tools.run.execute({
      op: 'createScene',
      kind: 'poster',
      title: 'hiring-2',
      nodes: [{ id: 't', type: 'text', text: '同一海报', box: { x: 40, y: 40, w: 400, h: 60 } }]
    });
    assert.equal(poster2.ok, true, poster2.error);
    assert.equal(poster2.artifactId, poster.artifactId);
    assert.equal(canvasCount(store, guest, sessionId, 'deck').length, 1);
    assert.equal(canvasCount(store, guest, sessionId, 'poster').length, 1);
  }

  // 8. Generic write_artifact / run FS / package writes rejected; normal JSON/site/doc allowed
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-writes');
    const canvas = JSON.stringify(emptyPawCanvas({ shell: 'slides', title: 'Sneak' }));
    const raw = await tools.run.execute({
      op: 'write_artifact',
      name: 'slides.json',
      mimeType: 'application/json',
      content: canvas
    });
    assert.equal(raw.ok, false);
    assert.equal(raw.code, 'USE_CANVAS');

    const b64 = await tools.run.execute({
      op: 'write_artifact',
      name: 'deck.json',
      mimeType: 'application/json',
      content: Buffer.from(canvas, 'utf8').toString('base64')
    });
    assert.equal(b64.ok, false);
    assert.equal(b64.code, 'USE_CANVAS');

    const bytes = await tools.run.execute({
      op: 'write_artifact',
      name: 'design.json',
      mimeType: 'application/json',
      content: canvas
    });
    assert.equal(bytes.ok, false);
    assert.equal(bytes.code, 'USE_CANVAS');

    const site = await tools.run.execute({
      op: 'write_artifact',
      name: 'home.html',
      mimeType: 'text/html',
      content: '<!DOCTYPE html><html data-paw-kind="site"><body><h1>Home</h1></body></html>'
    });
    assert.equal(site.ok, true, site.error);

    const doc = await tools.run.execute({
      op: 'write_artifact',
      name: 'note.html',
      mimeType: 'text/html',
      content: '<html data-paw-kind="document" id="paw-document"><body><p>Hi</p></body></html>'
    });
    assert.equal(doc.ok, true, doc.error);

    const data = await tools.run.execute({
      op: 'write_artifact',
      name: 'rows.json',
      mimeType: 'application/json',
      content: JSON.stringify({ ok: true, rows: [1, 2, 3] })
    });
    assert.equal(data.ok, true, data.error);

    const coded = await tools.run.execute({
      code: `await fs.writeFile('/artifacts/slides.json', ${JSON.stringify(canvas)});`
    });
    assert.equal(coded.ok, false);
    assert.match(String(coded.error || coded.code || ''), /USE_CANVAS|createScene|pawCanvas|Visual design/i);

    const pack = await tools.run.execute({
      op: 'write_package_file',
      artifactId: data.artifact.artifactId,
      path: `/artifacts/${data.artifact.packageDir}/slides.json`,
      content: canvas
    });
    assert.equal(pack.ok, false);
    assert.equal(pack.code, 'USE_CANVAS');

    assert.equal(canvasCount(store, guest, sessionId, 'deck').length, 0);
    assert.equal(htmlWritePolicy(canvas, 'a.json').allow, false);
    assert.equal(htmlWritePolicy(JSON.stringify({ ok: true }), 'n.json').allow, true);
  }

  // 9. Parallel sessions / executions do not share ledger
  {
    const a = setup('s-ledger-par-a');
    const b = setup('s-ledger-par-b');
    const a1 = await a.tools.run.execute(deckPayload('A1'));
    const b1 = await b.tools.run.execute(deckPayload('B1'));
    assert.equal(a1.ok, true, a1.error);
    assert.equal(b1.ok, true, b1.error);
    assert.notEqual(a1.artifactId, b1.artifactId);
    const a2 = await a.tools.run.execute(deckPayload('A2'));
    const b2 = await b.tools.run.execute(deckPayload('B2'));
    assert.equal(a2.artifactId, a1.artifactId);
    assert.equal(b2.artifactId, b1.artifactId);
    assert.equal(a.runtime.listArtifacts(a.sessionId).length, 1);
    assert.equal(b.runtime.listArtifacts(b.sessionId).length, 1);
    settleExecution(a.store, a.execution, 'settled');
    assert.deepEqual(Object.keys(a.execution.visualCreation.byKind), []);
    const b3 = await b.tools.run.execute(deckPayload('B3'));
    assert.equal(b3.artifactId, b1.artifactId);
    clearVisualCreationLedger(b.execution);
  }

  // 10. Trajectory-shaped command-level artifactId and late activeHtml stay fixed
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-cmd-aid');
    const blank = seedCanvas(store, guest, sessionId, { name: 'slides.json', focus: true });
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      commands: [
        {
          artifactId: blank.artifactId,
          kind: 'deck',
          title: 'Paw Work',
          frames: [
            {
              id: 'slide-1',
              nodes: [
                { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
                { id: 'headline', type: 'headline', text: '重塑浏览器端 AI 生产力', box: { x: 80, y: 80, w: 1760, h: 120 } }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(compiled.artifactId, blank.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.ok(listEngineNodes(guest.readFile(blank.primaryPath)).some((n) => /重塑浏览器端/.test(n.text || '')));
  }
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-ledger-late-html');
    const rec = seedCanvas(store, guest, sessionId, { name: 'slides.json', focus: false });
    const compiled = await tools.run.execute(deckPayload('未对焦也复用'));
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(compiled.artifactId, rec.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
    store.put('sessions', sessionId, {
      ...store.get('sessions', sessionId),
      activeHtml: { artifactId: rec.artifactId, selections: [] }
    });
    const again = await tools.run.execute(deckPayload('晚到对焦'));
    assert.equal(again.artifactId, rec.artifactId);
  }

  // 11. Open workbook + createWorkbook without artifactMode → same artifactId
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-wb-open');
    const open = seedWorkbook(store, guest, sessionId, { name: 'open.csv', focus: true });
    const before = guest.readFile(open.primaryPath);
    const hit = await tools.run.execute(workbookPayload('should-reuse'));
    assert.equal(hit.ok, true, hit.error);
    assert.equal(hit.reused, true);
    assert.equal(hit.artifactId, open.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
    assert.equal(guest.readFile(open.primaryPath), before, 'reuse must not wipe the open book');
  }

  // 12. artifactMode:"new" → second workbook; further new binds to that extra
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-wb-mode-new');
    const existing = seedWorkbook(store, guest, sessionId, { name: 'open.csv', focus: true });
    const created = await tools.run.execute({ ...workbookPayload('第二份'), artifactMode: 'new' });
    assert.equal(created.ok, true, created.error);
    assert.notEqual(created.artifactId, existing.artifactId);
    assert.notEqual(created.reused, true);
    const extraId = created.artifactId;
    const again = await tools.run.execute({ ...workbookPayload('还要新的'), artifactMode: 'new' });
    assert.equal(again.ok, true, again.error);
    assert.equal(again.artifactId, extraId);
    assert.equal(runtime.listArtifacts(sessionId).length, 2);
  }

  // 13. Two workbooks + no target → AMBIGUOUS_WORKBOOK with candidates
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-wb-ambiguous');
    const a = seedWorkbook(store, guest, sessionId, { name: 'a.csv' });
    const b = seedWorkbook(store, guest, sessionId, { name: 'b.csv' });
    const beforeA = guest.readFile(a.primaryPath);
    const beforeB = guest.readFile(b.primaryPath);
    const before = runtime.listArtifacts(sessionId).length;
    const hit = await tools.run.execute(workbookPayload('猜一个'));
    assert.equal(hit.ok, false);
    assert.equal(hit.code, AMBIGUOUS_WORKBOOK);
    assert.ok(Array.isArray(hit.candidates) && hit.candidates.length >= 2);
    assert.ok(hit.candidates.some((c) => c.artifactId === a.artifactId));
    assert.ok(hit.candidates.some((c) => c.artifactId === b.artifactId));
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.equal(guest.readFile(a.primaryPath), beforeA);
    assert.equal(guest.readFile(b.primaryPath), beforeB);
  }

  // 14. Live tab: reuse must not create; three writes → three incremental paints + autosaves
  {
    const { store, fs: guest, sessionId, execution } = setup('s-wb-live-tab');
    const open = seedWorkbook(store, guest, sessionId, {
      name: 'live.csv',
      focus: true,
      rows: [['h'], [''], [''], ['']]
    });
    const tab = createLiveTabHost([{ name: 'Sheet1', rows: [['h'], [''], [''], ['']] }], 'live.csv');
    const methods = [];
    const toolsLive = createSessionTools({
      store,
      execution,
      fs: guest,
      sessionId,
      hostSheet: async (payload) => {
        methods.push(String(payload.method || ''));
        if (payload.method === 'create') {
          return { ok: false, error: 'createWorkbook must reuse the open workbook' };
        }
        if (payload.method === 'apply') {
          const snap = tab.apply(payload.commands || []);
          return {
            ok: snap.ok !== false,
            result: {
              ok: snap.ok !== false,
              readback: snap.readback,
              applied: snap.applied,
              error: snap.error,
              code: snap.code
            }
          };
        }
        return { ok: true, result: { ok: true } };
      }
    });
    const reused = await toolsLive.run.execute(workbookPayload('open-tab'));
    assert.equal(reused.ok, true, reused.error);
    assert.equal(reused.reused, true);
    assert.equal(reused.artifactId, open.artifactId);
    assert.ok(!methods.includes('create'));
    const writes = ['one', 'two', 'three'];
    for (let i = 0; i < writes.length; i++) {
      const written = await toolsLive.sheet.execute({
        act: 'write',
        artifactId: open.artifactId,
        commands: [{ op: 'setRange', a1: `A${i + 2}`, value: writes[i] }]
      });
      assert.equal(written.ok, true, written.error);
      assert.equal(tab.paintCount(), i + 1);
      assert.equal(tab.autosaveCount(), i + 1);
      assert.equal(tab.persistSheets()[0].rows[i + 1][0], writes[i]);
    }
    assert.equal(tab.paintCount(), 3);
    assert.equal(tab.autosaveCount(), 3);
    assert.equal(tab.persistSheets()[0].rows[1][0], 'one');
    assert.equal(methods.filter((m) => m === 'apply').length, 3);
  }

  console.log('test_visual_create_ledger: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
