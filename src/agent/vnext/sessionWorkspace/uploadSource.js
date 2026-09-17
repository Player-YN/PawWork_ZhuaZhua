/**
 * Resolve sys.upload / action op=upload source bytes on the offscreen host.
 * Guest only sends path | itemId | artifactId. Host reads FS / bound items.
 * Writing a copy into /scratch does not mutate SelectionGroup / WebItem.
 */

import { assertArtifactOwned, assertItemReadable } from './auth.js';
import { resolveBoundItemRef } from './itemLabel.js';
import { ensureItemPixels } from './itemPixels.js';
import { assertUploadGuestPath, guessUploadMime, sanitizeUploadFilename, UPLOAD_BYTES_MAX } from '../host/uploadChannel.js';
import { sha256Bytes } from '../host/payloadHash.js';

function exactlyOneSource(path, itemId, artifactId) {
  const n = [path, itemId, artifactId].filter((v) => v != null && String(v).trim()).length;
  return n === 1;
}

function fail(code, error) {
  return { ok: false, code, error };
}

function fileNameFromPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts[parts.length - 1] || 'upload.bin';
}

/**
 * @param {{
 *   store: import('./store.js').SessionWorkspaceStore,
 *   fs: ReturnType<import('./fs.js').createSessionGuestFs>,
 *   sessionId: string,
 *   path?: string,
 *   itemId?: string,
 *   artifactId?: string,
 *   filename?: string,
 *   mimeType?: string,
 *   fetchImpl?: typeof fetch,
 *   signal?: AbortSignal
 * }} input
 */
export async function resolveUploadSource(input = {}) {
  const sessionId = String(input.sessionId || '');
  const rawPath = input.path != null ? String(input.path) : '';
  const itemId = input.itemId != null ? String(input.itemId).trim() : '';
  const artifactId = input.artifactId != null ? String(input.artifactId).trim() : '';
  if (!exactlyOneSource(rawPath, itemId, artifactId)) {
    return fail('BAD_INPUT', 'upload requires exactly one of path, itemId, artifactId');
  }
  if (!input.fs || typeof input.fs.readFileBytes !== 'function') {
    return fail('SYS_DENIED', 'upload host filesystem is unavailable');
  }

  if (artifactId) {
    const gate = assertArtifactOwned(input.store, sessionId, artifactId);
    if (!gate.ok) return fail(gate.code || 'AUTH_DENIED', gate.error || 'artifact not owned');
    const rec = gate.record || input.store.get('artifacts', artifactId);
    const primary = String(rec?.primaryPath || '');
    const pathGate = assertUploadGuestPath(primary);
    if (!pathGate.ok) return pathGate;
    return readPathBytes(input.fs, pathGate.path, input.filename, input.mimeType, { artifactId });
  }

  if (itemId) {
    return materializeBoundItem(input, itemId);
  }

  const pathGate = assertUploadGuestPath(rawPath);
  if (!pathGate.ok) return pathGate;
  return readPathBytes(input.fs, pathGate.path, input.filename, input.mimeType, {});
}

function readPathBytes(fs, path, filename, mimeType, extra) {
  let bytes;
  try {
    bytes = fs.readFileBytes(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/FS_DENIED/i.test(message)) return fail('FS_DENIED', message);
    if (/scratch requires/i.test(message)) return fail('BAD_INPUT', message);
    if (/ENOENT/i.test(message)) return fail('ENOENT', message);
    return fail('SYS_FAILED', message);
  }
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || []);
  if (bytes.byteLength > UPLOAD_BYTES_MAX) {
    return fail('TOO_LARGE', `upload exceeds ${UPLOAD_BYTES_MAX} bytes`);
  }
  if (!bytes.byteLength) return fail('BAD_INPUT', 'upload file is empty');
  const name = sanitizeUploadFilename(filename || fileNameFromPath(path));
  const mime = String(mimeType || '').trim() || guessUploadMime(name);
  return { ok: true, path, bytes, filename: name, mimeType: mime, ...extra };
}

async function materializeBoundItem(input, itemRef) {
  const store = input.store;
  const sessionId = String(input.sessionId || '');
  if (!store) return fail('BAD_INPUT', 'upload itemId requires a session store');
  const resolved = resolveBoundItemRef(store, sessionId, itemRef) || itemRef;
  const gate = assertItemReadable(store, sessionId, resolved);
  if (!gate.ok) return fail(gate.code || 'AUTH_DENIED', gate.error || 'item not readable');
  const item = store.get('items', resolved);
  const pix = await ensureItemPixels(store, item, {
    fetchImpl: input.fetchImpl,
    signal: input.signal
  });
  if (!pix?.ok || !pix.bytes?.byteLength) {
    return fail(pix?.code || 'ENOENT', pix?.error || 'item bytes unavailable');
  }
  const bytes = pix.bytes instanceof Uint8Array ? pix.bytes : new Uint8Array(pix.bytes);
  if (bytes.byteLength > UPLOAD_BYTES_MAX) {
    return fail('TOO_LARGE', `upload exceeds ${UPLOAD_BYTES_MAX} bytes`);
  }
  const name = sanitizeUploadFilename(
    input.filename || item?.capture?.filename || item?.name || `item-${resolved}.png`
  );
  const mime = String(input.mimeType || pix.mimeType || '').trim() || guessUploadMime(name);
  const dest = `/scratch/upload/${resolved}-${name}`;
  try {
    input.fs.mkdirp('/scratch/upload');
  } catch {
    /* mkdirp may deny without execution; writeFile will surface the real error */
  }
  try {
    input.fs.writeFile(dest, bytes, { mimeType: mime });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/FS_DENIED|scratch requires/i.test(message)) return fail('BAD_INPUT', message);
    return fail('SYS_FAILED', message);
  }
  return { ok: true, path: dest, bytes, filename: name, mimeType: mime, itemId: resolved };
}

export async function hashUploadBytes(bytes) {
  return sha256Bytes(bytes);
}
