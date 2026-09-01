/**
 * Host site-clone QA — structural, not a taste oracle.
 * Catches remote CSS-as-truth, broken above-the-fold media, collapsed
 * multi-column layouts, overflow, missing hero, and unsupported motion.
 */

import { detectUnsupported } from './siteMotionBlueprint.js';

export const SITE_QA_VERSION = 1;

export const SITE_QA_CODES = Object.freeze({
  REMOTE_STYLESHEET: 'REMOTE_STYLESHEET',
  BROKEN_MEDIA: 'BROKEN_MEDIA',
  LAYOUT_COLLAPSE: 'LAYOUT_COLLAPSE',
  VIEWPORT_OVERFLOW: 'VIEWPORT_OVERFLOW',
  MISSING_HERO: 'MISSING_HERO',
  MOTION_UNSUPPORTED: 'MOTION_UNSUPPORTED'
});

const HARD = 'hard';
const WARN = 'warning';
const DESKTOP_MIN = 1100;

/**
 * @param {{
 *   html?: string,
 *   sourceHtml?: string,
 *   viewport?: { width?: number, height?: number },
 *   bundled?: Array<{ path?: string, bytes?: { byteLength?: number }, sourceUrl?: string }>,
 *   unresolved?: Array<{ url?: string, reason?: string }>,
 *   stripped?: string[],
 *   motionWarnings?: Array<{ code?: string, message?: string }>,
 *   rendered?: {
 *     width?: number,
 *     height?: number,
 *     scrollWidth?: number,
 *     scrollHeight?: number,
 *     heroCards?: Array<{ x: number, y: number, w: number, h: number }>,
 *     images?: Array<{ src?: string, naturalWidth?: number, naturalHeight?: number, complete?: boolean, aboveFold?: boolean }>
 *   }
 * }} input
 */
export function assessSiteClone(input = {}) {
  const html = String(input.html || '');
  const sourceHtml = String(input.sourceHtml || '');
  const viewport = {
    width: Math.max(0, Math.round(Number(input.viewport?.width) || 1440)),
    height: Math.max(0, Math.round(Number(input.viewport?.height) || 900))
  };
  const issues = [];
  const push = (code, severity, message, extra = {}) => {
    if (!code) return;
    if (issues.some((i) => i.code === code && i.severity === severity && i.message === message)) return;
    issues.push({ code, severity, message, ...extra });
  };

  if (hasRemoteStylesheet(html)) {
    push(
      SITE_QA_CODES.REMOTE_STYLESHEET,
      HARD,
      'Clone still relies on an external stylesheet as layout truth.'
    );
  }

  const atfBroken = listBrokenAboveFoldMedia(html, input);
  if (atfBroken.length) {
    push(
      SITE_QA_CODES.BROKEN_MEDIA,
      HARD,
      `Above-the-fold media missing or zero-size (${atfBroken.length}).`,
      { samples: atfBroken.slice(0, 6) }
    );
  } else if (Array.isArray(input.unresolved) && input.unresolved.length) {
    const below = input.unresolved.filter((u) => !isAboveFoldUrl(u?.url, html));
    if (below.length) {
      push(
        SITE_QA_CODES.BROKEN_MEDIA,
        WARN,
        `Some below-the-fold assets were skipped (${below.length}); clone remains.`,
        { samples: below.slice(0, 4).map((u) => u.url || u.reason) }
      );
    }
  }

  const sourceCards = countHeroCards(sourceHtml) || inferSourceColumns(sourceHtml);
  const cloneCards = countHeroCards(html);
  const sourceHero = hasHeroRegion(sourceHtml) || sourceCards >= 3;
  const cloneHero = hasHeroRegion(html) || cloneCards >= 3;
  if (sourceHero && !cloneHero) {
    push(SITE_QA_CODES.MISSING_HERO, HARD, 'Major hero / device-card region is absent from the clone.');
  }

  const collapse = detectLayoutCollapse(html, sourceHtml, viewport, input.rendered, sourceCards, cloneCards);
  if (collapse) {
    push(SITE_QA_CODES.LAYOUT_COLLAPSE, HARD, collapse);
  }

  const overflow = detectOverflow(viewport, input.rendered);
  if (overflow) {
    push(SITE_QA_CODES.VIEWPORT_OVERFLOW, HARD, overflow);
  }

  const motion = collectMotionUnsupported(html, sourceHtml, input);
  for (const m of motion) {
    push(SITE_QA_CODES.MOTION_UNSUPPORTED, WARN, m.message, { origin: m.code });
  }

  const hard = issues.filter((i) => i.severity === HARD);
  const ok = hard.length === 0;
  const partial = !ok || issues.length > 0;
  return {
    version: SITE_QA_VERSION,
    ok,
    partial,
    faithful: ok && issues.length === 0,
    viewport,
    issues,
    codes: issues.map((i) => i.code),
    metrics: {
      sourceCards,
      cloneCards,
      remoteStylesheet: hasRemoteStylesheet(html),
      atfBroken: atfBroken.length,
      renderedCards: Array.isArray(input.rendered?.heroCards) ? input.rendered.heroCards.length : 0
    }
  };
}

