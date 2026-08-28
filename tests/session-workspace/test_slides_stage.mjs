import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBlankSlideSpec,
  placeBlankSlide,
  slideCameraOptions,
  isRasterArtifact,
  SLIDE_GAP,
  SLIDE_CAMERA_PADDING
} from '../../src/agent/vnext/sessionWorkspace/slidesStage.js';
import { SLIDES_CANVAS_SIZE } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
const helpJs = fs.readFileSync(path.join(root, 'src/preview/officeHelp.js'), 'utf8');

assert.equal(SLIDES_CANVAS_SIZE.w, 1920);
assert.equal(SLIDES_CANVAS_SIZE.h, 1080);

const empty = createBlankSlideSpec([], -1);
assert.equal(empty.w, SLIDES_CANVAS_SIZE.w);
assert.equal(empty.h, SLIDES_CANVAS_SIZE.h);
assert.equal(empty.x, 80);
assert.equal(empty.y, 80);
assert.match(empty.name, /幻灯片 1/);
assert.ok(SLIDE_GAP >= 160 && SLIDE_GAP <= 240);

const first = { id: 'a', x: 80, y: 80, w: 1920, h: 1080 };
const second = { id: 'b', x: 80 + 1920 + SLIDE_GAP, y: 80, w: 1920, h: 1080 };
const mid = placeBlankSlide([first, second], 0);
assert.equal(mid.spec.x, 80 + 1920 + SLIDE_GAP);
assert.equal(mid.spec.shift, 1920 + SLIDE_GAP);
assert.equal(mid.next[0].x, 80);
assert.equal(mid.next[0].id, 'a');
assert.equal(mid.next[2].id, 'b');
assert.equal(mid.next[2].x, 80 + 2 * (1920 + SLIDE_GAP));

const afterLast = placeBlankSlide([first, second], 1);
assert.equal(afterLast.spec.x, second.x + 1920 + SLIDE_GAP);
assert.equal(afterLast.next[1].x, second.x);

const pageCam = slideCameraOptions({ x: 80, y: 80, w: 1920, h: 1080 }, 'page');
assert.equal(pageCam.constraints.behavior, 'contain');
assert.equal(pageCam.constraints.initialZoom, 'fit-max');
assert.equal(pageCam.constraints.baseZoom, 'fit-max');
assert.equal(pageCam.constraints.bounds.w, 1920);
assert.equal(pageCam.constraints.padding.x, SLIDE_CAMERA_PADDING);

const overviewCam = slideCameraOptions({ x: 0, y: 0, w: 1920, h: 1080 }, 'overview');
assert.equal(overviewCam.constraints, undefined);

assert.equal(isRasterArtifact({ mimeType: 'image/png', name: 'a.png' }), true);
assert.equal(isRasterArtifact({ mimeType: 'application/json', name: 'board.json' }), false);

assert.doesNotMatch(designHtml, /fig-page-row/);
assert.doesNotMatch(designHtml, />Page 1</);
assert.match(designHtml, /id="layerList"/);
assert.match(designHtml, /id="insertBtn"/);
assert.match(designHtml, /id="toolStrip"/);
assert.match(designJs, /renderToolStrip/);
assert.match(designJs, /handleWorkTabPickerMessage/);
assert.match(designHtml, /data-present/);
assert.match(designJs, /createBlankSlide/);
assert.match(designJs, /pinSlide/);
assert.match(designJs, /setSlideView/);
assert.match(designJs, /reorderSlides/);
assert.match(designJs, /isFilmstripReorderKey/);
assert.match(designJs, /aria-live/);
assert.doesNotMatch(designJs, /draggable\s*=\s*true/);
assert.match(runtimeEntry, /reorderSlides/);
assert.match(designJs, /insertWorkspaceImage/);
assert.match(designJs, /setPresent/);
assert.match(designJs, /createSlidesPresenter/);
assert.match(runtimeEntry, /slideCameraOptions/);
assert.match(runtimeEntry, /placeBlankSlide/);
assert.doesNotMatch(runtimeEntry, /maxPages:\s*1/);
assert.doesNotMatch(runtimeEntry, /PageMenu:\s*null/);
assert.doesNotMatch(runtimeEntry, /NavigationPanel:\s*null/);
assert.doesNotMatch(runtimeEntry, /Minimap:\s*null/);
assert.doesNotMatch(runtimeEntry, /VideoToolbar:\s*null/);
assert.match(designJs, /textContent = '放映'/);
assert.match(designJs, /isPresent:\s*\(\)\s*=>\s*isPresent\(\)/);
assert.doesNotMatch(helpJs, /新建页 — 稍后/);
assert.match(helpJs, /F5/);
assert.match(helpJs, /未放映时方向键微移形状|arrows nudge shapes/);

console.log('test_slides_stage: ok');
