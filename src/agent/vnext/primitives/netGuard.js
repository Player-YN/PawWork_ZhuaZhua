/**
 * Host-enforced network guard for model-directed fetches (acquire, item pixels).
 *
 * The extension holds <all_urls>; without this gate the model could direct
 * fetches at localhost, RFC1918 ranges, link-local or cloud metadata endpoints.
 * Runtime Policy lives in the host, not the prompt — deny here.
 *
 * Note: literal-address and hostname checks only. DNS rebinding cannot be fully
 * excluded without resolving hostnames, which fetch() does not expose.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback']);
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/**
 * @param {string} rawUrl
 * @returns {{ ok: true, url: URL } | { ok: false, error: string, code: 'NET_DENIED' }}
 */
export function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    return deny('invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return deny(`protocol ${parsed.protocol} not allowed (http/https only)`);
  }
  const host = String(parsed.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return deny('empty host');
  if (BLOCKED_HOSTNAMES.has(host)) return deny(`host ${host} is not public`);
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) return deny(`host ${host} is not public`);
  }
  const v4 = parseIpv4(host);
  if (v4 && isPrivateIpv4(v4)) return deny(`address ${host} is not public`);
  if (host.includes(':') || (host.startsWith('[') && host.endsWith(']'))) {
    const v6 = host.replace(/^\[|\]$/g, '');
    if (isPrivateIpv6(v6)) return deny(`address ${v6} is not public`);
    const inner = mappedIpv4(v6);
    if (inner && isPrivateIpv4(inner)) return deny(`address ${v6} is not public`);
  }
  return { ok: true, url: parsed };
}

function deny(reason) {
  return { ok: false, error: `NET_DENIED: ${reason}`, code: 'NET_DENIED' };
}

/** @returns {number[]|null} */
function parseIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

function isPrivateIpv4([a, b]) {
  if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
  if (a === 192 && b === 168) return true; // private 192.168/16
  if (a === 192 && b === 0) return true; // 192.0.0/24 special + 192.0.2/24 doc
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIpv6(host) {
  const h = host.toLowerCase();
  if (h === '::' || h === '::1') return true; // unspecified, loopback
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true; // link-local fe80::/10
  }
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA fc00::/7
  return false;
}

/**
 * ::ffff:a.b.c.d and its URL-normalized hex form (::ffff:c0a8:1) → IPv4 parts.
 * @returns {number[]|null}
 */
function mappedIpv4(v6) {
  const m = /^::ffff:(.+)$/i.exec(v6);
  if (!m) return null;
  const rest = m[1];
  const dotted = parseIpv4(rest);
  if (dotted) return dotted;
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(rest);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
}
