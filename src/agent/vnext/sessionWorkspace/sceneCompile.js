/**
 * Host compile: page HTML / selection fragments / node list → scene graph,
 * then serialize to marked artboard HTML (view). Not model-authored HTML.
 */

import {
  escapeHtml,
  formatBox,
  serializeMarkedHtml,
  parseMarkedHtml,
  parseBox,
  defaultPasteboardBox
} from './htmlApply.js';
import {
  compileSceneToPawCanvas,
  DESIGN_CANVAS_SIZE,
  isPawCanvasDoc,
  looksLikeVisualHtml,
  normalizeImageSrc,
  parsePawCanvas,
  SLIDES_CANVAS_SIZE
} from './engineCanvas.js';
import { isRasterCompileInput, rasterItemRef, rasterRegions } from './rasterCompile.js';
import { resolveRasterScanNodes } from './rasterScan.js';
import { compileLayoutFrame, isSemanticFrame } from './layoutCompile.js';
import { getLayout } from './layoutCatalog.js';
import { placeFramesInStrip, resolveSlideFrameName } from './slidesLayout.js';

/**
 * Default paper = the engine defaults (empty canvas / createFrame), one truth
 * (HANDOFF item 28). The model may pass any size / frames[] — paper choice is
 * model judgment; the host only lays out at whatever size was chosen.
 */
export const POSTER_SIZE = { ...DESIGN_CANVAS_SIZE };
export const DECK_SIZE = { ...SLIDES_CANVAS_SIZE };

/** Layout constants below were tuned at these widths; scale them to the paper. */
const LAYOUT_TUNED_W = { poster: 720, deck: 960 };

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link']);

const SCENE_CREATE_OPS = new Set([
  'createScene',
  'fromPage',
  'fromSelection',
  'fromRaster',
  'fromImage',
  'page',
  'raster'
]);

const MAX_LEAVES = 80;

/**
 * @param {object} [input]
 * @returns {{ ok: boolean, html?: string, kind?: string, nodes?: object[], source?: string, error?: string }}
 */
export function createScene(input = {}) {
  const raw = unwrapSceneCreateInput(input);
  const op = String(raw.op || raw.source || '').trim();
  const kind = inferSceneKind(raw);
  const title = String(raw.title || raw.name || '').trim();
  const size = sizeFromInput(raw);
  const fragments = raw.fragments || raw.items;
  const hasFragments = Array.isArray(fragments) && fragments.length > 0;
  if (Array.isArray(raw.frames) && raw.frames.length) {
    const compiled = compileFrameList(raw.frames, { kind, title, size, themeId: raw.themeId });
    if (compiled.ok === false) return compiled;
    if (compiled.frames?.length && !compiled.frames.some(frameHasContent)) {
      return { ok: false, error: 'createScene frames have no nodes' };
    }
    return sceneToResult(compiled);
  }
  if (isRasterCompileInput(raw) || (rasterItemRef(raw) && rasterRegions(raw).length && !raw.html && op !== 'fromPage' && op !== 'fromSelection')) {
    return sceneToResult(compileRasterScene(raw, { kind, title, size }));
  }
  if (op === 'fromSelection' || (hasFragments && !raw.html && op !== 'fromPage' && op !== 'page')) {
    const compiled = compileSelectionFragments(fragments, { kind, title, size });
    return sceneToResult(compiled);
  }
  if (Array.isArray(raw.nodes) && raw.nodes.length) {
    const compiled = compileNodeList(raw.nodes, { kind, title: title || 'Scene', size });
    return sceneToResult(compiled);
  }
  const html = raw.html || raw.content || '';
  if (html && /data-paw-slot\s*=/i.test(html)) {
    const compiled = compileMarkedSlots(html, { kind, title, size });
    if (compiled.nodes.length) return sceneToResult(compiled);
  }
  if (html || op === 'fromPage' || op === 'page') {
    if (!String(html || '').trim() && (op === 'fromPage' || op === 'page')) {
      return { ok: false, error: 'fromPage needs html' };
    }
    if (!String(html || '').trim()) {
      return { ok: false, error: 'createScene needs html, fragments, or nodes' };
    }
    const compiled = compilePageHtml(html, { kind, title, size });
    return sceneToResult(compiled);
  }
  return { ok: false, error: 'createScene needs html, fragments, or nodes' };
}

export function unwrapSceneCreateInput(input = {}) {
  if (!input || typeof input !== 'object') return {};
  if (input.createScene && typeof input.createScene === 'object' && !input.op) {
    return { op: 'createScene', ...input.createScene };
  }
  if (input.fromPage && typeof input.fromPage === 'object' && !input.op) {
    return { op: 'fromPage', ...input.fromPage };
  }
  if (input.fromSelection && typeof input.fromSelection === 'object' && !input.op) {
    return { op: 'fromSelection', ...input.fromSelection };
  }
  if (input.fromRaster && typeof input.fromRaster === 'object' && !input.op) {
    return { op: 'fromRaster', ...input.fromRaster };
  }
  return input;
}

export function isSceneCreateCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return false;
  if (String(cmd.op || '') === 'createDocument') return false;
  if (SCENE_CREATE_OPS.has(String(cmd.op || cmd.source || '').trim())) return true;
  if (cmd.createScene && typeof cmd.createScene === 'object') return true;
  if (cmd.fromPage && typeof cmd.fromPage === 'object') return true;
  if (cmd.fromSelection && typeof cmd.fromSelection === 'object') return true;
  if (cmd.fromRaster && typeof cmd.fromRaster === 'object') return true;
  if (cmd.html || cmd.content) return true;
  if (Array.isArray(cmd.nodes) && cmd.nodes.length) return true;
  if (Array.isArray(cmd.frames) && cmd.frames.length) return true;
  if (Array.isArray(cmd.fragments) && cmd.fragments.length) return true;
  if (Array.isArray(cmd.items) && cmd.items.length) return true;
  return false;
}

