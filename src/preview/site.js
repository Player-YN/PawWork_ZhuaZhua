/**
 * Website host: render session HTML as a page (iframe-as-browser).
 * Click pins data-paw-node via html_tab_state. SoT is the HTML artifact.
 */
import {
  stampSiteHtml,
  listSiteNodes,
  nextSitePinIds,
  siteSelectionsFromIds,
  formatSiteSelLabel,
  applySiteCommands
} from '../agent/vnext/sessionWorkspace/siteApply.js';
import { sanitizeSiteHtml } from '../agent/vnext/sessionWorkspace/siteSanitize.js';
import { installOfficeShortcuts, isTypingTarget, stepZoom } from './officeShortcuts.js';
import { closeOfficeHelp, mountOfficeHelp } from './officeHelp.js';
import { handleWorkTabPickerMessage, reportPickerState } from './workTabPicker.js';
import { mountOfficeSelBubble, officeSelCopyLabel } from './officeSelBubble.js';
import { mountSiteMotion, unmountSiteMotion, stripSiteMotionChrome } from './siteMotion.js';

function qs(name) {
  try {
    return new URL(location.href).searchParams.get(name) || '';
  } catch {
    return '';
  }
}

function hasChrome() {
  return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
}

async function workspaceRpc(method, params = {}) {
  if (!hasChrome()) throw new Error('not in extension');
  const response = await chrome.runtime.sendMessage({
    target: 'pawwork-background',
    action: 'workspace_rpc',
    method,
    params
  });
  if (!response?.ok) {
    throw new Error(response?.error?.message || response?.error || 'workspace RPC failed');
  }
  return response.result;
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg || '';
}

function setSel(msg) {
  const el = document.getElementById('sel');
  if (el) el.textContent = msg || '';
}

function stripScripts(html) {
  return sanitizeSiteHtml(html);
}

const sessionId = qs('sessionId');
const artifactId = qs('artifactId') || (qs('ids') || '').split(',')[0] || '';

let lastHtml = '';
let selectedIds = [];
let fileName = 'site.html';
let ignorePatchUntil = 0;
let canUndo = false;
let siteZoom = 1;
let siteKeys = null;
let frameKeysUnbind = null;
let nudgeTimer = 0;
let pickActive = false;
let motionHandle = null;
/** @type {ReturnType<typeof mountOfficeSelBubble>|null} */
let selBubble = null;

function pageFrame() {
  return document.getElementById('page');
}

function pageDoc() {
  try {
    return pageFrame()?.contentDocument || null;
  } catch {
    return null;
  }
}

function liveNodeIds() {
  const doc = pageDoc();
  if (doc) {
    return [...doc.querySelectorAll('[data-paw-node]')]
      .map((el) => el.getAttribute('data-paw-node') || '')
      .filter(Boolean);
  }
  return listSiteNodes(lastHtml).map((n) => n.nodeId);
}

function prunePins() {
  const live = new Set(liveNodeIds());
  selectedIds = selectedIds.filter((id) => live.has(id));
}

function siteSelAnchorRect(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return null;
  const doc = pageDoc();
  let hit = null;
  try {
    hit = doc?.querySelector(`[data-paw-node="${CSS.escape(id)}"]`) || null;
  } catch {
    hit = null;
  }
  const inner = hit?.getBoundingClientRect?.();
  const frame = pageFrame()?.getBoundingClientRect?.();
  if (!inner || !frame) return inner || null;
  return {
    left: frame.left + inner.left,
    top: frame.top + inner.top,
    width: inner.width,
    height: inner.height
  };
}

function paintOfficeSelBubble() {
  if (!selBubble) return;
  const id = selectedIds[selectedIds.length - 1] || '';
  const selections = siteSelectionsFromIds(lastHtml, id ? [id] : []);
  const label = officeSelCopyLabel(selections[0], formatSiteSelLabel(selections));
  if (!label) {
    selBubble.hide();
    return;
  }
  selBubble.show(label, siteSelAnchorRect(id));
}

