/**
 * AI SDK / fetch failures are often plain objects, not Error.
 * String(err) then becomes "[object Object]".
 */
export function formatRpcError(err) {
  if (err == null) return 'unknown';
  if (typeof err === 'string') {
    return err === '[object Object]' ? 'unknown error' : err;
  }
  if (err instanceof Error && err.message && err.message !== '[object Object]') {
    return err.message;
  }
  if (typeof err === 'object') {
    const nested = err.message || err.error || err.cause;
    if (nested && nested !== err) {
      const inner = formatRpcError(nested);
      if (inner && inner !== 'unknown' && inner !== 'unknown error') return inner;
    }
    const status = err.statusCode || err.status;
    if (status) return `HTTP ${status}`;
    try {
      const s = JSON.stringify(err);
      if (s && s !== '{}' && s !== 'null') return s.slice(0, 400);
    } catch {
      /* ignore */
    }
  }
  const s = String(err);
  return s === '[object Object]' ? 'unknown error' : s;
}
