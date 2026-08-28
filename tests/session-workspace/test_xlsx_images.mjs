import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import * as XLSX from 'xlsx';
import { injectXlsxImages, extractXlsxImages, stripImageMarkers, isImageMarkerCell, applyImageUrlsToRows } from '../../src/preview/xlsxImages.js';
import { encodeUtf8Csv, aoaToCsv } from '../../src/preview/sheetCodec.js';

const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

assert.equal(isImageMarkerCell('🖼'), true);
assert.equal(isImageMarkerCell('[image:wi_1]'), true);
assert.equal(isImageMarkerCell('hello'), false);
assert.deepEqual(stripImageMarkers([['a', '🖼']], [{ row: 0, col: 1 }]), [['a', '']]);

const bom = encodeUtf8Csv(aoaToCsv([['商品', '数量'], ['咖啡', 2]]));
assert.equal(bom[0], 0xef);
assert.equal(bom[1], 0xbb);
assert.equal(bom[2], 0xbf);
assert.ok(Buffer.from(bom.subarray(3)).toString('utf8').includes('咖啡'));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['sku', 'pic'], ['A', '🖼']]), 'Sheet1');
const raw = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
const withPic = injectXlsxImages(raw, [
  { sheet: 'Sheet1', row: 1, col: 1, bytes: PNG, mime: 'image/png' }
]);
assert.equal(withPic[0], 0x50);
assert.equal(withPic[1], 0x4b);
const files = unzipSync(withPic);
const names = Object.keys(files);
assert.ok(names.some((n) => n.startsWith('xl/media/image')), names.join(','));
assert.ok(names.some((n) => n.includes('drawings/drawing')), names.join(','));
const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml'] || new Uint8Array());
assert.match(sheetXml, /<drawing\b/);
const drawXml = strFromU8(
  files[Object.keys(files).find((n) => /xl\/drawings\/drawing\d+\.xml$/.test(n)) || ''] || new Uint8Array()
);
assert.match(drawXml, /twoCellAnchor/);
assert.match(drawXml, /editAs="twoCell"/);
assert.doesNotMatch(drawXml, /oneCellAnchor/);
const ct = strFromU8(files['[Content_Types].xml'] || new Uint8Array());
assert.match(ct, /drawing\+xml/);
assert.deepEqual(
  applyImageUrlsToRows([['a', '🖼']], [{ row: 0, col: 1, src: 'https://cdn.example/p.png' }]),
  [['a', 'https://cdn.example/p.png']]
);

const round = extractXlsxImages(withPic);
assert.equal(round.length, 1);
assert.equal(round[0].row, 1);
assert.equal(round[0].col, 1);
assert.ok(round[0].bytes.length > 20);

console.log('test_xlsx_images: ok');
