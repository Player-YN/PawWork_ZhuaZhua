import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  explicitPageActionTabId,
  foreignTabLease,
  grantTabLease,
  peekTabLease,
  preparePageActionTarget,
  releaseTabLease,
  releaseTabLeasesByExecution,
  resetTabLeases,
  tryAcquireTabLease
} from '../src/agent/vnext/host/tabLease.js';
import { SessionWorkspaceService } from '../src/agent/vnext/service/sessionWorkspaceService.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createTask } from '../src/agent/vnext/sessionWorkspace/tasks.js';
import { formatTabLeaseMessage, tabLeasePayload } from '../src/sidepanel/tabLeaseUi.js';
import { I18N } from '../src/sidepanel/i18n.js';

function t(key) {
  return I18N.zh[key] || key;
}

test('two sessions cannot hold the same tab; first lease stays', () => {
  resetTabLeases();
  const first = tryAcquireTabLease(11, 'session-a', 'exec-1', 'action:click');
  const second = tryAcquireTabLease(11, 'session-b', 'exec-2', 'action:click');
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, 'TAB_LEASED');
  assert.equal(second.holderSessionId, 'session-a');
  assert.equal(second.tabId, 11);
  assert.equal(peekTabLease(11).sessionId, 'session-a');
  assert.equal(peekTabLease(11).executionId, 'exec-1');
});

test('same session and execution may reenter a tab lease', () => {
  resetTabLeases();
  const first = tryAcquireTabLease(12, 'session-a', 'exec-1', 'action:snapshot');
  const again = tryAcquireTabLease(12, 'session-a', 'exec-1', 'eval');
  assert.equal(first.ok, true);
  assert.equal(again.ok, true);
  assert.equal(again.reentrant, true);
  assert.deepEqual(peekTabLease(12).kinds, ['action:snapshot', 'eval']);
});

test('execution-end / settle release lets another session acquire', () => {
  resetTabLeases();
  tryAcquireTabLease(13, 'session-a', 'exec-1', 'eval');
  assert.deepEqual(releaseTabLeasesByExecution('session-a', 'exec-1'), [13]);
  assert.equal(peekTabLease(13), null);
  const next = tryAcquireTabLease(13, 'session-b', 'exec-9', 'eval');
  assert.equal(next.ok, true);
  assert.equal(next.lease.sessionId, 'session-b');
});

test('page action without tabId is NEED_EXPLICIT_TAB and does not register a lease', () => {
  resetTabLeases();
  const denied = preparePageActionTarget({ op: 'snapshot', sessionId: 's', executionId: 'e' });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'NEED_EXPLICIT_TAB');
  assert.equal(explicitPageActionTabId({ op: 'click' }), 0);
  assert.equal(peekTabLease(1), null);
  assert.equal(peekTabLease(undefined), null);

  const claimed = preparePageActionTarget({
    op: 'snapshot',
    tabId: 21,
    sessionId: 's',
    executionId: 'e'
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.tabId, 21);
  assert.equal(peekTabLease(21).sessionId, 's');
});

test('resolvePageActionTab no longer silently queries the Chrome focused tab', async () => {
  const src = await readFile(new URL('../src/background.js', import.meta.url), 'utf8');
  const start = src.indexOf('async function resolvePageActionTab');
  const end = src.indexOf('const pageActionRevByTab');
  assert.ok(start >= 0 && end > start);
  const fn = src.slice(start, end);
  assert.doesNotMatch(fn, /active:\s*true/);
  assert.doesNotMatch(fn, /tabs\.query/);
});

test('runDueTasks skips a due task whose target tab is leased by another session', async () => {
  resetTabLeases();
  const store = new SessionWorkspaceStore();
  const leases = new Map();
  const service = new SessionWorkspaceService({
    store,
    callModel: async () => ({ text: 'should not run' }),
    peekTabLease: (tabId) => leases.get(Number(tabId)) || null
  });
  service.ensureSession('holder');
  service.ensureSession('waiter');
  createTask(store, {
    sessionId: 'waiter',
    goal: 'Watch the board',
    status: 'waiting',
    dueAt: '2020-01-01T00:00:00.000Z',
    targetPage: { tabId: 44, url: 'https://example.com/' }
  });
  leases.set(44, { sessionId: 'holder', executionId: 'exec-live', acquiredAt: 1, kinds: ['eval'] });
  const out = await service.runDueTasks({ now: Date.parse('2026-01-01T00:00:00.000Z') });
  assert.equal(out.launched.length, 0);
  assert.equal(out.skipped.length, 1);
  assert.equal(out.skipped[0].reason, 'tab_leased');
  assert.equal(out.skipped[0].tabId, 44);
  assert.equal(out.skipped[0].holderSessionId, 'holder');
});

