/**
 * BYOK / acquire vendor endpoints: HTTPS on the wire, except loopback http
 * for local models (Ollama, etc.). Remote http / any ws would send the key
 * in cleartext.
 */

const LOOPBACK_V6 = new Set(['::1', '0:0:0:0:0:0:0:1']);

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isLoopbackHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!h) return false;
  if (h === 'localhost') return true;
  if (LOOPBACK_V6.has(h)) return true;
  const m = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  return !!(m && m.slice(1).every((n) => Number(n) <= 255));
}

/**
 * @param {string} raw
 * @returns {URL}
 */
function parseEndpointUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    const err = new Error('endpoint URL required');
    err.code = 'INSECURE_ENDPOINT';
    throw err;
  }
  try {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      return new URL(`https://${s}`);
    }
    return new URL(s);
  } catch {
    const err = new Error('endpoint URL invalid');
    err.code = 'INSECURE_ENDPOINT';
    throw err;
  }
}

/**
 * Reject remote http / any ws (and non-http(s)) so API keys are not sent
 * cleartext. https always ok; http only for loopback.
 *
 * @param {string} raw
 * @param {string} [label]
 * @returns {URL}
 */
export function assertSafeByokEndpointUrl(raw, label = 'endpoint') {
  const parsed = parseEndpointUrl(raw);
  if (parsed.username || parsed.password) {
    const err = new Error(`${label} URL must not include credentials`);
    err.code = 'INSECURE_ENDPOINT';
    throw err;
  }
  if (parsed.protocol === 'https:') return parsed;
  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) return parsed;
  const err = new Error(
    parsed.protocol === 'http:' || parsed.protocol === 'ws:'
      ? `${label} must use HTTPS (http only allowed for localhost / 127.0.0.1 / ::1)`
      : `${label} protocol ${parsed.protocol} is not allowed`
  );
  err.code = 'INSECURE_ENDPOINT';
  throw err;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isSafeByokEndpointUrl(raw) {
  try {
    assertSafeByokEndpointUrl(raw);
    return true;
  } catch {
    return false;
  }
}

const SECRET_LIKE_RE =
  /(?:sk-[a-zA-Z0-9_-]{8,}|gsk_[A-Za-z0-9._-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|tvly-[A-Za-z0-9_-]{8,}|fc-[A-Za-z0-9_-]{8,})/gi;

/**
 * Strip known / heuristic secrets from errors, probe text, and lastProbe.
 * @param {unknown} text
 * @param {string[]} [secrets]
 * @returns {string}
 */
export function redactSecretsInText(text, secrets = []) {
  let s = String(text ?? '');
  for (const secret of secrets) {
    const key = String(secret || '').trim();
    if (key.length >= 4) s = s.split(key).join('[REDACTED]');
  }
  return s.replace(SECRET_LIKE_RE, '[REDACTED]');
}
