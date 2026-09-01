/**
 * pawCanvas → editable PPTX. PptxGenJS is export-only (not an authoring engine).
 * tldraw store remains the SoT. Slide transitions and a narrow entrance preset
 * are injected as valid OOXML after shapes are finalized.
 */

import { PPTX_CONTENT_TYPE } from './pptxExport.js';
import { sortFramesForStrip } from './slidesLayout.js';
import {
  CJK_SANS_STACK,
  CJK_SERIF_STACK,
  DEFAULT_THEME_ID,
  getTheme,
  inferDocumentThemeId,
  resolveVariantTokens,
  themeNamedPalette
} from './themeCatalog.js';
import { motionFromFrameRecord, normalizeSlideMotion } from './slideMotion.js';
import {
  APP_EXAMPLE,
  inspectPawCanvasPptx,
  PPTX_SLIDE_EMU,
  readPptxText,
  unzipPptx,
  validatePawCanvasPptx,
  writePptxText,
  zipPptx
} from './pptxInspect.js';
import {
  PPTX_ANIMATION_SUPPORT,
  buildSlideTimingXml,
  insertSlideMotionXml,
  listAllCnvPrIds,
  listDrawableCnvPrIds,
  planSlideEntrance
} from './pptxAnimTiming.js';

export const PPTX_SLIDE_IN = Object.freeze({ w: 13.333333333333334, h: 7.5 });
export const NATIVE_PPTX_TYPES = new Set(['geo', 'text', 'image', 'arrow', 'line', 'note', 'frame', 'group']);
export const UNSUPPORTED_PPTX_TYPES = new Set([
  'draw',
  'highlight',
  'video',
  'embed',
  'bookmark',
  'highlights',
  'frame-label'
]);

export { PPTX_ANIMATION_SUPPORT };

const SIZE_PX = Object.freeze({ s: 16, m: 22, l: 28, xl: 36 });
const LINE_PT = Object.freeze({ s: 0.75, m: 1.25, l: 2, xl: 3 });
const PAGE_ID = 'page:page';
const DOC_ID = 'document:document';

const GEO_TO_SHAPE = Object.freeze({
  rectangle: 'rect',
  rect: 'rect',
  'rounded-rectangle': 'roundRect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  oval: 'ellipse',
  triangle: 'triangle',
  diamond: 'diamond',
  rhombus: 'diamond',
  hexagon: 'hexagon',
  pentagon: 'pentagon',
  octagon: 'octagon',
  star: 'star5',
  'arrow-right': 'rightArrow',
  'arrow-left': 'leftArrow',
  'arrow-up': 'upArrow',
  'arrow-down': 'downArrow',
  trapezoid: 'trapezoid',
  chevron: 'chevron',
  heart: 'heart',
  cloud: 'cloud',
  'x-box': 'rect',
  'check-box': 'rect'
});

