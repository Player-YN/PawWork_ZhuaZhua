/**
 * Paw Work Design / Slides engine document (SoT).
 * Node-safe: parse, compile, field-write, export — no DOM / tldraw runtime.
 *
 * { pawCanvas: 1, shell: 'design'|'slides', title, tldraw: { document: { store } } }
 */

import { exportPawCanvasPptx } from './pawCanvasPptxExport.js';
import { slideMotionMeta } from './slideMotion.js';
import {
  applyStoreCommands,
  canvasSelectionCheck,
  DECK_CAPABILITIES,
  DECK_OPS,
  defaultCanvasSize,
  isFieldOp as catalogIsFieldOp,
  mapTldrawAlign,
  mapTldrawColor,
  mapTldrawFont,
  mapTldrawSize,
  pinnedNodeIds
} from './canvasOps.js';
import { finiteCoord, placeFramesInStrip, resolveSlideFrameName, SLIDE_STRIP_ORIGIN } from './slidesLayout.js';
import { fillTldrawShapeProps, normalizeTldrawStore } from './tldrawShapeProps.js';

export {
  TEXT_OPS,
  IMAGE_OPS,
  EDITOR_OP_MAP,
  LIVE_ONLY_OPS,
  DECK_OPS,
  DECK_ACTS,
  DECK_CAPABILITIES,
  GEO_TYPES,
  SHAPE_TYPES,
  canvasSelectionCheck,
  editorMethodForOp,
  isLiveOnlyOp,
  mapTldrawColor,
  normalizeCanvasOp,
  pinnedNodeIds
} from './canvasOps.js';

export const PAW_CANVAS = 1;
export const DESIGN_ENTRY = 'design.html';

const PAGE_ID = 'page:page';
const DOC_ID = 'document:document';

export function isPawCanvasDoc(value) {
  const doc = typeof value === 'string' ? tryParseJson(value) : value;
  return !!(
    doc &&
    typeof doc === 'object' &&
    Number(doc.pawCanvas) === PAW_CANVAS &&
    doc.tldraw &&
    typeof doc.tldraw === 'object'
  );
}

export function parsePawCanvas(raw) {
  if (isPawCanvasDoc(raw) && typeof raw === 'object' && raw.pawCanvas) {
    return normalizeDoc(raw);
  }
  const obj = typeof raw === 'string' ? tryParseJson(raw) : raw;
  if (!isPawCanvasDoc(obj)) return null;
  return normalizeDoc(obj);
}

export function canvasKindFromDoc(doc) {
  const d = parsePawCanvas(doc);
  if (!d) return null;
  return d.shell === 'slides' ? 'deck' : 'poster';
}

export function previewEntryForCanvas() {
  return DESIGN_ENTRY;
}

export { DESIGN_CANVAS_SIZE, SLIDES_CANVAS_SIZE, defaultCanvasSize } from './canvasOps.js';

export function emptyPawCanvas(opts = {}) {
  const shell = opts.shell === 'slides' || opts.kind === 'deck' ? 'slides' : 'design';
  const title = String(opts.title || (shell === 'slides' ? 'Slides' : 'Design')).trim() || 'Design';
  const size = defaultCanvasSize(shell);
  const frameId = shapeId('frame');
  const store = baseStore();
  store[frameId] = frameShape(frameId, PAGE_ID, {
    x: 80,
    y: 80,
    w: size.w,
    h: size.h,
    name: title,
    index: 'a1'
  });
  return wrapDoc({ shell, title, store });
}

/**
 * Compile a host scene (createScene output) into a pawCanvas document.
 * @param {{ kind?: string, title?: string, nodes?: object[], frames?: object[], size?: {w:number,h:number} }} compiled
 */