function reportState() {
  prunePins();
  const nodes = listSiteNodes(lastHtml);
  const selections = siteSelectionsFromIds(lastHtml, selectedIds);
  paintOfficeSelBubble();
  if (!hasChrome() || !sessionId || !artifactId) {
    setSel(formatSiteSelLabel(selections));
    return;
  }
  chrome.runtime
    .sendMessage({
      action: 'html_tab_state',
      sessionId,
      artifactId,
      kind: 'site',
      overview: {
        kind: 'site',
        name: fileName,
        nodeCount: nodes.length,
        selections
      },
      selections
    })
    .catch(() => {});
  setSel(formatSiteSelLabel(selections));
}

function paintPick() {
  const doc = pageDoc();
  if (!doc) return;
  for (const el of doc.querySelectorAll('.paw-picked')) el.classList.remove('paw-picked');
  for (const id of selectedIds) {
    try {
      const hit = doc.querySelector(`[data-paw-node="${CSS.escape(id)}"]`);
      if (hit) hit.classList.add('paw-picked');
    } catch {
      /* ignore */
    }
  }
}

function bindPageClicks() {
  const doc = pageDoc();
  if (!doc) return;
  if (!doc.getElementById('paw-site-pick')) {
    const st = doc.createElement('style');
    st.id = 'paw-site-pick';
    st.textContent = pickStyleText();
    (doc.head || doc.documentElement).appendChild(st);
  }
  if (doc.__pawSiteBound) return;
  doc.__pawSiteBound = true;
  doc.addEventListener(
    'click',
    (e) => {
      if (!pickActive) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target && e.target.closest ? e.target.closest('[data-paw-node]') : null;
      const clickedId = el ? el.getAttribute('data-paw-node') || '' : '';
      selectedIds = nextSitePinIds(
        selectedIds,
        clickedId,
        { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey },
        liveNodeIds()
      );
      paintPick();
      reportState();
      if (selectedIds.length) setStatus('已点选 · 在侧栏描述要改的内容');
    },
    true
  );
  doc.addEventListener(
    'submit',
    (e) => {
      if (pickActive) e.preventDefault();
    },
    true
  );
}

function pickStyleText() {
  return pickActive
    ? '[data-paw-node].paw-picked{outline:2px solid #0d99ff;outline-offset:2px;} [data-paw-node]{cursor:pointer;}'
    : '[data-paw-node].paw-picked{outline:2px solid #0d99ff;outline-offset:2px;}';
}

function setPickActive(on) {
  pickActive = !!on;
  document.body.dataset.pawPick = pickActive ? '1' : '';
  const doc = pageDoc();
  const st = doc?.getElementById('paw-site-pick');
  if (st) st.textContent = pickStyleText();
  setStatus(pickActive ? '伸爪中 · 点击以点选' : '浏览中 · 链接可跳转');
  reportPickerState(pickActive);
}

function applySiteZoom(next) {
  siteZoom = Math.max(0.25, Math.min(4, Number(next) || 1));
  const frame = pageFrame();
  if (frame) frame.style.zoom = String(siteZoom);
  paintOfficeSelBubble();
}

function serializeLiveHtml() {
  const doc = pageDoc();
  if (!doc?.documentElement) return lastHtml;
  teardownMotion(doc);
  stripSiteMotionChrome(doc);
  const style = doc.getElementById('paw-site-pick');
  style?.remove();
  for (const el of doc.querySelectorAll('.paw-picked')) el.classList.remove('paw-picked');
  const html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
  bindPageClicks();
  paintPick();
  bootMotion(doc);
  return html;
}

function parseTranslate(transform) {
  const m = /translate\(\s*([-0-9.]+)px\s*,\s*([-0-9.]+)px\s*\)/.exec(String(transform || ''));
  return m ? { x: Number(m[1]) || 0, y: Number(m[2]) || 0 } : { x: 0, y: 0 };
}

