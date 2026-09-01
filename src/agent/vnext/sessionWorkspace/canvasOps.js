/**
 * Design/Slides command catalog — Agent deck ops ↔ tldraw editor methods.
 * Node-safe. Live editor apply lives in design-runtime; this module is the contract.
 */

import { compileLayoutFrame } from './layoutCompile.js';
import { fillTldrawShapeProps } from './tldrawShapeProps.js';
import { DEFAULT_THEME_ID } from './themeCatalog.js';
import { CANVAS_QA_FAILED, gateReplacePlate } from './canvasQaGate.js';
import {
  isTopLevelSlideFrame,
  planDeleteFrame,
  planInsertAfter,
  placeFramesInStrip,
  resolveReplaceFrameName,
  slideFallbackName,
  sortFramesForStrip
} from './slidesLayout.js';

const PAGE_ID = 'page:page';

/**
 * Single source of truth for default paper sizes. Empty canvas + createFrame
 * (here) and scene compile (sceneCompile POSTER_SIZE/DECK_SIZE) all read
 * these — never keep a second quiet default elsewhere (HANDOFF item 28).
 */
export const DESIGN_CANVAS_SIZE = { w: 960, h: 1440 };
export const SLIDES_CANVAS_SIZE = { w: 1920, h: 1080 };

export function defaultCanvasSize(shell) {
  return shell === 'slides' || shell === 'deck'
    ? { ...SLIDES_CANVAS_SIZE }
    : { ...DESIGN_CANVAS_SIZE };
}

export const TEXT_OPS = new Set(['setSlotText', 'setSlotHtml', 'updateText', 'setText']);
export const IMAGE_OPS = new Set(['setSlotSrc', 'setSrc', 'updateImage', 'propagateSlotSrc']);
export const STYLE_OPS = new Set(['setFill', 'setOpacity', 'setStyle', 'lock', 'unlock', 'hide', 'show']);
export const BOX_OPS = new Set(['setBox', 'nudge', 'rotate', 'flip']);
export const GEOMETRY_N2 = new Set(['align', 'distribute', 'group', 'pack', 'stack', 'stretch']);
export const Z_OPS = new Set(['bringToFront', 'sendToBack', 'bringForward', 'sendBackward']);
export const MUTATE_N1 = new Set(['delete', 'duplicate', 'reparent', ...Z_OPS, ...BOX_OPS, ...STYLE_OPS]);
export const CREATE_OPS = new Set(['createFrame', 'createShape', 'insertPlate']);
export const BOARD_OPS = new Set([
  'theme',
  'layout',
  'deletePlate',
  'reorder',
  'replacePlate',
  'setNotes',
  'select',
  'zoomToSelection',
  'zoomToFit',
  'zoomToFrame'
]);
export const LIVE_ONLY_OPS = new Set(['crop', 'pack', 'stretch']);

/** Every Agent-callable canvas op (tool schema + read.ops). */
export const DECK_OPS = [
  'setSlotText',
  'updateText',
  'setSlotSrc',
  'updateImage',
  'propagateSlotSrc',
  'setBox',
  'setFill',
  'setOpacity',
  'setStyle',
  'lock',
  'unlock',
  'hide',
  'show',
  'align',
  'distribute',
  'pack',
  'stack',
  'stretch',
  'flip',
  'rotate',
  'nudge',
  'group',
  'ungroup',
  'bringToFront',
  'sendToBack',
  'bringForward',
  'sendBackward',
  'reparent',
  'delete',
  'duplicate',
  'createShape',
  'createFrame',
  'insertPlate',
  'deletePlate',
  'replacePlate',
  'reorder',
  'theme',
  'layout',
  'setNotes',
  'select',
  'zoomToSelection',
  'zoomToFit',
  'zoomToFrame',
  'crop'
];

export const GEO_TYPES = [
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'star',
  'hexagon',
  'octagon',
  'oval',
  'cloud',
  'heart',
  'pentagon',
  'trapezoid',
  'rhombus',
  'x-box',
  'check-box',
  'arrow-left',
  'arrow-right',
  'arrow-up',
  'arrow-down'
];

export const SHAPE_TYPES = ['geo', 'text', 'frame', 'image', 'note', 'arrow', 'line', 'highlight'];

/** Grouped capabilities — Agent read surface, not extra tools. */
export const DECK_CAPABILITIES = {
  point: [
    'setSlotText',
    'setSlotSrc',
    'setBox',
    'setFill',
    'setOpacity',
    'setStyle',
    'lock',
    'unlock',
    'hide',
    'show',
    'setNotes'
  ],
  arrange: [
    'align',
    'distribute',
    'pack',
    'stack',
    'stretch',
    'flip',
    'rotate',
    'nudge',
    'bringToFront',
    'sendToBack',
    'bringForward',
    'sendBackward'
  ],
  structure: [
    'group',
    'ungroup',
    'createShape',
    'createFrame',
    'delete',
    'duplicate',
    'reparent'
  ],
  slides: ['insertPlate', 'deletePlate', 'replacePlate', 'reorder', 'zoomToFrame'],
  board: ['theme', 'layout', 'select', 'zoomToSelection', 'zoomToFit', 'crop']
};

export const DECK_ACTS = ['read', 'write', 'export'];