export function compactSiteQaReport(qa) {
  const r = qa && typeof qa === 'object' ? qa : assessSiteClone(qa || {});
  return {
    ok: r.ok === true,
    partial: r.partial === true,
    faithful: r.faithful === true,
    issues: (r.issues || []).map((i) => ({
      code: i.code,
      severity: i.severity,
      message: i.message
    })),
    metrics: r.metrics || {}
  };
}

export function hasRemoteStylesheet(html) {
  const re = /<link\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const attrs = m[1] || '';
    if (!/\brel\s*=\s*(["']?)stylesheet\1/i.test(attrs) && !/\brel\s*=\s*(["']?)[^"']*\bstylesheet\b/i.test(attrs)) {
      continue;
    }
    const href = /(?:^|\s)href\s*=\s*(["'])([^"']*)\1/i.exec(attrs)?.[2] || '';
    if (!href || href.startsWith('#') || href.startsWith('data:')) continue;
    if (/^https?:/i.test(href) || href.startsWith('//') || /\.css(\?|#|$)/i.test(href)) return true;
  }
  return false;
}

function countHeroCards(html) {
  const s = String(html || '');
  const dev = (s.match(/class=(["'][^"']*\bdevcard\b[^"']*\1)/gi) || []).length;
  const card = (s.match(/<(?:article|div|figure)\b[^>]*class=(["'][^"']*\bcard\b[^"']*\1)/gi) || []).length;
  const slide = (s.match(/class=(["'][^"']*\b(?:carousel__slide|hero-slide|carousel-slide)\b[^"']*\1)/gi) || []).length;
  return Math.max(dev, card, slide);
}

function inferSourceColumns(html) {
  const s = String(html || '');
  if (/grid-template-columns\s*:\s*repeat\(\s*[3-9]/i.test(s)) return 3;
  if (/flex:\s*0\s+0\s+400px/i.test(s)) return 3;
  return 0;
}

function hasHeroRegion(html) {
  const s = String(html || '');
  if (/<(?:section|div|header)\b[^>]*class=(["'][^"']*\bhero\b[^"']*\1)/i.test(s)) return true;
  if (/data-paw-carousel|data-hero-carousel|class=(["'][^"']*\bcarousel\b)/i.test(s)) return true;
  if (/Any idea, captured|Never miss an idea|Your AI Thinking Partner/i.test(s)) return true;
  return countHeroCards(s) >= 3;
}

function isAboveFoldUrl(url, html) {
  const u = String(url || '');
  if (!u) return false;
  const s = String(html || '');
  const idx = s.indexOf(u.split('?')[0].slice(-48));
  if (idx >= 0 && idx < Math.min(s.length, 24_000)) return true;
  return /hero-|devcard-|carousel|fetchpriority=["']high/i.test(u) || /hero-|devcard-/.test(s.slice(Math.max(0, idx - 200), idx + 80));
}

function listBrokenAboveFoldMedia(html, input) {
  const broken = [];
  const bundled = new Map();
  for (const a of input.bundled || []) {
    const p = String(a.path || '');
    const n = a.bytes?.byteLength || a.byteLength || 0;
    if (p) bundled.set(p, n);
  }
  const imgs = [];
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) imgs.push({ attrs: m[1] || '', index: m.index });
  const atf = imgs.filter((img, i) => i < 8 || isAtfImg(img, html));
  for (const img of atf) {
    const src = attr(img.attrs, 'src');
    if (!src || /^data:image\//i.test(src) || /^blob:/i.test(src)) continue;
    if (/^https?:/i.test(src) || src.startsWith('//')) {
      broken.push(src);
      continue;
    }
    if (src.startsWith('/artifacts/')) {
      const n = bundled.get(src);
      if (Array.isArray(input.bundled) && input.bundled.length && (n == null || n === 0)) broken.push(src);
      continue;
    }
    if (!src.startsWith('/') && !src.startsWith('data:')) broken.push(src);
  }
  for (const img of input.rendered?.images || []) {
    if (img.aboveFold === false) continue;
    const w = Number(img.naturalWidth) || 0;
    if (img.complete === false || w <= 0) broken.push(img.src || '(rendered)');
  }
  return unique(broken);
}

function isAtfImg(img, html) {
  const window = String(html || '').slice(Math.max(0, img.index - 400), img.index + 80);
  if (/fetchpriority=["']high/i.test(img.attrs)) return true;
  return /hero|carousel|devcard|card|logo/i.test(window + img.attrs);
}

function detectLayoutCollapse(html, sourceHtml, viewport, rendered, sourceCards, cloneCards) {
  if (viewport.width < DESKTOP_MIN) return '';
  const cards = Array.isArray(rendered?.heroCards) ? rendered.heroCards.filter((b) => b && b.w > 8 && b.h > 8) : [];
  if (cards.length >= 3) {
    const row = cards.filter((b) => Math.abs(b.y - cards[0].y) < 56);
    if (row.length < 2) {
      return 'Captured multi-column / 3-card hero collapsed to a single column at the desktop viewport.';
    }
  }
  const sourceWide =
    sourceCards >= 3 ||
    /grid-template-columns\s*:\s*repeat\(\s*[3-9]/i.test(sourceHtml) ||
    /cards__track|class=(["'][^"']*\bcards\b)/i.test(sourceHtml) ||
    /flex:\s*0\s+0\s+400px/i.test(sourceHtml);
  if (!sourceWide && sourceCards < 3) return '';
  const cloneWide =
    /grid-template-columns\s*:\s*repeat\(\s*[3-9]/i.test(html) ||
    /cards__track|flex:\s*0\s+0\s+400px/i.test(html) ||
    cloneCards >= 3;
  const narrowShell = looksLikeNarrowColumn(html);
  if (sourceWide && (narrowShell || !cloneWide)) {
    return 'Captured multi-column / 3-card blueprint became a narrow single column at the desktop viewport.';
  }
  return '';
}

function looksLikeNarrowColumn(html) {
  const s = String(html || '');
  if (/grid-template-columns\s*:\s*repeat\(\s*[3-9]/i.test(s)) return false;
  if (/cards__track|flex:\s*0\s+0\s+400px/i.test(s)) return false;
  const max = /max-width\s*:\s*([0-9.]+)px/gi;
  let m;
  let tight = false;
  while ((m = max.exec(s))) {
    if (Number(m[1]) > 0 && Number(m[1]) <= 480) tight = true;
  }
  return tight && countHeroCards(s) < 3;
}

function detectOverflow(viewport, rendered) {
  if (!rendered) return '';
  const w = Number(rendered.scrollWidth) || 0;
  const vw = viewport.width || 1440;
  if (w > vw + 80) {
    return `Horizontal overflow: scrollWidth ${w}px vs viewport ${vw}px.`;
  }
  return '';
}

function collectMotionUnsupported(html, sourceHtml, input) {
  const out = [];
  const seen = new Set();
  const add = (code, message) => {
    if (seen.has(code)) return;
    seen.add(code);
    out.push({ code, message });
  };
  for (const w of input.motionWarnings || []) {
    add(w.code || 'MOTION_UNSUPPORTED', w.message || String(w.code || 'unsupported motion'));
  }
  for (const w of detectUnsupported(sourceHtml || html)) {
    add(w.code, w.message);
  }
  if (/<canvas\b/i.test(sourceHtml || html) && /data-dots|getContext\s*\(\s*['"]2d/i.test(sourceHtml || html)) {
    add('UNSUPPORTED_CANVAS_FX', 'Canvas particle / 2d app effects are not packaged motion.');
  }
  if ((input.stripped || []).includes('script')) {
    add('UNSUPPORTED_GUEST_JS', 'Source scripts were stripped and are not reproduced.');
  }
  return out;
}

function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(String(attrs || ''));
  if (!m) return '';
  return String(m[2] ?? m[3] ?? m[4] ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}
