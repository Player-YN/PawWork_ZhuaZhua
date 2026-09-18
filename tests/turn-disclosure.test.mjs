import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyExecutionStatus,
  collapseConsecutiveSummary,
  createExecutionStatus,
  currentFromToolCall,
  disclosureMode,
  foldStubFromState,
  formatFoldLine,
  formatSummaryRowText,
  hydrateStatusFromEvents,
  isPageReadStatus,
  liveActionBrief,
  persistLiveActionBrief,
  projectGlobalPhase,
  rememberEndedProjection,
  shouldKeepApprovalVisible,
  shouldShowGlobalStatusWall,
  visibleSummaryRows
} from '../src/sidepanel/executionStatus.js';
import { nextStatusCopy } from '../src/sidepanel/botStatusUi.js';
import { createBotStatusUi } from '../src/sidepanel/botStatusUi.js';
import {
  exclusiveHistoricalOpen,
  insertTurnDisclosure,
  LIVE_ACTION_SHINE,
  planLiveDisclosurePaint,
  prefersReducedMotion
} from '../src/sidepanel/turnDisclosureUi.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bindThinkToggle,
  resolveLiveDisclosureHost,
  sealThinkKeepBody,
  shouldCreateThinkFromEvent
} from '../src/sidepanel/thinkUi.js';
import { I18N } from '../src/sidepanel/i18n.js';
import { applyLiveProgress, createLiveProgressState } from '../src/agent/vnext/sessionWorkspace/liveProgress.js';

function zh(key) {
  return I18N.zh[key] || key;
}
function en(key) {
  return I18N.en[key] || key;
}

function mockHost() {
  return {
    hidden: false,
    className: '',
    dataset: {},
    children: [],
    replaceChildren() {
      this.children = [];
    }
  };
}

function classList(init = []) {
  const set = new Set(init);
  return {
    contains: (n) => set.has(n),
    add: (...ns) => ns.forEach((n) => set.add(n)),
    remove: (...ns) => ns.forEach((n) => set.delete(n)),
    toggle(n, force) {
      if (force === true) {
        set.add(n);
        return true;
      }
      if (force === false) {
        set.delete(n);
        return false;
      }
      if (set.has(n)) {
        set.delete(n);
        return false;
      }
      set.add(n);
      return true;
    }
  };
}

function node(className, children = []) {
  const names = String(className || '').split(/\s+/).filter(Boolean);
  const el = {
    className,
    classList: classList(names),
    children: [],
    parentNode: null,
    dataset: {},
    open: false,
    querySelector(sel) {
      const want = String(sel || '').replace(':scope > ', '').split(',')[0].trim();
      return (
        this.children.find((c) => c.className?.split(/\s+/).includes(want.replace('.', ''))) || null
      );
    },
    querySelectorAll(sel) {
      const want = String(sel || '').replace('.', '');
      const out = [];
      const walk = (cur) => {
        if (cur.className && String(cur.className).split(/\s+/).includes(want.split(' ')[0])) out.push(cur);
        for (const c of cur.children || []) walk(c);
      };
      for (const c of this.children) walk(c);
      return out;
    },
    insertBefore(child, before) {
      child.parentNode = this;
      const i = this.children.indexOf(before);
      if (i < 0) this.children.push(child);
      else this.children.splice(i, 0, child);
      return child;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
  };
  for (const child of children) {
    child.parentNode = el;
    el.children.push(child);
  }
  return el;
}

test('disclosureMode completed becomes folded and global phase is idle', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1', startedAt: 1_000 });
  state = applyExecutionStatus(state, { type: 'execution-end', status: 'completed', endedAt: 13_000 });
  assert.equal(state.phase, 'completed');
  assert.equal(disclosureMode(state), 'folded');
  assert.equal(projectGlobalPhase(state), 'idle');
  const stub = foldStubFromState(state, zh);
  assert.match(stub.line, /^完成 ·/);
  assert.equal(shouldShowGlobalStatusWall(state), false);
});