function applySiteCommandsLocal(commands) {
  const out = applySiteCommands(lastHtml, commands, { selections: selectedIds.map((nodeId) => ({ nodeId })) });
  if (out.ok === false) {
    setStatus(out.error || '需要先点选节点');
    return false;
  }
  lastHtml = out.html;
  selectedIds = Array.isArray(out.selected) ? out.selected.slice() : [];
  if (Array.isArray(out.nodeIds) && out.nodeIds.length && commands.some((c) => c.op === 'duplicate')) {
    selectedIds = out.nodeIds.slice();
  }
  void rewriteForPreview(lastHtml).then((painted) => {
    renderHtml(lastHtml, painted);
  });
  void persistNow();
  return true;
}

function setUndoChrome() {
  const btn = document.getElementById('undoBtn');
  if (btn) btn.hidden = !canUndo;
}

async function rewriteForPreview(html) {
  const src = String(html || '');
  if (!sessionId || !/\/artifacts\//i.test(src)) return src;
  try {
    const out = await workspaceRpc('rewriteGuestMedia', { sessionId, html: src });
    return out?.html || src;
  } catch {
    return src;
  }
}

function renderHtml(sotHtml, previewHtml) {
  const frame = pageFrame();
  if (!frame) return;
  lastHtml = String(sotHtml || '');
  frame.hidden = false;
  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
  document.body.classList.add('is-ready');
  teardownMotion(pageDoc());
  frame.onload = () => {
    bindPageClicks();
    paintPick();
    reportState();
    if (frameKeysUnbind) frameKeysUnbind();
    const doc = pageDoc();
    if (doc && siteKeys) frameKeysUnbind = siteKeys.bindDocument(doc);
    applySiteZoom(siteZoom);
    bootMotion(doc);
  };
  frame.srcdoc = stripScripts(previewHtml != null ? previewHtml : lastHtml);
}

function teardownMotion(doc) {
  if (motionHandle) {
    try {
      motionHandle.destroy();
    } catch {
      /* isolate */
    }
    motionHandle = null;
  }
  if (doc) unmountSiteMotion(doc);
}

function bootMotion(doc) {
  if (!doc) return;
  try {
    motionHandle = mountSiteMotion(doc, { pickActive: () => pickActive });
  } catch {
    motionHandle = null;
  }
}

async function persistNow() {
  if (!sessionId || !artifactId) return false;
  ignorePatchUntil = Date.now() + 2500;
  try {
    const saved = await workspaceRpc('updateArtifact', { sessionId, artifactId, content: lastHtml });
    canUndo = saved?.artifact?.canUndo !== false;
    setUndoChrome();
    setStatus('已保存');
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '保存失败');
    return false;
  }
}

function downloadHtml() {
  const blob = new Blob([lastHtml], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName || 'site.html';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('已开始下载 HTML');
}

async function loadFromStore() {
  if (!sessionId || !artifactId) throw new Error('缺少 sessionId 或交付物 id');
  const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
  fileName = rec?.artifact?.name || rec?.name || 'site.html';
  const titleEl = document.getElementById('title');
  if (titleEl) titleEl.textContent = fileName;
  document.title = `${fileName} · 网页`;
  const raw = rec?.content != null ? String(rec.content) : '';
  canUndo = rec?.artifact?.canUndo === true;
  setUndoChrome();
  const stamped = stampSiteHtml(raw);
  const painted = await rewriteForPreview(stamped);
  renderHtml(stamped, painted);
  if (stamped !== raw) await persistNow();
}

async function applyPatchFromStore() {
  if (!sessionId || !artifactId) return false;
  if (Date.now() < ignorePatchUntil) return true;
  try {
    const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const raw = rec?.content != null ? String(rec.content) : '';
    if (!raw) return false;
    canUndo = rec?.artifact?.canUndo === true;
    setUndoChrome();
    const stamped = stampSiteHtml(raw);
    if (stamped === lastHtml) return true;
    const painted = await rewriteForPreview(stamped);
    renderHtml(stamped, painted);
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '同步失败');
    return false;
  }
}

