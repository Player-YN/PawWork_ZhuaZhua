/**
 * Pure reducer for Bot-visible run status and the compact action summary.
 * Host / tool facts only. Thought, reasoning, and model prose never become
 * current / next / summary.
 */

const TERMINAL_TASK = new Set(['completed', 'failed', 'cancelled']);
const PROMINENT_TASK = new Set(['ready', 'running', 'waiting', 'paused']);
const NARRATIVE = new Set(['thought', 'thought-open', 'text', 'reasoning']);
const SUMMARY_CAP = 24;
const NAME_CAP = 48;

function text(value, cap = 240) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, cap);
}

function zh(lang) {
  return String(lang || 'zh').toLowerCase().startsWith('zh');
}

function toolName(ev) {
  return text(ev?.name || ev?.tool || ev?.toolName, 40);
}

function toolArgs(ev) {
  const raw = ev?.args ?? ev?.input ?? {};
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function toolResult(ev) {
  const raw = ev?.result ?? ev?.output ?? {};
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function resultCode(ev, result = toolResult(ev)) {
  return text(ev?.code || result.code || ev?.result?.code, 64);
}

export function waitingNext(lang = 'zh') {
  return {
    text: zh(lang) ? '等待模型决定' : 'Waiting for the model',
    source: 'none'
  };
}

export function undeclaredNext(lang = 'zh') {
  return {
    text: zh(lang) ? '下一步尚未声明' : 'Next step not declared',
    source: 'none'
  };
}

export function formatAimingText(count, lang = 'zh') {
  const n = Math.max(0, Number(count) || 0);
  if (zh(lang)) return n > 0 ? `全页可访问 · 已瞄准 ${n} 项` : '全页可访问';
  return n > 0 ? `Full page accessible · ${n} item${n === 1 ? '' : 's'} aimed` : 'Full page accessible';
}

export function countAimedItems({ groups = [], boundIds = [], mentions = [], selectedCount = 0 } = {}) {
  const bound = new Set((boundIds || []).map((id) => String(id)));
  let n = 0;
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!bound.has(String(g.groupId || g.id || ''))) continue;
    if (Array.isArray(g.items)) n += g.items.length;
    else n += Number(g.itemCount) || 0;
  }
  for (const m of Array.isArray(mentions) ? mentions : []) {
    if (!m || (m.kind !== 'item' && m.kind !== 'page')) continue;
    n += 1;
  }
  if (!n && Number(selectedCount) > 0) n = Number(selectedCount);
  return n;
}

export function nextFromTask(task) {
  if (!task || typeof task !== 'object') return null;
  const nextAction = text(task.nextAction, 200);
  if (nextAction) return { text: nextAction, source: 'task.nextAction' };
  return null;
}

export function compactStatusTask(task) {
  if (!task || typeof task !== 'object' || !text(task.taskId || task.originalGoal)) return null;
  const status = text(task.status).toLowerCase() || 'ready';
  return {
    taskId: text(task.taskId, 160),
    status,
    originalGoal: text(task.originalGoal, 200),
    nextAction: text(task.nextAction, 200),
    dueAt: text(task.dueAt, 80),
    summary: text(task.summary, 200),
    prominent: PROMINENT_TASK.has(status),
    terminal: TERMINAL_TASK.has(status)
  };
}

export function shouldShowDurableTaskCard(task) {
  const compact = compactStatusTask(task);
  return !!(compact && compact.prominent);
}

function objectName(args, result) {
  const raw =
    args?.name ||
    args?.path ||
    args?.title ||
    result?.name ||
    result?.path ||
    result?.title ||
    args?.artifactId ||
    result?.artifactId ||
    '';
  const s = text(raw, NAME_CAP);
  if (!s) return '';
  const base = s.split('/').filter(Boolean).pop() || s;
  return text(base, NAME_CAP);
}