test('botStatus host stays hidden after complete and has no wall rows', () => {
  const host = mockHost();
  const ui = createBotStatusUi({
    t: zh,
    getLang: () => 'zh',
    getHost: () => host,
    getSessionId: () => 's'
  });
  ui.apply({ type: 'execution-start', executionId: 'e1' });
  ui.apply({ type: 'execution-end', status: 'completed' });
  assert.equal(host.hidden, true);
  assert.equal(host.children.length, 0);
  assert.match(host.className, /visually-hidden/);
});

test('completed wall hides without masking pending approval or payment intercept', () => {
  const wall = mockHost();
  const ui = createBotStatusUi({
    t: zh,
    getLang: () => 'zh',
    getHost: () => wall,
    getSessionId: () => 's'
  });
  ui.apply({ type: 'execution-start', executionId: 'e1' });
  let state = ui.apply({
    type: 'approval-required',
    risk: 'delete',
    summary: '确认删除',
    approvalId: 'a1'
  });
  assert.equal(state.phase, 'awaiting_approval');
  assert.equal(disclosureMode(state), 'sticky');
  assert.equal(state.next, null);
  assert.equal(nextStatusCopy(state, zh).kind, 'meta');
  const approval = { hidden: false, className: 'approval-live is-delete', textContent: '确认删除' };
  state = ui.apply({ type: 'assistant-final', status: 'completed' });
  assert.equal(state.approvalOpen, true);
  assert.equal(state.phase, 'awaiting_approval');
  assert.equal(disclosureMode(state), 'sticky');
  assert.equal(shouldKeepApprovalVisible(state, 'assistant-final'), true);
  assert.equal(wall.hidden, true);
  assert.equal(wall.children.length, 0);
  assert.equal(approval.hidden, false);

  let pay = createExecutionStatus({ sessionId: 's' });
  pay = applyExecutionStatus(pay, { type: 'execution-start', executionId: 'e2' });
  pay = applyExecutionStatus(pay, {
    type: 'policy-blocked',
    kind: 'payment-handoff',
    summary: '请你接管付款',
    code: 'PAYMENT_DENIED'
  });
  const payment = { hidden: false, className: 'approval-live is-payment', textContent: '请你接管付款' };
  const afterFinal = applyExecutionStatus(pay, { type: 'assistant-final', status: 'completed' });
  assert.equal(afterFinal.policyBlocked, 'payment-handoff');
  assert.equal(disclosureMode(afterFinal), 'sticky');
  assert.equal(shouldKeepApprovalVisible(afterFinal, 'assistant-final'), true);
  assert.notEqual(disclosureMode(afterFinal), 'folded');
  assert.equal(payment.hidden, false);
  assert.equal(shouldKeepApprovalVisible(afterFinal, 'execution-end'), false);
});

test('no thought event still has disclosure slot and no think-block', () => {
  assert.equal(shouldCreateThinkFromEvent({ type: 'tool-call', name: 'run' }), false);
  const wrap = node('agent-turn');
  const disclosure = node('turn-disclosure is-live');
  insertTurnDisclosure(wrap, disclosure);
  assert.equal(wrap.children[0], disclosure);
  assert.equal(
    wrap.children.some((c) => c.classList.contains('think-block')),
    false
  );
});

test('thought and disclosure are siblings; seal keeps thought body', () => {
  const body = { textContent: 'provider thought' };
  const think = {
    classList: classList(['think-block', 'is-live', 'is-collapsed']),
    querySelector(sel) {
      if (sel === '.think-body') return body;
      return null;
    }
  };
  const wrap = node('agent-turn', [think]);
  const disclosure = node('turn-disclosure is-live');
  insertTurnDisclosure(wrap, disclosure);
  assert.equal(wrap.children[0], think);
  assert.equal(wrap.children[1], disclosure);
  assert.equal(sealThinkKeepBody(think), 'provider thought');
  assert.equal(body.textContent, 'provider thought');
});

test('visible summary keeps the last 8 rows', () => {
  const summary = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, label: `row-${i}` }));
  const rows = visibleSummaryRows(summary, 8);
  assert.equal(rows.length, 8);
  assert.equal(rows[0].id, 'r1');
  assert.equal(rows[7].id, 'r8');
});

