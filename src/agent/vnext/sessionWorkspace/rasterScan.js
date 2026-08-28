/**
 * Host flatten cut: quantize + connected components → color-block / geo / image boxes.
 * Used by fromRaster scan:"auto". Not OCR. Not a model tool.
 */

import { rasterItemRef, rasterRegions } from './rasterCompile.js';

const VAR_SOLID = 280;
const BG_COVERAGE = 0.8;
const COMPACT_COVERAGE = 0.08;
const MIN_FILL = 0.35;
const MAX_ASPECT = 24;
const MAX_WORK = 160;
const MAX_REGIONS = 40;

/**
 * @param {unknown} raw
 * @returns {boolean|null} true=auto, false=off, null=omitted
 */
export function rasterScanFlag(raw = {}) {
  const v = raw?.scan;
  if (v === false || v === 0 || v === 'false' || v === 'off' || v === 'none') return false;
  if (v === 'auto' || v === true || v === 'true' || v === 1) return true;
  return null;
}

/** scan:"auto", or missing nodes when scan !== false. */
export function shouldAutoScan(raw = {}) {
  const flag = rasterScanFlag(raw);
  if (flag === false) return false;
  const regions = rasterRegions(raw);
  if (regions.some((n) => n && n.provenance === 'raster-scan' && !isRasterTextNode(n))) {
    return false;
  }
  if (flag === true) return true;
  return regions.length === 0;
}

export function isRasterTextNode(n) {
  if (!n || typeof n !== 'object') return false;
  const t = String(n.type || '').toLowerCase();
  if (
    t === 'image' ||
    t === 'img' ||
    t === 'geo' ||
    t === 'color-block' ||
    t === 'shape' ||
    t === 'rect' ||
    t === 'rectangle'
  ) {
    return false;
  }
  if (n.tag === 'img') return false;
  if (t === 'text' || t === 'headline' || t === 'heading' || t === 'control' || t === 'cta') return true;
  return !!String(n.text || n.value || '').trim();
}

/**
 * Scan supplies visual planes. Model/inspect text is merged on top; inspect copy wins.
 * When scan produced visuals, model-guessed boxes are dropped (host cutter owns them).
 */
export function mergeRasterScanNodes(scanned, modelNodes) {
  const scannedList = Array.isArray(scanned) ? scanned : [];
  const modelList = Array.isArray(modelNodes) ? modelNodes : [];
  const scanVisual = scannedList.filter((n) => !isRasterTextNode(n));
  const modelText = modelList.filter(isRasterTextNode);
  const modelVisual = modelList.filter((n) => !isRasterTextNode(n));
  const visual = scanVisual.length ? scanVisual : modelVisual;
  return [...visual, ...modelText];
}

export function rasterImageDataFromInput(raw = {}) {
  if (isImageData(raw.imageData)) return raw.imageData;
  if (isImageData(raw.pixels)) return raw.pixels;
  const item = rasterItemRef(raw);
  if (/^data:image\/png/i.test(item)) return decodePngDataUrl(item);
  return null;
}

export function resolveRasterScanNodes(raw = {}, opts = {}) {
  const model = rasterRegions(raw);
  if (!shouldAutoScan(raw)) return { regions: model, size: null, scanned: false };
  const imageData = opts.imageData || rasterImageDataFromInput(raw);
  if (!imageData) return { regions: model, size: null, scanned: false };
  const scanned = scanRasterPixels(imageData, { item: rasterItemRef(raw) });
  return {
    regions: mergeRasterScanNodes(scanned.regions, model),
    size: scanned.size,
    scanned: true
  };
}

/**
 * Quantize + CCA + area/aspect filters, then classify.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} imageData
 * @param {{ item?: string }} [opts]
 */
