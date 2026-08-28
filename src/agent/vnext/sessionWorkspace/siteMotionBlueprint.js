/**
 * Pure mapper: common source patterns → additive data-paw-* DSL.
 * Clone pipeline / html-site skill call this. Never copies JS. Never claims WebGL/auth.
 */

import { SITE_MOTION_ATTRS as A, SITE_MOTION_UNSUPPORTED } from './siteMotionSchema.js';

export const SITE_MOTION_BLUEPRINT_ID = 'site-motion-blueprint@1';

const AOS_TO_KIND = {
  fade: 'fade',
  'fade-up': 'fade-up',
  'fade-down': 'fade-down',
  'fade-in': 'fade',
  reveal: 'reveal',
  zoom: 'scale',
  'zoom-in': 'scale',
  scale: 'scale'
};

/**
 * @param {string} html
 * @param {{ alreadyAnnotated?: boolean }} [opts]
 * @returns {{
 *   html: string,
 *   mappings: Array<{ from: string, to: string, provenance: string }>,
 *   warnings: Array<{ code: string, message: string, class?: string }>,
 *   provenance: string
 * }}
 */
export function annotateSiteMotionBlueprint(html, opts = {}) {
  void opts;
  const mappings = [];
  const warnings = detectUnsupported(html);
  let next = String(html || '');

  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-carousel\b[^>]*)>/gi, A.carousel, '', mappings, {
    from: 'data-hero-carousel',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-track\b[^>]*)>/gi, A.track, '', mappings, {
    from: 'data-hero-track',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-item\b[^>]*)>/gi, A.item, '', mappings, {
    from: 'data-hero-item',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-prev\b[^>]*)>/gi, A.prev, '', mappings, {
    from: 'data-hero-prev',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-next\b[^>]*)>/gi, A.next, '', mappings, {
    from: 'data-hero-next',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-toggle\b[^>]*)>/gi, A.toggle, '', mappings, {
    from: 'data-hero-toggle',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-hero-progress\b[^>]*)>/gi, A.progress, '', mappings, {
    from: 'data-hero-progress',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-cards\b(?!-track|-prev|-next|-item)[^>]*)>/gi, A.carousel, '', mappings, {
    from: 'data-cards',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-cards-track\b[^>]*)>/gi, A.track, '', mappings, {
    from: 'data-cards-track',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-cards-prev\b[^>]*)>/gi, A.prev, '', mappings, {
    from: 'data-cards-prev',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-cards-next\b[^>]*)>/gi, A.next, '', mappings, {
    from: 'data-cards-next',
    provenance: 'ideashell'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-track\b[^>]*)>/gi, A.track, '', mappings, {
    from: 'data-carousel-track',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-item\b[^>]*)>/gi, A.item, '', mappings, {
    from: 'data-carousel-item',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-prev\b[^>]*)>/gi, A.prev, '', mappings, {
    from: 'data-carousel-prev',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-next\b[^>]*)>/gi, A.next, '', mappings, {
    from: 'data-carousel-next',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-toggle\b[^>]*)>/gi, A.toggle, '', mappings, {
    from: 'data-carousel-toggle',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-carousel-progress\b[^>]*)>/gi, A.progress, '', mappings, {
    from: 'data-carousel-progress',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-marquee\b[^>]*)>/gi, A.marquee, '', mappings, {
    from: 'data-marquee',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-accordion\b(?!-item|-trigger|-panel)[^>]*)>/gi, A.accordion, '', mappings, {
    from: 'data-accordion',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-accordion-item\b[^>]*)>/gi, A.accordionItem, '', mappings, {
    from: 'data-accordion-item',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-accordion-trigger\b[^>]*)>/gi, A.accordionTrigger, '', mappings, {
    from: 'data-accordion-trigger',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-accordion-panel\b[^>]*)>/gi, A.accordionPanel, '', mappings, {
    from: 'data-accordion-panel',
    provenance: 'data-attr'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\bdata-stagger\b[^>]*)>/gi, A.stagger, inheritNumeric('data-stagger'), mappings, {
    from: 'data-stagger',
    provenance: 'data-attr'
  });

  next = annotateAos(next, mappings);
  next = annotateRoleTabs(next, mappings);
  next = annotateClassToken(next, 'hero-track', A.track, '', mappings, 'class:hero-track');
  next = annotateClassToken(next, 'carousel-track', A.track, '', mappings, 'class:carousel-track');
  next = annotateClassToken(next, 'carousel__track', A.track, '', mappings, 'class:carousel__track');
  next = annotateClassToken(next, 'hero-slide', A.item, '', mappings, 'class:hero-slide');
  next = annotateClassToken(next, 'carousel-item', A.item, '', mappings, 'class:carousel-item');
  next = annotateClassToken(next, 'carousel-slide', A.item, '', mappings, 'class:carousel-slide');
  next = annotateClassToken(next, 'carousel__slide', A.item, '', mappings, 'class:carousel__slide');
  next = annotateClassToken(next, 'devcard', A.item, '', mappings, 'class:devcard');
  next = annotateClassToken(next, 'carousel-prev', A.prev, '', mappings, 'class:carousel-prev');
  next = annotateClassToken(next, 'hero-prev', A.prev, '', mappings, 'class:hero-prev');
  next = annotateClassToken(next, 'carousel-next', A.next, '', mappings, 'class:carousel-next');
  next = annotateClassToken(next, 'hero-next', A.next, '', mappings, 'class:hero-next');
  next = annotateClassToken(next, 'carousel-toggle', A.toggle, '', mappings, 'class:carousel-toggle');
  next = annotateClassToken(next, 'carousel-progress', A.progress, '', mappings, 'class:carousel-progress');
  next = annotateClassToken(next, 'marquee', A.marquee, '', mappings, 'class:marquee');
  next = annotateClassToken(next, 'ticker', A.marquee, '', mappings, 'class:ticker');
  next = annotateClassToken(next, 'stagger', A.stagger, '80', mappings, 'class:stagger');
  next = annotateClassToken(next, 'reveal', A.motion, 'reveal', mappings, 'class:reveal');
  next = annotateClassToken(next, 'fade-in', A.motion, 'fade', mappings, 'class:fade-in');
  next = annotateClassToken(next, 'fade-up', A.motion, 'fade-up', mappings, 'class:fade-up');
  next = annotateClassToken(next, 'fade-down', A.motion, 'fade-down', mappings, 'class:fade-down');
  next = annotateClassToken(next, 'accordion', A.accordion, '', mappings, 'class:accordion');
  next = annotateClassToken(next, 'accordion-item', A.accordionItem, '', mappings, 'class:accordion-item');
  next = annotateClassToken(next, 'accordion-trigger', A.accordionTrigger, '', mappings, 'class:accordion-trigger');
  next = annotateClassToken(next, 'accordion-panel', A.accordionPanel, '', mappings, 'class:accordion-panel');
  next = annotateClassToken(next, 'accordion-content', A.accordionPanel, '', mappings, 'class:accordion-content');

  return {
    html: next,
    mappings,
    warnings,
    provenance: SITE_MOTION_BLUEPRINT_ID
  };
}