/**
 * Page-like HTML → leaf nodes (heading / image / control / text). Never one wrapping section.
 * @param {string} html
 * @param {{ kind?: string, title?: string }} [opts]
 */
export function compilePageHtml(html, opts = {}) {
  const kind = normalizeKind(opts.kind);
  const size = opts.size || sizeForKind(kind);
  const leaves = extractLeaves(String(html || ''));
  const title = String(opts.title || firstHeading(leaves) || 'Page').trim() || 'Page';
  const laid = layoutNodes(leaves, size, kind);
  return { ok: true, source: 'page', kind, title, nodes: laid.nodes, size, overflow: laid.squashed };
}

/**
 * HTML that already has data-paw-slot keeps those boxes. Do not restack.
 */
export function compileMarkedSlots(html, opts = {}) {
  const kind = normalizeKind(opts.kind);
  const wrapped = wrapFragment(String(html || ''));
  const doc = parseMarkedHtml(wrapped);
  const frames = [];
  const allNodes = [];
  let overflowAny = false;
  (doc.plates || []).forEach((plate, i) => {
    const used = new Set();
    const leaves = [];
    for (const s of plate.slots || []) {
      const type =
        s.tag === 'img'
          ? 'image'
          : s.tag === 'h1'
            ? 'headline'
            : /^h[2-6]$/.test(s.tag)
              ? 'heading'
              : s.tag === 'a' || s.tag === 'button'
                ? 'control'
                : 'text';
      const id = uniqueId(String(s.id || type), used);
      leaves.push(
        makeLeaf({
          id,
          type,
          tag: s.tag || defaultTag(type),
          text: s.text || '',
          src: s.src || '',
          alt: s.text || '',
          html: s.html || '',
          box: s.box || null,
          provenance: 'marked'
        })
      );
    }
    const size = opts.size || sizeFromLeaves(leaves, sizeForKind(kind));
    let nodes = leaves;
    if (!(leaves.length && leaves.every((n) => n.box))) {
      const laid = layoutNodes(leaves, size, kind);
      nodes = laid.nodes;
      if (laid.squashed) overflowAny = true;
    }
    frames.push({
      id: plate.id || (kind === 'deck' ? `slide-${i + 1}` : i === 0 ? 'poster' : `frame-${i + 1}`),
      name: plate.frameName || plate.id,
      frameBox: plate.frameBox || defaultPasteboardBox(i, size, kind),
      notes: plate.notes || '',
      nodes,
      size
    });
    allNodes.push(...nodes);
  });
  const size = frames[0]?.size || opts.size || sizeForKind(kind);
  return {
    ok: true,
    source: 'marked',
    kind,
    title: String(opts.title || doc.title || firstHeading(allNodes) || 'Poster').trim() || 'Poster',
    nodes: allNodes,
    frames,
    size,
    overflow: overflowAny
  };
}

export function compileFrameList(frameList, opts = {}) {
  const kind = normalizeKind(opts.kind);
  const frames = [];
  const list = Array.isArray(frameList) ? frameList : [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i] || {};
    if (isSemanticFrame(f)) {
      const compiled = compileLayoutFrame(f, {
        kind,
        themeId: f.themeId || opts.themeId,
        index: i
      });
      if (!compiled.ok) return compiled;
      const size = compiled.frame.size || f.size || opts.size || sizeForKind(kind);
      const frameKind = compiled.frame.size?.w === 1920 && compiled.frame.size?.h === 1080 ? 'deck' : kind;
      const name =
        frameKind === 'deck' || kind === 'deck'
          ? resolveSlideFrameName({ name: f.name, title: f.title, slots: f.slots, index: i })
          : String(compiled.frame.name || f.name || f.title || '');
      frames.push({
        ...compiled.frame,
        name,
        transition: f.transition || compiled.frame.transition,
        animation: f.animation || compiled.frame.animation,
        frameBox: parseBox(f.frameBox || f.box) || defaultPasteboardBox(i, size, frameKind),
        overflow: false
      });
      continue;
    }
    const compiled = compileNodeList(f.nodes || (Array.isArray(f.slots) ? f.slots : []), {
      kind,
      title: f.name || f.title || f.id,
      size: f.size || opts.size
    });
    const size = compiled.size || sizeForKind(kind);
    frames.push({
      id: String(f.id || (kind === 'deck' ? `slide-${i + 1}` : i === 0 ? 'poster' : `frame-${i + 1}`)),
      name:
        kind === 'deck'
          ? resolveSlideFrameName({ name: f.name, title: f.title || compiled.title, slots: f.slots, index: i })
          : String(f.name || f.title || f.id || compiled.title || ''),
      frameBox: parseBox(f.frameBox || f.box) || defaultPasteboardBox(i, size, kind),
      notes: String(f.notes || ''),
      transition: f.transition,
      animation: f.animation,
      nodes: compiled.nodes,
      size,
      overflow: compiled.overflow === true
    });
  }
  if (kind === 'deck' && frames.length) {
    const placed = placeFramesInStrip(
      frames.map((f) => ({
        id: f.id,
        w: f.frameBox?.w || f.size?.w,
        h: f.frameBox?.h || f.size?.h
      }))
    );
    frames.forEach((f, i) => {
      f.frameBox = { x: placed[i].x, y: placed[i].y, w: placed[i].w, h: placed[i].h };
    });
  }
  const anyLayout = frames.some((f) => f.layoutId);
  return {
    ok: true,
    source: anyLayout ? 'layout' : 'frames',
    kind,
    title: String(opts.title || frames[0]?.name || (kind === 'deck' ? 'Deck' : 'Poster')).trim(),
    nodes: frames.flatMap((f) => f.nodes || []),
    frames,
    size: frames[0]?.size || sizeForKind(kind),
    overflow: frames.some((f) => f.overflow),
    themeId: opts.themeId || frames[0]?.themeId || ''
  };
}