export function scanRasterPixels(imageData, opts = {}) {
  if (!isImageData(imageData)) return { ok: false, regions: [], size: null };
  const origW = imageData.width;
  const origH = imageData.height;
  const work = downsample(imageData, MAX_WORK);
  const labels = quantizeLabels(work);
  const comps = connectedByLabel(labels, work.width, work.height);
  const minArea = Math.max(4, Math.floor(work.width * work.height * 0.004));
  const used = new Uint8Array(work.width * work.height);
  const solids = [];
  let blockN = 0;
  let geoN = 0;

  for (const c of comps) {
    if (c.area < minArea) continue;
    const aspect = c.box.w / c.box.h;
    if (aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) continue;
    const fillRatio = c.area / (c.box.w * c.box.h);
    if (fillRatio < MIN_FILL) continue;
    const variance = componentVariance(work, c);
    if (variance >= VAR_SOLID) continue;
    const coverage = (c.box.w * c.box.h) / (work.width * work.height);
    const box = mapBox(c.box, work, origW, origH);
    const fill = rgbToHex(c.mean);
    markComponent(used, work.width, c);
    if (coverage >= BG_COVERAGE) {
      solids.push(scanNode('scan-bg', 'color-block', box, { fill, role: 'background' }));
    } else if (coverage < COMPACT_COVERAGE && fillRatio >= 0.55) {
      geoN += 1;
      solids.push(scanNode(`scan-geo-${geoN}`, 'geo', box, { fill, geo: 'rectangle' }));
    } else {
      blockN += 1;
      solids.push(scanNode(`scan-block-${blockN}`, 'color-block', box, { fill }));
    }
  }

  const leftover = leftoverMask(work, labels, used);
  const photos = connectedByLabel(leftover, work.width, work.height);
  const images = [];
  let imageN = 0;
  const item = String(opts.item || '');
  for (const p of photos) {
    if (p.area < minArea * 2) continue;
    const aspect = p.box.w / p.box.h;
    if (aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) continue;
    imageN += 1;
    const box = mapBox(p.box, work, origW, origH);
    images.push(
      scanNode(`scan-image-${imageN}`, 'image', box, {
        src: item,
        sourceBox: box
      })
    );
  }

  solids.sort((a, b) => areaOf(b.box) - areaOf(a.box));
  const regions = [...solids, ...images].slice(0, MAX_REGIONS);
  return { ok: true, regions, size: { w: origW, h: origH } };
}

export async function rasterPixelsFromSrc(src) {
  const s = String(src || '');
  if (!s) return null;
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const blob = await srcToBlob(s);
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close?.();
        return decodePngDataUrl(s);
      }
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close?.();
      return imageData;
    } catch {
      /* fall through to PNG */
    }
  }
  return decodePngDataUrl(s);
}

export function decodePngDataUrl(src) {
  const s = String(src || '');
  const comma = s.indexOf(',');
  if (!/^data:image\/png/i.test(s) || comma < 5) return null;
  try {
    return decodePngRgba(decodeBase64(s.slice(comma + 1)));
  } catch {
    return null;
  }
}

/** 8-bit RGBA PNG (filter 0, stored deflate). Enough for Node fixtures. */
export function encodePngRgba(imageData) {
  if (!isImageData(imageData)) throw new Error('encodePngRgba needs imageData');
  const w = imageData.width;
  const h = imageData.height;
  const raw = new Uint8Array((w * 4 + 1) * h);
  const src = imageData.data;
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    const row = y * w * 4;
    raw.set(src.subarray ? src.subarray(row, row + w * 4) : Uint8Array.from(src).subarray(row, row + w * 4), o);
    o += w * 4;
  }
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, w);
  writeU32(ihdr, 4, h);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [pngSig(), chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', new Uint8Array(0))];
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return `data:image/png;base64,${bytesToBase64(out)}`;
}

export function decodePngRgba(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 33 || u8[0] !== 0x89 || u8[1] !== 0x50) throw new Error('not png');
  let i = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (i + 12 <= u8.length) {
    const len = readU32(u8, i);
    const type = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
    const data = u8.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = readU32(data, 0);
      height = readU32(data, 4);
      colorType = data[9];
      if (data[8] !== 8) throw new Error('png bit depth');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    i += 12 + len;
  }
  if (width < 1 || height < 1 || width > 20000 || height > 20000) throw new Error('png size');
  const inflated = inflateZlib(concat(idat));
  const bpp = colorType === 2 ? 3 : 4;
  if (colorType !== 2 && colorType !== 6) throw new Error('png color type');
  const stride = width * bpp + 1;
  if (inflated.length < stride * height) throw new Error('png idat short');
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    if (inflated[row] !== 0) throw new Error('png filter');
    for (let x = 0; x < width; x++) {
      const s = row + 1 + x * bpp;
      const d = (y * width + x) * 4;
      data[d] = inflated[s];
      data[d + 1] = inflated[s + 1];
      data[d + 2] = inflated[s + 2];
      data[d + 3] = bpp === 4 ? inflated[s + 3] : 255;
    }
  }
  return { width, height, data };
}

