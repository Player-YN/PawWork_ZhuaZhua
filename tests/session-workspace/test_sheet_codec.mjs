/**
 * Live sheet codec + binary artifact update (csv/xlsx).
 */
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/store.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import {
  createArtifact,
  updateArtifactContent,
  bytesFromBase64
} from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import {
  aoaToCsv,
  isSheetArtifact,
  parseDelimited,
  sheetKindFromArtifact,
  sheetsToWorkbookData,
  workbookDataToSheets,
  EXCEL_MAX_ROWS,
  EXCEL_MAX_COLS,
  GRID_MIN_ROWS,
  GRID_MIN_COLS,
  gridExtentFromUsed,
  growGridExtent
} from '../../src/preview/sheetCodec.js';
import {
  extractWorkbookSnapshot,
  injectWorkbookSnapshot,
  inspectWorkbookRange,
  patchWorkbookFromSheets
} from '../../src/preview/sheetModel.js';

function makeXlsxBytes(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function run() {
  assert.equal(isSheetArtifact({ name: 'a.csv' }), true);
  assert.equal(isSheetArtifact({ name: 'a.xlsx' }), true);
  assert.equal(isSheetArtifact({ name: 'a.html' }), false);
  assert.equal(sheetKindFromArtifact({ name: 'x.tsv' }), 'tsv');

  const csv = 'name,qty\nA,2\nB,=A2+1';
  const rows = parseDelimited(csv, 'csv');
  assert.equal(rows[0][0], 'name');
  assert.equal(rows[2][1], '=A2+1');
  const round = parseDelimited(aoaToCsv(rows), 'csv');
  assert.deepEqual(round, rows);

  const data = sheetsToWorkbookData([{ name: 'S1', rows }]);
  const back = workbookDataToSheets(data);
  const emptyExt = gridExtentFromUsed(0, 0);
  assert.equal(emptyExt.rowCount, GRID_MIN_ROWS);
  assert.equal(emptyExt.columnCount, GRID_MIN_COLS);
  assert.ok(emptyExt.rowCount < EXCEL_MAX_ROWS);
  assert.ok(emptyExt.columnCount < EXCEL_MAX_COLS);
  const grown = growGridExtent(emptyExt, { endRow: emptyExt.rowCount - 1, endCol: emptyExt.columnCount - 1 });
  assert.ok(grown.rowCount > emptyExt.rowCount);
  assert.ok(grown.columnCount > emptyExt.columnCount);
  const capped = growGridExtent({ rowCount: EXCEL_MAX_ROWS, columnCount: EXCEL_MAX_COLS }, {
    endRow: EXCEL_MAX_ROWS - 1,
    endCol: EXCEL_MAX_COLS - 1
  });
  assert.equal(capped.rowCount, EXCEL_MAX_ROWS);
  assert.equal(capped.columnCount, EXCEL_MAX_COLS);
  assert.equal(data.sheets['sheet-0'].rowCount, gridExtentFromUsed(rows.length, rows[0].length).rowCount);
  assert.equal(data.sheets['sheet-0'].columnCount, gridExtentFromUsed(rows.length, rows[0].length).columnCount);
  assert.equal(back[0].name, 'S1');
  assert.equal(back[0].rows[2][1], '=A2+1');
  assert.equal(typeof data.sheets['sheet-0'].cellData[1][1].v, 'number');
  assert.notEqual(data.id, 'paw-workbook');
  const again = sheetsToWorkbookData([{ name: 'S1', rows }]);
  assert.notEqual(data.id, again.id);
  assert.equal(sheetsToWorkbookData([{ name: 'S1', rows }], 'Book', { id: 'keep-me' }).id, 'keep-me');

  const store = new SessionWorkspaceStore();
  const sessionId = 's-sheet';
  store.put('sessions', sessionId, { sessionId, createdAt: Date.now() });
  const fs = createSessionGuestFs(store, { sessionId, executionId: null });
  const rec = createArtifact(store, fs, {
    sessionId,
    name: 'grid.xlsx',
    content: makeXlsxBytes([
      ['sku', 'price'],
      ['A', 9]
    ]),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const nextBytes = makeXlsxBytes([
    ['sku', 'price'],
    ['A', 11]
  ]);
  const b64 = Buffer.from(nextBytes).toString('base64');
  const updated = updateArtifactContent(store, fs, sessionId, rec.artifactId, bytesFromBase64(b64), {
    mimeType: rec.mimeType
  });
  assert.equal(updated.size, nextBytes.byteLength);
  const read = fs.readFileBytes(updated.primaryPath);
  assert.equal(read[0], 0x50);
  assert.equal(read[1], 0x4b);

  const rich = sheetsToWorkbookData(
    [{ name: 'S', rows: [['h1', 'h2'], ['=A1', 2]] }],
    'Book',
    { id: 'rich-1' }
  );
  rich.sheets['sheet-0'].mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 }];
  rich.sheets['sheet-0'].freeze = { ySplit: 1, xSplit: 0, startRow: 1, startColumn: 0 };
  rich.sheets['sheet-0'].dataValidation = [
    { ranges: [{ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }], type: 'decimal', formula1: '0' }
  ];
  rich.sheets['sheet-0'].conditionalFormatting = [{ ranges: 'A2:B2', rule: { type: 'colorScale' } }];
  rich.sheets['sheet-0'].cellData[1][1].s = { n: '0.00' };
  const packed = injectWorkbookSnapshot(nextBytes, rich);
  const loaded = extractWorkbookSnapshot(packed);
  assert.ok(loaded, 'xlsx carries univer snapshot');
  assert.deepEqual(loaded.sheets['sheet-0'].mergeData, rich.sheets['sheet-0'].mergeData);
  assert.equal(loaded.sheets['sheet-0'].freeze.ySplit, 1);
  assert.equal(loaded.sheets['sheet-0'].dataValidation[0].type, 'decimal');
  assert.equal(loaded.sheets['sheet-0'].conditionalFormatting[0].rule.type, 'colorScale');
  assert.equal(loaded.sheets['sheet-0'].cellData[1][1].f || loaded.sheets['sheet-0'].cellData[1][0].f, '=A1');
  const patched = patchWorkbookFromSheets(loaded, workbookDataToSheets(loaded).map((s) => ({
    ...s,
    rows: s.rows.map((row, ri) => (ri === 1 ? [row[0], 9] : row))
  })));
  assert.deepEqual(patched.sheets['sheet-0'].mergeData, rich.sheets['sheet-0'].mergeData);
  assert.equal(patched.sheets['sheet-0'].cellData[1][1].v, 9);
  const ins = inspectWorkbookRange(patched, 'B2', 'S');
  assert.equal(ins.sheet, 'S');
  assert.ok(ins.headers.length >= 1);
  assert.equal(ins.cells[0].validation.type, 'decimal');
  assert.equal(ins.cells[0].numfmt, '0.00');
  assert.equal(ins.headers[0], 'h2');
  assert.equal(String(JSON.stringify(ins.cells)).includes('conditionalFormatting'), false);

  console.log('test_sheet_codec: ok');
}

run();