export async function exportPawCanvasPptx(doc, opts = {}) {
  const d = opts.parsedDoc || doc;
  const store = getStore(d);
  if (!store || !Object.keys(store).length) {
    return { ok: false, error: 'not a pawCanvas document' };
  }
  const themeId = inferDocumentThemeId(d, store) || d.themeId || DEFAULT_THEME_ID;
  const frames = listSlideFrames(store);
  if (!frames.length) {
    return { ok: false, error: 'NO_CANVAS', code: 'NO_CANVAS' };
  }

  const unsupported = listUnsupported(store, frames);
  const material = unsupported.filter((s) => isMaterialUnsupported(s));
  const canRender = typeof opts.renderShape === 'function' || typeof opts.renderFrame === 'function';
  if (material.length && !canRender) {
    return {
      ok: false,
      code: opts.requireHost === false ? 'UNSUPPORTED_PPTX_SHAPES' : 'NEED_TAB',
      error: `unsupported tldraw shapes need a live Design renderer or native mapping: ${uniqueTypes(material).join(', ')}`,
      unsupported: uniqueTypes(material)
    };
  }

  const PptxGenJS = await loadPptxGenJS();
  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'PAW_WIDE_16X9', width: PPTX_SLIDE_IN.w, height: PPTX_SLIDE_IN.h });
  pres.layout = 'PAW_WIDE_16X9';
  pres.title = visibleTitle(d.title) || 'Paw Work';
  pres.author = 'Paw Work';
  pres.company = 'Paw Work';
  pres.subject = 'pawCanvas';

  const theme = getTheme(themeId) || getTheme(DEFAULT_THEME_ID);
  const palette = themeNamedPalette(themeId) || themeNamedPalette(DEFAULT_THEME_ID);
  const slidePlans = [];
  const warnings = [];

  for (const frame of frames) {
    const plan = await planSlide(store, frame, {
      themeId,
      theme,
      palette,
      opts,
      canRender,
      warnings
    });
    if (!plan.ok) return plan;
    slidePlans.push(plan);
    const slide = pres.addSlide();
    slide.background = { color: hex6(plan.bgHex) };
    if (plan.notes) slide.addNotes(plan.notes);
    for (const obj of plan.objects) {
      applyObject(pres, slide, obj);
    }
  }

  const raw = await pres.write({ outputType: 'uint8array' });
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const patched = postProcessPptx(bytes, slidePlans);
  for (const plan of slidePlans) {
    for (const w of plan.animationReport?.warnings || []) {
      warnings.push(`${plan.name || 'slide'}: ${w}`);
    }
  }
  const check = validatePawCanvasPptx(patched, {
    minSlides: frames.length,
    requireImages: slidePlans.some((s) => s.objects.some((o) => o.kind === 'image'))
  });
  if (!check.ok) {
    return {
      ok: false,
      error: check.error || 'PPTX validation failed',
      code: 'INVALID_PPTX',
      errors: check.errors
    };
  }

  const stem = safeStem(d.title || d.shell || 'canvas');
  return {
    ok: true,
    filename: `${stem}.pptx`,
    mime: PPTX_CONTENT_TYPE,
    bytes: patched,
    slideCount: slidePlans.length,
    themeId,
    warnings,
    animation: PPTX_ANIMATION_SUPPORT,
    animations: slidePlans.map((s) => s.animationReport),
    inspect: check.info
  };
}

export { inspectPawCanvasPptx, validatePawCanvasPptx };

export async function loadPptxGenJS() {
  if (loadPptxGenJS._mod) return loadPptxGenJS._mod;
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  let mod;
  if (isNode) {
    try {
      mod = await import('pptxgenjs');
    } catch {
      mod = await import('../adapters/vendor/pptxgen-loader.mjs');
    }
  } else {
    try {
      mod = await import('../adapters/vendor/pptxgen-loader.mjs');
    } catch {
      mod = await import('pptxgenjs');
    }
  }
  loadPptxGenJS._mod = mod.default || mod;
  return loadPptxGenJS._mod;
}

function getStore(doc) {
  const tl = doc?.tldraw;
  if (tl?.document?.store && typeof tl.document.store === 'object') return tl.document.store;
  if (tl?.store && typeof tl.store === 'object') return tl.store;
  return {};
}

function listSlideFrames(store) {
  const frames = Object.values(store).filter(
    (r) => r && r.typeName === 'shape' && r.type === 'frame' && isTopLevelFrame(store, r)
  );
  return sortFramesForStrip(frames);
}

function isTopLevelFrame(store, rec) {
  const parent = rec?.parentId;
  return !parent || parent === PAGE_ID || !String(parent).startsWith('shape:');
}

function descendantsOf(store, parentId) {
  const out = [];
  const walk = (pid) => {
    for (const rec of Object.values(store)) {
      if (!rec || rec.typeName !== 'shape' || rec.parentId !== pid) continue;
      out.push(rec);
      walk(rec.id);
    }
  };
  walk(parentId);
  return out;
}

