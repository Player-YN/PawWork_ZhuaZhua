/**
 * Host xlsx export from IWorkbookData: formulas, merge, freeze, IMAGE vs drawing, sidecar.
 */
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import * as XLSX from 'xlsx';
import { sheetsToWorkbookData } from '../../src/preview/sheetCodec.js';
import { extractWorkbookSnapshot, injectWorkbookSnapshot } from '../../src/preview/sheetModel.js';
import {
  classifyExportImages,
  excelImageFormula,
  isHttpImageUrl,
  univerCellToXlsxCell,
  writeWorkbookXlsxBytes
} from '../../src/preview/sheetExport.js';

const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

function sheetXml(bytes, file = 'xl/worksheets/sheet1.xml') {
  const files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return strFromU8(files[file] || new Uint8Array());
}

function run() {
  assert.equal(isHttpImageUrl('https://cdn.example/p.png'), true);
  assert.equal(isHttpImageUrl('http://cdn.example/p.png'), true);
  assert.equal(isHttpImageUrl('data:image/png;base64,QQ=='), false);
  assert.equal(excelImageFormula('data:image/png;base64,QQ=='), null);
  assert.equal(excelImageFormula('https://cdn.example/a.png'), 'IMAGE("https://cdn.example/a.png")');
  assert.equal(excelImageFormula('https://x.com/a"b.png'), 'IMAGE("https://x.com/a""b.png")');

  const formulaCell = univerCellToXlsxCell({ f: '=A1+B1', v: 3, t: 2 });
  assert.equal(formulaCell.f, 'A1+B1');
  assert.equal(formulaCell.v, 3);
  assert.equal(formulaCell.t, 'n');
  const fmtCell = univerCellToXlsxCell({ v: 1.5, s: { n: { pattern: '0.00' } } });
  assert.equal(fmtCell.z, '0.00');
  assert.equal(univerCellToXlsxCell({ v: '🖼' }), null);

  const data = sheetsToWorkbookData(
    [
      {
        name: 'Logic',
        rows: [
          ['n', 'qty', 'total'],
          [2, 3, '=A2+B2']
        ]
      }
    ],
    'Book',
    { id: 'export-1' }
  );
  const sh = data.sheets['sheet-0'];
  sh.mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 }];
  sh.freeze = { ySplit: 1, xSplit: 0, startRow: 1, startColumn: 0 };
  sh.dataValidation = [
    { ranges: [{ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }], type: 'decimal', formula1: '0' }
  ];
  sh.conditionalFormatting = [{ ranges: 'A2:C2', rule: { type: 'colorScale' } }];
  sh.cellData[1][1].s = { n: { pattern: '0.00' } };
  sh.columnData = { 0: { w: 120 }, 1: { w: 80 } };
  sh.rowData = { 0: { h: 24 } };

  const packed = injectWorkbookSnapshot(
    writeWorkbookXlsxBytes(
      data,
      [
        { sheet: 'Logic', row: 1, col: 3, src: 'https://cdn.example/cover.png' },
        { sheet: 'Logic', row: 2, col: 0, src: 'data:image/png;base64,QQ==', bytes: PNG, mime: 'image/png' }
      ],
      XLSX
    ),
    data
  );
  assert.equal(packed[0], 0x50);
  assert.equal(packed[1], 0x4b);

  const wb = XLSX.read(packed, { type: 'array', cellFormula: true, cellNF: true, sheetStubs: true });
  const ws = wb.Sheets.Logic;
  assert.ok(ws);
  assert.equal(ws.C2.f, 'A2+B2');
  assert.equal(ws.D2.f, 'IMAGE("https://cdn.example/cover.png")');
  assert.equal(ws.A2.v, 2);
  assert.ok(Array.isArray(ws['!merges']) && ws['!merges'].length >= 1);
  assert.equal(ws['!merges'][0].s.r, 0);
  assert.equal(ws['!merges'][0].e.c, 2);
  assert.equal(ws.B2.z, '0.00');

  const xml = sheetXml(packed);
  assert.match(xml, /<mergeCell\b/);
  assert.match(xml, /state="frozen"/);
  assert.match(xml, /ySplit="1"/);
  assert.match(xml, /IMAGE\((?:&quot;|")https:\/\/cdn\.example\/cover\.png(?:&quot;|")\)/);

  const files = unzipSync(packed);
  const names = Object.keys(files);
  assert.ok(names.some((n) => n.startsWith('xl/media/image')), names.join(','));
  const drawName = names.find((n) => /xl\/drawings\/drawing\d+\.xml$/.test(n));
  assert.ok(drawName);
  const drawXml = strFromU8(files[drawName]);
  assert.match(drawXml, /twoCellAnchor/);
  assert.match(drawXml, /<xdr:row>2<\/xdr:row>/);
  assert.doesNotMatch(drawXml, /<xdr:row>1<\/xdr:row>/);

  const snap = extractWorkbookSnapshot(packed);
  assert.ok(snap);
  assert.deepEqual(snap.sheets['sheet-0'].mergeData, sh.mergeData);
  assert.equal(snap.sheets['sheet-0'].freeze.ySplit, 1);
  assert.equal(snap.sheets['sheet-0'].dataValidation[0].type, 'decimal');
  assert.equal(snap.sheets['sheet-0'].conditionalFormatting[0].rule.type, 'colorScale');
  assert.equal(snap.sheets['sheet-0'].cellData[1][2].f, '=A2+B2');

  const classified = classifyExportImages(
    [{ sheet: 'Logic', row: 1, col: 2, src: 'https://cdn.example/x.png', bytes: PNG }],
    () => ({ f: 'A1+B1' })
  );
  assert.equal(classified.formulas.length, 0);
  assert.equal(classified.drawings.length, 1);

  const keepImage = classifyExportImages(
    [{ sheet: 'Logic', row: 0, col: 0, src: 'https://cdn.example/x.png' }],
    () => null
  );
  assert.equal(keepImage.formulas[0].f, 'IMAGE("https://cdn.example/x.png")');
  assert.equal(keepImage.drawings.length, 0);

  console.log('test_sheet_export: ok');
}

run();
