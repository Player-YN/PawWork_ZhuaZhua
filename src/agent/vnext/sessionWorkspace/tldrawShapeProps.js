/**
 * tldraw 5.3.2 shape-prop defaults (packages/tlschema/src/shapes/TL*Shape.ts).
 * Raw store puts / snapshot hydration skip ShapeUtil.getDefaultProps(), so every
 * record we emit or load must already carry required keys (url, scale, …).
 */

export const TLDRAW_SCHEMA_VERSION = '5.3.2';

export function emptyRichText() {
  return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
}

const EMPTY_RT = () => emptyRichText();

/** Required props + defaults for every shape type we emit. Overlay never drops a key. */
export const TLDRAW_SHAPE_PROP_DEFAULTS = Object.freeze({
  geo: Object.freeze({
    geo: 'rectangle',
    dash: 'draw',
    url: '',
    w: 100,
    h: 100,
    growY: 0,
    scale: 1,
    flipX: false,
    flipY: false,
    labelColor: 'black',
    color: 'black',
    fill: 'none',
    size: 'm',
    font: 'draw',
    align: 'middle',
    verticalAlign: 'middle',
    richText: Object.freeze(emptyRichText())
  }),
  text: Object.freeze({
    color: 'black',
    size: 'm',
    font: 'draw',
    textAlign: 'start',
    w: 100,
    richText: Object.freeze(emptyRichText()),
    scale: 1,
    autoSize: true
  }),
  image: Object.freeze({
    w: 100,
    h: 100,
    playing: true,
    url: '',
    assetId: null,
    crop: null,
    flipX: false,
    flipY: false,
    altText: ''
  }),
  frame: Object.freeze({
    w: 100,
    h: 100,
    name: 'Frame',
    color: 'black'
  }),
  group: Object.freeze({}),
  note: Object.freeze({
    color: 'yellow',
    labelColor: 'black',
    size: 'm',
    font: 'draw',
    fontSizeAdjustment: 1,
    align: 'middle',
    verticalAlign: 'middle',
    growY: 0,
    url: '',
    richText: Object.freeze(emptyRichText()),
    scale: 1,
    textLastEditedBy: null
  }),
  arrow: Object.freeze({
    kind: 'arc',
    labelColor: 'black',
    color: 'black',
    fill: 'none',
    dash: 'draw',
    size: 'm',
    arrowheadStart: 'none',
    arrowheadEnd: 'arrow',
    font: 'draw',
    start: Object.freeze({ x: 0, y: 0 }),
    end: Object.freeze({ x: 100, y: 100 }),
    bend: 0,
    richText: Object.freeze(emptyRichText()),
    labelPosition: 0.5,
    scale: 1,
    elbowMidPoint: 0.5
  }),
  line: Object.freeze({
    color: 'black',
    dash: 'draw',
    size: 'm',
    spline: 'line',
    points: Object.freeze({
      a1: Object.freeze({ id: 'a1', index: 'a1', x: 0, y: 0 }),
      a2: Object.freeze({ id: 'a2', index: 'a2', x: 100, y: 0 })
    }),
    scale: 1
  }),
  highlight: Object.freeze({
    color: 'yellow',
    size: 'm',
    segments: Object.freeze([]),
    isComplete: true,
    isPen: false,
    scale: 1,
    scaleX: 1,
    scaleY: 1
  })
});

export function fillTldrawShapeProps(type, props = {}) {
  const defaults = TLDRAW_SHAPE_PROP_DEFAULTS[type];
  const src = props && typeof props === 'object' ? props : {};
  if (!defaults) return { ...src };
  const out = structuredClone(defaults);
  for (const [k, v] of Object.entries(src)) {
    if (v !== undefined) out[k] = v;
  }
  coerceRequired(type, out, defaults);
  return out;
}

export function missingTldrawShapeProps(type, props = {}) {
  const defaults = TLDRAW_SHAPE_PROP_DEFAULTS[type];
  if (!defaults) return [];
  const missing = [];
  for (const key of Object.keys(defaults)) {
    if (!propPresent(key, props?.[key], defaults[key])) missing.push(key);
  }
  return missing;
}

export function normalizeTldrawShapeRecord(rec) {
  if (!rec || rec.typeName !== 'shape' || !rec.type) return rec;
  rec.props = fillTldrawShapeProps(rec.type, rec.props);
  return rec;
}

export function normalizeTldrawStore(store) {
  if (!store || typeof store !== 'object') return store;
  for (const rec of Object.values(store)) normalizeTldrawShapeRecord(rec);
  return store;
}

/** Fill required props on a tldraw editor snapshot before loadSnapshot / <Tldraw snapshot>. */
export function normalizeTldrawSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return snap;
  const store = snap.document?.store || snap.store;
  if (store && typeof store === 'object') normalizeTldrawStore(store);
  return snap;
}

function coerceRequired(type, out, defaults) {
  if ('url' in out && typeof out.url !== 'string') out.url = '';
  if ('scale' in out && !isPositiveNumber(out.scale)) out.scale = 1;
  if ('scaleX' in out && !isPositiveNumber(out.scaleX)) out.scaleX = 1;
  if ('scaleY' in out && !isPositiveNumber(out.scaleY)) out.scaleY = 1;
  if ('w' in out && !isPositiveNumber(out.w)) out.w = defaults.w;
  if ('h' in out && !isPositiveNumber(out.h)) out.h = defaults.h;
  if ('growY' in out && !isNonNegNumber(out.growY)) out.growY = 0;
  if ('flipX' in out && typeof out.flipX !== 'boolean') out.flipX = false;
  if ('flipY' in out && typeof out.flipY !== 'boolean') out.flipY = false;
  if ('playing' in out && typeof out.playing !== 'boolean') out.playing = true;
  if ('autoSize' in out && typeof out.autoSize !== 'boolean') out.autoSize = !!out.autoSize;
  if ('altText' in out && typeof out.altText !== 'string') out.altText = String(out.altText || '');
  if ('name' in out && typeof out.name !== 'string') out.name = String(out.name || defaults.name || '');
  if ('richText' in out && (!out.richText || typeof out.richText !== 'object')) out.richText = EMPTY_RT();
  if (type === 'image' && out.assetId === undefined) out.assetId = null;
  if (type === 'image' && out.crop === undefined) out.crop = null;
  if (type === 'note' && out.textLastEditedBy === undefined) out.textLastEditedBy = null;
  if (type === 'note' && out.fontSizeAdjustment === undefined) out.fontSizeAdjustment = 1;
}

function propPresent(key, value, defaultValue) {
  if (value === undefined) return false;
  if (key === 'url') return typeof value === 'string';
  if (key === 'scale' || key === 'scaleX' || key === 'scaleY' || key === 'w' || key === 'h') {
    return isPositiveNumber(value);
  }
  if (key === 'growY') return isNonNegNumber(value);
  if (key === 'flipX' || key === 'flipY' || key === 'playing' || key === 'autoSize' || key === 'isComplete' || key === 'isPen') {
    return typeof value === 'boolean';
  }
  if (key === 'richText') return !!(value && typeof value === 'object');
  if (key === 'points') return !!(value && typeof value === 'object');
  if (key === 'segments') return Array.isArray(value);
  if (typeof defaultValue === 'string') return typeof value === 'string';
  return value !== undefined;
}

function isPositiveNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0;
}

function isNonNegNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0;
}