function listUnsupported(store, frames) {
  const out = [];
  for (const fr of frames) {
    for (const rec of descendantsOf(store, fr.id)) {
      if (!NATIVE_PPTX_TYPES.has(rec.type) || UNSUPPORTED_PPTX_TYPES.has(rec.type)) {
        out.push(rec);
      }
    }
  }
  return out;
}

function isMaterialUnsupported(rec) {
  if (!rec) return false;
  if (UNSUPPORTED_PPTX_TYPES.has(rec.type)) return true;
  if (!NATIVE_PPTX_TYPES.has(rec.type) && rec.type !== 'group') return true;
  return false;
}

function uniqueTypes(list) {
  return [...new Set(list.map((r) => r.type || 'unknown'))];
}

async function planSlide(store, frame, ctx) {
  const variant = String(frame.meta?.pawVariant || '').trim();
  const tokens = resolveVariantTokens(ctx.theme, variant);
  const bgHex = tokens.bg || ctx.theme.paper || '#F7F4EE';
  const motion = motionFromFrameRecord(frame);
  const kids = descendantsOf(store, frame.id);
  const objects = [];
  const fw = Number(frame.props?.w) || 1920;
  const fh = Number(frame.props?.h) || 1080;
  const frameBox = { x: 0, y: 0, w: fw, h: fh };

  for (const rec of kids) {
    if (rec.opacity === 0 || rec.meta?.hidden) continue;
    if (rec.type === 'group') continue;
    const box = frameRelativeBox(store, rec, frame);
    if (rec.type === 'frame') {
      if (isSlidePaper(box, frameBox, rec.meta?.pawRole)) continue;
      pushObject(objects, geoObject(box, rec, ctx, { rounded: true, skipEmptyName: true }));
      continue;
    }
    if (!NATIVE_PPTX_TYPES.has(rec.type) || UNSUPPORTED_PPTX_TYPES.has(rec.type)) {
      const fallback = await rasterFallback(rec, box, ctx);
      if (fallback) pushObject(objects, fallback);
      continue;
    }
    if (rec.type === 'image') {
      const img = await imageObject(store, rec, box, ctx);
      if (img) pushObject(objects, img);
      continue;
    }
    if (rec.type === 'line' || rec.type === 'arrow') {
      pushObject(objects, connectorObject(store, rec, frame, ctx));
      continue;
    }
    if (rec.type === 'note') {
      pushObject(objects, noteObject(box, rec, ctx));
      continue;
    }
    if (rec.type === 'geo') {
      if (isSlidePaper(box, frameBox, rec.meta?.pawRole)) continue;
      pushObject(objects, geoObject(box, rec, ctx, {}));
      continue;
    }
    if (rec.type === 'text') {
      const text = shapeText(rec);
      if (!visibleText(text)) continue;
      pushObject(objects, textObject(box, rec, text, ctx));
    }
  }

  if (objects.length < 1) {
    return { ok: false, error: 'slide would be empty', code: 'EMPTY_SLIDE' };
  }

  return {
    ok: true,
    name: visibleTitle(frame.props?.name || frame.meta?.pawSlot || `Slide ${objects.length}`),
    notes: visibleNotes(frame.meta?.pawNotes),
    bgHex,
    motion,
    objects,
    themeId: ctx.themeId,
    variant,
    animationReport: { preset: motion.animation?.preset || 'none', targets: [], warnings: [] }
  };
}

function pushObject(objects, obj) {
  if (!obj) return;
  obj.meta = { ...(obj.meta || {}), sourceOrder: objects.length };
  obj.objectName = obj.objectName || `Paw ${objects.length + 1}`;
  objects.push(obj);
}

