/**
 * Raster → scene: crop bound flatten images into independent nodes.
 * Host capability used by run createScene (op=fromRaster). Not a model tool.
 */

export function isRasterCompileInput(raw = {}) {
  const op = String(raw.op || raw.source || '').trim();
  if (op === 'fromRaster' || op === 'raster' || op === 'fromImage') return true;
  if (raw.fromRaster && typeof raw.fromRaster === 'object') return true;
  return false;
}

export function rasterItemRef(raw = {}) {
  return String(
    raw.item || raw.handle || raw.image || raw.src || raw.path || raw.artifactId || ''
  ).trim();
}

export function rasterRegions(raw = {}) {
  if (Array.isArray(raw.nodes) && raw.nodes.length) return raw.nodes;
  if (Array.isArray(raw.regions) && raw.regions.length) return raw.regions;
  return [];
}

export function sourceBoxOf(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.sourceBox && typeof node.sourceBox === 'object') return parseBox(node.sourceBox);
  if (node.cropBox && typeof node.cropBox === 'object') return parseBox(node.cropBox);
  if (node.crop && typeof node.crop === 'object' && node.crop.x != null) return parseBox(node.crop);
  return null;
}

export function shouldCropNode(node, raster = false) {
  if (!node || typeof node !== 'object') return false;
  if (node.rasterCropped) return false;
  if (node.crop === false || node.crop === 0) return false;
  if (sourceBoxOf(node)) return true;
  if (raster && node.box && (node.type === 'image' || node.src || node.tag === 'img')) return true;
  return false;
}

export function tldrawCropFromBox(box, imageSize) {
  const b = parseBox(box);
  const w = Number(imageSize?.w) || 0;
  const h = Number(imageSize?.h) || 0;
  if (!b || w <= 0 || h <= 0) return null;
  const x0 = clamp01(b.x / w);
  const y0 = clamp01(b.y / h);
  const x1 = clamp01((b.x + b.w) / w);
  const y1 = clamp01((b.y + b.h) / h);
  if (x1 <= x0 || y1 <= y0) return null;
  if (x0 <= 0.001 && y0 <= 0.001 && x1 >= 0.999 && y1 >= 0.999) return null;
  return { topLeft: { x: x0, y: y0 }, bottomRight: { x: x1, y: y1 } };
}

export function imageSizeFromDataUrl(src) {
  const s = String(src || '');
  const comma = s.indexOf(',');
  if (!s.startsWith('data:') || comma < 5) return null;
  const mime = s.slice(5, s.indexOf(';') > 0 ? s.indexOf(';') : comma);
  const b64 = s.slice(comma + 1);
  let bytes;
  try {
    bytes = decodeBase64(b64);
  } catch {
    return null;
  }
  if (/png/i.test(mime) || bytes[0] === 0x89) return pngSize(bytes);
  if (/jpeg|jpg/i.test(mime) || (bytes[0] === 0xff && bytes[1] === 0xd8)) return jpegSize(bytes);
  return null;
}

/**
 * Crop a data URL to a pixel box. Uses OffscreenCanvas when present (offscreen host).
 * Node tests fall back to tldrawCrop on the node.
 */
export async function cropDataUrlToBox(src, box) {
  const b = parseBox(box);
  if (!b || !src) return { ok: false, error: 'crop needs src and box' };
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    const size = imageSizeFromDataUrl(src);
    return { ok: false, code: 'NO_CANVAS', tldrawCrop: tldrawCropFromBox(b, size), src };
  }
  try {
    const blob = await (await fetch(src)).blob();
    const bitmap = await createImageBitmap(blob);
    let sx = Math.round(b.x);
    let sy = Math.round(b.y);
    let sw = Math.round(b.w);
    let sh = Math.round(b.h);
    sx = Math.max(0, Math.min(sx, bitmap.width - 1));
    sy = Math.max(0, Math.min(sy, bitmap.height - 1));
    sw = Math.max(1, Math.min(sw, bitmap.width - sx));
    sh = Math.max(1, Math.min(sh, bitmap.height - sy));
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return { ok: false, error: '2d context unavailable' };
    }
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    bitmap.close?.();
    const out = await canvas.convertToBlob({ type: 'image/png' });
    const dataUrl = await blobToDataUrl(out);
    return { ok: true, src: dataUrl, rasterCropped: true };
  } catch (e) {
    const size = imageSizeFromDataUrl(src);
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      tldrawCrop: tldrawCropFromBox(b, size),
      src
    };
  }
}

export async function applyRasterCrops(nodes, opts = {}) {
  const list = Array.isArray(nodes) ? nodes : [];
  const raster = opts.raster === true;
  const out = [];
  for (const n of list) {
    if (!shouldCropNode(n, raster)) {
      out.push(n);
      continue;
    }
    const box = sourceBoxOf(n) || parseBox(n.box);
    const src = String(n.src || '').trim();
    if (!box || !src || !/^data:image\//i.test(src)) {
      const size = imageSizeFromDataUrl(src);
      out.push({
        ...n,
        sourceBox: box,
        tldrawCrop: tldrawCropFromBox(box, size)
      });
      continue;
    }
    const cropped = await cropDataUrlToBox(src, box);
    if (cropped.ok && cropped.src) {
      out.push({
        ...n,
        src: cropped.src,
        sourceBox: box,
        rasterCropped: true,
        tldrawCrop: null
      });
      continue;
    }
    out.push({
      ...n,
      sourceBox: box,
      tldrawCrop: cropped.tldrawCrop || tldrawCropFromBox(box, imageSizeFromDataUrl(src))
    });
  }
  return out;
}

function parseBox(box) {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w ?? box.width);
  const h = Number(box.h ?? box.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function decodeBase64(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pngSize(bytes) {
  if (!bytes || bytes.byteLength < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const w = u32(bytes, 16);
  const h = u32(bytes, 20);
  if (w < 1 || h < 1 || w > 20000 || h > 20000) return null;
  return { w, h };
}

function jpegSize(bytes) {
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const h = (bytes[i + 5] << 8) | bytes[i + 6];
      const w = (bytes[i + 7] << 8) | bytes[i + 8];
      if (w > 0 && h > 0) return { w, h };
      return null;
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function u32(bytes, i) {
  return ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('crop read failed'));
    };
    reader.onerror = () => reject(reader.error || new Error('crop read failed'));
    reader.readAsDataURL(blob);
  });
}
