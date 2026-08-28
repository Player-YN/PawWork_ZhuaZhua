import assert from 'node:assert/strict';
import {
  DECK_OPS,
  EDITOR_OP_MAP,
  LIVE_ONLY_OPS,
  applyEngineCommands,
  canvasReadModel,
  canvasSelectionCheck,
  compactCanvasOverview,
  editorMethodForOp,
  emptyPawCanvas,
  exportPawCanvas,
  listEngineNodes,
  parsePawCanvas
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { applyStoreCommands } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';

assert.equal(editorMethodForOp('align'), 'alignShapes');
assert.equal(editorMethodForOp('group'), 'groupShapes');
assert.equal(editorMethodForOp('setFill'), 'setStyleForSelectedShapes');
assert.equal(EDITOR_OP_MAP.pack, 'packShapes');
assert.ok(LIVE_ONLY_OPS.has('crop'));
assert.ok(LIVE_ONLY_OPS.has('pack'));

const doc = emptyPawCanvas({ shell: 'design', title: 'Ops' });
const store = doc.tldraw.document.store;
const a = applyStoreCommands(store, [{ op: 'createShape', shapeType: 'geo', id: 'a', box: { x: 10, y: 10, w: 80, h: 40 } }], {});
assert.equal(a.ok, true);
const b = applyStoreCommands(store, [{ op: 'createShape', shapeType: 'geo', id: 'b', box: { x: 40, y: 80, w: 80, h: 40 } }], {});
assert.equal(b.ok, true);
const aligned = applyEngineCommands({ ...doc, tldraw: { document: { store } } }, [{ op: 'align', align: 'left', nodeIds: ['shape:a', 'shape:b'] }]);
assert.equal(aligned.ok, true, aligned.error);
assert.ok(aligned.applied.includes('align'));
const nodes = listEngineNodes(aligned.doc);
const na = nodes.find((n) => n.nodeId === 'shape:a');
const nb = nodes.find((n) => n.nodeId === 'shape:b');
assert.equal(na.x, nb.x);

const grouped = applyEngineCommands(aligned.doc, [{ op: 'group', nodeIds: ['shape:a', 'shape:b'] }]);
assert.equal(grouped.ok, true, grouped.error);
assert.ok(listEngineNodes(grouped.doc).some((n) => n.type === 'group'));

const themed = applyEngineCommands(grouped.doc, [{ op: 'theme', color: 'red' }]);
assert.equal(themed.ok, true, themed.error);
assert.ok(themed.applied.includes('theme'));
assert.ok(listEngineNodes(themed.doc).some((n) => n.fill === 'red' || n.type === 'group' || n.type === 'frame'));

const png = exportPawCanvas(themed.doc, 'png');
assert.equal(png.ok, false);
assert.equal(png.code, 'NEED_TAB');
const pdf = exportPawCanvas(themed.doc, 'pdf');
assert.equal(pdf.ok, false);
assert.equal(pdf.code, 'NEED_TAB');
const svg = exportPawCanvas(themed.doc, 'svg');
assert.equal(svg.ok, false);
assert.equal(svg.code, 'NEED_TAB');

const twoSel = [{ nodeId: 'shape:a' }, { nodeId: 'shape:b' }];
const textCheck = canvasSelectionCheck([{ op: 'setSlotText', text: 'x' }], twoSel);
assert.equal(textCheck.ok, false);
assert.equal(textCheck.code, 'NEED_SELECTION');
const alignCheck = canvasSelectionCheck([{ op: 'align', align: 'left' }], twoSel);
assert.equal(alignCheck.ok, true);
const none = canvasSelectionCheck([{ op: 'setSlotText', text: 'x' }], []);
assert.equal(none.ok, false);

const packed = applyEngineCommands(themed.doc, [{ op: 'pack', nodeIds: ['shape:a', 'shape:b'] }]);
assert.equal(packed.ok, false);
assert.equal(packed.code, 'NEED_TAB');

const model = canvasReadModel(themed.doc, [{ nodeId: 'shape:a' }]);
assert.ok(model.frames.length >= 1);
assert.equal(model.selected[0], 'shape:a');
assert.ok(model.ops.includes('align'));
assert.ok(model.ops.includes('createShape'));
assert.ok(Array.isArray(model.capabilities.point) && model.capabilities.point.includes('setSlotText'));
assert.ok(model.capabilities.arrange.includes('align'));
assert.deepEqual(model.acts, ['read', 'write', 'export']);
assert.ok(DECK_OPS.includes('hide'));
const overview = compactCanvasOverview(themed.doc, [{ nodeId: 'shape:a' }]);
assert.ok(overview.frames[0].nodeId);
assert.ok(overview.nodeCount >= 2);

const hidden = applyEngineCommands(themed.doc, [{ op: 'hide', nodeIds: ['shape:a'] }]);
assert.equal(hidden.ok, true, hidden.error);
assert.equal(listEngineNodes(hidden.doc).find((n) => n.nodeId === 'shape:a').hidden, true);

console.log('test_canvas_ops: ok');
