/**
 * Packaged site motion — host-owned interpreter for allowlisted data-paw-* attrs.
 * Runs against the same-origin srcdoc document. No eval, no chrome, no network.
 */

import {
  SITE_MOTION_ATTRS as A,
  SITE_MOTION_CLAMPS as C,
  SITE_MOTION_VERSION,
  nextCarouselIndex,
  parseEasing,
  parseHoverKind,
  parseMarqueeDir,
  parseMotionBool,
  parseMotionKind,
  parsePx,
  parseTimeMs,
  revealOnce
} from '../agent/vnext/sessionWorkspace/siteMotionSchema.js';

export const SITE_MOTION_STYLE_ID = 'paw-site-motion';
export const SITE_MOTION_RUNTIME_ATTR = 'data-paw-motion-runtime';

const handles = new WeakMap();

export function mountSiteMotion(doc, opts = {}) {
  if (!doc || !doc.documentElement) {
    return emptyHandle('no-document');
  }
  unmountSiteMotion(doc);
  const diagnostics = [];
  const cleanups = [];
  const stats = { observers: 0, timers: 0, listeners: 0, raf: 0 };
  const reduced = prefersReducedMotion(doc, opts);
  const pickActive = typeof opts.pickActive === 'function' ? opts.pickActive : () => false;
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);

  isolate('style', diagnostics, () => {
    injectMotionStyle(doc);
  });

  isolate('reveal', diagnostics, () => {
    mountReveal(doc, { reduced, cleanups, stats, win, opts, diagnostics });
  });
  isolate('carousel', diagnostics, () => {
    mountCarousels(doc, { reduced, cleanups, stats, win, pickActive, diagnostics });
  });
  isolate('marquee', diagnostics, () => {
    mountMarquees(doc, { reduced, cleanups, stats, win, diagnostics });
  });
  isolate('parallax', diagnostics, () => {
    mountParallax(doc, { reduced, cleanups, stats, win, diagnostics });
  });
  isolate('tabs', diagnostics, () => {
    mountTabs(doc, { cleanups, stats, pickActive, diagnostics });
  });
  isolate('accordion', diagnostics, () => {
    mountAccordions(doc, { cleanups, stats, pickActive, diagnostics });
  });
  isolate('hover', diagnostics, () => {
    markHover(doc);
  });

  if (diagnostics.length) {
    try {
      doc.documentElement.setAttribute('data-paw-motion-diag', String(diagnostics.length));
    } catch {
      /* ignore */
    }
  }

  const handle = {
    version: SITE_MOTION_VERSION,
    reduced,
    diagnostics,
    stats,
    destroy() {
      while (cleanups.length) {
        const fn = cleanups.pop();
        try {
          fn();
        } catch {
          /* isolate teardown */
        }
      }
      stats.observers = 0;
      stats.timers = 0;
      stats.listeners = 0;
      stats.raf = 0;
      try {
        handles.delete(doc);
      } catch {
        /* ignore */
      }
      try {
        if (win && win.__pawSiteMotion === handle) delete win.__pawSiteMotion;
      } catch {
        /* ignore */
      }
    }
  };
  handles.set(doc, handle);
  try {
    if (win) win.__pawSiteMotion = handle;
  } catch {
    /* ignore */
  }
  if (typeof opts.onDiagnostic === 'function' && diagnostics.length) {
    try {
      opts.onDiagnostic(diagnostics);
    } catch {
      /* ignore */
    }
  }
  return handle;
}

export function unmountSiteMotion(docOrHandle) {
  if (!docOrHandle) return;
  if (typeof docOrHandle.destroy === 'function') {
    docOrHandle.destroy();
    return;
  }
  const h = handles.get(docOrHandle);
  if (h) h.destroy();
}

