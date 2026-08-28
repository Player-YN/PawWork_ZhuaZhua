/**
 * Browser bundle for the live sheet tab: Univer OSS (all Apache-2.0 sheet presets) + SheetJS.
 * Built to src/preview/vendor/sheet-runtime.js
 * Never import Univer Pro commercial packages.
 */

import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { defaultTheme } from '@univerjs/themes';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { UniverSheetsTablePreset } from '@univerjs/preset-sheets-table';
import { UniverSheetsThreadCommentPreset } from '@univerjs/preset-sheets-thread-comment';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import sheetsZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import sheetsEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import filterZhCN from '@univerjs/preset-sheets-filter/locales/zh-CN';
import filterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import sortZhCN from '@univerjs/preset-sheets-sort/locales/zh-CN';
import sortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import cfZhCN from '@univerjs/preset-sheets-conditional-formatting/locales/zh-CN';
import cfEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import dvZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import dvEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import hlZhCN from '@univerjs/preset-sheets-hyper-link/locales/zh-CN';
import hlEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import frZhCN from '@univerjs/preset-sheets-find-replace/locales/zh-CN';
import frEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import noteZhCN from '@univerjs/preset-sheets-note/locales/zh-CN';
import noteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import tableZhCN from '@univerjs/preset-sheets-table/locales/zh-CN';
import tableEnUS from '@univerjs/preset-sheets-table/locales/en-US';
import tcZhCN from '@univerjs/preset-sheets-thread-comment/locales/zh-CN';
import tcEnUS from '@univerjs/preset-sheets-thread-comment/locales/en-US';
import drawZhCN from '@univerjs/preset-sheets-drawing/locales/zh-CN';
import drawEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-sort/lib/index.css';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';
import '@univerjs/preset-sheets-table/lib/index.css';
import '@univerjs/preset-sheets-thread-comment/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';
import * as XLSX from 'xlsx';
import { injectXlsxImages, stripImageMarkers, applyImageCellSizes, extractXlsxImages } from '../src/preview/xlsxImages.js';
import { writeWorkbookXlsxBytes as writeWorkbookXlsxBytesWith } from '../src/preview/sheetExport.js';
import { workbookFromXlsxBytes as workbookFromXlsxBytesWith } from '../src/preview/xlsxIngest.js';

export { extractXlsxImages };

export function writeWorkbookXlsxBytes(workbookData, images = []) {
  return writeWorkbookXlsxBytesWith(workbookData, images, XLSX);
}

export function readWorkbookFromXlsxBytes(bytes, opts = {}) {
  return workbookFromXlsxBytesWith(XLSX, bytes, opts);
}

export {
  createUniver,
  LocaleType,
  mergeLocales,
  defaultTheme,
  UniverSheetsCorePreset,
  UniverSheetsFilterPreset,
  UniverSheetsSortPreset,
  UniverSheetsConditionalFormattingPreset,
  UniverSheetsDataValidationPreset,
  UniverSheetsHyperLinkPreset,
  UniverSheetsFindReplacePreset,
  UniverSheetsNotePreset,
  UniverSheetsTablePreset,
  UniverSheetsThreadCommentPreset,
  UniverSheetsDrawingPreset,
  sheetsZhCN,
  sheetsEnUS
};

export const OSS_SHEET_PRESET_IDS = [
  'core',
  'filter',
  'sort',
  'conditional-formatting',
  'data-validation',
  'hyper-link',
  'find-replace',
  'note',
  'table',
  'thread-comment',
  'drawing'
];

export function mergeSheetLocalesZhCN() {
  return mergeLocales(
    sheetsZhCN,
    filterZhCN,
    sortZhCN,
    cfZhCN,
    dvZhCN,
    hlZhCN,
    frZhCN,
    noteZhCN,
    tableZhCN,
    tcZhCN,
    drawZhCN
  );
}

export function mergeSheetLocalesEnUS() {
  return mergeLocales(
    sheetsEnUS,
    filterEnUS,
    sortEnUS,
    cfEnUS,
    dvEnUS,
    hlEnUS,
    frEnUS,
    noteEnUS,
    tableEnUS,
    tcEnUS,
    drawEnUS
  );
}

export function createSheetPresets(coreOpts = {}) {
  return [
    UniverSheetsCorePreset(coreOpts),
    UniverSheetsFilterPreset(),
    UniverSheetsSortPreset(),
    UniverSheetsConditionalFormattingPreset(),
    UniverSheetsDataValidationPreset(),
    UniverSheetsHyperLinkPreset(),
    UniverSheetsFindReplacePreset(),
    UniverSheetsNotePreset(),
    UniverSheetsTablePreset(),
    UniverSheetsThreadCommentPreset(),
    UniverSheetsDrawingPreset()
  ];
}

function sheetToRows(ws) {
  if (!ws) return [];
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) {
        row.push('');
        continue;
      }
      if (cell.f) {
        const f = String(cell.f);
        row.push(f.startsWith('=') ? f : `=${f}`);
      } else if (cell.v == null) {
        row.push('');
      } else {
        row.push(cell.v);
      }
    }
    rows.push(row);
  }
  return rows;
}

export function readXlsxBytes(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, dense: false });
  const names = wb.SheetNames && wb.SheetNames.length ? wb.SheetNames : ['Sheet1'];
  return names.map((name) => ({
    name,
    rows: sheetToRows(wb.Sheets[name])
  }));
}

export const XLSX_DRAWING_EXPORT_WARNING =
  'SheetJS xlsx export drops Univer drawings (cell/float images). Keep the live tab or export HTML/PDF for pictures.';

export function writeXlsxBytes(sheets, images = []) {
  const list = Array.isArray(sheets) && sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];
  const pics = Array.isArray(images) ? images : [];
  const wb = XLSX.utils.book_new();
  for (const s of list) {
    const name = String(s.name || 'Sheet').slice(0, 31) || 'Sheet';
    const raw = Array.isArray(s.rows) ? s.rows : [];
    const sheetPics = pics.filter((im) => String(im.sheet || name) === name);
    const rows = stripImageMarkers(raw, sheetPics);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    applyImageCellSizes(ws, sheetPics);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (typeof v === 'string' && v.startsWith('=')) {
          const addr = XLSX.utils.encode_cell({ r, c });
          ws[addr] = { t: 'n', f: v.slice(1), v: ws[addr]?.v };
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  return pics.length ? injectXlsxImages(bytes, pics) : bytes;
}
