/**
 * Single host translation: Agent refs (图片N / wi_… / /artifacts) → data URL.
 * Sheet, deck, and doc writes all go through here before the engine.
 */

import { classifySheetImageSrc, parseA1, indexToCol } from './sheetApply.js';
import { isVisualLabelKind, listBoundItemIndex, resolveBoundItemRef } from './itemLabel.js';
import { decodeDataUrl, ensureItemPixels } from './itemPixels.js';
import { guestPathFromSrc, guestPathToDataUrl, isGuestArtifactPath } from './htmlMedia.js';

export const SHEET_DRAWING_OPS = new Set(['insertImage', 'insertCellImage', 'insertFloatImage']);
export const HTML_IMAGE_OPS = new Set(['setSlotSrc', 'propagateSlotSrc', 'setSrc', 'updateImage']);
export const DOC_IMAGE_OPS = new Set(['insertImage']);

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function imageOps(extra) {
  if (extra && extra.size) return extra;
  return new Set([...SHEET_DRAWING_OPS, ...HTML_IMAGE_OPS, ...DOC_IMAGE_OPS]);
}

export function isOfficeImageOp(op) {
  return imageOps().has(String(op || ''));
}

/**
 * Skill/model image ref aliases: src | path | item | handle | image | url | artifactId.
 * `value` is a write-op fallback (setSlotSrc / insertCellImage), not a scene text field.
 */
export function officeImageRef(raw = {}, opts = {}) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw !== 'object') return String(raw || '').trim();
  const allowValue = opts.allowValue !== false;
  return String(
    raw.src ||
      raw.path ||
      raw.artifactId ||
      raw.item ||
      raw.handle ||
      raw.image ||
      raw.url ||
      (allowValue ? raw.value : '') ||
      ''
  ).trim();
}

export function listBoundImageItems(store, sessionId) {
  return listBoundItemIndex(store, sessionId).filter((m) => isVisualLabelKind(m.kind));
}

export function enumerateA1Cells(a1, sheet) {
  const parsed = parseA1(a1 || '');
  if (parsed.wholeCol || parsed.wholeRow) return [];
  const out = [];
  const sh = parsed.sheet || sheet || '';
  for (let r = parsed.sr; r <= parsed.er; r++) {
    for (let c = parsed.sc; c <= parsed.ec; c++) {
      out.push({ a1: `${indexToCol(c)}${r + 1}`, sheet: sh });
    }
  }
  return out;
}

/**
 * @returns {Promise<{ ok: boolean, src?: string, error?: string }>}
 */
