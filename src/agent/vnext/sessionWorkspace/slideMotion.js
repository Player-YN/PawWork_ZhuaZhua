/**
 * Slide transition + entrance presets. Shared by pawCanvas compile, PPTX export,
 * and live Slides present. Does not mutate shape geometry.
 */

export const TRANSITION_TYPES = Object.freeze(['fade', 'push', 'wipe', 'none']);
export const ANIMATION_PRESETS = Object.freeze(['stagger-fade', 'fade', 'none']);

export const DEFAULT_TRANSITION_TYPE = 'fade';
export const DEFAULT_TRANSITION_MS = 350;
export const DEFAULT_PRESENT_MS = 320;
export const DEFAULT_STAGGER_MS = 80;

/**
 * @param {object} [input]
 * @param {{ semantic?: boolean }} [opts]
 */
export function normalizeSlideMotion(input = {}, opts = {}) {
  const raw =
    input && typeof input === 'object'
      ? input.transition && typeof input.transition === 'object'
        ? input
        : {
            transition: input.pawTransition || input.meta?.pawTransition || input.transition,
            animation: input.pawAnimation || input.meta?.pawAnimation || input.animation
          }
      : {};
  const tIn = raw.transition && typeof raw.transition === 'object' ? raw.transition : {};
  const aIn = raw.animation && typeof raw.animation === 'object' ? raw.animation : {};
  const type = normalizeTransitionType(tIn.type ?? tIn.name);
  const durationMs = normalizeDurationMs(tIn.durationMs ?? tIn.duration ?? tIn.ms, DEFAULT_TRANSITION_MS);
  const semantic = opts.semantic !== false;
  const preset = normalizeAnimationPreset(
    aIn.preset ?? aIn.type ?? aIn.name,
    semantic ? 'stagger-fade' : 'fade'
  );
  return {
    transition: { type, durationMs: type === 'none' ? 0 : durationMs },
    animation: { preset }
  };
}

export function slideMotionMeta(input, opts = {}) {
  const motion = normalizeSlideMotion(input, opts);
  return {
    pawTransition: motion.transition,
    pawAnimation: motion.animation
  };
}

export function motionFromFrameRecord(rec) {
  return normalizeSlideMotion(
    {
      transition: rec?.meta?.pawTransition,
      animation: rec?.meta?.pawAnimation
    },
    { semantic: !!(rec?.meta?.pawLayout || rec?.meta?.pawRole) }
  );
}

export function normalizeTransitionType(value) {
  const s = String(value || '')
    .trim()
    .toLowerCase();
  if (TRANSITION_TYPES.includes(s)) return s;
  return DEFAULT_TRANSITION_TYPE;
}

export function normalizeAnimationPreset(value, fallback = 'stagger-fade') {
  const s = String(value || '')
    .trim()
    .toLowerCase();
  if (ANIMATION_PRESETS.includes(s)) return s;
  return ANIMATION_PRESETS.includes(fallback) ? fallback : 'stagger-fade';
}

export function normalizeDurationMs(value, fallback = DEFAULT_TRANSITION_MS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.max(0, Math.min(2000, Math.round(n)));
}

export function presentDurationMs(transition, reducedMotion) {
  if (reducedMotion) return 0;
  const type = normalizeTransitionType(transition?.type);
  if (type === 'none') return 0;
  return normalizeDurationMs(transition?.durationMs, DEFAULT_PRESENT_MS);
}
