/**
 * Durable call journal.
 * Write-ahead: prepared+authorized must succeed before SW dispatch.
 */

export const JOURNAL_SCHEMA = 'pawwork.call-journal/v1';
export const JOURNAL_DB = 'pawwork-call-journal-v1';
export const JOURNAL_STORE = 'operations';
export const JOURNAL_SESSION_CAP = 200;
export const JOURNAL_ANOMALY_CAP = 50;

export const JOURNAL_STATES = Object.freeze([
  'prepared',
  'awaiting_approval',
  'authorized',
  'dispatched',
  'succeeded',
  'failed',
  'unknown',
  'verified',
  'needs_human'
]);

const ALLOWED = {
  prepared: new Set(['awaiting_approval', 'authorized', 'failed']),
  awaiting_approval: new Set(['authorized', 'failed']),
  authorized: new Set(['dispatched', 'failed']),
  dispatched: new Set(['succeeded', 'failed', 'unknown']),
  succeeded: new Set(['verified', 'needs_human']),
  failed: new Set(['verified', 'needs_human']),
  unknown: new Set(['verified', 'needs_human']),
  verified: new Set(),
  needs_human: new Set()
};

function nowTs() {
  return Date.now();
}

function clone(row) {
  return row ? JSON.parse(JSON.stringify(row)) : null;
}

function transitionError(from, to) {
  const err = new Error(`illegal journal transition ${from} → ${to}`);
  err.code = 'JOURNAL_ILLEGAL';
  return err;
}

export function assertJournalTransition(from, to) {
  if (from === to) return true;
  if (!ALLOWED[from] || !ALLOWED[from].has(to)) throw transitionError(from, to);
  return true;
}

function applyStateTimes(row, state, ts) {
  row.ts = row.ts && typeof row.ts === 'object' ? { ...row.ts } : {};
  if (state === 'prepared') row.ts.prepared = ts;
  if (state === 'awaiting_approval') row.ts.awaitingApproval = ts;
  if (state === 'authorized') row.ts.authorized = ts;
  if (state === 'dispatched') row.ts.dispatched = ts;
  if (state === 'succeeded' || state === 'failed' || state === 'unknown') row.ts.result = ts;
  if (state === 'verified' || state === 'needs_human') row.ts.verified = ts;
}

export function createMemoryCallJournal() {
  const operations = new Map();
  const approvals = new Map();
  let revision = 0;
  let failWrites = false;

  function pruneSession(sessionId) {
    const sid = String(sessionId || '');
    const rows = [...operations.values()].filter((row) => row.sessionId === sid);
    if (rows.length <= JOURNAL_SESSION_CAP) return;
    rows.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    const drop = rows.length - JOURNAL_SESSION_CAP;
    for (let i = 0; i < drop; i += 1) operations.delete(rows[i].operationId);
  }

  return {
    kind: 'memory',
    _operations: operations,
    _approvals: approvals,
    failNextWrite() {
      failWrites = true;
    },
    async put(row) {
      if (failWrites) {
        failWrites = false;
        const err = new Error('journal write failed');
        err.code = 'JOURNAL_UNAVAILABLE';
        throw err;
      }
      const next = clone(row);
      next.revision = ++revision;
      next.updatedAt = nowTs();
      operations.set(next.operationId, next);
      pruneSession(next.sessionId);
      return clone(next);
    },
    async get(operationId) {
      return clone(operations.get(String(operationId || '')));
    },
    async listBySession(sessionId) {
      const sid = String(sessionId || '');
      return [...operations.values()]
        .filter((row) => row.sessionId === sid)
        .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
        .map(clone);
    },
    async deleteSession(sessionId) {
      const sid = String(sessionId || '');
      for (const [id, row] of [...operations.entries()]) {
        if (row.sessionId === sid) operations.delete(id);
      }
      for (const [id, rec] of [...approvals.entries()]) {
        if (rec.sessionId === sid) approvals.delete(id);
      }
    },
    async putApproval(rec) {
      if (failWrites) {
        failWrites = false;
        const err = new Error('journal write failed');
        err.code = 'JOURNAL_UNAVAILABLE';
        throw err;
      }
      approvals.set(rec.approvalId, clone(rec));
      return clone(rec);
    },
    async getApproval(approvalId) {
      return clone(approvals.get(String(approvalId || '')));
    },
    async listApprovals(sessionId) {
      const sid = String(sessionId || '');
      return [...approvals.values()].filter((rec) => !sid || rec.sessionId === sid).map(clone);
    },
    async scan(predicate) {
      return [...operations.values()].filter((row) => predicate(row)).map(clone);
    }
  };
}

