/**
 * Site preview sanitizer — guest scripts never execute in srcdoc.
 * CSS, images, and data-paw-* annotations stay. No eval. Preview-boundary only.
 */

const SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script>/gi;
const SCRIPT_OPEN = /<script\b[^>]*\/?>/gi;
const HANDLER_ATTR = /\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g;
const JS_QUOTED = /\s(href|src|xlink:href|action|formaction|poster|data)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi;
const JS_BARE = /\s(href|src|xlink:href|action|formaction|poster|data)\s*=\s*javascript:[^\s>]*/gi;
const META_REFRESH = /<meta\b[^>]*http-equiv\s*=\s*['"]?refresh['"]?[^>]*>/gi;
const MODULE_LINK = /<link\b[^>]*rel\s*=\s*['"]?(?:modulepreload|modulepreload\s|preload)['"]?[^>]*>/gi;
const IFRAME_JS = /<iframe\b[^>]*\bsrc\s*=\s*(['"])\s*javascript:[\s\S]*?\1[^>]*>[\s\S]*?<\/iframe>/gi;
const IFRAME_SRCDOC = /\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const OBJECT_TAG = /<object\b[\s\S]*?<\/object>/gi;
const EMBED_TAG = /<embed\b[^>]*>/gi;
const SVG_SCRIPT = /<script\b[\s\S]*?<\/script>/gi;

export function sanitizeSiteHtml(html) {
  let src = String(html || '');
  src = src.replace(SCRIPT_BLOCK, '');
  src = src.replace(SCRIPT_OPEN, '');
  src = src.replace(HANDLER_ATTR, '');
  src = src.replace(JS_QUOTED, ' $1="#"');
  src = src.replace(JS_BARE, ' $1="#"');
  src = src.replace(META_REFRESH, '');
  src = src.replace(MODULE_LINK, (m) => {
    if (/rel\s*=\s*['"]?modulepreload/i.test(m)) return '';
    if (/as\s*=\s*['"]?script/i.test(m)) return '';
    return m;
  });
  src = src.replace(IFRAME_JS, '');
  src = src.replace(IFRAME_SRCDOC, '');
  src = src.replace(OBJECT_TAG, '');
  src = src.replace(EMBED_TAG, '');
  src = src.replace(SVG_SCRIPT, '');
  return src;
}

export function siteHtmlLooksExecutable(html) {
  const s = String(html || '');
  return (
    /<script\b/i.test(s) ||
    /\son[a-z]+\s*=/i.test(s) ||
    /javascript\s*:/i.test(s) ||
    /<link\b[^>]*modulepreload/i.test(s)
  );
}
