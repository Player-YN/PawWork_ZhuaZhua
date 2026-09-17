import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCallJournal,
  createMemoryCallJournal,
  assertJournalTransition,
  JOURNAL_SESSION_CAP
} from '../src/agent/vnext/host/callJournal.js';
import { gatedDispatch } from '../src/agent/vnext/host/operationGate.js';
import { installTestPolicy, resetTestPolicy } from './helpers/policyTestKit.mjs';

test('illegal transitions throw; session delete GCs rows', async () => {
  assert.throws(() => assertJournalTransition('verified', 'dispatched'), { code: 'JOURNAL_ILLEGAL' });
  assert.throws(() => assertJournalTransition('needs_human', 'authorized'), { code: 'JOURNAL_ILLEGAL' });
  const journal = createCallJournal(createMemoryCallJournal());
  await journal.commit({ operationId: 'a', sessionId: 's', state: 'prepared' });
  await journal.deleteSession('s');
  assert.equal(await journal.get('a'), null);
});

test('write-ahead failure never calls send; crash after dispatched becomes unknown and is not replayed', async () => {
  installTestPolicy();
  const backend = createMemoryCallJournal();
  const journal = createCallJournal(backend);
  backend.failNextWrite();
  let sent = 0;
  const failed = await gatedDispatch(
    { channel: 'action', op: 'click', name: 'Save', sessionId: 's', executionId: 'e' },
    { journal, readPolicy: async () => ({ mode: 'guarded' }), send: async () => { sent += 1; return { ok: true }; } }
  );
  assert.equal(failed.code, 'JOURNAL_UNAVAILABLE');
  assert.equal(sent, 0);

  const row = await journal.commit({
    operationId: 'crash-1',
    sessionId: 's',
    executionId: 'e',
    payloadHash: 'same',
    target: { documentId: 'doc' },
    state: 'prepared'
  });
  await journal.update(row.operationId, { state: 'authorized' });
  await journal.update(row.operationId, { state: 'dispatched' });
  const recovered = await journal.recoverOnStartup({ isExecutionActive: () => false, dropTicket: async () => {} });
  assert.equal(recovered[0].state, 'unknown');
  const after = await journal.get('crash-1');
  assert.equal(after.state, 'unknown');

  await journal.update('crash-1', { state: 'needs_human' });
  const verified = await journal.commit({
    operationId: 'done-1',
    sessionId: 's',
    payloadHash: 'dup',
    target: { documentId: 'doc' },
    state: 'prepared'
  });
  await journal.update(verified.operationId, { state: 'authorized' });
  await journal.update(verified.operationId, { state: 'dispatched' });
  await journal.update(verified.operationId, { state: 'succeeded' });
  await journal.update(verified.operationId, { state: 'verified' });
  assert.equal((await journal.findDuplicate('s', 'dup', 'doc')).operationId, verified.operationId);
  resetTestPolicy();
});

test('session cap drops oldest rows; anomalies list unknown and needs_human', async () => {
  const journal = createCallJournal(createMemoryCallJournal());
  for (let i = 0; i < JOURNAL_SESSION_CAP + 3; i += 1) {
    await journal.commit({ operationId: `n${i}`, sessionId: 'cap', state: 'prepared' });
  }
  const rows = await journal.listBySession('cap');
  assert.equal(rows.length, JOURNAL_SESSION_CAP);
  assert.equal(rows.some((row) => row.operationId === 'n0'), false);
  await journal.update(rows.at(-1).operationId, { state: 'authorized' });
  await journal.update(rows.at(-1).operationId, { state: 'dispatched' });
  await journal.update(rows.at(-1).operationId, { state: 'unknown', outcome: 'unknown' });
  const anomalies = await journal.listAnomalies('cap');
  assert.ok(anomalies.some((row) => row.state === 'unknown'));
});