function applyObject(pres, slide, obj) {
  const named = { objectName: obj.objectName || `Paw ${Number(obj.meta?.sourceOrder) + 1 || 1}` };
  if (obj.kind === 'shape') {
    if (obj.text) {
      slide.addText(obj.text, {
        shape: shapeEnum(pres, obj.preset),
        ...obj.box,
        ...obj.textStyle,
        fill: obj.fill,
        line: obj.line,
        rectRadius: obj.rectRadius,
        ...named
      });
      return;
    }
    slide.addShape(shapeEnum(pres, obj.preset), {
      ...obj.box,
      fill: obj.fill,
      line: obj.line,
      rectRadius: obj.rectRadius,
      ...named
    });
    return;
  }
  if (obj.kind === 'text') {
    slide.addText(obj.text, {
      ...obj.box,
      ...obj.textStyle,
      ...named
    });
    return;
  }
  if (obj.kind === 'image' && obj.data) {
    const payload = {
      data: obj.data,
      ...obj.box,
      ...named
    };
    if (obj.sizing) payload.sizing = obj.sizing;
    slide.addImage(payload);
    return;
  }
  if (obj.kind === 'line') {
    slide.addShape(pres.ShapeType.line, {
      ...obj.box,
      line: obj.line,
      flipH: obj.flipH,
      flipV: obj.flipV,
      ...named
    });
  }
}

function shapeEnum(pres, preset) {
  const key = String(preset || 'rect');
  return pres.ShapeType?.[key] || pres.shapes?.[key] || key;
}

function geoObject(box, rec, ctx, extra = {}) {
  const geo = String(rec.props?.geo || 'rectangle');
  const preset = extra.rounded && geo === 'rectangle' ? 'roundRect' : GEO_TO_SHAPE[geo] || 'rect';
  const colorName = rec.props?.color || 'black';
  const hex = resolvePaint(colorName, rec, ctx);
  const fillKind = String(rec.props?.fill || 'solid');
  const text = shapeText(rec);
  const hasText = visibleText(text);
  return {
    kind: 'shape',
    preset,
    box: toInches(box, rec, extra.parent),
    fill: fillKind === 'none' ? { type: 'none' } : { color: hex6(hex), transparency: fillKind === 'semi' ? 35 : 0 },
    line: lineStyle(rec, ctx, hex),
    rectRadius: preset === 'roundRect' ? 0.08 : undefined,
    text: hasText ? text : '',
    textStyle: hasText ? textStyle(rec, text, ctx, { valign: rec.props?.verticalAlign || 'middle' }) : undefined,
    meta: shapeMeta(rec)
  };
}

function textObject(box, rec, text, ctx) {
  const h = estimateTextHeight(box, rec, text);
  return {
    kind: 'text',
    box: toInches({ ...box, h }, rec),
    text,
    textStyle: textStyle(rec, text, ctx, { valign: 'top' }),
    meta: shapeMeta(rec)
  };
}

function noteObject(box, rec, ctx) {
  const text = shapeText(rec);
  const hex = resolvePaint(rec.props?.color || 'yellow', rec, ctx);
  return {
    kind: 'shape',
    preset: 'roundRect',
    box: toInches(box, rec),
    fill: { color: hex6(hex) },
    line: { color: hex6(hex), width: 0.5 },
    rectRadius: 0.06,
    text: visibleText(text) ? text : '',
    textStyle: visibleText(text) ? textStyle(rec, text, ctx, { valign: 'top' }) : undefined,
    meta: shapeMeta(rec)
  };
}

function connectorObject(store, rec, frame, ctx) {
  const start = rec.props?.start || { x: 0, y: 0 };
  const end = rec.props?.end || { x: Number(rec.props?.w) || 80, y: Number(rec.props?.h) || 0 };
  const origin = frameRelativeBox(store, rec, frame);
  const x1 = origin.x + (Number(start.x) || 0);
  const y1 = origin.y + (Number(start.y) || 0);
  const x2 = origin.x + (Number(end.x) || 0);
  const y2 = origin.y + (Number(end.y) || 0);
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const w = Math.max(2, Math.abs(x2 - x1));
  const h = Math.max(2, Math.abs(y2 - y1));
  const hex = resolvePaint(rec.props?.color || 'black', rec, ctx);
  const heads = rec.type === 'arrow' || rec.props?.arrowheadEnd || rec.props?.arrowheadStart;
  return {
    kind: 'line',
    box: toInches({ x: left, y: top, w, h }, rec),
    flipH: x2 < x1,
    flipV: y2 < y1,
    line: {
      color: hex6(hex),
      width: LINE_PT[rec.props?.size] || 1.25,
      dashType: dashType(rec.props?.dash),
      endArrowType: heads ? 'triangle' : undefined,
      beginArrowType: rec.props?.arrowheadStart && rec.props.arrowheadStart !== 'none' ? 'triangle' : undefined
    },
    meta: shapeMeta(rec)
  };
}

