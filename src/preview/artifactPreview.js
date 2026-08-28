/**
 * Generic artifact viewer — open HTML/PDF-as-HTML as a page, raster images as
 * images, opaque bytes as a downloadable file card.
 * Not a layout editor. Design lives on design.html; websites on site.html.
 */
import { classifyOpenArtifact, previewEntryForKind, previewEntryForItem, previewViewForItem } from '../agent/vnext/sessionWorkspace/openClassify.js';
import { pdfBytesToHtml, bytesForPdfPreview } from '../agent/vnext/sessionWorkspace/pdfIngest.js';
import { handleWorkTabPickerMessage, reportPickerState } from './workTabPicker.js';

function qs(name) {
  try {
    return new URL(location.href).searchParams.get(name) || '';
  } catch {
    return '';
  }
}

function qsIds() {
  const raw = qs('ids') || qs('artifactId') || '';
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
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

function b64ToBytes(b64) {
  const s = String(b64 || '');
  if (!s) return new Uint8Array(0);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function stripScripts(html) {
  return String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

const sessionId = qs('sessionId');
const artifactIds = qsIds();
let artifactId = artifactIds[0] || qs('artifactId') || '';
let lastHtml = '';
let fileName = 'preview.html';
let ignorePatchUntil = 0;
/** Pure routing decision from openClassify — the viewer only consumes it. */
let viewPlan = { view: 'html', kind: 'html', canSave: true, mimeType: 'text/html', downloadName: '' };
/** Original artifact bytes for byte-true download (image/pdf/binary views). */
let rawBytes = new Uint8Array(0);
let imageUrl = '';
let pickActive = false;

function pageFrame() {
  return document.getElementById('page');
}

function showPane(id) {
  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
  document.body.classList.add('is-ready');
  for (const paneId of ['page', 'imageWrap', 'fileCard']) {
    const el = document.getElementById(paneId);
    if (el) el.hidden = paneId !== id;
  }
}

function renderHtml(html) {
  const frame = pageFrame();
  if (!frame) return;
  lastHtml = String(html || '');
  showPane('page');
  frame.srcdoc = stripScripts(lastHtml);
}

function renderImage(bytes, mimeType) {
  const img = document.getElementById('image');
  if (!img) return;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/octet-stream' }));
  img.src = imageUrl;
  img.alt = fileName;
  showPane('imageWrap');
}

function renderFileCard() {
  const card = document.getElementById('fileCard');
  if (!card) return;
  card.textContent = '';
  const nameEl = document.createElement('div');
  nameEl.className = 'file-card-name';
  nameEl.textContent = fileName;
  const metaEl = document.createElement('div');
  metaEl.className = 'file-card-meta';
  metaEl.textContent = `${(viewPlan.kind || 'binary').toUpperCase()} · ${formatBytes(rawBytes.byteLength)} · 无内嵌预览，可下载原文件`;
  card.append(nameEl, metaEl);
  showPane('fileCard');
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
}

async function persistNow() {
  if (!sessionId || !artifactId) return false;
  // Only the HTML page view writes back; image/pdf/binary bytes are not lastHtml.
  if (viewPlan.canSave !== true) return false;
  ignorePatchUntil = Date.now() + 2500;
  try {
    await workspaceRpc('updateArtifact', { sessionId, artifactId, content: lastHtml });
    setStatus('已保存');
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '保存失败');
    return false;
  }
}

function downloadCurrent() {
  const byteTrue = viewPlan.view === 'image' || viewPlan.view === 'pdf' || viewPlan.view === 'binary';
  const blob = byteTrue
    ? new Blob([rawBytes], { type: viewPlan.mimeType || 'application/octet-stream' })
    : new Blob([lastHtml], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (byteTrue ? viewPlan.downloadName : fileName) || 'download';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('已开始下载');
}

async function readItem() {
  const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
  fileName = rec?.artifact?.name || rec?.name || artifactId;
  return {
    artifactId,
    name: fileName,
    mimeType: rec?.mimeType || rec?.artifact?.mimeType || '',
    bytes: bytesForPdfPreview({
      base64: rec?.base64,
      content: rec?.content,
      bytes: b64ToBytes(rec?.base64)
    }),
    text: rec?.content != null ? String(rec.content) : '',
    artifact: rec?.artifact
  };
}

function applyViewChrome() {
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.hidden = viewPlan.canSave !== true;
}

async function renderByPlan(item) {
  rawBytes = item.bytes instanceof Uint8Array ? item.bytes : new Uint8Array(0);
  if (viewPlan.view === 'image') {
    renderImage(rawBytes, viewPlan.mimeType);
    setStatus(`图像 · ${(viewPlan.kind || '').toUpperCase()} · ${formatBytes(rawBytes.byteLength)}`);
    return;
  }
  if (viewPlan.view === 'pdf') {
    const converted = await pdfBytesToHtml(item.bytes, { title: fileName || 'PDF' });
    renderHtml(converted.html);
    setStatus(converted.warning || 'PDF 预览 · 下载得到原始 PDF');
    return;
  }
  if (viewPlan.view === 'binary') {
    renderFileCard();
    setStatus('二进制文件 · 无内嵌预览');
    return;
  }
  renderHtml(item.text || '');
  setStatus('预览 · 这不是画板');
}

async function applyPatchFromStore() {
  if (!sessionId || !artifactId) return false;
  if (Date.now() < ignorePatchUntil) return true;
  try {
    const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const raw = rec?.content != null ? String(rec.content) : '';
    if (!raw || raw === lastHtml) return true;
    renderHtml(raw);
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '同步失败');
    return false;
  }
}

/** Non-HTML views refresh from bytes (e.g. the agent regenerated the image). */
async function refreshFromStore() {
  if (!sessionId || !artifactId) return false;
  try {
    const item = await readItem();
    await renderByPlan(item);
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '同步失败');
    return false;
  }
}

function wire() {
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    void persistNow();
  });
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
    downloadCurrent();
  });
  if (!hasChrome()) return;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (
      handleWorkTabPickerMessage(msg, sendResponse, {
        getActive: () => pickActive,
        setActive: (on) => {
          pickActive = !!on;
          reportPickerState(pickActive);
        }
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
    void (viewPlan.view === 'html' ? applyPatchFromStore() : refreshFromStore()).then((ok) => {
      sendResponse({ ok: true, patched: ok !== false });
    });
    return true;
  });
}

async function boot() {
  if (!sessionId || !artifactIds.length) {
    const bootEl = document.getElementById('boot');
    if (bootEl) {
      bootEl.textContent = '缺少 sessionId 或交付物 id';
      bootEl.classList.add('error');
    }
    return;
  }
  wire();
  try {
    const item = await readItem();
    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.textContent = fileName;
    document.title = `${fileName} · 预览`;
    const routed = previewEntryForItem(item);
    const dest = routed.entry || previewEntryForKind(classifyOpenArtifact(item).kind);
    if (dest !== 'artifactPreview.html') {
      const q = new URLSearchParams();
      q.set('sessionId', sessionId);
      q.set('artifactId', artifactId);
      if (dest === 'design.html') q.set('shell', routed.shell || 'design');
      location.replace(`./${dest}?${q.toString()}`);
      return;
    }
    viewPlan = previewViewForItem(item);
    applyViewChrome();
    await renderByPlan(item);
    if (hasChrome()) {
      chrome.runtime
        .sendMessage({ action: 'html_tab_ready', sessionId, artifactId })
        .catch(() => {});
    }
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