/** op → editor method (tests + live mapper). */
export const EDITOR_OP_MAP = {
  updateText: 'updateShape',
  setSlotText: 'updateShape',
  setText: 'updateShape',
  setSlotHtml: 'updateShape',
  setSlotSrc: 'createAssets',
  setSrc: 'createAssets',
  updateImage: 'createAssets',
  propagateSlotSrc: 'updateShape',
  setBox: 'updateShape',
  setFill: 'setStyleForSelectedShapes',
  setOpacity: 'setOpacityForSelectedShapes',
  setStyle: 'setStyleForSelectedShapes',
  lock: 'updateShape',
  unlock: 'updateShape',
  align: 'alignShapes',
  distribute: 'distributeShapes',
  pack: 'packShapes',
  stack: 'stackShapes',
  stretch: 'stretchShapes',
  flip: 'flipShapes',
  rotate: 'rotateShapesBy',
  nudge: 'nudgeShapes',
  group: 'groupShapes',
  ungroup: 'ungroupShapes',
  bringToFront: 'bringToFront',
  sendToBack: 'sendToBack',
  bringForward: 'bringForward',
  sendBackward: 'sendBackward',
  reparent: 'reparentShapes',
  delete: 'deleteShapes',
  duplicate: 'duplicateShapes',
  createShape: 'createShape',
  createFrame: 'createShape',
  insertPlate: 'createShape',
  deletePlate: 'deleteShapes',
  setNotes: 'updateShape',
  select: 'select',
  zoomToSelection: 'zoomToSelection',
  zoomToFit: 'zoomToFit',
  zoomToFrame: 'zoomToBounds',
  crop: 'setCroppingShape',
  hide: 'setOpacityForSelectedShapes',
  show: 'setOpacityForSelectedShapes'
};

const COLOR_ALIASES = {
  black: 'black',
  黑: 'black',
  grey: 'grey',
  gray: 'grey',
  灰: 'grey',
  white: 'white',
  白: 'white',
  red: 'red',
  红: 'red',
  'light-red': 'light-red',
  orange: 'orange',
  橙: 'orange',
  yellow: 'yellow',
  黄: 'yellow',
  green: 'green',
  绿: 'green',
  'light-green': 'light-green',
  blue: 'blue',
  蓝: 'blue',
  'light-blue': 'light-blue',
  violet: 'violet',
  purple: 'violet',
  紫: 'violet',
  'light-violet': 'light-violet',
  pink: 'light-red',
  rose: 'light-red',
  magenta: 'light-red',
  粉: 'light-red',
  cyan: 'light-blue',
  teal: 'light-blue',
  aqua: 'light-blue',
  青: 'light-blue'
};

const SIZE_ALIASES = {
  s: 's',
  small: 's',
  小: 's',
  m: 'm',
  medium: 'm',
  中: 'm',
  l: 'l',
  large: 'l',
  大: 'l',
  xl: 'xl',
  xlarge: 'xl',
  特大: 'xl'
};

const FONT_ALIASES = {
  sans: 'sans',
  黑体: 'sans',
  serif: 'serif',
  宋体: 'serif',
  mono: 'mono',
  draw: 'draw',
  手写: 'draw'
};

const ALIGN_ALIASES = {
  left: 'start',
  start: 'start',
  左: 'start',
  center: 'middle',
  middle: 'middle',
  中: 'middle',
  right: 'end',
  end: 'end',
  右: 'end'
};

const ALIGN_EDITOR = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  'center-h': 'center-horizontal',
  'center-horizontal': 'center-horizontal',
  center: 'center-horizontal',
  'center-v': 'center-vertical',
  'center-vertical': 'center-vertical',
  左: 'left',
  右: 'right',
  上: 'top',
  下: 'bottom'
};

export function normalizeCanvasOp(raw) {
  return String(raw || '').trim();
}

export function isTextOp(op) {
  return TEXT_OPS.has(normalizeCanvasOp(op));
}

export function isImageOp(op) {
  return IMAGE_OPS.has(normalizeCanvasOp(op));
}

export function isFieldOp(op) {
  const o = normalizeCanvasOp(op);
  return TEXT_OPS.has(o) || IMAGE_OPS.has(o) || o === 'setBox' || o === 'setFill';
}

export function isLiveOnlyOp(op) {
  return LIVE_ONLY_OPS.has(normalizeCanvasOp(op));
}

export function editorMethodForOp(op) {
  return EDITOR_OP_MAP[normalizeCanvasOp(op)] || '';
}

export function mapTldrawColor(value) {
  const s = String(value || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (COLOR_ALIASES[s]) return COLOR_ALIASES[s];
  if (s.startsWith('#')) {
    const hex = s.replace('#', '');
    const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6), 16);
    if (!Number.isFinite(n)) return 'black';
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (r > 200 && g < 80 && b < 80) return 'red';
    if (r > 180 && g < 140 && b > 80 && b < 200) return 'light-red';
    if (r < 80 && g < 80 && b > 180) return 'blue';
    if (r < 100 && g > 140 && b > 140) return 'light-blue';
    if (r < 80 && g > 160 && b < 80) return 'green';
    if (r > 200 && g > 180 && b < 80) return 'yellow';
    if (r > 220 && g > 140 && b < 80) return 'orange';
    if (r > 220 && g > 220 && b > 220) return 'white';
    if (r < 40 && g < 40 && b < 40) return 'black';
    if (r > 160 && g > 160 && b > 160) return 'grey';
    return r >= g && r >= b ? 'light-red' : g >= b ? 'light-green' : 'light-blue';
  }
  return COLOR_ALIASES[s] || '';
}

export function mapTldrawSize(value) {
  return SIZE_ALIASES[String(value || '').trim().toLowerCase()] || '';
}

export function mapTldrawFont(value) {
  return FONT_ALIASES[String(value || '').trim().toLowerCase()] || '';
}

export function mapTldrawAlign(value) {
  return ALIGN_ALIASES[String(value || '').trim().toLowerCase()] || '';
}

export function mapAlignOperation(value) {
  return ALIGN_EDITOR[String(value || '').trim().toLowerCase()] || 'left';
}

export function commandNodeIds(cmd) {
  if (!cmd || typeof cmd !== 'object') return [];
  const many = cmd.nodeIds || cmd.ids || cmd.slots;
  if (Array.isArray(many) && many.length) {
    return many.map((x) => String(x || '').trim()).filter(Boolean);
  }
  const one = String(cmd.nodeId || cmd.slotId || cmd.slot || '').trim();
  return one ? [one] : [];
}