function scanNode(id, type, box, extra = {}) {
  return {
    id,
    type,
    box,
    sourceBox: extra.sourceBox || box,
    fill: extra.fill || '',
    color: extra.fill || '',
    geo: extra.geo || (type === 'geo' ? 'rectangle' : ''),
    src: extra.src || '',
    role: extra.role || '',
    provenance: 'raster-scan',
    crop: type === 'image'
  };
}

function leftoverMask(work, labels, used) {
  const n = work.width * work.height;
  const mask = new Int32Array(n);
  const global = globalVariance(work);
  for (let i = 0; i < n; i++) {
    if (used[i] || labels[i] < 0) {
      mask[i] = -1;
      continue;
    }
    mask[i] = global >= VAR_SOLID ? 1 : -1;
  }
  if (global < VAR_SOLID) {
    for (let i = 0; i < n; i++) {
      if (used[i] || labels[i] < 0) continue;
      if (pixelLocalVar(work, i % work.width, (i / work.width) | 0) >= VAR_SOLID) mask[i] = 1;
    }
  }
  return mask;
}

function downsample(imageData, maxSide) {
  const w = imageData.width;
  const h = imageData.height;
  if (Math.max(w, h) <= maxSide) {
    return { width: w, height: h, data: toClamped(imageData.data), origW: w, origH: h };
  }
  const scale = maxSide / Math.max(w, h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const data = new Uint8ClampedArray(nw * nh * 4);
  const src = imageData.data;
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor((y + 0.5) * h / nh));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / nw));
      const si = (sy * w + sx) * 4;
      const di = (y * nw + x) * 4;
      data[di] = src[si];
      data[di + 1] = src[si + 1];
      data[di + 2] = src[si + 2];
      data[di + 3] = src[si + 3];
    }
  }
  return { width: nw, height: nh, data, origW: w, origH: h };
}

function quantizeLabels(work) {
  const { width: w, height: h, data } = work;
  const labels = new Int32Array(w * h);
  for (let i = 0, p = 0; i < labels.length; i++, p += 4) {
    if (data[p + 3] < 16) {
      labels[i] = -1;
      continue;
    }
    labels[i] = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
  }
  return labels;
}

function connectedByLabel(labels, w, h) {
  const n = w * h;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a) => {
    let x = a;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const uni = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const L = labels[i];
      if (L < 0) continue;
      if (x > 0 && labels[i - 1] === L) uni(i, i - 1);
      if (y > 0 && labels[i - w] === L) uni(i, i - w);
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    if (labels[i] < 0) continue;
    const r = find(i);
    let g = groups.get(r);
    if (!g) {
      g = { minX: w, minY: h, maxX: 0, maxY: 0, area: 0, r: 0, g: 0, b: 0, pixels: [] };
      groups.set(r, g);
    }
    const x = i % w;
    const y = (i / w) | 0;
    g.minX = Math.min(g.minX, x);
    g.minY = Math.min(g.minY, y);
    g.maxX = Math.max(g.maxX, x);
    g.maxY = Math.max(g.maxY, y);
    g.area += 1;
    g.pixels.push(i);
  }
  const out = [];
  for (const g of groups.values()) {
    out.push({
      area: g.area,
      pixels: g.pixels,
      box: { x: g.minX, y: g.minY, w: g.maxX - g.minX + 1, h: g.maxY - g.minY + 1 }
    });
  }
  return out;
}

function componentVariance(work, comp) {
  const data = work.data;
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = comp.pixels;
  const n = pixels.length;
  if (!n) return 0;
  for (const i of pixels) {
    const p = i * 4;
    r += data[p];
    g += data[p + 1];
    b += data[p + 2];
  }
  const mr = r / n;
  const mg = g / n;
  const mb = b / n;
  comp.mean = { r: Math.round(mr), g: Math.round(mg), b: Math.round(mb) };
  let acc = 0;
  for (const i of pixels) {
    const p = i * 4;
    const dr = data[p] - mr;
    const dg = data[p + 1] - mg;
    const db = data[p + 2] - mb;
    acc += dr * dr + dg * dg + db * db;
  }
  return acc / n;
}

function globalVariance(work) {
  const data = work.data;
  const n = work.width * work.height;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (data[p + 3] < 16) continue;
    r += data[p];
    g += data[p + 1];
    b += data[p + 2];
    count += 1;
  }
  if (!count) return 0;
  const mr = r / count;
  const mg = g / count;
  const mb = b / count;
  let acc = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (data[p + 3] < 16) continue;
    const dr = data[p] - mr;
    const dg = data[p + 1] - mg;
    const db = data[p + 2] - mb;
    acc += dr * dr + dg * dg + db * db;
  }
  return acc / count;
}

