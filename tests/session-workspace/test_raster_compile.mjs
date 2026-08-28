import assert from 'node:assert/strict';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import {
  applyRasterCrops,
  imageSizeFromDataUrl,
  isRasterCompileInput,
  rasterItemRef,
  tldrawCropFromBox
} from '../../src/agent/vnext/sessionWorkspace/rasterCompile.js';
import {
  encodePngRgba,
  mergeRasterScanNodes,
  scanRasterPixels,
  shouldAutoScan
} from '../../src/agent/vnext/sessionWorkspace/rasterScan.js';
import { listEngineNodes, recordsFromPawCanvas } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import {
  listSkillCatalog,
  loadSkillInstructions
} from '../../src/agent/vnext/skills/registry.js';
import { buildSessionAgentInstructions } from '../../src/agent/vnext/sessionWorkspace/prompt.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PIX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const cat = listSkillCatalog();
assert.ok(cat.some((s) => s.id === 'visual-compile'), 'visual-compile is a skill, not a kernel tool');
const playbook = loadSkillInstructions('visual-compile');
assert.match(playbook, /fromRaster/);
assert.match(playbook, /Do \*\*not\*\* `fromRaster`/);
assert.match(playbook, /inspect view=item/);
assert.match(playbook, /scan:\s*"auto"/);
assert.doesNotMatch(playbook, /name: 'decompose'|tool decompose/i);
const posterPlay = loadSkillInstructions('poster');
assert.match(posterPlay, /visual-compile/);
assert.match(posterPlay, /plate/);
assert.match(posterPlay, /reference/);
assert.match(posterPlay, /themeId/);
assert.match(posterPlay, /layoutId/);
assert.match(posterPlay, /poster-hero/);
assert.match(posterPlay, /CANVAS_QA_FAILED/);
assert.doesNotMatch(posterPlay, /Four rounds|four rounds/);
assert.match(posterPlay, /next.*canvas write must attach the returned `path`/i);
const remakePlay = loadSkillInstructions('remake-poster');
assert.match(remakePlay, /scan:\s*"auto"/);
assert.match(remakePlay, /copy \/ text/);

const sysEmpty = buildSessionAgentInstructions({});
assert.doesNotMatch(sysEmpty, /fromRaster/);
assert.doesNotMatch(sysEmpty, /visual-compile then fromRaster/);
assert.doesNotMatch(sysEmpty, /act=snapshot/);
const sysSheet = buildSessionAgentInstructions({});
assert.equal(sysEmpty, sysSheet);
const toolsJs = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/agent/vnext/sessionWorkspace/tools.js'),
  'utf8'
);
assert.match(toolsJs, /fromPage, fromSelection, fromRaster/);
assert.doesNotMatch(toolsJs, /bulk rows use sheet act=snapshot/);

assert.equal(isRasterCompileInput({ op: 'fromRaster', item: 'screenshot1' }), true);
assert.equal(isRasterCompileInput({ op: 'fromPage', html: '<p>x</p>' }), false);
assert.equal(rasterItemRef({ op: 'fromRaster', path: '/artifacts/compose_a/compose_a.png' }), '/artifacts/compose_a/compose_a.png');
assert.equal(rasterItemRef({ op: 'fromRaster', src: '/artifacts/plate.png' }), '/artifacts/plate.png');
assert.equal(rasterItemRef({ op: 'fromRaster', item: '图片1' }), '图片1');

const empty = createScene({ op: 'fromRaster', item: 'screenshot1', kind: 'poster' });
assert.equal(empty.ok, false);
assert.match(String(empty.error || ''), /regions|nodes/i);

const missingItem = createScene({
  op: 'fromRaster',
  kind: 'poster',
  nodes: [{ id: 't', type: 'text', text: 'Hi', box: { x: 0, y: 0, w: 10, h: 10 } }]
});
assert.equal(missingItem.ok, false);

const built = createScene({
  op: 'fromRaster',
  kind: 'poster',
  item: 'screenshot1',
  title: '还原',
  size: { w: 100, h: 80 },
  nodes: [
    { id: 'headline', type: 'headline', text: '闪念', box: { x: 4, y: 4, w: 90, h: 16 } },
    { id: 'hero', type: 'image', box: { x: 10, y: 30, w: 40, h: 40 } }
  ]
});
assert.equal(built.ok, true, built.error);
assert.equal(built.source, 'raster');
const hero = (built.nodes || []).find((n) => n.id === 'hero' || n.type === 'image');
assert.ok(hero, 'image region exists');
assert.equal(hero.src, 'screenshot1');
assert.ok(hero.sourceBox, 'host marks source crop box');
assert.ok((built.nodes || []).some((n) => n.type === 'headline' || /闪念/.test(n.text)));
assert.ok(listEngineNodes(built.canvas).some((n) => n.type === 'text'));
assert.ok(listEngineNodes(built.canvas).some((n) => n.type === 'image'));

const size = imageSizeFromDataUrl(PIX);
assert.equal(size?.w, 1);
assert.equal(size?.h, 1);
assert.equal(tldrawCropFromBox({ x: 0, y: 0, w: 1, h: 1 }, size), null);