export function stripSiteMotionChrome(doc) {
  if (!doc) return;
  unmountSiteMotion(doc);
  try {
    doc.getElementById(SITE_MOTION_STYLE_ID)?.remove();
  } catch {
    /* ignore */
  }
  try {
    for (const el of doc.querySelectorAll(`[${SITE_MOTION_RUNTIME_ATTR}]`)) el.remove();
  } catch {
    /* ignore */
  }
  const runtimeClass = /(?:^|\s)(?:paw-motion-in|paw-motion-ready|paw-is-active|paw-is-paused|paw-marquee-row)(?:\s|$)/;
  try {
    for (const el of doc.querySelectorAll('[class]')) {
      const next = String(el.className || '')
        .split(/\s+/)
        .filter((c) => c && !/^paw-(motion-in|motion-ready|is-active|is-paused|marquee-row)$/.test(c))
        .join(' ');
      if (next !== el.className && runtimeClass.test(String(el.className || ''))) el.className = next;
    }
  } catch {
    /* ignore */
  }
  try {
    doc.documentElement?.removeAttribute('data-paw-motion-diag');
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(doc, opts = {}) {
  if (opts.reducedMotion === true) return true;
  if (opts.reducedMotion === false) return false;
  try {
    const win = doc?.defaultView;
    return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  } catch {
    return false;
  }
}

function emptyHandle(reason) {
  return {
    version: SITE_MOTION_VERSION,
    reduced: false,
    diagnostics: reason ? [{ component: 'mount', error: reason }] : [],
    stats: { observers: 0, timers: 0, listeners: 0, raf: 0 },
    destroy() {}
  };
}

function isolate(name, diagnostics, fn) {
  try {
    fn();
  } catch (e) {
    diagnostics.push({ component: name, error: e instanceof Error ? e.message : String(e) });
  }
}

function injectMotionStyle(doc) {
  if (doc.getElementById(SITE_MOTION_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.setAttribute('id', SITE_MOTION_STYLE_ID);
  st.id = SITE_MOTION_STYLE_ID;
  st.setAttribute(SITE_MOTION_RUNTIME_ATTR, 'style');
  st.textContent = motionCss();
  (doc.head || doc.documentElement).appendChild(st);
}

function motionCss() {
  return `
[${A.motion}]{opacity:0;will-change:transform,opacity}
[${A.motion}].paw-motion-ready, [${A.motion}].paw-motion-in{opacity:1}
[${A.motion}="fade-up"]:not(.paw-motion-in){transform:translateY(var(--paw-distance,24px))}
[${A.motion}="reveal"]:not(.paw-motion-in){transform:translateY(var(--paw-distance,24px))}
[${A.motion}="fade-down"]:not(.paw-motion-in){transform:translateY(calc(var(--paw-distance,24px)*-1))}
[${A.motion}="scale"]:not(.paw-motion-in){transform:scale(.96)}
[${A.motion}].paw-motion-in{transform:none;transition:opacity var(--paw-duration,500ms) var(--paw-easing,ease-out) var(--paw-delay,0ms),transform var(--paw-duration,500ms) var(--paw-easing,ease-out) var(--paw-delay,0ms)}
[${A.carousel}]{position:relative}
[${A.track}]{display:flex;transition:transform .45s ease;will-change:transform}
[${A.item}]{flex:0 0 100%;min-width:0}
[${A.item}][aria-hidden="true"]{visibility:hidden}
[${A.marquee}]{overflow:hidden}
[${A.marquee}] .paw-marquee-row{display:flex;width:max-content;gap:inherit;animation:paw-marquee-x var(--paw-marquee-duration,20s) linear infinite}
[${A.marquee}][data-paw-direction="right"] .paw-marquee-row{animation-name:paw-marquee-x-rev}
[${A.marquee}]:hover .paw-marquee-row, [${A.marquee}]:focus-within .paw-marquee-row{animation-play-state:paused}
[${A.hover}="lift"]:hover,[${A.hover}="lift"]:focus-visible{transform:translateY(-4px);transition:transform .2s ease}
[${A.hover}="scale"]:hover,[${A.hover}="scale"]:focus-visible{transform:scale(1.03);transition:transform .2s ease}
[${A.hover}="glow"]:hover,[${A.hover}="glow"]:focus-visible{box-shadow:0 0 0 4px color-mix(in srgb, currentColor 18%, transparent);transition:box-shadow .2s ease}
@keyframes paw-marquee-x{to{transform:translateX(-50%)}}
@keyframes paw-marquee-x-rev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){
  [${A.motion}],[${A.motion}].paw-motion-in{opacity:1!important;transform:none!important;transition:none!important}
  [${A.marquee}] .paw-marquee-row{animation:none!important;transform:none!important}
  [${A.hover}="lift"]:hover,[${A.hover}="lift"]:focus-visible,[${A.hover}="scale"]:hover,[${A.hover}="scale"]:focus-visible{transform:none}
}
`.replace(/\s+/g, ' ');
}

function mountReveal(doc, ctx) {
  const roots = [...qsa(doc, `[${A.motion}], [${A.stagger}]`)];
  if (!roots.length) return;
  const seen = new Set();
  const targets = [];
  for (const el of roots) {
    if (el.hasAttribute(A.stagger)) prepareStagger(el, ctx.reduced);
    if (el.hasAttribute(A.motion)) {
      prepareRevealEl(el);
      if (!seen.has(el)) {
        seen.add(el);
        targets.push(el);
      }
    }
    if (el.hasAttribute(A.stagger)) {
      for (const child of elementChildren(el)) {
        if (!child.hasAttribute(A.motion)) {
          child.setAttribute(A.motion, 'fade-up');
          prepareRevealEl(child);
        }
        if (!seen.has(child)) {
          seen.add(child);
          targets.push(child);
        }
      }
    }
  }
  if (ctx.reduced) {
    for (const el of targets) el.classList.add('paw-motion-in', 'paw-motion-ready');
    return;
  }
  const IO = ctx.win?.IntersectionObserver;
  if (typeof IO !== 'function') {
    for (const el of targets) el.classList.add('paw-motion-in', 'paw-motion-ready');
    return;
  }
  const observer = new IO(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add('paw-motion-in', 'paw-motion-ready');
          if (revealOnce(attrMap(el))) observer.unobserve(el);
        } else if (!revealOnce(attrMap(el))) {
          el.classList.remove('paw-motion-in');
        }
      }
    },
    { threshold: 0.16, root: null, rootMargin: '0px 0px -8% 0px' }
  );
  for (const el of targets) observer.observe(el);
  ctx.stats.observers += 1;
  ctx.cleanups.push(() => {
    try {
      observer.disconnect();
    } catch {
      /* ignore */
    }
    ctx.stats.observers = Math.max(0, ctx.stats.observers - 1);
  });
}

function prepareRevealEl(el) {
  const duration = parseTimeMs(el.getAttribute(A.duration), C.durationMs);
  const delay = parseTimeMs(el.getAttribute(A.delay), C.delayMs);
  const distance = parsePx(el.getAttribute(A.distance), C.distancePx);
  const easing = parseEasing(el.getAttribute(A.easing));
  const kind = parseMotionKind(el.getAttribute(A.motion), 'fade-up');
  if (el.getAttribute(A.motion) !== kind) el.setAttribute(A.motion, kind);
  el.style.setProperty('--paw-duration', `${duration}ms`);
  el.style.setProperty('--paw-delay', `${delay}ms`);
  el.style.setProperty('--paw-distance', `${distance}px`);
  el.style.setProperty('--paw-easing', easing);
}

function prepareStagger(el, reduced) {
  const step = parseTimeMs(el.getAttribute(A.stagger), C.staggerMs);
  if (reduced) return;
  elementChildren(el).forEach((child, i) => {
    const extra = i * step;
    const base = parseTimeMs(child.getAttribute(A.delay), C.delayMs);
    child.setAttribute(A.delay, String(Math.min(C.delayMs.max, base + extra)));
  });
}

function mountCarousels(doc, ctx) {
  for (const root of qsa(doc, `[${A.carousel}]`)) {
    isolate(`carousel:${shortName(root)}`, ctx.diagnostics, () => bindCarousel(root, doc, ctx));
  }
}

function bindCarousel(root, doc, ctx) {
  const track = root.querySelector(`[${A.track}]`) || firstChild(root);
  const items = track ? [...track.querySelectorAll(`[${A.item}]`)] : [...root.querySelectorAll(`[${A.item}]`)];
  const slides = items.length ? items : track ? elementChildren(track) : [];
  if (!slides.length) return;
  slides.forEach((el) => {
    if (!el.hasAttribute(A.item)) el.setAttribute(A.item, '');
  });
  const prev = findCarouselControl(root, A.prev);
  const next = findCarouselControl(root, A.next);
  const toggle = findCarouselControl(root, A.toggle);
  const progress = findCarouselControl(root, A.progress);
  const wrap = parseMotionBool(root.getAttribute(A.wrap), true);
  const interval = parseTimeMs(root.getAttribute(A.interval), C.intervalMs);
  let autoplay = !ctx.reduced && parseMotionBool(root.getAttribute(A.autoplay), true);
  let index = Math.max(0, slides.findIndex((el) => el.classList.contains('paw-is-active') || el.getAttribute('aria-hidden') === 'false'));
  if (index < 0) index = 0;
  let timer = 0;
  let paused = false;
  let drag = null;

  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
  root.setAttribute('role', root.getAttribute('role') || 'region');

  const paint = () => {
    if (track) {
      track.style.transform = `translateX(-${index * 100}%)`;
    }
    slides.forEach((el, i) => {
      const on = i === index;
      el.classList.toggle('paw-is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    if (progress) {
      const pct = ((index + 1) / slides.length) * 100;
      progress.style.setProperty('--paw-progress', `${pct}%`);
      const fill = progress.querySelector('[data-paw-carousel-fill]') || firstChild(progress);
      if (fill && fill !== progress) fill.style.width = `${pct}%`;
      else progress.setAttribute('aria-valuenow', String(index + 1));
      progress.setAttribute('aria-valuemin', '1');
      progress.setAttribute('aria-valuemax', String(slides.length));
    }
    if (toggle) {
      toggle.setAttribute('aria-pressed', autoplay && !paused ? 'true' : 'false');
      root.classList.toggle('paw-is-paused', !autoplay || paused);
    }
  };

  const go = (dir) => {
    index = nextCarouselIndex(index, slides.length, dir, wrap);
    paint();
  };

  const stopTimer = () => {
    if (timer && ctx.win) {
      ctx.win.clearInterval(timer);
      timer = 0;
      ctx.stats.timers = Math.max(0, ctx.stats.timers - 1);
    }
  };

  const startTimer = () => {
    stopTimer();
    if (!autoplay || paused || ctx.reduced || !ctx.win) return;
    timer = ctx.win.setInterval(() => go(1), interval);
    ctx.stats.timers += 1;
  };

  const onPrev = (e) => {
    if (ctx.pickActive()) return;
    e.preventDefault();
    go(-1);
    startTimer();
  };
  const onNext = (e) => {
    if (ctx.pickActive()) return;
    e.preventDefault();
    go(1);
    startTimer();
  };
  const onToggle = (e) => {
    if (ctx.pickActive()) return;
    e.preventDefault();
    autoplay = !autoplay;
    paused = !autoplay;
    paint();
    startTimer();
  };
  const onKey = (e) => {
    if (ctx.pickActive()) return;
    if (!root.contains(e.target)) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };
  const pauseSoft = () => {
    paused = true;
    stopTimer();
    paint();
  };
  const resumeSoft = () => {
    if (!autoplay) return;
    paused = false;
    startTimer();
    paint();
  };
  const onVis = () => {
    if (doc.hidden) pauseSoft();
    else resumeSoft();
  };

  listen(prev, 'click', onPrev, ctx);
  listen(next, 'click', onNext, ctx);
  listen(toggle, 'click', onToggle, ctx);
  listen(root, 'keydown', onKey, ctx);
  listen(root, 'mouseenter', pauseSoft, ctx);
  listen(root, 'mouseleave', resumeSoft, ctx);
  listen(root, 'focusin', pauseSoft, ctx);
  listen(root, 'focusout', (e) => {
    if (!root.contains(e.relatedTarget)) resumeSoft();
  }, ctx);
  listen(doc, 'visibilitychange', onVis, ctx);

  if (!ctx.pickActive()) {
    const surface = track || root;
    listen(surface, 'pointerdown', (e) => {
      if (ctx.pickActive() || e.button) return;
      drag = { x: e.clientX, moved: false, id: e.pointerId };
    }, ctx);
    listen(surface, 'pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (Math.abs(e.clientX - drag.x) > 36) drag.moved = true;
    }, ctx);
    listen(surface, 'pointerup', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      if (drag.moved && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      drag = null;
    }, ctx);
    listen(surface, 'pointercancel', () => {
      drag = null;
    }, ctx);
    listen(surface, 'click', (e) => {
      if (drag?.moved) e.preventDefault();
    }, ctx);
  }

  paint();
  startTimer();
  ctx.cleanups.push(() => {
    stopTimer();
    if (track) track.style.transform = '';
  });
}

function mountMarquees(doc, ctx) {
  for (const root of qsa(doc, `[${A.marquee}]`)) {
    isolate(`marquee:${shortName(root)}`, ctx.diagnostics, () => bindMarquee(root, ctx));
  }
}

function bindMarquee(root, ctx) {
  const speed = parsePx(root.getAttribute(A.speed), C.speedPx);
  const dir = parseMarqueeDir(root.getAttribute(A.direction));
  root.setAttribute(A.direction, dir);
  if (ctx.reduced) return;
  if (root.querySelector('.paw-marquee-row')) return;
  const row = root.ownerDocument.createElement('div');
  row.className = 'paw-marquee-row';
  row.setAttribute(SITE_MOTION_RUNTIME_ATTR, 'marquee');
  const live = root.ownerDocument.createElement('div');
  live.setAttribute(SITE_MOTION_RUNTIME_ATTR, 'marquee-live');
  while (root.firstChild) live.appendChild(root.firstChild);
  const clone = live.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute(SITE_MOTION_RUNTIME_ATTR, 'marquee-clone');
  row.appendChild(live);
  row.appendChild(clone);
  root.appendChild(row);
  const width = Math.max(1, live.getBoundingClientRect?.().width || live.scrollWidth || 320);
  const duration = Math.max(6, Math.round(width / speed));
  root.style.setProperty('--paw-marquee-duration', `${duration}s`);
  if (root.getAttribute(A.pauseHover) === 'false') {
    row.style.animationPlayState = 'running';
  }
  ctx.cleanups.push(() => {
    if (!row.parentNode) return;
    while (live.firstChild) root.insertBefore(live.firstChild, row);
    row.remove();
  });
}

function mountParallax(doc, ctx) {
  if (ctx.reduced) return;
  const nodes = qsa(doc, `[${A.parallax}]`);
  if (!nodes.length) return;
  const coarse = !!ctx.win?.matchMedia?.('(pointer: coarse)')?.matches;
  if (coarse) return;
  let raf = 0;
  const tick = () => {
    raf = 0;
    ctx.stats.raf = 0;
    const vh = ctx.win?.innerHeight || 800;
    for (const el of nodes) {
      const amount = parsePx(el.getAttribute(A.amount) || el.getAttribute(A.parallax), C.parallaxPx);
      const rect = el.getBoundingClientRect?.();
      if (!rect) continue;
      const mid = rect.top + rect.height / 2;
      const t = (0.5 - mid / vh) * 2;
      const y = Math.max(-amount, Math.min(amount, t * amount));
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    }
  };
  const onScroll = () => {
    if (raf) return;
    raf = ctx.win?.requestAnimationFrame ? ctx.win.requestAnimationFrame(tick) : (tick(), 0);
    if (raf) ctx.stats.raf += 1;
  };
  listen(ctx.win || doc, 'scroll', onScroll, ctx, { passive: true });
  listen(ctx.win || doc, 'resize', onScroll, ctx, { passive: true });
  tick();
  ctx.cleanups.push(() => {
    if (raf && ctx.win?.cancelAnimationFrame) ctx.win.cancelAnimationFrame(raf);
    raf = 0;
    ctx.stats.raf = 0;
    for (const el of nodes) el.style.transform = '';
  });
}

function mountTabs(doc, ctx) {
  for (const root of qsa(doc, `[${A.tabs}]`)) {
    isolate(`tabs:${shortName(root)}`, ctx.diagnostics, () => bindTabs(root, ctx));
  }
}

function bindTabs(root, ctx) {
  const tabs = [...root.querySelectorAll(`[${A.tab}]`)];
  const panels = [...root.querySelectorAll(`[${A.tabPanel}]`)];
  if (!tabs.length || !panels.length) return;
  const select = (i) => {
    tabs.forEach((tab, idx) => {
      const on = idx === i;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
      const panel = panelFor(tab, panels, idx);
      if (panel) {
        panel.hidden = !on;
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
  };
  let current = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  if (current < 0) current = 0;
  tabs.forEach((tab, i) => {
    if (!tab.hasAttribute('role')) tab.setAttribute('role', 'tab');
    listen(tab, 'click', (e) => {
      if (ctx.pickActive()) return;
      e.preventDefault();
      current = i;
      select(current);
    }, ctx);
    listen(tab, 'keydown', (e) => {
      if (ctx.pickActive()) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        current = nextCarouselIndex(current, tabs.length, e.key === 'ArrowRight' ? 1 : -1, true);
        select(current);
        tabs[current]?.focus?.();
      } else if (e.key === 'Home') {
        e.preventDefault();
        current = 0;
        select(current);
        tabs[0]?.focus?.();
      } else if (e.key === 'End') {
        e.preventDefault();
        current = tabs.length - 1;
        select(current);
        tabs[current]?.focus?.();
      }
    }, ctx);
  });
  panels.forEach((p) => {
    if (!p.hasAttribute('role')) p.setAttribute('role', 'tabpanel');
  });
  select(current);
}

function panelFor(tab, panels, index) {
  const id = String(tab.getAttribute('aria-controls') || '').trim();
  if (id) {
    const doc = tab.ownerDocument;
    try {
      return doc.getElementById(id) || panels[index];
    } catch {
      return panels[index];
    }
  }
  return panels[index];
}

function mountAccordions(doc, ctx) {
  for (const root of qsa(doc, `[${A.accordion}]`)) {
    isolate(`accordion:${shortName(root)}`, ctx.diagnostics, () => bindAccordion(root, ctx));
  }
}

function bindAccordion(root, ctx) {
  const items = [...root.querySelectorAll(`[${A.accordionItem}]`)];
  const list = items.length ? items : [root];
  for (const item of list) {
    const trigger = item.querySelector(`[${A.accordionTrigger}]`) || item.querySelector('button');
    const panel = item.querySelector(`[${A.accordionPanel}]`);
    if (!trigger || !panel) continue;
    const id = panel.id || '';
    if (id && !trigger.getAttribute('aria-controls')) trigger.setAttribute('aria-controls', id);
    const open = trigger.getAttribute('aria-expanded') === 'true' || !panel.hidden;
    const setOpen = (on) => {
      trigger.setAttribute('aria-expanded', on ? 'true' : 'false');
      panel.hidden = !on;
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    };
    setOpen(open);
    listen(trigger, 'click', (e) => {
      if (ctx.pickActive()) return;
      e.preventDefault();
      setOpen(trigger.getAttribute('aria-expanded') !== 'true');
    }, ctx);
    listen(trigger, 'keydown', (e) => {
      if (ctx.pickActive()) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(trigger.getAttribute('aria-expanded') !== 'true');
      }
    }, ctx);
  }
}

function markHover(doc) {
  for (const el of qsa(doc, `[${A.hover}]`)) {
    const kind = parseHoverKind(el.getAttribute(A.hover));
    if (kind) el.setAttribute(A.hover, kind);
    if (!el.hasAttribute('tabindex') && !/^(a|button|input|select|textarea)$/i.test(el.tagName || '')) {
      el.setAttribute('tabindex', '0');
    }
  }
}

function listen(el, type, fn, ctx, opts) {
  if (!el || typeof el.addEventListener !== 'function') return;
  el.addEventListener(type, fn, opts);
  ctx.stats.listeners += 1;
  ctx.cleanups.push(() => {
    try {
      el.removeEventListener(type, fn, opts);
    } catch {
      /* ignore */
    }
    ctx.stats.listeners = Math.max(0, ctx.stats.listeners - 1);
  });
}

function qsa(root, sel) {
  try {
    return [...(root.querySelectorAll?.(sel) || [])];
  } catch {
    return [];
  }
}

function elementChildren(el) {
  return [...(el.children || [])].filter((n) => n && n.nodeType === 1);
}

function firstChild(el) {
  if (!el) return null;
  if (el.firstElementChild && el.firstElementChild.nodeType === 1) return el.firstElementChild;
  const kids = el.children || el.childNodes || [];
  for (const n of kids) {
    if (n && n.nodeType === 1) return n;
  }
  const node = el.firstChild;
  return node && node.nodeType === 1 ? node : null;
}

function findCarouselControl(root, attr) {
  if (!root) return null;
  const hit = root.querySelector(`[${attr}]`);
  if (hit) return hit;
  let scope = root.parentElement || root.parentNode;
  while (scope && scope.nodeType === 1) {
    const tag = String(scope.tagName || '');
    if (tag === 'BODY' || tag === 'HTML') break;
    const match = [...(scope.querySelectorAll?.(`[${attr}]`) || [])].find((el) => {
      if (root.contains?.(el)) return false;
      const owner = el.closest?.(`[${A.carousel}]`);
      return !owner || owner === root;
    });
    if (match) return match;
    if (tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN') break;
    scope = scope.parentElement || scope.parentNode;
  }
  return null;
}

function attrMap(el) {
  return {
    once: el.getAttribute(A.once),
    repeat: el.getAttribute(A.repeat)
  };
}

function shortName(el) {
  return String(el.id || el.getAttribute(A.carousel) || el.tagName || 'el').slice(0, 24);
}