export function currentFromToolCall(name, args = {}, lang = 'zh') {
  const isZh = zh(lang);
  const object = objectName(args, {});
  const op = text(args.op || args.act || args.action, 40);
  const view = text(args.view, 40);
  let label = '';
  if (name === 'action') {
    if (op === 'click') label = isZh ? `正在点击${object ? ` ${object}` : ''}` : `Clicking${object ? ` ${object}` : ''}`;
    else if (op === 'fill' || op === 'fill_form') label = isZh ? `正在填写${object ? ` ${object}` : ''}` : `Filling${object ? ` ${object}` : ''}`;
    else if (op === 'select') label = isZh ? `正在选择${object ? ` ${object}` : ''}` : `Selecting${object ? ` ${object}` : ''}`;
    else if (op === 'press') label = isZh ? `正在按键${args.key ? ` ${text(args.key, 16)}` : ''}` : `Pressing${args.key ? ` ${text(args.key, 16)}` : ''}`;
    else if (op === 'scroll') label = isZh ? '正在滚动页面' : 'Scrolling the page';
    else if (op === 'wait') label = isZh ? '正在等待页面' : 'Waiting on the page';
    else if (op === 'snapshot') label = isZh ? '正在读取当前标签' : 'Reading the current tab';
    else label = isZh ? '正在操作页面' : 'Acting on the page';
  } else if (name === 'run') {
    label = object
      ? isZh
        ? `正在写 ${object}`
        : `Writing ${object}`
      : isZh
        ? '正在写入交付物'
        : 'Writing a deliverable';
  } else if (name === 'inspect') {
    if (view === 'sys') label = isZh ? '正在查阅 sys 目录' : 'Reading the sys catalog';
    else if (view === 'html') label = isZh ? '正在读取页面 HTML' : 'Reading page HTML';
    else if (view === 'artifacts' || view === 'files') label = isZh ? '正在查看交付物' : 'Looking at deliverables';
    else if (view === 'skill' || view === 'skills') label = isZh ? '正在查阅做法' : 'Reading a playbook';
    else label = isZh ? '正在读取会话内容' : 'Reading session context';
  } else if (name === 'acquire') {
    if (op === 'search' || args.action === 'search') label = isZh ? '正在检索公开网' : 'Searching the public web';
    else if (op === 'fetch' || args.action === 'fetch') label = isZh ? '正在获取文件' : 'Fetching a file';
    else if (args.action === 'image') label = isZh ? '正在生成图片' : 'Generating an image';
    else label = isZh ? '正在获取内容' : 'Acquiring content';
  } else if (name === 'web') {
    label = op === 'read' ? (isZh ? '正在读取网站' : 'Reading the site') : isZh ? '正在写网站' : 'Writing the site';
  } else if (name === 'sheet') {
    label = op === 'read' ? (isZh ? '正在读取表格' : 'Reading the sheet') : isZh ? '正在写表格' : 'Writing the sheet';
  } else if (name === 'doc') {
    label = op === 'read' ? (isZh ? '正在读取文档' : 'Reading the document') : isZh ? '正在写文档' : 'Writing the document';
  } else if (name === 'task') {
    if (op === 'wait') label = isZh ? '正在登记等待' : 'Scheduling a wait';
    else if (op === 'complete') label = isZh ? '正在完成任务' : 'Completing the task';
    else if (op === 'schedule') label = isZh ? '正在安排定时任务' : 'Scheduling a task';
    else if (op === 'plan' || op === 'checkpoint') label = isZh ? '正在更新任务进度' : 'Updating task progress';
    else label = isZh ? '正在查看任务' : 'Inspecting the task';
  } else if (name === 'clarify') {
    label = isZh ? '正在询问用户' : 'Asking the user';
  } else {
    label = isZh ? `正在调用 ${name || '工具'}` : `Calling ${name || 'tool'}`;
  }
  return { text: text(label, 160), object, source: 'tool-call', tool: name, op };
}

function summaryKind(name, args) {
  if (name === 'action') return 'action';
  if (name === 'web') return 'web';
  if (name === 'sheet') return 'sheet';
  if (name === 'doc') return 'doc';
  if (name === 'task') return 'task';
  if (name === 'clarify') return 'wait';
  if (name === 'run' || ((name === 'sheet' || name === 'doc' || name === 'web') && text(args.act || args.op) === 'write')) {
    return 'write';
  }
  if (name === 'acquire' && (args.action === 'image' || args.op === 'image')) return 'write';
  if (name === 'inspect' || name === 'acquire') return 'read';
  return 'read';
}

