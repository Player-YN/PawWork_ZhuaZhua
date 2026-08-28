/**
 * Session lifecycle API for Session Workspace Runtime.
 */

import { createSessionId } from './ids.js';
import { deleteSessionCascade } from './gc.js';

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {{ sessionId?: string, title?: string }} [opts]
 */
export function createSession(store, opts = {}) {
  const sessionId = opts.sessionId || createSessionId();
  if (store.has('sessions', sessionId)) throw new Error(`session exists: ${sessionId}`);
  const session = {
    sessionId,
    title: opts.title || 'Task',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  store.put('sessions', sessionId, session);
  store.put('sessionBindings', sessionId, []);
  return session;
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 */
export function getSession(store, sessionId) {
  return store.get('sessions', sessionId);
}

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 */
export function deleteSession(store, sessionId) {
  return deleteSessionCascade(store, sessionId);
}

/**
 * Ensure session exists (idempotent).
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 */
export function ensureSession(store, sessionId) {
  if (store.has('sessions', sessionId)) return store.get('sessions', sessionId);
  return createSession(store, { sessionId });
}
