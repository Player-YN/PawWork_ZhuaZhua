/**
 * Host-owned Slides frame strip. One policy for headless compile and live ops.
 * Slides are 16:9 Frames on one tldraw page — never tldraw Pages.
 */

export const SLIDE_FRAME_SIZE = { w: 1920, h: 1080 };
export const SLIDE_STRIP_GAP = 200;
export const SLIDE_STRIP_ORIGIN = { x: 80, y: 80 };
export const SLIDE_STRIP_ORIGIN_EPS = 48;
export const SLIDE_OVERLAP_RATIO = 0.5;

export function slideFrameSize(opts = {}) {
  const w = Number(opts.w ?? opts.size?.w) || SLIDE_FRAME_SIZE.w;
  const h = Number(opts.h ?? opts.size?.h) || SLIDE_FRAME_SIZE.h;
  return { w, h };
}

export function slideStripGap(opts = {}) {
  const n = Number(opts.gap);
  return Number.isFinite(n) && n >= 0 ? n : SLIDE_STRIP_GAP;
}

export function slideStripOrigin(opts = {}) {
  const raw = opts.origin && typeof opts.origin === 'object' ? opts.origin : SLIDE_STRIP_ORIGIN;
  return {
    x: finiteCoord(raw.x, SLIDE_STRIP_ORIGIN.x),
    y: finiteCoord(raw.y, SLIDE_STRIP_ORIGIN.y)
  };
}

export function slideStripStep(size, opts = {}) {
  return slideFrameSize(size).w + slideStripGap(opts);
}

