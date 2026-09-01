/**
 * GC: scratch (via settle), unreachable WebItems, disposable cache.
 * NEVER auto-delete durable artifacts.
 */

import { isWebItemLeased } from './execution.js';

/**
 * WebItems not in any group and not leased → reclaim.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @returns {{ reclaimed: string[] }}
 */
export function gcUnreachableWebItems(store) {
  const referenced = new Set();
  for (const gid of store.keys('groupMembers')) {
    for (const id of store.get('groupMembers', gid) || []) referenced.add(String(id));
  }
  const reclaimed = [];
  for (const id of store.keys('items')) {
    if (referenced.has(id)) continue;
    if (isWebItemLeased(store, id)) continue;
    store.delete('items', id);
    store.deleteBlob(`blob:${id}`);
    reclaimed.push(id);
  }
  return { reclaimed };
}

/**
 * Remove orphan scratch under /tmp after crash/restart.
 * Executions/leases are ephemeral — any /tmp node without a running execution is orphan.
 * Artifacts under /session/... are never touched.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @returns {{ removedPaths: string[], removedBlobs: number }}
 */
export function sweepOrphanScratch(store) {
  const liveExecutions = new Set();
  for (const eid of store.keys('executions')) {
    const ex = store.get('executions', eid);
    if (ex && ex.status === 'running') liveExecutions.add(String(eid));
  }

  /** @type {string[]} */
  const removedPaths = [];
  let removedBlobs = 0;

  for (const hp of [...store.keys('fsNodes')]) {
    if (!String(hp).startsWith('/tmp/')) continue;
    // /tmp/{sessionId}/{executionId}/...
    const parts = String(hp).split('/').filter(Boolean);
    const executionId = parts[2] || '';
    if (executionId && liveExecutions.has(executionId)) continue;
    store.delete('fsNodes', hp);
    if (store.deleteBlob(`fs:${hp}`)) removedBlobs += 1;
    removedPaths.push(hp);
  }

  for (const bk of [...store.blobs.keys()]) {
    if (!String(bk).startsWith('fs:/tmp/')) continue;
    const hp = String(bk).slice('fs:'.length);
    const parts = hp.split('/').filter(Boolean);
    const executionId = parts[2] || '';
    if (executionId && liveExecutions.has(executionId)) continue;
    if (store.deleteBlob(bk)) removedBlobs += 1;
  }

  return { removedPaths, removedBlobs };
}

/**
 * Storage pressure: reclaim disposable only.
 * Order: disposable meta cache → unreachable WebItems → never artifacts.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {{ level?: 'soft'|'critical' }} [opts]
 */
export function applyStoragePressure(store, opts = {}) {
  const level = opts.level || 'soft';
  /** @type {string[]} */
  const actions = [];

  // Disposable cache keys
  for (const k of [...store.keys('meta')]) {
    if (String(k).startsWith('cache:') || String(k).startsWith('disposable:')) {
      store.delete('meta', k);
      actions.push(`meta:${k}`);
    }
  }

  const wi = gcUnreachableWebItems(store);
  actions.push(...wi.reclaimed.map((id) => `webItem:${id}`));

  // Critical: also purge settled execution records (not artifacts)
  if (level === 'critical') {
    for (const eid of [...store.keys('executions')]) {
      const ex = store.get('executions', eid);
      if (ex && ex.status !== 'running') {
        store.delete('executions', eid);
        actions.push(`execution:${eid}`);
      }
    }
  }

  // Prove artifacts untouched
  const artifactIds = store.keys('artifacts');
  return {
    actions,
    artifactsPreserved: artifactIds.length,
    artifactIds
  };
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 */
export function deleteSessionCascade(store, sessionId) {
  const sid = String(sessionId);
  // Artifacts
  for (const aid of [...store.keys('artifacts')]) {
    const a = store.get('artifacts', aid);
    if (a?.sessionId === sid) store.delete('artifacts', aid);
  }
  // FS nodes + blobs for session
  for (const hp of [...store.keys('fsNodes')]) {
    if (String(hp).includes(`/${sid}/`) || String(hp).startsWith(`/session/${sid}/`)) {
      store.delete('fsNodes', hp);
      store.deleteBlob(`fs:${hp}`);
    }
  }
  for (const bk of [...store.blobs.keys()]) {
    if (String(bk).includes(`/${sid}/`)) store.deleteBlob(bk);
  }
  // Ephemeral executions for this session
  for (const eid of [...store.keys('executions')]) {
    const ex = store.get('executions', eid);
    if (ex?.sessionId === sid) {
      store.delete('executions', eid);
      store.leases.delete(eid);
    }
  }
  store.delete('sessionBindings', sid);
  store.delete('sessions', sid);
  store.delete('meta', `artifactIndex:${sid}`);
  // Groups NOT deleted
  return { deletedSessionId: sid, messagesGone: true, artifactsGone: true };
}
