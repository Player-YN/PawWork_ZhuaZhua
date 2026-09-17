import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskScheduler, resolveTaskPage, TASK_WAKE_ALARM, TASK_RECONCILE_ALARM }
  from '../src/agent/vnext/host/taskScheduler.js';

function fixture() {
  const entries = new Map();
  const calls = [];
  let due = 200_000;
  const alarms = {
    async get(name) { return entries.get(name); },
    async create(name, info) { entries.set(name, { name, scheduledTime: info.when, ...info }); },
    async clear(name) { return entries.delete(name); }
  };
  const scheduler = createTaskScheduler({ alarms, now: () => 100_000, onError() {},
    rpc: async (method, params) => {
      calls.push({ method, params });
      return method === 'getTaskSchedule' ? { nextWakeAt: due } : { launched: [] };
    }
  });
  return { ...scheduler, alarms, entries, calls, setDue(value) { due = value; } };
}

test('task scheduler reconstructs alarm from durable due time and only dispatches on wakeup', async () => {
  const f = fixture();
  await f.reconcile();
  assert.equal(f.entries.get(TASK_WAKE_ALARM).when, 200_000);
  assert.equal(f.entries.get(TASK_RECONCILE_ALARM).periodInMinutes, 1);
  assert.deepEqual(f.calls.map(c => c.method), ['getTaskSchedule']);
  await f.onAlarm({ name: 'unrelated' });
  assert.equal(f.calls.length, 1);
  await f.onAlarm({ name: TASK_WAKE_ALARM });
  assert.deepEqual(f.calls.slice(1).map(c => c.method), ['runDueTasks', 'getTaskSchedule']);
});

test('busy / overdue schedules back off; no tasks removes both alarms', async () => {
  const f = fixture();
  f.setDue(50_000);
  await f.reconcile();
  assert.equal(f.entries.get(TASK_WAKE_ALARM).when, 130_000);
  f.setDue(null);
  await f.reconcile();
  assert.equal(f.entries.size, 0);
});

test('runtime failure preserves a retry alarm instead of losing scheduled work', async () => {
  const f = fixture();
  const scheduler = createTaskScheduler({ alarms: f.alarms, onError() {},
    rpc: async () => { throw new Error('offscreen restarted'); } });
  await scheduler.reconcile({ runDue: true });
  assert.ok(f.entries.has(TASK_RECONCILE_ALARM));
});

test('overlapping wakeups serialize reconciliation and observe changes arriving in flight', async () => {
  const f = fixture();
  let release;
  const blocked = new Promise(r => { release = r; });
  let active = 0, maxActive = 0, reads = 0, dispatches = 0;
  const scheduler = createTaskScheduler({ alarms: f.alarms, onError() {}, now: () => 100_000,
    rpc: async method => {
      active++; maxActive = Math.max(active, maxActive);
      if (method === 'getTaskSchedule' && ++reads === 1) await blocked;
      if (method === 'runDueTasks') dispatches++;
      active--;
      return { nextWakeAt: 200_000 };
    } });
  const first = scheduler.reconcile();
  const second = scheduler.onAlarm({ name: TASK_WAKE_ALARM });
  release();
  await Promise.all([first, second]);
  assert.equal(maxActive, 1);
  assert.equal(dispatches, 1);
  assert.equal(reads, 2);
});

test('task page resolver refuses recycled tab ids and never falls back to active tab', async () => {
  const seen = [];
  const result = await resolveTaskPage({
    get: async () => ({ id: 1, url: 'https://wrong.example/' }),
    query: async query => { seen.push(query); return [{ id: 3, url: 'https://right.example/' }]; }
  }, { tabId: 1, url: 'https://right.example/' });
  assert.equal(result.tab.id, 3);
  assert.deepEqual(seen, [{}]);
});

test('task target requires a unique exact URL after the saved tab disappears', async () => {
  const tabs = { get: async () => { throw new Error('closed'); },
    query: async () => [{ id: 2, url: 'https://example.com/' }, { id: 3, url: 'https://example.com/' }] };
  assert.equal((await resolveTaskPage(tabs, { id: 1, url: 'https://example.com/' })).code, 'TASK_TARGET_AMBIGUOUS');
  tabs.query = async () => [];
  assert.equal((await resolveTaskPage(tabs, { id: 1, url: 'https://example.com/' })).code, 'TASK_TARGET_MISSING');
  assert.deepEqual(await resolveTaskPage(tabs, null), { ok: true, tab: null });
});

test('task target being navigated away is not accepted merely because old URL still matches', async () => {
  const tab = { id: 1, url: 'https://example.com/', pendingUrl: 'https://elsewhere.example/' };
  const tabs = { get: async () => tab, query: async () => [tab] };
  assert.equal((await resolveTaskPage(tabs, { id: 1, url: tab.url })).code, 'TASK_TARGET_MISSING');
});