const cropped = await applyRasterCrops(
  [
    {
      id: 'hero',
      type: 'image',
      src: PIX,
      box: { x: 0, y: 0, w: 1, h: 1 },
      sourceBox: { x: 0, y: 0, w: 0.4, h: 0.5 }
    }
  ],
  { raster: true }
);
assert.equal(cropped.length, 1);
assert.ok(cropped[0].tldrawCrop || cropped[0].rasterCropped, 'crop applied or queued as tldraw crop');
if (cropped[0].tldrawCrop) {
  assert.ok(cropped[0].tldrawCrop.topLeft);
  assert.ok(cropped[0].tldrawCrop.bottomRight);
}

const withPix = createScene({
  op: 'fromRaster',
  kind: 'poster',
  item: PIX,
  size: { w: 1, h: 1 },
  nodes: [
    { id: 't', type: 'text', text: 'A', box: { x: 0, y: 0, w: 1, h: 1 } },
    {
      id: 'im',
      type: 'image',
      src: PIX,
      box: { x: 0, y: 0, w: 1, h: 1 },
      tldrawCrop: { topLeft: { x: 0.1, y: 0.1 }, bottomRight: { x: 0.9, y: 0.9 } }
    }
  ]
});
const recs = recordsFromPawCanvas(withPix.canvas);
const imgShape = recs.shapes.find((s) => s.type === 'image');
assert.ok(imgShape?.props?.crop?.topLeft, 'compiled image keeps crop on the engine shape');

assert.equal(shouldAutoScan({ op: 'fromRaster', item: 'screenshot1' }), true);
assert.equal(shouldAutoScan({ op: 'fromRaster', item: 'screenshot1', scan: false }), false);
assert.equal(shouldAutoScan({ op: 'fromRaster', item: 'screenshot1', scan: 'auto' }), true);
assert.equal(
  shouldAutoScan({
    op: 'fromRaster',
    item: 'screenshot1',
    nodes: [{ type: 'text', text: 'Hi', box: { x: 0, y: 0, w: 10, h: 10 } }]
  }),
  false
);

const noScanOff = createScene({
  op: 'fromRaster',
  item: PIX,
  kind: 'poster',
  scan: false
});
assert.equal(noScanOff.ok, false);
assert.match(String(noScanOff.error || ''), /regions|nodes/i);

function rgba(w, h, paint) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width: w, height: h, data };
}

const colorBlockPx = rgba(32, 24, () => [225, 29, 72]);
const colorBlockPng = encodePngRgba(colorBlockPx);
const scannedBlocks = scanRasterPixels(colorBlockPx, { item: colorBlockPng });
assert.ok(
  scannedBlocks.regions.some((n) => n.type === 'color-block'),
  'color-block fixture yields ≥1 color-block'
);

const fromColor = createScene({
  op: 'fromRaster',
  kind: 'poster',
  item: colorBlockPng,
  scan: 'auto'
});
assert.equal(fromColor.ok, true, fromColor.error);
assert.ok(
  (fromColor.nodes || []).some((n) => n.type === 'color-block'),
  'fromRaster scan:auto compiles a color-block'
);

const noisyPx = rgba(16, 16, (x, y) => [
  x % 2 === 0 ? 0 : 255,
  y % 2 === 0 ? 0 : 255,
  (x + y) % 2 === 0 ? 0 : 255
]);
const noisyPng = encodePngRgba(noisyPx);
const scannedNoise = scanRasterPixels(noisyPx, { item: noisyPng });
const noiseImage = scannedNoise.regions.find((n) => n.type === 'image');
assert.ok(noiseImage?.sourceBox, 'high-variance region yields image box');
assert.ok(noiseImage.sourceBox.w >= 8 && noiseImage.sourceBox.h >= 8);

const fromNoise = createScene({
  op: 'fromRaster',
  kind: 'poster',
  item: noisyPng,
  scan: 'auto',
  nodes: [{ id: 'headline', type: 'headline', text: '闪念', box: { x: 1, y: 1, w: 14, h: 4 } }]
});
assert.equal(fromNoise.ok, true, fromNoise.error);
assert.ok((fromNoise.nodes || []).some((n) => n.type === 'image' && n.sourceBox));
assert.ok((fromNoise.nodes || []).some((n) => n.type === 'headline' && /闪念/.test(n.text)));

const merged = mergeRasterScanNodes(
  [
    { type: 'color-block', fill: '#111', box: { x: 0, y: 0, w: 10, h: 10 } },
    { type: 'text', text: 'scanned-should-lose', box: { x: 0, y: 0, w: 10, h: 4 } }
  ],
  [{ type: 'headline', text: 'inspect wins', box: { x: 0, y: 0, w: 10, h: 4 } }]
);
assert.ok(merged.some((n) => n.type === 'color-block'));
assert.ok(merged.some((n) => n.type === 'headline' && n.text === 'inspect wins'));
assert.equal(
  merged.some((n) => n.text === 'scanned-should-lose'),
  false,
  'inspect copy wins for text'
);

console.log('test_raster_compile: ok');