export function compileSceneToPawCanvas(compiled = {}) {
  const kind = String(compiled.kind || '') === 'deck' ? 'deck' : 'poster';
  const shell = kind === 'deck' ? 'slides' : 'design';
  const title = String(compiled.title || (shell === 'slides' ? 'Slides' : 'Design')).trim() || 'Design';
  const frames = Array.isArray(compiled.frames) && compiled.frames.length
    ? compiled.frames
    : [
        {
          id: kind === 'deck' ? 'slide-1' : 'poster',
          name: title,
          nodes: compiled.nodes || [],
          size: compiled.size,
          frameBox: compiled.frameBox
        }
      ];
  const store = baseStore();
  const strip =
    shell === 'slides'
      ? placeFramesInStrip(
          frames.map((fr) => {
            const size = fr.size || compiled.size || defaultCanvasSize(shell);
            return {
              id: fr.id,
              w: fr.frameBox?.w || size.w,
              h: fr.frameBox?.h || size.h
            };
          })
        )
      : null;
  let index = 1;
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i] || {};
    const size = fr.size || compiled.size || defaultCanvasSize(shell);
    const box = strip
      ? strip[i]
      : fr.frameBox || {
          x: SLIDE_STRIP_ORIGIN.x + i * (Number(size.w) + 80),
          y: SLIDE_STRIP_ORIGIN.y,
          w: size.w,
          h: size.h
        };
    const fid = shapeId(String(fr.id || `frame${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '') || `frame${i + 1}`);
    store[fid] = frameShape(fid, PAGE_ID, {
      x: finiteCoord(box.x, SLIDE_STRIP_ORIGIN.x),
      y: finiteCoord(box.y, SLIDE_STRIP_ORIGIN.y),
      w: Number(box.w) || size.w,
      h: Number(box.h) || size.h,
      name:
        shell === 'slides'
          ? resolveSlideFrameName({ name: fr.name, title: fr.title, slots: fr.slots, index: i })
          : String(fr.name || fr.id || title),
      index: indexKey(index++),
      meta: {
        ...(fr.layoutId ? { pawLayout: fr.layoutId } : {}),
        ...(fr.themeId ? { pawTheme: fr.themeId } : {}),
        ...(fr.variant ? { pawVariant: fr.variant } : {}),
        ...(fr.notes ? { pawNotes: String(fr.notes) } : {}),
        ...slideMotionMeta(fr, { semantic: !!(fr.layoutId || fr.slots) })
      }
    });
    const nodes = Array.isArray(fr.nodes) ? fr.nodes : [];
    const semantic = !!(fr.layoutId || nodes.some((n) => n?.meta?.pawLayout));
    const sections = semantic ? [] : sectionizeNodes(nodes);
    if (semantic || sections.length <= 1) {
      for (const node of nodes) putNodeShape(store, fid, node, index++);
    } else {
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const ub = unionNodeBox(sec.nodes);
        const sid = shapeId(`sec-${String(fr.id || i)}-${s}`);
        store[sid] = frameShape(sid, fid, {
          x: ub.x,
          y: ub.y,
          w: ub.w,
          h: ub.h,
          name: sec.name,
          index: indexKey(index++)
        });
        for (const node of sec.nodes) {
          putNodeShape(store, sid, offsetNode(node, ub), index++);
        }
      }
    }
  }
  ensureNotCoverOnly(store, compiled);
  return wrapDoc({ shell, title, store, themeId: compiled.themeId });
}

/**
 * tldraw createShape payloads from a pawCanvas store (frames first, then children).
 * Preserves compiled node ids so the live editor can hydrate without a schema snapshot.
 */
export function shapesFromPawCanvas(doc) {
  const d = parsePawCanvas(doc);
  if (!d) return [];
  const store = getStore(d);
  const shapes = Object.values(store).filter((r) => r && r.typeName === 'shape' && r.type);
  const frames = shapes.filter((s) => s.type === 'frame');
  const rest = shapes.filter((s) => s.type !== 'frame');
  return [...frames, ...rest].map((rec) => {
    const payload = {
      id: rec.id,
      type: rec.type,
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0,
      rotation: Number(rec.rotation) || 0,
      props: rec.props && typeof rec.props === 'object' ? { ...rec.props } : {},
      meta: rec.meta && typeof rec.meta === 'object' ? { ...rec.meta } : {}
    };
    if (rec.parentId && String(rec.parentId).startsWith('shape:')) {
      payload.parentId = rec.parentId;
    }
    return payload;
  });
}

export function createPayloads(doc) {
  return shapesFromPawCanvas(doc);
}

export function assetsFromPawCanvas(doc) {
  return recordsFromPawCanvas(doc).assets;
}

/** Assets + createShape payloads. Synthesizes an image asset when the store only has props.url. */
export function recordsFromPawCanvas(doc) {
  const shapes = shapesFromPawCanvas(doc);
  const d = parsePawCanvas(doc);
  const store = d ? getStore(d) : {};
  const assets = [];
  const seen = new Set();
  for (const rec of Object.values(store)) {
    if (rec && rec.typeName === 'asset' && rec.id && !seen.has(rec.id)) {
      seen.add(rec.id);
      assets.push({
        id: rec.id,
        typeName: 'asset',
        type: rec.type || 'image',
        props: { ...(rec.props || {}) },
        meta: { ...(rec.meta || {}) }
      });
    }
  }
  const outShapes = [];
  for (const payload of shapes) {
    if (payload.type !== 'image') {
      outShapes.push(payload);
      continue;
    }
    const src = normalizeImageSrc(payload.meta?.src || payload.props?.url || payload.props?.src || '');
    let assetId = payload.props?.assetId;
    if (!assetId && src) {
      assetId = `asset:${String(payload.id || 'img').replace(/^shape:/, '')}`;
    }
    if (assetId && !seen.has(assetId)) {
      seen.add(assetId);
      const w = Number(payload.props?.w) || 320;
      const h = Number(payload.props?.h) || 200;
      assets.push({
        id: assetId,
        typeName: 'asset',
        type: 'image',
        props: {
          w,
          h,
          name: String(payload.meta?.pawId || assetId),
          isAnimated: false,
          mimeType: mimeFromSrc(src),
          src
        },
        meta: {}
      });
    }
    outShapes.push({
      ...payload,
      props: fillTldrawShapeProps('image', {
        w: Number(payload.props?.w) || 320,
        h: Number(payload.props?.h) || 200,
        playing: true,
        url: '',
        assetId: assetId || null,
        crop: payload.props?.crop ?? null,
        flipX: false,
        flipY: false,
        altText: String(payload.props?.altText || '')
      })
    });
  }
  return { assets, shapes: outShapes };
}

/** Protocol-relative URLs must not resolve against chrome-extension://. */
export function normalizeImageSrc(src) {
  const s = String(src || '').trim();
  if (!s || s === 'none' || s === 'undefined' || s === 'null') return '';
  if (s.startsWith('//') && !s.startsWith('///')) return `https:${s}`;
  return s;
}

export function isDisplayableImageSrc(src) {
  const s = normalizeImageSrc(src);
  return /^data:image\//i.test(s) || /^https?:\/\//i.test(s);
}

/** Bound handles / artifact:// / guest paths / blob — tldraw cannot paint these as-is. */
export function imageSrcNeedsHostPixels(src) {
  const s = normalizeImageSrc(src);
  if (!s || isDisplayableImageSrc(s)) return false;
  if (/^artifact:\/\//i.test(s)) return true;
  if (/^blob:/i.test(s)) return true;
  if (/^\/(?:artifacts|scratch)\//i.test(s) || /^(?:artifacts|scratch)\//i.test(s)) return true;
  if (/^wi_/i.test(s)) return true;
  if (/^(图片|image|img|screenshot|截图)\s*\d+$/i.test(s)) return true;
  return false;
}

export function summarizeImageSrc(src, max = 160) {
  const s = String(src || '');
  const mime = /^data:image\/([^;,]+)/i.exec(s);
  if (mime) return `data:image/${mime[1]};base64,… (${s.length} chars)`;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function unresolvedEngineImages(doc) {
  return listEngineNodes(doc).filter((n) => n.type === 'image' && imageSrcNeedsHostPixels(n.src));
}

function shapeImageSrc(rec, store) {
  const assetSrc = rec.props?.assetId ? String(store[rec.props.assetId]?.props?.src || '') : '';
  const candidates = [assetSrc, rec.meta?.src, rec.props?.url].map(normalizeImageSrc).filter(Boolean);
  return candidates.find((s) => isDisplayableImageSrc(s)) || candidates[0] || '';
}

async function resolveDisplayableSrc(raw, resolveRef) {
  const src = normalizeImageSrc(raw);
  if (!src || isDisplayableImageSrc(src)) return src;
  const resolved = await resolveRef(src);
  const next = normalizeImageSrc(resolved?.ok ? resolved.src : '');
  return isDisplayableImageSrc(next) ? next : '';
}

export async function hydratePawCanvasImages(doc, resolveRef) {
  const parsed = parsePawCanvas(doc);
  if (!parsed || typeof resolveRef !== 'function') return parsed;
  const store = structuredClone(getStore(parsed));
  for (const rec of Object.values(store)) {
    if (!rec || rec.typeName !== 'asset' || rec.type !== 'image') continue;
    const raw = String(rec.props?.src || rec.meta?.src || '').trim();
    if (!raw || isDisplayableImageSrc(raw)) {
      if (raw) rec.props = { ...(rec.props || {}), src: normalizeImageSrc(raw) };
      continue;
    }
    const next = await resolveDisplayableSrc(raw, resolveRef);
    if (next) rec.props = { ...(rec.props || {}), src: next, mimeType: mimeFromSrc(next) };
  }
  for (const rec of Object.values(store)) {
    if (!rec || rec.typeName !== 'shape' || rec.type !== 'image') continue;
    const raw = String(rec.meta?.src || rec.props?.url || '').trim();
    if (!raw || isDisplayableImageSrc(raw)) {
      if (raw) rec.meta = { ...(rec.meta || {}), src: normalizeImageSrc(raw) };
      continue;
    }
    const next = await resolveDisplayableSrc(raw, resolveRef);
    if (next) {
      rec.meta = { ...(rec.meta || {}), src: next };
      const aid = rec.props?.assetId;
      if (aid && store[aid]?.props) {
        store[aid].props.src = next;
        store[aid].props.mimeType = mimeFromSrc(next);
      }
    }
  }
  return wrapDoc({ shell: parsed.shell, title: parsed.title, store, schema: parsed.tldraw?.document?.schema });
}

function mimeFromSrc(src) {
  const s = String(src || '');
  if (/^data:image\/jpeg/i.test(s) || /\.jpe?g(\?|$)/i.test(s)) return 'image/jpeg';
  if (/^data:image\/webp/i.test(s) || /\.webp(\?|$)/i.test(s)) return 'image/webp';
  if (/^data:image\/gif/i.test(s) || /\.gif(\?|$)/i.test(s)) return 'image/gif';
  if (/^data:image\/svg/i.test(s) || /\.svg(\?|$)/i.test(s)) return 'image/svg+xml';
  return 'image/png';
}

export function looksLikeVisualHtml(text) {
  const s = String(text || '');
  if (/data-paw-kind\s*=\s*["'](poster|deck)["']/i.test(s)) return true;
  if (/data-pawwork-preview\s*=\s*["']blocks["']/i.test(s) && /data-paw-slot\s*=/i.test(s)) return true;
  return false;
}

export function shellFromArtifactText(text, fallback = 'design') {
  const s = String(text || '');
  if (/"shell"\s*:\s*"slides"/i.test(s) || /data-paw-kind\s*=\s*["']deck["']/i.test(s)) return 'slides';
  if (/"shell"\s*:\s*"design"/i.test(s) || /data-paw-kind\s*=\s*["']poster["']/i.test(s)) return 'design';
  return fallback === 'slides' ? 'slides' : 'design';
}

export function listEngineNodes(doc) {
  const d = parsePawCanvas(doc);
  if (!d) return [];
  const store = getStore(d);
  const out = [];
  for (const rec of Object.values(store)) {
    if (!rec || rec.typeName !== 'shape' || !rec.type) continue;
    const type = rec.type === 'geo' ? rec.props?.geo || 'rect' : rec.type;
    out.push({
      nodeId: rec.id,
      type: type === 'rectangle' ? 'rect' : type,
      pawType: String(rec.meta?.pawType || rec.meta?.pawKind || rec.type || ''),
      text: rec.type === 'frame' ? String(rec.props?.name || '') : shapeText(rec),
      src: rec.type === 'image' ? shapeImageSrc(rec, store) : '',
      parentId: rec.parentId,
      x: rec.x,
      y: rec.y,
      w: rec.props?.w,
      h: rec.props?.h,
      rotation: rec.rotation || 0,
      fill: rec.props?.color || rec.meta?.fill || '',
      font: rec.props?.font || '',
      size: rec.props?.size || '',
      geo: rec.props?.geo || '',
      dash: rec.props?.dash || '',
      align: rec.props?.textAlign || rec.props?.align || '',
      notes: String(rec.meta?.pawNotes || ''),
      opacity: rec.opacity,
      locked: rec.isLocked === true,
      hidden: Number(rec.opacity) === 0
    });
  }
  return out;
}

export function canvasReadModel(doc, selections = []) {
  const d = parsePawCanvas(doc);
  if (!d) return null;
  const nodes = listEngineNodes(d);
  const selected = pinnedNodeIds(selections);
  const frames = nodes
    .filter((n) => n.type === 'frame')
    .map((n) => ({
      nodeId: n.nodeId,
      name: n.text || 'Frame',
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      notes: n.notes || '',
      children: nodes.filter((c) => c.parentId === n.nodeId).map((c) => c.nodeId)
    }));
  const counts = {};
  for (const n of nodes) {
    const k = String(n.type || 'shape');
    counts[k] = (counts[k] || 0) + 1;
  }
  return {
    shell: d.shell,
    title: d.title,
    selected,
    frames,
    nodes,
    counts,
    ops: DECK_OPS,
    capabilities: DECK_CAPABILITIES,
    acts: ['read', 'write', 'export']
  };
}

export function compactCanvasOverview(doc, selections = []) {
  const model = canvasReadModel(doc, selections);
  if (!model) return null;
  return {
    shell: model.shell,
    title: model.title,
    selected: model.selected,
    frames: model.frames.map((f) => ({ nodeId: f.nodeId, name: f.name, w: f.w, h: f.h })),
    nodeCount: model.nodes.length,
    counts: model.counts
  };
}

export function fieldWriteNeedsNode(commands, selections) {
  const check = canvasSelectionCheck(commands, selections);
  return !check.ok && check.code === 'NEED_SELECTION';
}

/**
 * Apply field writes. Never invents a node. Missing nodeId → { ok:false, code:'NEED_SELECTION' }.
 */
export function applyEngineCommands(doc, commands, opts = {}) {
  const parsed = parsePawCanvas(doc);
  if (!parsed) return { ok: false, error: 'not a pawCanvas document' };
  const list = Array.isArray(commands) ? commands : [];
  const sel = canvasSelectionCheck(list, opts.selections);
  if (!sel.ok) {
    return {
      ok: false,
      code: sel.code,
      error: sel.error,
      available: listEngineNodes(parsed).map((n) => n.nodeId)
    };
  }
  const store = structuredClone(getStore(parsed));
  const result = applyStoreCommands(store, list, {
    selections: opts.selections,
    shell: parsed.shell
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      error: result.error,
      available: result.available || listEngineNodes(parsed).map((n) => n.nodeId),
      ...(result.qa ? { qa: result.qa, score: result.score, issues: result.issues } : {})
    };
  }
  const out = wrapDoc({
    shell: parsed.shell,
    title: parsed.title,
    store,
    schema: parsed.tldraw?.document?.schema,
    themeId: parsed.themeId
  });
  const lastId = result.lastIds?.[0] || '';
  const node = lastId ? listEngineNodes(out).find((n) => n.nodeId === lastId) : null;
  const nodes = lastId
    ? result.lastIds.map((id) => listEngineNodes(out).find((n) => n.nodeId === id)).filter(Boolean)
    : [];
  return {
    ok: true,
    doc: out,
    json: JSON.stringify(out),
    applied: result.applied,
    dirty: lastId,
    readback: {
      nodeId: lastId,
      nodeIds: result.lastIds || [],
      text: node?.text || '',
      src: node?.src || '',
      type: node?.type || '',
      box: node ? { x: node.x, y: node.y, w: node.w, h: node.h } : null,
      nodes
    },
    available: listEngineNodes(out).map((n) => n.nodeId),
    ...(result.qa ? { qa: result.qa } : {})
  };
}

export function exportPawCanvas(doc, format, opts = {}) {
  const d = parsePawCanvas(doc);
  if (!d) return { ok: false, error: 'not a pawCanvas document' };
  const fmt = String(format || '').toLowerCase();
  const stem = safeStem(d.title || d.shell || 'canvas');
  if (fmt === 'json') {
    const json = JSON.stringify(d);
    return { ok: true, filename: `${stem}.json`, mime: 'application/json', bytes: new TextEncoder().encode(json) };
  }
  if (fmt === 'png' || fmt === 'pdf' || fmt === 'svg') {
    return {
      ok: false,
      code: 'NEED_TAB',
      error: 'PNG / SVG / PDF export needs the open Design/Slides canvas (tldraw toImage)'
    };
  }
  if (fmt === 'pptx') {
    return exportPawCanvasPptx(d, opts);
  }
  if (fmt === 'html') {
    const html = htmlFromCanvas(d);
    return { ok: true, filename: `${stem}.html`, mime: 'text/html', bytes: new TextEncoder().encode(html) };
  }
  return { ok: false, error: `unsupported format: ${fmt}` };
}

export function tldrawSnapshotFromDoc(doc) {
  const d = parsePawCanvas(doc);
  if (!d) return null;
  return d.tldraw;
}

function tryParseJson(raw) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return null;
  }
}

function normalizeDoc(obj) {
  const shell = obj.shell === 'slides' || obj.kind === 'deck' ? 'slides' : 'design';
  const store = getStore(obj);
  const schema = obj.tldraw?.document?.schema || obj.tldraw?.schema || null;
  const themeId = String(obj.themeId || store?.['document:document']?.meta?.pawTheme || '').trim();
  return wrapDoc({ shell, title: obj.title || '', store: store || {}, schema, themeId });
}

function getStore(doc) {
  const tl = doc?.tldraw;
  if (tl?.document?.store && typeof tl.document.store === 'object') return tl.document.store;
  if (tl?.store && typeof tl.store === 'object') return tl.store;
  return {};
}

function wrapDoc({ shell, title, store, schema = null, themeId = '' }) {
  if (store && typeof store === 'object') normalizeTldrawStore(store);
  const document = { store };
  if (schema) document.schema = schema;
  const tid = String(themeId || store?.[DOC_ID]?.meta?.pawTheme || '').trim();
  if (tid && store?.[DOC_ID]) {
    store[DOC_ID].meta = { ...(store[DOC_ID].meta || {}), pawTheme: tid };
  }
  return {
    pawCanvas: PAW_CANVAS,
    shell,
    title: String(title || ''),
    ...(tid ? { themeId: tid } : {}),
    tldraw: { document }
  };
}

function baseStore() {
  return {
    [DOC_ID]: { id: DOC_ID, typeName: 'document', gridSize: 10, name: '', meta: {} },
    [PAGE_ID]: { id: PAGE_ID, typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }
  };
}

function shapeId(raw) {
  const s = String(raw || 'n').replace(/^shape:/, '');
  return `shape:${s}`;
}

function indexKey(n) {
  return `a${n.toString(36)}`;
}

function frameShape(id, parentId, { x, y, w, h, name, index, meta }) {
  return {
    id,
    typeName: 'shape',
    type: 'frame',
    x,
    y,
    rotation: 0,
    index,
    parentId,
    isLocked: false,
    opacity: 1,
    props: fillTldrawShapeProps('frame', { w, h, name: name || 'Frame' }),
    meta: meta && typeof meta === 'object' ? { ...meta } : {}
  };
}

function richText(text) {
  const t = String(text || '');
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] }]
  };
}

function isHeadingNode(node) {
  const t = String(node?.type || '');
  const tag = String(node?.tag || '');
  return t === 'headline' || t === 'heading' || /^h[1-6]$/i.test(tag);
}

function unionNodeBox(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes || []) {
    const b = n?.box;
    if (!b) continue;
    const x = Number(b.x) || 0;
    const y = Number(b.y) || 0;
    const w = Number(b.w) || 8;
    const h = Number(b.h) || 8;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!Number.isFinite(minX)) return { x: 16, y: 16, w: 400, h: 80 };
  return {
    x: minX,
    y: minY,
    w: Math.max(24, maxX - minX),
    h: Math.max(24, maxY - minY)
  };
}

function offsetNode(node, origin) {
  const b = node?.box;
  if (!b) return node;
  return {
    ...node,
    box: {
      ...b,
      x: (Number(b.x) || 0) - origin.x,
      y: (Number(b.y) || 0) - origin.y
    }
  };
}

function sectionizeNodes(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const sections = [];
  let cur = null;
  for (const n of list) {
    if (isHeadingNode(n) && cur && cur.nodes.length) {
      sections.push(cur);
      cur = { name: String(n.text || n.alt || 'Section').slice(0, 48) || 'Section', nodes: [n] };
      continue;
    }
    if (!cur) {
      cur = {
        name: isHeadingNode(n) ? String(n.text || 'Section').slice(0, 48) || 'Section' : 'Content',
        nodes: []
      };
    }
    if (isHeadingNode(n) && cur.nodes.length === 0) {
      cur.name = String(n.text || cur.name).slice(0, 48) || cur.name;
    }
    cur.nodes.push(n);
  }
  if (cur?.nodes.length) sections.push(cur);
  return sections;
}

function nodeRotation(node) {
  if (node?.degrees != null && node.degrees !== '') return (Number(node.degrees) * Math.PI) / 180;
  const n = Number(node?.rotation);
  return Number.isFinite(n) ? n : 0;
}

function putNodeShape(store, parentId, node, indexN) {
  const rawId = String(node.id || node.slotId || `n${indexN}`).replace(/[^a-zA-Z0-9_-]/g, '') || `n${indexN}`;
  const id = shapeId(rawId);
  const box = node.box || {};
  const x = Number(box.x) || 24;
  const y = Number(box.y) || 24;
  const w = Number(box.w) || (node.type === 'image' ? 320 : 560);
  const h = Number(box.h) || (node.type === 'image' ? 200 : 48);
  const index = indexKey(indexN);
  const rotation = nodeRotation(node);
  const isGeo =
    node.type === 'geo' ||
    node.type === 'color-block' ||
    node.type === 'shape' ||
    node.type === 'rect' ||
    !!node.geo;
  if (
    (isGeo || node.type === 'line' || node.type === 'arrow') &&
    !(node.type === 'image' || node.tag === 'img' || (node.src && !node.geo))
  ) {
    const fill = mapTldrawColor(node.fill || node.color) || 'light-blue';
    store[id] = {
      id,
      typeName: 'shape',
      type: 'geo',
      x,
      y,
      rotation,
      index,
      parentId,
      isLocked: false,
      opacity: node.opacity != null ? Number(node.opacity) : 1,
      props: fillTldrawShapeProps('geo', {
        w,
        h,
        geo: String(node.geo || 'rectangle'),
        color: fill,
        fill: node.fillKind || 'solid',
        dash: String(node.dash || (node.provenance === 'layout' ? 'solid' : 'draw')),
        size: 'm',
        font: mapTldrawFont(node.font) || 'sans',
        align: 'middle',
        verticalAlign: 'middle',
        richText: richText(String(node.text || ''))
      }),
      meta: mergeNodeMeta(node, { pawId: rawId, pawKind: 'geo', fill: node.fill || node.color || fill, pawRole: 'decoration' })
    };
    return;
  }
  if (node.type === 'image' || node.tag === 'img' || node.src) {
    const src = normalizeImageSrc(node.src || '');
    if (!src) return;
    const assetId = `asset:${rawId}`;
    store[assetId] = {
      id: assetId,
      typeName: 'asset',
      type: 'image',
      props: {
        w,
        h,
        name: rawId,
        isAnimated: false,
        mimeType: mimeFromSrc(src),
        src
      },
      meta: { pawId: rawId }
    };
    store[id] = {
      id,
      typeName: 'shape',
      type: 'image',
      x,
      y,
      rotation,
      index,
      parentId,
      isLocked: false,
      opacity: 1,
      props: fillTldrawShapeProps('image', {
        w,
        h,
        playing: true,
        url: '',
        assetId,
        crop: node.tldrawCrop || (node.crop && node.crop.topLeft ? node.crop : null),
        flipX: false,
        flipY: false,
        altText: String(node.alt || node.text || '')
      }),
      meta: mergeNodeMeta(node, { src, pawId: rawId, sourceBox: node.sourceBox || null, pawKind: node.type || 'image', pawRole: 'visual' })
    };
    return;
  }
  const text = String(node.text || '').trim();
  store[id] = {
    id,
    typeName: 'shape',
    type: 'text',
    x,
    y,
    rotation,
    index,
    parentId,
    isLocked: false,
    opacity: 1,
    props: fillTldrawShapeProps('text', {
      color: mapTldrawColor(node.color || node.fill) || 'black',
      size: mapTldrawSize(node.size) || (node.type === 'headline' || node.type === 'heading' ? 'xl' : 'm'),
      font: mapTldrawFont(node.font) || 'sans',
      textAlign: mapTldrawAlign(node.align || node.textAlign) || 'start',
      autoSize: false,
      scale: Number(node.scale) > 0 ? Number(node.scale) : 1,
      w,
      richText: richText(text)
    }),
    meta: mergeNodeMeta(node, { pawText: text, pawId: rawId, pawType: node.type || 'text', pawRole: 'ink' })
  };
}

function mergeNodeMeta(node, base) {
  const extra = node?.meta && typeof node.meta === 'object' ? node.meta : {};
  return { ...base, ...extra, pawId: extra.pawId || base.pawId };
}

function ensureNotCoverOnly(store, compiled) {
  if (compiled?.source === 'layout') return;
  const shapes = Object.values(store).filter((r) => r && r.typeName === 'shape' && r.type !== 'frame');
  const images = shapes.filter((s) => s.type === 'image');
  const texts = shapes.filter((s) => s.type === 'text');
  if (images.length === 1 && texts.length === 0 && String(compiled?.kind) !== 'deck') {
    const frame = Object.values(store).find((r) => r && r.type === 'frame');
    const parentId = frame?.id || PAGE_ID;
    const title = String(compiled?.title || 'Poster').trim() || 'Poster';
    const id = shapeId('headline');
    store[id] = {
      id,
      typeName: 'shape',
      type: 'text',
      x: 40,
      y: 40,
      rotation: 0,
      index: indexKey(99),
      parentId,
      isLocked: false,
      opacity: 1,
      props: fillTldrawShapeProps('text', {
        color: 'black',
        size: 'xl',
        font: 'sans',
        textAlign: 'start',
        autoSize: false,
        scale: 1,
        w: 640,
        richText: richText(title)
      }),
      meta: { pawText: title, pawId: 'headline', pawType: 'headline' }
    };
  }
}

function shapeText(rec) {
  if (rec.meta?.pawText) return String(rec.meta.pawText);
  if (rec.props?.name && rec.type === 'frame') return String(rec.props.name);
  if (typeof rec.props?.text === 'string') return rec.props.text;
  const rt = rec.props?.richText;
  if (rt && typeof rt === 'object') return extractRichText(rt);
  return '';
}

function extractRichText(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.text === 'string') return node.text;
  const kids = Array.isArray(node.content) ? node.content : [];
  return kids.map(extractRichText).join('');
}

function isFieldOp(op) {
  return catalogIsFieldOp(op);
}

function commandNodeId(cmd) {
  return String(cmd?.nodeId || cmd?.slotId || cmd?.slot || '').trim();
}

function pinnedNodeId(selections) {
  return pinnedNodeIds(selections)[0] || '';
}

function framesOf(doc) {
  const store = getStore(doc);
  return Object.values(store).filter((r) => r && r.typeName === 'shape' && r.type === 'frame');
}

function childrenOf(store, parentId) {
  return Object.values(store).filter((r) => r && r.typeName === 'shape' && r.parentId === parentId);
}

function framesToPlates(doc) {
  const store = getStore(doc);
  const frames = framesOf(doc);
  const list = frames.length ? frames : [{ id: PAGE_ID, props: { name: doc.title } }];
  return list.map((fr, i) => {
    const kids = childrenOf(store, fr.id);
    const parts = kids.map((k) => {
      if (k.type === 'image') {
        const src = k.props?.url || k.meta?.src || '';
        return src ? `<img src="${escapeAttr(src)}" alt="" />` : '';
      }
      const t = escapeHtml(shapeText(k));
      return t ? `<p>${t}</p>` : '';
    });
    const heading = escapeHtml(fr.props?.name || `Slide ${i + 1}`);
    return {
      id: String(fr.id || `slide-${i + 1}`),
      html: `<h1>${heading}</h1>${parts.join('')}`
    };
  });
}

function htmlFromCanvas(doc) {
  const plates = framesToPlates(doc);
  const inner = plates
    .map(
      (p) =>
        `<section data-plate="${escapeAttr(p.id)}" style="width:960px;min-height:540px;margin:24px auto;background:#fff;padding:32px">${p.html}</section>`
    )
    .join('\n');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${escapeHtml(doc.title)}</title></head><body>${inner}</body></html>`;
}

function safeStem(name) {
  return String(name || 'canvas')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
    .slice(0, 40) || 'canvas';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** Deterministic PNG whose pixels depend on snapshot text (Node zlib). */
function pngFromCanvas(doc) {
  const frames = framesOf(doc);
  const w = Math.max(64, Math.min(640, Math.round(Number(frames[0]?.props?.w) / 4) || 320));
  const h = Math.max(64, Math.min(640, Math.round(Number(frames[0]?.props?.h) / 4) || 240));
  const nodes = listEngineNodes(doc);
  const seed = hash32(nodes.map((n) => n.text || n.src || n.nodeId).join('|') + doc.title);
  const pixels = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    pixels[row] = 0;
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3;
      pixels[i] = (seed + x * 13 + y * 7) & 255;
      pixels[i + 1] = (seed >> 8) & 180;
      pixels[i + 2] = 240 - (y % 80);
    }
  }
  const compressed = zlibStore(pixels);
  const chunks = [pngSignature(), pngChunk('IHDR', ihdr(w, h)), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array(0))];
  return concat(chunks);
}

