/** Browser-owned document identity. URL equality alone cannot identify a document. */
export function targetError(code, message) { return Object.assign(new Error(message), { code }); }

export async function readDocumentTarget(chromeApi, tabId, frameId = 0, expected = {}) {
  const id = Number(tabId);
  const frame = Number(frameId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(frame) || frame < 0) {
    throw targetError('NEED_PAGE', 'An explicit tabId and valid frameId are required.');
  }
  if (typeof chromeApi.webNavigation?.getFrame !== 'function') {
    throw targetError('DOCUMENT_UNAVAILABLE', 'Cannot identify the current document.');
  }
  const live = await chromeApi.webNavigation.getFrame({ tabId: id, frameId: frame });
  if (!live?.documentId || (live.documentLifecycle && live.documentLifecycle !== 'active')) {
    throw targetError('DOCUMENT_UNAVAILABLE', 'The target document is unavailable or not active.');
  }
  if ((expected.documentId && live.documentId !== expected.documentId) ||
      (expected.url && live.url !== expected.url)) {
    throw targetError('TARGET_CHANGED', 'The document or route changed. Observe it again before acting.');
  }
  return { tabId: id, frameId: frame, documentId: live.documentId, url: String(live.url || '') };
}

/** Revisions are opaque and never repeat after SW restart (unlike t1, t2, ...). */
export function createPageSnapshotRegistry({ token = () => crypto.randomUUID() } = {}) {
  const snapshots = new Map();
  return {
    capture(tabId, frames) {
      const snapshot = { rev: token(), frames: frames.map(f => ({
        frameId: f.frameId, documentId: f.documentId, url: f.url || ''
      })) };
      snapshots.set(Number(tabId), snapshot);
      return structuredClone(snapshot);
    },
    get(tabId) { return structuredClone(snapshots.get(Number(tabId)) || null); },
    invalidate(tabId) { snapshots.delete(Number(tabId)); },
    require(tabId, rev) {
      const snapshot = snapshots.get(Number(tabId));
      if (!snapshot || !rev || snapshot.rev !== String(rev)) {
        throw targetError('STALE_REF', 'Snapshot first; use the latest rev for every page mutation.');
      }
      return structuredClone(snapshot);
    }
  };
}
