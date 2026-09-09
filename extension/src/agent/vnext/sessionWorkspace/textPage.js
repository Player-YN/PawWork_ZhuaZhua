/**
 * Deterministic text paging for inspect file reads.
 * Unit is Unicode code points (not UTF-16 code units, not UTF-8 bytes),
 * so CJK / emoji never split and successive offsets never repeat the first chunk.
 */

export const FILE_PAGE_DEFAULT_CHARS = 12000;
export const FILE_PAGE_MAX_CHARS = 50000;
export const FILE_PAGE_MIN_CHARS = 500;

/**
 * @param {string} text
 * @param {number} [offset]
 * @param {number} [maxChars]
 * @returns {{
 *   content: string,
 *   offset: number,
 *   nextOffset: number,
 *   totalChars: number,
 *   eof: boolean,
 *   truncated: boolean,
 *   unit: 'codePoint'
 * }}
 */
export function pageTextByCodePoint(text, offset = 0, maxChars = FILE_PAGE_DEFAULT_CHARS) {
  const units = Array.from(String(text ?? ''));
  const totalChars = units.length;
  const start = clampInt(offset, 0, totalChars);
  const cap = clampInt(maxChars, FILE_PAGE_MIN_CHARS, FILE_PAGE_MAX_CHARS);
  const end = Math.min(totalChars, start + cap);
  return {
    content: units.slice(start, end).join(''),
    offset: start,
    nextOffset: end,
    totalChars,
    eof: end >= totalChars,
    truncated: end < totalChars,
    unit: 'codePoint'
  };
}

/**
 * Binary / non-text page. Unit is bytes.
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 * @param {number} [maxBytes]
 */
export function pageBytes(bytes, offset = 0, maxBytes = 4096) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array();
  const total = buf.byteLength;
  const start = clampInt(offset, 0, total);
  const cap = clampInt(maxBytes, 1, FILE_PAGE_MAX_CHARS);
  const end = Math.min(total, start + cap);
  return {
    bytes: Array.from(buf.subarray(start, end)),
    offset: start,
    nextOffset: end,
    totalChars: total,
    totalBytes: total,
    eof: end >= total,
    truncated: end < total,
    unit: 'byte'
  };
}

function clampInt(n, lo, hi) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
