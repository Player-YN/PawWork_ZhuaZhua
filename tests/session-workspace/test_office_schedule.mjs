import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { inventoryFromSession } from '../../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { scheduleActiveToolNames, scheduleSessionTools } from '../../src/agent/vnext/sessionWorkspace/toolSchedule.js';
import { createArtifact, deleteArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { emptyPawCanvas } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { buildSessionAgentInstructions } from '../../src/agent/vnext/sessionWorkspace/prompt.js';

function setup(id) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: id });
  const execution = beginExecution(store, id, {});
  const fs = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId: id });
  return { store, runtime, fs, tools, sessionId: id };
}

async function run() {
  const { store, fs, tools, sessionId } = setup('s-office-sched');
  const emptyInv = inventoryFromSession(store, sessionId, fs);
  const ALWAYS = ['acquire', 'clarify', 'deck', 'doc', 'inspect', 'run', 'sheet', 'web'];
  const emptyNames = scheduleActiveToolNames(emptyInv).sort();
  assert.deepEqual(emptyNames, ALWAYS);
  const visible = scheduleSessionTools(tools, emptyInv);
  assert.deepEqual(Object.keys(visible).sort(), ALWAYS);
  const sys0 = buildSessionAgentInstructions({ sessionId, inventory: emptyInv });
  assert.doesNotMatch(sys0, /setRange|setSlotText|A1:Z/);
  assert.match(sys0, /always present/);
  assert.doesNotMatch(sys0, /not present at session start/);

  const created = await tools.run.execute({
    op: 'html',
    name: 'qbr.json',
    commands: [
      {
        op: 'createScene',
        kind: 'deck',
        title: 'QBR',
        frames: [
          {
            id: 'slide-1',
            nodes: [
              { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
              { id: 'headline', type: 'headline', text: 'Hello', box: { x: 80, y: 80, w: 1760, h: 120 } }
            ]
          }
        ]
      }
    ]
  });
  assert.equal(created.ok, true, created.error);
  const afterDeck = inventoryFromSession(store, sessionId, fs);
  const deckNames = scheduleActiveToolNames(afterDeck);
  assert.deepEqual([...deckNames].sort(), ALWAYS);
  const sameWhenUnfocused = scheduleActiveToolNames(afterDeck, { tabUnfocused: true });
  assert.deepEqual([...sameWhenUnfocused].sort(), ALWAYS);

  const wb = await tools.run.execute({
    op: 'sheet',
    commands: [
      {
        op: 'createWorkbook',
        name: 'rev.csv',
        sheets: [{ name: 'Sheet1', rows: [['Co', 'Rev'], ['Amazon', '716']] }]
      }
    ]
  });
  assert.equal(wb.ok, true, wb.error);
  const afterBoth = inventoryFromSession(store, sessionId, fs);
  const both = scheduleActiveToolNames(afterBoth);
  assert.deepEqual([...both].sort(), ALWAYS);
  assert.ok(afterBoth.sheet.length);
  assert.ok(afterBoth.deck.length || afterBoth.poster.length);
  assert.equal(afterBoth.doc.length, 0);

  deleteArtifact(store, fs, sessionId, created.artifact.artifactId);
  const afterDel = inventoryFromSession(store, sessionId, fs);
  const afterDelNames = scheduleActiveToolNames(afterDel);
  assert.deepEqual([...afterDelNames].sort(), ALWAYS);
  assert.equal(afterDel.deck.length + afterDel.poster.length, 0);
  assert.ok(afterDel.sheet.length);

  const noSheet = await tools.sheet.execute({ act: 'write', value: 1, a1: 'A1' });
  // sheet still in inventory
  assert.equal(noSheet.ok, true, noSheet.error);

  const emptySession = setup('s-empty-office');
  const deny = await emptySession.tools.sheet.execute({ act: 'write', value: 1 });
  assert.equal(deny.ok, false);
  assert.equal(deny.code, 'NO_CANVAS');
  const denyWeb = await emptySession.tools.web.execute({ act: 'write', text: 'x' });
  assert.equal(denyWeb.ok, false);
  assert.equal(denyWeb.code, 'NO_CANVAS');

  const site = await tools.run.execute({
    op: 'write_artifact',
    name: 'home.html',
    mimeType: 'text/html',
    content: '<!DOCTYPE html><html data-paw-kind="site"><body><h1>Home</h1></body></html>'
  });
  assert.equal(site.ok, true, site.error);
  const afterSite = inventoryFromSession(store, sessionId, fs);
  const withWeb = scheduleActiveToolNames(afterSite);
  assert.deepEqual([...withWeb].sort(), ALWAYS);
  assert.ok(afterSite.web.length);
  assert.ok(afterSite.sheet.length);

  const fatSess = setup('s-fat-canvas');
  const base = emptyPawCanvas({ shell: 'design', title: 'Fat' });
  const fatDoc = {
    ...base,
    tldraw: {
      ...(base.tldraw || {}),
      store: {
        ...((base.tldraw && base.tldraw.store) || {}),
        'asset:fat': {
          typeName: 'asset',
          type: 'image',
          props: { src: `data:image/jpeg;base64,${'A'.repeat(20000)}` }
        }
      }
    }
  };
  const fatRec = createArtifact(fatSess.store, fatSess.fs, {
    sessionId: fatSess.sessionId,
    name: 'design.json',
    content: JSON.stringify(fatDoc),
    mimeType: 'application/json'
  });
  const fatInv = inventoryFromSession(fatSess.store, fatSess.sessionId, fatSess.fs);
  assert.ok(fatInv.poster.length || fatInv.deck.length, 'fat pawCanvas must stay in visual inventory');
  const fatRead = await fatSess.tools.deck.execute({ act: 'read', artifactId: fatRec.artifactId });
  assert.notEqual(fatRead.code, 'NO_CANVAS', fatRead.error);

  console.log('test_office_schedule: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
