/**
 * Live-page tab leases — SW memory, same lifetime as pageActionRevByTab.
 * Cross-session mutex on a tabId. Not a journal: process death drops the map.
 */

/** @type {Map<number, { sessionId: string, executionId: string, acquiredAt: number, kinds: string[] }>} */
const tabLeases = new Map();

export function resetTabLeases() {
  tabLeases.clear();
}

export function explicitPageActionTabId(request = {}) {
  const tabId = Number(request?.tabId ?? request?.defaultTabId);
  return Number.isFinite(tabId) && tabId > 0 ? tabId : 0;
}

export function peekTabLease(tabId) {
  const id = Number(tabId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return tabLeases.get(id) || null;
}

export function foreignTabLease(lease, sessionId) {
  const holder = String(lease?.sessionId || '');
  const sid = String(sessionId || '');
  return !!(lease && holder && holder !== sid);
}

function leaseRecord(sessionId, executionId, kind, acquiredAt = Date.now()) {
  return {
    sessionId: String(sessionId || ''),
    executionId: String(executionId || ''),
    acquiredAt,
    kinds: kind ? [String(kind)] : []
  };
}

function touchKind(lease, kind) {
  const name = kind ? String(kind) : '';
  if (name && !lease.kinds.includes(name)) lease.kinds.push(name);
  return lease;
}

export function tryAcquireTabLease(tabId, sessionId, executionId, kind) {
  const id = Number(tabId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ok: false,
      code: 'NEED_EXPLICIT_TAB',
      error: 'tabId required'
    };
  }
  const sid = String(sessionId || '');
  const eid = String(executionId || '');
  const existing = tabLeases.get(id);
  if (existing) {
    if (existing.sessionId === sid && existing.executionId === eid) {
      return { ok: true, reentrant: true, tabId: id, lease: touchKind(existing, kind) };
    }
    return {
      ok: false,
      code: 'TAB_LEASED',
      error: `Tab ${id} is leased by session ${existing.sessionId || '(unknown)'}`,
      holderSessionId: existing.sessionId,
      tabId: id
    };
  }
  const lease = leaseRecord(sid, eid, kind);
  tabLeases.set(id, lease);
  return { ok: true, tabId: id, lease };
}

export function grantTabLease(tabId, sessionId, executionId, kind = 'tabs.open') {
  const id = Number(tabId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, code: 'NEED_EXPLICIT_TAB', error: 'tabId required' };
  }
  const lease = leaseRecord(sessionId, executionId, kind);
  tabLeases.set(id, lease);
  return { ok: true, tabId: id, lease };
}

export function releaseTabLease(tabId) {
  const id = Number(tabId);
  if (!tabLeases.has(id)) return false;
  tabLeases.delete(id);
  return true;
}

export function releaseTabLeasesByExecution(sessionId, executionId) {
  const sid = String(sessionId || '');
  const eid = executionId == null || executionId === '' ? '' : String(executionId);
  if (!sid && !eid) return [];
  const released = [];
  for (const [id, lease] of tabLeases) {
    if (sid && lease.sessionId !== sid) continue;
    if (eid && lease.executionId !== eid) continue;
    tabLeases.delete(id);
    released.push(id);
  }
  return released;
}

/**
 * Gate a live-page action. Never consults Chrome's focused tab.
 * Missing tabId → NEED_EXPLICIT_TAB and does not register a lease.
 */
export function preparePageActionTarget(request = {}) {
  const tabId = explicitPageActionTabId(request);
  if (!tabId) {
    return {
      ok: false,
      code: 'NEED_EXPLICIT_TAB',
      error: 'page action requires an explicit tabId'
    };
  }
  const op = String(request.op || '').trim().toLowerCase();
  return tryAcquireTabLease(
    tabId,
    request.sessionId,
    request.executionId,
    op ? `action:${op}` : 'action'
  );
}
