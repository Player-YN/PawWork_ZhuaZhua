/**
 * Parse offscreen abort-registry snapshots. Live run = `_activeBySession`,
 * not leftover store execution rows (those linger after settle).
 *
 * @param {object|null|undefined} payload getSession / getWorkspaceState / getActiveExecution
 * @returns {{ sessionId: string, executionId: string, status: 'running' }|null|undefined}
 * `undefined` = payload omitted the field (old offscreen); keep UI flags.
 */
export function readActiveExecution(payload) {
  if (!payload || typeof payload !== 'object' || !('activeExecution' in payload)) return undefined;
  const live = payload.activeExecution;
  if (!live || typeof live !== 'object') return null;
  const status = String(live.status || 'running').trim() || 'running';
  if (status !== 'running') return null;
  const sessionId = String(live.sessionId || '').trim();
  const executionId = live.executionId != null && String(live.executionId).trim()
    ? String(live.executionId).trim()
    : '';
  if (!sessionId && !executionId) return null;
  return { sessionId, executionId, status: 'running' };
}

export function isExecutionLive(live) {
  return !!(live && live.status === 'running');
}
