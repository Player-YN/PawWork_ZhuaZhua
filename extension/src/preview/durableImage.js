/**
 * Persist-time image durability: blob: and other session URLs die on reload.
 */

export function isEphemeralImageSrc(src) {
  const s = String(src || '').trim();
  if (!s) return true;
  if (s.startsWith('blob:')) return true;
  if (/^filesystem:/i.test(s)) return true;
  return false;
}

export function isDurableImageSrc(src) {
  const s = String(src || '').trim();
  if (!s) return false;
  if (isEphemeralImageSrc(s)) return false;
  if (/^data:image\//i.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}

export function bytesToDataUrl(bytes, mime) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!buf.length) return '';
  const type = String(mime || 'image/png').split(';')[0] || 'image/png';
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(buf).toString('base64');
  return `data:${type};base64,${b64}`;
}

export function imageDataUrl(im) {
  if (!im) return '';
  const existing = String(im.dataUrl || '').trim();
  if (/^data:image\//i.test(existing)) return existing;
  if (im.bytes?.length) return bytesToDataUrl(im.bytes, im.mime);
  const src = String(im.src || im.url || '').trim();
  if (/^data:image\//i.test(src)) return src;
  return '';
}

function rewriteNode(value, bySrc) {
  if (typeof value === 'string') {
    const next = bySrc.get(value);
    return next || value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = rewriteNode(value[i], bySrc);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = rewriteNode(value[k], bySrc);
    if (typeof value.source === 'string' && /^data:image\//i.test(value.source)) {
      value.imageSourceType = 'BASE64';
    }
  }
  return value;
}

/**
 * Replace ephemeral (and fetched http) src strings with durable data URLs.
 * Mutates a clone — pass already-cloned tree.
 */
export function rewriteEphemeralImageSrcs(tree, images) {
  const bySrc = new Map();
  for (const im of Array.isArray(images) ? images : []) {
    const src = String(im.src || im.url || '').trim();
    const dur = imageDataUrl(im);
    if (!src || !dur || src === dur) continue;
    if (isEphemeralImageSrc(src) || /^https?:\/\//i.test(src)) bySrc.set(src, dur);
  }
  if (!bySrc.size) return tree;
  return rewriteNode(tree, bySrc);
}

export function collectImageSources(tree, out = []) {
  if (!tree || typeof tree !== 'object') return out;
  const src = tree.source || tree.src || tree.url || tree.imageUrl;
  if (typeof src === 'string' && src) out.push(src);
  for (const v of Object.values(tree)) {
    if (v && typeof v === 'object') collectImageSources(v, out);
  }
  return out;
}

/** Sidecar has no usable pixels — restore from xlsx zip drawings. */
export function snapshotNeedsImageReinsert(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.sheets) return true;
  const srcs = collectImageSources(snapshot);
  if (!srcs.length) return true;
  return srcs.some((s) => isEphemeralImageSrc(s));
}

function drawingSourceOf(node) {
  if (!node || typeof node !== 'object') return '';
  return String(node.source || node.src || node.url || node.imageUrl || '').trim();
}

function drawingPosOf(node) {
  if (!node || typeof node !== 'object') return null;
  const from = node.sheetTransform?.from || node.from || {};
  const row = Number(from.row ?? node.row);
  const col = Number(from.column ?? from.col ?? node.column ?? node.col);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function applyPosRewrite(node, byPos, sheetName) {
  if (!node || typeof node !== 'object') return;
  const src = drawingSourceOf(node);
  const pos = drawingPosOf(node);
  if (pos && (!src || isEphemeralImageSrc(src) || /^https?:\/\//i.test(src))) {
    const dur =
      byPos.get(`${sheetName || ''}:${pos.row}:${pos.col}`) ||
      byPos.get(`:${pos.row}:${pos.col}`);
    if (dur) {
      node.source = dur;
      if ('src' in node) node.src = dur;
      node.imageSourceType = 'BASE64';
    }
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') applyPosRewrite(v, byPos, sheetName);
  }
}

function posMapFromImages(images) {
  const byPos = new Map();
  for (const im of Array.isArray(images) ? images : []) {
    const dur = imageDataUrl(im);
    if (!dur) continue;
    const row = Number(im.row) || 0;
    const col = Number(im.col) || 0;
    byPos.set(`${String(im.sheet || '')}:${row}:${col}`, dur);
    if (!byPos.has(`:${row}:${col}`)) byPos.set(`:${row}:${col}`, dur);
  }
  return byPos;
}

/**
 * Make workbook.save() drawings survive reload: blob:/http src → data URL.
 */
export function rewriteWorkbookImages(data, images) {
  if (!data || typeof data !== 'object') return data;
  rewriteEphemeralImageSrcs(data, images);
  const byPos = posMapFromImages(images);
  if (!byPos.size) return data;
  const sheets = data.sheets && typeof data.sheets === 'object' ? data.sheets : {};
  for (const sh of Object.values(sheets)) {
    applyPosRewrite(sh, byPos, String(sh?.name || ''));
  }
  if (Array.isArray(data.resources)) {
    for (const res of data.resources) {
      if (typeof res?.data !== 'string' || !res.data.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(res.data);
        rewriteEphemeralImageSrcs(parsed, images);
        applyPosRewrite(parsed, byPos, '');
        res.data = JSON.stringify(parsed);
      } catch {
        /* keep */
      }
    }
  }
  applyPosRewrite(data, byPos, '');
  return data;
}

export function rewriteHtmlImageSrcs(html, images) {
  let out = String(html || '');
  for (const im of Array.isArray(images) ? images : []) {
    const src = String(im.src || im.url || '').trim();
    const dur = imageDataUrl(im);
    if (!src || !dur || src === dur) continue;
    if (!isEphemeralImageSrc(src) && !/^https?:\/\//i.test(src)) continue;
    out = out.split(src).join(dur);
  }
  return out;
}