test('waiting_user and awaiting_approval are sticky meta, not state.next', () => {
  const waiting = { ...createExecutionStatus({ sessionId: 's' }), phase: 'waiting_user', next: null };
  assert.equal(disclosureMode(waiting), 'sticky');
  assert.equal(nextStatusCopy(waiting, zh).kind, 'meta');
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, { type: 'approval-required', summary: '确认删除', approvalId: 'a1' });
  assert.equal(disclosureMode(state), 'sticky');
  assert.equal(state.next, null);
  assert.equal(nextStatusCopy(state, zh).text, '下一步：等待你确认这次操作');
  assert.equal(nextStatusCopy(state, en).text, 'Next: waiting for your approval');
});

test('TAB_LEASED is sticky and lease copy has no profile hint', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, { type: 'lease', op: 'conflict', code: 'TAB_LEASED', title: 'Canva', holderSessionId: 'other' });
  assert.equal(state.lease?.kind, 'conflict');
  assert.equal(disclosureMode(state), 'sticky');
  assert.equal(/profile|新.*配置/i.test(I18N.zh.botLeaseConflict), false);
});

test('failed is sticky; completed is not', () => {
  let failed = createExecutionStatus();
  failed = applyExecutionStatus(failed, { type: 'execution-start', executionId: 'e1' });
  failed = applyExecutionStatus(failed, { type: 'execution-end', status: 'failed' });
  assert.equal(disclosureMode(failed), 'sticky');
  let done = createExecutionStatus();
  done = applyExecutionStatus(done, { type: 'execution-start', executionId: 'e2' });
  done = applyExecutionStatus(done, { type: 'execution-end', status: 'completed' });
  assert.equal(disclosureMode(done), 'folded');
});

test('two turns keep separate disclosure stubs and no top wall', () => {
  const thread = node('task-body');
  const a = node('agent-turn', [node('turn-disclosure is-folded')]);
  const b = node('agent-turn', [node('turn-disclosure is-folded')]);
  thread.appendChild(a);
  thread.appendChild(b);
  const wall = mockHost();
  const ui = createBotStatusUi({ t: zh, getLang: () => 'zh', getHost: () => wall, getSessionId: () => 's' });
  ui.apply({ type: 'execution-end', status: 'completed' });
  assert.equal(thread.querySelectorAll('turn-disclosure').length, 2);
  assert.equal(wall.hidden, true);
  assert.equal(wall.children.length, 0);
});

test('hydrate replays tool events and drops thought text', () => {
  const state = hydrateStatusFromEvents(
    [
      { type: 'execution-start', executionId: 'e1' },
      { type: 'thought', text: '我会先点提交然后编一个下一步' },
      { type: 'tool-call', toolCallId: 'c1', name: 'action', args: { op: 'click', name: '提交' } },
      { type: 'tool-result', toolCallId: 'c1', name: 'action', ok: true, result: { ok: true } }
    ],
    { lang: 'zh' }
  );
  assert.equal(state.summary.some((row) => /提交/.test(row.label)), true);
  assert.equal(JSON.stringify(state.summary).includes('编一个下一步'), false);
  assert.match(state.current?.text || '', /已点击|提交/);
  assert.equal(state.current?.status, 'success');
});

test('memory LRU evicts the 9th ended execution to a stub', () => {
  const full = new Map();
  const stubs = new Map();
  for (let i = 1; i <= 9; i += 1) {
    rememberEndedProjection(full, stubs, `e${i}`, {
      line: `完成 · ${i}S`,
      durationMs: i * 1000,
      artifactCount: 0,
      summary: [{ id: `r${i}` }]
    });
  }
  assert.equal(full.size, 8);
  assert.equal(full.has('e1'), false);
  assert.equal(stubs.get('e1')?.hydrated, false);
  assert.equal(full.get('e9')?.hydrated, true);
});

test('opening a second historical disclosure closes the first', () => {
  const first = node('turn-disclosure is-folded');
  first.open = true;
  first.classList.add('is-open');
  const second = node('turn-disclosure is-folded');
  second.open = true;
  const root = node('task-body', [first, second]);
  root.querySelectorAll = (sel) => {
    void sel;
    return [first, second];
  };
  exclusiveHistoricalOpen(root, second);
  assert.equal(first.open, false);
  assert.equal(second.open, true);
});