export async function openIndexedDbCallJournal(indexedDBImpl) {
  const idb = indexedDBImpl || globalThis.indexedDB;
  if (!idb) {
    const err = new Error('indexedDB unavailable');
    err.code = 'JOURNAL_UNAVAILABLE';
    throw err;
  }
  const db = await new Promise((resolve, reject) => {
    const req = idb.open(JOURNAL_DB, 1);
    req.onupgradeneeded = () => {
      const next = req.result;
      if (!next.objectStoreNames.contains(JOURNAL_STORE)) {
        const store = next.createObjectStore(JOURNAL_STORE, { keyPath: 'operationId' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('state', 'state', { unique: false });
      }
      if (!next.objectStoreNames.contains('approvals')) {
        const store = next.createObjectStore('approvals', { keyPath: 'approvalId' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(Object.assign(new Error('journal idb open failed'), { code: 'JOURNAL_UNAVAILABLE' }));
  });

  function requestValue(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(Object.assign(new Error('journal idb request failed'), { code: 'JOURNAL_UNAVAILABLE' }));
    });
  }

  function tx(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let pending;
      try {
        pending = fn(store);
      } catch (error) {
        reject(error);
        return;
      }
      const value = pending && typeof pending.then === 'function' ? pending : requestValue(pending);
      transaction.oncomplete = () => {
        value.then(resolve, reject);
      };
      transaction.onerror = () =>
        reject(Object.assign(new Error('journal idb write failed'), { code: 'JOURNAL_UNAVAILABLE' }));
    });
  }

  return {
    kind: 'idb',
    async put(row) {
      await tx(JOURNAL_STORE, 'readwrite', (store) => store.put(row));
      return row;
    },
    async get(operationId) {
      return tx(JOURNAL_STORE, 'readonly', (store) => store.get(String(operationId || '')));
    },
    async listBySession(sessionId) {
      return tx(JOURNAL_STORE, 'readonly', (store) => {
        const index = store.index('sessionId');
        return index.getAll(String(sessionId || ''));
      });
    },
    async deleteSession(sessionId) {
      const rows = await this.listBySession(sessionId);
      await tx(JOURNAL_STORE, 'readwrite', (store) => {
        for (const row of rows || []) store.delete(row.operationId);
      });
      const approvals = await this.listApprovals(sessionId);
      await tx('approvals', 'readwrite', (store) => {
        for (const rec of approvals || []) store.delete(rec.approvalId);
      });
    },
    async putApproval(rec) {
      await tx('approvals', 'readwrite', (store) => store.put(rec));
      return rec;
    },
    async getApproval(approvalId) {
      return tx('approvals', 'readonly', (store) => store.get(String(approvalId || '')));
    },
    async listApprovals(sessionId) {
      const sid = String(sessionId || '');
      const all = await tx('approvals', 'readonly', (store) => store.getAll());
      return (all || []).filter((rec) => !sid || rec.sessionId === sid);
    },
    async scan(predicate) {
      const all = await tx(JOURNAL_STORE, 'readonly', (store) => store.getAll());
      return (all || []).filter((row) => predicate(row));
    }
  };
}

export function createUnavailableCallJournal() {
  const fail = async () => {
    const err = new Error('Call journal is unavailable');
    err.code = 'JOURNAL_UNAVAILABLE';
    throw err;
  };
  return {
    kind: 'unavailable',
    commit: fail,
    update: fail,
    get: async () => null,
    listBySession: async () => [],
    deleteSession: async () => {},
    putApproval: fail,
    getApproval: async () => null,
    listApprovals: async () => [],
    findDuplicate: async () => null,
    recoverOnStartup: async () => [],
    listAnomalies: async () => [],
    exportSession: fail
  };
}

export function createCallJournal(backend) {
  const store = backend || createMemoryCallJournal();

  async function commit(partial) {
    try {
      const ts = nowTs();
      const row = {
        schema: JOURNAL_SCHEMA,
        operationId: String(partial.operationId || ''),
        requestId: String(partial.requestId || ''),
        sessionId: String(partial.sessionId || ''),
        executionId: String(partial.executionId || ''),
        taskId: partial.taskId || null,
        intent: partial.intent || { channel: 'action', op: '' },
        risk: partial.risk,
        confidence: partial.confidence,
        accessMode: partial.accessMode,
        rawEscape: partial.rawEscape || 'n/a',
        reason: partial.reason || '',
        target: partial.target || {},
        payloadHash: String(partial.payloadHash || ''),
        payloadRef: partial.payloadRef,
        preconditions: Array.isArray(partial.preconditions) ? partial.preconditions : [],
        postconditions: Array.isArray(partial.postconditions) ? partial.postconditions : [],
        approvalId: partial.approvalId,
        approvalReceipt: partial.approvalReceipt,
        policySnapshot: partial.policySnapshot || null,
        state: partial.state || 'prepared',
        ts: {},
        receipt: partial.receipt,
        error: partial.error,
        outcome: partial.outcome,
        revision: 0,
        updatedAt: ts
      };
      applyStateTimes(row, row.state, ts);
      if (!row.operationId) {
        const err = new Error('operationId required');
        err.code = 'JOURNAL_UNAVAILABLE';
        throw err;
      }
      return store.put(row);
    } catch (error) {
      if (error?.code === 'JOURNAL_UNAVAILABLE') throw error;
      throw Object.assign(new Error(error?.message || 'journal write failed'), { code: 'JOURNAL_UNAVAILABLE' });
    }
  }

  async function update(operationId, patch = {}) {
    const current = await store.get(operationId);
    if (!current) {
      const err = new Error('journal row missing');
      err.code = 'JOURNAL_UNAVAILABLE';
      throw err;
    }
    const nextState = patch.state || current.state;
    if (patch.state) assertJournalTransition(current.state, patch.state);
    const ts = nowTs();
    const next = {
      ...current,
      ...patch,
      state: nextState,
      ts: { ...current.ts, ...(patch.ts || {}) },
      error: patch.error !== undefined ? patch.error : current.error,
      receipt: patch.receipt !== undefined ? patch.receipt : current.receipt,
      outcome: patch.outcome !== undefined ? patch.outcome : current.outcome
    };
    applyStateTimes(next, nextState, ts);
    return store.put(next);
  }

  async function findDuplicate(sessionId, payloadHash, documentId) {
    if (!payloadHash) return null;
    const rows = await store.listBySession(sessionId);
    return (
      rows.find(
        (row) =>
          row.payloadHash === payloadHash &&
          String(row.target?.documentId || '') === String(documentId || '') &&
          (row.state === 'succeeded' || row.state === 'verified')
      ) || null
    );
  }

  async function recoverOnStartup({ isExecutionActive, dropTicket, listTickets } = {}) {
    const changed = [];
    const liveOf = (row) =>
      typeof isExecutionActive === 'function' ? isExecutionActive(row.sessionId, row.executionId) : false;

    const dispatched = await store.scan((row) => row.state === 'dispatched' && !row.ts?.result);
    for (const row of dispatched) {
      changed.push(await update(row.operationId, { state: 'unknown', outcome: 'unknown', error: { code: 'SYS_OUTCOME_UNKNOWN', message: 'Crash between dispatch and result.' } }));
      if (typeof dropTicket === 'function') await dropTicket(row.operationId);
    }

    const authorized = await store.scan((row) => row.state === 'authorized');
    for (const row of authorized) {
      if (liveOf(row)) continue;
      changed.push(
        await update(row.operationId, {
          state: 'failed',
          outcome: 'unknown',
          error: { code: 'SYS_OUTCOME_UNKNOWN', message: 'Crash after authorize before confirmed dispatch.' }
        })
      );
      if (typeof dropTicket === 'function') await dropTicket(row.operationId);
    }

    const pending = await store.scan((row) => row.state === 'awaiting_approval');
    for (const row of pending) {
      if (liveOf(row)) continue;
      changed.push(
        await update(row.operationId, {
          state: 'failed',
          outcome: 'denied',
          error: { code: 'APPROVAL_EXPIRED', message: 'Execution ended before approval.' }
        })
      );
      if (typeof dropTicket === 'function') await dropTicket(row.operationId);
    }

    if (typeof listTickets === 'function') {
      const leftovers = await listTickets();
      for (const ticket of leftovers || []) {
        const live = typeof isExecutionActive === 'function'
          ? isExecutionActive(ticket.sessionId, ticket.executionId)
          : false;
        if (!live && typeof dropTicket === 'function') await dropTicket(ticket.operationId);
      }
    }
    return changed;
  }

  async function listAnomalies(sessionId, limit = JOURNAL_ANOMALY_CAP) {
    const rows = await store.listBySession(sessionId);
    return rows
      .filter((row) => ['unknown', 'needs_human', 'awaiting_approval'].includes(row.state) || /PAYMENT_DENIED|APPROVAL_|POLICY_DENIED|RAW_ESCAPE/.test(row.error?.code || ''))
      .slice(-Math.max(1, Number(limit) || JOURNAL_ANOMALY_CAP));
  }

  async function exportSession(sessionId) {
    const rows = await store.listBySession(sessionId);
    return {
      schema: JOURNAL_SCHEMA,
      sessionId: String(sessionId || ''),
      exportedAt: nowTs(),
      operations: rows.map((row) => ({
        ...row,
        payload: undefined
      }))
    };
  }

  return {
    kind: store.kind || 'memory',
    backend: store,
    commit,
    update,
    get: (id) => store.get(id),
    listBySession: (sid) => store.listBySession(sid),
    deleteSession: (sid) => store.deleteSession(sid),
    putApproval: (rec) => store.putApproval(rec),
    getApproval: (id) => store.getApproval(id),
    listApprovals: (sid) => store.listApprovals(sid),
    findDuplicate,
    recoverOnStartup,
    listAnomalies,
    exportSession
  };
}

export async function openCallJournal(opts = {}) {
  if (opts.backend) return createCallJournal(opts.backend);
  if (opts.memory === true) return createCallJournal(createMemoryCallJournal());
  const backend = await openIndexedDbCallJournal(opts.indexedDB);
  if (backend.kind !== 'idb') {
    const err = new Error('product journal must be IndexedDB');
    err.code = 'JOURNAL_UNAVAILABLE';
    throw err;
  }
  return createCallJournal(backend);
}

export function slimJournalAudit(row, extra = {}) {
  if (!row) return null;
  return {
    type: extra.type || 'journal',
    operationId: row.operationId,
    state: row.state,
    risk: row.risk,
    confidence: row.confidence,
    accessMode: row.accessMode,
    rawEscape: row.rawEscape,
    code: row.error?.code || extra.code || '',
    sessionId: row.sessionId,
    executionId: row.executionId,
    ts: Date.now()
  };
}
