/**
 * Inject cell-anchored pictures into a SheetJS xlsx zip (community SheetJS has no image write).
 * Images are over-grid two-cell anchors Excel/WPS can open — not Excel 365 Place-in-Cell.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from './vendor/fflate.js';

function asBytes(buf) {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
}

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mimeExt(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'png';
  return 'png';
}

function contentTypeForExt(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'jpeg' || e === 'jpg') return 'image/jpeg';
  if (e === 'gif') return 'image/gif';
  return 'image/png';
}

function resolveZipPath(fromFile, target) {
  let dir = String(fromFile || '').split('/').slice(0, -1);
  if (dir[dir.length - 1] === '_rels') dir = dir.slice(0, -1);
  for (const part of String(target || '').replace(/^\.\//, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') dir.pop();
    else dir.push(part);
  }
  return dir.join('/');
}

function pngSize(bytes) {
  if (!bytes || bytes.length < 24) return { w: 80, h: 80 };
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: 80, h: 80 };
}

function nextRid(xml) {
  let max = 0;
  const re = /\bId="rId(\d+)"/gi;
  let m;
  while ((m = re.exec(String(xml || '')))) max = Math.max(max, Number(m[1]) || 0);
  return `rId${max + 1}`;
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

function ensureNsR(xml) {
  if (/xmlns:r=/.test(xml)) return xml;
  return xml.replace(/<worksheet\b([^>]*)>/, '<worksheet$1 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
}

function drawingXml(pics) {
  const body = pics
    .map((p, i) => {
      const col = Math.max(0, Number(p.col) || 0);
      const row = Math.max(0, Number(p.row) || 0);
      const rid = `rId${i + 1}`;
      const name = xmlEscape(p.name || `Picture ${i + 1}`);
      return `<xdr:twoCellAnchor editAs="twoCell">
  <xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
  <xdr:to><xdr:col>${col + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
  <xdr:pic>
    <xdr:nvPicPr>
      <xdr:cNvPr id="${i + 2}" name="${name}"/>
      <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
    </xdr:nvPicPr>
    <xdr:blipFill>
      <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/>
      <a:stretch><a:fillRect/></a:stretch>
    </xdr:blipFill>
    <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
  </xdr:pic>
  <xdr:clientData/>
</xdr:twoCellAnchor>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
${body}
</xdr:wsDr>`;
}

function drawingRels(pics) {
  const rels = pics
    .map((p, i) => {
      const ext = mimeExt(p.mime);
      return `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${p.index}.${ext}"/>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function patchContentTypes(xml, extras) {
  let out = xml || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';
  const addDefault = (ext, ct) => {
    if (new RegExp(`Extension="${ext}"`, 'i').test(out)) return;
    out = out.replace(
      /<\/Types>/,
      `<Default Extension="${ext}" ContentType="${ct}"/></Types>`
    );
  };
  addDefault('png', 'image/png');
  addDefault('jpeg', 'image/jpeg');
  addDefault('gif', 'image/gif');
  addDefault('rels', 'application/vnd.openxmlformats-package.relationships+xml');
  addDefault('xml', 'application/xml');
  for (const part of extras) {
    if (out.includes(`PartName="${part.part}"`)) continue;
    out = out.replace(
      /<\/Types>/,
      `<Override PartName="${part.part}" ContentType="${part.type}"/></Types>`
    );
  }
  return out;
}

/**
 * @param {Uint8Array} xlsxBytes
 * @param {Array<{ sheet: string, row: number, col: number, bytes: Uint8Array, mime?: string, width?: number, height?: number }>} images
 */