test('sys eval/page-fetch/cdp honor tab leases; list and extension fetch do not', async () => {
  resetTabLeases();
  globalThis.chrome = {
    tabs: {
      get: async (id) => ({ id, url: 'https://example.com', title: 'Example' }),
      create: async ({ url }) => ({ id: 77, url, title: 'New' }),
      update: async (id) => ({ id, url: 'https://example.com', title: 'Example' }),
      reload: async () => {},
      query: async () => [{ id: 99, url: 'https://other.example', title: 'Other', active: true }]
    },
    windows: { update: async () => {} },
    userScripts: {
      getScripts: async () => [],
      execute: async () => [{ result: { ok: true, value: { ok: true, status: 200 } }, frameId: 0 }]
    },
    debugger: {
      attach: async () => {},
      sendCommand: async () => ({ value: 1 }),
      detach: async () => {},
      getTargets: async () => []
    }
  };
  const { handleWorkspaceSys } = await import('../src/agent/vnext/host/browserSysHost.js');
  const first = await handleWorkspaceSys({
    sessionId: 's1',
    executionId: 'e1',
    op: 'eval',
    params: { tabId: 55, code: 'return 1' }
  });
  assert.equal(first.ok, true);
  const blocked = await handleWorkspaceSys({
    sessionId: 's2',
    executionId: 'e2',
    op: 'eval',
    params: { tabId: 55, code: 'return 1' }
  });
  assert.equal(blocked.code, 'TAB_LEASED');
  assert.equal(blocked.holderSessionId, 's1');
  assert.equal(blocked.title, 'Example');

  const reenter = await handleWorkspaceSys({
    sessionId: 's1',
    executionId: 'e1',
    op: 'fetch',
    params: { as: 'page', tabId: 55, url: 'https://example.com/data' }
  });
  assert.equal(reenter.ok, true);

  const listed = await handleWorkspaceSys({ sessionId: 's2', executionId: 'e2', op: 'tabs.list' });
  assert.equal(listed.ok, true);

  const opened = await handleWorkspaceSys({
    sessionId: 's1',
    executionId: 'e1',
    op: 'tabs.open',
    params: { url: 'https://opened.example/' }
  });
  assert.equal(opened.ok, true);
  assert.equal(peekTabLease(77).sessionId, 's1');
  const stealOpen = await handleWorkspaceSys({
    sessionId: 's2',
    executionId: 'e2',
    op: 'tabs.navigate',
    params: { tabId: 77, url: 'https://opened.example/other' }
  });
  assert.equal(stealOpen.code, 'TAB_LEASED');

  releaseTabLeasesByExecution('s1', 'e1');
  const after = await handleWorkspaceSys({
    sessionId: 's2',
    executionId: 'e2',
    op: 'cdp',
    params: { tabId: 55, action: 'attach' }
  });
  assert.equal(after.ok, true);
  resetTabLeases();
});

test('tab close and foreign-lease helper', () => {
  resetTabLeases();
  tryAcquireTabLease(8, 's', 'e', 'action:scroll');
  assert.equal(releaseTabLease(8), true);
  assert.equal(peekTabLease(8), null);
  assert.equal(foreignTabLease({ sessionId: 'a' }, 'b'), true);
  assert.equal(foreignTabLease({ sessionId: 'a' }, 'a'), false);
  assert.equal(foreignTabLease(null, 'a'), false);
});

test('granting a newly opened tab and sidepanel copy name the holder', () => {
  resetTabLeases();
  grantTabLease(3, 's1', 'e1', 'tabs.open');
  assert.equal(peekTabLease(3).kinds[0], 'tabs.open');
  const payload = tabLeasePayload({
    type: 'tool-result',
    result: { ok: false, code: 'TAB_LEASED', tabId: 3, title: 'Docs', holderSessionId: 's1' }
  });
  assert.equal(payload.code, 'TAB_LEASED');
  const zh = formatTabLeaseMessage(t, payload, '调研');
  assert.match(zh, /Docs/);
  assert.match(zh, /调研/);
  assert.doesNotMatch(zh, /profile/i);
  const need = formatTabLeaseMessage((key) => I18N.en[key], { code: 'NEED_EXPLICIT_TAB' });
  assert.match(need, /side panel current page/i);
});
