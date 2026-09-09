/**
 * Harvest images + heading/body flow from plate HTML for Office export
 * and guest-path hydration.
 */

import { listArtifacts } from './artifacts.js';
import { guessMimeFromName } from './artifactValidate.js';

export function listHtmlImages(html) {
  const out = [];
  const seen = new Set();
  const push = (src, alt, box, unique) => {
    const s = decodeHtmlAttr(String(src || '').trim());
    if (!s) return;
    if (unique && seen.has(s)) return;
    seen.add(s);
    out.push({ src: s, alt: String(alt || '').trim(), box: parseBoxAttr(box) });
  };
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const attrs = m[1] || '';
    const src = /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '';
    const alt = /(?:^|\s)alt\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || '';
    const boxRaw = /(?:^|\s)data-box\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '';
    push(src, alt, boxRaw, false);
  }
  const bgRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  while ((m = bgRe.exec(String(html || '')))) {
    const src = m[2] || '';
    if (/^data:image\//i.test(src) || /^https?:\/\//i.test(src) || isGuestArtifactPath(src)) {
      push(src, '', '', true);
    }
  }
  return out;
}

function decodeHtmlAttr(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseBoxAttr(raw) {
  const parts = String(raw || '')
    .split(/[,\s]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 4) return null;
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

function stripTags(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function pushUniqueText(flow, type, text, extra = {}) {
  const t = String(text || '').trim();
  if (!t) return;
  if (flow.some((n) => (n.type === 'p' || n.type === 'h' || n.type === 'li') && n.text === t)) return;
  flow.push({ type, text: t, ...extra });
}

/**
 * Ordered heading / paragraph / image tokens from a plate.
 * @param {string} html
 * @returns {Array<{type:'h'|'p'|'img'|'li', text?: string, level?: number, src?: string, alt?: string, box?: object|null}>}
 */
export function htmlRichFlow(html) {
  const raw = String(html || '');
  const flow = [];
  const re =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<img\b([^>]*)>|<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>|<p\b[^>]*>([\s\S]*?)<\/p>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1]) {
      const text = stripTags(m[2]);
      if (text) flow.push({ type: 'h', level: Number(String(m[1]).slice(1)) || 1, text });
      continue;
    }
    if (m[0].toLowerCase().startsWith('<img')) {
      const attrs = m[3] || '';
      const src = decodeHtmlAttr(/(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '');
      const alt = /(?:^|\s)alt\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || '';
      const boxRaw = /(?:^|\s)data-box\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '';
      if (src.trim()) flow.push({ type: 'img', src: src.trim(), alt: alt.trim(), box: parseBoxAttr(boxRaw) });
      continue;
    }
    if (m[6] != null) {
      pushUniqueText(flow, 'li', stripTags(m[6]));
      continue;
    }
    pushUniqueText(flow, 'p', stripTags(m[4] != null ? m[4] : m[5]));
  }
  const slotRe =
    /<(div|span|h[1-6]|p|figcaption|section)[^>]*\bdata-paw-slot=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = slotRe.exec(raw))) {
    if (String(m[1]).toLowerCase() === 'img') continue;
    pushUniqueText(flow, 'p', stripTags(m[3]));
  }
  if (!flow.some((n) => n.type === 'p' || n.type === 'h' || n.type === 'li')) {
    const leftover = stripTags(raw.replace(/<img\b[^>]*>/gi, ' '));
    if (leftover) flow.push({ type: 'p', text: leftover });
  }
  return flow;
}

