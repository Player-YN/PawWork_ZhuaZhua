/**
 * Host-enforced object authorization for Session Workspace.
 * Prompt text is never sufficient — every inspect/artifact path checks here.
 */

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @returns {string[]}
 */
export function getBoundGroupIds(store, sessionId) {
  return /** @type {string[]} */ (store.get('sessionBindings', sessionId) || []).map(String);
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} groupId
 */
export function isGroupBoundToSession(store, sessionId, groupId) {
  if (!sessionId || !groupId) return false;
  return getBoundGroupIds(store, sessionId).includes(String(groupId));
}

/**
 * Item is reachable if it belongs to any group bound to the session.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} webItemId
 */
export function isItemBoundToSession(store, sessionId, webItemId) {
  const itemId = String(webItemId || '');
  if (!itemId) return false;
  for (const gid of getBoundGroupIds(store, sessionId)) {
    const members = /** @type {string[]} */ (store.get('groupMembers', gid) || []);
    if (members.map(String).includes(itemId)) return true;
  }
  return false;
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} groupId
 * @returns {{ ok: true } | { ok: false, error: string, code: string }}
 */
export function assertGroupReadable(store, sessionId, groupId) {
  if (!store.has('groups', groupId)) {
    return { ok: false, error: 'group not found', code: 'NOT_FOUND' };
  }
  if (!isGroupBoundToSession(store, sessionId, groupId)) {
    return { ok: false, error: 'group not bound to session', code: 'AUTH_DENIED' };
  }
  return { ok: true };
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} webItemId
 */
export function assertItemReadable(store, sessionId, webItemId) {
  if (!store.has('items', webItemId)) {
    return { ok: false, error: 'item not found', code: 'NOT_FOUND' };
  }
  if (!isItemBoundToSession(store, sessionId, webItemId)) {
    return { ok: false, error: 'item not bound to session', code: 'AUTH_DENIED' };
  }
  return { ok: true };
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} artifactId
 */
export function assertArtifactOwned(store, sessionId, artifactId) {
  const rec = store.get('artifacts', artifactId);
  if (!rec) {
    return { ok: false, error: 'artifact not found', code: 'NOT_FOUND', record: null };
  }
  if (String(rec.sessionId) !== String(sessionId)) {
    return {
      ok: false,
      error: 'artifact not owned by session',
      code: 'AUTH_DENIED',
      record: null
    };
  }
  return { ok: true, record: rec };
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} artifactId
 */
export function getOwnedArtifact(store, sessionId, artifactId) {
  const gate = assertArtifactOwned(store, sessionId, artifactId);
  if (!gate.ok) return null;
  return gate.record;
}
