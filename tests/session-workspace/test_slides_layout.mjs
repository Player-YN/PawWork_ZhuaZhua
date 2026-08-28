import assert from 'node:assert/strict';
import {
  SLIDE_STRIP_GAP,
  SLIDE_STRIP_ORIGIN,
  SLIDE_FRAME_SIZE,
  slideStripBox,
  placeFramesInStrip,
  framesNeedStripMigration,
  migrateOverlappingSlideFrames,
  planInsertAfter,
  planDeleteFrame,
  planReorderFrames,
  planReorderByOrder,
  filmstripDropIndex,
  moveIndexInList,
  isFilmstripReorderKey,
  FILMSTRIP_REORDER_GESTURE,
  resolveSlideFrameName,
  resolveReplaceFrameName
} from '../../src/agent/vnext/sessionWorkspace/slidesLayout.js';
import { tldrawLicenseStatus, TLDRAW_LICENSE_MISSING_BLOCKER } from '../../src/agent/vnext/sessionWorkspace/tldrawLicense.js';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { applyEngineCommands, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { semanticDeckOutline, slide4ReplaceSlots, SEMANTIC_THEME_ID } from './harness/semanticDeckFixture.mjs';

assert.ok(SLIDE_STRIP_GAP >= 160 && SLIDE_STRIP_GAP <= 240);
assert.equal(SLIDE_FRAME_SIZE.w, 1920);
assert.equal(SLIDE_FRAME_SIZE.h, 1080);

const a = slideStripBox(0);
const b = slideStripBox(1);
const c = slideStripBox(2);
assert.equal(a.x, SLIDE_STRIP_ORIGIN.x);
assert.equal(a.y, SLIDE_STRIP_ORIGIN.y);
assert.equal(b.x, SLIDE_STRIP_ORIGIN.x + 1920 + SLIDE_STRIP_GAP);
assert.equal(c.x, SLIDE_STRIP_ORIGIN.x + 2 * (1920 + SLIDE_STRIP_GAP));
assert.ok(b.x > a.x + a.w);
assert.ok(c.x > b.x + b.w);

const stacked = [
  { id: 'shape:slide-1', x: 80, y: 80, w: 1920, h: 1080 },
  { id: 'shape:slide-2', x: 80, y: 80, w: 1920, h: 1080 },
  { id: 'shape:slide-3', x: 80, y: 80, w: 1920, h: 1080 }
];
assert.equal(framesNeedStripMigration(stacked), true);
const migrated = migrateOverlappingSlideFrames(stacked);
assert.equal(migrated.migrated, true);
assert.equal(migrated.frames[0].id, 'shape:slide-1');
assert.equal(migrated.frames[1].x, slideStripBox(1).x);
assert.notEqual(migrated.frames[0].x, migrated.frames[1].x);

const custom = [
  { id: 'shape:slide-1', x: 80, y: 80, w: 1920, h: 1080 },
  { id: 'shape:slide-2', x: 80, y: 1400, w: 1920, h: 1080 },
  { id: 'shape:slide-3', x: 2200, y: 80, w: 1920, h: 1080 }
];
assert.equal(framesNeedStripMigration(custom), false);
assert.equal(migrateOverlappingSlideFrames(custom).migrated, false);

const inserted = planInsertAfter(migrated.frames, 0);
assert.equal(inserted.spec.x, slideStripBox(1).x);
assert.equal(inserted.frames.length, 4);
assert.equal(inserted.frames[2].id, 'shape:slide-2');
assert.equal(inserted.frames[2].x, slideStripBox(2).x);

const deleted = planDeleteFrame(inserted.frames, inserted.spec.id || inserted.frames[1].id);
assert.equal(deleted.frames.length, 3);
assert.equal(deleted.frames[1].x, slideStripBox(1).x);

const strip3 = [
  { id: 'shape:slide-1', x: slideStripBox(0).x, y: 80, w: 1920, h: 1080 },
  { id: 'shape:slide-2', x: slideStripBox(1).x, y: 80, w: 1920, h: 1080 },
  { id: 'shape:slide-3', x: slideStripBox(2).x, y: 80, w: 1920, h: 1080 }
];
const firstToLast = planReorderFrames(strip3, 0, 2);
assert.equal(firstToLast.changed, true);
assert.deepEqual(firstToLast.order, ['shape:slide-2', 'shape:slide-3', 'shape:slide-1']);
assert.equal(firstToLast.frames[0].id, 'shape:slide-2');
assert.equal(firstToLast.frames[2].id, 'shape:slide-1');
assert.equal(firstToLast.frames[2].x, slideStripBox(2).x);
const lastToFirst = planReorderFrames(strip3, 2, 0);
assert.deepEqual(lastToFirst.order, ['shape:slide-3', 'shape:slide-1', 'shape:slide-2']);
const noop = planReorderFrames(strip3, 1, 1);
assert.equal(noop.changed, false);
assert.deepEqual(noop.order, ['shape:slide-1', 'shape:slide-2', 'shape:slide-3']);
assert.equal(moveIndexInList(0, 0, 1).changed, false);
const byOrder = planReorderByOrder(strip3, ['shape:slide-3', 'shape:slide-1', 'shape:slide-2']);
assert.equal(byOrder.frames[0].id, 'shape:slide-3');
assert.equal(byOrder.frames[1].x, slideStripBox(1).x);
const drop = filmstripDropIndex(
  [
    { top: 0, height: 40 },
    { top: 40, height: 40 },
    { top: 80, height: 40 }
  ],
  95,
  0
);
assert.equal(drop.to, 2);
assert.equal(drop.changed, true);
assert.equal(isFilmstripReorderKey({ altKey: true, shiftKey: true, key: 'ArrowRight' }), 1);
assert.equal(isFilmstripReorderKey({ altKey: true, shiftKey: true, key: 'ArrowLeft' }), -1);
assert.equal(isFilmstripReorderKey({ key: 'ArrowRight' }), 0);
assert.match(FILMSTRIP_REORDER_GESTURE, /Alt\+Shift\+ArrowLeft/);

assert.equal(resolveSlideFrameName({ name: '封面', slots: { title: '忽略' }, index: 0 }), '封面');
assert.equal(resolveSlideFrameName({ slots: { title: '在选区上直接交付' }, index: 0 }), '在选区上直接交付');
assert.equal(resolveSlideFrameName({ slots: { quote: '只改这一页' }, index: 3 }), '只改这一页');
assert.equal(resolveSlideFrameName({ slots: { kicker: '能力' }, index: 3 }), '幻灯片 4');
assert.equal(
  resolveReplaceFrameName({
    existing: '一次会话里的五件事',
    slots: { quote: 'replacePlate 只改这一页的孩子，不另开文件。' }
  }),
  'replacePlate 只改这一页的孩子，不另开文件。'
);
assert.equal(
  resolveReplaceFrameName({ existing: '一次会话里的五件事', slots: { kicker: '同一页，换版式' } }),
  '一次会话里的五件事'
);

const missing = tldrawLicenseStatus({});
assert.equal(missing.present, false);
assert.equal(missing.productionReady, false);
assert.equal(missing.source, 'missing');
assert.equal(missing.blocker, TLDRAW_LICENSE_MISSING_BLOCKER);
const present = tldrawLicenseStatus({ licenseKey: 'tldraw-test-key' });
assert.equal(present.present, true);
assert.equal(present.productionReady, true);
assert.equal(present.source, 'option');
assert.equal(present.blocker, null);

const created = createScene({ op: 'createScene', ...semanticDeckOutline() });
assert.equal(created.ok, true, created.error);
const frames = listEngineNodes(created.canvas)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));
assert.equal(frames.length, 7);
for (let i = 1; i < frames.length; i++) {
  assert.ok(frames[i].x > frames[i - 1].x + frames[i - 1].w, `${frames[i].nodeId} must sit after ${frames[i - 1].nodeId}`);
  assert.equal(frames[i].y, frames[0].y);
  assert.equal(frames[i].w, 1920);
  assert.equal(frames[i].h, 1080);
}
assert.equal(frames[0].x, SLIDE_STRIP_ORIGIN.x);
assert.equal(frames[3].text, '一次会话里的五件事');

