/**
 * User-abort sentinel. AbortController.abort(reason) must receive an Error
 * whose name is AbortError — a bare string ('user_stop') is not isAbortError
 * in the AI SDK, so teed streams / fetch reject it as an unhandled string.
 */

export const USER_STOP = 'user_stop';

export function createUserStopError() {
  const err = new Error(USER_STOP);
  err.name = 'AbortError';
  err.code = USER_STOP;
  return err;
}

export function isUserStop(err) {
  if (err == null) return false;
  if (err === USER_STOP) return true;
  if (typeof err === 'string') return err === USER_STOP;
  if (typeof err !== 'object') return false;
  if (err.code === USER_STOP) return true;
  if (err.reason === USER_STOP) return true;
  return err.name === 'AbortError' && String(err.message || '') === USER_STOP;
}

/**
 * Abort / user-stop as a terminal outcome (not a product error).
 * @param {unknown} err
 * @param {AbortSignal} [signal]
 */
export function isAbortLike(err, signal) {
  if (signal?.aborted) return true;
  if (isUserStop(err)) return true;
  if (err && (err.name === 'AbortError' || err.name === 'ResponseAborted')) return true;
  if (err && /abort/i.test(String(err.message || err))) return true;
  return false;
}

/** Normalize any abort rejection (string, DOMException, Error) to AbortError. */
export function toAbortError(err) {
  if (err instanceof Error && err.name === 'AbortError') {
    if (!err.code && isUserStop(err)) err.code = USER_STOP;
    return err;
  }
  const e = new Error(
    err instanceof Error && err.message ? err.message : isUserStop(err) ? USER_STOP : String(err ?? 'aborted')
  );
  e.name = 'AbortError';
  e.code = isUserStop(err) ? USER_STOP : err?.code || USER_STOP;
  if (err != null && err !== e) e.cause = err;
  return e;
}