export function isGuestArtifactPath(src) {
  const s = String(src || '').trim();
  if (/^\/artifacts\//i.test(s) || /^artifacts\//i.test(s)) return true;
  return /(?:chrome-extension:\/\/[^/]+)?\/artifacts\//i.test(s);
}

export function guestPathFromSrc(src) {
  const raw = String(src || '').trim().split(/[?#]/)[0];
  const m = /(\/artifacts\/.+)$/i.exec(raw);
  if (m) return m[1];
  if (/^artifacts\//i.test(raw)) return `/${raw}`;
  return raw.startsWith('/') ? raw : raw ? `/${raw}` : '';
}

function looksLikeSvgBytes(bytes) {
  if (!bytes?.byteLength) return false;
  const head = new TextDecoder().decode(bytes.slice(0, 240)).trim();
  return /^\s*(<\?xml[\s\S]{0,200})?<svg[\s>]/i.test(head);
}

function mimeForImageBytes(guest, mime, bytes) {
  const n = String(guest || '').toLowerCase();
  const m = String(mime || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (n.endsWith('.svg') || m.includes('svg') || looksLikeSvgBytes(bytes)) return 'image/svg+xml';
  if (m.startsWith('image/')) return m;
  return guessMimeFromName(n) || 'image/png';
}

function bytesToDataUrl(bytes, mime) {
  const m = mime || 'image/png';
  if (typeof Buffer !== 'undefined') {
    return `data:${m};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${m};base64,${btoa(bin)}`;
}

/**
 * PNG IHDR or JPEG SOF dimensions. Fallback 960×540.
 * @param {Uint8Array} bytes
 */
export function imagePixelSize(bytes) {
  if (!bytes || bytes.length < 24) return { w: 960, h: 540 };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (w > 0 && h > 0) return { w, h };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = (bytes[i + 5] << 8) | bytes[i + 6];
        const w = (bytes[i + 7] << 8) | bytes[i + 8];
        if (w > 0 && h > 0) return { w, h };
        break;
      }
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return { w: 960, h: 540 };
}

/**
 * Resolve /artifacts/... (and matching artifact names) to a data URL.
 * @returns {string|null}
 */
export function guestPathToDataUrl(fs, store, sessionId, src) {
  const raw = String(src || '').trim();
  if (!raw) return null;
  const path = guestPathFromSrc(raw);
  if (!path) return null;
  const tryRead = (guest) => {
    try {
      const bytes = fs.readFileBytes(guest);
      if (bytes && bytes.byteLength) {
        return bytesToDataUrl(bytes, mimeForImageBytes(guest, '', bytes));
      }
    } catch {
      /* next */
    }
    return null;
  };
  const direct = tryRead(path);
  if (direct) return direct;
  const base = path.split('/').pop() || '';
  const stem = base.replace(/\.[^.]+$/, '');
  if (!base || !store) return null;
  for (const rec of listArtifacts(store, sessionId)) {
    const p = String(rec?.primaryPath || '');
    const n = String(rec?.name || '');
    const dir = String(rec?.packageDir || '');
    if (
      p === path ||
      n === base ||
      p.endsWith(`/${base}`) ||
      p.endsWith(base) ||
      dir === stem ||
      (stem && (p.includes(`/${stem}/`) || n.includes(stem)))
    ) {
      const hit = tryRead(p);
      if (hit) return hit;
    }
  }
  return null;
}

function expandHex(h) {
  const s = String(h || '').replace('#', '');
  if (s.length === 3) return (s[0] + s[0] + s[1] + s[1] + s[2] + s[2]).toUpperCase();
  return s.slice(0, 6).toUpperCase();
}

/**
 * Poster / page CSS custom properties → Office slide colors.
 * @param {string} css
 */
export function themeFromCss(css) {
  const pick = (name) => {
    const m = new RegExp(`--${name}\\s*:\\s*#([0-9a-fA-F]{3,8})`).exec(String(css || ''));
    return m ? expandHex(m[1]) : '';
  };
  return {
    bg: pick('bg') || pick('background'),
    text: pick('text-main') || pick('text') || pick('text-color'),
    accent: pick('accent') || pick('primary')
  };
}

export function isDarkHex(hex) {
  const s = expandHex(hex);
  if (s.length < 6) return false;
  const n = parseInt(s, 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

/**
 * Replace guest `/artifacts/...` img src, srcset, poster, and CSS `url()` with
 * data URLs so preview and Office export hold real pixels instead of a path
 * the extension page cannot fetch.
 */
export function rewriteGuestImageSrcs(html, fs, store, sessionId) {
  const paint = (src) => {
    if (!isGuestArtifactPath(src)) return '';
    return guestPathToDataUrl(fs, store, sessionId, src) || '';
  };
  const mapSrcset = (srcset) =>
    String(srcset || '')
      .split(',')
      .map((part) => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) return part.trim();
        const data = paint(bits[0]);
        if (data) bits[0] = data;
        return bits.join(' ');
      })
      .filter(Boolean)
      .join(', ');
  let next = String(html || '').replace(/(\s(?:src|poster)\s*=\s*)(["'])([^"']+)\2/gi, (full, pre, q, src) => {
    const data = paint(src);
    return data ? `${pre}${q}${data}${q}` : full;
  });
  next = next.replace(/(\ssrcset\s*=\s*)(["'])([^"']+)\2/gi, (full, pre, q, srcset) => {
    const mapped = mapSrcset(srcset);
    return mapped ? `${pre}${q}${mapped}${q}` : full;
  });
  next = next.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, src) => {
    const data = paint(src);
    return data ? `url(${q}${data}${q})` : full;
  });
  return next;
}
