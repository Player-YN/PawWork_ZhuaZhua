/**
 * DOM / HTML helpers for the side panel (pure-ish).
 */

/** @param {string} id */
export function $(id) {
  return document.getElementById(id);
}

/** @param {unknown} text */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Allowlist HTML tags for model markdown (no scripts / event handlers). */
export const SAFE_MD_TAGS = new Set([
  'A',
  'P',
  'BR',
  'STRONG',
  'EM',
  'B',
  'I',
  'U',
  'DEL',
  'IMG',
  'CODE',
  'PRE',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'DETAILS',
  'SUMMARY',
  'DIV',
  'SPAN'
]);

/**
 * Sanitize HTML produced by marked before innerHTML.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeModelHtml(html) {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  try {
    const doc = new DOMParser().parseFromString(`<div id="pw-root">${raw}</div>`, 'text/html');
    const root = doc.getElementById('pw-root');
    if (!root) return escapeHtml(raw).replace(/\n/g, '<br>');
    const walk = (node) => {
      const children = [...node.childNodes];
      for (const child of children) {
        if (child.nodeType === 1) {
          const el = /** @type {Element} */ (child);
          const tag = el.tagName.toUpperCase();
          if (
            tag === 'SCRIPT' ||
            tag === 'IFRAME' ||
            tag === 'OBJECT' ||
            tag === 'EMBED' ||
            tag === 'FORM' ||
            tag === 'LINK' ||
            tag === 'META' ||
            tag === 'STYLE' ||
            tag === 'SVG'
          ) {
            el.remove();
            continue;
          }
          if (!SAFE_MD_TAGS.has(tag)) {
            while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
            el.remove();
            continue;
          }
          for (const attr of [...el.attributes]) {
            const n = attr.name.toLowerCase();
            if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') {
              el.removeAttribute(attr.name);
              continue;
            }
            if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(attr.value)) {
              el.removeAttribute(attr.name);
              continue;
            }
            if (n === 'href') {
              el.setAttribute('rel', 'noopener noreferrer');
              el.setAttribute('target', '_blank');
            }
          }
          walk(el);
        }
      }
    };
    walk(root);
    return root.innerHTML;
  } catch {
    return escapeHtml(raw).replace(/\n/g, '<br>');
  }
}

/** @param {string} s @param {number} n */
export function truncateUi(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