test('user stop folds as stopped, not sticky', () => {
  let state = createExecutionStatus();
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1', startedAt: 1_000 });
  state = applyExecutionStatus(state, { type: 'abort', aborted: true });
  state = applyExecutionStatus(state, { type: 'execution-end', status: 'aborted', code: 'user_stop', endedAt: 5_000 });
  assert.equal(state.phase, 'stopped');
  assert.equal(disclosureMode(state), 'folded');
  assert.match(foldStubFromState(state, zh).line, /^已停止 ·/);
  assert.match(foldStubFromState(state, en).line, /^Stopped ·/);
});

test('paused durable task stays sticky and is not task complete', () => {
  let state = createExecutionStatus();
  state = applyExecutionStatus(
    state,
    { type: 'task-updated' },
    { task: { taskId: 't1', status: 'paused', originalGoal: '扫库存' } }
  );
  assert.equal(disclosureMode(state), 'sticky');
  assert.notEqual(state.task?.status, 'completed');
});

test('think Enter does not toggle disclosure', () => {
  let thinkOpen = false;
  let disclosureOpen = false;
  const toggle = {
    type: 'button',
    tagName: 'BUTTON',
    dataset: {},
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
  };
  bindThinkToggle(
    toggle,
    () => thinkOpen,
    (next) => {
      thinkOpen = next;
    }
  );
  toggle.listeners.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(thinkOpen, true);
  assert.equal(disclosureOpen, false);
});

test('fold line i18n omits deliverables when count is 0', () => {
  assert.equal(formatFoldLine({ phase: 'completed', durationMs: 12_000, artifactCount: 0 }, zh), '完成 · 12S');
  assert.equal(formatFoldLine({ phase: 'completed', durationMs: 12_000, artifactCount: 1 }, zh), '完成 · 12S · 1 个交付物');
  assert.equal(formatFoldLine({ phase: 'completed', durationMs: 12_000, artifactCount: 2 }, en), 'Done · 12S · 2 deliverables');
});

test('liveProgress commentary never becomes execution current', () => {
  let progress = createLiveProgressState();
  progress = applyLiveProgress(progress, { type: 'text', chunk: '我先写两句说明下一步会点提交' }, 'zh');
  let state = createExecutionStatus();
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, { type: 'text', chunk: '我先写两句说明下一步会点提交' });
  assert.equal(state.current, null);
  assert.equal(state.next, null);
  assert.equal(progress.visible, false);
});

test('resolveLiveDisclosureHost reuses the same wrap', () => {
  const think = node('think-block is-live');
  const disclosure = node('turn-disclosure is-live');
  const turn = node('agent-turn', [think, disclosure]);
  const body = node('task-body', [node('msg user'), turn]);
  const host = resolveLiveDisclosureHost(body, null);
  assert.equal(host.wrap, turn);
  assert.equal(host.think, think);
});

test('reduced-motion helper reads matchMedia', () => {
  assert.equal(prefersReducedMotion(() => ({ matches: true })), true);
  assert.equal(prefersReducedMotion(() => ({ matches: false })), false);
});

test('live action brief is the current host action only', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  assert.equal(liveActionBrief(state), '');
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'snap',
    name: 'action',
    args: { op: 'snapshot' }
  });
  assert.equal(isPageReadStatus(state.current), true);
  assert.equal(liveActionBrief(state), '');
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c2',
    name: 'action',
    args: { op: 'click', name: '提交' }
  });
  assert.match(liveActionBrief(state), /正在点击|Clicking/);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'c2',
    name: 'action',
    ok: true,
    result: { ok: true }
  });
  assert.equal(disclosureMode(state), 'live');
  assert.match(liveActionBrief(state), /正在点击|Clicking/);
  assert.doesNotMatch(liveActionBrief(state), /已点击|Clicked|成功 页面|Success/);
  assert.equal(planLiveDisclosurePaint(state).hidden, false);
  assert.equal(state.next, null);
  assert.equal(nextStatusCopy(state, zh).text, '下一步：等待模型决定');
});