export function pinnedNodeIds(selections) {
  const list = Array.isArray(selections) ? selections : selections ? [selections] : [];
  const ids = [];
  for (const s of list) {
    const id = String(s?.nodeId || s?.slotId || s?.slot || s?.id || '').trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function resolveOpIds(cmd, pinned) {
  const own = commandNodeIds(cmd);
  return own.length ? own : pinned.slice();
}

/**
 * @returns {{ ok: boolean, code?: string, error?: string, ids?: string[] }}
 */
export function canvasSelectionCheck(commands, selections) {
  const list = Array.isArray(commands) ? commands : [];
  const pinned = pinnedNodeIds(selections);
  for (const cmd of list) {
    if (!cmd || typeof cmd !== 'object') continue;
    const op = normalizeCanvasOp(cmd.op || cmd.type);
    if (!op) continue;
    if (CREATE_OPS.has(op) || BOARD_OPS.has(op)) {
      if (op === 'replacePlate') {
        const explicit = String(cmd.plateId || cmd.frameId || cmd.nodeId || cmd.slotId || cmd.id || '').trim();
        const ids = resolveOpIds(cmd, pinned);
        if (!explicit && !ids.length) {
          return {
            ok: false,
            code: 'NEED_SELECTION',
            error: 'click a slide/frame (or pass plateId / nodeId) before replacePlate'
          };
        }
      }
      continue;
    }
    const ids = resolveOpIds(cmd, pinned);
    if (isTextOp(op) || isImageOp(op)) {
      if (ids.length !== 1) {
        return {
          ok: false,
          code: 'NEED_SELECTION',
          error: 'click exactly one block (or pass nodeId) before changing text or image'
        };
      }
    } else if (GEOMETRY_N2.has(op) || op === 'ungroup') {
      if (ids.length < 2 && op !== 'ungroup') {
        return {
          ok: false,
          code: 'NEED_SELECTION',
          error: 'select at least two blocks for align / distribute / group'
        };
      }
      if (op === 'ungroup' && ids.length < 1) {
        return {
          ok: false,
          code: 'NEED_SELECTION',
          error: 'select a group to ungroup'
        };
      }
    } else if (MUTATE_N1.has(op) || op === 'setNotes' || op === 'zoomToFrame') {
      if (!ids.length) {
        return {
          ok: false,
          code: 'NEED_SELECTION',
          error: 'click a block on the canvas (or pass nodeId) first'
        };
      }
    }
  }
  return { ok: true, ids: pinned };
}

export function shapeId(raw) {
  const s = String(raw || 'n').replace(/^shape:/, '');
  return `shape:${s}`;
}

export function richText(text) {
  const t = String(text || '');
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] }]
  };
}

function indexKey(n) {
  return `a${Number(n).toString(36)}`;
}