function frameHasContent(frame) {
  return (Array.isArray(frame?.nodes) ? frame.nodes : []).some(
    (n) =>
      String(n.text || n.src || '').trim() ||
      n.type === 'image' ||
      n.tag === 'img' ||
      n.type === 'geo' ||
      n.type === 'color-block'
  );
}

/**
 * Each selection fragment becomes at least one slot.
 * @param {Array<string|{html?: string, content?: string, text?: string, src?: string}>} fragments
 * @param {{ kind?: string, title?: string }} [opts]
 */
export function compileSelectionFragments(fragments, opts = {}) {
  const kind = normalizeKind(opts.kind);
  const sizeOpt = opts.size;
  const items = Array.isArray(fragments) ? fragments : fragments ? [fragments] : [];
  const leaves = [];
  for (const raw of items) {
    const piece = fragmentToHtml(raw);
    const extracted = extractLeaves(piece);
    if (extracted.length) leaves.push(...extracted);
    else {
      const text = String(typeof raw === 'string' ? raw : raw?.text || raw?.alt || '').trim();
      const src = typeof raw === 'object' && raw ? String(raw.src || raw.url || '') : '';
      if (src) {
        leaves.push(makeLeaf({ type: 'image', tag: 'img', src, text: text || 'image' }));
      } else if (text) {
        leaves.push(makeLeaf({ type: 'text', tag: 'p', text }));
      }
    }
  }
  const title = String(opts.title || firstHeading(leaves) || 'Selection').trim() || 'Selection';
  const size = sizeOpt || sizeForKind(kind);
  const laid = layoutNodes(leaves, size, kind);
  return { ok: true, source: 'selection', kind, title, nodes: laid.nodes, size, overflow: laid.squashed };
}

export function compileRasterScene(raw = {}, opts = {}) {
  const item = rasterItemRef(raw);
  if (!item) return { ok: false, error: 'fromRaster needs item or path (screenshot1 / 图片1 / /artifacts/…)' };
  const scanned = resolveRasterScanNodes(raw, { imageData: opts.imageData });
  const regions = scanned.regions;
  if (!regions.length) {
    return {
      ok: false,
      error: 'fromRaster needs regions/nodes from inspect — host does not invent a layer tree'
    };
  }
  const nodes = regions.map((n) => {
    const type = n.type || (String(n.text || '').trim() && !n.src ? 'text' : 'image');
    const solid = type === 'color-block' || type === 'geo' || type === 'shape';
    const image = !solid && (type === 'image' || n.src || n.tag === 'img');
    const cropOn = n.crop !== false && n.crop !== 0;
    return {
      ...n,
      type,
      src: image ? String(n.src || item) : String(n.src || ''),
      sourceBox: n.sourceBox || n.cropBox || (cropOn && n.box ? n.box : null),
      fill: n.fill || n.color || '',
      provenance: n.provenance || 'raster'
    };
  });
  const compiled = compileNodeList(nodes, {
    kind: opts.kind,
    title: opts.title || raw.title,
    size: opts.size || scanned.size || undefined
  });
  compiled.source = 'raster';
  compiled.item = item;
  compiled.scan = scanned.scanned ? 'auto' : raw.scan;
  return compiled;
}

export function compileNodeList(nodes, opts = {}) {
  const kind = normalizeKind(opts.kind);
  const size = opts.size || sizeForKind(kind);
  const used = new Set();
  const leaves = (Array.isArray(nodes) ? nodes : []).map((n, i) => {
    const type = nodeType(n);
    const id = uniqueId(String(n.id || n.slot || type), used);
    const box = n.box || null;
    return {
      id,
      type,
      tag: n.tag || defaultTag(type),
      text: String(n.text || n.value || n.alt || ''),
      src: String(n.src || n.url || n.path || n.item || n.handle || ''),
      alt: String(n.alt || n.text || ''),
      box,
      sourceBox: n.sourceBox || n.cropBox || null,
      tldrawCrop: n.tldrawCrop || null,
      rasterCropped: !!n.rasterCropped,
      provenance: n.provenance || 'nodes',
      fill: n.fill || '',
      color: n.color || n.fill || '',
      geo: n.geo || (type === 'geo' ? 'rectangle' : ''),
      rotation: n.rotation,
      degrees: n.degrees,
      size: n.size || '',
      font: n.font || '',
      fillKind: n.fillKind || '',
      align: n.align || n.textAlign || '',
      dash: n.dash || '',
      opacity: n.opacity,
      meta: n.meta && typeof n.meta === 'object' ? { ...n.meta } : undefined,
      z: i
    };
  });
  const laid = leaves.some((n) => !n.box)
    ? layoutNodes(leaves, size, kind)
    : { nodes: leaves, squashed: false };
  return {
    ok: true,
    source: 'nodes',
    kind,
    title: String(opts.title || firstHeading(laid.nodes) || 'Scene').trim() || 'Scene',
    nodes: laid.nodes,
    size,
    overflow: laid.squashed
  };
}

