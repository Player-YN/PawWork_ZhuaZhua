/**
 * Packaged site motion DSL — clamps, allowlists, capability summary.
 * Clone pipelines and `web` read share this contract. Guest JS is never a runtime.
 */

export const SITE_MOTION_VERSION = 1;

export const SITE_MOTION_KINDS = Object.freeze(['reveal', 'fade', 'fade-up', 'fade-down', 'scale']);
export const SITE_HOVER_KINDS = Object.freeze(['lift', 'scale', 'glow']);
export const SITE_MARQUEE_DIRS = Object.freeze(['left', 'right']);
export const SITE_EASINGS = Object.freeze(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);

export const SITE_MOTION_CLAMPS = Object.freeze({
  durationMs: { min: 80, max: 2000, fallback: 500 },
  delayMs: { min: 0, max: 2000, fallback: 0 },
  distancePx: { min: 4, max: 80, fallback: 24 },
  staggerMs: { min: 20, max: 400, fallback: 80 },
  intervalMs: { min: 2000, max: 15000, fallback: 5000 },
  parallaxPx: { min: 2, max: 24, fallback: 8 },
  speedPx: { min: 12, max: 80, fallback: 40 }
});

export const SITE_MOTION_ATTRS = Object.freeze({
  motion: 'data-paw-motion',
  duration: 'data-paw-duration',
  delay: 'data-paw-delay',
  easing: 'data-paw-easing',
  distance: 'data-paw-distance',
  once: 'data-paw-once',
  repeat: 'data-paw-repeat',
  stagger: 'data-paw-stagger',
  carousel: 'data-paw-carousel',
  track: 'data-paw-carousel-track',
  item: 'data-paw-carousel-item',
  prev: 'data-paw-carousel-prev',
  next: 'data-paw-carousel-next',
  toggle: 'data-paw-carousel-toggle',
  progress: 'data-paw-carousel-progress',
  interval: 'data-paw-interval',
  autoplay: 'data-paw-autoplay',
  wrap: 'data-paw-wrap',
  marquee: 'data-paw-marquee',
  speed: 'data-paw-speed',
  direction: 'data-paw-direction',
  pauseHover: 'data-paw-pause-on-hover',
  parallax: 'data-paw-parallax',
  amount: 'data-paw-parallax-amount',
  tabs: 'data-paw-tabs',
  tab: 'data-paw-tab',
  tabPanel: 'data-paw-tab-panel',
  accordion: 'data-paw-accordion',
  accordionItem: 'data-paw-accordion-item',
  accordionTrigger: 'data-paw-accordion-trigger',
  accordionPanel: 'data-paw-accordion-panel',
  hover: 'data-paw-hover'
});

/** Behaviors the packaged runtime will never claim to reproduce. */
export const SITE_MOTION_UNSUPPORTED = Object.freeze([
  'webgl',
  'three',
  'react-three-fiber',
  'spline',
  'canvas-3d',
  'lottie-interactive',
  'gsap-timeline',
  'scrolltrigger',
  'framer-motion-app',
  'react-hydration',
  'auth-wall',
  'arbitrary-onclick',
  'guest-javascript',
  'network-driven-ui'
]);

export const SITE_MOTION_CAPABILITY = Object.freeze({
  version: SITE_MOTION_VERSION,
  runtime: 'packaged',
  interpreter: 'src/preview/siteMotion.js',
  source: 'allowlisted data-paw-* attributes inside same-origin srcdoc',
  guestScripts: false,
  eval: false,
  chromeApis: false,
  network: false,
  cssKeyframesPreserved: true,
  reducedMotion: true,
  behaviors: Object.freeze({
    reveal: SITE_MOTION_KINDS.slice(),
    stagger: true,
    carousel: ['track', 'items', 'prev', 'next', 'toggle', 'progress', 'autoplay', 'keyboard', 'pointer'],
    marquee: ['speed', 'direction', 'pause-on-hover'],
    parallax: ['clamped-translate', 'disabled-on-touch', 'disabled-on-reduced-motion'],
    tabs: true,
    accordion: true,
    hover: SITE_HOVER_KINDS.slice()
  }),
  clamps: SITE_MOTION_CLAMPS,
  attrs: SITE_MOTION_ATTRS,
  unsupported: SITE_MOTION_UNSUPPORTED,
  blueprint: 'annotateSiteMotionBlueprint'
});

export function clampMotionNumber(raw, spec) {
  const { min, max, fallback } = spec;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseTimeMs(raw, spec) {
  const s = String(raw ?? '').trim();
  if (!s) return spec.fallback;
  let n = Number(s);
  if (/ms$/i.test(s)) n = Number(s.replace(/ms$/i, ''));
  else if (/s$/i.test(s)) n = Number(s.replace(/s$/i, '')) * 1000;
  return clampMotionNumber(n, spec);
}

export function parsePx(raw, spec) {
  const s = String(raw ?? '').trim();
  if (!s) return spec.fallback;
  return clampMotionNumber(Number(s.replace(/px$/i, '')), spec);
}

export function parseMotionBool(raw, fallback = false) {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === '') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

export function parseEasing(raw, fallback = 'ease-out') {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (SITE_EASINGS.includes(s)) return s;
  const m = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i.exec(s);
  if (!m) return fallback;
  const nums = m.slice(1).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return fallback;
  const [x1, y1, x2, y2] = nums;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return fallback;
  if (y1 < -2 || y1 > 2 || y2 < -2 || y2 > 2) return fallback;
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

export function parseMotionKind(raw, fallback = 'fade-up') {
  const s = String(raw || '').trim().toLowerCase();
  return SITE_MOTION_KINDS.includes(s) ? s : fallback;
}

export function parseHoverKind(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return SITE_HOVER_KINDS.includes(s) ? s : '';
}

export function parseMarqueeDir(raw, fallback = 'left') {
  const s = String(raw || '').trim().toLowerCase();
  return SITE_MARQUEE_DIRS.includes(s) ? s : fallback;
}

export function nextCarouselIndex(current, count, dir, wrap = true) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return 0;
  const step = dir < 0 ? -1 : 1;
  const next = (Number(current) || 0) + step;
  if (wrap) return ((next % n) + n) % n;
  return Math.min(n - 1, Math.max(0, next));
}

export function revealOnce(attrs = {}) {
  if (attrs.repeat != null && attrs.repeat !== '') return !parseMotionBool(attrs.repeat, false);
  if (attrs.once != null && attrs.once !== '') return parseMotionBool(attrs.once, true);
  return true;
}