export function injectXlsxImages(xlsxBytes, images) {
  const list = (Array.isArray(images) ? images : []).filter((im) => im?.bytes?.length);
  if (!list.length) return asBytes(xlsxBytes);
  const files = unzipSync(asBytes(xlsxBytes));
  const nameToPath = parseSheetTargets(files);
  const bySheet = new Map();
  for (const im of list) {
    const sheet = String(im.sheet || 'Sheet1');
    const path = nameToPath.get(sheet) || [...nameToPath.values()][0];
    if (!path) continue;
    if (!bySheet.has(path)) bySheet.set(path, { sheet, pics: [] });
    bySheet.get(path).pics.push(im);
  }
  let mediaIndex = 1;
  const ctExtras = [];
  for (const [sheetPath, group] of bySheet) {
    const pics = group.pics.map((im) => ({ ...im, index: mediaIndex++ }));
    const drawIndex = Object.keys(files).filter((k) => /^xl\/drawings\/drawing\d+\.xml$/i.test(k)).length + 1;
    const drawPath = `xl/drawings/drawing${drawIndex}.xml`;
    const drawRelPath = `xl/drawings/_rels/drawing${drawIndex}.xml.rels`;
    files[drawPath] = strToU8(drawingXml(pics));
    files[drawRelPath] = strToU8(drawingRels(pics));
    ctExtras.push({
      part: `/${drawPath}`,
      type: 'application/vnd.openxmlformats-officedocument.drawing+xml'
    });
    for (const p of pics) {
      const ext = mimeExt(p.mime);
      files[`xl/media/image${p.index}.${ext}`] = asBytes(p.bytes);
    }
    const sheetXml = strFromU8(files[sheetPath] || new Uint8Array());
    const relPath = sheetPath.replace(/^(xl\/worksheets\/)([^/]+)$/, 'xl/worksheets/_rels/$2.rels');
    let relXml = files[relPath] ? strFromU8(files[relPath]) : '';
    if (!relXml) {
      relXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }
    const rid = nextRid(relXml);
    const drawTarget = `../drawings/drawing${drawIndex}.xml`;
    relXml = relXml.replace(
      /<\/Relationships>/,
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="${drawTarget}"/></Relationships>`
    );
    files[relPath] = strToU8(relXml);
    let nextSheet = ensureNsR(sheetXml);
    if (!/<drawing\b/.test(nextSheet)) {
      nextSheet = nextSheet.replace(
        /<\/worksheet>\s*$/,
        `<drawing r:id="${rid}"/></worksheet>`
      );
    }
    files[sheetPath] = strToU8(nextSheet);
  }
  const ctPath = '[Content_Types].xml';
  files[ctPath] = strToU8(patchContentTypes(strFromU8(files[ctPath] || new Uint8Array()), ctExtras));
  return zipSync(files, { level: 6 });
}

/**
 * Read cell-anchored pictures we wrote (twoCellAnchor / oneCellAnchor).
 * @param {Uint8Array} xlsxBytes
 * @returns {Array<{ sheet: string, row: number, col: number, bytes: Uint8Array, mime: string }>}
 */
export function extractXlsxImages(xlsxBytes) {
  const files = unzipSync(asBytes(xlsxBytes));
  const nameToPath = parseSheetTargets(files);
  const out = [];
  for (const [sheet, sheetPath] of nameToPath) {
    const relPath = sheetPath.replace(/^(xl\/worksheets\/)([^/]+)$/, 'xl/worksheets/_rels/$2.rels');
    const relXml = files[relPath] ? strFromU8(files[relPath]) : '';
    const drawTargets = [];
    for (const m of relXml.matchAll(/Type="[^"]*drawing"[^>]*Target="([^"]+)"/g)) {
      drawTargets.push(m[1]);
    }
    for (const m of relXml.matchAll(/Target="([^"]+)"[^>]*Type="[^"]*drawing"/g)) {
      if (!drawTargets.includes(m[1])) drawTargets.push(m[1]);
    }
    for (const target of drawTargets) {
      const drawPath = resolveZipPath(relPath, target);
      const drawXml = files[drawPath] ? strFromU8(files[drawPath]) : '';
      const drawRelPath = drawPath.replace(/^(xl\/drawings\/)([^/]+)$/, 'xl/drawings/_rels/$2.rels');
      const drels = files[drawRelPath] ? strFromU8(files[drawRelPath]) : '';
      const ridToMedia = new Map();
      for (const m of drels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
        ridToMedia.set(m[1], resolveZipPath(drawRelPath, m[2]));
      }
      for (const m of drels.matchAll(/Target="([^"]+)"[^>]*Id="(rId\d+)"/g)) {
        if (!ridToMedia.has(m[2])) ridToMedia.set(m[2], resolveZipPath(drawRelPath, m[1]));
      }
      const re =
        /<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="(rId\d+)"/g;
      let hit;
      while ((hit = re.exec(drawXml))) {
        const mediaPath = ridToMedia.get(hit[3]);
        const bytes = mediaPath ? files[mediaPath] : null;
        if (!bytes) continue;
        const ext = String(mediaPath).split('.').pop();
        out.push({
          sheet,
          col: Number(hit[1]) || 0,
          row: Number(hit[2]) || 0,
          bytes: asBytes(bytes),
          mime: contentTypeForExt(ext)
        });
      }
    }
  }
  return out;
}

export function isImageMarkerCell(v) {
  const s = String(v ?? '');
  return s === '🖼' || /^\[image:/i.test(s);
}

export function stripImageMarkers(rows, images) {
  const hit = new Set(
    (images || []).map((im) => `${Number(im.row) || 0},${Number(im.col) || 0}`)
  );
  return (rows || []).map((row, r) =>
    (Array.isArray(row) ? row : []).map((v, c) => {
      if (hit.has(`${r},${c}`) && isImageMarkerCell(v)) return '';
      if (isImageMarkerCell(v)) return '';
      return v;
    })
  );
}

function publicImageUrl(src) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

/** CSV cannot hold pixels. Write the source URL; drop emoji placeholders. */
export function applyImageUrlsToRows(rows, images) {
  const map = new Map();
  for (const im of images || []) {
    const url = publicImageUrl(im.url || im.src);
    if (!url) continue;
    map.set(`${Number(im.row) || 0},${Number(im.col) || 0}`, url);
  }
  return (rows || []).map((row, r) =>
    (Array.isArray(row) ? row : []).map((v, c) => {
      const url = map.get(`${r},${c}`);
      if (url) return url;
      if (isImageMarkerCell(v)) return '';
      return v;
    })
  );
}

export function applyImageCellSizes(ws, images) {
  if (!ws || !Array.isArray(images) || !images.length) return ws;
  const cols = Array.isArray(ws['!cols']) ? ws['!cols'].slice() : [];
  const rows = Array.isArray(ws['!rows']) ? ws['!rows'].slice() : [];
  for (const im of images) {
    const c = Math.max(0, Number(im.col) || 0);
    const r = Math.max(0, Number(im.row) || 0);
    const wpx = Math.max(96, Number(im.width) || pngSize(im.bytes).w || 96);
    const hpx = Math.max(72, Number(im.height) || pngSize(im.bytes).h || 72);
    cols[c] = { ...(cols[c] || {}), wpx: Math.max(Number(cols[c]?.wpx) || 0, Math.min(wpx, 240)) };
    rows[r] = { ...(rows[r] || {}), hpx: Math.max(Number(rows[r]?.hpx) || 0, Math.min(hpx, 180)) };
  }
  ws['!cols'] = cols;
  ws['!rows'] = rows;
  return ws;
}