function nextIndex(store) {
  let max = 1;
  for (const rec of Object.values(store)) {
    const idx = String(rec?.index || '');
    const m = /^a([0-9a-z]+)$/i.exec(idx);
    if (m) {
      const n = parseInt(m[1], 36);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return indexKey(max + 1);
}

function recBox(rec) {
  return {
    x: Number(rec.x) || 0,
    y: Number(rec.y) || 0,
    w: Number(rec.props?.w) || 0,
    h: Number(rec.props?.h) || 0
  };
}

function descendants(store, id) {
  const out = [];
  const walk = (pid) => {
    for (const rec of Object.values(store)) {
      if (rec && rec.typeName === 'shape' && rec.parentId === pid) {
        out.push(rec.id);
        walk(rec.id);
      }
    }
  };
  walk(id);
  return out;
}

function framesOf(store) {
  return Object.values(store).filter((r) => r && r.typeName === 'shape' && r.type === 'frame');
}

function topLevelFramesOf(store) {
  return framesOf(store).filter((r) => isTopLevelSlideFrame(r, r.parentId?.startsWith?.('page:') ? r.parentId : PAGE_ID));
}

function applyStripToStore(store, frames) {
  for (const box of frames) {
    const rec = store[box.id];
    if (!rec || rec.type !== 'frame') continue;
    rec.x = box.x;
    rec.y = box.y;
  }
}

function reflowTopLevelStrip(store) {
  const ordered = sortFramesForStrip(topLevelFramesOf(store)).map((f) => ({
    id: f.id,
    x: f.x,
    y: f.y,
    w: f.props?.w,
    h: f.props?.h,
    index: f.index
  }));
  applyStripToStore(store, placeFramesInStrip(ordered));
}

function ensureShape(store, id) {
  const rec = store[id];
  if (!rec || rec.typeName !== 'shape') return null;
  rec.props = rec.props && typeof rec.props === 'object' ? rec.props : {};
  rec.meta = rec.meta && typeof rec.meta === 'object' ? rec.meta : {};
  return rec;
}

function applyText(rec, text) {
  const t = String(text ?? '');
  if (rec.type === 'frame') rec.props.name = t;
  else if (rec.type === 'text' || rec.type === 'note' || rec.type === 'geo' || rec.type === 'arrow') {
    rec.props.richText = richText(t);
    if (typeof rec.props.text === 'string') rec.props.text = t;
  } else {
    rec.props.text = t;
  }
  rec.meta.pawText = t;
}

function applyColor(rec, color) {
  const c = mapTldrawColor(color) || String(color || '').trim();
  if (!c) return;
  rec.props.color = c;
  rec.meta.fill = c;
}

/**
 * Mutate a tldraw record store. Live-only ops return NEED_TAB.
 * @returns {{ ok: boolean, applied: string[], lastIds: string[], error?: string, code?: string }}
 */
export function applyStoreCommands(store, commands, opts = {}) {
  const list = Array.isArray(commands) ? commands : [];
  const pinned = pinnedNodeIds(opts.selections);
  const applied = [];
  let lastIds = [];
  let lastQa;

  const fail = (code, error, extra) => ({
    ok: false,
    code,
    error,
    applied,
    lastIds,
    available: shapeIds(store),
    ...(extra && typeof extra === 'object' ? extra : {})
  });

  for (const cmd of list) {
    if (!cmd || typeof cmd !== 'object') continue;
    const op = normalizeCanvasOp(cmd.op || cmd.type);
    if (!op) continue;
    if (isLiveOnlyOp(op)) {
      return fail('NEED_TAB', `${op} needs the open Design/Slides canvas`);
    }

    const ids = resolveOpIds(cmd, pinned);
    lastIds = ids.length ? ids : lastIds;

    if (op === 'createFrame' || op === 'insertPlate') {
      const fid = shapeId(cmd.id || cmd.name || `frame_${applied.length}_${Date.now().toString(36)}`);
      const slides = opts.shell === 'slides' || opts.shell === 'deck';
      const frameDefault = defaultCanvasSize(opts.shell);
      const w = Number(cmd.w || cmd.box?.w) || frameDefault.w;
      const h = Number(cmd.h || cmd.box?.h) || frameDefault.h;
      const top = sortFramesForStrip(topLevelFramesOf(store));
      const afterId = String(cmd.afterId || cmd.after || '').trim();
      let afterIdx = afterId
        ? top.findIndex((f) => f.id === shapeId(afterId) || f.id === afterId)
        : ids.find((id) => store[id]?.type === 'frame')
          ? top.findIndex((f) => ids.includes(f.id))
          : top.length - 1;
      if (afterIdx < 0) afterIdx = top.length - 1;
      const planned = slides
        ? planInsertAfter(
            top.map((f) => ({ id: f.id, x: f.x, y: f.y, w: f.props?.w, h: f.props?.h, index: f.index })),
            afterIdx,
            { w, h, newId: fid, name: String(cmd.name || cmd.text || slideFallbackName(top.length)) }
          )
        : null;
      const x = planned ? planned.spec.x : Number(cmd.x || cmd.box?.x) || 80 + top.length * (w + 80);
      const y = planned ? planned.spec.y : Number(cmd.y || cmd.box?.y) || 80;
      store[fid] = {
        id: fid,
        typeName: 'shape',
        type: 'frame',
        x,
        y,
        rotation: 0,
        index: nextIndex(store),
        parentId: PAGE_ID,
        isLocked: false,
        opacity: 1,
        props: fillTldrawShapeProps('frame', {
          w,
          h,
          name: String(planned?.spec.name || cmd.name || cmd.text || (slides ? slideFallbackName(top.length) : 'Frame'))
        }),
        meta: {}
      };
      if (planned) applyStripToStore(store, planned.frames);
      applied.push(op);
      lastIds = [fid];
      continue;
    }

    if (op === 'createShape') {
      const type = String(cmd.shapeType || cmd.shape || cmd.kind || 'geo');
      const sid = shapeId(cmd.id || `${type}_${applied.length}`);
      const pinnedFrame = ids.find((id) => store[id]?.type === 'frame');
      const parentId = String(
        cmd.parentId || pinnedFrame || framesOf(store)[0]?.id || PAGE_ID
      );
      const x = Number(cmd.x || cmd.box?.x) || 40;
      const y = Number(cmd.y || cmd.box?.y) || 40;
      const w = Number(cmd.w || cmd.box?.w) || 240;
      const h = Number(cmd.h || cmd.box?.h) || 120;
      const text = cmd.text != null ? String(cmd.text) : cmd.value != null ? String(cmd.value) : '';
      const rotation =
        cmd.degrees != null
          ? (Number(cmd.degrees) * Math.PI) / 180
          : Number(cmd.radians ?? cmd.rotation) || 0;
      const rec = {
        id: sid,
        typeName: 'shape',
        type: type === 'rect' ? 'geo' : type,
        x,
        y,
        rotation,
        index: nextIndex(store),
        parentId: parentId.startsWith('shape:') ? parentId : PAGE_ID,
        isLocked: false,
        opacity: 1,
        props: {},
        meta: { pawType: String(cmd.pawType || type) }
      };
      if (rec.type === 'geo') {
        rec.props = fillTldrawShapeProps('geo', {
          w,
          h,
          geo: String(cmd.geo || 'rectangle'),
          color: mapTldrawColor(cmd.fill || cmd.color) || 'black',
          fill: cmd.fillKind || 'solid',
          dash: String(cmd.dash || 'draw'),
          size: mapTldrawSize(cmd.size) || 'm',
          font: mapTldrawFont(cmd.font) || 'sans',
          align: 'middle',
          verticalAlign: 'middle',
          richText: richText(text)
        });
      } else if (rec.type === 'text') {
        rec.props = fillTldrawShapeProps('text', {
          color: 'black',
          size: mapTldrawSize(cmd.size) || 'l',
          font: mapTldrawFont(cmd.font) || 'sans',
          textAlign: mapTldrawAlign(cmd.align) || 'start',
          autoSize: false,
          scale: 1,
          w,
          richText: richText(text)
        });
        rec.meta.pawText = text;
      } else if (rec.type === 'frame') {
        rec.props = fillTldrawShapeProps('frame', { w, h, name: text || 'Frame' });
      } else if (rec.type === 'note') {
        rec.props = fillTldrawShapeProps('note', {
          color: mapTldrawColor(cmd.fill || cmd.color) || 'yellow',
          size: 'm',
          font: 'sans',
          align: 'middle',
          verticalAlign: 'middle',
          richText: richText(text),
          growY: 0,
          fontSizeAdjustment: 1,
          url: ''
        });
      } else {
        rec.props = fillTldrawShapeProps(rec.type, { w, h });
      }
      store[sid] = rec;
      applied.push(op);
      lastIds = [sid];
      continue;
    }

    if (op === 'theme') {
      const theme = cmd.theme && typeof cmd.theme === 'object' ? cmd.theme : cmd;
      const color = theme.color || theme.fill || theme.primary;
      const font = theme.font;
      const size = theme.size;
      const targets = ids.length ? ids : Object.values(store).filter((r) => r?.typeName === 'shape' && r.type !== 'frame').map((r) => r.id);
      for (const id of targets) {
        const rec = ensureShape(store, id);
        if (!rec) continue;
        if (color) applyColor(rec, color);
        if (font) {
          const f = mapTldrawFont(font);
          if (f) rec.props.font = f;
        }
        if (size) {
          const sz = mapTldrawSize(size);
          if (sz) rec.props.size = sz;
        }
      }
      applied.push(op);
      lastIds = targets.slice(0, 8);
      continue;
    }

    if (op === 'layout') {
      const layout = String(cmd.layout || cmd.value || 'pack').toLowerCase();
      const frameId = ids.find((id) => store[id]?.type === 'frame') || framesOf(store)[0]?.id;
      if (!frameId) continue;
      const kids = Object.values(store).filter((r) => r && r.typeName === 'shape' && r.parentId === frameId);
      if (layout === 'stack' || layout === 'stack-v' || layout === 'vertical') {
        let y = 24;
        for (const k of kids.sort((a, b) => (a.index || '').localeCompare(b.index || ''))) {
          k.y = y;
          k.x = 24;
          y += (Number(k.props?.h) || 48) + 16;
        }
      } else if (layout === 'stack-h' || layout === 'horizontal') {
        let x = 24;
        for (const k of kids.sort((a, b) => (a.index || '').localeCompare(b.index || ''))) {
          k.x = x;
          k.y = 24;
          x += (Number(k.props?.w) || 48) + 16;
        }
      } else {
        let y = 24;
        for (const k of kids.sort((a, b) => (a.index || '').localeCompare(b.index || ''))) {
          k.x = 24;
          k.y = y;
          y += (Number(k.props?.h) || 48) + 12;
        }
      }
      applied.push(op);
      lastIds = [frameId];
      continue;
    }

    if (op === 'deletePlate' || op === 'delete') {
      const drop = new Set();
      const targets = op === 'deletePlate' ? ids.filter((id) => store[id]?.type === 'frame') : ids;
      const deletedTop = targets.filter((id) => store[id]?.type === 'frame' && isTopLevelSlideFrame(store[id]));
      for (const id of targets) {
        drop.add(id);
        for (const d of descendants(store, id)) drop.add(d);
      }
      for (const id of drop) delete store[id];
      if (deletedTop.length && (opts.shell === 'slides' || opts.shell === 'deck')) {
        const remaining = sortFramesForStrip(topLevelFramesOf(store));
        applyStripToStore(
          store,
          planDeleteFrame(
            remaining.map((f) => ({ id: f.id, x: f.x, y: f.y, w: f.props?.w, h: f.props?.h })),
            ''
          ).frames
        );
      }
      applied.push(op);
      lastIds = [];
      continue;
    }

    if (op === 'reorder') {
      const order = Array.isArray(cmd.order || cmd.nodeIds) ? cmd.order || cmd.nodeIds : ids;
      let i = 1;
      for (const id of order) {
        if (store[id]) store[id].index = indexKey(i++);
      }
      if (opts.shell === 'slides' || opts.shell === 'deck') {
        const ordered = order
          .map((id) => store[shapeId(id)] || store[id])
          .filter((r) => r && r.type === 'frame');
        if (ordered.length) {
          applyStripToStore(
            store,
            placeFramesInStrip(ordered.map((f) => ({ id: f.id, w: f.props?.w, h: f.props?.h, index: f.index })))
          );
        } else {
          reflowTopLevelStrip(store);
        }
      }
      applied.push(op);
      lastIds = order.map(String);
      continue;
    }

    if (op === 'select' || op === 'zoomToSelection' || op === 'zoomToFit' || op === 'zoomToFrame') {
      applied.push(op);
      continue;
    }

    if (op === 'replacePlate') {
      const assessed = assessReplacePlateInStore(store, cmd, pinned);
      if (!assessed.frame) {
        return fail(assessed.need?.code || 'NEED_SELECTION', assessed.need?.error || 'click a slide/frame (or pass plateId / nodeId) before replacePlate');
      }
      if (assessed.compile && assessed.compile.ok === false) {
        return fail(assessed.compile.code || 'INVALID_LAYOUT', assessed.compile.error || 'replacePlate compile failed');
      }
      if (!assessed.ok) {
        return fail(CANVAS_QA_FAILED, assessed.error || 'CANVAS_QA_FAILED', {
          qa: assessed.qa,
          score: assessed.score,
          issues: assessed.issues
        });
      }
      const frame = assessed.frame;
      const compiled = assessed.compiled;
      lastQa = assessed.qa;
      deleteFrameChildren(store, frame.id);
      for (const node of compiled.frame.nodes || []) {
        writeCompiledNode(store, frame.id, node);
      }
      const nextName = resolveReplaceFrameName({
        existing: frame.props?.name,
        explicit: cmd.name,
        slots: cmd.slots
      });
      if (nextName) frame.props.name = nextName;
      frame.meta = {
        ...(frame.meta && typeof frame.meta === 'object' ? frame.meta : {}),
        pawLayout: compiled.layoutId,
        pawTheme: compiled.themeId,
        ...(compiled.variant ? { pawVariant: compiled.variant } : {}),
        ...(compiled.frame?.meta?.pawTransition ? { pawTransition: compiled.frame.meta.pawTransition } : {}),
        ...(compiled.frame?.meta?.pawAnimation ? { pawAnimation: compiled.frame.meta.pawAnimation } : {})
      };
      applied.push(op);
      lastIds = [frame.id];
      continue;
    }

    if (!ids.length) continue;

    if (isTextOp(op)) {
      const text = cmd.text != null ? String(cmd.text) : cmd.value != null ? String(cmd.value) : '';
      const rec = ensureShape(store, ids[0]);
      if (!rec) return fail('NOT_FOUND', `node not found: ${ids[0]}`);
      applyText(rec, text);
      applied.push(op);
      lastIds = [ids[0]];
      continue;
    }

    if (isImageOp(op) && op !== 'propagateSlotSrc') {
      const rec = ensureShape(store, ids[0]);
      if (!rec) return fail('NOT_FOUND', `node not found: ${ids[0]}`);
      const src = String(cmd.src || cmd.value || cmd.path || cmd.item || cmd.handle || '').trim();
      rec.meta.src = src;
      if (cmd.sourceBox || cmd.cropBox) rec.meta.sourceBox = cmd.sourceBox || cmd.cropBox;
      let aid = rec.props.assetId;
      if (!aid && rec.type === 'image') {
        aid = `asset:${String(ids[0]).replace(/^shape:/, '')}`;
        rec.props.assetId = aid;
        rec.props.url = '';
      }
      if (aid) {
        store[aid] = {
          id: aid,
          typeName: 'asset',
          type: 'image',
          props: {
            ...(store[aid]?.props || {}),
            w: rec.props.w || 320,
            h: rec.props.h || 200,
            name: aid,
            isAnimated: false,
            src
          },
          meta: store[aid]?.meta || {}
        };
      }
      applied.push(op);
      lastIds = [ids[0]];
      continue;
    }

    if (op === 'propagateSlotSrc') {
      const srcId = ids[0];
      const srcRec = ensureShape(store, srcId);
      const src = String(cmd.src || srcRec?.meta?.src || store[srcRec?.props?.assetId]?.props?.src || '');
      for (const rec of Object.values(store)) {
        if (!rec || rec.typeName !== 'shape' || rec.type !== 'image' || rec.id === srcId) continue;
        rec.meta = { ...(rec.meta || {}), src };
        if (rec.props?.assetId && store[rec.props.assetId]) {
          store[rec.props.assetId].props = { ...(store[rec.props.assetId].props || {}), src };
        }
      }
      applied.push(op);
      lastIds = [srcId];
      continue;
    }

    if (op === 'setBox') {
      const rec = ensureShape(store, ids[0]);
      if (!rec) return fail('NOT_FOUND', `node not found: ${ids[0]}`);
      const b = cmd.box || cmd;
      if (b.x != null) rec.x = Number(b.x);
      if (b.y != null) rec.y = Number(b.y);
      if (b.w != null) rec.props.w = Number(b.w);
      if (b.h != null) rec.props.h = Number(b.h);
      applied.push(op);
      lastIds = [ids[0]];
      continue;
    }

    if (op === 'setFill' || op === 'setStyle') {
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (!rec) continue;
        const fill = cmd.fill || cmd.color || cmd.style?.color;
        if (fill) applyColor(rec, fill);
        const font = cmd.font || cmd.style?.font;
        if (font) {
          const f = mapTldrawFont(font);
          if (f) rec.props.font = f;
        }
        const size = cmd.size || cmd.style?.size;
        if (size) {
          const sz = mapTldrawSize(size);
          if (sz) rec.props.size = sz;
        }
        const align = cmd.align || cmd.textAlign || cmd.style?.align;
        if (align && rec.props) {
          const a = mapTldrawAlign(align);
          if (a) rec.props.textAlign = a;
        }
        if (cmd.geo && rec.type === 'geo') rec.props.geo = String(cmd.geo);
        if (cmd.dash) rec.props.dash = String(cmd.dash);
      }
      applied.push(op);
      continue;
    }

    if (op === 'setOpacity' || op === 'hide' || op === 'show') {
      const o =
        op === 'hide' ? 0 : op === 'show' ? 1 : Math.max(0, Math.min(1, Number(cmd.opacity ?? cmd.value ?? 1)));
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (rec) rec.opacity = o;
      }
      applied.push(op);
      continue;
    }

    if (op === 'lock' || op === 'unlock') {
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (rec) rec.isLocked = op === 'lock';
      }
      applied.push(op);
      continue;
    }

    if (op === 'setNotes') {
      const rec = ensureShape(store, ids[0]);
      if (rec) rec.meta.pawNotes = String(cmd.notes || cmd.text || cmd.value || '');
      applied.push(op);
      continue;
    }

    if (op === 'nudge') {
      const dx = Number(cmd.x ?? cmd.dx ?? cmd.offset?.x) || 0;
      const dy = Number(cmd.y ?? cmd.dy ?? cmd.offset?.y) || 0;
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (!rec) continue;
        rec.x = (Number(rec.x) || 0) + dx;
        rec.y = (Number(rec.y) || 0) + dy;
      }
      applied.push(op);
      continue;
    }

    if (op === 'rotate') {
      const deg = Number(cmd.degrees ?? cmd.deg ?? cmd.value) || 0;
      const rad = cmd.radians != null ? Number(cmd.radians) : (deg * Math.PI) / 180;
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (rec) rec.rotation = (Number(rec.rotation) || 0) + rad;
      }
      applied.push(op);
      continue;
    }

    if (op === 'flip') {
      const axis = String(cmd.axis || cmd.value || 'horizontal').toLowerCase();
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (!rec) continue;
        if (axis.startsWith('v')) rec.props.flipY = !rec.props.flipY;
        else rec.props.flipX = !rec.props.flipX;
      }
      applied.push(op);
      continue;
    }

    if (op === 'align') {
      const dir = mapAlignOperation(cmd.align || cmd.value || cmd.axis);
      const boxes = ids.map((id) => ({ id, rec: store[id], ...recBox(store[id] || {}) })).filter((b) => b.rec);
      if (boxes.length < 2) return fail('NEED_SELECTION', 'select at least two blocks to align');
      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      const maxR = Math.max(...boxes.map((b) => b.x + b.w));
      const maxB = Math.max(...boxes.map((b) => b.y + b.h));
      const midX = (minX + maxR) / 2;
      const midY = (minY + maxB) / 2;
      for (const b of boxes) {
        if (dir === 'left') b.rec.x = minX;
        else if (dir === 'right') b.rec.x = maxR - b.w;
        else if (dir === 'top') b.rec.y = minY;
        else if (dir === 'bottom') b.rec.y = maxB - b.h;
        else if (dir === 'center-horizontal') b.rec.x = midX - b.w / 2;
        else if (dir === 'center-vertical') b.rec.y = midY - b.h / 2;
      }
      applied.push(op);
      continue;
    }

    if (op === 'distribute' || op === 'stack') {
      const axis = String(cmd.axis || cmd.value || cmd.align || 'horizontal').toLowerCase();
      const vertical = axis.startsWith('v') || axis === 'vertical';
      const boxes = ids
        .map((id) => ({ id, rec: store[id], ...recBox(store[id] || {}) }))
        .filter((b) => b.rec)
        .sort((a, b) => (vertical ? a.y - b.y : a.x - b.x));
      if (boxes.length < 2) return fail('NEED_SELECTION', 'select at least two blocks');
      if (op === 'stack') {
        const gap = Number(cmd.gap) || 16;
        if (vertical) {
          let y = boxes[0].y;
          for (const b of boxes) {
            b.rec.y = y;
            y += b.h + gap;
          }
        } else {
          let x = boxes[0].x;
          for (const b of boxes) {
            b.rec.x = x;
            x += b.w + gap;
          }
        }
      } else if (boxes.length >= 3) {
        const first = boxes[0];
        const last = boxes[boxes.length - 1];
        if (vertical) {
          const span = last.y - first.y;
          const step = span / (boxes.length - 1);
          boxes.forEach((b, i) => {
            b.rec.y = first.y + i * step;
          });
        } else {
          const span = last.x - first.x;
          const step = span / (boxes.length - 1);
          boxes.forEach((b, i) => {
            b.rec.x = first.x + i * step;
          });
        }
      }
      applied.push(op);
      continue;
    }

    if (op === 'group') {
      if (ids.length < 2) return fail('NEED_SELECTION', 'select at least two blocks to group');
      const recs = ids.map((id) => store[id]).filter((r) => r && r.typeName === 'shape');
      const parentId = recs[0]?.parentId || PAGE_ID;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const r of recs) {
        const b = recBox(r);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
      }
      const gid = shapeId(`group_${Date.now().toString(36)}`);
      store[gid] = {
        id: gid,
        typeName: 'shape',
        type: 'group',
        x: minX,
        y: minY,
        rotation: 0,
        index: nextIndex(store),
        parentId,
        isLocked: false,
        opacity: 1,
        props: fillTldrawShapeProps('group', {}),
        meta: { pawType: 'group' }
      };
      for (const r of recs) {
        r.parentId = gid;
        r.x = (Number(r.x) || 0) - minX;
        r.y = (Number(r.y) || 0) - minY;
      }
      applied.push(op);
      lastIds = [gid];
      continue;
    }

    if (op === 'ungroup') {
      for (const id of ids) {
        const g = ensureShape(store, id);
        if (!g || g.type !== 'group') continue;
        const kids = Object.values(store).filter((r) => r && r.parentId === id);
        for (const k of kids) {
          k.parentId = g.parentId;
          k.x = (Number(k.x) || 0) + (Number(g.x) || 0);
          k.y = (Number(k.y) || 0) + (Number(g.y) || 0);
        }
        delete store[id];
      }
      applied.push(op);
      continue;
    }

    if (Z_OPS.has(op)) {
      if (op === 'bringToFront' || op === 'bringForward') {
        for (const id of ids) {
          const rec = ensureShape(store, id);
          if (rec) rec.index = nextIndex(store);
        }
      } else {
        let i = 0;
        for (const id of ids) {
          const rec = ensureShape(store, id);
          if (rec) rec.index = indexKey(i++);
        }
      }
      applied.push(op);
      continue;
    }

    if (op === 'reparent') {
      const parentId = String(cmd.parentId || cmd.frameId || '').trim();
      if (!parentId) continue;
      for (const id of ids) {
        const rec = ensureShape(store, id);
        if (rec) rec.parentId = parentId;
      }
      applied.push(op);
      continue;
    }

    if (op === 'duplicate') {
      const copies = [];
      for (const id of ids) {
        const rec = store[id];
        if (!rec || rec.typeName !== 'shape') continue;
        const nid = shapeId(`${String(id).replace(/^shape:/, '')}_copy`);
        store[nid] = {
          ...structuredClone(rec),
          id: nid,
          x: (Number(rec.x) || 0) + 24,
          y: (Number(rec.y) || 0) + 24,
          index: nextIndex(store)
        };
        copies.push(nid);
      }
      applied.push(op);
      lastIds = copies;
      continue;
    }
  }

  return { ok: true, applied, lastIds, available: shapeIds(store), ...(lastQa ? { qa: lastQa } : {}) };
}

