/**
 * Slides stage helpers — node-safe.
 * Slides stay 16:9 frames (not tldraw Pages). Camera pin + blank-slide placement.
 */
import { SLIDES_CANVAS_SIZE } from './canvasOps.js';
import {
  SLIDE_STRIP_GAP,
  SLIDE_STRIP_ORIGIN,
  planInsertAfter,
  slideFrameSize,
  slideFallbackName
} from './slidesLayout.js';

export const SLIDE_GAP = SLIDE_STRIP_GAP;
export const SLIDE_CAMERA_PADDING = 48;
export const SLIDE_ORIGIN = { ...SLIDE_STRIP_ORIGIN };

export function slideSize(opts = {}) {
  return slideFrameSize({
    w: opts.w ?? opts.size?.w ?? SLIDES_CANVAS_SIZE.w,
    h: opts.h ?? opts.size?.h ?? SLIDES_CANVAS_SIZE.h
  });
}

/**
 * Place a blank 16:9 frame after `afterIndex` (-1 = before first).
 * Host reflows the strip so the new slide does not stack.
 */
export function createBlankSlideSpec(frames, afterIndex, opts = {}) {
  const planned = planInsertAfter(frames, afterIndex, {
    ...opts,
    size: slideSize(opts),
    name: opts.name || slideFallbackName(Array.isArray(frames) ? frames.length : 0)
  });
  return {
    x: planned.spec.x,
    y: planned.spec.y,
    w: planned.spec.w,
    h: planned.spec.h,
    name: planned.spec.name,
    afterIndex: planned.afterIndex,
    shift: planned.shift,
    frames: planned.frames
  };
}

export function placeBlankSlide(frames, afterIndex, opts = {}) {
  const spec = createBlankSlideSpec(frames, afterIndex, opts);
  return { spec, next: spec.frames };
}

export function boxToBounds(box) {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w ?? box.width);
  const h = Number(box.h ?? box.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n)) || !(w > 0) || !(h > 0)) return null;
  return { x, y, w, h };
}

/**
 * tldraw setCameraOptions payload.
 * page: pin to the current frame. overview: drop constraints (caller zoomToFit).
 */
export function slideCameraOptions(bounds, mode) {
  if (mode === 'overview') {
    return { constraints: undefined };
  }
  const box = boxToBounds(bounds);
  if (!box) return { constraints: undefined };
  return {
    constraints: {
      bounds: box,
      behavior: 'contain',
      initialZoom: 'fit-max',
      baseZoom: 'fit-max',
      origin: { x: 0.5, y: 0.5 },
      padding: { x: SLIDE_CAMERA_PADDING, y: SLIDE_CAMERA_PADDING }
    }
  };
}

export function isRasterArtifact(rec) {
  const mime = String(rec?.mimeType || rec?.mime || '');
  const name = String(rec?.name || rec?.primaryPath || '');
  return /^image\/(png|jpe?g|webp|gif)$/i.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(name);
}
