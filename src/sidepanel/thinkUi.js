/**
 * Live thinking chrome. One accordion per user turn; send/stop must track
 * the visible 思考中 bar, not only the execution flag.
 */

function classHas(el, name) {
  return !!el?.classList?.contains?.(name);
}

function walkThink(el, liveOnly) {
  if (!el) return null;
  if (classHas(el, 'think-block') && (!liveOnly || classHas(el, 'is-live'))) return el;
  for (const child of el.children || []) {
    const hit = walkThink(child, liveOnly);
    if (hit) return hit;
  }
  return null;
}

function closestAgentTurn(el) {
  let cur = el;
  while (cur) {
    if (classHas(cur, 'agent-turn')) return cur;
    cur = cur.parentNode || cur.parentElement || null;
  }
  return null;
}

/**
 * Host for the current turn's think bar. Prefer the live bar, else the last
 * `.agent-turn` after the latest user bubble — never a second wrap.
 * @param {ParentNode|null|undefined} body
 * @param {Element|null|undefined} currentWrap
 */
function walkDisclosure(el) {
  if (!el) return null;
  if (classHas(el, 'turn-disclosure')) return el;
  for (const child of el.children || []) {
    const hit = walkDisclosure(child);
    if (hit) return hit;
  }
  return null;
}

export function resolveLiveThinkHost(body, currentWrap) {
  if (currentWrap && currentWrap.isConnected !== false) {
    return { wrap: currentWrap, think: walkThink(currentWrap, false) };
  }
  if (!body) return { wrap: null, think: null };
  const live = walkThink(body, true);
  if (live) return { wrap: closestAgentTurn(live), think: live };
  const kids = [...(body.children || [])];
  let lastUser = -1;
  for (let i = 0; i < kids.length; i += 1) {
    const el = kids[i];
    if (classHas(el, 'msg') && classHas(el, 'user')) lastUser = i;
  }
  const after = kids.slice(lastUser + 1).filter((el) => classHas(el, 'agent-turn'));
  const wrap = after[after.length - 1] || null;
  return { wrap, think: walkThink(wrap, false) };
}

/**
 * Same wrap rule as think. Do not retarget think host to disclosure.
 * One instrument per turn; reconnect must not stack a second card.
 */
export function resolveLiveDisclosureHost(body, currentWrap) {
  const host = resolveLiveThinkHost(body, currentWrap);
  const wrap = host.wrap;
  const disclosure =
    wrap && typeof wrap.querySelector === 'function'
      ? wrap.querySelector('.turn-disclosure') || walkDisclosure(wrap)
      : walkDisclosure(wrap);
  return { wrap, disclosure, think: host.think };
}

/** Keep "36S" / "2M 05S" when a fallback seal overwrites 思考中. */
export function durationFromThinkSummary(text) {
  const raw = String(text || '');
  const compact = raw.match(/(\d+)\s*M\s*(\d{1,2})\s*S/i);
  if (compact) return `${compact[1]}M ${String(compact[2]).padStart(2, '0')}S`;
  const sec = raw.match(/(\d+)\s*S/i);
  return sec ? `${sec[1]}S` : '';
}

export function composerShouldShowStop(running, thinkLive) {
  return !!(running || thinkLive);
}

export function isThinkToggleKey(key) {
  return key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'Space';
}

export function isThinkExpanded(block) {
  return !!block?.classList?.contains?.('is-expanded');
}

export function thinkBodyText(block) {
  if (!block) return '';
  const body = typeof block.querySelector === 'function' ? block.querySelector('.think-body') : null;
  return String(body?.textContent ?? block.bodyText ?? '');
}

export function applyThinkExpanded(block, expanded) {
  const on = !!expanded;
  if (!block) return false;
  block.classList?.toggle?.('is-expanded', on);
  block.classList?.toggle?.('is-collapsed', !on);
  const toggle = typeof block.querySelector === 'function' ? block.querySelector('.think-toggle') : block.toggle;
  if (toggle?.setAttribute) {
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!toggle.getAttribute?.('aria-label')) {
      toggle.setAttribute('aria-label', 'Expand or collapse thinking');
    }
  }
  const chev = typeof block.querySelector === 'function' ? block.querySelector('.think-chevron') : block.chevron;
  if (chev) chev.textContent = on ? '▾' : '▸';
  return on;
}

/** Collapse chrome only. Never clears `.think-body`. */
export function sealThinkKeepBody(block) {
  block?.classList?.remove?.('is-live');
  applyThinkExpanded(block, false);
  return thinkBodyText(block);
}

/**
 * Click + Enter/Space. Native `<button>` already fires click on those keys;
 * non-button fallbacks toggle from keydown.
 * @returns {boolean}
 */
export function shouldCreateThinkFromEvent(ev) {
  const type = String(ev?.type || '');
  if (type !== 'thought' && type !== 'thought-open') return false;
  const text = String(ev?.text ?? ev?.chunk ?? '').trim();
  return !!text && text !== '[object Object]';
}

export function bindThinkToggle(toggle, getExpanded, setExpanded, opts = {}) {
  if (!toggle) return false;
  if (opts.force && toggle.dataset) {
    delete toggle.dataset.thinkBound;
    delete toggle.dataset.historyBound;
  }
  if (toggle.dataset?.thinkBound) return false;
  if (toggle.dataset) toggle.dataset.thinkBound = '1';
  const fire = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setExpanded(!getExpanded());
  };
  toggle.addEventListener?.('click', fire);
  toggle.addEventListener?.('keydown', (e) => {
    if (!isThinkToggleKey(e?.key)) return;
    const tag = String(toggle.tagName || '').toUpperCase();
    const type = String(toggle.type || toggle.getAttribute?.('type') || '');
    if (tag === 'BUTTON' || type === 'button') return;
    fire(e);
  });
  return true;
}

/**
 * History / reconnect: drop stale listeners (clone) and bind again even if
 * `data-think-bound` was snapshotted into HTML.
 */
export function rehydrateThinkBlock(block, opts = {}) {
  if (!block) return false;
  let toggle = typeof block.querySelector === 'function' ? block.querySelector('.think-toggle') : block.toggle;
  if (!toggle) return false;
  if (typeof toggle.cloneNode === 'function' && typeof toggle.replaceWith === 'function') {
    const fresh = toggle.cloneNode(true);
    toggle.replaceWith(fresh);
    toggle = fresh;
  }
  if (toggle.dataset) {
    delete toggle.dataset.thinkBound;
    delete toggle.dataset.historyBound;
  }
  if (toggle.disabled != null) toggle.disabled = false;
  if (opts.ariaLabel && toggle.setAttribute) toggle.setAttribute('aria-label', opts.ariaLabel);
  let expanded = isThinkExpanded(block);
  bindThinkToggle(
    toggle,
    () => expanded,
    (next) => {
      expanded = next;
      applyThinkExpanded(block, next);
    },
    { force: true }
  );
  applyThinkExpanded(block, expanded);
  return true;
}
