import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import * as XLSX from 'xlsx';
import {
  classifyOpenArtifact,
  previewEntryForKind,
  previewEntryForItem,
  isUtf8OpenKind,
  looksLikeZipBytes,
  looksLikePdfBytes
} from '../../src/agent/vnext/sessionWorkspace/openClassify.js';
import { seedPlatesFromArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifactStage.js';
import { isSheetArtifact } from '../../src/preview/sheetCodec.js';
import { workbookFromXlsxBytes } from '../../src/preview/xlsxIngest.js';

function zipOf(files) {
  const out = {};
  for (const [k, v] of Object.entries(files)) out[k] = typeof v === 'string' ? strToU8(v) : v;
  return zipSync(out);
}

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x34]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const pkText = 'PK\u0003\u0004garbage';

const xlsxZip = zipOf({
  '[Content_Types].xml': '<Types/>',
  'xl/workbook.xml': '<workbook/>'
});
const docxZip = zipOf({
  '[Content_Types].xml': '<Types/>',
  'word/document.xml': '<w:document/>'
});
const pptxZip = zipOf({
  '[Content_Types].xml': '<Types/>',
  'ppt/presentation.xml': '<p:presentation/>'
});
const otherZip = zipOf({ 'readme.txt': 'hi' });

assert.equal(looksLikePdfBytes(pdf), true);
assert.equal(looksLikeZipBytes(xlsxZip), true);

assert.equal(classifyOpenArtifact({ name: '海报.pdf', bytes: pdf }).kind, 'pdf');
assert.equal(classifyOpenArtifact({ name: '海报.pdf', bytes: pdf }).canvas, 'html-plates');
assert.equal(previewEntryForKind('pdf'), 'artifactPreview.html');

assert.equal(classifyOpenArtifact({ name: 'a.html', bytes: xlsxZip }).kind, 'xlsx');
assert.equal(classifyOpenArtifact({ name: 'a.html', bytes: xlsxZip }).canvas, 'sheet');
assert.equal(previewEntryForKind('xlsx'), 'sheet.html');
assert.equal(isSheetArtifact({ name: 'a.html', bytes: xlsxZip }), true);

assert.equal(classifyOpenArtifact({ name: 'a.xlsx', bytes: pdf }).kind, 'pdf');
assert.equal(isSheetArtifact({ name: 'a.xlsx', bytes: pdf }), false);

assert.equal(classifyOpenArtifact({ name: 'note.txt', bytes: docxZip }).kind, 'docx');
assert.equal(previewEntryForKind('docx'), 'docs.html');

assert.equal(classifyOpenArtifact({ bytes: pptxZip }).kind, 'pptx');
assert.equal(classifyOpenArtifact({ bytes: pptxZip }).canvas, 'none');
assert.equal(classifyOpenArtifact({ bytes: otherZip }).kind, 'zip');
assert.equal(isUtf8OpenKind('zip'), false);
assert.equal(isUtf8OpenKind('pdf'), false);
assert.equal(isUtf8OpenKind('xlsx'), false);
assert.equal(isUtf8OpenKind('docx'), false);

assert.equal(classifyOpenArtifact({ bytes: png }).canvas, 'gallery');
assert.equal(classifyOpenArtifact({ bytes: jpeg, name: 'x.txt' }).kind, 'jpeg');

const svgXml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
const svgBytes = new TextEncoder().encode(svgXml);
assert.equal(classifyOpenArtifact({ name: 'ideashell_logo.svg', text: svgXml }).kind, 'svg');
assert.equal(classifyOpenArtifact({ name: 'ideashell_logo.svg', bytes: svgBytes }).kind, 'svg');
assert.equal(classifyOpenArtifact({ name: 'ideashell_logo.svg', bytes: svgBytes }).canvas, 'gallery');
assert.equal(classifyOpenArtifact({ text: svgXml }).kind, 'svg');
const seededSvg = seedPlatesFromArtifacts([
  { name: 'ideashell_logo.svg', bytes: svgBytes, mimeType: 'text/plain' }
]);
assert.equal(seededSvg.mode, 'gallery');
assert.match(seededSvg.plates[0].html, /data:image\/svg\+xml/);
assert.doesNotMatch(seededSvg.plates[0].html, /data:text\/plain/);

assert.equal(classifyOpenArtifact({ text: pkText, name: '_11.docx' }).kind, 'binary');
assert.equal(classifyOpenArtifact({ text: pkText }).reason, 'text-magic');
assert.equal(isUtf8OpenKind(classifyOpenArtifact({ text: pkText }).kind), false);