/**
 * Load path: already a pawCanvas, or compile poster/deck HTML into one.
 */
export function documentFromArtifactText(raw, opts = {}) {
  const text = String(raw || '');
  if (isPawCanvasDoc(text)) return parsePawCanvas(text);
  if (!looksLikeVisualHtml(text) && !String(opts.htmlForce || '')) return null;
  const deck = opts.shell === 'slides' || opts.kind === 'deck' || /data-paw-kind\s*=\s*["']deck["']/i.test(text);
  const built = createScene({
    op: 'fromPage',
    html: text,
    kind: deck ? 'deck' : 'poster',
    title: opts.title || ''
  });
  if (!built?.ok || !built.canvas) return null;
  return parsePawCanvas(built.canvas);
}

function sceneToResult(compiled) {
  if (!compiled?.ok) return compiled;
  // Warnings read the model's own composition (before poster padding).
  const warnings = sceneCompositionWarnings(compiled);
  const next = compiled.kind === 'poster' && compiled.source !== 'layout' ? ensurePosterNotCoverOnly(compiled) : compiled;
  const html = serializeCompiledScene(next);
  const canvas = compileSceneToPawCanvas(next);
  return {
    ok: true,
    html,
    canvas,
    json: JSON.stringify(canvas),
    kind: next.kind,
    source: next.source,
    title: next.title,
    nodes: next.nodes,
    frames: next.frames,
    size: next.size,
    ...(warnings.length ? { warnings, warning: warnings[0] } : {})
  };
}

/**
 * Informational only — the model owns paper and composition (HANDOFF Q1/Q3
 * decisions). The host reports what happened; it never rejects here.
 * Raster/selection/page sources are user material (photos) — no textless nag.
 */
export function sceneCompositionWarnings(compiled = {}) {
  const warnings = [];
  const size = compiled.size || {};
  if (compiled.overflow === true) {
    warnings.push(
      `content overflowed the ${size.w || '?'}x${size.h || '?'} paper and was scaled down to fit; paper is your call — prefer frames[] (one panel/page per frame), a taller size, or fewer nodes per paper`
    );
  }
  const source = String(compiled.source || '');
  if (source === 'nodes' || source === 'frames') {
    const frames = Array.isArray(compiled.frames) && compiled.frames.length
      ? compiled.frames
      : [{ nodes: compiled.nodes || [] }];
    const imageOnly = frames.filter((f) => {
      const nodes = Array.isArray(f.nodes) ? f.nodes : [];
      const images = nodes.filter((n) => n.type === 'image' || n.tag === 'img');
      const realTexts = nodes.filter(
        (n) =>
          (n.type === 'text' || n.type === 'headline' || n.type === 'heading' || n.type === 'control') &&
          String(n.text || '').trim()
      );
      return images.length >= 1 && realTexts.length === 0;
    });
    const singleFrameImageStack =
      frames.length === 1 &&
      imageOnly.length === 1 &&
      (frames[0].nodes || []).filter((n) => n.type === 'image' || n.tag === 'img').length >= 2;
    if (imageOnly.length >= 2 || singleFrameImageStack) {
      warnings.push(
        'panels are images with no text nodes; captions/dialogue must be real text nodes (createScene text / deck setSlotText), not baked into generated images'
      );
    }
    const emptyFrames = frames.filter((f) => !frameHasContent(f)).length;
    if (emptyFrames) {
      warnings.push(
        `${emptyFrames} of ${frames.length} frames have no content — each Frame needs nodes (image + real text)`
      );
    }
    const allNodes = frames.flatMap((f) => (Array.isArray(f.nodes) ? f.nodes : []));
    const texts = allNodes.filter(
      (n) =>
        (n.type === 'text' || n.type === 'headline' || n.type === 'heading' || n.type === 'control') &&
        String(n.text || '').trim()
    );
    const planes = allNodes.filter(
      (n) => n.type === 'geo' || n.type === 'color-block' || n.type === 'image' || n.tag === 'img' || n.geo
    );
    if (texts.length >= 3 && planes.length === 0) {
      warnings.push(
        'graphic remake is text-only — add color-block/geo planes with source-pixel boxes (and matching fill); a vertical text list is not a poster'
      );
    }
  }
  if (source === 'raster') {
    const regions = Array.isArray(compiled.nodes) ? compiled.nodes : [];
    const texts = regions.filter((n) => String(n.text || '').trim() && n.type !== 'image' && n.type !== 'geo');
    const planes = regions.filter((n) => n.type === 'geo' || n.type === 'color-block' || n.type === 'image' || n.geo);
    if (texts.length >= 3 && planes.length === 0) {
      warnings.push(
        'graphic remake is text-only — add color-block/geo planes with source-pixel boxes (and matching fill); a vertical text list is not a poster'
      );
    }
  }
  return warnings;
}

export function isCoverOnlyPoster(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (!list.length) return false;
  const images = list.filter((n) => n.type === 'image' || n.tag === 'img');
  const texts = list.filter((n) => n.type !== 'image' && n.tag !== 'img');
  return images.length === 1 && texts.length === 0 && list.length === 1;
}

function ensurePosterNotCoverOnly(compiled) {
  const frames = Array.isArray(compiled.frames) && compiled.frames.length
    ? compiled.frames.map((f) => expandFrameNodes(f, compiled))
    : [
        expandFrameNodes(
          {
            id: 'poster',
            name: compiled.title,
            nodes: compiled.nodes,
            size: compiled.size,
            frameBox: compiled.frameBox
          },
          compiled
        )
      ];
  return {
    ...compiled,
    frames,
    nodes: frames.flatMap((f) => f.nodes || []),
    size: frames[0]?.size || compiled.size
  };
}

function expandFrameNodes(frame, compiled) {
  const kind = 'poster';
  const size = frame.size || compiled.size || sizeForKind(kind);
  let nodes = [...(frame.nodes || [])];
  if (nodes.some((n) => n?.meta?.pawLayout) || frame.layoutId) {
    return {
      ...frame,
      nodes,
      size,
      frameBox: frame.frameBox || defaultPasteboardBox(0, size, kind)
    };
  }
  if (isCoverOnlyPoster(nodes) && nodes[0]) {
    const img = nodes[0];
    nodes = layoutNodes(
      [
        makeLeaf({
          type: 'headline',
          tag: 'h1',
          text: frame.name || compiled.title || img.alt || img.text || 'Poster'
        }),
        img,
        makeLeaf({
          type: 'text',
          tag: 'p',
          text: img.alt || img.text || 'Image'
        })
      ],
      size,
      kind
    ).nodes;
  } else if (nodes.length < 3 && nodes.length >= 1) {
    const extra = [];
    if (!nodes.some((n) => n.type === 'headline' || n.type === 'heading')) {
      extra.push(makeLeaf({ type: 'headline', tag: 'h1', text: frame.name || compiled.title || 'Poster' }));
    }
    if (!nodes.some((n) => n.type === 'text')) {
      extra.push(makeLeaf({ type: 'text', tag: 'p', text: ' ' }));
    }
    while (nodes.length + extra.length < 3) {
      extra.push(makeLeaf({ type: 'text', tag: 'p', text: ' ' }));
    }
    if (nodes.every((n) => n.box)) {
      let y = nodes.reduce((m, n) => Math.max(m, n.box.y + n.box.h), 8) + 16;
      for (const leaf of extra) {
        leaf.box = { x: 40, y, w: Math.max(80, size.w - 80), h: 36 };
        y += 52;
        nodes.push(leaf);
      }
    } else {
      nodes = layoutNodes([...extra, ...nodes].map((n, i) => ({ ...n, z: i })), size, kind).nodes;
    }
  } else if (nodes.some((n) => !n.box)) {
    nodes = layoutNodes(nodes, size, kind).nodes;
  }
  return {
    ...frame,
    nodes,
    size,
    frameBox: frame.frameBox || defaultPasteboardBox(0, size, kind)
  };
}

export function serializeCompiledScene(compiled) {
  const kind = normalizeKind(compiled?.kind);
  const size = compiled?.size || sizeForKind(kind);
  const frames =
    Array.isArray(compiled.frames) && compiled.frames.length
      ? compiled.frames
      : [
          {
            id: kind === 'deck' ? 'slide-1' : 'poster',
            name: compiled.title,
            nodes: compiled.nodes,
            size,
            notes: compiled.notes || '',
            frameBox: compiled.frameBox
          }
        ];
  const styles = kind === 'deck' ? deckStyles(frames[0]?.size || size) : posterStyles(frames[0]?.size || size);
  const plates = frames.map((f, i) => {
    const frameSize = f.size || size;
    const inner = (f.nodes || []).map((n) => nodeToHtml(n)).join('\n  ');
    return {
      id: f.id || (kind === 'deck' ? `slide-${i + 1}` : i === 0 ? 'poster' : `frame-${i + 1}`),
      html: `\n  ${inner}\n`,
      frame: f.id,
      frameName: f.name || f.id,
      frameBox: f.frameBox || defaultPasteboardBox(i, frameSize, kind),
      notes: f.notes || ''
    };
  });
  return serializeMarkedHtml({
    title: compiled.title || (kind === 'deck' ? 'Deck' : 'Poster'),
    lang: 'zh-CN',
    kind,
    styles,
    plates
  });
}

function nodeToHtml(node) {
  const id = escapeHtml(node.id || 'slot');
  const box = formatBox(node.box);
  const boxAttr = box ? ` data-box="${box}"` : '';
  const groupAttr = node.group ? ` data-paw-group="${escapeHtml(node.group)}"` : '';
  if (node.type === 'image' || node.tag === 'img') {
    const alt = escapeHtml(node.alt || node.text || '');
    const src = escapeHtml(node.src || '');
    return `<img data-paw-slot="${id}"${boxAttr}${groupAttr} src="${src}" alt="${alt}" />`;
  }
  const tag = safeTag(node.tag || defaultTag(node.type));
  const href =
    tag === 'a' ? ` href="${escapeHtml(node.href || '#')}"` : tag === 'button' ? ' type="button"' : '';
  const inner =
    node.html && /<[a-z]/i.test(node.html) ? node.html : escapeHtml(node.text || '');
  return `<${tag} data-paw-slot="${id}"${boxAttr}${groupAttr}${href}>${inner}</${tag}>`;
}

function posterStyles(size) {
  return `:root {
  --paw-poster-w: ${size.w}px;
  --paw-poster-h: ${size.h}px;
  --bg: #ffffff;
  --text-main: #111111;
  --accent: #111111;
  --muted: #6b7280;
}
html, body { margin: 0; background: #ffffff; color: var(--text-main); font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
section[data-paw-block] {
  position: relative;
  width: var(--paw-poster-w);
  height: var(--paw-poster-h);
  margin: 0 auto;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text-main);
}
[data-paw-slot][data-box] { position: absolute; box-sizing: border-box; margin: 0; }
img[data-paw-slot] { display: block; width: 100%; height: 100%; object-fit: cover; }
a[data-paw-slot], button[data-paw-slot] {
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; background: #111; color: #fff; border-radius: 4px; text-decoration: none;
}`;
}

function deckStyles(size) {
  return `:root {
  --paw-slide-w: ${size.w}px;
  --paw-slide-h: ${size.h}px;
  --bg: #0f172a;
  --text-main: #f8fafc;
  --accent: #38bdf8;
}
html, body { margin: 0; background: #020617; color: var(--text-main); font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
section[data-paw-block] {
  position: relative;
  width: var(--paw-slide-w);
  height: var(--paw-slide-h);
  margin: 0 auto;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text-main);
}
[data-paw-slot][data-box] { position: absolute; box-sizing: border-box; margin: 0; }
img[data-paw-slot] { display: block; width: 100%; height: 100%; object-fit: cover; }`;
}

function extractLeaves(html) {
  const used = new Set();
  const out = [];
  walk(String(html || ''), 0, html.length, used, out);
  return out.slice(0, MAX_LEAVES);
}

function walk(html, start, end, used, out) {
  let i = start;
  while (i < end && out.length < MAX_LEAVES) {
    i = skipNoise(html, i, end);
    if (i >= end) break;
    if (html[i] !== '<') {
      const next = html.indexOf('<', i);
      const stop = next < 0 || next > end ? end : next;
      i = stop;
      continue;
    }
    const el = parseElementAt(html, i, end);
    if (!el) {
      i += 1;
      continue;
    }
    if (el.end > end) {
      i = el.openEnd;
      continue;
    }
    collectElement(el, used, out);
    i = el.end;
  }
}

function collectElement(el, used, out) {
  if (SKIP_TAGS.has(el.tag)) return;
  if (isHidden(el)) return;
  if (el.tag === 'img' || el.tag === 'svg' || el.tag === 'video' || el.tag === 'canvas') {
    let src = normalizeImageSrc(
      el.attrs.src || el.attrs['data-src'] || el.attrs.poster || firstSrcsetUrl(el.attrs.srcset) || ''
    );
    if (!src && el.tag === 'svg' && el.outerHtml) src = svgMarkupToDataUrl(el.outerHtml);
    if (!src) return;
    pushLeaf(out, used, {
      type: 'image',
      tag: 'img',
      src,
      text: el.attrs.alt || textOf(el.innerHtml) || 'image',
      alt: el.attrs.alt || ''
    });
    return;
  }
  const bg = backgroundImageSrc(el.attrs.style);
  if (bg) {
    pushLeaf(out, used, { type: 'image', tag: 'img', src: bg, text: el.attrs.alt || 'image', alt: el.attrs.alt || '' });
  }
  if (el.tag === 'button' || isButtonInput(el)) {
    const text = textOf(el.innerHtml) || el.attrs.value || el.attrs.alt || 'button';
    pushLeaf(out, used, { type: 'control', tag: el.tag === 'input' ? 'button' : 'button', text });
    return;
  }
  if (/^h[1-6]$/.test(el.tag)) {
    const text = textOf(el.innerHtml);
    if (text) {
      pushLeaf(out, used, {
        type: el.tag === 'h1' ? 'headline' : 'heading',
        tag: el.tag,
        text,
        level: Number(el.tag[1])
      });
    }
    return;
  }
  if (el.tag === 'a') {
    const nestedImg = findDirectMedia(el.innerHtml);
    if (nestedImg) {
      collectElement(nestedImg, used, out);
    }
    const text = textOf(el.innerHtml);
    if (text) {
      const control = text.length <= 48;
      pushLeaf(out, used, {
        type: control ? 'control' : 'text',
        tag: control ? 'a' : 'p',
        text,
        href: el.attrs.href || ''
      });
    }
    return;
  }
  if (el.tag === 'p' || el.tag === 'blockquote' || el.tag === 'pre' || el.tag === 'figcaption' || el.tag === 'label') {
    if (hasBlockOrMedia(el.innerHtml)) {
      walk(el.innerHtml, 0, el.innerHtml.length, used, out);
      return;
    }
    const text = textOf(el.innerHtml);
    if (text) pushLeaf(out, used, { type: 'text', tag: 'p', text });
    return;
  }
  walk(el.innerHtml, 0, el.innerHtml.length, used, out);
}

function pushLeaf(out, used, leaf) {
  if (out.length >= MAX_LEAVES) return;
  const id = uniqueId(idBase(leaf), used);
  out.push(makeLeaf({ ...leaf, id, z: out.length, provenance: 'compile' }));
}

function firstSrcsetUrl(srcset) {
  const s = String(srcset || '').trim();
  if (!s) return '';
  return s.split(',')[0].trim().split(/\s+/)[0] || '';
}

function svgMarkupToDataUrl(markup) {
  const raw = String(markup || '').trim();
  if (!/^<svg\b/i.test(raw)) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
}

function backgroundImageSrc(style) {
  const m = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i.exec(String(style || ''));
  if (!m) return '';
  const src = normalizeImageSrc(m[2]);
  if (!src) return '';
  if (
    /^data:image\//i.test(src) ||
    /^https?:\/\//i.test(src) ||
    /^artifact:\/\//i.test(src) ||
    /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(src)
  ) {
    return src;
  }
  return '';
}

function makeLeaf(leaf) {
  return {
    id: leaf.id || idBase(leaf),
    type: leaf.type || 'text',
    tag: leaf.tag || defaultTag(leaf.type),
    text: String(leaf.text || ''),
    src: String(leaf.src || ''),
    alt: String(leaf.alt || leaf.text || ''),
    href: String(leaf.href || ''),
    html: String(leaf.html || ''),
    box: leaf.box || null,
    sourceBox: leaf.sourceBox || null,
    tldrawCrop: leaf.tldrawCrop || null,
    rasterCropped: !!leaf.rasterCropped,
    provenance: leaf.provenance || 'compile',
    z: leaf.z || 0,
    level: leaf.level
  };
}

function idBase(leaf) {
  if (leaf.type === 'headline') return 'headline';
  if (leaf.type === 'heading') return 'heading';
  if (leaf.type === 'image') return 'image';
  if (leaf.type === 'control') return 'cta';
  return 'text';
}

function uniqueId(base, used) {
  const root = String(base || 'slot')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'slot';
  let id = root;
  let n = 2;
  while (used.has(id)) {
    id = `${root}-${n++}`;
  }
  used.add(id);
  return id;
}

function layoutNodes(leaves, size, kind) {
  const tunedW = LAYOUT_TUNED_W[kind === 'deck' ? 'deck' : 'poster'];
  const k = Math.max(0.5, Math.min(3, (Number(size?.w) || tunedW) / tunedW));
  const margin = Math.round((kind === 'deck' ? 32 : 40) * k);
  const gap = Math.round((kind === 'deck' ? 12 : 16) * k);
  const innerW = Math.max(80, size.w - margin * 2);
  let y = Math.round((kind === 'deck' ? 36 : 48) * k);
  const nodes = leaves.map((leaf, i) => {
    const n = { ...leaf, z: i };
    let w = innerW;
    let h = Math.round(36 * k);
    let x = margin;
    if (n.type === 'image') {
      h = Math.round(innerW * (kind === 'deck' ? 0.42 : 0.52));
    } else if (n.type === 'headline') {
      h = Math.round((kind === 'deck' ? 56 : 72) * k);
    } else if (n.type === 'heading') {
      h = Math.round(44 * k);
    } else if (n.type === 'control') {
      w = Math.min(innerW, Math.round(280 * k));
      h = Math.round(48 * k);
    } else {
      const chars = String(n.text || '').length;
      h = Math.round(Math.min((kind === 'deck' ? 96 : 160) * k, (28 + Math.ceil(chars / 36) * 22) * k));
    }
    n.box = { x, y, w, h };
    y += h + gap;
    return n;
  });
  let squashed = false;
  if (y > size.h - 16 && y > 0) {
    const scale = (size.h - 32) / y;
    if (scale < 1) {
      squashed = true;
      for (const n of nodes) {
        n.box = {
          x: n.box.x,
          y: Math.max(8, Math.round(n.box.y * scale)),
          w: n.box.w,
          h: Math.max(20, Math.round(n.box.h * scale))
        };
      }
    }
  }
  return { nodes, squashed };
}

function sizeForKind(kind) {
  return kind === 'deck' ? { ...DECK_SIZE } : { ...POSTER_SIZE };
}

function sizeFromInput(input = {}) {
  if (Array.isArray(input.box) && input.box.length >= 4) {
    const w = Number(input.box[2]);
    const h = Number(input.box[3]);
    if (w > 0 && h > 0) return { w, h };
  }
  if (input.size && Number(input.size.w || input.size.width) > 0) {
    return { w: Number(input.size.w || input.size.width), h: Number(input.size.h || input.size.height) };
  }
  const w = Number(input.width || input.w || 0);
  const h = Number(input.height || input.h || 0);
  if (w > 0 && h > 0) return { w, h };
  return null;
}

function sizeFromLeaves(leaves, fallback) {
  let maxR = 0;
  let maxB = 0;
  for (const n of leaves || []) {
    if (!n.box) continue;
    maxR = Math.max(maxR, n.box.x + n.box.w);
    maxB = Math.max(maxB, n.box.y + n.box.h);
  }
  if (maxR < 80 || maxB < 80) return fallback;
  return { w: Math.max(fallback.w, Math.ceil(maxR + 40)), h: Math.max(fallback.h, Math.ceil(maxB + 40)) };
}

function wrapFragment(html) {
  const s = String(html || '');
  if (/<html[\s>]/i.test(s)) return s;
  const inner = /data-paw-block/i.test(s) ? s : `<section data-paw-block data-paw-block-id="poster">${s}</section>`;
  return `<!DOCTYPE html><html data-pawwork-preview="blocks" data-paw-kind="poster"><body>${inner}</body></html>`;
}

function inferSceneKind(raw = {}) {
  const explicit = String(raw.kind || raw.canvasKind || raw.type || '').trim();
  if (explicit) return normalizeKind(explicit);
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  const semantic = frames.find((f) => isSemanticFrame(f));
  const layout = semantic ? getLayout(semantic.layoutId) : null;
  if (layout?.kind) return normalizeKind(layout.kind);
  return normalizeKind('');
}

function normalizeKind(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'deck' || k === 'slide' || k === 'slides') return 'deck';
  return 'poster';
}

