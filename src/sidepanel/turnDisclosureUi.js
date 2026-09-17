/**
 * Turn-local host instrument. Lives under the think block of one assistant
 * turn. Never invents thought chrome. Never writes Runtime / next.
 */

import { nextStatusCopy } from './botStatusUi.js';
import {
  PULSE_COMPLETE_MS,
  TURN_MEMORY_CAP,
  compactStatusTask,
  disclosureMode,
  foldStubFromState,
  formatDisclosureDuration,
  rememberEndedProjection,
  shouldShowDurableTaskCard,
  visibleSummaryRows
} from './executionStatus.js';

const HYDRATED_DOM_CAP = 3;

function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content != null) el.textContent = String(content);
  return el;
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

function kindWord(kind, t) {
  const key = `botKind_${kind}`;
  const label = t(key);
  return label === key ? kind : label;
}

export function prefersReducedMotion(matchMediaFn) {
  const mm = matchMediaFn || (typeof matchMedia === 'function' ? matchMedia : null);
  try {
    return mm?.('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

export function exclusiveHistoricalOpen(root, opened) {
  if (!root || !opened) return 0;
  const list =
    typeof root.querySelectorAll === 'function'
      ? [...root.querySelectorAll('.turn-disclosure.is-folded')]
      : [];
  let closed = 0;
  for (const el of list) {
    if (el === opened) continue;
    if (el.open === true || el.classList?.contains?.('is-open')) {
      if ('open' in el) el.open = false;
      el.classList?.remove?.('is-open');
      unloadDisclosureBody(el);
      closed += 1;
    }
  }
  return closed;
}

export function unloadDisclosureBody(el) {
  const body = typeof el?.querySelector === 'function' ? el.querySelector('.turn-disclosure-body') : null;
  body?.replaceChildren?.();
  if (el?.dataset) el.dataset.hydrated = '0';
}

export function insertTurnDisclosure(wrap, el) {
  if (!wrap || !el) return el;
  const think = wrap.querySelector?.(':scope > .think-block');
  const interrupt = wrap.querySelector?.(':scope > .approval-live, :scope > .clarify-live');
  const answer = wrap.querySelector?.(':scope > .msg');
  if (think) wrap.insertBefore(el, think.nextSibling);
  else if (interrupt) wrap.insertBefore(el, interrupt);
  else if (answer) wrap.insertBefore(el, answer);
  else wrap.appendChild(el);
  return el;
}

export function placeInterruptAfterDisclosure(wrap, el) {
  if (!wrap || !el) return el;
  const disclosure = wrap.querySelector?.(':scope > .turn-disclosure');
  const answer = wrap.querySelector?.(':scope > .msg.assistant, :scope > .msg');
  if (disclosure) wrap.insertBefore(el, disclosure.nextSibling);
  else if (answer) wrap.insertBefore(el, answer);
  else wrap.appendChild(el);
  return el;
}

function fillRows(list, rows, t) {
  list.replaceChildren();
  for (const row of rows) {
    const li = node('li', 'turn-disclosure-row');
    li.dataset.status = row.status || '';
    li.append(
      node('span', 'turn-disclosure-row-mark', statusWord(row.status, t)),
      node(
        'span',
        'turn-disclosure-row-text',
        [kindWord(row.kind, t), row.label, row.object].filter(Boolean).join(' · ')
      )
    );
    list.append(li);
  }
}

/**
 * @param {{
 *   t: (key: string) => string,
 *   getLang?: () => string,
 *   prefersReducedMotion?: () => boolean,
 *   getNow?: () => number
 * }} deps
 */
export function createTurnDisclosureUi(deps) {
  const full = new Map();
  const stubs = new Map();
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const pulseTimers = new Map();
  const holdOpen = new Set();
  let lastPolite = '';
  let politeTimer = 0;

  function t(key) {
    return deps.t(key);
  }

  function reduced() {
    return deps.prefersReducedMotion ? deps.prefersReducedMotion() : prefersReducedMotion();
  }

  function now() {
    return typeof deps.getNow === 'function' ? deps.getNow() : Date.now();
  }

  function disclosureOf(wrap) {
    return wrap?.querySelector?.(':scope > .turn-disclosure') || null;
  }

  function remember(state, extra = {}) {
    const id = String(state?.executionId || extra.executionId || '');
    if (!id) return;
    const stub = foldStubFromState(state, t, extra);
    rememberEndedProjection(full, stubs, id, {
      ...stub,
      summary: Array.isArray(state.summary) ? state.summary.slice() : [],
      phase: state.phase
    });
  }

  function evictHydratedDom(root) {
    const live = root?.querySelectorAll?.('.turn-disclosure.is-live, .turn-disclosure.is-sticky') || [];
    const hydrated = [...(root?.querySelectorAll?.('.turn-disclosure[data-hydrated="1"]') || [])];
    const extras = hydrated.filter((el) => !el.classList.contains('is-live') && !el.classList.contains('is-sticky'));
    const keep = Math.max(0, HYDRATED_DOM_CAP - live.length);
    while (extras.length > keep) {
      const el = extras.shift();
      if (el.open) continue;
      unloadDisclosureBody(el);
    }
  }

  function ensure(wrap, { executionId } = {}) {
    if (!wrap) return null;
    let el = disclosureOf(wrap);
    if (el) {
      if (executionId) el.dataset.executionId = String(executionId);
      return el;
    }
    el = node('section', 'turn-disclosure is-live');
    el.dataset.mode = 'live';
    if (executionId) el.dataset.executionId = String(executionId);
    insertTurnDisclosure(wrap, el);
    return el;
  }

  function paintMeta(el, state, accessPolicy) {
    const ul = node('ul', 'turn-disclosure-meta');
    ul.setAttribute('role', 'list');
    const page = state.targetPage;
    if (page && (page.title || page.url)) {
      const li = node('li', '', page.title || safeUrl(page.url));
      li.dataset.k = 'page';
      ul.append(li);
    }
    if (state.lease?.kind === 'conflict') {
      const li = node('li', 'is-conflict', t('botLeaseConflict')
        .replace('{title}', state.lease.title || `#${state.lease.tabId || 'tab'}`)
        .replace('{name}', state.lease.holderSessionId || 'session'));
      li.dataset.k = 'lease';
      ul.append(li);
    } else if (state.lease?.kind === 'owned' && (state.phase === 'running' || state.phase === 'waiting_user')) {
      const li = node('li', '', t('botLeaseOwned'));
      li.dataset.k = 'lease';
      ul.append(li);
    }
    const task = compactStatusTask(state.task);
    if (shouldShowDurableTaskCard(task)) {
      const bits = [t(`durableTaskStatus_${task.status}`)];
      if (task.dueAt) bits.push(task.dueAt);
      const li = node('li', '', bits.filter(Boolean).join(' · '));
      li.dataset.k = 'task';
      ul.append(li);
    }
    const mode = accessPolicy?.mode === 'full' ? 'full' : accessPolicy?.mode === 'guarded' ? 'guarded' : '';
    if (mode) {
      const li = node('li', '', mode === 'full' ? t('accessChipFull') : t('accessChipGuarded'));
      li.dataset.k = 'access';
      li.setAttribute('aria-hidden', 'true');
      ul.append(li);
    }
    const existing = el.querySelector('.turn-disclosure-meta');
    if (existing) existing.replaceWith(ul);
    else el.append(ul);
  }

  function paintLive(el, state, { mode, accessPolicy } = {}) {
    const id = String(state.executionId || el.dataset.executionId || 'live');
    el.dataset.executionId = id;
    el.dataset.mode = mode;
    el.className = `turn-disclosure is-${mode === 'sticky' ? 'sticky' : 'live'}`;
    if (el.tagName === 'DETAILS') {
      const section = node('section', el.className);
      section.dataset.executionId = id;
      section.dataset.mode = mode;
      el.replaceWith(section);
      el = section;
    }
    const labelId = `td-${id}-label`;
    el.setAttribute('aria-labelledby', labelId);
    const currentText =
      state.current?.text ||
      (state.phase === 'waiting_timer' ? t('botPhase_waiting_timer') : t('botCurrentNone'));
    let head = el.querySelector('.turn-disclosure-head');
    if (!head) {
      head = node('div', 'turn-disclosure-head');
      el.prepend(head);
    }
    head.replaceChildren();
    const current = node('span', 'turn-disclosure-current', currentText);
    current.id = labelId;
    head.append(current);

    const nextCopy = nextStatusCopy(state, t);
    let nextEl = el.querySelector('.turn-disclosure-next');
    if (nextCopy) {
      if (!nextEl) nextEl = node('p', 'turn-disclosure-next');
      nextEl.textContent = nextCopy.text;
      nextEl.className = `turn-disclosure-next${nextCopy.kind === 'meta' ? ' is-meta' : ''}`;
      if (!nextEl.parentNode) head.after(nextEl);
    } else {
      nextEl?.remove();
    }
    paintMeta(el, state, accessPolicy);
    let list = el.querySelector('.turn-disclosure-rows');
    if (!list) {
      list = node('ol', 'turn-disclosure-rows');
      list.setAttribute('role', 'list');
      el.append(list);
    }
    const rows = visibleSummaryRows(state.summary, 8);
    fillRows(list, rows, t);
    return el;
  }

  function fold(wrap, state, extra = {}) {
    const stub = extra.stub || foldStubFromState(state, t, extra);
    let el = disclosureOf(wrap);
    const details = node('details', 'turn-disclosure is-folded');
    details.dataset.mode = 'folded';
    details.dataset.executionId = stub.executionId || state?.executionId || '';
    if (stub.messageId) details.dataset.messageId = stub.messageId;
    details.setAttribute('name', 'turn-disclosure');
    const summary = node('summary', 'turn-disclosure-line', stub.line);
    summary.setAttribute('aria-label', t('tdExpandAria'));
    const body = node('div', 'turn-disclosure-body');
    details.append(summary, body);
    if (el) el.replaceWith(details);
    else insertTurnDisclosure(wrap, details);
    bindDetails(details, wrap);
    remember(state, { ...extra, ...stub });
    return details;
  }

  function hydrate(el, state) {
    if (!el) return false;
    const body = el.querySelector('.turn-disclosure-body') || el;
    const rows = visibleSummaryRows(state?.summary, 8);
    const list = node('ol', 'turn-disclosure-rows');
    list.setAttribute('role', 'list');
    if (!rows.length) {
      body.replaceChildren(node('p', 'turn-disclosure-empty', t('tdNoSummary')));
    } else {
      fillRows(list, rows, t);
      body.replaceChildren(list);
    }
    el.dataset.hydrated = '1';
    return true;
  }

  function bindDetails(el, root) {
    if (!el || el.dataset.tdBound === '1') return el;
    el.dataset.tdBound = '1';
    el.addEventListener('toggle', () => {
      if (el.classList.contains('is-live') || el.classList.contains('is-sticky')) return;
      if (el.open) {
        exclusiveHistoricalOpen(root || el.parentNode, el);
        const id = el.dataset.executionId || '';
        const slice = full.get(id);
        if (slice) hydrate(el, slice);
        else if (el.dataset.hydrated !== '1') {
          const body = el.querySelector('.turn-disclosure-body');
          body?.replaceChildren(node('p', 'turn-disclosure-empty', t('tdNoSummary')));
        }
        evictHydratedDom(root || el.closest?.('.task-body') || el.parentNode);
      } else {
        unloadDisclosureBody(el);
      }
    });
    return el;
  }

  function rebind(root) {
    if (!root) return 0;
    let n = 0;
    root.querySelectorAll?.('.turn-disclosure.is-folded').forEach((el) => {
      if (el.dataset) delete el.dataset.tdBound;
      bindDetails(el, root);
      n += 1;
    });
    return n;
  }

  function dehydrate(root) {
    root?.querySelectorAll?.('.turn-disclosure').forEach((el) => {
      unloadDisclosureBody(el);
      el.classList.remove('is-live', 'is-sticky', 'is-pulse');
      if (!el.classList.contains('is-folded')) el.classList.add('is-folded');
      if ('open' in el) el.open = false;
    });
  }

  function cancelPulse(id) {
    const key = String(id || '');
    const timer = pulseTimers.get(key);
    if (timer) clearTimeout(timer);
    pulseTimers.delete(key);
  }

  function scheduleFold(wrap, state, extra = {}) {
    const id = String(state?.executionId || extra.executionId || '');
    cancelPulse(id);
    if (disclosureMode(state) === 'sticky') {
      ensure(wrap, { executionId: id });
      return paintLive(disclosureOf(wrap), state, { mode: 'sticky', accessPolicy: extra.accessPolicy });
    }
    if (holdOpen.has(id) || extra.keepOpen) {
      const el = fold(wrap, state, extra);
      el.open = true;
      hydrate(el, state);
      return el;
    }
    if (reduced() || extra.immediate) return fold(wrap, state, extra);
    const el = ensure(wrap, { executionId: id });
    paintLive(el, state, { mode: 'live', accessPolicy: extra.accessPolicy });
    el.classList.add('is-pulse');
    el.dataset.mode = 'pulse_complete';
    const onInteract = () => {
      holdOpen.add(id);
      cancelPulse(id);
      const open = fold(wrap, state, extra);
      open.open = true;
      hydrate(open, state);
    };
    el.addEventListener('click', onInteract, { once: true });
    pulseTimers.set(
      id,
      setTimeout(() => {
        pulseTimers.delete(id);
        if (holdOpen.has(id)) return;
        fold(wrap, state, extra);
      }, extra.pulseMs ?? PULSE_COMPLETE_MS)
    );
    return el;
  }

  function paint(wrap, state, extra = {}) {
    if (!wrap) return null;
    const mode = extra.mode || disclosureMode(state);
    if (mode === 'hidden') {
      disclosureOf(wrap)?.remove();
      return null;
    }
    if (mode === 'folded') {
      if (extra.justSettled) return scheduleFold(wrap, state, extra);
      return fold(wrap, state, extra);
    }
    if (mode === 'pulse_complete') return scheduleFold(wrap, state, extra);
    const el = ensure(wrap, { executionId: state.executionId });
    return paintLive(el, state, { mode, accessPolicy: extra.accessPolicy });
  }

  function foldPreviousPulse(root) {
    root?.querySelectorAll?.('.turn-disclosure[data-mode="pulse_complete"]').forEach((el) => {
      const id = el.dataset.executionId || '';
      cancelPulse(id);
      el.classList.remove('is-pulse');
      const slice = full.get(id);
      const wrap = el.parentNode;
      if (wrap) {
        fold(wrap, slice || { executionId: id, phase: 'completed', startedAt: 0, endedAt: now() }, slice || {});
      }
    });
  }

  function exportMemory() {
    return {
      full: [...full.entries()],
      stubs: [...stubs.entries()]
    };
  }

  function importMemory(snap) {
    full.clear();
    stubs.clear();
    for (const [id, row] of snap?.full || []) full.set(id, row);
    for (const [id, row] of snap?.stubs || []) stubs.set(id, row);
    while (full.size > TURN_MEMORY_CAP) {
      const drop = full.keys().next().value;
      full.delete(drop);
      const stub = stubs.get(drop);
      if (stub) stub.hydrated = false;
    }
  }

  return {
    ensure,
    paint,
    fold,
    hydrate,
    bindDetails,
    rebind,
    dehydrate,
    remember,
    scheduleFold,
    foldPreviousPulse,
    exclusiveOpen: exclusiveHistoricalOpen,
    placeInterrupt: placeInterruptAfterDisclosure,
    exportMemory,
    importMemory,
    memoryFull: () => full,
    memoryStubs: () => stubs,
    formatDisclosureDuration
  };
}
