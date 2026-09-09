/**
 * Office-canvas selection bubble: click copies the displayed ref.
 * Pin still happens via sheet_tab_state / html_tab_state; this UI is copy-only.
 */

const STYLE_ID = 'paw-office-sel-bubble-style';
const COPIED_MS = 1000;

const STYLE_TEXT = `
.paw-office-sel-bubble {
  position: fixed;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  max-width: 180px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--green, #059669) 22%, transparent);
  border-radius: var(--radius-xs, 6px);
  background: var(--green-soft, #ecfdf5);
  color: var(--green, #059669);
  font: 700 11px/1 system-ui, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(28, 25, 23, 0.08);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: auto;
  user-select: none;
}
.paw-office-sel-bubble[hidden] { display: none !important; }
.paw-office-sel-bubble[data-kind="canvas"] {
  border-color: color-mix(in srgb, var(--blue, #7c3aed) 22%, transparent);
  background: var(--blue-soft, #f5f3ff);
  color: var(--blue, #7c3aed);
}
.paw-office-sel-bubble.is-copied,
.paw-office-sel-bubble[data-kind="canvas"].is-copied {
  border-color: color-mix(in srgb, var(--green, #059669) 40%, transparent);
  background: var(--green-soft, #ecfdf5);
  color: var(--green, #059669);
}
.paw-office-sel-bubble:hover { filter: brightness(0.98); }
@media (prefers-reduced-motion: reduce) {
  .paw-office-sel-bubble { transition: none; }
}
`;

export function copyTextToClipboard(text) {
  const body = String(text || '');
  if (!body) return Promise.reject(new Error('empty'));
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(body).catch(() => copyViaExecCommand(body));
  }
  return copyViaExecCommand(body);
}

function copyViaExecCommand(body) {
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = body;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID;
  st.textContent = STYLE_TEXT;
  (doc.head || doc.documentElement).appendChild(st);
}

function placeBubble(el, rect) {
  const gap = 6;
  const w = el.offsetWidth || 48;
  const h = el.offsetHeight || 24;
  const vw = window.innerWidth || 400;
  const vh = window.innerHeight || 300;
  let top = 12;
  let left = 12;
  if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
    const width = Number(rect.width) || 0;
    const height = Number(rect.height) || 0;
    top = rect.top - h - gap;
    left = rect.left;
    if (top < 8) top = rect.top + height + gap;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    if (width >= 0 && left < 8) left = 8;
  }
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
}

/**
 * @param {ParentNode} host
 * @param {{ kind?: 'sheet'|'canvas', copiedLabel?: string }} [opts]
 */
export function mountOfficeSelBubble(host, opts = {}) {
  const root = host && host.nodeType ? host : typeof document !== 'undefined' ? document.body : null;
  const doc = root?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc || !root) {
    return { show() {}, hide() {}, el: null };
  }
  ensureStyle(doc);
  let el = doc.getElementById('pawOfficeSelBubble');
  if (!el) {
    el = doc.createElement('button');
    el.id = 'pawOfficeSelBubble';
    el.type = 'button';
    el.className = 'paw-office-sel-bubble';
    el.hidden = true;
    (doc.body || root).appendChild(el);
  }
  const kind = opts.kind === 'canvas' ? 'canvas' : 'sheet';
  const copiedLabel = String(opts.copiedLabel || '已复制');
  el.dataset.kind = kind;
  el.setAttribute('aria-label', copiedLabel === 'Copied' ? 'Copy reference' : '复制引用');

  if (!el._pawCopyBound) {
    el._pawCopyBound = true;
    el.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = String(el.dataset.label || '').trim();
      if (!text) return;
      copyTextToClipboard(text)
        .then(() => {
          el.dataset.copied = '1';
          el.classList.add('is-copied');
          el.textContent = copiedLabel;
          clearTimeout(el._copiedTimer);
          el._copiedTimer = setTimeout(() => {
            el.dataset.copied = '';
            el.classList.remove('is-copied');
            el.textContent = el.dataset.label || '';
          }, COPIED_MS);
        })
        .catch(() => {});
    });
  }

  return {
    el,
    hide() {
      el.hidden = true;
      el.textContent = '';
      el.dataset.label = '';
      el.dataset.copied = '';
      el.classList.remove('is-copied');
      clearTimeout(el._copiedTimer);
    },
    /**
     * @param {string} label
     * @param {{ left?: number, top?: number, width?: number, height?: number, x?: number, y?: number, w?: number, h?: number }|null} [anchor]
     */
    show(label, anchor) {
      const next = String(label || '').replace(/\s+/g, ' ').trim();
      if (!next) {
        this.hide();
        return;
      }
      const rect = normalizeRect(anchor);
      el.hidden = false;
      el.dataset.label = next;
      if (el.dataset.copied !== '1') el.textContent = next;
      placeBubble(el, rect);
    }
  };
}

function normalizeRect(anchor) {
  if (!anchor || typeof anchor !== 'object') return null;
  const left = Number(anchor.left ?? anchor.x);
  const top = Number(anchor.top ?? anchor.y);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const width = Number(anchor.width ?? anchor.w) || 0;
  const height = Number(anchor.height ?? anchor.h) || 0;
  return { left, top, width, height };
}

export function officeSelCopyLabel(sel, fallback = '') {
  if (sel == null) return String(fallback || '').trim();
  if (typeof sel === 'string') return sel.trim();
  const a1 = String(sel.a1 || sel.range || '').trim();
  if (a1) return a1;
  const text = String(sel.text || sel.label || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 18);
  return String(sel.nodeId || sel.slotId || sel.tag || fallback || '').trim();
}
