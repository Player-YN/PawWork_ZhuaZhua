import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallJournal, createMemoryCallJournal } from '../src/agent/vnext/host/callJournal.js';
import { gatedDispatch, hostAnswerApproval, hostGetPendingApproval } from '../src/agent/vnext/host/operationGate.js';
import { abortExecutionApprovals, createApprovalRecord, pendingApprovalCount } from '../src/agent/vnext/sessionWorkspace/approvalGate.js';

async function waitForWaiter() {
  for (let i = 0; i < 80; i += 1) {
    if (pendingApprovalCount() > 0) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('approval waiter was not registered');
}
import { installTestPolicy, resetTestPolicy } from './helpers/policyTestKit.mjs';
import { approvalBannerText } from '../src/sidepanel/approvalUi.js';
import { approvalBelongsToSession } from '../src/sidepanel/sessionIsolation.js';

function t(key) {
  return {
    approvalPaymentWait: '请你接管付款',
    approvalBannerDelete: '确认删除',
    approvalBannerAmbiguous: '确认提交'
  }[key] || key;
}

test('delete waits for one-shot host approval; second answer and other session fail', async () => {
  installTestPolicy();
  const journal = createCallJournal(createMemoryCallJournal());
  let sent = 0;
  const pending = gatedDispatch(
    { channel: 'action', op: 'click', name: 'Delete', sessionId: 's1', executionId: 'e1', tabId: 3, documentId: 'd1' },
    { journal, readPolicy: async () => ({ mode: 'guarded' }), send: async () => { sent += 1; return { ok: true }; } }
  );
  await waitForWaiter();
  const rec = await hostGetPendingApproval(journal, 's1');
  assert.ok(rec);
  assert.equal(rec.risk, 'delete');
  assert.equal((await hostAnswerApproval(journal, { approvalId: rec.approvalId, sessionId: 's2', decision: 'approve' })).code, 'APPROVAL_MISMATCH');
  assert.equal((await hostAnswerApproval(journal, { approvalId: rec.approvalId, sessionId: 's1', payloadHash: 'nope', decision: 'approve' })).code, 'APPROVAL_MISMATCH');
  assert.equal((await hostAnswerApproval(journal, { approvalId: rec.approvalId, sessionId: 's1', tabId: 99, decision: 'approve' })).code, 'APPROVAL_MISMATCH');
  const ok = await hostAnswerApproval(journal, { approvalId: rec.approvalId, sessionId: 's1', decision: 'approve' });
  assert.equal(ok.ok, true);
  const out = await pending;
  assert.equal(out.ok, true);
  assert.equal(sent, 1);
  assert.equal((await hostAnswerApproval(journal, { approvalId: rec.approvalId, sessionId: 's1', decision: 'approve' })).code, 'NOT_PENDING');
  resetTestPolicy();
});

test('expired and aborted approvals never dispatch', async () => {
  installTestPolicy();
  const journal = createCallJournal(createMemoryCallJournal());
  const expired = createApprovalRecord({
    operationId: 'op-x',
    sessionId: 's',
    executionId: 'e',
    risk: 'delete',
    now: Date.now() - 10 * 60 * 1000
  });
  await journal.putApproval(expired);
  assert.equal((await hostAnswerApproval(journal, { approvalId: expired.approvalId, sessionId: 's', decision: 'approve' })).code, 'APPROVAL_EXPIRED');

  let sent = 0;
  const pending = gatedDispatch(
    { channel: 'action', op: 'click', name: 'Remove', sessionId: 's', executionId: 'e' },
    { journal, readPolicy: async () => ({ mode: 'full' }), send: async () => { sent += 1; return { ok: true }; } }
  );
  await waitForWaiter();
  abortExecutionApprovals('s', 'e');
  const out = await pending;
  assert.equal(out.ok, false);
  assert.equal(out.code, 'APPROVAL_EXPIRED');
  assert.equal(sent, 0);
  resetTestPolicy();
});

test('payment card copy has no approve affordance; approval rows stay session-bound', () => {
  assert.equal(approvalBannerText({ type: 'policy-blocked', kind: 'payment-handoff', risk: 'payment' }, t), '请你接管付款');
  assert.equal(approvalBelongsToSession('a', 'b'), false);
  assert.equal(approvalBelongsToSession('a', 'a'), true);
});
