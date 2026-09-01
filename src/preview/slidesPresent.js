/**
 * Presentation-only motion for Paw Slides. Does not mutate tldraw shape props
 * or persist geometry. Editor camera pin stays unchanged.
 */

import {
  DEFAULT_PRESENT_MS,
  DEFAULT_STAGGER_MS,
  motionFromFrameRecord,
  presentDurationMs
} from '../agent/vnext/sessionWorkspace/slideMotion.js';

const TITLE_ROLES = new Set(['title', 'headline', 'cover']);
const BODY_ROLES = new Set(['subtitle', 'body', 'kicker', 'caption', 'card', 'ink', 'quote']);

export function createSlidesPresenter(opts = {}) {
  const state = {
    active: false,
    locked: false,
    fx: null,
    urls: [],
    cache: new Map(),
    anims: [],
    lastFrom: '',
    lastTo: '',
    lastTransition: '',
    storeBefore: ''
  };

  function host() {
    return typeof opts.getHostApi === 'function' ? opts.getHostApi() : opts.hostApi;
  }

  function reducedMotion() {
    try {
      return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
      return false;
    }
  }

  function frames() {
    return host()?.getLayerModel?.()?.frames || [];
  }

  function currentIndex() {
    const list = frames();
    const api = host();
    const id = api?.getSlideState?.()?.frameId || '';
    let idx = list.findIndex((f) => f.id === id);
    if (idx < 0) idx = 0;
    return { list, idx, id: list[idx]?.id || '' };
  }

  function snapshotBytes() {
    try {
      const snap = host()?.getSnapshot?.();
      return JSON.stringify(snap?.document?.store || snap?.store || snap || {});
    } catch {
      return '';
    }
  }

  function ensureFx() {
    let el = document.getElementById('presentFx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'presentFx';
      el.setAttribute('aria-hidden', 'true');
      (document.getElementById('workspace') || document.body).appendChild(el);
    }
    el.hidden = false;
    el.className = 'pw-present-fx';
    el.replaceChildren();
    const from = document.createElement('div');
    const to = document.createElement('div');
    from.className = 'pw-present-layer pw-present-from';
    to.className = 'pw-present-layer pw-present-to';
    el.append(from, to);
    state.fx = { root: el, from, to };
    return state.fx;
  }

  function revokeUrls() {
    for (const u of state.urls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* */
      }
    }
    state.urls = [];
  }

  function cancelAnims() {
    for (const a of state.anims) {
      try {
        a.cancel?.();
      } catch {
        /* */
      }
    }
    state.anims = [];
    for (const node of document.querySelectorAll('.pw-present-enter')) {
      node.classList.remove('pw-present-enter');
      node.style.removeProperty('opacity');
      node.style.removeProperty('transform');
    }
  }

  async function captureFrame(frameId, { useCache = true } = {}) {
    if (!frameId) return '';
    if (useCache && state.cache.has(frameId)) return state.cache.get(frameId);
    const api = host();
    const editor = api?.getEditor?.();
    let bytes;
    try {
      if (typeof editor?.toImage === 'function') {
        const out = await editor.toImage(frameId, { format: 'png', scale: 1, background: true, padding: 0 });
        const blob = out?.blob;
        if (blob) bytes = new Uint8Array(await blob.arrayBuffer());
      }
      if (!bytes?.byteLength && typeof api?.exportPng === 'function') {
        bytes = await api.exportPng({ ids: [frameId], scale: 1, padding: 0 });
      }
    } catch {
      bytes = null;
    }
    if (!bytes?.byteLength) return '';
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    state.urls.push(url);
    if (useCache) state.cache.set(frameId, url);
    return url;
  }

  async function preloadAround(idx) {
    const list = frames();
    await captureFrame(list[idx]?.id);
    await captureFrame(list[idx + 1]?.id);
    await captureFrame(list[idx - 1]?.id);
  }

  function frameRecord(frameId) {
    try {
      return host()?.getEditor?.()?.getShape?.(frameId) || frames().find((f) => f.id === frameId) || null;
    } catch {
      return frames().find((f) => f.id === frameId) || null;
    }
  }

  function playOverlay(fromUrl, toUrl, transition, ms) {
    const fx = ensureFx();
    const type = reducedMotion() || !ms ? 'none' : transition?.type || 'fade';
    fx.from.style.backgroundImage = fromUrl ? `url("${fromUrl}")` : '';
    fx.to.style.backgroundImage = toUrl ? `url("${toUrl}")` : '';
    fx.root.dataset.transition = type;
    fx.from.style.opacity = '1';
    fx.to.style.opacity = type === 'none' ? '1' : '0';
    fx.from.style.transform = 'translate3d(0,0,0)';
    fx.to.style.transform =
      type === 'push' ? 'translate3d(100%,0,0)' : type === 'wipe' ? 'translate3d(100%,0,0)' : 'translate3d(0,0,0)';
    if (type === 'none' || ms <= 0) {
      fx.from.style.opacity = '0';
      fx.to.style.opacity = '1';
      return Promise.resolve();
    }
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const fromKey =
      type === 'push'
        ? [
            { transform: 'translate3d(0,0,0)', opacity: 1 },
            { transform: 'translate3d(-24%,0,0)', opacity: 0 }
          ]
        : type === 'wipe'
          ? [
              { clipPath: 'inset(0 0 0 0)', opacity: 1 },
              { clipPath: 'inset(0 100% 0 0)', opacity: 1 }
            ]
          : [
              { opacity: 1 },
              { opacity: 0 }
            ];
    const toKey =
      type === 'push'
        ? [
            { transform: 'translate3d(100%,0,0)', opacity: 1 },
            { transform: 'translate3d(0,0,0)', opacity: 1 }
          ]
        : type === 'wipe'
          ? [
              { clipPath: 'inset(0 0 0 100%)', opacity: 1 },
              { clipPath: 'inset(0 0 0 0)', opacity: 1 }
            ]
          : [
              { opacity: 0 },
              { opacity: 1 }
            ];
    const a1 = fx.from.animate(fromKey, { duration: ms, easing, fill: 'forwards' });
    const a2 = fx.to.animate(toKey, { duration: ms, easing, fill: 'forwards' });
    state.anims.push(a1, a2);
    state.lastTransition = type;
    return Promise.all([a1.finished.catch(() => {}), a2.finished.catch(() => {})]);
  }

  function hideOverlaySoon() {
    const fx = state.fx;
    if (!fx?.root) return;
    window.setTimeout(() => {
      if (!state.active) return;
      fx.from.style.backgroundImage = '';
      fx.to.style.backgroundImage = '';
      fx.from.style.opacity = '0';
      fx.to.style.opacity = '0';
    }, 40);
  }

  function shapeEl(id) {
    const raw = String(id || '');
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(raw) : raw.replace(/"/g, '\\"');
    return (
      document.querySelector(`[data-shape-id="${esc}"]`) ||
      document.querySelector(`[data-shapeid="${esc}"]`) ||
      document.querySelector(`.tl-shape[id="${esc}"]`)
    );
  }

  function roleOf(shape) {
    return String(shape?.meta?.pawRole || shape?.meta?.pawSlot || shape?.meta?.pawType || '').toLowerCase();
  }

  function staggerEntrance(frameId, preset) {
    if (preset === 'none' || reducedMotion()) return;
    const editor = host()?.getEditor?.();
    if (!editor?.getCurrentPageShapes) return;
    const skipRole = /^(bg|paper|decoration|rule)$/;
    const kids = (editor.getCurrentPageShapes() || []).filter((s) => {
      if (!s || s.id === frameId || s.type === 'frame') return false;
      if (skipRole.test(roleOf(s))) return false;
      let p = s.parentId ? editor.getShape(s.parentId) : null;
      while (p) {
        if (p.id === frameId) return true;
        p = p.parentId ? editor.getShape(p.parentId) : null;
      }
      return s.parentId === frameId;
    });
    const title = [];
    const rest = [];
    for (const s of kids) {
      const role = roleOf(s);
      if (TITLE_ROLES.has(role) || /title/.test(role)) title.push(s);
      else if (BODY_ROLES.has(role) || s.type === 'text' || s.type === 'image' || role === 'card') rest.push(s);
    }
    const ordered = [...title, ...rest];
    const ms = preset === 'fade' ? 220 : 240;
    const gap = preset === 'stagger-fade' ? DEFAULT_STAGGER_MS : 0;
    ordered.forEach((s, i) => {
      const el = shapeEl(s.id);
      if (!el || typeof el.animate !== 'function') return;
      el.classList.add('pw-present-enter');
      const delay = TITLE_ROLES.has(roleOf(s)) || /title/.test(roleOf(s)) ? 0 : gap * Math.max(0, i);
      const anim = el.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: ms, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      );
      anim.finished
        .catch(() => {})
        .finally(() => {
          try {
            anim.cancel();
          } catch {
            /* */
          }
          el.style.removeProperty('opacity');
          el.style.removeProperty('transform');
          el.classList.remove('pw-present-enter');
        });
      state.anims.push(anim);
    });
  }

  async function showIndex(nextIdx, { animate = true } = {}) {
    const list = frames();
    const next = list[nextIdx];
    if (!next) return false;
    const { idx, id: fromId } = currentIndex();
    if (state.locked) return false;
    const rec = frameRecord(next.id);
    const motion = motionFromFrameRecord(rec || next);
    const ms = animate ? presentDurationMs(motion.transition, reducedMotion()) : 0;
    state.locked = true;
    try {
      const fromUrl = animate ? await captureFrame(fromId || list[idx]?.id, { useCache: true }) : '';
      host()?.pinSlide?.(next.id, { view: 'page', animate: false });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const toUrl = animate ? await captureFrame(next.id, { useCache: false }) : '';
      state.lastFrom = fromId;
      state.lastTo = next.id;
      if (animate && (fromUrl || toUrl) && ms > 0) {
        await playOverlay(fromUrl, toUrl, motion.transition, ms || DEFAULT_PRESENT_MS);
        hideOverlaySoon();
      } else if (animate) {
        state.lastTransition = motion.transition?.type || 'fade';
        const engine = document.getElementById('engine');
        if (engine && typeof engine.animate === 'function' && ms > 0) {
          const fade = engine.animate([{ opacity: 0.2 }, { opacity: 1 }], {
            duration: ms,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards'
          });
          state.anims.push(fade);
          await fade.finished.catch(() => {});
          try {
            fade.cancel();
          } catch {
            /* */
          }
          engine.style.removeProperty('opacity');
        }
      }
      staggerEntrance(next.id, motion.animation?.preset);
      await preloadAround(nextIdx);
      expose();
    } finally {
      state.locked = false;
    }
    return true;
  }

  async function enter() {
    if (state.active) return true;
    state.storeBefore = snapshotBytes();
    state.active = true;
    state.cache.clear();
    document.body.dataset.present = '1';
    host()?.setSlideView?.('page');
    const { list, idx } = currentIndex();
    if (list[idx]?.id) host()?.pinSlide?.(list[idx].id, { view: 'page', animate: false });
    ensureFx();
    await preloadAround(idx);
    staggerEntrance(list[idx]?.id, motionFromFrameRecord(frameRecord(list[idx]?.id)).animation?.preset);
    expose();
    return true;
  }

  function exit() {
    cancelAnims();
    revokeUrls();
    state.cache.clear();
    state.active = false;
    state.locked = false;
    document.body.dataset.present = '';
    if (state.fx?.root) {
      state.fx.root.hidden = true;
      state.fx.root.replaceChildren();
    }
    state.fx = null;
    expose();
    return true;
  }

  async function step(delta) {
    if (!state.active || state.locked) return false;
    const { list, idx } = currentIndex();
    const next = idx + delta;
    if (next < 0 || next >= list.length) return false;
    cancelAnims();
    return showIndex(next, { animate: true });
  }

  function expose() {
    window.__pawPresent = {
      active: state.active,
      locked: state.locked,
      lastFrom: state.lastFrom,
      lastTo: state.lastTo,
      lastTransition: state.lastTransition,
      storeBefore: state.storeBefore,
      storeNow: snapshotBytes(),
      storeUnchanged: state.storeBefore ? state.storeBefore === snapshotBytes() : true,
      reduced: reducedMotion()
    };
  }

  return {
    isActive: () => state.active,
    isLocked: () => state.locked,
    enter,
    exit,
    step,
    captureFrame,
    snapshotBytes,
    getDebug: () => ({ ...state, reduced: reducedMotion() })
  };
}