export function finiteCoord(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function normalizeFrameBox(frame, opts = {}) {
  const size = slideFrameSize({ w: frame?.w ?? frame?.width, h: frame?.h ?? frame?.height, size: opts.size });
  return {
    id: frame?.id || frame?.nodeId || '',
    x: finiteCoord(frame?.x, 0),
    y: finiteCoord(frame?.y, 0),
    w: Number(frame?.w ?? frame?.width) > 0 ? Number(frame?.w ?? frame?.width) : size.w,
    h: Number(frame?.h ?? frame?.height) > 0 ? Number(frame?.h ?? frame?.height) : size.h,
    name: frame?.name,
    index: frame?.index
  };
}

export function slideStripBox(index, size, opts = {}) {
  const paper = slideFrameSize(size);
  const origin = slideStripOrigin(opts);
  const gap = slideStripGap(opts);
  const i = Math.max(0, Number(index) || 0);
  return {
    x: origin.x + i * (paper.w + gap),
    y: origin.y,
    w: paper.w,
    h: paper.h
  };
}

export function placeFramesInStrip(frames, opts = {}) {
  const list = Array.isArray(frames) ? frames : [];
  return list.map((frame, i) => {
    const box = normalizeFrameBox(frame, opts);
    const placed = slideStripBox(i, box, opts);
    return { ...frame, ...box, x: placed.x, y: placed.y, w: box.w, h: box.h };
  });
}

export function sortFramesForStrip(frames) {
  return [...(Array.isArray(frames) ? frames : [])].sort((a, b) => {
    const dx = finiteCoord(a?.x) - finiteCoord(b?.x);
    if (Math.abs(dx) > 8) return dx;
    const dy = finiteCoord(a?.y) - finiteCoord(b?.y);
    if (Math.abs(dy) > 8) return dy;
    const ia = String(a?.index || '');
    const ib = String(b?.index || '');
    if (ia && ib && ia !== ib) return ia.localeCompare(ib);
    return String(a?.id || a?.nodeId || '').localeCompare(String(b?.id || b?.nodeId || ''));
  });
}

function overlapRatio(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(ax2, bx2);
  const y2 = Math.min(ay2, by2);
  const w = x2 - x1;
  const h = y2 - y1;
  if (!(w > 0) || !(h > 0)) return 0;
  const inter = w * h;
  const minArea = Math.min(a.w * a.h, b.w * b.h);
  return minArea > 0 ? inter / minArea : 0;
}

/**
 * Legacy stacked decks only: many 16:9 Frames share an origin or pile on each other.
 * A deliberate custom overview (grid / offset strip) must not be snapped.
 */
export function framesNeedStripMigration(frames) {
  const list = (Array.isArray(frames) ? frames : []).map((f) => normalizeFrameBox(f));
  if (list.length < 2) return false;
  const origin = list[0];
  const allSameOrigin = list.every(
    (f) => Math.abs(f.x - origin.x) <= SLIDE_STRIP_ORIGIN_EPS && Math.abs(f.y - origin.y) <= SLIDE_STRIP_ORIGIN_EPS
  );
  if (allSameOrigin) return true;
  let piled = 0;
  for (const frame of list) {
    if (list.some((other) => other !== frame && overlapRatio(frame, other) >= SLIDE_OVERLAP_RATIO)) {
      piled += 1;
    }
  }
  return piled >= list.length;
}

export function migrateOverlappingSlideFrames(frames, opts = {}) {
  const list = (Array.isArray(frames) ? frames : []).map((f) => normalizeFrameBox(f));
  if (!framesNeedStripMigration(list)) {
    return { migrated: false, frames: list };
  }
  return { migrated: true, frames: placeFramesInStrip(sortFramesForStrip(list), opts) };
}

export function planInsertAfter(frames, afterIndex, opts = {}) {
  const list = Array.isArray(frames) ? frames.map((f) => normalizeFrameBox(f)) : [];
  const raw = Number(afterIndex);
  const idx = Number.isInteger(raw) ? Math.max(-1, Math.min(list.length - 1, raw)) : list.length - 1;
  const size = slideFrameSize(opts);
  const inserted = {
    id: opts.newId || '',
    name: opts.name || slideFallbackName(list.length),
    ...slideStripBox(idx + 1, size, opts)
  };
  const next = placeFramesInStrip([...list.slice(0, idx + 1), inserted, ...list.slice(idx + 1)], {
    ...opts,
    size
  });
  return {
    spec: next[idx + 1],
    frames: next,
    afterIndex: idx,
    shift: slideStripStep(size, opts)
  };
}

export function planDeleteFrame(frames, id, opts = {}) {
  const list = (Array.isArray(frames) ? frames : []).map((f) => normalizeFrameBox(f));
  const next = placeFramesInStrip(
    list.filter((f) => f.id !== id),
    opts
  );
  return { frames: next };
}

export function reflowSlideStrip(frames, opts = {}) {
  return placeFramesInStrip(frames, opts);
}

export function clampSlideIndex(n, length) {
  const len = Math.max(0, Number(length) || 0);
  if (len <= 0) return 0;
  const i = Number(n);
  if (!Number.isInteger(i)) return 0;
  return Math.max(0, Math.min(len - 1, i));
}

/**
 * Move one item from `fromIndex` to `toIndex` in a list of length `length`.
 * Does not wrap. Same index or a one-item list is a no-op.
 */
export function moveIndexInList(fromIndex, toIndex, length) {
  const len = Math.max(0, Number(length) || 0);
  if (len <= 1) {
    return { from: 0, to: 0, changed: false };
  }
  const from = clampSlideIndex(fromIndex, len);
  const to = clampSlideIndex(toIndex, len);
  return { from, to, changed: from !== to };
}

/**
 * Host-owned filmstrip reorder. Preserves every frame id; only x/y (and caller index) change.
 * `toIndex` is the destination slot in the current list (0 = first, length-1 = last).
 */
export function planReorderFrames(frames, fromIndex, toIndex, opts = {}) {
  const list = (Array.isArray(frames) ? frames : []).map((f) => normalizeFrameBox(f, opts));
  const { from, to, changed } = moveIndexInList(fromIndex, toIndex, list.length);
  if (!changed) {
    return {
      changed: false,
      from,
      to,
      frames: placeFramesInStrip(list, opts),
      order: list.map((f) => f.id)
    };
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  const placed = placeFramesInStrip(next, opts);
  return {
    changed: true,
    from,
    to,
    frames: placed,
    order: placed.map((f) => f.id)
  };
}

export function planReorderByOrder(frames, orderIds, opts = {}) {
  const list = (Array.isArray(frames) ? frames : []).map((f) => normalizeFrameBox(f, opts));
  const byId = new Map();
  for (const frame of list) {
    if (frame.id) byId.set(frame.id, frame);
    const bare = String(frame.id || '').replace(/^shape:/, '');
    if (bare) byId.set(bare, frame);
    byId.set(`shape:${bare}`, frame);
  }
  const next = [];
  const seen = new Set();
  for (const raw of Array.isArray(orderIds) ? orderIds : []) {
    const frame = byId.get(String(raw)) || byId.get(`shape:${String(raw).replace(/^shape:/, '')}`);
    if (frame && !seen.has(frame.id)) {
      seen.add(frame.id);
      next.push(frame);
    }
  }
  for (const frame of list) {
    if (!seen.has(frame.id)) next.push(frame);
  }
  const same = next.length === list.length && next.every((f, i) => f.id === list[i].id);
  const placed = placeFramesInStrip(next, opts);
  return {
    changed: !same && next.length > 1,
    frames: placed,
    order: placed.map((f) => f.id)
  };
}

/**
 * Vertical filmstrip drop target from pointer Y vs item midlines.
 * `rects` are `{ top, height }` in viewport coordinates.
 */
export function filmstripDropIndex(rects, clientY, fromIndex) {
  const list = Array.isArray(rects) ? rects : [];
  if (!list.length) return { from: 0, to: 0, changed: false };
  const y = Number(clientY);
  let to = list.length - 1;
  if (Number.isFinite(y)) {
    for (let i = 0; i < list.length; i++) {
      const top = Number(list[i]?.top ?? list[i]?.y);
      const height = Number(list[i]?.height ?? list[i]?.h);
      if (!Number.isFinite(top) || !Number.isFinite(height)) continue;
      if (y < top + height / 2) {
        to = i;
        break;
      }
    }
  }
  return moveIndexInList(fromIndex, to, list.length);
}

/** Filmstrip keyboard reorder. Does not wrap. Host must only handle this while filmstrip has focus. */
export const FILMSTRIP_REORDER_GESTURE = 'Alt+Shift+ArrowLeft/ArrowRight';

export function isFilmstripReorderKey(e) {
  if (!e || !e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return 0;
  const key = String(e.key || '');
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;
  return 0;
}

function slotText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    return String(value.title || value.quote || value.text || value.name || '').trim();
  }
  return '';
}

export function titleLikeSlotText(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return '';
  return (
    slotText(slots.title) ||
    slotText(slots.quote) ||
    slotText(slots.section) ||
    slotText(slots.sectionTitle)
  );
}

export function clipFrameName(text, max = 48) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function slideFallbackName(index) {
  return `幻灯片 ${Math.max(1, Number(index) + 1)}`;
}

export function resolveSlideFrameName(input = {}) {
  const explicit = String(input.name || '').trim();
  if (explicit) return clipFrameName(explicit);
  const titled = String(input.title || '').trim();
  if (titled) return clipFrameName(titled);
  const fromSlots = titleLikeSlotText(input.slots);
  if (fromSlots) return clipFrameName(fromSlots);
  return slideFallbackName(input.index || 0);
}

export function resolveReplaceFrameName(input = {}) {
  const explicit = String(input.explicit || input.name || '').trim();
  if (explicit) return clipFrameName(explicit);
  const fromSlots = titleLikeSlotText(input.slots);
  if (fromSlots) return clipFrameName(fromSlots);
  return String(input.existing || '').trim();
}

export function isTopLevelSlideFrame(shape, pageId = 'page:page') {
  if (!shape || shape.type !== 'frame') return false;
  const parent = String(shape.parentId || '');
  return !parent || parent === pageId || parent.startsWith('page:');
}
