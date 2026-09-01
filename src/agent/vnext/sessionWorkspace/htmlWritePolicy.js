/**
 * Host law: HTML files are websites or documents — not a design engine.
 * Design/poster/slides must compile to pawCanvas via createScene / deck.
 * Model-origin generic writes (write_artifact, run FS, package files) cannot
 * land pawCanvas / tldraw snapshots. Host-internal createScene / deck / blankCreate skip this gate.
 */

import { isPawCanvasDoc } from './engineCanvas.js';

const USE_CANVAS = {
  ok: false,
  code: 'USE_CANVAS',
  error:
    'Visual design (poster, slides, click-edit layout) must use run createScene / fromPage / fromSelection / fromRaster or the deck tool. write_artifact cannot create pawCanvas / Design / Slides. HTML files are only a website (data-paw-kind="site") or a document (data-paw-kind="document").',
  hint: 'retry with run createScene / fromPage / fromRaster or the deck tool'
};

export function htmlWritePolicy(content, name = '') {
  const decoded = decodeWritePayload(content);
  const text = typeof decoded === 'string' ? decoded : '';
  const n = String(name || '');
  if (looksLikeVisualCanvasPayload(decoded, n)) {
    return { ...USE_CANVAS, allow: false };
  }
  const trimmed = text.trim();
  if (!trimmed && (decoded == null || decoded === '')) return { allow: true };
  if (decoded && typeof decoded === 'object' && !isPawCanvasDoc(decoded) && !looksLikeTldrawStore(decoded)) {
    return { allow: true, kind: 'json' };
  }
  if (!trimmed) return { allow: true };
  const looksSvg = /^\s*(<\?xml[\s\S]{0,240})?<svg[\s>]/i.test(trimmed) || /\.svg$/i.test(n);
  if (looksSvg) return { allow: true, kind: 'svg' };
  const looksHtml =
    /html/i.test(n) ||
    /text\/html/i.test(n) ||
    (/^\s*</.test(trimmed) && /<[a-z!/]/i.test(trimmed) && !looksSvg);
  if (!looksHtml) return { allow: true };
  if (/data-paw-kind\s*=\s*["'](site|web)["']/i.test(text)) return { allow: true, kind: 'site' };
  if (/data-paw-kind\s*=\s*["']document["']/i.test(text) || /id=["']paw-document["']/i.test(text)) {
    return { allow: true, kind: 'doc' };
  }
  return { ...USE_CANVAS, allow: false };
}

export function looksLikeVisualCanvasPayload(content, name = '') {
  const decoded = decodeWritePayload(content);
  if (isPawCanvasDoc(decoded) || looksLikeTldrawStore(decoded)) return true;
  if (typeof decoded === 'string') {
    const trimmed = decoded.trim();
    if (isPawCanvasDoc(trimmed)) return true;
    const parsed = tryParseJson(trimmed);
    if (parsed && (isPawCanvasDoc(parsed) || looksLikeTldrawStore(parsed))) return true;
  }
  if (isCanonicalCanvasFileName(name)) {
    const parsed = typeof decoded === 'object' && decoded ? decoded : tryParseJson(String(decoded || ''));
    if (parsed && looksLikeCanvasishJson(parsed)) return true;
  }
  return false;
}

export function decodeWritePayload(content) {
  if (content == null) return '';
  if (typeof content === 'object' && !isBinaryLike(content)) return content;
  const text = asUtf8(content);
  if (!text) return text;
  const unwrapped = unwrapEncodedText(text);
  const parsed = tryParseJson(unwrapped);
  if (parsed && (isPawCanvasDoc(parsed) || looksLikeTldrawStore(parsed))) return parsed;
  return unwrapped;
}

function asUtf8(content) {
  if (typeof content === 'string') return content;
  if (isBinaryLike(content)) {
    try {
      const bytes =
        content instanceof Uint8Array
          ? content
          : ArrayBuffer.isView(content)
            ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
            : new Uint8Array(content);
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  }
  return String(content || '');
}

function isBinaryLike(value) {
  return (
    value instanceof Uint8Array ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value))
  );
}

function unwrapEncodedText(text) {
  const t = String(text || '').trim();
  if (!t) return t;
  const dataUrl = t.match(/^data:[^;]+;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (dataUrl) {
    const dec = tryDecodeBase64(dataUrl[1]);
    if (dec) return dec;
  }
  if (looksLikeBase64(t)) {
    const dec = tryDecodeBase64(t);
    if (dec && looksLikeJsonText(dec)) return dec;
  }
  return t;
}

function looksLikeBase64(s) {
  const t = String(s || '').replace(/\s+/g, '');
  if (t.length < 16 || t.length % 4 !== 0) return false;
  if (t.startsWith('{') || t.startsWith('[') || t.startsWith('<')) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t);
}

function tryDecodeBase64(s) {
  try {
    const compact = String(s || '').replace(/\s+/g, '');
    if (typeof Buffer !== 'undefined') return Buffer.from(compact, 'base64').toString('utf8');
    return atob(compact);
  } catch {
    return '';
  }
}

function looksLikeJsonText(s) {
  const x = String(s || '').trim();
  return x.startsWith('{') || x.startsWith('[');
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

function looksLikeTldrawStore(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const store =
    doc.tldraw?.document?.store ||
    doc.document?.store ||
    (doc.store && typeof doc.store === 'object' && !Array.isArray(doc.store) ? doc.store : null);
  if (!store || typeof store !== 'object' || Array.isArray(store)) return false;
  return Object.keys(store).some(
    (k) =>
      k.startsWith('shape:') ||
      k.startsWith('asset:') ||
      k.startsWith('page:') ||
      k === 'document:document'
  );
}

function looksLikeCanvasishJson(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (isPawCanvasDoc(doc) || looksLikeTldrawStore(doc)) return true;
  const shell = String(doc.shell || doc.kind || '').toLowerCase();
  return (
    Number(doc.pawCanvas) === 1 ||
    shell === 'slides' ||
    shell === 'design' ||
    shell === 'deck' ||
    shell === 'poster'
  );
}

function isCanonicalCanvasFileName(name) {
  const n = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .toLowerCase();
  return /^(slides|design|deck|pawcanvas|paw-canvas)(\.json)?$/.test(n);
}