async function imageObject(store, rec, box, ctx) {
  const resolved = await resolveImage(store, rec, ctx.opts);
  if (!resolved?.data) {
    ctx.warnings.push(`missing image ${rec.id}`);
    return null;
  }
  const inches = toInches(box, rec);
  const fit = String(rec.meta?.fit || rec.props?.fit || 'contain').toLowerCase();
  return {
    kind: 'image',
    data: resolved.data,
    box: inches,
    sizing: {
      type: fit === 'cover' ? 'cover' : 'contain',
      w: inches.w,
      h: inches.h
    },
    meta: shapeMeta(rec)
  };
}

async function rasterFallback(rec, box, ctx) {
  try {
    let bytes;
    if (typeof ctx.opts.renderShape === 'function') {
      bytes = await ctx.opts.renderShape(rec.id);
    } else if (typeof ctx.opts.renderFrame === 'function') {
      bytes = await ctx.opts.renderFrame(rec.parentId || rec.id);
    }
    if (!bytes?.byteLength) return null;
    return {
      kind: 'image',
      data: bytesToDataUrl(bytes, 'image/png'),
      box: toInches(box, rec),
      meta: shapeMeta(rec)
    };
  } catch {
    return null;
  }
}

async function resolveImage(store, rec, opts = {}) {
  const asset = store[rec.props?.assetId];
  const src = String(rec.meta?.src || rec.props?.url || asset?.props?.src || '').trim();
  if (opts.resolveAsset) {
    const hit = await opts.resolveAsset(src, rec, asset);
    if (hit?.data || hit?.bytes) {
      return normalizeResolved(hit);
    }
  }
  if (/^data:/i.test(src)) return decodeDataUrl(src);
  if (typeof opts.readBytes === 'function' && src) {
    const hit = await opts.readBytes(src);
    if (hit) return normalizeResolved(hit);
  }
  if (opts.fs && src.startsWith('/')) {
    try {
      const bytes = opts.fs.readFileBytes?.(src);
      if (bytes?.byteLength) return { data: bytesToDataUrl(bytes, guessMime(src, bytes)), mime: guessMime(src, bytes) };
    } catch {
      /* missing artifact */
    }
  }
  return null;
}

function normalizeResolved(hit) {
  if (!hit) return null;
  if (typeof hit === 'string' && /^data:/i.test(hit)) return decodeDataUrl(hit);
  if (hit.data && typeof hit.data === 'string') return { data: hit.data, mime: hit.mime };
  if (hit.bytes?.byteLength) {
    return { data: bytesToDataUrl(hit.bytes, hit.mime || 'image/png'), mime: hit.mime || 'image/png' };
  }
  return null;
}

function decodeDataUrl(src) {
  const raw = String(src || '').trim();
  const m = /^data:([^,]*),(.*)$/i.exec(raw);
  if (!m) return null;
  const header = m[1] || '';
  const body = m[2] || '';
  const mime = header.split(';')[0] || 'image/png';
  if (/base64/i.test(header)) {
    return { data: `data:${mime};base64,${body}`, mime };
  }
  try {
    const decoded = decodeURIComponent(body);
    return { data: bytesToDataUrl(new TextEncoder().encode(decoded), mime), mime };
  } catch {
    return { data: raw, mime };
  }
}

function bytesToDataUrl(bytes, mime) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(u8).toString('base64');
  return `data:${mime || 'image/png'};base64,${b64}`;
}