function summaryLabel(kind, current, lang) {
  if (current?.text) return current.text.replace(/^正在/, '').trim() || current.text;
  const isZh = zh(lang);
  if (kind === 'page') return isZh ? '页面操作' : 'Page action';
  if (kind === 'write') return isZh ? '写入交付物' : 'Write deliverable';
  if (kind === 'wait') return isZh ? '等待 / 任务' : 'Wait / task';
  return isZh ? '读取 / 外网' : 'Read / network';
}

function pushSummary(summary, row) {
  const next = Array.isArray(summary) ? summary.slice() : [];
  next.push(row);
  return next.length > SUMMARY_CAP ? next.slice(next.length - SUMMARY_CAP) : next;
}

function markRecovered(summary, code) {
  const next = Array.isArray(summary) ? summary.slice() : [];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].code === code && (next[i].status === 'error' || next[i].status === 'failed')) {
      next[i] = { ...next[i], status: 'recovered' };
      break;
    }
  }
  return next;
}

export function createExecutionStatus(seed = {}) {
  return {
    phase: 'idle',
    current: null,
    next: null,
    targetPage: seed.targetPage || null,
    aiming: { pageAccess: true, count: Math.max(0, Number(seed.aimedCount) || 0) },
    lease: null,
    task: null,
    summary: [],
    executionId: null,
    sessionId: text(seed.sessionId, 80),
    pendingTools: 0,
    activeTools: [],
    clarifyOpen: false,
    approvalOpen: false,
    aborted: false
  };
}

function cloneActive(list) {
  return Array.isArray(list) ? list.map((row) => ({ ...row, current: row.current ? { ...row.current } : null })) : [];
}

function currentFromActive(active) {
  if (!active.length) return null;
  return active[active.length - 1].current || null;
}

function callId(ev, fallback = '') {
  return text(ev?.toolCallId || ev?.id, 80) || fallback;
}

function resolveNext(state, _lang, extras = {}) {
  if (extras.next?.source === 'task.nextAction' && extras.next.text) return extras.next;
  return nextFromTask(state.task);
}

function applyLease(state, ev) {
  const result = toolResult(ev);
  const code = resultCode(ev, result);
  const op = text(ev.op || ev.kind || ev.leaseOp, 24);
  if (op === 'release' || op === 'clear' || ev.clearLease === true) {
    return { ...state, lease: null };
  }
  if (op === 'acquire' || op === 'owned') {
    return {
      ...state,
      lease: {
        kind: 'owned',
        tabId: ev.tabId ?? result.tabId ?? state.lease?.tabId ?? '',
        title: text(ev.title || result.title, 120),
        holderSessionId: ''
      }
    };
  }
  if (code === 'TAB_LEASED' || op === 'conflict') {
    return {
      ...state,
      lease: {
        kind: 'conflict',
        code: 'TAB_LEASED',
        tabId: ev.tabId ?? result.tabId ?? '',
        title: text(ev.title || result.title, 120),
        holderSessionId: text(ev.holderSessionId || result.holderSessionId, 80)
      }
    };
  }
  return state;
}

function applyTask(state, task, lang) {
  const compact = compactStatusTask(task);
  let phase = state.phase;
  if (compact?.status === 'waiting' && phase !== 'running') phase = 'waiting_timer';
  else if (compact?.status === 'paused' && phase !== 'running') phase = 'paused';
  else if (compact?.status === 'completed' && phase === 'idle') phase = 'completed';
  return {
    ...state,
    task: compact,
    next: nextFromTask(compact),
    phase
  };
}

/**
 * @param {ReturnType<typeof createExecutionStatus>} state
 * @param {object} ev
 * @param {{ lang?: string, aimedCount?: number, targetPage?: object|null, task?: object|null }} [ctx]
 */