const before4 = frames.find((f) => f.nodeId === 'shape:slide-4');
const replaced = applyEngineCommands(created.canvas, [
  {
    op: 'replacePlate',
    plateId: 'slide-4',
    layoutId: 'quote',
    themeId: SEMANTIC_THEME_ID,
    slots: slide4ReplaceSlots()
  }
]);
assert.equal(replaced.ok, true, replaced.error);
const after = listEngineNodes(replaced.doc);
const after4 = after.find((n) => n.nodeId === 'shape:slide-4');
assert.equal(after4.x, before4.x);
assert.equal(after4.y, before4.y);
assert.equal(after4.w, before4.w);
assert.equal(after4.h, before4.h);
assert.equal(after4.text, 'replacePlate 只改这一页的孩子，不另开文件。');
assert.notEqual(after4.text, '一次会话里的五件事');

const added = applyEngineCommands(replaced.doc, [{ op: 'insertPlate', afterId: 'slide-4', name: '插入页' }]);
assert.equal(added.ok, true, added.error);
const addFrames = listEngineNodes(added.doc)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => a.x - b.x);
assert.equal(addFrames.length, 8);
for (let i = 1; i < addFrames.length; i++) {
  assert.ok(addFrames[i].x >= addFrames[i - 1].x + addFrames[i - 1].w);
}
const newSlide = addFrames.find((f) => f.text === '插入页');
assert.ok(newSlide);
assert.ok(newSlide.x > after4.x);

const deletedLive = applyEngineCommands(added.doc, [{ op: 'deletePlate', nodeId: 'shape:slide-2' }]);
assert.equal(deletedLive.ok, true, deletedLive.error);
const delFrames = listEngineNodes(deletedLive.doc)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => a.x - b.x);
assert.equal(delFrames.length, 7);
assert.equal(
  delFrames.some((f) => f.nodeId === 'shape:slide-2'),
  false
);
for (let i = 1; i < delFrames.length; i++) {
  assert.ok(delFrames[i].x >= delFrames[i - 1].x + delFrames[i - 1].w);
}

const reordered = applyEngineCommands(deletedLive.doc, [
  { op: 'reorder', order: delFrames.map((f) => f.nodeId).reverse() }
]);
assert.equal(reordered.ok, true, reordered.error);
const orderFrames = listEngineNodes(reordered.doc)
  .filter((n) => n.type === 'frame')
  .sort((a, b) => a.x - b.x);
assert.equal(orderFrames[0].nodeId, delFrames[delFrames.length - 1].nodeId);
assert.ok(orderFrames[1].x > orderFrames[0].x);

console.log('test_slides_layout: ok');
