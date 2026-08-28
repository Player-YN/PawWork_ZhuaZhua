/**
 * Live Slides present motion: source contract + no store mutation.
 * Pixel/video proof lives in test_slides_present_live.mjs (Playwright).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const presentJs = fs.readFileSync(path.join(root, 'src/preview/slidesPresent.js'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
const exportJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/pawCanvasPptxExport.js'), 'utf8');

assert.match(presentJs, /createSlidesPresenter/);
assert.match(presentJs, /prefers-reduced-motion/);
assert.match(presentJs, /element\.animate|el\.animate/);
assert.match(presentJs, /revokeObjectURL/);
assert.match(presentJs, /stagger-fade|DEFAULT_STAGGER_MS/);
assert.doesNotMatch(presentJs, /updateShape\(/);
assert.doesNotMatch(presentJs, /putShape/);
assert.match(designJs, /createSlidesPresenter/);
assert.match(designJs, /slidesPresenter\.enter/);
assert.match(designJs, /slidesPresenter\.step/);
assert.match(designJs, /slidesPresenter\.exit/);
assert.match(designHtml, /id="presentFx"/);
assert.match(designHtml, /prefers-reduced-motion/);
assert.match(runtime, /duration: 160/);
assert.match(exportJs, /pptxAnimTiming/);
assert.doesNotMatch(exportJs, /objectEntrance:\s*false/);
const timingJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/pptxAnimTiming.js'), 'utf8');
assert.match(timingJs, /objectEntrance:\s*true/);
assert.match(timingJs, /filter="fade"/);

console.log('test_slides_present: ok');
