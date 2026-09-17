import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyExecutionStatus,
  createExecutionStatus,
  currentFromToolCall,
  nextFromTask
} from '../src/sidepanel/executionStatus.js';
import { nextStatusCopy } from '../src/sidepanel/botStatusUi.js';
import { I18N } from '../src/sidepanel/i18n.js';
import { SessionWorkspaceService } from '../src/agent/vnext/service/sessionWorkspaceService.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';

test('ordinary send has no invented next and thought never drives status', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  assert.equal(state.next, null);
  state = applyExecutionStatus(state, { type: 'execution-start', sessionId: 's', executionId: 'e1' });
  assert.equal(state.phase, 'running');
  assert.equal(state.next, null);
  state = applyExecutionStatus(state, {
    type: 'thought',
    text: '下一步我会先点提交然后再填表'
  });
  assert.equal(state.current, null);
  assert.equal(state.next, null);
  state = applyExecutionStatus(state, { type: 'text', chunk: '我先写两句说明下一步' });
  assert.equal(state.current, null);
  assert.equal(state.next, null);
  const planOnly = nextFromTask({
    taskId: 't1',
    status: 'running',
    plan: { steps: [{ title: '打开后台', status: 'pending' }] }
  });
  assert.equal(planOnly, null);
});

test('next is only store task.nextAction', () => {
  let state = createExecutionStatus();
  state = applyExecutionStatus(
    state,
    { type: 'task-updated' },
    { task: { taskId: 't1', status: 'waiting', nextAction: '09:00 再扫库存' } }
  );
  assert.equal(state.next?.source, 'task.nextAction');
  assert.equal(state.next?.text, '09:00 再扫库存');
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    name: 'action',
    args: { op: 'click', name: '提交' }
  });
  assert.equal(state.current?.source, 'tool-call');
  assert.match(state.current.text, /点击/);
  assert.equal(state.next?.source, 'task.nextAction');
  assert.equal(state.summary.some((row) => /点击/.test(row.label)), true);
});

test('current maps host tool facts, not commentary', () => {
  const current = currentFromToolCall('run', { path: '/artifacts/notes.txt' }, 'zh');
  assert.equal(current.source, 'tool-call');
  assert.match(current.text, /notes\.txt/);
});

test('abortCurrentExecution targets the live slot; stale exact abort is a no-op', async () => {
  const releases = [];
  const service = new SessionWorkspaceService({
    store: new SessionWorkspaceStore(),
    memoryJournal: true,
    releaseTabLeases: (...args) => releases.push(args)
  });
  const oldCtl = new AbortController();
  const newCtl = new AbortController();
  service._activeBySession.set('s', { sessionId: 's', executionId: 'new', controller: newCtl });
  const stale = await service.abortExecution({ sessionId: 's', executionId: 'old' });
  assert.equal(stale.aborted, false);
  assert.equal(newCtl.signal.aborted, false);
  const current = await service.abortCurrentExecution({ sessionId: 's' });
  assert.equal(current.aborted, true);
  assert.equal(current.executionId, 'new');
  assert.equal(newCtl.signal.aborted, true);
  assert.deepEqual(releases, [['s', 'new']]);
  void oldCtl;
});

test('parallel tools restore current to the still-running call', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'A',
    name: 'action',
    args: { op: 'click', name: '提交' }
  });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'B',
    name: 'sheet',
    args: { op: 'read', path: '/artifacts/book.csv' }
  });
  assert.match(state.current.text, /表格|sheet|book/i);
  assert.equal(state.activeTools.length, 2);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'B',
    name: 'sheet',
    ok: true,
    result: { ok: true }
  });
  assert.equal(state.activeTools.length, 1);
  assert.equal(state.activeTools[0].id, 'A');
  assert.match(state.current.text, /点击|提交/);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'B',
    name: 'sheet',
    ok: true,
    result: { ok: true }
  });
  assert.equal(state.activeTools.length, 1);
  assert.equal(state.activeTools[0].id, 'A');
  assert.equal(state.summary.filter((row) => row.id === 'B').every((row) => row.status !== 'running'), true);
});

test('waiting_user next copy waits for the user, never the model', () => {
  const state = { ...createExecutionStatus({ sessionId: 's' }), phase: 'waiting_user', next: null };
  const zh = nextStatusCopy(state, (key) => I18N.zh[key] || key);
  const en = nextStatusCopy(state, (key) => I18N.en[key] || key);
  assert.equal(zh.kind, 'meta');
  assert.equal(zh.text, '下一步：等待你的选择/输入');
  assert.equal(en.text, 'Next: waiting for your choice or input');
  assert.equal(/模型决定/.test(zh.text), false);
  assert.equal(/waiting for the model/i.test(en.text), false);
  assert.equal(I18N.zh.botNextWaitingUser.includes('模型决定'), false);
  assert.equal(/waiting for the model/i.test(I18N.en.botNextWaitingUser), false);
});

test('active unknown next stays null and UI uses waiting-model meta', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  assert.equal(state.next, null);
  const copy = nextStatusCopy(state, (key) => I18N.zh[key] || key);
  assert.equal(copy.kind, 'meta');
  assert.equal(copy.text, '下一步：等待模型决定');
  assert.notEqual(state.next?.source, 'task.nextAction');
  const idle = nextStatusCopy(createExecutionStatus(), (key) => I18N.zh[key] || key);
  assert.equal(idle, null);
});

test('action summary kinds stay visible without leaking params', () => {
  let state = createExecutionStatus();
  for (const [id, name, args] of [
    ['a1', 'action', { op: 'click', name: '提交', secret: 'token-1' }],
    ['w1', 'web', { op: 'read', path: '/artifacts/site.html' }],
    ['s1', 'sheet', { op: 'write', path: '/artifacts/book.csv' }],
    ['d1', 'doc', { op: 'read', path: '/artifacts/note.docx' }],
    ['t1', 'task', { op: 'plan' }]
  ]) {
    state = applyExecutionStatus(state, { type: 'tool-call', toolCallId: id, name, args });
  }
  const kinds = state.summary.map((row) => row.kind);
  assert.deepEqual(kinds, ['action', 'web', 'sheet', 'doc', 'task']);
  assert.equal(state.summary.every((row) => row.status === 'running'), true);
  assert.equal(JSON.stringify(state.summary).includes('token-1'), false);
});

test('abortTask never treats taskId as an executionId', async () => {
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore(), memoryJournal: true });
  const ctl = new AbortController();
  service._activeBySession.set('s', { sessionId: 's', executionId: 'live', controller: ctl });
  const result = await service.abortTask({ sessionId: 's', taskId: 'task-not-an-execution' });
  assert.equal(result.aborted, true);
  assert.equal(result.executionId, 'live');
});