export function applyExecutionStatus(state, ev, ctx = {}) {
  const lang = ctx.lang || 'zh';
  const prev = state && typeof state === 'object' ? state : createExecutionStatus({ lang });
  let next = {
    ...prev,
    summary: Array.isArray(prev.summary) ? prev.summary.slice() : [],
    activeTools: cloneActive(prev.activeTools),
    aiming: {
      pageAccess: true,
      count: ctx.aimedCount != null ? Math.max(0, Number(ctx.aimedCount) || 0) : prev.aiming?.count || 0
    },
    targetPage: ctx.targetPage !== undefined ? ctx.targetPage : prev.targetPage
  };
  if (ctx.task !== undefined) next = applyTask(next, ctx.task, lang);

  const type = text(ev?.type);
  if (!type || NARRATIVE.has(type)) {
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'aiming') {
    next.aiming.count = Math.max(0, Number(ev.count ?? ctx.aimedCount) || 0);
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'page' || type === 'target-page') {
    const page = ev.page || ev.targetPage || ev;
    next.targetPage =
      page && (page.title || page.url)
        ? { title: text(page.title, 80), url: text(page.url, 200) }
        : null;
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'lease' || type === 'tab-lease') {
    next = applyLease(next, ev);
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'clear-lease') {
    next.lease = null;
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'task-updated' || type === 'task-lifecycle' || type === 'task-schedule-changed') {
    const task = ev.task || ctx.task || next.task;
    if (type === 'task-lifecycle' && text(ev.nextAction) && !nextFromTask(task)) {
      next.next = { text: text(ev.nextAction, 200), source: 'task.nextAction' };
    }
    next = applyTask(next, task, lang);
    if (text(ev.op) === 'wait' && ev.ok !== false) next.phase = next.phase === 'running' ? 'running' : 'waiting_timer';
    if (text(ev.op) === 'complete' && ev.ok === true) {
      next.phase = next.pendingTools > 0 ? next.phase : 'completed';
    }
    return next;
  }

  if (type === 'execution-start') {
    next.phase = 'running';
    next.aborted = false;
    next.clarifyOpen = false;
    next.approvalOpen = false;
    next.pendingTools = 0;
    next.activeTools = [];
    next.current = null;
    next.summary = [];
    next.executionId = text(ev.executionId, 80) || next.executionId;
    next.sessionId = text(ev.sessionId, 80) || next.sessionId;
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'abort') {
    next.aborted = ev.matched !== false && ev.aborted !== false;
    if (next.aborted) {
      next.phase = 'stopped';
      next.current = null;
      next.pendingTools = 0;
      next.activeTools = [];
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'clarify') {
    next.clarifyOpen = true;
    next.phase = 'waiting_user';
    next.current = currentFromToolCall('clarify', {}, lang);
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'clarify-done') {
    next.clarifyOpen = false;
    next.current = null;
    if (next.pendingTools > 0 || ev.aborted !== true) next.phase = next.aborted ? 'stopped' : 'running';
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'stale-ref') {
    if (ev.recovered === true) {
      next.summary = markRecovered(next.summary, 'STALE_REF');
    } else {
      next.summary = pushSummary(next.summary, {
        id: `stale-${next.summary.length}`,
        kind: 'error',
        label: zh(lang) ? '引用过期' : 'Stale control ref',
        object: text(ev.name, NAME_CAP),
        status: 'error',
        code: 'STALE_REF'
      });
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'action-outcome') {
    const code = text(ev.code, 64);
    if (code === 'TAB_LEASED') next = applyLease(next, { ...ev, op: 'conflict' });
    if (code === 'STALE_REF' && ev.recovered !== true) {
      next.summary = pushSummary(next.summary, {
        id: `stale-${next.summary.length}`,
        kind: 'error',
        label: zh(lang) ? '引用过期' : 'Stale control ref',
        object: text(ev.name, NAME_CAP),
        status: 'error',
        code: 'STALE_REF'
      });
    }
    if (ev.recovered === true || (text(ev.op) === 'snapshot' && ev.ok !== false)) {
      next.summary = markRecovered(next.summary, 'STALE_REF');
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'tool-call') {
    const name = toolName(ev);
    const args = toolArgs(ev);
    const current = currentFromToolCall(name, args, lang);
    const kind = summaryKind(name, args);
    const id = callId(ev, `call-${next.summary.length}`);
    const already = next.activeTools.find((row) => row.id && row.id === id);
    if (!already) {
      next.activeTools.push({ id, name, current });
    } else {
      already.current = current;
      already.name = name;
    }
    next.pendingTools = next.activeTools.length;
    next.phase = name === 'clarify' ? 'waiting_user' : 'running';
    next.current = current;
    if (!next.summary.some((row) => row.id === id && row.status === 'running')) {
      next.summary = pushSummary(next.summary, {
        id,
        kind,
        label: summaryLabel(kind, current, lang),
        object: current.object,
        status: 'running',
        tool: name,
        code: ''
      });
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'tool-execution-end') {
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'tool-result') {
    const name = toolName(ev);
    const args = toolArgs(ev);
    const result = toolResult(ev);
    const code = resultCode(ev, result);
    const ok = ev.ok !== false && result.ok !== false && !code;
    const recoveredCodes = new Set(['STALE_REF', 'TAB_LEASED', 'NEED_EXPLICIT_TAB', 'RPC_OUTCOME_UNKNOWN']);
    const id = callId(ev);
    let idx = -1;
    if (id) idx = next.activeTools.findIndex((row) => row.id === id);
    else {
      for (let i = next.activeTools.length - 1; i >= 0; i -= 1) {
        if (next.activeTools[i].name === name) {
          idx = i;
          break;
        }
      }
    }
    if (idx >= 0) next.activeTools.splice(idx, 1);
    next.pendingTools = next.activeTools.length;
    next.summary = next.summary.map((row) => {
      if (id && row.id === id && row.status === 'running') {
        return {
          ...row,
          status: ok ? 'success' : 'error',
          code: code || row.code
        };
      }
      return row;
    });
    if (code === 'TAB_LEASED') next = applyLease(next, ev);
    if (code === 'STALE_REF') {
      next.summary = pushSummary(next.summary, {
        id: `stale-${next.summary.length}`,
        kind: 'error',
        label: zh(lang) ? '引用过期' : 'Stale control ref',
        object: objectName(args, result),
        status: 'error',
        code: 'STALE_REF'
      });
    }
    if (name === 'action' && text(args.op) === 'snapshot' && ev.ok !== false && result.ok !== false) {
      next.summary = markRecovered(next.summary, 'STALE_REF');
    }
    if (name === 'task') {
      next = applyTask(next, result.task || ev.task || next.task, lang);
      if (text(args.op) === 'wait' && ev.ok !== false && result.ok !== false) {
        next.phase = 'waiting_timer';
      }
      if (text(args.op) === 'complete' && ev.ok !== false && result.ok !== false) {
        next.phase = 'completed';
      }
    }
    if (name === 'clarify' && ev.ok !== false) next.phase = 'waiting_user';
    next.current = currentFromActive(next.activeTools);
    if (code && recoveredCodes.has(code) === false && ev.ok === false) {
      next.summary = pushSummary(next.summary, {
        id: `err-${next.summary.length}`,
        kind: 'error',
        label: text(result.error || ev.error || code, 80),
        object: objectName(args, result),
        status: 'error',
        code
      });
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'error') {
    const code = resultCode(ev);
    if (code === 'TAB_LEASED') next = applyLease(next, ev);
    if (code === 'STALE_REF') {
      next.summary = pushSummary(next.summary, {
        id: `stale-${next.summary.length}`,
        kind: 'error',
        label: zh(lang) ? '引用过期' : 'Stale control ref',
        object: '',
        status: 'error',
        code: 'STALE_REF'
      });
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'policy-blocked') {
    next.approvalOpen = false;
    next.policyBlocked = ev.kind || 'payment-handoff';
    if (next.phase === 'idle') next.phase = 'running';
    next.current = {
      text: text(ev.summary, 160) || (zh(lang) ? '请你接管付款' : 'Please take over payment'),
      source: 'host'
    };
    next.summary = pushSummary(next.summary, {
      id: `blocked-${text(ev.operationId, 40) || next.summary.length}`,
      kind: 'error',
      label: text(ev.summary, 80) || (zh(lang) ? '请你接管付款' : 'Please take over payment'),
      object: text(ev.detail, NAME_CAP),
      status: 'error',
      code: ev.code || 'PAYMENT_DENIED'
    });
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'approval-required') {
    next.approvalOpen = ev.decisionRequired !== false;
    next.phase = 'awaiting_approval';
    next.current = {
      text: text(ev.summary, 160) || (zh(lang) ? '等待你确认' : 'Waiting for your confirmation'),
      source: 'host'
    };
    next.summary = pushSummary(next.summary, {
      id: `approval-${text(ev.approvalId || ev.operationId, 40) || next.summary.length}`,
      kind: ev.risk === 'delete' ? 'error' : 'wait',
      label: text(ev.summary, 80) || (zh(lang) ? '等待确认' : 'Awaiting approval'),
      object: text(ev.detail, NAME_CAP),
      status: 'waiting',
      code: 'APPROVAL_REQUIRED'
    });
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'approval-done') {
    next.approvalOpen = ev.stillPending === true;
    if (next.phase === 'awaiting_approval' && ev.stillPending !== true) {
      next.phase = next.aborted ? 'stopped' : 'running';
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'journal' || type === 'policy') {
    const state = text(ev.state, 40);
    if (state === 'unknown') {
      next.phase = 'unknown';
      next.current = { text: zh(lang) ? '结果未知，未重试' : 'Outcome unknown; not retried', source: 'host' };
    } else if (state === 'needs_human') {
      next.phase = 'needs_human';
      next.current = { text: zh(lang) ? '需要你查看后再继续' : 'Needs you to inspect before continuing', source: 'host' };
    } else if (state === 'verifying') {
      next.phase = 'verifying';
      next.current = { text: zh(lang) ? '正在核对是否已生效' : 'Checking whether it took effect', source: 'host' };
    }
    if (ev.code || state === 'unknown' || state === 'needs_human') {
      next.summary = pushSummary(next.summary, {
        id: `journal-${text(ev.operationId, 40) || next.summary.length}`,
        kind: 'error',
        label: text(ev.code || state, 80),
        object: text(ev.risk, NAME_CAP),
        status: state === 'unknown' ? 'unknown' : state === 'needs_human' ? 'needs_human' : 'error',
        code: text(ev.code, 64)
      });
    }
    next.next = resolveNext(next, lang);
    return next;
  }

  if (type === 'assistant-final' || type === 'execution-end') {
    const status = text(ev.status).toLowerCase();
    next.pendingTools = 0;
    next.activeTools = [];
    next.current = null;
    next.clarifyOpen = false;
    next.approvalOpen = false;
    next.policyBlocked = null;
    if (next.aborted || status === 'aborted' || ev.code === 'user_stop') next.phase = 'stopped';
    else if (status === 'failed' || type === 'error') next.phase = 'failed';
    else if (next.task?.status === 'waiting') next.phase = 'waiting_timer';
    else if (next.task?.status === 'paused') next.phase = 'paused';
    else if (next.task?.status === 'completed' || status === 'completed' || type === 'assistant-final') {
      next.phase = 'completed';
    } else next.phase = 'completed';
    next.next = resolveNext(next, lang);
    return next;
  }

  next.next = resolveNext(next, lang);
  return next;
}

export function visibleSummaryRows(summary, limit = 8) {
  const list = Array.isArray(summary) ? summary : [];
  return list.slice(Math.max(0, list.length - limit));
}

export function phaseLabelKey(phase) {
  const known = new Set(['idle', 'running', 'waiting_user', 'waiting_timer', 'paused', 'completed', 'failed', 'stopped', 'awaiting_approval', 'verifying', 'unknown', 'needs_human']);
  return known.has(String(phase || '')) ? `botPhase_${phase}` : 'botPhase_idle';
}
