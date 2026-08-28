/**
 * HANDOFF_DESIGN_CANVAS Q1/Q3 (user-decided 2026-08-27):
 * Q1 — paper is model judgment; host provides capability only. One default
 *      paper truth (engine == compile == createFrame), any size honored,
 *      frames[] pagination honored, overflow reported as a warning (never a
 *      silent squash, never host-side pagination).
 * Q3 — image prompts are stamped no-text unless allowText (compose-image);
 *      image-only panel compositions get an informational warning.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createScene,
  sceneCompositionWarnings,
  POSTER_SIZE,
  DECK_SIZE
} from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import {
  DESIGN_CANVAS_SIZE,
  SLIDES_CANVAS_SIZE,
  emptyPawCanvas
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { applyStoreCommands, defaultCanvasSize } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';
import { stampNoTextPrompt, NO_TEXT_PROMPT_CLAUSE, artifactImageName } from '../../src/agent/vnext/sessionWorkspace/imageGen.js';

// ── One paper truth (HANDOFF item 28) ───────────────────────────────────────
assert.deepEqual(POSTER_SIZE, DESIGN_CANVAS_SIZE);
assert.deepEqual(DECK_SIZE, SLIDES_CANVAS_SIZE);
assert.deepEqual(defaultCanvasSize('slides'), SLIDES_CANVAS_SIZE);
assert.deepEqual(defaultCanvasSize('design'), DESIGN_CANVAS_SIZE);

function firstFrameProps(doc) {
  const store = doc?.tldraw?.document?.store || {};
  for (const rec of Object.values(store)) {
    if (rec && rec.typeName === 'shape' && rec.type === 'frame') return rec.props;
  }
  return null;
}

const emptyDesign = firstFrameProps(emptyPawCanvas({ shell: 'design' }));
assert.equal(emptyDesign.w, DESIGN_CANVAS_SIZE.w);
assert.equal(emptyDesign.h, DESIGN_CANVAS_SIZE.h);
const emptySlides = firstFrameProps(emptyPawCanvas({ shell: 'slides' }));
assert.equal(emptySlides.w, SLIDES_CANVAS_SIZE.w);
assert.equal(emptySlides.h, SLIDES_CANVAS_SIZE.h);

// deck createFrame defaults match the same truth
const slidesStore = {};
applyStoreCommands(slidesStore, [{ op: 'createFrame', name: 'S2' }], { shell: 'slides' });
const slideFrame = Object.values(slidesStore).find((r) => r.type === 'frame');
assert.equal(slideFrame.props.w, SLIDES_CANVAS_SIZE.w);
assert.equal(slideFrame.props.h, SLIDES_CANVAS_SIZE.h);
const designStore = {};
applyStoreCommands(designStore, [{ op: 'createFrame', name: 'P2' }], { shell: 'design' });
const designFrame = Object.values(designStore).find((r) => r.type === 'frame');
assert.equal(designFrame.props.w, DESIGN_CANVAS_SIZE.w);
assert.equal(designFrame.props.h, DESIGN_CANVAS_SIZE.h);

// ── Q1 capability: model-chosen size and frames[] are honored ───────────────
const custom = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '长卷',
  size: { w: 600, h: 2400 },
  nodes: [
    { type: 'headline', text: '标题' },
    { type: 'text', text: '正文一' },
    { type: 'text', text: '正文二' }
  ]
});
assert.equal(custom.ok, true, custom.error);
assert.deepEqual(custom.size, { w: 600, h: 2400 });
assert.ok(custom.nodes.every((n) => n.box.x + n.box.w <= 600));

const paged = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '条漫',
  frames: [
    { name: '格1', size: { w: 800, h: 800 }, nodes: [{ type: 'image', src: 'https://x/1.png' }, { type: 'text', text: '我会看！' }] },
    { name: '格2', nodes: [{ type: 'image', src: 'https://x/2.png' }, { type: 'text', text: '我会画！' }] }
  ]
});
assert.equal(paged.ok, true, paged.error);
assert.equal(paged.frames.length, 2);
assert.deepEqual(paged.frames[0].size, { w: 800, h: 800 });
assert.deepEqual(paged.frames[1].size, POSTER_SIZE);
// panels with real text nodes → no textless warning
assert.ok(!(paged.warnings || []).some((w) => /text nodes/.test(w)), JSON.stringify(paged.warnings));

// ── Q1 information: overflow is reported, never silently hidden ─────────────
const cram = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '硬塞',
  size: { w: 720, h: 400 },
  nodes: Array.from({ length: 14 }, (_, i) => ({ type: 'text', text: `第 ${i + 1} 行内容，比较长的一句话来撑高度` }))
});
assert.equal(cram.ok, true);
assert.ok(Array.isArray(cram.warnings) && cram.warnings.some((w) => /overflowed/.test(w)), JSON.stringify(cram.warnings));

const fits = createScene({
  op: 'createScene',
  kind: 'poster',
  nodes: [
    { type: 'headline', text: '标题' },
    { type: 'text', text: '短' }
  ]
});
assert.equal(fits.ok, true);
assert.ok(!(fits.warnings || []).some((w) => /overflowed/.test(w)), JSON.stringify(fits.warnings));

// ── Q3 weak-C: image-only panels warn (informational, still ok:true) ────────
const bakedComic = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '烤字漫画',
  frames: [
    { name: '格1', nodes: [{ type: 'image', src: 'https://x/a.png' }] },
    { name: '格2', nodes: [{ type: 'image', src: 'https://x/b.png' }] }
  ]
});
assert.equal(bakedComic.ok, true);
assert.ok(
  (bakedComic.warnings || []).some((w) => /text nodes/.test(w)),
  JSON.stringify(bakedComic.warnings)
);

const emptyFrames = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '空格',
  frames: [{ name: '格1' }, { name: '格2' }]
});
assert.equal(emptyFrames.ok, false, JSON.stringify(emptyFrames));
assert.match(String(emptyFrames.error || ''), /no nodes/);

const halfEmpty = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '半空',
  frames: [
    { name: '格1', nodes: [{ type: 'image', src: 'https://x/a.png' }, { type: 'text', text: '有字' }] },
    { name: '格2', nodes: [] }
  ]
});
assert.equal(halfEmpty.ok, true, halfEmpty.error);
assert.ok(
  (halfEmpty.warnings || []).some((w) => /1 of 2 frames have no content/.test(w)),
  JSON.stringify(halfEmpty.warnings)
);

// user material is exempt: selection/raster sources never get the textless nag
assert.deepEqual(
  sceneCompositionWarnings({ source: 'selection', frames: [{ nodes: [{ type: 'image', src: 'x' }] }, { nodes: [{ type: 'image', src: 'y' }] }] }),
  []
);

// ── Q3=B: host stamps no-text; allowText is the explicit exemption ──────────
const stamped = stampNoTextPrompt('a cat looking at photos');
assert.ok(stamped.includes(NO_TEXT_PROMPT_CLAUSE));
assert.equal(stampNoTextPrompt('a cat', true), 'a cat');
const already = 'a cat, no text, clean background';
assert.equal(stampNoTextPrompt(already), already);
assert.equal(stampNoTextPrompt(''), '');

// acquire tool exposes allowText and passes it through to the host image path
const toolsJs = fs.readFileSync(new URL('../../src/agent/vnext/sessionWorkspace/tools.js', import.meta.url), 'utf8');
assert.match(toolsJs, /allowText/);
assert.match(toolsJs, /allowText: input\.allowText === true/);
// scene warnings reach the model through run op=html results
assert.match(toolsJs, /built\.warnings/);
assert.match(toolsJs, /filename: input\.filename/);
assert.equal(artifactImageName('paw-hello.png'), 'paw-hello.png');
assert.equal(artifactImageName('paw-hello'), 'paw-hello.png');
assert.match(artifactImageName(''), /^compose_/);
assert.equal(artifactImageName('', 'handsome portrait headshot'), '帅哥头像.png');
assert.equal(artifactImageName('', '把这个头像改成一个帅哥'), '帅哥头像.png');

const textDump = createScene({
  op: 'createScene',
  kind: 'poster',
  title: 'dump',
  nodes: [
    { type: 'text', text: '不用苦等' },
    { type: 'text', text: '双十一！' },
    { type: 'text', text: 'SALE' }
  ]
});
assert.equal(textDump.ok, true, textDump.error);
assert.ok(
  (textDump.warnings || []).some((w) => /text-only/.test(w)),
  String(textDump.warnings)
);

const graphic = createScene({
  op: 'createScene',
  kind: 'poster',
  title: '双十一',
  size: { w: 720, h: 1080 },
  nodes: [
    { id: 'bg', type: 'color-block', fill: '#ff4d8a', box: { x: 0, y: 0, w: 720, h: 1080 } },
    { id: 'slab', type: 'geo', geo: 'rectangle', fill: 'cyan', degrees: 8, box: { x: 80, y: 160, w: 520, h: 720 } },
    { id: 'sale', type: 'headline', text: 'SALE', color: 'yellow', box: { x: 140, y: 420, w: 400, h: 120 } }
  ]
});
assert.equal(graphic.ok, true, graphic.error);
assert.equal((graphic.warnings || []).some((w) => /text-only/.test(w)), false);
const store = graphic.canvas?.tldraw?.document?.store || {};
const geos = Object.values(store).filter((r) => r && r.type === 'geo');
const texts = Object.values(store).filter((r) => r && r.type === 'text');
assert.ok(geos.length >= 2, `geo=${geos.length}`);
assert.ok(texts.some((t) => /SALE/.test(JSON.stringify(t.props?.richText || ''))));
assert.ok(geos.some((g) => Number(g.rotation) !== 0));

console.log('test_scene_paper_notext: ok');
