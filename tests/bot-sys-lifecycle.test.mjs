import test from 'node:test';
import assert from 'node:assert/strict';
import { resetTabLeases, acquireTabLease, readTabLease } from '../src/agent/vnext/host/tabLease.js';
import { callBrowserSys } from '../src/agent/vnext/host/sysClient.js';
import { installTestPolicy, seedAutoTicket } from './helpers/policyTestKit.mjs';
globalThis.chrome = { debugger: {} };
const { handleWorkspaceSys } = await import('../src/agent/vnext/host/browserSysHost.js');
const { releaseBrowserExecution, reconcileBrowserExecutions } = await import('../src/agent/vnext/host/browserExecution.js');
function setup() {
  installTestPolicy({ mode: 'full' });
  resetTabLeases();
  const state = { injections: [], removed: [], attaches: [], detaches: [], queries: 0 };
  globalThis.chrome = {
    tabs: { get: async id => ({ id, url: 'https://example.com', title: 'Test' }),
      query: async () => { state.queries++; return [{ id: 999 }]; }, remove: async id => state.removed.push(id) },
    webNavigation: { getFrame: async ({ frameId }) => ({ frameId, documentId: 'doc-1', documentLifecycle: 'active', url: 'https://example.com' }) },
    userScripts: { getScripts: async () => [], execute: async input => { state.injections.push(input); return [{ frameId: 0, documentId: 'doc-1', result: { ok: true, value: 3 } }]; } },
    debugger: { attach: async target => state.attaches.push(target), detach: async target => state.detaches.push(target),
      sendCommand: async () => ({}), getTargets: async () => [{ id: 'alias', tabId: 61, type: 'page', url: 'https://example.com' }] }
  };
  return state;
}
async function call(op, params, sessionId = 's', executionId = 'e') {
  const req = { op, params, sessionId, executionId };
  Object.assign(req, await seedAutoTicket(req, { channel: 'sys', op, params }));
  return handleWorkspaceSys(req);
}
test('tabs.current never silently resolves to the focused tab', async () => {
  const state = setup();
  assert.equal((await call('tabs.current', {})).code, 'NEED_PAGE'); assert.equal(state.queries, 0);
  assert.equal((await call('tabs.current', { tabId: 1 })).result.id, 1);
});
test('tabs.close respects the same cross-session ownership as page mutations', async () => {
  const state = setup(); await acquireTabLease(60, 'holder', 'e', 'eval');
  const out = await call('tabs.close', { tabId: 60 });
  assert.equal(out.code, 'TAB_LEASED'); assert.deepEqual(state.removed, []);
});
test('CDP targetId is canonicalized, so an alias cannot bypass tab ownership', async () => {
  const state = setup(); await acquireTabLease(61, 'holder', 'e', 'eval');
  const out = await call('cdp', { targetId: 'alias', action: 'attach' });
  assert.equal(out.code, 'TAB_LEASED'); assert.equal(state.attaches.length, 0);
});
test('userScripts is pinned by documentIds and optional document preconditions are checked', async () => {
  const state = setup();
  const stale = await call('eval', { tabId: 62, documentId: 'old', code: 'return 3' });
  assert.equal(stale.code, 'TARGET_CHANGED'); assert.equal(state.injections.length, 0);
  const fresh = await call('eval', { tabId: 62, documentId: 'doc-1', code: 'return 3' });
  assert.equal(fresh.ok, true); assert.equal(fresh.result.documentId, 'doc-1');
  assert.deepEqual(state.injections[0].target, { tabId: 62, documentIds: ['doc-1'] });
});
test('execution cleanup detaches CDP, releases leases, and rejects late calls', async () => {
  const state = setup();
  assert.equal((await call('cdp', { tabId: 63, action: 'attach' })).ok, true);
  const [one, two] = await Promise.all([releaseBrowserExecution('s', 'e'), releaseBrowserExecution('s', 'e')]);
  assert.deepEqual(one, [63]); assert.deepEqual(two, [63]); assert.equal(state.detaches.length, 1);
  assert.equal(await readTabLease(63), null);
  assert.equal((await call('eval', { tabId: 63, code: 'return 1' })).code, 'EXECUTION_ENDED');
});
test('reconciliation retains live owners and fails closed on an unknown runtime', async () => {
  setup(); await acquireTabLease(64, 'live', 'e', 'eval'); await acquireTabLease(65, 'dead', 'old', 'eval');
  await assert.rejects(reconcileBrowserExecutions(async () => ({ ok: false })), { code: 'LEASE_RECONCILE_FAILED' });
  assert.ok(await readTabLease(65));
  const released = await reconcileBrowserExecutions(async () => ({ ok: true, result: { activeExecutions: [{ sessionId: 'live', executionId: 'e' }] } }));
  assert.deepEqual(released, [65]); assert.ok(await readTabLease(64));
});
test('sys transport lost result is unknown, with no automatic resubmission', async () => {
  let count = 0;
  globalThis.chrome = { runtime: { sendMessage: async () => { count++; throw new Error('closed'); } } };
  const result = await callBrowserSys({ op: 'eval', params: {}, sessionId: 's', executionId: 'e' });
  assert.equal(result.code, 'SYS_OUTCOME_UNKNOWN'); assert.equal(result.outcome, 'unknown'); assert.equal(count, 1);
});

test('empty or mismatched userScripts results are unknown, not successful effects', async () => {
  for (const op of ['eval', 'waitFor', 'fetch']) {
    for (const results of [[], [{ documentId: 'other', result: { ok: true, value: 1 } }], [{}]]) {
      setup(); let count = 0;
      chrome.userScripts.execute = async () => { count++; return results; };
      const out = await call(op, { tabId: 68, code: 'return 1', as: 'page', url: '/submit' });
      assert.equal(out.code, 'SYS_OUTCOME_UNKNOWN'); assert.equal(out.outcome, 'unknown'); assert.equal(count, 1);
    }
  }
});
test('execution fence also blocks late extension-network and download effects', async () => {
  setup(); await releaseBrowserExecution('s', 'ended');
  for (const op of ['fetch', 'download', 'tabs.open']) {
    const out = await call(op, { url: 'https://example.com', as: 'extension' }, 's', 'ended');
    assert.equal(out.code, 'EXECUTION_ENDED');
  }
});