test('page-read and inspect html never become the live brief', () => {
  assert.equal(isPageReadStatus(currentFromToolCall('action', { op: 'snapshot' }, 'zh')), true);
  assert.equal(isPageReadStatus(currentFromToolCall('inspect', { view: 'html' }, 'zh')), true);
  assert.equal(isPageReadStatus(currentFromToolCall('action', { op: 'click', name: '提交' }, 'zh')), false);
  let sticky = createExecutionStatus({ sessionId: 's' });
  sticky = applyExecutionStatus(sticky, { type: 'execution-start', executionId: 'e2' });
  sticky = applyExecutionStatus(sticky, {
    type: 'approval-required',
    risk: 'delete',
    summary: '确认删除',
    approvalId: 'a1'
  });
  assert.equal(disclosureMode(sticky), 'sticky');
  assert.match(liveActionBrief(sticky), /确认删除|等待你确认|Waiting for your confirmation/);
});

test('active unknown next stays meta waiting for the model', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  assert.equal(state.next, null);
  assert.equal(disclosureMode(state), 'live');
  assert.equal(nextStatusCopy(state, zh).text, '下一步：等待模型决定');
});

test('current brief updates from latest host write, not the first generic label', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c1',
    name: 'run',
    args: { code: 'await fs.writeFile("/artifacts/a.html", "x")' }
  });
  assert.match(state.current.text, /运行访客代码|Running guest code/);
  assert.equal(state.current.status, 'running');
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'c1',
    name: 'run',
    ok: true,
    result: { ok: true, artifacts: [{ name: 'a.html', path: '/artifacts/a.html' }] }
  });
  assert.match(state.current.text, /已写 a\.html|Wrote a\.html/);
  assert.equal(state.current.status, 'success');
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c2',
    name: 'run',
    args: { op: 'write_artifact', path: '/artifacts/b.css' }
  });
  assert.match(state.current.text, /正在写 b\.css|Writing b\.css/);
  assert.equal(state.next, null);
  assert.equal(nextStatusCopy(state, zh).text, '下一步：等待模型决定');
});

test('consecutive identical writes collapse to a count', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  for (let i = 1; i <= 6; i += 1) {
    state = applyExecutionStatus(state, {
      type: 'tool-call',
      toolCallId: `w${i}`,
      name: 'run',
      args: { op: 'write_artifact' }
    });
    state = applyExecutionStatus(state, {
      type: 'tool-result',
      toolCallId: `w${i}`,
      name: 'run',
      ok: true,
      result: { ok: true }
    });
  }
  const collapsed = collapseConsecutiveSummary(state.summary);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].count, 6);
  assert.match(collapsed[0].label, /写入交付物|Write deliverable/);
  assert.equal(formatSummaryRowText(collapsed[0], zh), '写入×6');
  assert.equal(formatSummaryRowText(collapsed[0], en), 'Write×6');
  const visible = visibleSummaryRows(state.summary, 8);
  assert.equal(visible.length, 1);
  assert.equal(state.current?.status, 'success');
  assert.match(state.current.text, /已写入交付物|Wrote a deliverable/);
});

test('completed folds while approval and payment stay sticky', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c1',
    name: 'run',
    args: { code: '1' }
  });
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'c1',
    name: 'run',
    ok: true,
    result: { ok: true }
  });
  state = applyExecutionStatus(state, { type: 'execution-end', status: 'completed', endedAt: 8_000 });
  assert.equal(disclosureMode(state), 'folded');
  assert.equal(shouldKeepApprovalVisible(state, 'execution-end'), false);

  let sticky = createExecutionStatus({ sessionId: 's' });
  sticky = applyExecutionStatus(sticky, { type: 'execution-start', executionId: 'e2' });
  sticky = applyExecutionStatus(sticky, {
    type: 'approval-required',
    risk: 'delete',
    summary: '确认删除',
    approvalId: 'a1'
  });
  sticky = applyExecutionStatus(sticky, { type: 'assistant-final', status: 'completed' });
  assert.equal(disclosureMode(sticky), 'sticky');
  assert.equal(shouldKeepApprovalVisible(sticky, 'assistant-final'), true);
});