function firstHeading(nodes) {
  const hit = (nodes || []).find((n) => n.type === 'headline' || n.type === 'heading');
  return hit?.text || '';
}

function nodeType(n) {
  const t = String(n?.type || '').toLowerCase();
  if (t === 'color-block') return 'color-block';
  if (t === 'geo' || t === 'shape' || t === 'rect' || t === 'rectangle' || n?.geo) {
    return 'geo';
  }
  if (t === 'image' || t === 'img' || n?.tag === 'img' || n?.src) return 'image';
  if (t === 'headline' || n?.tag === 'h1') return 'headline';
  if (t === 'heading' || /^h[2-6]$/.test(n?.tag || '')) return 'heading';
  if (t === 'control' || t === 'cta' || n?.tag === 'button' || n?.tag === 'a') return 'control';
  return 'text';
}

function defaultTag(type) {
  if (type === 'image') return 'img';
  if (type === 'headline') return 'h1';
  if (type === 'heading') return 'h2';
  if (type === 'control') return 'a';
  if (type === 'geo' || type === 'color-block') return 'div';
  return 'p';
}

function safeTag(tag) {
  const t = String(tag || 'p').toLowerCase();
  if (/^(h[1-6]|p|a|button|span|div|img)$/.test(t)) return t;
  return 'p';
}

