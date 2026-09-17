/**
 * Site preview sanitizer — guest scripts never execute in srcdoc.
 * CSS, images, and data-paw-* annotations stay. No eval. Preview-boundary only.
 * Not a complete HTML sanitizer: walk open tags for on* attrs; keep text / quoted values.
 */

const SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script>/gi;
const SCRIPT_OPEN = /<script\b[^>]*\/?>/gi;
const JS_QUOTED = /\s(href|src|xlink:href|action|formaction|poster|data)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi;
const JS_BARE = /\s(href|src|xlink:href|action|formaction|poster|data)\s*=\s*javascript:[^\s>]*/gi;
const META_REFRESH = /<meta\b[^>]*http-equiv\s*=\s*['"]?refresh['"]?[^>]*>/gi;
const MODULE_LINK = /<link\b[^>]*rel\s*=\s*['"]?(?:modulepreload|modulepreload\s|preload)['"]?[^>]*>/gi;
const IFRAME_JS = /<iframe\b[^>]*\bsrc\s*=\s*(['"])\s*javascript:[\s\S]*?\1[^>]*>[\s\S]*?<\/iframe>/gi;
const OBJECT_TAG = /<object\b[\s\S]*?<\/object>/gi;
const EMBED_TAG = /<embed\b[^>]*>/gi;
const OPEN_OR_COMMENT = /<!--[\s\S]*?-->|<[^>]+>/g;

/** HTML attrs that start with "on" but are not event handlers. */
const ON_PREFIX_KEEP = new Set(['open', 'once']);

export function isHtmlEventHandlerName(name) {
  const n = String(name || '');
  if (!/^on[a-z][a-z0-9_]*$/i.test(n)) return false;
  return !ON_PREFIX_KEEP.has(n.toLowerCase());
}

function skipWs(s, i) {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
}

/**
 * Walk one open tag. Slash after the tag name is an attribute separator
 * (`<img/onerror=…>`), matching HTML's self-closing reconsume — not a URL.
 */
export function walkOpenTagAttrs(tag, onAttr) {
  const raw = String(tag || '');
  if (!/^<\s*[^/!?]/.test(raw)) return { tagName: '', attrs: [], selfClose: false, rebuilt: raw };
  const endsGt = raw.endsWith('>');
  const s = endsGt ? raw.slice(1, -1) : raw.slice(1);
  let i = skipWs(s, 0);
  const nameStart = i;
  while (i < s.length && /[^\s/>]/.test(s[i])) i += 1;
  const tagName = s.slice(nameStart, i);
  if (!tagName) return { tagName: '', attrs: [], selfClose: false, rebuilt: raw };

  const attrs = [];
  let selfClose = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '/') {
      if (/^\/\s*$/.test(s.slice(i))) {
        selfClose = true;
        break;
      }
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const attrStart = i;
    while (i < s.length && /[^\s/=]/.test(s[i])) i += 1;
    const name = s.slice(attrStart, i);
    if (!name) break;
    i = skipWs(s, i);
    let value;
    let quote = '';
    if (s[i] === '=') {
      i = skipWs(s, i + 1);
      if (s[i] === '"' || s[i] === "'") {
        quote = s[i];
        i += 1;
        const vStart = i;
        while (i < s.length && s[i] !== quote) i += 1;
        value = s.slice(vStart, i);
        if (s[i] === quote) i += 1;
      } else {
        const vStart = i;
        while (i < s.length && !/[\s>]/.test(s[i])) i += 1;
        value = s.slice(vStart, i);
      }
    }
    const keep = onAttr ? onAttr({ name, value, quote }) !== false : true;
    if (keep) attrs.push({ name, value, quote });
  }

  let rebuilt = `<${tagName}`;
  for (const attr of attrs) {
    if (attr.value === undefined) {
      rebuilt += ` ${attr.name}`;
      continue;
    }
    if (attr.quote) rebuilt += ` ${attr.name}=${attr.quote}${attr.value}${attr.quote}`;
    else rebuilt += ` ${attr.name}=${attr.value}`;
  }
  if (selfClose) rebuilt += ' /';
  if (endsGt) rebuilt += '>';
  return { tagName, attrs, selfClose, rebuilt };
}

function stripHandlersFromOpenTag(tag) {
  return walkOpenTagAttrs(tag, (attr) => !isHtmlEventHandlerName(attr.name)).rebuilt;
}

function mapMarkupChunks(html, onChunk) {
  return String(html || '').replace(OPEN_OR_COMMENT, (chunk) => onChunk(chunk));
}

function stripEventHandlers(html) {
  return mapMarkupChunks(html, (chunk) => {
    if (chunk.startsWith('<!--') || /^<\s*\//.test(chunk) || /^<\s*[!?]/.test(chunk)) return chunk;
    return stripHandlersFromOpenTag(chunk);
  });
}

export function openTagHasEventHandler(tag) {
  if (!tag || tag.startsWith('<!--') || /^<\s*\//.test(tag) || /^<\s*[!?]/.test(tag)) return false;
  let found = false;
  walkOpenTagAttrs(tag, (attr) => {
    if (isHtmlEventHandlerName(attr.name)) found = true;
    return true;
  });
  return found;
}

function decodeNumericEntity(_, raw, hex) {
  const n = hex ? parseInt(raw, 16) : parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return _;
  try {
    return String.fromCodePoint(n);
  } catch {
    return _;
  }
}

function decodePreviewEntities(src) {
  return String(src || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&colon;/gi, ':')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => decodeNumericEntity(m, h, true))
    .replace(/&#([0-9]+);/g, (m, d) => decodeNumericEntity(m, d, false));
}

function stripSrcdocAttrs(attrs) {
  return String(attrs || '')
    .replace(/\ssrcdoc\s*=\s*"[^"]*"/gi, '')
    .replace(/\ssrcdoc\s*=\s*'[^']*'/gi, '')
    .replace(/\ssrcdoc\s*=\s*[^\s>]+/gi, '');
}

function stripIframeSrcdoc(html) {
  return String(html || '').replace(/<iframe\b([^>]*)>/gi, (_, attrs) => {
    let next = stripSrcdocAttrs(attrs);
    if (/srcdoc/i.test(next)) next = next.replace(/srcdoc[\s\S]*/i, '');
    return `<iframe${next}>`;
  });
}

function sanitizeOnce(html) {
  let src = String(html || '');
  src = src.replace(SCRIPT_BLOCK, '');
  src = src.replace(SCRIPT_OPEN, '');
  src = stripEventHandlers(src);
  src = src.replace(JS_QUOTED, ' $1="#"');
  src = src.replace(JS_BARE, ' $1="#"');
  src = src.replace(META_REFRESH, '');
  src = src.replace(MODULE_LINK, (m) => {
    if (/rel\s*=\s*['"]?modulepreload/i.test(m)) return '';
    if (/as\s*=\s*['"]?script/i.test(m)) return '';
    return m;
  });
  src = src.replace(IFRAME_JS, '');
  src = stripIframeSrcdoc(src);
  src = src.replace(OBJECT_TAG, '');
  src = src.replace(EMBED_TAG, '');
  return src;
}

export function sanitizeSiteHtml(html) {
  let src = sanitizeOnce(html);
  const decoded = decodePreviewEntities(src);
  if (decoded !== src) src = sanitizeOnce(decoded);
  return src;
}

export function siteHtmlLooksExecutable(html) {
  const s = decodePreviewEntities(html);
  if (/<script\b/i.test(s)) return true;
  if (/<link\b[^>]*modulepreload/i.test(s)) return true;
  if (/<iframe\b[^>]*\bsrcdoc\s*=/i.test(s)) return true;
  if (/javascript\s*:/i.test(s)) return true;
  let found = false;
  mapMarkupChunks(s, (chunk) => {
    if (openTagHasEventHandler(chunk)) found = true;
    return chunk;
  });
  return found;
}
