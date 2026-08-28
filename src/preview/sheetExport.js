/**
 * Host xlsx export from Univer IWorkbookData — formulas, structure, IMAGE(url).
 * AOA flattening stays CSV/TSV-only. Community SheetJS cannot write CF / validation OOXML.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from './vendor/fflate.js';
import { injectXlsxImages, isImageMarkerCell } from './xlsxImages.js';

function encodeCol(c) {
  let n = Math.max(0, Number(c) | 0) + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

function encodeCell(r, c) {
  return `${encodeCol(c)}${Number(r) + 1}`;
}

function encodeRange(sr, sc, er, ec) {
  return `${encodeCell(sr, sc)}:${encodeCell(er, ec)}`;
}

const CELL_NUMBER = 2;
const CELL_BOOLEAN = 3;
const CELL_FORCE_STRING = 4;

function asBytes(buf) {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
}

function sheetOrderIds(data) {
  const sheets = data?.sheets && typeof data.sheets === 'object' ? data.sheets : {};
  if (Array.isArray(data?.sheetOrder) && data.sheetOrder.length) {
    return data.sheetOrder.filter((id) => sheets[id]);
  }
  return Object.keys(sheets);
}

function resolveStyle(cell, styles) {
  const raw = cell?.s;
  if (raw && typeof raw === 'object') return raw;
  if (raw != null && styles && typeof styles === 'object') {
    return styles[raw] || styles[String(raw)] || null;
  }
  return null;
}

function numfmtOf(cell, styles) {
  if (cell?.n && typeof cell.n === 'string') return cell.n;
  if (cell?.numfmt) return String(cell.numfmt);
  const st = resolveStyle(cell, styles);
  if (!st) return null;
  if (typeof st.n === 'string' && st.n) return st.n;
  if (st.n && typeof st.n === 'object' && st.n.pattern) return String(st.n.pattern);
  if (st.pattern) return String(st.pattern);
  return null;
}

function formulaBody(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.startsWith('=') ? s.slice(1) : s;
}

function isImageMarkerValue(v) {
  return isImageMarkerCell(v);
}

/**
 * @param {object|null} cell Univer ICellData
 * @param {object} [styles] workbook styles map
 * @returns {{ t: string, v?: any, f?: string, z?: string }|null}
 */
export function univerCellToXlsxCell(cell, styles) {
  if (cell == null) return null;
  if (typeof cell !== 'object') {
    if (cell === '' || isImageMarkerValue(cell)) return null;
    if (typeof cell === 'number' && Number.isFinite(cell)) return { t: 'n', v: cell };
    if (typeof cell === 'boolean') return { t: 'b', v: cell };
    return { t: 's', v: String(cell) };
  }
  const f = formulaBody(cell.f);
  const z = numfmtOf(cell, styles);
  let v = cell.v;
  if (isImageMarkerValue(v) && !f) return z ? { t: 's', v: '', z } : null;
  if (isImageMarkerValue(v)) v = undefined;

  const tHint = Number(cell.t);
  let out;
  if (f) {
    const t =
      tHint === CELL_BOOLEAN || typeof v === 'boolean'
        ? 'b'
        : tHint === CELL_FORCE_STRING || (typeof v === 'string' && v !== '' && tHint !== CELL_NUMBER)
          ? 'str'
          : typeof v === 'number' && Number.isFinite(v)
            ? 'n'
            : v == null
              ? 'n'
              : typeof v === 'boolean'
                ? 'b'
                : 'n';
    out = { t, f };
    if (v != null && v !== '') out.v = v;
  } else if (v == null || v === '') {
    if (!z) return null;
    out = { t: 'n' };
  } else if (typeof v === 'boolean' || tHint === CELL_BOOLEAN) {
    out = { t: 'b', v: v === true || v === 1 || v === '1' || v === 'TRUE' };
  } else if (
    tHint === CELL_NUMBER ||
    (typeof v === 'number' && Number.isFinite(v) && tHint !== CELL_FORCE_STRING)
  ) {
    out = { t: 'n', v: typeof v === 'number' ? v : Number(v) };
    if (!Number.isFinite(out.v)) out = { t: 's', v: String(v) };
  } else {
    out = { t: 's', v: String(v) };
  }
  if (z) out.z = z;
  return out;
}

