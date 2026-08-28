/**
 * Workspace raster preview — HANDOFF_DESIGN_CANVAS Done-if #1.
 * Raster artifacts route to artifactPreview.html and render as images (not
 * blank srcdoc); download is byte-true with the original name; save is
 * HTML-view only (never write reconstructed HTML back into pdf/png bytes).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  previewEntryForItem,
  previewViewForItem,
  isRasterOpenKind,
  RASTER_OPEN_KINDS
} from '../../src/agent/vnext/sessionWorkspace/openClassify.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x34]);
const zipBytes = new Uint8Array(34);
zipBytes.set([0x50, 0x4b, 0x03, 0x04]);

// Raster artifacts keep routing to the generic viewer — never design.html.
for (const [name, bytes] of [
  ['a.png', png],
  ['b.jpg', jpeg],
  ['c.gif', gif],
  ['d.webp', webp]
]) {
  assert.equal(previewEntryForItem({ name, bytes }).entry, 'artifactPreview.html', name);
}

assert.deepEqual([...RASTER_OPEN_KINDS].sort(), ['gif', 'jpeg', 'png', 'webp']);
assert.equal(isRasterOpenKind('png'), true);
assert.equal(isRasterOpenKind('svg'), false);
assert.equal(isRasterOpenKind('pdf'), false);

// Viewer plan: raster bytes render as image; no HTML write-back; byte-true download.
const pngPlan = previewViewForItem({ name: 'compose_cat.png', bytes: png });
assert.equal(pngPlan.view, 'image');
assert.equal(pngPlan.canSave, false);
assert.equal(pngPlan.mimeType, 'image/png');
assert.equal(pngPlan.downloadName, 'compose_cat.png');

// Name without extension gets the kind extension; existing names are kept as-is.
const jpegPlan = previewViewForItem({ name: '照片', bytes: jpeg });
assert.equal(jpegPlan.view, 'image');
assert.equal(jpegPlan.mimeType, 'image/jpeg');
assert.equal(jpegPlan.downloadName, '照片.jpg');
assert.equal(previewViewForItem({ name: 'x.gif', bytes: gif }).view, 'image');
assert.equal(previewViewForItem({ name: 'x.webp', bytes: webp }).mimeType, 'image/webp');

// Magic bytes win over a wrong name — still an image view.
const misnamed = previewViewForItem({ name: 'note.txt', bytes: png });
assert.equal(misnamed.view, 'image');
assert.equal(misnamed.mimeType, 'image/png');

// PDF stays display-only: reconstruction renders, but save is off and the
// download must be the original PDF bytes (never lastHtml into a .pdf artifact).
const pdfPlan = previewViewForItem({ name: '海报.pdf', bytes: pdf });
assert.equal(pdfPlan.view, 'pdf');
assert.equal(pdfPlan.canSave, false);
assert.equal(pdfPlan.mimeType, 'application/pdf');
assert.equal(pdfPlan.downloadName, '海报.pdf');

// HTML/text keeps the editable page path.
const htmlPlan = previewViewForItem({ name: 'report.html', text: '<html><body>hi</body></html>' });
assert.equal(htmlPlan.view, 'html');
assert.equal(htmlPlan.canSave, true);

// SVG is text — stays on the page path (srcdoc renders it), not the raster branch.
const svgPlan = previewViewForItem({
  name: 'logo.svg',
  text: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'
});
assert.equal(svgPlan.view, 'html');

// Opaque bytes (zip/pptx/binary) get a file card, never a blank HTML page.
const zipPlan = previewViewForItem({ name: 'pack.zip', bytes: zipBytes });
assert.equal(zipPlan.view, 'binary');
assert.equal(zipPlan.canSave, false);
assert.equal(zipPlan.downloadName, 'pack.zip');

// Viewer source keeps the image branch wired (no headless Chrome in gates).
const previewJs = fs.readFileSync(new URL('../../src/preview/artifactPreview.js', import.meta.url), 'utf8');
assert.match(previewJs, /previewViewForItem/);
assert.match(previewJs, /renderImage/);
assert.match(previewJs, /URL\.createObjectURL/);
assert.match(previewJs, /canSave/);
const previewHtml = fs.readFileSync(new URL('../../src/preview/artifactPreview.html', import.meta.url), 'utf8');
assert.match(previewHtml, /id="imageWrap"/);
assert.match(previewHtml, /id="image"/);
assert.match(previewHtml, /id="fileCard"/);
// hidden panes must not occupy layout: the #page id rule outranks UA [hidden]
assert.match(previewHtml, /#page\[hidden\]/);
// Still a viewer, not a layout editor.
assert.doesNotMatch(previewHtml, /id="layers"|id="inspector"|id="filmstrip"/);

console.log('test_artifact_preview_view: ok');
