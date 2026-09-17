/**
 * Resettable run deadline. Host extends this when sys.waitFor is in flight
 * so a default 15s run is not killed by a 30s wait. Do not raise every run
 * default to 120s.
 */

export const RUN_TIMEOUT_DEFAULT_MS = 15_000;
export const RUN_TIMEOUT_MAX_MS = 120_000;
export const WAIT_FOR_DEFAULT_MS = 30_000;
export const WAIT_FOR_MAX_MS = 120_000;

export function clampRunTimeout(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return RUN_TIMEOUT_DEFAULT_MS;
  return Math.max(1, Math.min(Number(ms), RUN_TIMEOUT_MAX_MS));
}

export function clampWaitTimeout(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return WAIT_FOR_DEFAULT_MS;
  return Math.max(1000, Math.min(n, WAIT_FOR_MAX_MS));
}

/**
 * @param {number} [initialMs]
 */
export function createRunDeadline(initialMs) {
  let expiresAt = Date.now() + clampRunTimeout(initialMs);
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) {
      try {
        fn(expiresAt);
      } catch {
        /* listener must not break the clock */
      }
    }
  }

  return {
    get expiresAt() {
      return expiresAt;
    },
    remaining() {
      return expiresAt - Date.now();
    },
    /**
     * Ensure the clock lasts at least `msFromNow` more milliseconds.
     * @param {number} msFromNow
     */
    extendToCover(msFromNow) {
      const next = Date.now() + Math.max(0, Number(msFromNow) || 0);
      if (next > expiresAt) {
        expiresAt = next;
        notify();
      }
      return expiresAt;
    },
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

/** Slack so a waitFor that returns in the last millisecond is not raced out. */
export const WAIT_FOR_DEADLINE_SLACK_MS = 2000;

export function extendDeadlineForWaitFor(deadline, timeoutMs) {
  if (!deadline || typeof deadline.extendToCover !== 'function') return 0;
  const cover = clampWaitTimeout(timeoutMs) + WAIT_FOR_DEADLINE_SLACK_MS;
  deadline.extendToCover(cover);
  return cover;
}