function parseMerge(m) {
  if (!m || typeof m !== 'object') return null;
  const sr = Number(m.startRow ?? m.start?.row ?? m.s?.r);
  const sc = Number(m.startColumn ?? m.startCol ?? m.start?.column ?? m.start?.col ?? m.s?.c);
  const er = Number(m.endRow ?? m.end?.row ?? m.e?.r);
  const ec = Number(m.endColumn ?? m.endCol ?? m.end?.column ?? m.end?.col ?? m.e?.c);
  if (![sr, sc, er, ec].every(Number.isFinite)) return null;
  return { s: { r: sr, c: sc }, e: { r: er, c: ec } };
}

function hiddenFlag(v) {
  return v === 1 || v === true || v === '1';
}

function colsFromSheet(sh) {
  const src = sh?.columnData && typeof sh.columnData === 'object' ? sh.columnData : {};
  const keys = Object.keys(src)
    .map(Number)
    .filter(Number.isFinite);
  if (!keys.length) return [];
  const max = Math.max(...keys);
  const cols = [];
  for (let c = 0; c <= max; c++) {
    const d = src[c] || src[String(c)];
    if (!d || typeof d !== 'object') {
      cols.push(null);
      continue;
    }
    const item = {};
    const w = Number(d.w);
    if (Number.isFinite(w) && w > 0) item.wpx = w;
    if (hiddenFlag(d.hd)) item.hidden = true;
    cols.push(Object.keys(item).length ? item : null);
  }
  while (cols.length && !cols[cols.length - 1]) cols.pop();
  return cols;
}

function rowsFromSheet(sh) {
  const src = sh?.rowData && typeof sh.rowData === 'object' ? sh.rowData : {};
  const keys = Object.keys(src)
    .map(Number)
    .filter(Number.isFinite);
  if (!keys.length) return [];
  const max = Math.max(...keys);
  const rows = [];
  for (let r = 0; r <= max; r++) {
    const d = src[r] || src[String(r)];
    if (!d || typeof d !== 'object') {
      rows.push(null);
      continue;
    }
    const item = {};
    const h = Number(d.h ?? d.ah);
    if (Number.isFinite(h) && h > 0) item.hpx = h;
    if (hiddenFlag(d.hd)) item.hidden = true;
    rows.push(Object.keys(item).length ? item : null);
  }
  while (rows.length && !rows[rows.length - 1]) rows.pop();
  return rows;
}

export function freezeToSheetView(freeze) {
  if (!freeze || typeof freeze !== 'object') return null;
  const ySplit = Math.max(0, Number(freeze.ySplit) || 0);
  const xSplit = Math.max(0, Number(freeze.xSplit) || 0);
  if (!ySplit && !xSplit) return null;
  const startRow = Number.isFinite(Number(freeze.startRow)) ? Number(freeze.startRow) : ySplit;
  const startColumn = Number.isFinite(Number(freeze.startColumn)) ? Number(freeze.startColumn) : xSplit;
  let activePane = 'bottomLeft';
  if (xSplit && ySplit) activePane = 'bottomRight';
  else if (xSplit) activePane = 'topRight';
  return {
    state: 'frozen',
    xSplit,
    ySplit,
    topLeftCell: encodeCell(Math.max(0, startRow), Math.max(0, startColumn)),
    activePane
  };
}

/**
 * Sparse worksheet specs from IWorkbookData. No AOA padding.
 * @param {object} data
 * @returns {Array<{ name: string, cells: Array<{ r: number, c: number, cell: object }>, merges: object[], cols: object[], rows: object[], freeze: object|null }>}
 */