export async function resolveOfficeAsset(store, sessionId, ref, opts = {}) {
  const raw = String(ref || '').trim();
  if (!raw) return { ok: false, error: 'empty image ref' };
  if (/^data:image\//i.test(raw)) return { ok: true, src: raw };
  if (store?.has?.('artifacts', raw)) {
    const rec = store.get('artifacts', raw);
    if (rec && (!rec.sessionId || rec.sessionId === sessionId) && rec.primaryPath && opts.fs) {
      const data = guestPathToDataUrl(opts.fs, store, sessionId, rec.primaryPath);
      if (data) return { ok: true, src: data, artifactId: raw, path: rec.primaryPath };
      return { ok: false, error: 'artifact image not found', src: rec.primaryPath || raw };
    }
  }
  const bound = raw.replace(/^artifact:\/\/bound\//i, '').trim();
  if (/^data:text\/plain[;,]|^data:application\/octet-stream[;,]/i.test(raw)) {
    try {
      const decoded = decodeDataUrl(raw);
      const head = new TextDecoder().decode(decoded.bytes.slice(0, 240)).trim();
      if (/^<svg\b/i.test(head) || decoded.mimeType.includes('svg')) {
        return {
          ok: true,
          src: `data:image/svg+xml;base64,${bytesToBase64(decoded.bytes)}`
        };
      }
    } catch {
      /* not a disguised svg */
    }
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:')) return { ok: true, src: raw };
  if (opts.fs && isGuestArtifactPath(raw)) {
    const data = guestPathToDataUrl(opts.fs, store, sessionId, raw);
    if (data) return { ok: true, src: data, path: guestPathFromSrc(raw) };
    return { ok: false, error: 'artifact image not found', src: raw };
  }
  const classified = classifySheetImageSrc(bound || raw);
  if (classified.kind === 'dataUrl' || classified.kind === 'url') {
    return { ok: true, src: classified.src };
  }
  const lookup = classified.ref || bound || raw;
  let id = resolveBoundItemRef(store, sessionId, lookup);
  if (!id && store.has('items', raw)) id = raw;
  if (!id) return { ok: false, error: 'image item not found', src: raw };
  const item = store.get('items', id);
  const pix = await ensureItemPixels(store, item, opts);
  if (pix?.ok && pix.bytes?.byteLength) {
    const mime = pix.mimeType || 'image/png';
    return { ok: true, src: `data:${mime};base64,${bytesToBase64(pix.bytes)}`, itemId: id };
  }
  const fallback = String(item?.capture?.src || item?.src || item?.capture?.preview?.src || '').trim();
  if (/^https?:\/\//i.test(fallback) || fallback.startsWith('blob:')) {
    return { ok: true, src: fallback, itemId: id };
  }
  return {
    ok: false,
    error: pix?.error || pix?.code || 'image bytes unavailable',
    src: raw
  };
}

/**
 * Fill insertCellImage / setSlotSrc that omitted src using bound images in order.
 */
export function expandOmittedImageCommands(store, sessionId, commands, opts = {}) {
  const images = listBoundImageItems(store, sessionId);
  let imgIndex = 0;
  const out = [];
  for (const cmd of commands || []) {
    if (!cmd || !isOfficeImageOp(cmd.op)) {
      out.push(cmd);
      continue;
    }
    const src = officeImageRef(cmd);
    if (src) {
      out.push(cmd);
      continue;
    }
    const cells = SHEET_DRAWING_OPS.has(cmd.op)
      ? enumerateA1Cells(cmd.a1 || opts.defaultA1, cmd.sheet || opts.defaultSheet)
      : [{ a1: cmd.a1, sheet: cmd.sheet }];
    const targets = cells.length ? cells : [{ a1: cmd.a1, sheet: cmd.sheet }];
    for (const cell of targets) {
      const img = images[imgIndex++];
      if (!img) {
        out.push({
          ...cmd,
          a1: cell.a1 || cmd.a1,
          sheet: cell.sheet || cmd.sheet,
          srcError: 'no bound image for this cell'
        });
        continue;
      }
      out.push({
        ...cmd,
        a1: cell.a1 || cmd.a1,
        sheet: cell.sheet || cmd.sheet,
        src: img.id,
        item: img.handle
      });
    }
  }
  return out;
}

export async function hydrateOfficeImageCommands(store, sessionId, commands, opts = {}) {
  const ops = imageOps(opts.ops);
  const out = [];
  for (const cmd of commands || []) {
    if (!cmd || !ops.has(String(cmd.op || ''))) {
      out.push(cmd);
      continue;
    }
    if (cmd.srcError) {
      out.push(cmd);
      continue;
    }
    const raw = officeImageRef(cmd);
    const resolved = await resolveOfficeAsset(store, sessionId, raw, opts);
    if (resolved.ok) {
      const guest =
        resolved.path ||
        (isGuestArtifactPath(raw) ? guestPathFromSrc(raw) : '') ||
        (resolved.artifactId && store.get('artifacts', resolved.artifactId)?.primaryPath) ||
        '';
      const src = opts.persistGuestPath && guest ? guest : resolved.src;
      out.push({ ...cmd, src, path: guest || cmd.path });
      continue;
    }
    out.push({ ...cmd, src: raw, srcError: resolved.error || 'image item not found' });
  }
  return out;
}

/** @deprecated use hydrateOfficeImageCommands */
export async function hydrateSheetImageCommands(store, sessionId, commands, opts = {}) {
  return hydrateOfficeImageCommands(store, sessionId, commands, { ...opts, ops: SHEET_DRAWING_OPS });
}

export function drawingHydrateFailed(commands) {
  return (commands || []).filter((c) => c && isOfficeImageOp(c.op) && c.srcError);
}

export function readbackLooksLikeUnresolvedImage(readback) {
  const cells = [];
  const values = readback?.values;
  if (Array.isArray(values)) {
    for (const row of values) {
      if (!Array.isArray(row)) continue;
      for (const v of row) cells.push(v);
    }
  }
  if (readback?.src != null) cells.push(readback.src);
  if (readback?.text != null) cells.push(readback.text);
  return cells.some((v) => {
    const s = String(v || '');
    return /\[image:/i.test(s) || /^wi_/i.test(s) || /^图片\d+$/i.test(s);
  });
}
