/**
 * Artifact format truth — magic/container checks by name + declared MIME.
 * Plain text named .xlsx/.png/.pdf must fail.
 */

/**
 * @param {string} nameOrPath
 * @param {Uint8Array|string|null|undefined} data
 * @param {string} [mimeType]
 * @returns {{ valid: boolean, error: string|null, mimeType: string }}
 */
export function validateArtifactBytes(nameOrPath, data, mimeType = '') {
  const name = String(nameOrPath || '');
  const lower = name.toLowerCase();
  const declared = String(mimeType || '').toLowerCase();
  const bytes = toBytes(data);

  if (!bytes || bytes.byteLength === 0) {
    return { valid: false, error: 'empty artifact', mimeType: declared || 'application/octet-stream' };
  }

  const wantsText =
    declared.startsWith('text/') ||
    declared === 'application/json' ||
    declared === 'application/javascript' ||
    /\.(html?|json|md|txt|csv|js|mjs|css|svg|ts|tsx)$/i.test(lower);

  if (lower.endsWith('.json') || declared === 'application/json') {
    try {
      JSON.parse(new TextDecoder().decode(bytes));
      return { valid: true, error: null, mimeType: 'application/json' };
    } catch (e) {
      return {
        valid: false,
        error: 'invalid json: ' + (e instanceof Error ? e.message : String(e)),
        mimeType: 'application/json'
      };
    }
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm') || declared === 'text/html') {
    const text = new TextDecoder().decode(bytes);
    if (!/<[a-z!]/i.test(text)) {
      return { valid: false, error: 'html missing tags', mimeType: 'text/html' };
    }
    return { valid: true, error: null, mimeType: 'text/html' };
  }

  if (lower.endsWith('.svg') || declared.includes('svg+xml') || declared === 'image/svg') {
    const text = new TextDecoder().decode(bytes);
    if (!/<svg\b/i.test(text)) {
      return { valid: false, error: 'svg missing <svg>', mimeType: 'image/svg+xml' };
    }
    return { valid: true, error: null, mimeType: 'image/svg+xml' };
  }

  if (lower.endsWith('.png') || declared === 'image/png') {
    return sig(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'invalid png signature', 'image/png');
  }
  if (/\.jpe?g$/i.test(lower) || declared === 'image/jpeg') {
    const ok =
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9;
    return ok
      ? { valid: true, error: null, mimeType: 'image/jpeg' }
      : { valid: false, error: 'invalid jpeg signature', mimeType: 'image/jpeg' };
  }
  if (lower.endsWith('.gif') || declared === 'image/gif') {
    const h = new TextDecoder().decode(bytes.slice(0, 6));
    return /^GIF8[79]a$/.test(h)
      ? { valid: true, error: null, mimeType: 'image/gif' }
      : { valid: false, error: 'invalid gif signature', mimeType: 'image/gif' };
  }
  if (lower.endsWith('.webp') || declared === 'image/webp') {
    const a = new TextDecoder().decode(bytes.slice(0, 4));
    const b = new TextDecoder().decode(bytes.slice(8, 12));
    return a === 'RIFF' && b === 'WEBP'
      ? { valid: true, error: null, mimeType: 'image/webp' }
      : { valid: false, error: 'invalid webp signature', mimeType: 'image/webp' };
  }
  if (lower.endsWith('.pdf') || declared === 'application/pdf') {
    const h = new TextDecoder().decode(bytes.slice(0, 8));
    return h.startsWith('%PDF-')
      ? { valid: true, error: null, mimeType: 'application/pdf' }
      : { valid: false, error: 'invalid pdf signature', mimeType: 'application/pdf' };
  }
  if (lower.endsWith('.zip')) {
    return isZip(bytes)
      ? { valid: true, error: null, mimeType: 'application/zip' }
      : { valid: false, error: 'invalid zip signature', mimeType: 'application/zip' };
  }
  if (/\.(xlsx|pptx|docx)$/i.test(lower)) {
    if (!isZip(bytes)) {
      return { valid: false, error: 'office file is not a zip container', mimeType: officeMime(lower) };
    }
    const names = zipEntryNames(bytes);
    const required = lower.endsWith('.xlsx')
      ? ['[Content_Types].xml', 'xl/workbook.xml']
      : lower.endsWith('.pptx')
        ? ['[Content_Types].xml', 'ppt/presentation.xml']
        : ['[Content_Types].xml', 'word/document.xml'];
    const missing = required.filter((n) => !names.has(n));
    return missing.length === 0
      ? { valid: true, error: null, mimeType: officeMime(lower) }
      : {
          valid: false,
          error: `invalid office package; missing ${missing.join(', ')}`,
          mimeType: officeMime(lower)
        };
  }

  if (wantsText) {
    const text = new TextDecoder().decode(bytes);
    if (!String(text).trim()) {
      return { valid: false, error: 'empty text content', mimeType: declared || 'text/plain' };
    }
    return { valid: true, error: null, mimeType: declared || guessTextMime(lower) };
  }

  // Unknown extension: accept non-empty bytes as opaque binary
  return {
    valid: true,
    error: null,
    mimeType: declared || 'application/octet-stream'
  };
}

/**
 * Infer MIME from filename for text-like defaults.
 * @param {string} lower
 */
export function guessMimeFromName(lower) {
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (/\.(js|mjs|ts)$/.test(lower)) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}

function guessTextMime(lower) {
  return guessMimeFromName(lower);
}

function officeMime(lower) {
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function toBytes(raw) {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (typeof raw === 'string') return new TextEncoder().encode(raw);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return null;
}

function sig(bytes, signature, error, mimeType) {
  if (bytes.byteLength < signature.length) return { valid: false, error, mimeType };
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return { valid: false, error, mimeType };
  }
  return { valid: true, error: null, mimeType };
}

function isZip(bytes) {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function zipEntryNames(bytes) {
  const names = new Set();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i + 30 <= bytes.byteLength; i++) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    if (i + 30 + nameLen > bytes.byteLength) break;
    names.add(new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen)));
    const compressedSize = view.getUint32(i + 18, true);
    const next = i + 30 + nameLen + extraLen + compressedSize;
    if (next > i) i = next - 1;
  }
  for (let i = 0; i + 46 <= bytes.byteLength; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const nameLen = view.getUint16(i + 28, true);
    const extraLen = view.getUint16(i + 30, true);
    const commentLen = view.getUint16(i + 32, true);
    if (i + 46 + nameLen > bytes.byteLength) break;
    names.add(new TextDecoder().decode(bytes.slice(i + 46, i + 46 + nameLen)));
    i += 45 + nameLen + extraLen + commentLen;
  }
  return names;
}