function assessReplacePlateInStore(store, cmd, pinned) {
  const target = resolveReplacePlateFrame(store, cmd, pinned);
  if (!target.frame) return { ok: true, skipped: true, need: target };
  const frame = target.frame;
  const themeId =
    String(cmd.themeId || frame.meta?.pawTheme || firstChildTheme(store, frame.id) || DEFAULT_THEME_ID).trim() ||
    DEFAULT_THEME_ID;
  const compiled = compileLayoutFrame(
    {
      id: String(frame.id || '').replace(/^shape:/, ''),
      layoutId: cmd.layoutId,
      themeId,
      variant: cmd.variant || cmd.pawVariant || frame.meta?.pawVariant,
      slots: cmd.slots,
      name: cmd.name
    },
    { themeId, variant: cmd.variant || cmd.pawVariant }
  );
  if (!compiled.ok) return { ok: true, skipped: true, compile: compiled, frame };
  const gated = gateReplacePlate(compiled.frame, {
    themeId: compiled.themeId,
    targetSize: { w: Number(frame.props?.w) || compiled.frame.size?.w, h: Number(frame.props?.h) || compiled.frame.size?.h }
  });
  return { ...gated, compiled, frame };
}

/**
 * Fail-close replacePlate before live apply. Compile errors / NEED_SELECTION stay for apply.
 */
