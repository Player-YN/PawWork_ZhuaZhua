/**
 * Focused Slides filmstrip reorder: math, IDs, persist, selection, camera, cancel, keyboard.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FILMSTRIP_REORDER_GESTURE,
  filmstripDropIndex,
  isFilmstripReorderKey,
  moveIndexInList,
  planReorderFrames,
  slideStripBox
} from '../../src/agent/vnext/sessionWorkspace/slidesLayout.js';
import { slideCameraOptions } from '../../src/agent/vnext/sessionWorkspace/slidesStage.js';
import { applyEngineCommands, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { semanticDeckOutline } from './harness/semanticDeckFixture.mjs';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
const helpJs = fs.readFileSync(path.join(root, 'src/preview/officeHelp.js'), 'utf8');

function stripFrames(count = 7) {
  return Array.from({ length: count }, (_, i) => ({
    id: `shape:slide-${i + 1}`,
    x: slideStripBox(i).x,
    y: 80,
    w: 1920,
    h: 1080,
    name: `幻灯片 ${i + 1}`
  }));
}

const seven = stripFrames(7);
const slide2To6 = planReorderFrames(seven, 1, 5);
assert.equal(slide2To6.changed, true);
assert.equal(slide2To6.order[5], 'shape:slide-2');
assert.equal(slide2To6.frames[5].id, 'shape:slide-2');
assert.equal(slide2To6.frames[5].x, slideStripBox(5).x);
assert.deepEqual(
  slide2To6.order.slice().sort(),
  seven.map((f) => f.id).sort()
);
assert.equal(slide2To6.frames.length, 7);
for (let i = 1; i < slide2To6.frames.length; i++) {
  assert.ok(slide2To6.frames[i].x > slide2To6.frames[i - 1].x + slide2To6.frames[i - 1].w - 1);
}

const firstLast = planReorderFrames(seven, 0, 6);
assert.equal(firstLast.order[6], 'shape:slide-1');
assert.equal(firstLast.frames[0].id, 'shape:slide-2');
const lastFirst = planReorderFrames(seven, 6, 0);
assert.equal(lastFirst.order[0], 'shape:slide-7');
assert.equal(lastFirst.frames[1].id, 'shape:slide-1');

const cancel = planReorderFrames(seven, 2, 2);
assert.equal(cancel.changed, false);
assert.deepEqual(cancel.order, seven.map((f) => f.id));
assert.equal(moveIndexInList(0, 6, 1).changed, false);
assert.equal(filmstripDropIndex([{ top: 0, height: 32 }], 10, 0).changed, false);

assert.equal(isFilmstripReorderKey({ altKey: true, shiftKey: true, key: 'ArrowRight' }), 1);
assert.equal(isFilmstripReorderKey({ altKey: true, shiftKey: true, key: 'ArrowLeft' }), -1);
assert.equal(isFilmstripReorderKey({ key: 'ArrowRight' }), 0);
assert.equal(isFilmstripReorderKey({ shiftKey: true, key: 'ArrowRight' }), 0);
assert.match(FILMSTRIP_REORDER_GESTURE, /Alt\+Shift\+ArrowLeft\/ArrowRight/);

const created = createScene({ op: 'createScene', ...semanticDeckOutline() });
assert.equal(created.ok, true, created.error);
const beforeNodes = listEngineNodes(created.canvas);
const beforeFrames = beforeNodes.filter((n) => n.type === 'frame').sort((a, b) => a.x - b.x);
const beforeIds = beforeFrames.map((f) => f.nodeId);
const childIdsBefore = beforeNodes.filter((n) => n.parentId === 'shape:slide-2').map((n) => n.nodeId).sort();
assert.equal(beforeFrames.length, 7);
const from = beforeFrames.findIndex((f) => f.nodeId === 'shape:slide-2');
const destOrder = [...beforeIds];
const [moved] = destOrder.splice(from, 1);
destOrder.splice(5, 0, moved);

const reordered = applyEngineCommands(created.canvas, [{ op: 'reorder', order: destOrder, keepId: 'shape:slide-2' }]);
assert.equal(reordered.ok, true, reordered.error);
assert.ok(reordered.applied.includes('reorder'));
const afterNodes = listEngineNodes(reordered.doc);
const afterFrames = afterNodes.filter((n) => n.type === 'frame').sort((a, b) => a.x - b.x);
assert.equal(afterFrames.length, 7);
assert.deepEqual(afterFrames.map((f) => f.nodeId).sort(), beforeIds.slice().sort());
assert.equal(afterFrames[5].nodeId, 'shape:slide-2');
assert.equal(afterFrames[5].x, slideStripBox(5).x);
const childIdsAfter = afterNodes.filter((n) => n.parentId === 'shape:slide-2').map((n) => n.nodeId).sort();
assert.deepEqual(childIdsAfter, childIdsBefore);
assert.equal(afterFrames.filter((f) => f.nodeId === 'shape:slide-2').length, 1);

const persistFrames = listEngineNodes(reordered.doc)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => a.x - b.x);
assert.equal(persistFrames[5].nodeId, 'shape:slide-2');
const cam = slideCameraOptions(
  { x: persistFrames[5].x, y: persistFrames[5].y, w: persistFrames[5].w, h: persistFrames[5].h },
  'page'
);
assert.equal(cam.constraints.bounds.x, persistFrames[5].x);
assert.equal(cam.constraints.bounds.w, 1920);

const same = applyEngineCommands(reordered.doc, [{ op: 'reorder', order: destOrder }]);
assert.equal(same.ok, true, same.error);
const sameFrames = listEngineNodes(same.doc)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => a.x - b.x);
assert.deepEqual(
  sameFrames.map((f) => f.nodeId),
  persistFrames.map((f) => f.nodeId)
);

assert.match(runtimeEntry, /reorderSlides\(/);
assert.match(runtimeEntry, /markHistoryStoppingPoint\('reorderSlides'\)/);
assert.match(runtimeEntry, /op === 'reorder'/);
assert.match(runtimeEntry, /if \(!editor \|\| frames\.length <= 1\) return false/);
assert.match(designJs, /reorderSlides/);
assert.match(designJs, /isFilmstripReorderKey/);
assert.match(designJs, /filmstripDropIndex/);
assert.match(designJs, /cancelFilmDrag/);
assert.match(designJs, /aria-live/);
assert.match(designJs, /FILMSTRIP_REORDER_GESTURE/);
assert.match(designJs, /pointercancel/);
assert.doesNotMatch(designJs, /draggable\s*=\s*true/);
assert.doesNotMatch(designJs, /dataTransfer|application\/x-paw|Files/);
assert.match(designHtml, /aria-label="幻灯片胶片条"/);
assert.match(designHtml, /is-drop-before/);
assert.match(designHtml, /--accent/);
assert.match(helpJs, /Alt\+Shift\+左右箭头|Alt\+Shift\+Left\/Right/);
assert.match(helpJs, /不占用方向键微移|canvas arrows still nudge/);

const { classifyOfficeKey } = await import(pathToFileURL(path.join(root, 'src/preview/officeShortcuts.js')).href);
function keyEvent(partial) {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: '', code: '', ...partial };
}
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'slides' }), null);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowLeft' }), { surface: 'slides' }), null);
assert.equal(
  classifyOfficeKey(keyEvent({ altKey: true, shiftKey: true, key: 'ArrowRight' }), { surface: 'slides' }),
  null
);

{
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-reorder-count';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const rec = createArtifact(store, guest, {
    sessionId,
    name: 'slides.json',
    content: JSON.stringify(created.canvas),
    mimeType: 'application/json'
  });
  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: { artifactId: rec.artifactId, selections: [{ nodeId: 'shape:slide-2' }] }
  });
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  const beforeCount = runtime.listArtifacts(sessionId).length;
  const wrote = await tools.deck.execute({
    act: 'write',
    artifactId: rec.artifactId,
    commands: [{ op: 'reorder', order: destOrder }]
  });
  assert.equal(wrote.ok, true, wrote.error);
  assert.equal(runtime.listArtifacts(sessionId).length, beforeCount);
  const live = listEngineNodes(guest.readFile(rec.primaryPath))
    .filter((n) => n.type === 'frame')
    .sort((a, b) => a.x - b.x);
  assert.equal(live[5].nodeId, 'shape:slide-2');
}

console.log('test_slides_reorder: ok');
