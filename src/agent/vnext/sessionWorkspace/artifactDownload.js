/** Complete artifact bytes vs bounded preview. Truncation must refuse download. */

export const ARTIFACT_TRUNCATED = 'ARTIFACT_TRUNCATED';
export const ARTIFACT_CHUNK_SIZE = 512 * 1024;
/** Inline RPC payload ceiling. Larger files assemble via `readArtifactChunk`. */
export const DOWNLOAD_INLINE_MAX = 2 * 1024 * 1024;

export function decodeArtifactBase64(b64) {
  const s = String(b64 || '');
  if (!s) return new Uint8Array(0);
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function assertCompleteDownload(res, bytes) {
  const raw = bytes instanceof Uint8Array ? bytes : decodeArtifactBase64(res?.base64);
  if (!res || res.truncated === true || res.preview === true || res.complete === false) {
    throw Object.assign(new Error('Download refused: artifact bytes were truncated.'), {
      code: ARTIFACT_TRUNCATED
    });
  }
  const total = Number(res.byteLength);
  if (Number.isFinite(total) && raw.byteLength !== total) {
    throw Object.assign(new Error('Download refused: decoded length does not match byteLength.'), {
      code: ARTIFACT_TRUNCATED
    });
  }
  return raw;
}

export async function fetchCompleteArtifact(rpc, { sessionId, artifactId } = {}) {
  if (typeof rpc !== 'function') throw new Error('fetchCompleteArtifact: rpc required');
  const rec = await rpc('downloadArtifact', { sessionId, artifactId });
  if (rec?.useChunks === true) {
    const total = Number(rec.byteLength) || 0;
    const out = new Uint8Array(total);
    let offset = 0;
    const chunkSize = Number(rec.chunkSize) || ARTIFACT_CHUNK_SIZE;
    while (offset < total) {
      const chunk = await rpc('readArtifactChunk', {
        sessionId,
        artifactId,
        offset,
        length: Math.min(chunkSize, total - offset)
      });
      if (chunk?.truncated === true) {
        throw Object.assign(new Error('Download refused: a chunk was truncated.'), {
          code: ARTIFACT_TRUNCATED
        });
      }
      const part = decodeArtifactBase64(chunk?.base64);
      if (!part.byteLength) {
        throw Object.assign(new Error('Download refused: empty chunk.'), { code: ARTIFACT_TRUNCATED });
      }
      out.set(part, offset);
      offset += part.byteLength;
    }
    if (offset !== total) {
      throw Object.assign(new Error('Download refused: chunk assembly length mismatch.'), {
        code: ARTIFACT_TRUNCATED
      });
    }
    return { ...rec, bytes: out, base64: undefined, truncated: false, complete: true, preview: false };
  }
  const bytes = assertCompleteDownload(rec, decodeArtifactBase64(rec?.base64));
  return { ...rec, bytes, truncated: false, complete: true, preview: false };
}