export function preflightReplacePlatesFromStore(store, commands, selections) {
  const pinned = pinnedNodeIds(selections);
  let qa;
  for (const cmd of commands || []) {
    if (!cmd || typeof cmd !== 'object') continue;
    if (normalizeCanvasOp(cmd.op || cmd.type) !== 'replacePlate') continue;
    const assessed = assessReplacePlateInStore(store, cmd, pinned);
    if (assessed.skipped) continue;
    if (!assessed.ok) return assessed;
    qa = assessed.qa;
  }
  return { ok: true, qa };
}

function shapeIds(store) {
  return Object.keys(store).filter((k) => k.startsWith('shape:'));
}

function resolveReplacePlateFrame(store, cmd, pinned) {
  const keys = [cmd.plateId, cmd.frameId, cmd.nodeId, cmd.slotId, cmd.id]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const explicit = [];
  for (const key of keys) {
    const fr = frameFromKey(store, key);
    if (fr && !explicit.some((f) => f.id === fr.id)) explicit.push(fr);
  }
  if (keys.length && !explicit.length) {
    return { code: 'NEED_SELECTION', error: `replacePlate target not found: ${keys[0]}` };
  }
  if (explicit.length > 1) {
    return { code: 'NEED_SELECTION', error: 'replacePlate needs exactly one target frame' };
  }
  if (explicit.length === 1) return { frame: explicit[0] };
  const selected = [];
  for (const key of pinned || []) {
    const fr = frameFromKey(store, key);
    if (fr && !selected.some((f) => f.id === fr.id)) selected.push(fr);
  }
  if (selected.length === 1) return { frame: selected[0] };
  if (selected.length > 1) {
    return { code: 'NEED_SELECTION', error: 'replacePlate needs exactly one target frame' };
  }
  return { code: 'NEED_SELECTION', error: 'click a slide/frame (or pass plateId / nodeId) before replacePlate' };
}

