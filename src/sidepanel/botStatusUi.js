/**
 * Compact Bot status strip + foldable action summary.
 * Renders host facts from executionStatus.js. Does not invent next steps.
 */

import {
  applyExecutionStatus,
  compactStatusTask,
  createExecutionStatus,
  formatAimingText,
  phaseLabelKey,
  shouldShowDurableTaskCard,
  visibleSummaryRows
} from './executionStatus.js';

function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content != null) el.textContent = String(content);
  return el;
}

function ellipsize(value, max = 42) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const chars = [...s];
  if (chars.length <= max) return s;
  return `${chars.slice(0, max - 1).join('')}…`;
}

function safeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.host + (u.pathname && u.pathname !== '/' ? u.pathname : '');
  } catch {
    return '';
  }
}

function statusWord(status, t) {
  if (status === 'running') return t('botRowRunning');
  if (status === 'success') return t('botRowSuccess');
  if (status === 'error' || status === 'failed') return t('botRowError');
  if (status === 'recovered') return t('botRowRecovered');
  if (status === 'waiting') return t('botRowWaiting');
  if (status === 'unknown') return t('botRowUnknown');
  if (status === 'needs_human') return t('botRowNeedsHuman');
  return status;
}

export function nextStatusCopy(state, t) {
  if (state?.next?.source === 'task.nextAction' && state.next.text) {
    return { kind: 'task', text: state.next.text };
  }
  if (state?.phase === 'waiting_user') {
    return { kind: 'meta', text: t('botNextWaitingUser') };
  }
  if (state?.phase === 'running') return { kind: 'meta', text: t('botNextWaiting') };
  return null;
}

function kindWord(kind, t) {
  const key = `botKind_${kind}`;
  const label = t(key);
  return label === key ? kind : label;
}

/**
 * @param {{
 *   t: (key: string) => string,
 *   getLang: () => string,
 *   getHost: () => HTMLElement|null,
 *   getSessionId: () => string,
 *   onStop?: () => void
 * }} deps
 */
export function createBotStatusUi(deps) {
  /** @type {ReturnType<typeof createExecutionStatus>} */
  let state = createExecutionStatus();
  let host = null;

  function ensureHost() {
    const el = deps.getHost?.() || host;
    if (el) host = el;
    return host;
  }

  function line(label, value, className = '') {
    const row = node('div', `bot-status-line ${className}`.trim());
    row.append(node('span', 'bot-status-k', label));
    const v = node('span', 'bot-status-v', value);
    v.title = value;
    row.append(v);
    return row;
  }

  function render() {
    const el = ensureHost();
    if (!el) return state;
    const lang = deps.getLang?.() === 'en' ? 'en' : 'zh';
    const t = deps.t;
    const running = state.phase === 'running' || state.phase === 'waiting_user';
    const show = state.phase !== 'idle' || state.lease?.kind === 'conflict' || shouldShowDurableTaskCard(state.task);
    el.hidden = !show;
    el.className = 'bot-status';
    el.dataset.phase = state.phase;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', t('botStatusAria'));
    el.replaceChildren();
    if (!show) return state;

    const head = node('div', 'bot-status-head');
    const phase = node('span', 'bot-status-phase', t(phaseLabelKey(state.phase)));
    phase.dataset.phase = state.phase;
    head.append(phase);
    if (running && typeof deps.onStop === 'function') {
      const stop = node('button', 'bot-status-stop', t('botStop'));
      stop.type = 'button';
      stop.setAttribute('aria-label', t('botStop'));
      stop.addEventListener('click', (e) => {
        e.preventDefault();
        deps.onStop();
      });
      head.append(stop);
    }
    el.append(head);

    const currentText = state.current?.text || (running ? t('botCurrentNone') : '');
    if (currentText) el.append(line(t('botCurrent'), currentText, 'is-current'));

    const nextCopy = nextStatusCopy(state, t);
    if (nextCopy) {
      el.append(line(t('botNext'), nextCopy.text, nextCopy.kind === 'meta' ? 'is-next is-meta' : 'is-next'));
    }

    const page = state.targetPage;
    if (page && (page.title || page.url)) {
      const shown = ellipsize(page.title || safeUrl(page.url), 36);
      const extra = page.title && page.url ? ` · ${ellipsize(safeUrl(page.url), 28)}` : '';
      el.append(line(t('botPage'), `${shown}${extra}`, 'is-page'));
    }

    el.append(line(t('botAiming'), formatAimingText(state.aiming?.count || 0, lang), 'is-aim'));

    if (state.lease?.kind === 'conflict') {
      const title = ellipsize(state.lease.title || (state.lease.tabId ? `#${state.lease.tabId}` : 'tab'), 28);
      const holder = ellipsize(state.lease.holderSessionId || '', 16);
      const msg = t('botLeaseConflict').replace('{title}', title).replace('{name}', holder || 'session');
      el.append(line(t('botLease'), msg, 'is-lease is-conflict'));
    } else if (state.lease?.kind === 'owned' && running) {
      el.append(line(t('botLease'), t('botLeaseOwned'), 'is-lease'));
    }

    const task = compactStatusTask(state.task);
    if (shouldShowDurableTaskCard(task)) {
      const bits = [t(`durableTaskStatus_${task.status}`)];
      if (task.dueAt) bits.push(task.dueAt);
      if (task.nextAction) bits.push(ellipsize(task.nextAction, 36));
      el.append(line(t('botTask'), bits.filter(Boolean).join(' · '), 'is-task'));
    } else if (state.phase !== 'running') {
      el.append(line(t('botTask'), t('botTaskNone'), 'is-task is-faint'));
    }

    const rows = visibleSummaryRows(state.summary, 8);
    if (rows.length) {
      const details = node('details', 'bot-status-summary');
      const summary = node('summary', '', `${t('botSummary')} · ${rows.length}`);
      const list = node('ol', 'bot-status-rows');
      for (const row of rows) {
        const li = node('li', 'bot-status-row');
        li.dataset.status = row.status;
        const mark = node('span', 'bot-status-row-mark', statusWord(row.status, t));
        const body = node(
          'span',
          'bot-status-row-text',
          [kindWord(row.kind, t), row.label, row.object].filter(Boolean).join(' · ')
        );
        li.append(mark, body);
        list.append(li);
      }
      details.append(summary, list);
      el.append(details);
    }
    return state;
  }

  function apply(ev, ctx = {}) {
    state = applyExecutionStatus(state, ev, { lang: deps.getLang?.() || 'zh', ...ctx });
    render();
    return state;
  }

  function reset(seed = {}) {
    state = createExecutionStatus({ lang: deps.getLang?.() || 'zh', ...seed });
    render();
    return state;
  }

  function setState(next) {
    state = next && typeof next === 'object' ? next : createExecutionStatus();
    render();
    return state;
  }

  function snapshot() {
    return state;
  }

  return { apply, reset, render, setState, snapshot, ensureHost };
}
