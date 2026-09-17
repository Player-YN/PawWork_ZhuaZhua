import test from 'node:test';
import assert from 'node:assert/strict';
import { resetTabLeases, configureTabLeasePersistence, acquireTabLease, readTabLease, releaseOwnedTabLeases,
  revokeTabLeaseOwner, grantTabLease, TAB_LEASE_STORAGE_KEY } from '../src/agent/vnext/host/tabLease.js';
import { SessionWorkspaceService } from '../src/agent/vnext/service/sessionWorkspaceService.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createTask } from '../src/agent/vnext/sessionWorkspace/tasks.js';
function storage() {
  const data = {};
  return { data, fail: false, async get(key) { return structuredClone({ [key]: data[key] }); },
    async set(values) { if (this.fail) throw new Error('quota'); Object.assign(data, structuredClone(values)); } };
}
test('lease survives worker recreation, but is not stored as a durable workspace task', async () => {
  resetTabLeases(); const disk = storage(); configureTabLeasePersistence(disk);
  assert.equal((await acquireTabLease(1, 's1', 'e1', 'eval')).ok, true);
  resetTabLeases(); configureTabLeasePersistence(disk);
  assert.equal((await readTabLease(1)).executionId, 'e1');
  assert.equal((await acquireTabLease(1, 's2', 'e2', 'eval')).code, 'TAB_LEASED');
  assert.deepEqual(Object.keys(disk.data), [TAB_LEASE_STORAGE_KEY]);
});
test('concurrent acquisitions serialize and only one session wins', async () => {
  resetTabLeases(); configureTabLeasePersistence(storage());
  const result = await Promise.all(['a', 'b', 'c'].map(sid => acquireTabLease(2, sid, 'e', 'action')));
  assert.equal(result.filter(r => r.ok).length, 1);
  assert.equal(result.filter(r => r.code === 'TAB_LEASED').length, 2);
});
test('storage write failure fails closed and does not grant a phantom lease', async () => {
  resetTabLeases(); const disk = storage(); configureTabLeasePersistence(disk); disk.fail = true;
  await assert.rejects(acquireTabLease(3, 'a', 'e', 'eval'), { code: 'LEASE_STORE_UNAVAILABLE' });
  disk.fail = false;
  assert.equal(await readTabLease(3), null);
  assert.equal((await acquireTabLease(3, 'b', 'e', 'eval')).ok, true);
});
test('corrupt storage never silently clears ownership', async () => {
  resetTabLeases(); const disk = storage(); disk.data[TAB_LEASE_STORAGE_KEY] = { version: 999 };
  configureTabLeasePersistence(disk);
  await assert.rejects(acquireTabLease(4, 'a', 'e', 'eval'), { code: 'LEASE_STORE_UNAVAILABLE' });
});
test('release needs an exact owner, revocation blocks late queued calls across restart', async () => {
  resetTabLeases(); const disk = storage(); configureTabLeasePersistence(disk);
  await acquireTabLease(5, 's', 'old', 'eval');
  assert.deepEqual(await releaseOwnedTabLeases('s', ''), []);
  assert.deepEqual(await releaseOwnedTabLeases('s', 'other'), []);
  await revokeTabLeaseOwner('s', 'old');
  await releaseOwnedTabLeases('s', 'old');
  resetTabLeases(); configureTabLeasePersistence(disk);
  await assert.rejects(acquireTabLease(5, 's', 'old', 'eval'), { code: 'EXECUTION_ENDED' });
  assert.equal((await acquireTabLease(5, 's', 'new', 'eval')).ok, true);
});
test('grant never overwrites another owner; production acquisition requires execution identity', async () => {
  resetTabLeases();
  assert.equal(grantTabLease(8, 'a', 'e').ok, true);
  assert.equal(grantTabLease(8, 'b', 'e').code, 'TAB_LEASED');
  configureTabLeasePersistence(storage());
  await assert.rejects(acquireTabLease(9, '', '', 'eval'), { code: 'EXECUTION_REQUIRED' });
});
test('stale abort cannot stop a newer execution in the same session', async () => {
  const releases = [];
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore(), memoryJournal: true, releaseTabLeases: (...args) => releases.push(args) });
  const controller = new AbortController();
  service._activeBySession.set('s', { sessionId: 's', executionId: 'new', controller });
  const result = await service.abortExecution({ sessionId: 's', executionId: 'old' });
  assert.equal(result.aborted, false); assert.equal(controller.signal.aborted, false); assert.equal(releases.length, 0);
  await service.abortExecution({ sessionId: 's' });
  assert.deepEqual(releases, [['s', 'new']]);
});
test('session reserved before async task preparation; second send stays SESSION_BUSY', async () => {
  const store = new SessionWorkspaceStore();
  const service = new SessionWorkspaceService({ store, memoryJournal: true, callModel: async () => ({ text: 'done' }) });
  service.ensureSession('s');
  const task = createTask(store, { sessionId: 's', goal: 'test' });
  let release; const blocked = new Promise(resolve => { release = resolve; });
  const original = service._commitTaskMutation.bind(service);
  service._commitTaskMutation = async (...args) => { await blocked; return original(...args); };
  const first = service.sendMessage({ sessionId: 's', taskRun: true, taskId: task.taskId, taskContinuation: true });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(service.sendMessage({ sessionId: 's', content: 'second' }), { code: 'SESSION_BUSY' });
  release(); await first;
});