/** zlib-wrapped uncompressed DEFLATE (RFC1950/1951 stored blocks). Browser-safe. */
function zlibStore(bytes) {
  const chunks = [];
  chunks.push(new Uint8Array([0x78, 0x01]));
  const max = 65535;
  for (let i = 0; i < bytes.length; i += max) {
    const slice = bytes.subarray(i, Math.min(i + max, bytes.length));
    const last = i + max >= bytes.length ? 1 : 0;
    const len = slice.length;
    const nlen = (~len) & 0xffff;
    const head = new Uint8Array(5);
    head[0] = last;
    head[1] = len & 255;
    head[2] = (len >> 8) & 255;
    head[3] = nlen & 255;
    head[4] = (nlen >> 8) & 255;
    chunks.push(head, slice);
  }
  const adler = adler32(bytes);
  const tail = new Uint8Array(4);
  const v = new DataView(tail.buffer);
  v.setUint32(0, adler);
  chunks.push(tail);
  return concat(chunks);
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function pngSignature() {
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
}

function ihdr(w, h) {
  const b = new Uint8Array(13);
  const v = new DataView(b.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  b[8] = 8;
  b[9] = 2;
  return b;
}

function pngChunk(type, data) {
  const t = new TextEncoder().encode(type);
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  const body = concat([t, data]);
  const crc = crc32(body);
  const c = new Uint8Array(4);
  new DataView(c.buffer).setUint32(0, crc);
  return concat([len, body, c]);
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
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

function hash32(s) {
  let h = 2166136261;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pdfFromCanvas(doc) {
  const nodes = listEngineNodes(doc).filter((n) => n.type === 'text' || n.type === 'frame');
  const lines = nodes.map((n) => pdfEscape((n.text || n.nodeId).slice(0, 80))).filter(Boolean);
  if (!lines.length) lines.push(pdfEscape(doc.title || 'Canvas'));
  const cmds = ['BT /F1 12 Tf 50 780 Td'];
  for (const line of lines.slice(0, 40)) {
    cmds.push(`(${line}) Tj 0 -16 Td`);
  }
  cmds.push('ET');
  const stream = cmds.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj + '\n';
  }
  const xref = body.length;
  let xrefTable = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xrefTable += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xrefTable;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

function pdfEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