async function revertNow() {
  if (!sessionId || !artifactId) return false;
  ignorePatchUntil = Date.now() + 2500;
  try {
    await workspaceRpc('revertArtifact', { sessionId, artifactId });
    await loadFromStore();
    setStatus('已撤销');
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '无法撤销');
    return false;
  }
}

function wire() {
  mountOfficeHelp('site');
  selBubble = mountOfficeSelBubble(document.body, { kind: 'canvas', copiedLabel: '已复制' });
  siteKeys = installOfficeShortcuts({
    surface: 'site',
    isTyping: (e) => isTypingTarget(e.target),
    actions: {
      zoomIn: () => applySiteZoom(stepZoom(siteZoom, 1)),
      zoomOut: () => applySiteZoom(stepZoom(siteZoom, -1)),
      zoomFit: () => applySiteZoom(1),
      save: () => {
        void persistNow();
      },
      undo: () => {
        void revertNow();
      },
      escape: () => {
        const closedHelp = closeOfficeHelp();
        if (selectedIds.length) {
          selectedIds = [];
          paintPick();
          reportState();
          return true;
        }
        return closedHelp;
      },
      selectAll: () => {
        selectedIds = liveNodeIds();
        paintPick();
        reportState();
      },
      delete: () => {
        if (!selectedIds.length) return;
        applySiteCommandsLocal([{ op: 'remove' }]);
      },
      duplicate: () => {
        if (!selectedIds.length) return;
        applySiteCommandsLocal([{ op: 'duplicate' }]);
      },
      nudge: (_e, delta) => {
        if (!selectedIds.length || !delta) return;
        const doc = pageDoc();
        if (!doc) return;
        for (const id of selectedIds) {
          let hit = null;
          try {
            hit = doc.querySelector(`[data-paw-node="${CSS.escape(id)}"]`);
          } catch {
            hit = null;
          }
          if (!hit) continue;
          const cur = parseTranslate(hit.style.transform);
          hit.style.transform = `translate(${cur.x + delta.x}px, ${cur.y + delta.y}px)`;
        }
        window.clearTimeout(nudgeTimer);
        nudgeTimer = window.setTimeout(() => {
          lastHtml = serializeLiveHtml();
          void persistNow();
        }, 280);
      }
    }
  });
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    void persistNow();
  });
  document.getElementById('undoBtn')?.addEventListener('click', () => {
    void revertNow();
  });
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
    downloadHtml();
  });
  if (!hasChrome()) return;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (
      handleWorkTabPickerMessage(msg, sendResponse, {
        getActive: () => pickActive,
        setActive: setPickActive
      })
    ) {
      return false;
    }
    if (msg?.action !== 'pawwork_html_preview_patch') return false;
    const aid = String(msg.artifactId || '');
    if (aid && artifactId && aid !== artifactId) {
      sendResponse({ ok: true, ignored: true });
      return false;
    }
    void applyPatchFromStore().then((ok) => {
      sendResponse({ ok: true, patched: ok !== false });
    });
    return true;
  });
}

async function boot() {
  if (!sessionId || !artifactId) {
    const bootEl = document.getElementById('boot');
    if (bootEl) {
      bootEl.textContent = '缺少 sessionId 或交付物 id';
      bootEl.classList.add('error');
    }
    return;
  }
  wire();
  try {
    await loadFromStore();
    if (hasChrome()) {
      chrome.runtime
        .sendMessage({
          action: 'html_tab_ready',
          sessionId,
          artifactId
        })
        .catch(() => {});
    }
    setStatus('浏览中 · 点侧栏「伸爪」后再点选');
  } catch (e) {
    const bootEl = document.getElementById('boot');
    if (bootEl) {
      bootEl.hidden = false;
      bootEl.textContent = e instanceof Error ? e.message : String(e);
      bootEl.classList.add('error');
    }
  }
}

boot().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err));
});