function frameFromKey(store, raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  const id = key.startsWith('shape:') ? key : `shape:${key}`;
  const rec = store[id] || store[key];
  if (rec?.type === 'frame') return rec;
  if (rec?.parentId && store[rec.parentId]?.type === 'frame') return store[rec.parentId];
  return (
    framesOf(store).find(
      (f) => f.id === id || f.id === key || String(f.props?.name || '') === key || String(f.id).replace(/^shape:/, '') === key
    ) || null
  );
}

function firstChildTheme(store, frameId) {
  for (const rec of Object.values(store)) {
    if (rec && rec.typeName === 'shape' && rec.parentId === frameId && rec.meta?.pawTheme) {
      return rec.meta.pawTheme;
    }
  }
  return '';
}

function deleteFrameChildren(store, frameId) {
  const drop = descendants(store, frameId);
  const assets = new Set();
  for (const id of drop) {
    const rec = store[id];
    if (rec?.type === 'image' && rec.props?.assetId) assets.add(rec.props.assetId);
    delete store[id];
  }
  for (const aid of assets) {
    const used = Object.values(store).some((r) => r && r.props?.assetId === aid);
    if (!used) delete store[aid];
  }
}

function writeCompiledNode(store, parentId, node) {
  const rawId = String(node.id || 'n').replace(/[^a-zA-Z0-9_-]/g, '') || 'n';
  const id = shapeId(rawId);
  const box = node.box || {};
  const x = Number(box.x) || 0;
  const y = Number(box.y) || 0;
  const w = Number(box.w) || 240;
  const h = Number(box.h) || 48;
  const meta = node.meta && typeof node.meta === 'object' ? { ...node.meta } : {};
  const isGeo = node.type === 'geo' || node.type === 'color-block' || node.geo;
  if (isGeo && node.type !== 'image') {
    store[id] = {
      id,
      typeName: 'shape',
      type: 'geo',
      x,
      y,
      rotation: 0,
      index: nextIndex(store),
      parentId,
      isLocked: false,
      opacity: 1,
      props: fillTldrawShapeProps('geo', {
        w,
        h,
        geo: String(node.geo || 'rectangle'),
        color: mapTldrawColor(node.fill || node.color) || 'light-blue',
        fill: node.fillKind || 'solid',
        dash: String(node.dash || 'solid'),
        size: 'm',
        font: mapTldrawFont(node.font) || 'sans',
        align: 'middle',
        verticalAlign: 'middle',
        richText: richText(String(node.text || ''))
      }),
      meta: { pawId: rawId, pawKind: 'geo', fill: node.fill || node.color || '', ...meta }
    };
    return;
  }
  if (node.type === 'image' || node.tag === 'img' || node.src) {
    const src = String(node.src || '').trim();
    if (!src) return;
    const assetId = `asset:${rawId}`;
    store[assetId] = {
      id: assetId,
      typeName: 'asset',
      type: 'image',
      props: { w, h, name: rawId, isAnimated: false, mimeType: /^data:image\/svg/i.test(src) ? 'image/svg+xml' : 'image/png', src },
      meta: { pawId: rawId }
    };
    store[id] = {
      id,
      typeName: 'shape',
      type: 'image',
      x,
      y,
      rotation: 0,
      index: nextIndex(store),
      parentId,
      isLocked: false,
      opacity: 1,
      props: fillTldrawShapeProps('image', {
        w,
        h,
        playing: true,
        url: '',
        assetId,
        crop: null,
        flipX: false,
        flipY: false,
        altText: String(node.alt || '')
      }),
      meta: { src, pawId: rawId, pawKind: 'image', ...meta }
    };
    return;
  }
  const text = String(node.text || '');
  store[id] = {
    id,
    typeName: 'shape',
    type: 'text',
    x,
    y,
    rotation: 0,
    index: nextIndex(store),
    parentId,
    isLocked: false,
    opacity: 1,
    props: fillTldrawShapeProps('text', {
      color: mapTldrawColor(node.color || node.fill) || 'black',
      size: mapTldrawSize(node.size) || (node.type === 'headline' || node.type === 'heading' ? 'xl' : 'm'),
      font: mapTldrawFont(node.font) || 'sans',
      textAlign: mapTldrawAlign(node.align) || 'start',
      autoSize: false,
      scale: Number(node.scale) > 0 ? Number(node.scale) : 1,
      w,
      richText: richText(text)
    }),
    meta: { pawText: text, pawId: rawId, pawType: node.type || 'text', ...meta }
  };
}

export { PAGE_ID };
