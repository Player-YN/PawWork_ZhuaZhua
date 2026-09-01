/**
 * Shared work-tab lock for design / sheet / docs / site.
 * Background owns lock on/off; Esc never unlocks. No WebGL.
 * Atmosphere: breathing rim + edge mist. No canvas, no traveling light.
 */
(function pawWorkLock() {
  const LOCK_HTML =
    '<div class="paw-work-lock-vignette"></div>' +
    '<div class="paw-work-lock-mist"></div>' +
    '<div class="paw-work-lock-frame"></div>';

  let root = null;
  let locked = false;

  function sessionIdFromPage() {
    try {
      return String(new URL(location.href).searchParams.get('sessionId') || '').trim();
    } catch {
      const m = String(location.href || '').match(/[?&]sessionId=([^&#]*)/);
      return m ? decodeURIComponent(m[1]).trim() : '';
    }
  }

  function chipLabel() {
    return /en/i.test(document.documentElement.lang || '') ? 'Orchestrating' : '编排中';
  }

  function ensureDom() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'pawWorkLock';
    root.className = 'paw-work-lock';
    root.setAttribute('aria-hidden', 'true');
    root.tabIndex = -1;
    root.innerHTML = `${LOCK_HTML}<span class="paw-work-lock-chip">${chipLabel()}</span>`;
    document.documentElement.appendChild(root);
    bindBlockers(root);
    return root;
  }

  function bindBlockers(el) {
    const eat = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    for (const type of [
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'contextmenu',
      'wheel',
      'touchstart'
    ]) {
      el.addEventListener(type, eat, true);
    }
  }

  function setLocked(next) {
    const want = !!next;
    ensureDom();
    if (want === locked) {
      if (want) root.focus({ preventScroll: true });
      return;
    }
    locked = want;
    root.classList.toggle('is-on', locked);
    root.setAttribute('aria-hidden', locked ? 'false' : 'true');
    if (locked) {
      root.focus({ preventScroll: true });
    }
  }

  function sameSession(msgSid) {
    const mine = sessionIdFromPage();
    const theirs = String(msgSid || '').trim();
    if (!mine || !theirs) return false;
    return mine === theirs;
  }

  function onMessage(msg) {
    if (msg?.action === 'paw_work_lock') {
      if (!sameSession(msg.sessionId)) return;
      setLocked(!!msg.locked);
      return;
    }
    if (msg?.action !== 'session_workspace_event') return;
    const ev = msg.event || {};
    if (!sameSession(ev.sessionId || msg.sessionId)) return;
    if (ev.type === 'execution-start') setLocked(true);
    if (ev.type === 'execution-end') setLocked(false);
  }

  function queryHost() {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const sessionId = sessionIdFromPage();
    if (!sessionId) return;
    chrome.runtime.sendMessage({ action: 'paw_work_lock_query', sessionId }, (res) => {
      void chrome.runtime.lastError;
      if (res?.locked && sameSession(res.sessionId || sessionId)) setLocked(true);
    });
  }

  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape') return;
      try {
        if (typeof window.__pawCloseOfficeHelp === 'function' && window.__pawCloseOfficeHelp()) {
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
      } catch {
        /* help popover optional */
      }
      if (!locked) return;
      ev.preventDefault();
      ev.stopPropagation();
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureDom();
      queryHost();
    });
  } else {
    ensureDom();
    queryHost();
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      onMessage(msg);
      return false;
    });
  }

})();
