/**
 * Hidden announcer + nextStatusCopy. The visible instrument is turnDisclosureUi.
 * Does not invent next steps. Does not paint a completed wall.
 */

import {
  applyExecutionStatus,
  createExecutionStatus,
  formatFoldLine,
  projectGlobalPhase,
  shouldShowGlobalStatusWall
} from './executionStatus.js';

export function nextStatusCopy(state, t) {
  if (state?.next?.source === 'task.nextAction' && state.next.text) {
    return { kind: 'task', text: state.next.text };
  }
  if (state?.phase === 'waiting_user') {
    return { kind: 'meta', text: t('botNextWaitingUser') };
  }
  if (state?.phase === 'awaiting_approval') {
    return { kind: 'meta', text: t('tdNextAwaitingApproval') };
  }
  if (state?.phase === 'waiting_timer') {
    return { kind: 'meta', text: t('tdNextWaitingTimer') };
  }
  if (state?.phase === 'running' || state?.phase === 'verifying') return { kind: 'meta', text: t('botNextWaiting') };
  return null;
}

/**
 * @param {{
 *   t: (key: string) => string,
 *   getLang: () => string,
 *   getHost: () => HTMLElement|null,
 *   getPolite?: () => HTMLElement|null,
 *   getAssertive?: () => HTMLElement|null,
 *   getSessionId: () => string,
 *   onStop?: () => void
 * }} deps
 */
export function createBotStatusUi(deps) {
  /** @type {ReturnType<typeof createExecutionStatus>} */
  let state = createExecutionStatus();
  let host = null;
  let lastPolite = '';
  let politeTimer = 0;

  function ensureHost() {
    const el = deps.getHost?.() || host;
    if (el) host = el;
    return host;
  }

  function politeEl() {
    return deps.getPolite?.() || null;
  }

  function assertiveEl() {
    return deps.getAssertive?.() || null;
  }

  function announcePolite(text) {
    const msg = String(text || '').trim();
    if (!msg || msg === lastPolite) return;
    if (state.approvalOpen || state.policyBlocked) return;
    lastPolite = msg;
    if (politeTimer) clearTimeout(politeTimer);
    politeTimer = setTimeout(() => {
      politeTimer = 0;
      const el = politeEl();
      if (el) el.textContent = msg;
    }, 600);
  }

  function announceAssertive(text) {
    const msg = String(text || '').trim();
    if (!msg) return;
    const el = assertiveEl();
    if (el) el.textContent = msg;
  }

  function announce(prev, ev) {
    const type = String(ev?.type || '');
    if (type === 'approval-required' || type === 'policy-blocked') {
      announceAssertive(state.current?.text || ev?.summary || '');
      return;
    }
    if (state.lease?.kind === 'conflict' && prev?.lease?.kind !== 'conflict') {
      announceAssertive(deps.t('botLeaseConflict')
        .replace('{title}', state.lease.title || 'tab')
        .replace('{name}', state.lease.holderSessionId || 'session'));
      return;
    }
    if (state.phase === 'failed' && prev?.phase !== 'failed') {
      announceAssertive(deps.t('tdFoldFailed'));
      return;
    }
    if (prev?.phase === state.phase) return;
    if (state.phase === 'waiting_user') announcePolite(deps.t('tdAnnounceWaitingUser'));
    if (state.phase === 'completed' || state.phase === 'stopped') {
      announcePolite(
        formatFoldLine(
          { phase: state.phase, durationMs: Math.max(0, (state.endedAt || 0) - (state.startedAt || 0)), artifactCount: state.artifactCount },
          deps.t
        )
      );
    }
  }

  function render() {
    const el = ensureHost();
    if (!el) return state;
    el.hidden = true;
    el.className = 'bot-status visually-hidden is-announcer';
    el.dataset.phase = projectGlobalPhase(state);
    el.replaceChildren();
    void shouldShowGlobalStatusWall(state);
    return state;
  }

  function apply(ev, ctx = {}) {
    const prev = state;
    state = applyExecutionStatus(state, ev, { lang: deps.getLang?.() || 'zh', ...ctx });
    render();
    announce(prev, ev);
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

  return { apply, reset, render, setState, snapshot, ensureHost, announce };
}
