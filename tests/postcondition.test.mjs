import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVerifyToJournalState, defaultPostconditions, verifyPostconditions } from '../src/agent/vnext/host/postcondition.js';

test('delete absent verifies; lingering target or confirm dialog needs a human', async () => {
  const row = { risk: 'delete', postconditions: defaultPostconditions({ risk: 'delete', ref: 'f0.a1' }), state: 'succeeded' };
  const ok = await verifyPostconditions(row, { facts: { snapshotOk: true, controls: [] } });
  assert.equal(ok.status, 'verified');
  const noSnap = await verifyPostconditions(row, { facts: { controls: [] } });
  assert.equal(noSnap.status, 'needs_human');
  const toast = await verifyPostconditions(row, { facts: { snapshotOk: true, controls: [{ ref: 'f0.a1' }], toastDeleted: true } });
  assert.equal(toast.status, 'needs_human');
  assert.equal(applyVerifyToJournalState(row, toast), 'needs_human');
});

test('download hash/length mismatch and artifact revision are host facts', async () => {
  const dl = { risk: 'external-commit', postconditions: [{ kind: 'download-id' }], state: 'succeeded' };
  const good = await verifyPostconditions(dl, {
    facts: { download: { state: 'complete', bytes: 3, hash: 'aa' }, expectedBytes: 3, expectedHash: 'aa' }
  });
  assert.equal(good.status, 'verified');
  const bad = await verifyPostconditions(dl, {
    facts: { download: { state: 'complete', bytes: 9, hash: 'bb' }, expectedBytes: 3, expectedHash: 'aa' }
  });
  assert.equal(bad.status, 'needs_human');

  const art = {
    risk: 'reversible-write',
    postconditions: [{ kind: 'artifact-hash', sha256: 'hh', minRevision: 2 }],
    state: 'succeeded'
  };
  const saved = await verifyPostconditions(art, { facts: { revision: 2, sha256: 'hh' } });
  assert.equal(saved.status, 'verified');
});

test('unprovable send and model prose never become verified; dispatched unknown is not replayed', async () => {
  const send = {
    intent: { channel: 'sys', op: 'fetch', act: 'POST' },
    unprovable: true,
    state: 'succeeded'
  };
  const out = await verifyPostconditions(send, { facts: { modelEvidence: 'I posted it' } });
  assert.equal(out.status, 'needs_human');
  assert.notEqual(out.status, 'verified');

  const lost = {
    state: 'unknown',
    postconditions: [{ kind: 'dom-snapshot', match: 'control-disabled', ref: 'x' }]
  };
  const readback = await verifyPostconditions(lost, { facts: { snapshotOk: true, controls: [{ ref: 'x' }] } });
  assert.equal(readback.status, 'needs_human');
  assert.equal(applyVerifyToJournalState(lost, readback), 'needs_human');
});