function guessMime(src, bytes) {
  if (/\.svg(\?|$)/i.test(src) || (bytes && bytes[0] === 0x3c)) return 'image/svg+xml';
  if (/\.jpe?g(\?|$)/i.test(src)) return 'image/jpeg';
  return 'image/png';
}

function pageBox(store, rec) {
  let x = Number(rec.x) || 0;
  let y = Number(rec.y) || 0;
  let parent = store[rec.parentId];
  const seen = new Set();
  while (parent && parent.typeName === 'shape' && !seen.has(parent.id)) {
    seen.add(parent.id);
    x += Number(parent.x) || 0;
    y += Number(parent.y) || 0;
    parent = store[parent.parentId];
  }
  return {
    x,
    y,
    w: Number(rec.props?.w) || 0,
    h: Number(rec.props?.h) || 0
  };
}

function frameRelativeBox(store, rec, frame) {
  const page = pageBox(store, rec);
  const origin = pageBox(store, frame);
  return {
    x: page.x - origin.x,
    y: page.y - origin.y,
    w: page.w,
    h: page.h
  };
}

function toInches(box, rec) {
  const sx = PPTX_SLIDE_IN.w / 1920;
  const sy = PPTX_SLIDE_IN.h / 1080;
  const rot = Number(rec?.rotation) || 0;
  const out = {
    x: Math.round(box.x * sx * 10000) / 10000,
    y: Math.round(box.y * sy * 10000) / 10000,
    w: Math.max(0.04, Math.round(box.w * sx * 10000) / 10000),
    h: Math.max(0.04, Math.round((box.h || 24) * sy * 10000) / 10000)
  };
  if (rot) out.rotate = (rot * 180) / Math.PI;
  return out;
}

function isSlidePaper(box, frameBox, role) {
  const r = String(role || '');
  if (r !== 'bg' && r !== 'paper') return false;
  return box.x <= 4 && box.y <= 4 && box.w >= frameBox.w * 0.94 && box.h >= frameBox.h * 0.94;
}

function resolvePaint(colorName, rec, ctx) {
  const metaFill = String(rec?.meta?.fill || rec?.meta?.color || '').trim();
  if (/^#?[0-9a-fA-F]{3,8}$/.test(metaFill)) return normalizeHex(metaFill);
  const named = String(colorName || rec?.props?.color || '').trim();
  if (ctx.palette && ctx.palette[named]) return ctx.palette[named];
  if (/^#/.test(named)) return normalizeHex(named);
  const tokens = resolveVariantTokens(ctx.theme, rec?.meta?.pawVariant || ctx.variant);
  const role = String(rec?.meta?.pawRole || '').toLowerCase();
  if (role === 'muted') return tokens.muted;
  if (role === 'accent') return tokens.accent;
  if (role === 'accent2' || role === 'decoration') return tokens.accent2;
  if (role === 'card' || role === 'surface') return tokens.card;
  if (role === 'bg' || role === 'paper') return tokens.bg;
  return tokens.ink || ctx.theme.ink || '#161616';
}

function normalizeHex(raw) {
  let h = String(raw || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#161616';
  return `#${h.toUpperCase()}`;
}

function hex6(hex) {
  return String(hex || '161616').replace('#', '').toUpperCase();
}

function lineStyle(rec, ctx, fillHex) {
  const dash = String(rec.props?.dash || 'solid');
  const fillKind = String(rec.props?.fill || 'solid');
  if (fillKind !== 'none' && dash === 'solid') {
    return { color: hex6(fillHex), width: 0 };
  }
  return {
    color: hex6(fillHex),
    width: LINE_PT[rec.props?.size] || 1,
    dashType: dashType(dash)
  };
}

function dashType(dash) {
  const d = String(dash || 'solid');
  if (d === 'dashed') return 'dash';
  if (d === 'dotted') return 'dot';
  return 'solid';
}

function textStyle(rec, text, ctx, extra = {}) {
  const sizeKey = rec.props?.size || 'm';
  const scale = Number(rec.props?.scale) > 0 ? Number(rec.props.scale) : 1;
  const px = (SIZE_PX[sizeKey] || 22) * scale;
  const pt = Math.max(8, Math.round(px * 0.5));
  const color = resolvePaint(rec.props?.color || 'black', rec, ctx);
  const align = mapAlign(rec.props?.textAlign || rec.props?.align);
  const font = rec.props?.font || ctx.theme.font || 'sans';
  const bold = isBold(rec, text);
  return {
    fontSize: pt,
    fontFace: fontFace(font),
    color: hex6(color),
    align,
    valign: extra.valign === 'middle' || extra.valign === 'center' ? 'middle' : extra.valign === 'bottom' ? 'bottom' : 'top',
    bold,
    wrap: true,
    fit: 'shrink',
    margin: 0,
    paraSpaceAfter: 0
  };
}

function fontFace(font) {
  if (font === 'serif') return firstFace(CJK_SERIF_STACK, 'Georgia');
  if (font === 'mono') return 'Consolas';
  if (font === 'draw') return firstFace(CJK_SANS_STACK, 'Calibri');
  return firstFace(CJK_SANS_STACK, 'Microsoft YaHei');
}

function firstFace(stack, fallback) {
  const m = /'([^']+)'/.exec(String(stack || ''));
  return m?.[1] || fallback;
}

function mapAlign(value) {
  const s = String(value || 'start');
  if (s === 'middle' || s === 'center') return 'center';
  if (s === 'end' || s === 'right') return 'right';
  if (s === 'justify') return 'justify';
  return 'left';
}

function isBold(rec, text) {
  void text;
  const role = String(rec?.meta?.pawRole || rec?.meta?.pawSlot || '').toLowerCase();
  if (role === 'title' || role === 'kicker' || rec?.meta?.pawType === 'headline') return true;
  return richBold(rec?.props?.richText);
}

function richBold(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node.marks) && node.marks.some((m) => /bold|strong/i.test(m?.type || ''))) return true;
  if (Number(node.styles?.fontWeight) >= 600) return true;
  return (node.content || []).some(richBold);
}