export function workbookDataToWorksheetSpecs(data) {
  const sheets = data?.sheets && typeof data.sheets === 'object' ? data.sheets : {};
  const styles = data?.styles && typeof data.styles === 'object' ? data.styles : {};
  const ids = sheetOrderIds(data);
  const list = ids.length ? ids : [null];
  return list.map((id, i) => {
    const sh = id ? sheets[id] || {} : {};
    const name = String(sh.name || `Sheet${i + 1}`).slice(0, 31) || `Sheet${i + 1}`;
    const cellData = sh.cellData && typeof sh.cellData === 'object' ? sh.cellData : {};
    const cells = [];
    for (const rk of Object.keys(cellData)) {
      const r = Number(rk);
      if (!Number.isFinite(r) || r < 0) continue;
      const row = cellData[rk] || {};
      for (const ck of Object.keys(row)) {
        const c = Number(ck);
        if (!Number.isFinite(c) || c < 0) continue;
        const mapped = univerCellToXlsxCell(row[ck], styles);
        if (mapped) cells.push({ r, c, cell: mapped });
      }
    }
    const merges = (Array.isArray(sh.mergeData) ? sh.mergeData : []).map(parseMerge).filter(Boolean);
    return {
      name,
      cells,
      merges,
      cols: colsFromSheet(sh),
      rows: rowsFromSheet(sh),
      freeze: freezeToSheetView(sh.freeze)
    };
  });
}

export function isHttpImageUrl(src) {
  return /^https?:\/\//i.test(String(src || '').trim());
}

export function excelImageFormula(url) {
  const u = String(url || '').trim();
  if (!isHttpImageUrl(u)) return null;
  return `IMAGE("${u.replace(/"/g, '""')}")`;
}

function existingFormula(cell) {
  return formulaBody(cell?.f);
}

