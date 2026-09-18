/**
 * Host-created one-shot approval. Not the clarify tool.
 * Durable row lives in the call journal; the wait Promise is in-memory only.
 */

import { newNonce, newOperationId } from '../host/payloadHash.js';

const APPROVAL_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { resolve: Function, reject: Function, sessionId: string, executionId: string, cleanup: Function }>} */
const pending = new Map();

export function newApprovalId() {
  return `ap_${newOperationId().replace(/-/g, '').slice(0, 20)}`;
}

function abortError() {
  const err = new Error('aborted');
  err.name = 'AbortError';
  err.code = 'APPROVAL_EXPIRED';
  return err;
}

export function waitForApproval({ approvalId, sessionId, executionId, signal } = {}) {
  const id = String(approvalId || '').trim();
  if (!id) return Promise.reject(new Error('approvalId required'));
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const rec = pending.get(id);
      pending.delete(id);
      rec?.cleanup?.();
      reject(abortError());
    };
    const rec = {
      sessionId: String(sessionId || ''),
      executionId: String(executionId || ''),
      resolve: (value) => {
        pending.delete(id);
        rec.cleanup();
        resolve(value);
      },
      reject: (error) => {
        pending.delete(id);
        rec.cleanup();
        reject(error);
      },
      cleanup: () => {
        try {
          signal?.removeEventListener('abort', onAbort);
        } catch {
          /* ignore */
        }
      }
    };
    pending.set(id, rec);
    try {
      signal?.addEventListener('abort', onAbort, { once: true });
    } catch {
      /* ignore */
    }
  });
}

export function answerApprovalWaiter({ approvalId, sessionId, decision, streamId } = {}) {
  const id = String(approvalId || '').trim();
  const rec = pending.get(id);
  if (!rec) return { ok: false, error: 'no pending approval', code: 'NOT_PENDING' };
  if (sessionId && rec.sessionId && rec.sessionId !== String(sessionId)) {
    return { ok: false, error: 'approval session mismatch', code: 'APPROVAL_MISMATCH' };
  }
  rec.resolve({
    decision: decision === 'approve' ? 'approve' : 'deny',
    approvalId: id,
    streamId: streamId ? String(streamId) : ''
  });
  return { ok: true };
}

export function abortExecutionApprovals(sessionId, executionId) {
  const sid = sessionId != null ? String(sessionId) : null;
  const eid = executionId != null ? String(executionId) : null;
  const ids = [];
  for (const [id, rec] of [...pending.entries()]) {
    if (sid && rec.sessionId && rec.sessionId !== sid) continue;
    if (eid && rec.executionId && rec.executionId !== eid) continue;
    pending.delete(id);
    rec.cleanup?.();
    rec.reject(abortError());
    ids.push(id);
  }
  return ids;
}

export function pendingApprovalCount() {
  return pending.size;
}

export function createApprovalRecord({
  operationId,
  sessionId,
  executionId,
  taskId,
  tabId,
  documentId,
  url,
  risk,
  confidence,
  summary,
  detail,
  policySnapshot,
  payloadHash,
  now = Date.now()
}) {
  return {
    approvalId: newApprovalId(),
    operationId: String(operationId || ''),
    sessionId: String(sessionId || ''),
    executionId: String(executionId || ''),
    taskId: taskId || null,
    tabId,
    documentId: documentId || undefined,
    url: url || '',
    risk,
    confidence,
    summary: String(summary || ''),
    detail: String(detail || ''),
    payloadHash: payloadHash ? String(payloadHash) : '',
    policySnapshot: policySnapshot || null,
    createdAt: now,
    expiresAt: now + APPROVAL_TTL_MS,
    state: 'pending'
  };
}

export function issueApprovalReceipt(record, payloadHash, now = Date.now()) {
  return {
    approvalId: record.approvalId,
    operationId: record.operationId,
    nonce: newNonce(),
    sessionId: record.sessionId,
    executionId: record.executionId,
    payloadHash: String(payloadHash || ''),
    documentId: record.documentId,
    tabId: record.tabId,
    exp: Math.min(record.expiresAt, now + APPROVAL_TTL_MS)
  };
}

export const APPROVAL_TTL = APPROVAL_TTL_MS;