function estimateTextHeight(box, rec, text) {
  if (Number(box.h) > 8) return box.h;
  const scale = Number(rec.props?.scale) > 0 ? Number(rec.props.scale) : 1;
  const px = (SIZE_PX[rec.props?.size] || 22) * scale;
  const lines = Math.max(1, String(text || '').split('\n').length);
  const wrap = Math.max(1, Math.ceil((String(text || '').length * px * 0.55) / Math.max(box.w, 40)));
  return Math.max(px * 1.35 * Math.max(lines, wrap), px * 1.4);
}

function shapeText(rec) {
  if (rec?.meta?.pawText) return String(rec.meta.pawText);
  if (typeof rec?.props?.text === 'string') return rec.props.text;
  return extractRichText(rec?.props?.richText);
}

function extractRichText(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.text === 'string') return node.text;
  return (node.content || []).map(extractRichText).join('');
}

function visibleText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (APP_EXAMPLE.test(t) && t === 'app.example') return false;
  return true;
}

function visibleTitle(text) {
  const t = String(text || '').trim();
  if (!t || APP_EXAMPLE.test(t)) return '';
  return t;
}

function visibleNotes(text) {
  const t = String(text || '').trim();
  if (!t || APP_EXAMPLE.test(t)) return '';
  return t;
}

function safeStem(name) {
  return (
    String(name || 'canvas')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
      .slice(0, 40) || 'canvas'
  );
}

function shapeMeta(rec) {
  return {
    sourceId: rec?.id || '',
    pawRole: String(rec?.meta?.pawRole || '').toLowerCase(),
    pawSlot: String(rec?.meta?.pawSlot || '').toLowerCase()
  };
}