function pixelLocalVar(work, x, y) {
  const { width: w, height: h, data } = work;
  const c = (y * w + x) * 4;
  let acc = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx;
      if (xx < 0 || xx >= w) continue;
      const p = (yy * w + xx) * 4;
      const dr = data[p] - data[c];
      const dg = data[p + 1] - data[c + 1];
      const db = data[p + 2] - data[c + 2];
      acc += dr * dr + dg * dg + db * db;
      n += 1;
    }
  }
  return n ? acc / n : 0;
}

function markComponent(used, w, comp) {
  for (const i of comp.pixels) used[i] = 1;
}

function mapBox(box, work, origW, origH) {
  const sx = origW / work.width;
  const sy = origH / work.height;
  return {
    x: Math.round(box.x * sx),
    y: Math.round(box.y * sy),
    w: Math.max(1, Math.round(box.w * sx)),
    h: Math.max(1, Math.round(box.h * sy))
  };
}

function areaOf(box) {
  return (Number(box?.w) || 0) * (Number(box?.h) || 0);
}

function rgbToHex(rgb = {}) {
  const h = (n) => Math.max(0, Math.min(255, Number(n) || 0)).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function isImageData(v) {
  return !!(v && typeof v === 'object' && Number(v.width) > 0 && Number(v.height) > 0 && v.data && v.data.length);
}

function toClamped(data) {
  if (data instanceof Uint8ClampedArray) return data;
  return new Uint8ClampedArray(data);
}

async function srcToBlob(src) {
  if (typeof fetch === 'function' && /^data:/i.test(src)) {
    return (await fetch(src)).blob();
  }
  const decoded = decodePngDataUrl(src);
  if (!decoded) throw new Error('blob');
  const raw = encodePngRgba(decoded);
  const comma = raw.indexOf(',');
  const bytes = decodeBase64(raw.slice(comma + 1));
  return new Blob([bytes], { type: 'image/png' });
}

function decodeBase64(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function pngSig() {
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crcSrc = out.subarray(4, 8 + data.length);
  writeU32(out, 8 + data.length, crc32(crcSrc));
  return out;
}

function zlibStore(raw) {
  const chunks = [];
  chunks.push(new Uint8Array([0x78, 0x01]));
  let off = 0;
  while (off < raw.length) {
    const n = Math.min(65535, raw.length - off);
    const last = off + n >= raw.length;
    const block = new Uint8Array(5 + n);
    block[0] = last ? 0x01 : 0x00;
    block[1] = n & 0xff;
    block[2] = (n >> 8) & 0xff;
    const nlen = n ^ 0xffff;
    block[3] = nlen & 0xff;
    block[4] = (nlen >> 8) & 0xff;
    block.set(raw.subarray(off, off + n), 5);
    chunks.push(block);
    off += n;
  }
  const ad = new Uint8Array(4);
  writeU32(ad, 0, adler32(raw));
  chunks.push(ad);
  return concat(chunks);
}

function inflateZlib(bytes) {
  if (bytes.length < 6) throw new Error('zlib short');
  const cmf = bytes[0];
  const flg = bytes[1];
  if ((cmf & 0x0f) !== 8) throw new Error('zlib cmf');
  let i = 2;
  if (flg & 0x20) i += 4;
  const out = [];
  for (;;) {
    if (i + 5 > bytes.length) throw new Error('zlib block');
    const hdr = bytes[i];
    const last = hdr & 1;
    const type = (hdr >> 1) & 3;
    if (type !== 0) throw new Error('zlib stored only');
    const len = bytes[i + 1] | (bytes[i + 2] << 8);
    i += 5;
    if (i + len > bytes.length) throw new Error('zlib len');
    for (let k = 0; k < len; k++) out.push(bytes[i + k]);
    i += len;
    if (last) break;
  }
  return new Uint8Array(out);
}

function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function writeU32(buf, i, v) {
  buf[i] = (v >>> 24) & 0xff;
  buf[i + 1] = (v >>> 16) & 0xff;
  buf[i + 2] = (v >>> 8) & 0xff;
  buf[i + 3] = v & 0xff;
}

function readU32(buf, i) {
  return ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
}

function adler32(data) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
