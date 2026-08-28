/**
 * Import a real .xlsx (not Paw sidecar) into Univer IWorkbookData:
 * formulas, merges, column widths, solid fills.
 */

import { gridExtentFromUsed } from './sheetCodec.js';

function newWorkbookId() {
  return `paw-wb-${Math.random().toString(36).slice(2, 10)}`;
}

function fillRgb(cell) {
  const rgb = cell?.s?.fgColor?.rgb;
  if (!rgb || typeof rgb !== 'string') return '';
  const hex = rgb.replace(/^#/, '');
  const body = hex.length === 8 ? hex.slice(2) : hex;
  if (!/^[0-9A-Fa-f]{6}$/.test(body)) return '';
  return `#${body.toUpperCase()}`;
}

function univerStyleFromXlsxCell(cell) {
  const s = {};
  const fill = fillRgb(cell);
  if (String(cell?.s?.patternType || '').toLowerCase() === 'solid' && fill) {
    s.bg = { rgb: fill };
    const n = parseInt(fill.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (0.299 * r + 0.587 * g + 0.114 * b < 150) s.cl = { rgb: '#FFFFFF' };
  }
  if (cell?.z && cell.z !== 'General') s.n = { pattern: String(cell.z) };
  return Object.keys(s).length ? s : null;
}

function clampFormula(f, maxRow) {
  const cap = Math.max(50, Number(maxRow) + 40);
  return String(f || '').replace(/(\$?[A-Z]+\$?)1048576/gi, `$1${cap}`);
}

function cellFromXlsx(cell, maxRow) {
  if (!cell || cell.t === 'z') return null;
  const hasV = cell.v != null && cell.v !== '';
  const hasF = cell.f != null && String(cell.f).trim() !== '';
  const style = univerStyleFromXlsxCell(cell);
  if (!hasV && !hasF && !style) return null;
  const out = {};
  if (hasF) {
    const raw = clampFormula(cell.f, maxRow);
    out.f = raw.startsWith('=') ? raw : `=${raw}`;
  }
  if (hasV) out.v = cell.v;
  if (cell.t === 'b' || typeof cell.v === 'boolean') out.t = 3;
  else if (cell.t === 'n' || typeof cell.v === 'number') out.t = 2;
  else if (hasV) out.t = 1;
  if (style) out.s = style;
  return out;
}

function mergesOf(ws) {
  return (Array.isArray(ws?.['!merges']) ? ws['!merges'] : [])
    .map((m) => ({
      startRow: m.s.r,
      startColumn: m.s.c,
      endRow: m.e.r,
      endColumn: m.e.c
    }))
    .filter((m) => Number.isFinite(m.startRow) && Number.isFinite(m.endRow));
}

function colsOf(ws) {
  const list = Array.isArray(ws?.['!cols']) ? ws['!cols'] : [];
  const columnData = {};
  list.forEach((col, i) => {
    if (!col) return;
    const w = Number(col.wpx || (col.wch ? col.wch * 7 : 0));
    if (w > 0) columnData[i] = { w };
  });
  return columnData;
}

/**
 * @param {object} XLSX SheetJS module
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {{ id?: string, name?: string }} [opts]
 */
export function workbookFromXlsxBytes(XLSX, bytes, opts = {}) {
  if (!XLSX?.read || !XLSX.utils) throw new Error('SheetJS required');
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const wb = XLSX.read(buf, {
    type: 'array',
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
    sheetStubs: true
  });
  const names = wb.SheetNames && wb.SheetNames.length ? wb.SheetNames : ['Sheet1'];
  const sheets = {};
  const sheetOrder = [];
  names.forEach((name, i) => {
    const id = `sheet-${i}`;
    sheetOrder.push(id);
    const ws = wb.Sheets[name] || {};
    const ref = ws['!ref'];
    let maxR = 0;
    let maxC = 0;
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      maxR = range.e.r;
      maxC = range.e.c;
    }
    const cellData = {};
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const rowObj = {};
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const mapped = cellFromXlsx(ws[addr], range.e.r);
          if (mapped) rowObj[c] = mapped;
        }
        if (Object.keys(rowObj).length) cellData[r] = rowObj;
      }
    }
    const extent = gridExtentFromUsed(maxR + 1, maxC + 1);
    const columnData = colsOf(ws);
    sheets[id] = {
      id,
      name: String(name || `Sheet${i + 1}`).slice(0, 31),
      cellData,
      mergeData: mergesOf(ws),
      columnData,
      ...extent
    };
  });
  return {
    id: String(opts.id || '').trim() || newWorkbookId(),
    name: String(opts.name || 'Workbook'),
    sheetOrder,
    sheets
  };
}