export function detectUnsupported(html) {
  const s = String(html || '');
  const warnings = [];
  const add = (code, message, extra) => {
    if (warnings.some((w) => w.code === code)) return;
    warnings.push({ code, message, class: extra || SITE_MOTION_UNSUPPORTED.find((x) => code.toLowerCase().includes(x)) || '' });
  };
  if (/<script\b/i.test(s) || /javascript\s*:/i.test(s) || /\son[a-z]+\s*=/i.test(s)) {
    add('UNSUPPORTED_GUEST_JS', 'Source scripts, onclick, and javascript: URLs are stripped and not reproduced.');
  }
  if (/<canvas\b[^>]*(data-dots|class=["'][^"']*dots)/i.test(s)) {
    add('UNSUPPORTED_CANVAS_FX', 'Canvas particle / 2d app effects are not packaged motion.');
  }
  if (/webgl|three(?:\.js|\/)|react-three|@react-three|spline-viewer|canvas[\s\S]{0,80}getContext\s*\(\s*['"]webgl/i.test(s)) {
    add('UNSUPPORTED_WEBGL', 'WebGL / Three / Spline scenes are not packaged motion. Not claimed.');
  }
  if (/lottie-player|dotlottie|@lottiefiles/i.test(s)) {
    add('UNSUPPORTED_LOTTIE', 'Interactive Lottie players are not in the DSL. CSS/static fallback only.');
  }
  if (/\bgsap\b|ScrollTrigger|TweenMax/i.test(s)) {
    add('UNSUPPORTED_GSAP', 'GSAP / ScrollTrigger timelines are not reproduced. Use reveal/stagger or CSS.');
  }
  if (/framer-motion|data-framer-|__framer/i.test(s)) {
    add('UNSUPPORTED_FRAMER', 'Framer Motion app behavior is not packaged. Do not claim it.');
  }
  if (/id=["'](?:root|__next|app)["'][^>]*>\s*(?:<\/(?:div|main)>|$)/i.test(s) && /react|next\.js|_next\//i.test(s)) {
    add('UNSUPPORTED_REACT_HYDRATION', 'Empty React/Next roots need the original app. HTML clone cannot hydrate.');
  }
  if (/auth0|clerk\.|firebase\/auth|supabase\.auth|data-auth-wall/i.test(s)) {
    add('UNSUPPORTED_AUTH', 'Auth walls and client login flows are not motion and are not claimed.');
  }
  if (/new\s+WebSocket|fetch\s*\(|XMLHttpRequest/i.test(s) && /<script\b/i.test(s)) {
    add('UNSUPPORTED_NETWORK_UI', 'Network-driven UI in guest scripts does not run.');
  }
  return warnings;
}

function inheritNumeric(attr) {
  return (open) => {
    const m = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i').exec(open);
    return m ? m[1] : '';
  };
}

function annotateAos(html, mappings) {
  return String(html).replace(/<([a-z][\w-]*)([^>]*\bdata-aos\s*=\s*["']([^"']+)["'][^>]*)>/gi, (full, tag, attrs, val) => {
    const kind = AOS_TO_KIND[String(val || '').trim().toLowerCase()];
    if (!kind) return full;
    if (hasAttr(attrs, A.motion)) return full;
    mappings.push({ from: `data-aos=${val}`, to: `${A.motion}=${kind}`, provenance: 'aos' });
    return `<${tag}${attrs} ${A.motion}="${kind}">`;
  });
}

function annotateRoleTabs(html, mappings) {
  let next = annotateOpen(html, /<([a-z][\w-]*)([^>]*\brole\s*=\s*["']tablist["'][^>]*)>/gi, A.tabs, '', mappings, {
    from: 'role=tablist',
    provenance: 'aria'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\brole\s*=\s*["']tab["'][^>]*)>/gi, A.tab, '', mappings, {
    from: 'role=tab',
    provenance: 'aria'
  });
  next = annotateOpen(next, /<([a-z][\w-]*)([^>]*\brole\s*=\s*["']tabpanel["'][^>]*)>/gi, A.tabPanel, '', mappings, {
    from: 'role=tabpanel',
    provenance: 'aria'
  });
  return next;
}

function annotateClassToken(html, token, attr, value, mappings, from) {
  const re = new RegExp(`<([a-z][\\w-]*)([^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRe(token)}\\b[^"']*["'][^>]*)>`, 'gi');
  return annotateOpen(html, re, attr, value, mappings, { from, provenance: 'class' });
}

function annotateOpen(html, re, attr, value, mappings, meta) {
  return String(html).replace(re, (full, tag, attrs) => {
    if (hasAttr(attrs, attr)) return full;
    const val = typeof value === 'function' ? value(full) : value;
    const extra = val === '' || val == null ? ` ${attr}` : ` ${attr}="${escapeAttr(val)}"`;
    mappings.push({ from: meta.from, to: val === '' || val == null ? attr : `${attr}=${val}`, provenance: meta.provenance });
    return `<${tag}${attrs}${extra}>`;
  });
}

function hasAttr(attrs, name) {
  return new RegExp(`(?:^|\\s)${escapeRe(name)}(?:\\s|=|$)`, 'i').test(String(attrs || ''));
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