test('live brief persists through page-read hops and settled success', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1' });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c1',
    name: 'action',
    args: { op: 'click', name: '提交' }
  });
  const running = liveActionBrief(state);
  assert.match(running, /正在点击|Clicking/);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'c1',
    name: 'action',
    ok: true,
    result: { ok: true }
  });
  assert.equal(liveActionBrief(state), running);
  assert.equal(planLiveDisclosurePaint(state).hidden, false);
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'snap',
    name: 'action',
    args: { op: 'snapshot' }
  });
  assert.equal(isPageReadStatus(state.current), true);
  assert.equal(liveActionBrief(state), running);
  assert.doesNotMatch(liveActionBrief(state), /读取当前标签|Reading the current tab/);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'snap',
    name: 'action',
    ok: true,
    result: { ok: true }
  });
  assert.equal(liveActionBrief(state), running);
  const empty = createExecutionStatus({ sessionId: 's' });
  assert.equal(persistLiveActionBrief(empty, running), running);
  assert.equal(planLiveDisclosurePaint(empty, running).hidden, false);
  assert.equal(planLiveDisclosurePaint(empty, running).text, running);
  assert.equal(planLiveDisclosurePaint(empty).hidden, true);
  const thinking = applyExecutionStatus(
    { ...state, current: { text: '正在读取当前标签', status: 'running', source: 'tool-call', tool: 'action', op: 'snapshot' } },
    { type: 'tool-execution-end' }
  );
  assert.equal(persistLiveActionBrief(thinking, running), running);
  assert.equal(planLiveDisclosurePaint(thinking, running).hidden, false);
});

test('live brief stays after settle until product folds', () => {
  let state = createExecutionStatus({ sessionId: 's' });
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e1', startedAt: 1_000 });
  state = applyExecutionStatus(state, {
    type: 'tool-call',
    toolCallId: 'c1',
    name: 'action',
    args: { op: 'click', name: '提交' }
  });
  const running = liveActionBrief(state);
  state = applyExecutionStatus(state, {
    type: 'tool-result',
    toolCallId: 'c1',
    name: 'action',
    ok: true,
    result: { ok: true }
  });
  state = applyExecutionStatus(state, { type: 'execution-end', status: 'completed', endedAt: 8_000 });
  assert.equal(disclosureMode(state), 'folded');
  assert.equal(liveActionBrief(state), running);
  state = applyExecutionStatus(state, { type: 'execution-start', executionId: 'e2' });
  assert.equal(liveActionBrief(state), '');
});

test('live shine targets glyphs, not the row chrome', () => {
  assert.equal(LIVE_ACTION_SHINE.glyphClass, 'turn-disclosure-current-text');
  assert.equal(LIVE_ACTION_SHINE.rowClass, 'turn-disclosure-current');
  assert.equal(LIVE_ACTION_SHINE.clip, 'text');
  const plan = planLiveDisclosurePaint({
    phase: 'running',
    current: { text: '正在点击 提交', status: 'running', source: 'tool-call' },
    lastLiveAction: '正在点击 提交'
  });
  assert.equal(plan.shineTarget, 'turn-disclosure-current-text');
  assert.equal(plan.shineClip, 'text');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const css = readFileSync(join(root, 'src/sidepanel.css'), 'utf8');
  const motion = readFileSync(join(root, 'src/sidepanel/css/motion.css'), 'utf8');
  const shineAt = css.indexOf('Live 摘要');
  assert.ok(shineAt >= 0);
  const shineBlock = css.slice(shineAt, shineAt + 1400);
  assert.match(shineBlock, /\.turn-disclosure-current-text/);
  assert.doesNotMatch(shineBlock, /color:\s*transparent/);
  assert.doesNotMatch(shineBlock, /-webkit-text-fill-color:\s*transparent/);
  assert.match(shineBlock, /-webkit-text-fill-color:\s*var\(--text-muted\)/);
  assert.equal(/\.turn-disclosure\.is-live \.turn-disclosure-current,/.test(shineBlock), false);
  assert.match(motion, /\.turn-disclosure-current-text/);
  assert.match(motion, /-webkit-text-fill-color:\s*var\(--text-muted\)/);
});
