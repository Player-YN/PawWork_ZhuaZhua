import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCanvasWheel,
  zoomAtPoint,
  fitFramesInViewport,
  pasteboardCssTransform,
  clampZoom
} from '../../src/agent/vnext/sessionWorkspace/frameLayout.js';
import {
  createScene,
  unwrapSceneCreateInput,
  isSceneCreateCommand
} from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const previewHtml = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
const previewJs = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');
const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');

assert.equal(clampZoom(1), 1);
assert.equal(clampZoom(0), 1);
assert.ok(clampZoom(99) <= 8);

const pan0 = { pan: { x: 10, y: 20 }, zoom: 1 };
const wheeled = applyCanvasWheel(pan0, { deltaX: 5, deltaY: 8, ctrlKey: false, metaKey: false, clientX: 100, clientY: 80 }, {
  left: 0,
  top: 0,
  w: 800,
  h: 600
});
assert.equal(wheeled.zoom, 1);
assert.equal(wheeled.pan.x, 5);
assert.equal(wheeled.pan.y, 12);

const zoomed = applyCanvasWheel(pan0, { deltaX: 0, deltaY: 1, ctrlKey: true, metaKey: false, clientX: 100, clientY: 80 }, {
  left: 0,
  top: 0,
  w: 800,
  h: 600
});
assert.ok(zoomed.zoom < pan0.zoom);
const at = zoomAtPoint(pan0, { left: 0, top: 0 }, { x: 100, y: 80 }, 2);
assert.equal(at.zoom, 2);
assert.equal(Math.round(at.pan.x), 10 - 90);
assert.equal(Math.round(at.pan.y), 20 - 60);

const fit = fitFramesInViewport(
  [{ frameBox: { x: 0, y: 0, w: 720, h: 1080 } }],
  { w: 1200, h: 800 }
);
assert.ok(fit.zoom < 1, 'fit a tall poster into a shorter viewport');
assert.match(pasteboardCssTransform({ x: 3, y: 4 }, 1.5), /translate\(3px, 4px\) scale\(1\.5\)/);

assert.doesNotMatch(previewHtml, /class="artboard-tools/);
assert.doesNotMatch(previewHtml, /data-act="tool-hand"/);
assert.match(previewHtml, /id="page"/);
assert.doesNotMatch(previewJs, /applyCanvasWheel/);
assert.doesNotMatch(previewJs, /setCanvasTool\('hand'\)/);
assert.match(designHtml, /id="engine"/);
assert.match(designJs, /Paw Work Design/);
assert.match(designJs, /Paw Work Slides/);

const empty = createScene({ op: 'createScene', kind: 'poster' });
assert.equal(empty.ok, false);
assert.match(String(empty.error), /html, fragments, or nodes/);

assert.equal(isSceneCreateCommand({ createScene: { nodes: [{ id: 'a', type: 'text', text: 'Hi' }] } }), true);
const nested = unwrapSceneCreateInput({
  createScene: {
    name: 'Paw Work 功能介绍',
    nodes: [
      { id: 'headline', type: 'headline', text: '选中即办' },
      { id: 'hero', type: 'image', src: 'https://example.com/a.png', alt: 'a' },
      { id: 'body', type: 'text', text: '说明' }
    ]
  }
});
assert.equal(nested.op, 'createScene');
const built = createScene(nested);
assert.equal(built.ok, true, built.error);
assert.ok((built.nodes || []).length >= 3);
assert.match(built.html, /选中即办/);

console.log('test_canvas_viewport: ok');