assert.equal(classifyOpenArtifact({ text: '%PDF-1.4\n%âãÏÓ' }).kind, 'pdf');

const wbJson = JSON.stringify({ id: 'w', name: 'W', sheetOrder: ['s1'], sheets: { s1: { id: 's1', name: 'S' } } });
assert.equal(classifyOpenArtifact({ text: wbJson, name: 'w.json' }).kind, 'json-workbook');
assert.equal(previewEntryForKind('json-workbook'), 'sheet.html');

const docJson = JSON.stringify({ id: 'd', body: { dataStream: '\r\n' } });
assert.equal(classifyOpenArtifact({ text: docJson }).kind, 'json-document');
assert.equal(previewEntryForKind('json-document'), 'docs.html');

const plates = '<html><body data-pawwork-preview="blocks"><section data-paw-block>x</section></body></html>';
assert.equal(classifyOpenArtifact({ text: plates, name: 'a.docx' }).kind, 'html-plates');
assert.equal(previewEntryForKind('html-plates'), 'artifactPreview.html');
assert.equal(previewEntryForKind('html'), 'artifactPreview.html');

const siteHtml = '<!DOCTYPE html><html data-paw-kind="site"><body><h1>Home</h1></body></html>';
assert.equal(classifyOpenArtifact({ text: siteHtml }).kind, 'html-site');
assert.equal(classifyOpenArtifact({ text: siteHtml }).canvas, 'web');
assert.equal(previewEntryForKind('html-site'), 'site.html');
assert.equal(previewEntryForItem({ text: siteHtml }).entry, 'site.html');
assert.equal(previewEntryForItem({ text: siteHtml }).kind, 'html-site');

const sidecar = `<html><script type="application/json" id="paw-document">${docJson}</script></html>`;
assert.equal(classifyOpenArtifact({ text: sidecar }).kind, 'html-document');
assert.equal(previewEntryForKind('html-document'), 'docs.html');

const seededZip = seedPlatesFromArtifacts([{ name: '_11.docx', bytes: docxZip, mimeType: 'application/zip' }]);
assert.equal(seededZip.plates.length, 1);
assert.doesNotMatch(seededZip.plates[0].html || '', /PK/);
assert.match(seededZip.plates[0].html || '', /pw-file-card|_11\.docx/);

const seededPdf = seedPlatesFromArtifacts([{ name: '海报.pdf', bytes: pdf, text: pkText }]);
assert.doesNotMatch(JSON.stringify(seededPdf.plates), /PK\\u0003/);
assert.doesNotMatch(seededPdf.plates[0].html || '', /%PDF/);

const wb0 = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['招聘总人数', 20]]);
XLSX.utils.book_append_sheet(wb0, ws, '内容页');
const xlsxBytes = new Uint8Array(XLSX.write(wb0, { type: 'array', bookType: 'xlsx' }));
assert.equal(classifyOpenArtifact({ name: 't.html', bytes: xlsxBytes }).kind, 'xlsx');
const data = workbookFromXlsxBytes(XLSX, xlsxBytes, { id: 'stub' });
assert.equal(data.sheets['sheet-0'].cellData[0][0].v, '招聘总人数');

const liveXlsx = 'C:/Users/yyy/Desktop/公司招聘计划统计表1.xlsx';
if (fs.existsSync(liveXlsx)) {
  const live = fs.readFileSync(liveXlsx);
  assert.equal(classifyOpenArtifact({ name: 'stat.html', bytes: live }).kind, 'xlsx');
}

const livePdf = 'C:/Users/yyy/Desktop/海报.pdf';
if (fs.existsSync(livePdf)) {
  const live = fs.readFileSync(livePdf);
  assert.equal(classifyOpenArtifact({ name: '海报.docx', bytes: live }).kind, 'pdf');
}

const previewJs = fs.readFileSync(new URL('../../src/preview/artifactPreview.js', import.meta.url), 'utf8');
const docsJs = fs.readFileSync(new URL('../../src/preview/docs.js', import.meta.url), 'utf8');
const sheetJs = fs.readFileSync(new URL('../../src/preview/sheet.js', import.meta.url), 'utf8');
assert.match(previewJs, /classifyOpenArtifact/);
assert.match(docsJs, /classifyOpenArtifact/);
assert.match(sheetJs, /classifyOpenArtifact/);
assert.doesNotMatch(docsJs, /parseLoadedDoc\(text \|\| bytesToUtf8\(bytes\)\)/);

console.log('test_open_classify: ok');
