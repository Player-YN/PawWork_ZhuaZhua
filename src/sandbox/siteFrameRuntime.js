/**
 * Site guest frame protocol. Runs in a manifest sandbox page (unique origin,
 * no chrome.*, no extension-origin same-origin). Parent talks via postMessage.
 * Guest HTML is static HTML+CSS after host sanitize — no user scripts.
 */

export const SITE_FRAME_CHANNEL = 'paw-site-frame';
export const SITE_FRAME_SANDBOX = 'allow-scripts';
export const SITE_FRAME_PAGE = 'src/sandbox/siteFrame.html';

export function isSiteFrameEnvelope(data) {
  return !!(data && typeof data === 'object' && data.channel === SITE_FRAME_CHANNEL);
}

export function isTrustedSiteChildEvent(ev, frameWindow) {
  return !!(ev && frameWindow && ev.source === frameWindow && isSiteFrameEnvelope(ev.data));
}

export function isTrustedSiteParentEvent(ev, parentWindow) {
  return !!(ev && parentWindow && ev.source === parentWindow && isSiteFrameEnvelope(ev.data));
}

function guestRoot(document) {
  return (typeof document?.getElementById === 'function' && document.getElementById('guest')) || document?.body || null;
}

function stripScriptsIn(el) {
  if (!el?.querySelectorAll) return;
  for (const s of [...el.querySelectorAll('script')]) s.remove();
}

export function createSiteFrameRuntime({ document, parentWindow, postToParent } = {}) {
  function post(msg) {
    if (typeof postToParent === 'function') postToParent({ channel: SITE_FRAME_CHANNEL, ...msg });
  }

  function render(html) {
    const root = guestRoot(document);
    if (!root) return false;
    const src = String(html || '');
    if (typeof document.implementation?.createHTMLDocument === 'function' && typeof document.createElement === 'function') {
      const wrap = document.createElement('div');
      wrap.innerHTML = src;
      stripScriptsIn(wrap);
      if (typeof root.replaceChildren === 'function') root.replaceChildren(...(wrap.childNodes || []));
      else {
        root.innerHTML = '';
        while (wrap.firstChild) root.appendChild(wrap.firstChild);
      }
      return true;
    }
    if (root.innerHTML != null) {
      root.innerHTML = src.replace(/<script\b[\s\S]*?<\/script>/gi, '');
      return true;
    }
    return false;
  }

  function serialize() {
    const root = guestRoot(document);
    const inner = root?.innerHTML != null ? String(root.innerHTML) : '';
    return `<!DOCTYPE html>\n<html><body>${inner}</body></html>`;
  }

  function applyPick(d) {
    const root = guestRoot(document);
    if (!root || typeof root.querySelectorAll !== 'function') return;
    let st = typeof document.getElementById === 'function' ? document.getElementById('paw-site-pick') : null;
    if (!st && document.createElement && (document.head || document.documentElement)) {
      st = document.createElement('style');
      st.id = 'paw-site-pick';
      (document.head || document.documentElement).appendChild(st);
    }
    if (st) {
      st.textContent = d.pickActive
        ? '[data-paw-node].paw-picked{outline:2px solid #0d99ff;outline-offset:2px;} [data-paw-node]{cursor:pointer;}'
        : '[data-paw-node].paw-picked{outline:2px solid #0d99ff;outline-offset:2px;}';
    }
    for (const el of root.querySelectorAll('.paw-picked')) el.classList.remove('paw-picked');
    for (const id of d.selectedIds || []) {
      try {
        const hit = root.querySelector(`[data-paw-node="${CSS.escape(String(id))}"]`);
        if (hit) hit.classList.add('paw-picked');
      } catch {
        /* ignore */
      }
    }
  }

  function applyNudge(d) {
    const root = guestRoot(document);
    if (!root) return;
    for (const id of d.ids || []) {
      try {
        const hit = root.querySelector(`[data-paw-node="${CSS.escape(String(id))}"]`);
        if (!hit) continue;
        const t = hit.style?.transform || '';
        const m = /translate\(\s*([-0-9.]+)px\s*,\s*([-0-9.]+)px\s*\)/.exec(t);
        const x = (m ? Number(m[1]) : 0) + (d.dx || 0);
        const y = (m ? Number(m[2]) : 0) + (d.dy || 0);
        if (hit.style) hit.style.transform = `translate(${x}px, ${y}px)`;
      } catch {
        /* isolate */
      }
    }
  }

  function collectRects(ids) {
    const root = guestRoot(document);
    const rects = {};
    if (!root) return rects;
    for (const id of ids || []) {
      try {
        const hit = root.querySelector(`[data-paw-node="${CSS.escape(String(id))}"]`);
        const r = hit?.getBoundingClientRect?.();
        if (r) rects[id] = { left: r.left, top: r.top, width: r.width, height: r.height };
      } catch {
        /* isolate */
      }
    }
    return rects;
  }

  function handleParent(ev) {
    if (!isTrustedSiteParentEvent(ev, parentWindow)) return false;
    const d = ev.data || {};
    if (d.op === 'render') {
      render(d.html);
      post({ type: 'rendered', req: d.req });
      return true;
    }
    if (d.op === 'set-pick') {
      applyPick(d);
      return true;
    }
    if (d.op === 'nudge') {
      applyNudge(d);
      return true;
    }
    if (d.op === 'rects') {
      post({ type: 'rects', rects: collectRects(d.ids), req: d.req });
      return true;
    }
    if (d.op === 'serialize') {
      post({ type: 'serialized', html: serialize(), req: d.req });
      return true;
    }
    return false;
  }

  function onGuestClick(e) {
    const el = e?.target?.closest ? e.target.closest('[data-paw-node]') : null;
    post({
      type: 'click',
      nodeId: el ? el.getAttribute('data-paw-node') || '' : '',
      ctrlKey: !!e?.ctrlKey,
      metaKey: !!e?.metaKey,
      shiftKey: !!e?.shiftKey
    });
  }

  function announceReady() {
    post({ type: 'ready' });
  }

  return { handleParent, onGuestClick, render, serialize, announceReady, post };
}