function isImageFormula(f) {
  return /^IMAGE\s*\(/i.test(String(f || ''));
}

/**
 * http(s) → Excel IMAGE() formula; pixels without a stable URL → drawing.
 * Do not overwrite a non-IMAGE formula already in the cell.
 */
export function classifyExportImages(images, cellLookup) {
  const formulas = [];
  const drawings = [];
  for (const im of Array.isArray(images) ? images : []) {
    const sheet = String(im.sheet || 'Sheet1');
    const row = Number(im.row) || 0;
    const col = Number(im.col) || 0;
    const src = String(im.src || im.url || '').trim();
    const f = excelImageFormula(src);
    const existing = cellLookup ? cellLookup(sheet, row, col) : null;
    const prevF = existingFormula(existing);
    if (f && (!prevF || isImageFormula(prevF))) {
      formulas.push({ sheet, row, col, f, src });
      continue;
    }
    if (im.bytes?.length) drawings.push(im);
  }
  return { formulas, drawings };
}

function parseSheetTargets(files) {
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] || new Uint8Array());
  const book = strFromU8(files['xl/workbook.xml'] || new Uint8Array());
  const ridToTarget = new Map();
  for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    ridToTarget.set(m[1], m[2].replace(/^\.\//, ''));
  }
  for (const m of rels.matchAll(/Target="([^"]+)"[^>]*Id="(rId\d+)"/g)) {
    ridToTarget.set(m[2], m[1].replace(/^\.\//, ''));
  }
  const nameToPath = new Map();
  for (const m of book.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const target = ridToTarget.get(m[2]) || '';
    const path = target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`;
    nameToPath.set(m[1], path);
  }
  return nameToPath;
}

function paneXml(view) {
  const attrs = [];
  if (view.xSplit) attrs.push(`xSplit="${view.xSplit}"`);
  if (view.ySplit) attrs.push(`ySplit="${view.ySplit}"`);
  attrs.push(`topLeftCell="${view.topLeftCell}"`);
  attrs.push(`activePane="${view.activePane}"`);
  attrs.push('state="frozen"');
  return `<pane ${attrs.join(' ')}/>`;
}

function injectPaneIntoSheetXml(xml, view) {
  const pane = paneXml(view);
  let out = String(xml || '');
  if (/<pane\b/.test(out)) {
    return out.replace(/<pane\b[^>]*\/>/, pane).replace(/<pane\b[^>]*>[\s\S]*?<\/pane>/, pane);
  }
  if (/<sheetView\b[^>]*\/>/.test(out)) {
    return out.replace(/<sheetView\b([^>]*)\/>/, `<sheetView$1>${pane}</sheetView>`);
  }
  if (/<sheetView\b/.test(out)) {
    return out.replace(/<sheetView\b([^>]*)>/, (m) => `${m}${pane}`);
  }
  const views = `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>`;
  if (/<sheetViews\s*\/>/.test(out)) return out.replace(/<sheetViews\s*\/>/, views);
  if (/<sheetViews>/.test(out)) {
    return out.replace(/<sheetViews>/, `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView>`);
  }
  if (/<dimension\b[^>]*\/>/.test(out)) {
    return out.replace(/(<dimension\b[^>]*\/>)/, `$1${views}`);
  }
  return out.replace(/<worksheet\b([^>]*)>/, `<worksheet$1>${views}`);
}

export function injectFrozenPanes(xlsxBytes, specs) {
  const list = (Array.isArray(specs) ? specs : []).filter((s) => s?.freeze);
  if (!list.length) return asBytes(xlsxBytes);
  let files;
  try {
    files = unzipSync(asBytes(xlsxBytes));
  } catch {
    return asBytes(xlsxBytes);
  }
  const nameToPath = parseSheetTargets(files);
  for (const spec of list) {
    const path = nameToPath.get(spec.name) || [...nameToPath.values()][0];
    if (!path || !files[path]) continue;
    const xml = strFromU8(files[path]);
    files[path] = strToU8(injectPaneIntoSheetXml(xml, spec.freeze));
  }
  return zipSync(files, { level: 6 });
}

function compactCell(cell) {
  const out = { t: cell.t || 'n' };
  if (cell.v != null) out.v = cell.v;
  if (cell.f) out.f = cell.f;
  if (cell.z) out.z = cell.z;
  return out;
}

/**
 * Write Excel-openable xlsx from IWorkbookData + live images.
 * `xlsx` is injected — Chrome MV3 cannot resolve the bare `xlsx` specifier.
 * Caller should injectWorkbookSnapshot for Paw round-trip of CF / validation / styles.
 */
export function writeWorkbookXlsxBytes(workbookData, images = [], xlsx) {
  if (!xlsx?.utils?.book_new || typeof xlsx.write !== 'function') {
    throw new Error('writeWorkbookXlsxBytes requires SheetJS');
  }
  const specs = workbookDataToWorksheetSpecs(workbookData);
  const lookup = (sheet, r, c) => {
    const spec = specs.find((s) => s.name === sheet) || specs[0];
    const hit = spec?.cells.find((x) => x.r === r && x.c === c);
    return hit?.cell || null;
  };
  const classified = classifyExportImages(images, lookup);
  const wb = xlsx.utils.book_new();
  const usedNames = new Set();
  const list = specs.length ? specs : [{ name: 'Sheet1', cells: [], merges: [], cols: [], rows: [], freeze: null }];
  for (const spec of list) {
    let name = spec.name || 'Sheet1';
    if (usedNames.has(name)) name = `${name.slice(0, 28)}_${usedNames.size}`;
    usedNames.add(name);
    const ws = {};
    let maxR = 0;
    let maxC = 0;
    for (const { r, c, cell } of spec.cells) {
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
      ws[encodeCell(r, c)] = compactCell(cell);
    }
    for (const im of classified.formulas) {
      if (im.sheet !== spec.name && im.sheet !== name) continue;
      const addr = encodeCell(im.row, im.col);
      const existing = ws[addr];
      const prevF = existingFormula(existing);
      if (prevF && !isImageFormula(prevF)) continue;
      ws[addr] = compactCell({ t: 'str', f: im.f });
      maxR = Math.max(maxR, im.row);
      maxC = Math.max(maxC, im.col);
    }
    ws['!ref'] = encodeRange(0, 0, Math.max(0, maxR), Math.max(0, maxC));
    if (spec.merges.length) ws['!merges'] = spec.merges;
    if (spec.cols.length) ws['!cols'] = spec.cols;
    if (spec.rows.length) ws['!rows'] = spec.rows;
    if (spec.freeze) ws['!views'] = [{ ...spec.freeze }];
    xlsx.utils.book_append_sheet(wb, ws, name);
  }
  const out = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  let bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  bytes = injectFrozenPanes(bytes, list);
  if (classified.drawings.length) bytes = injectXlsxImages(bytes, classified.drawings);
  return bytes;
}