function fragmentToHtml(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw !== 'object') return String(raw);
  return String(raw.html || raw.content || raw.outerHtml || raw.text || '');
}

function textOf(inner) {
  return String(inner || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isHidden(el) {
  if (el.attrs.hidden != null && el.attrs.hidden !== 'false') return true;
  if (el.attrs['aria-hidden'] === 'true') return true;
  const style = String(el.attrs.style || '');
  if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) return true;
  return false;
}

function isButtonInput(el) {
  if (el.tag !== 'input') return false;
  const t = String(el.attrs.type || 'text').toLowerCase();
  return t === 'button' || t === 'submit' || t === 'reset';
}

function hasBlockOrMedia(inner) {
  return /<(img|svg|video|canvas|h[1-6]|button|section|article|div|ul|ol|table|figure)\b/i.test(
    String(inner || '')
  );
}

function findDirectMedia(inner) {
  const html = String(inner || '');
  let i = 0;
  while (i < html.length) {
    i = skipNoise(html, i, html.length);
    if (i >= html.length) break;
    if (html[i] !== '<') {
      const next = html.indexOf('<', i);
      if (next < 0) break;
      i = next;
      continue;
    }
    const el = parseElementAt(html, i, html.length);
    if (!el) {
      i += 1;
      continue;
    }
    if (el.tag === 'img' || el.tag === 'svg' || el.tag === 'video') return el;
    i = el.end;
  }
  return null;
}

function skipNoise(html, i, end) {
  let p = i;
  while (p < end) {
    while (p < end && html[p] !== '<') p += 1;
    if (p >= end) return p;
    if (html.startsWith('<!--', p)) {
      const close = html.indexOf('-->', p + 4);
      p = close < 0 ? end : close + 3;
      continue;
    }
    if (html.startsWith('<!', p) || html.startsWith('<?', p)) {
      const gt = html.indexOf('>', p);
      p = gt < 0 ? end : gt + 1;
      continue;
    }
    return p;
  }
  return p;
}

function parseOpenTag(html, i, end) {
  if (html[i] !== '<') return null;
  const next = html[i + 1];
  if (next === '/' || next === '!' || next === '?') return null;
  const gt = html.indexOf('>', i);
  if (gt < 0 || gt >= end) return null;
  const raw = html.slice(i, gt + 1);
  const m = /^<([a-zA-Z][\w:-]*)/.exec(raw);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const selfClosing = /\/\s*>$/.test(raw) || VOID_TAGS.has(tag);
  return { tag, attrs: parseAttrs(raw), start: i, openEnd: gt + 1, selfClosing, raw };
}

function parseElementAt(html, i, end) {
  const open = parseOpenTag(html, i, end);
  if (!open) return null;
  if (open.selfClosing) {
    return {
      ...open,
      innerStart: open.openEnd,
      innerEnd: open.openEnd,
      end: Math.min(open.openEnd, end),
      innerHtml: '',
      outerHtml: html.slice(open.start, open.openEnd)
    };
  }
  const closeNeedle = `</${open.tag}`;
  let depth = 1;
  let j = open.openEnd;
  while (j < end && depth > 0) {
    j = skipNoise(html, j, end);
    if (j >= end) break;
    if (html[j] !== '<') {
      j += 1;
      continue;
    }
    const slice = html.slice(j, j + closeNeedle.length);
    if (slice.toLowerCase() === closeNeedle) {
      const after = html[j + closeNeedle.length];
      if (after === '>' || (after && /\s/.test(after))) {
        const gt = html.indexOf('>', j);
        if (gt < 0) break;
        depth -= 1;
        if (depth === 0) {
          return {
            ...open,
            innerStart: open.openEnd,
            innerEnd: j,
            end: gt + 1,
            innerHtml: html.slice(open.openEnd, j),
            outerHtml: html.slice(open.start, gt + 1)
          };
        }
        j = gt + 1;
        continue;
      }
    }
    const nested = parseOpenTag(html, j, end);
    if (nested && nested.tag === open.tag && !nested.selfClosing) {
      depth += 1;
      j = nested.openEnd;
      continue;
    }
    const gt = html.indexOf('>', j);
    if (gt < 0) break;
    j = gt + 1;
  }
  return {
    ...open,
    innerStart: open.openEnd,
    innerEnd: end,
    end,
    innerHtml: html.slice(open.openEnd, end),
    outerHtml: html.slice(open.start, end)
  };
}

function parseAttrs(openTag) {
  const attrs = {};
  const s = String(openTag || '')
    .replace(/^<[^\s>/]+/, '')
    .replace(/\/?>$/, '');
  const re = /([:@]?[\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

export function slotSampleFromNode(node, plateId) {
  return {
    plateId: plateId || '',
    id: node.id,
    slotId: node.id,
    type: node.type,
    tag: node.tag,
    text: String(node.text || '').slice(0, 160),
    src: node.src || '',
    box: node.box || null
  };
}