function postProcessPptx(bytes, plans) {
  const files = unzipPptx(bytes);
  let pres = readPptxText(files, 'ppt/presentation.xml');
  pres = pres.replace(
    /<p:sldSz\b[^/]*\/?>/,
    `<p:sldSz cx="${PPTX_SLIDE_EMU.cx}" cy="${PPTX_SLIDE_EMU.cy}"/>`
  );
  const notesMaster = /<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/.exec(pres);
  if (notesMaster && pres.indexOf('<p:notesMasterIdLst>') > pres.indexOf('<p:sldIdLst>')) {
    pres = pres.replace(notesMaster[0], '');
    if (pres.includes('</p:sldMasterIdLst>')) {
      pres = pres.replace('</p:sldMasterIdLst>', `</p:sldMasterIdLst>${notesMaster[0]}`);
    }
  }
  writePptxText(files, 'ppt/presentation.xml', pres);

  plans.forEach((plan, i) => {
    const key = `ppt/slides/slide${i + 1}.xml`;
    let xml = readPptxText(files, key);
    if (!xml) return;
    const name = escapeXml(plan.name || `Slide ${i + 1}`);
    xml = xml.replace(/<p:cSld(\s[^>]*)?>/, (full, attrs = '') => {
      if (/\bname=/.test(attrs)) return `<p:cSld${attrs.replace(/\bname="[^"]*"/, `name="${name}"`)}>`;
      return `<p:cSld name="${name}"${attrs}>`;
    });
    xml = xml.replace(
      /<p:grpSpPr>\s*<a:xfrm>\s*<a:off x="0" y="0"\/>\s*<a:ext cx="0" cy="0"\/>\s*<a:chOff x="0" y="0"\/>\s*<a:chExt cx="0" cy="0"\/>\s*<\/a:xfrm>/,
      `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${PPTX_SLIDE_EMU.cx}" cy="${PPTX_SLIDE_EMU.cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${PPTX_SLIDE_EMU.cx}" cy="${PPTX_SLIDE_EMU.cy}"/></a:xfrm>`
    );
    const t = plan.motion?.transition || normalizeSlideMotion({}, { semantic: true }).transition;
    const trans = t.type !== 'none' ? transitionXml(t) : '';
    const preset = plan.motion?.animation?.preset || 'none';
    const shapeIds = listDrawableCnvPrIds(xml);
    const entrance = planSlideEntrance(plan.objects, shapeIds, preset);
    const slideIds = new Set(listAllCnvPrIds(xml));
    const dangling = entrance.targets.filter((tg) => !slideIds.has(tg.spid));
    if (dangling.length) {
      entrance.warnings.push(`timing skipped: ${dangling.length} target(s) missing from slide cNvPr`);
      entrance.preset = 'none';
      entrance.groups = [];
      entrance.targets = [];
    }
    plan.animationReport = {
      preset: entrance.preset,
      targets: entrance.targets,
      warnings: entrance.warnings
    };
    xml = insertSlideMotionXml(xml, {
      transitionXml: trans,
      timingXml: buildSlideTimingXml(entrance)
    });
    xml = ensureSlideP14(xml);
    writePptxText(files, key, xml);
  });
  return zipPptx(files);
}

function ensureSlideP14(xml) {
  return String(xml || '').replace(/<p:sld\b([^>]*)>/, (full, attrs = '') => {
    let a = attrs;
    if (!/xmlns:p14=/.test(a)) a += ' xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"';
    if (!/xmlns:mc=/.test(a)) a += ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
    if (!/mc:Ignorable=/.test(a)) a += ' mc:Ignorable="p14"';
    else if (!/\bp14\b/.test(/mc:Ignorable="([^"]*)"/.exec(a)?.[1] || '')) {
      a = a.replace(/mc:Ignorable="([^"]*)"/, (m, v) => `mc:Ignorable="${v} p14"`);
    }
    return `<p:sld${a}>`;
  });
}

function transitionXml(t) {
  const dur = Math.max(0, Number(t.durationMs) || 350);
  const inner = t.type === 'push' ? '<p:push dir="l"/>' : t.type === 'wipe' ? '<p:wipe dir="l"/>' : '<p:fade/>';
  return `<p:transition spd="med" p14:dur="${dur}" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${inner}</p:transition>`;
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

void DOC_ID;
