/**
 * Node-safe frame/viewport helpers (Design compile + tests).
 * Not a live HTML artboard editor.
 */

import { parseBox, defaultPasteboardBox } from './htmlApply.js';

export function artboardSizeFromStyles(styles, kind) {
  const s = String(styles || '');
  const wTok = kind === 'deck' ? '--paw-slide-w' : '--paw-poster-w';
  const hTok = kind === 'deck' ? '--paw-slide-h' : '--paw-poster-h';
  const w = cssPx(s, wTok) || (kind === 'deck' ? 960 : 720);
  const h = cssPx(s, hTok) || (kind === 'deck' ? 540 : 1080);
  return { w, h };
}

export function selectionKey(plateId, slotId) {
  return `${plateId}#${slotId}`;
}

export function toggleSelection(list, plateId, slotId, additive) {
  const key = selectionKey(plateId, slotId);
  const cur = Array.isArray(list) ? list : [];
  if (additive) {
    if (cur.some((s) => selectionKey(s.plateId, s.slotId) === key)) {
      return cur.filter((s) => selectionKey(s.plateId, s.slotId) !== key);
    }
    return [...cur, { plateId, slotId }];
  }
  return [{ plateId, slotId }];
}

export function framesFromBlocks(blocks, opts = {}) {
  const kind = opts.kind || 'poster';
  const defaultSize = opts.size || artboardSizeFromStyles(opts.styles, kind);
  const list = Array.isArray(blocks) ? blocks : [];
  return list.map((b, i) => {
    const parsed = parseBox(b.frameBox) || parseBox(b.box);
    const size = {
      w: Number(parsed?.w) > 0 ? Number(parsed.w) : defaultSize.w,
      h: Number(parsed?.h) > 0 ? Number(parsed.h) : defaultSize.h
    };
    const frameBox = parsed
      ? { x: parsed.x, y: parsed.y, w: size.w, h: size.h }
      : defaultPasteboardBox(i, size, kind);
    return {
      id: b.id || (kind === 'deck' ? `slide-${i + 1}` : i === 0 ? 'poster' : `frame-${i + 1}`),
      html: b.html || '',
      size,
      frameBox,
      name: b.frameName || b.name || b.id || '',
      notes: b.notes || ''
    };
  });
}

export function clampZoom(z) {
  const n = Number(z);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(8, Math.max(0.05, n));
}

export function pasteboardCssTransform(pan, zoom) {
  const p = pan || { x: 0, y: 0 };
  return `translate(${Number(p.x) || 0}px, ${Number(p.y) || 0}px) scale(${clampZoom(zoom)})`;
}

export function zoomAtPoint(state, viewport, client, factor) {
  const z0 = clampZoom(state?.zoom);
  const z1 = clampZoom(z0 * factor);
  const pan = state?.pan || { x: 0, y: 0 };
  const cx = client.x - (viewport.left || 0);
  const cy = client.y - (viewport.top || 0);
  const wx = (cx - pan.x) / z0;
  const wy = (cy - pan.y) / z0;
  return { zoom: z1, pan: { x: cx - wx * z1, y: cy - wy * z1 } };
}

export function applyCanvasWheel(state, event, viewport) {
  const pan = state?.pan || { x: 0, y: 0 };
  const zoom = clampZoom(state?.zoom);
  if (event.ctrlKey || event.metaKey) {
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    return zoomAtPoint({ pan, zoom }, viewport, { x: event.clientX, y: event.clientY }, factor);
  }
  return {
    zoom,
    pan: { x: pan.x - (Number(event.deltaX) || 0), y: pan.y - (Number(event.deltaY) || 0) }
  };
}

export function fitFramesInViewport(frames, viewport, pad = 56) {
  const list = Array.isArray(frames) ? frames : [];
  const vw = Math.max(1, Number(viewport?.w) || 1);
  const vh = Math.max(1, Number(viewport?.h) || 1);
  if (!list.length) return { zoom: 1, pan: { x: pad, y: pad } };
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const f of list) {
    const b = f.frameBox || f;
    const x = Number(b.x) || 0;
    const y = Number(b.y) || 0;
    const w = Number(b.w || b.width) || 0;
    const h = Number(b.h || b.height) || 0;
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y - 22);
    x2 = Math.max(x2, x + w);
    y2 = Math.max(y2, y + h);
  }
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  const innerW = Math.max(1, vw - pad * 2);
  const innerH = Math.max(1, vh - pad * 2);
  const z = clampZoom(Math.min(innerW / w, innerH / h, 1));
  return {
    zoom: z,
    pan: { x: (vw - w * z) / 2 - x1 * z, y: (vh - h * z) / 2 - y1 * z }
  };
}

export function visibleBoardsForKind(boards, kind, currentId) {
  const list = Array.isArray(boards) ? boards : [];
  if (kind !== 'deck') return list;
  const one = list.find((b) => b.id === currentId) || list[0];
  return one ? [one] : [];
}

export function shortLayerLabel(el, slotId) {
  const id = String(slotId || el?.getAttribute?.('data-paw-slot') || '').trim();
  if (id) return id.length > 12 ? id.slice(0, 12) : id;
  const raw = String(el?.getAttribute?.('alt') || el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (raw) return raw.slice(0, 12);
  return String(el?.tagName || 'slot').toLowerCase();
}

function cssPx(styles, name) {
  const m = new RegExp(`${name}\\s*:\\s*([\\d.]+)px`, 'i').exec(styles);
  return m ? Number(m[1]) : 0;
}
