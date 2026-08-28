/**
 * Paw Work Design / Slides host: mounts the vendored tldraw engine,
 * hydrates pawCanvas, save/download, layers/filmstrip.
 */
import { mountDesignCanvas } from './vendor/design-runtime.js';
import {
  parsePawCanvas,
  isPawCanvasDoc,
  shapesFromPawCanvas,
  recordsFromPawCanvas,
  exportPawCanvas,
  shellFromArtifactText,
  listEngineNodes
} from '../agent/vnext/sessionWorkspace/engineCanvas.js';
import { normalizeTldrawSnapshot } from '../agent/vnext/sessionWorkspace/tldrawShapeProps.js';
import { previewEntryForItem } from '../agent/vnext/sessionWorkspace/openClassify.js';
import { installOfficeShortcuts, isTypingTarget } from './officeShortcuts.js';
import { closeOfficeHelp, mountOfficeHelp } from './officeHelp.js';
import { isRasterArtifact } from '../agent/vnext/sessionWorkspace/slidesStage.js';
import {
  FILMSTRIP_REORDER_GESTURE,
  filmstripDropIndex,
  isFilmstripReorderKey,
  sortFramesForStrip
} from '../agent/vnext/sessionWorkspace/slidesLayout.js';
import {
  TLDRAW_LICENSE_STORAGE_KEY,
  tldrawLicenseStatus
} from '../agent/vnext/sessionWorkspace/tldrawLicense.js';
import { handleWorkTabPickerMessage, reportPickerState } from './workTabPicker.js';
import { mountOfficeSelBubble, officeSelCopyLabel } from './officeSelBubble.js';
import { createSlidesPresenter } from './slidesPresent.js';

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

const sessionId = qs('sessionId');
const artifactId = qs('artifactId') || (qs('ids') || '').split(',')[0] || '';
let shell = qs('shell') === 'slides' ? 'slides' : 'design';
document.body.dataset.shell = shell;
const titleEl = document.getElementById('title');
if (titleEl) titleEl.textContent = shell === 'slides' ? 'Paw Work Slides' : 'Paw Work Design';
document.title = titleEl?.textContent || 'Paw Work Design';

let saveTimer = 0;
let lastJson = '';
let pawDoc = null;
let saveArmed = false;
let hostApi = null;
const slidesPresenter = createSlidesPresenter({
  getHostApi: () => hostApi
});
let ignorePatchUntil = 0;
let pointerDepth = 0;
let pickActive = false;
/** @type {ReturnType<typeof mountOfficeSelBubble>|null} */
let selBubble = null;
const filmDrag = {
  active: false,
  pointerId: 0,
  fromIndex: -1,
  toIndex: -1,
  frameId: '',
  startY: 0,
  moved: false,
  suppressClick: false
};

function announceFilm(msg) {
  const live = document.getElementById('filmLive');
  if (live) live.textContent = msg || '';
}

function filmItemRects() {
  return [...document.querySelectorAll('#filmList .pw-film-item')].map((el) => el.getBoundingClientRect());
}

function paintFilmDrop(toIndex) {
  const items = [...document.querySelectorAll('#filmList .pw-film-item')];
  items.forEach((el, i) => {
    el.classList.toggle('is-dragging', el.dataset.frameId === filmDrag.frameId);
    el.classList.toggle('is-drop-before', filmDrag.active && filmDrag.moved && i === toIndex && toIndex <= filmDrag.fromIndex);
    el.classList.toggle('is-drop-after', filmDrag.active && filmDrag.moved && i === toIndex && toIndex > filmDrag.fromIndex);
  });
}

function clearFilmDragPaint() {
  for (const el of document.querySelectorAll('#filmList .pw-film-item')) {
    el.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  }
}

function cancelFilmDrag() {
  if (!filmDrag.active) return false;
  filmDrag.active = false;
  filmDrag.moved = false;
  filmDrag.suppressClick = true;
  filmDrag.frameId = '';
  filmDrag.fromIndex = -1;
  filmDrag.toIndex = -1;
  clearFilmDragPaint();
  announceFilm('已取消调整顺序');
  return true;
}

function commitFilmReorder(fromIndex, toIndex, frameId) {
  const api = hostApi;
  if (!api?.reorderSlides) return false;
  const result = api.reorderSlides({ fromIndex, toIndex, id: frameId, animate: true });
  const frames = api.getLayerModel?.()?.frames || [];
  if (result?.changed) {
    const pos = Math.max(1, frames.findIndex((f) => f.id === (result.frameId || frameId)) + 1);
    announceFilm(`已移到第 ${pos} 张，共 ${frames.length} 张`);
  } else if (frames.length) {
    announceFilm(toIndex <= 0 ? '已在第一张' : '已在最后一张');
  }
  renderChrome(api);
  const keep = result?.frameId || frameId;
  if (keep) {
    const btn = document.querySelector(`#filmList .pw-film-item[data-frame-id="${CSS.escape(keep)}"]`);
    btn?.focus();
  }
  return !!result?.changed;
}

function reportSelection(nodes, api) {
  const list = Array.isArray(nodes) ? nodes : [];
  const hit = list[list.length - 1];
  const label = officeSelCopyLabel(hit);
  if (selBubble) {
    if (label) selBubble.show(label, api?.getSelectionScreenBounds?.() || hostApi?.getSelectionScreenBounds?.());
    else selBubble.hide();
  }
  if (!hasChrome()) return;
  const model = hostApi?.getLayerModel?.() || {};
  const frames = (model.frames || []).map((f) => ({
    nodeId: f.id,
    name: f.text || 'Frame',
    type: 'frame'
  }));
  chrome.runtime
    .sendMessage({
      action: 'html_tab_state',
      sessionId,
      artifactId,
      kind: shell === 'slides' ? 'deck' : 'poster',
      overview: { shell, frames, nodeCount: (model.shapes || []).length },
      selections: list.map((n) => ({
        nodeId: n.nodeId,
        slotId: n.nodeId,
        type: n.type,
        text: n.text,
        plateId: ''
      }))
    })
    .catch(() => {});
  syncNotes(list);
}

function wrapSnap(snap) {
  const document =
    snap?.document && typeof snap.document === 'object' ? snap.document : snap && typeof snap === 'object' ? snap : {};
  return {
    pawCanvas: 1,
    shell,
    title: pawDoc?.title || '',
    themeId: pawDoc?.themeId || '',
    tldraw: { document }
  };
}

function scheduleSave(snap) {
  if (!saveArmed || !artifactId || !sessionId) return;
  if (pointerDepth > 0) {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => scheduleSave(snap), 200);
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persistNow(snap);
  }, 800);
}

function isWorkLocked() {
  return !!document.getElementById('pawWorkLock')?.classList.contains('is-on');
}

async function persistNow(snap) {
  if (!artifactId || !sessionId) return false;
  if (isWorkLocked()) return false;
  try {
    const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const rawStore = rec?.content != null ? String(rec.content) : '';
    if (rawStore && rawStore !== lastJson) {
      await applyPatchFromStore();
      return false;
    }
  } catch {
    /* persist local snapshot if the store read fails */
  }
  const editorSnap = snap || hostApi?.getSnapshot?.();
  if (!editorSnap) return false;
  const next = wrapSnap(editorSnap);
  const json = JSON.stringify(next);
  if (json === lastJson) return true;
  try {
    const latest = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const rawStore = latest?.content != null ? String(latest.content) : '';
    if (rawStore && rawStore !== lastJson && rawStore !== json) {
      await applyPatchFromStore();
      return false;
    }
  } catch {
    /* last-look store read is best-effort */
  }
  lastJson = json;
  pawDoc = parsePawCanvas(next) || next;
  ignorePatchUntil = Date.now() + 3000;
  try {
    await workspaceRpc('updateArtifact', { sessionId, artifactId, content: json });
    setStatus('已保存');
    return true;
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '保存失败');
    return false;
  }
}

function snapshotHasSchema(snap) {
  return !!(snap && (snap.schema || snap.document?.schema || (snap.store && snap.schema)));
}

const collapsedLayerIds = new Set();

function clusterHeadingGroups(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (list.length < 4) return list;
  if (list.some((n) => n.type === 'frame' || n.type === 'group' || n.virtual)) return list;
  const groups = [];
  let cur = null;
  for (const n of list) {
    const heading = n.pawKind === 'headline' || n.pawKind === 'heading' || n.type === 'heading';
    if (heading || !cur) {
      cur = {
        id: `cluster:${n.id}`,
        type: 'group',
        text: heading ? layerLabel(n) : 'Group',
        children: [n],
        virtual: true
      };
      groups.push(cur);
    } else {
      cur.children.push(n);
    }
  }
  return groups.length > 1 ? groups : list;
}

function nestLayerTree(shapes, pageId) {
  const list = Array.isArray(shapes) ? shapes : [];
  const byParent = new Map();
  for (const s of list) {
    const pid = s.parentId || pageId || '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(s);
  }
  const walk = (pid) => (byParent.get(pid) || []).map((s) => ({ ...s, children: walk(s.id) }));
  const rooted = walk(pageId);
  if (rooted.length) return rooted;
  const ids = new Set(list.map((s) => s.id));
  return list
    .filter((s) => !s.parentId || s.parentId === pageId || !ids.has(s.parentId))
    .map((s) => ({ ...s, children: walk(s.id) }));
}

function layerLabel(node) {
  return String(node.text || node.type || node.id || '').slice(0, 40);
}

function appendLayerNode(list, node, depth, api, selected) {
  const kids = clusterHeadingGroups(Array.isArray(node.children) ? node.children : []);
  const expandable = kids.length > 0;
  const expanded = expandable && !collapsedLayerIds.has(node.id);
  const li = document.createElement('li');
  li.dataset.kind = node.type || 'shape';
  li.dataset.id = node.id;
  li.style.paddingLeft = `${8 + depth * 14}px`;
  if (selected.has(node.id)) li.classList.add('is-on');

  const twist = document.createElement('button');
  twist.type = 'button';
  twist.className = 'twist';
  twist.tabIndex = -1;
  if (expandable) {
    twist.textContent = expanded ? '▾' : '▸';
    twist.setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
    twist.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (collapsedLayerIds.has(node.id)) collapsedLayerIds.delete(node.id);
      else collapsedLayerIds.add(node.id);
      renderChrome(api);
    });
  } else {
    twist.textContent = '';
    twist.disabled = true;
    twist.style.visibility = 'hidden';
  }

  const lab = document.createElement('span');
  lab.className = 'lab';
  lab.textContent = layerLabel(node);
  li.append(twist, lab);
  li.addEventListener('click', (ev) => {
    if (ev.target === twist) return;
    if (node.virtual) {
      const ids = (node.children || []).map((c) => c.id).filter(Boolean);
      const editor = api.getEditor?.();
      if (editor && ids.length && typeof editor.setSelectedShapes === 'function') {
        editor.setSelectedShapes(ids);
        editor.zoomToSelection?.({ animation: { duration: 120 } });
      } else if (ids[0]) api.select(ids[0]);
      return;
    }
    api.select(node.id);
  });
  list.appendChild(li);
  if (expanded) {
    for (const child of [...kids].reverse()) appendLayerNode(list, child, depth + 1, api, selected);
  }
}

function renderChrome(api) {
  const model = api?.getLayerModel?.() || { pages: [], shapes: [], frames: [], tree: [] };
  const list = document.getElementById('layerList');
  if (list) {
    const selected = new Set(
      [...(api?.getEditor?.()?.getSelectedShapeIds?.() || [])].map(String)
    );
    const tree =
      Array.isArray(model.tree) && model.tree.length
        ? model.tree
        : nestLayerTree(model.shapes, model.currentPageId);
    list.replaceChildren();
    for (const node of [...tree].reverse()) appendLayerNode(list, node, 0, api, selected);
  }
  const film = document.getElementById('filmstrip');
  if (film) {
    film.hidden = shell !== 'slides';
    if (shell === 'slides' && !filmDrag.active) {
      film.replaceChildren();
      const state = api.getSlideState?.() || { view: 'page', frameId: '' };
      const tools = document.createElement('div');
      tools.className = 'pw-film-tools';
      const overviewBtn = document.createElement('button');
      overviewBtn.type = 'button';
      overviewBtn.textContent = '总览';
      if (state.view === 'overview') overviewBtn.classList.add('is-on');
      overviewBtn.addEventListener('click', () => {
        const next = state.view === 'overview' ? 'page' : 'overview';
        api.setSlideView?.(next);
        renderChrome(api);
      });
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = '+ 幻灯片';
      addBtn.addEventListener('click', () => {
        const { frames, idx } = currentSlideIndex();
        api.createBlankSlide?.(frames[idx]?.id);
        renderChrome(api);
      });
      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.textContent = '复制';
      dupBtn.addEventListener('click', () => {
        const { frames, idx } = currentSlideIndex();
        if (frames[idx]?.id) api.duplicateSlide?.(frames[idx].id);
        renderChrome(api);
      });
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', () => {
        const { frames, idx } = currentSlideIndex();
        if (frames[idx]?.id) api.deleteSlide?.(frames[idx].id);
        renderChrome(api);
      });
      const presentBtn = document.createElement('button');
      presentBtn.type = 'button';
      presentBtn.textContent = '放映';
      if (isPresent()) presentBtn.classList.add('is-on');
      presentBtn.addEventListener('click', () => {
        setPresent(!isPresent());
        renderChrome(api);
      });
      tools.append(overviewBtn, addBtn, dupBtn, delBtn, presentBtn);
      film.appendChild(tools);
      const list = document.createElement('div');
      list.id = 'filmList';
      list.className = 'pw-film-list';
      list.setAttribute('role', 'list');
      list.setAttribute('aria-label', '幻灯片顺序');
      const editor = api.getEditor?.();
      const rawFrames = model.frames.length ? model.frames : model.shapes.filter((s) => s.type === 'frame');
      const frames = sortFramesForStrip(
        rawFrames.map((fr) => {
          const shape = editor?.getShape?.(fr.id);
          return { ...fr, x: shape?.x ?? fr.x ?? 0, y: shape?.y ?? fr.y ?? 0, index: shape?.index };
        })
      );
      frames.forEach((fr, i) => {
        const name = fr.text || `幻灯片 ${i + 1}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-film-item';
        btn.id = `film-item-${String(fr.id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
        btn.dataset.frameId = fr.id;
        btn.dataset.index = String(i);
        btn.setAttribute('role', 'listitem');
        btn.setAttribute(
          'aria-label',
          `幻灯片 ${i + 1}，${name}。${FILMSTRIP_REORDER_GESTURE} 调整顺序`
        );
        if (fr.id === state.frameId) {
          btn.classList.add('is-on');
          btn.setAttribute('aria-current', 'true');
        }
        btn.textContent = name;
        btn.addEventListener('dragstart', (ev) => ev.preventDefault());
        btn.addEventListener('click', (ev) => {
          if (filmDrag.suppressClick) {
            ev.preventDefault();
            filmDrag.suppressClick = false;
            return;
          }
          api.pinSlide?.(fr.id, { view: 'page' });
          renderChrome(api);
        });
        btn.addEventListener('pointerdown', (ev) => {
          if (ev.button !== 0) return;
          filmDrag.active = true;
          filmDrag.pointerId = ev.pointerId;
          filmDrag.fromIndex = i;
          filmDrag.toIndex = i;
          filmDrag.frameId = fr.id;
          filmDrag.startY = ev.clientY;
          filmDrag.moved = false;
          try {
            btn.setPointerCapture(ev.pointerId);
          } catch {
            /* */
          }
        });
        btn.addEventListener('pointermove', (ev) => {
          if (!filmDrag.active || ev.pointerId !== filmDrag.pointerId) return;
          if (!filmDrag.moved && Math.abs(ev.clientY - filmDrag.startY) < 6) return;
          filmDrag.moved = true;
          ev.preventDefault();
          const drop = filmstripDropIndex(filmItemRects(), ev.clientY, filmDrag.fromIndex);
          filmDrag.toIndex = drop.to;
          paintFilmDrop(drop.to);
        });
        const finishPointer = (ev) => {
          if (!filmDrag.active || ev.pointerId !== filmDrag.pointerId) return;
          const from = filmDrag.fromIndex;
          const to = filmDrag.toIndex;
          const id = filmDrag.frameId;
          const moved = filmDrag.moved;
          filmDrag.active = false;
          filmDrag.moved = false;
          filmDrag.suppressClick = moved;
          clearFilmDragPaint();
          try {
            btn.releasePointerCapture(ev.pointerId);
          } catch {
            /* */
          }
          if (moved && from !== to) commitFilmReorder(from, to, id);
        };
        btn.addEventListener('pointerup', finishPointer);
        btn.addEventListener('pointercancel', () => {
          cancelFilmDrag();
        });
        list.appendChild(btn);
      });
      film.appendChild(list);
      const live = document.createElement('div');
      live.id = 'filmLive';
      live.className = 'pw-sr-only';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      film.appendChild(live);
      if (!film.dataset.pawReorderBound) {
        film.dataset.pawReorderBound = '1';
        film.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && filmDrag.active) {
            ev.preventDefault();
            ev.stopPropagation();
            cancelFilmDrag();
            return;
          }
          const item = ev.target?.closest?.('.pw-film-item');
          if (!item || !film.contains(item)) return;
          const delta = isFilmstripReorderKey(ev);
          if (!delta) return;
          ev.preventDefault();
          ev.stopPropagation();
          const from = Number(item.dataset.index);
          commitFilmReorder(from, from + delta, item.dataset.frameId);
        });
      }
    }
  }
}

function syncNotes(nodes) {
  const ta = document.getElementById('slideNotes');
  const dock = document.getElementById('notesDock');
  if (!ta || !dock) return;
  dock.hidden = shell !== 'slides';
  const frame = (nodes || []).find((n) => n.type === 'frame');
  if (!frame) return;
  if (document.activeElement === ta) return;
  ta.value = frame.notes || '';
  ta.dataset.nodeId = frame.nodeId;
}

function downloadBytes(name, mime, bytes) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function stem() {
  return String(pawDoc?.title || (shell === 'slides' ? 'slides' : 'design')).replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'canvas';
}

function pdfEscapeName(s) {
  return String(s || 'F').replace(/[^\w.-]+/g, '_').slice(0, 40);
}

function jpegPagesToPdf(pages) {
  const list = Array.isArray(pages) ? pages.filter((p) => p && p.bytes && p.w && p.h) : [];
  if (!list.length) throw new Error('no frames to export');
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const pageIds = [];
  const catalogId = add('');
  const pagesId = add('');
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const imgId = add('');
    const contentId = add('');
    const pageId = add('');
    pageIds.push(pageId);
    objects[imgId - 1] =
      `${imgId} 0 obj << /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.byteLength} >> stream\n`;
    objects[contentId - 1] = `${contentId} 0 obj << /Length ${24 + String(p.w).length + String(p.h).length} >> stream\n${p.w} 0 0 ${p.h} 0 0 cm /Im${i} Do\nendstream\nendobj\n`;
    objects[pageId - 1] =
      `${pageId} 0 obj << /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> >> endobj\n`;
  }
  objects[catalogId - 1] = `${catalogId} 0 obj << /Type /Catalog /Pages ${pagesId} 0 R >> endobj\n`;
  objects[pagesId - 1] =
    `${pagesId} 0 obj << /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >> endobj\n`;

  const encoder = new TextEncoder();
  const chunks = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let pos = chunks[0].byteLength;
  const imageBodies = list.map((p) => p.bytes);
  let imgCursor = 0;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pos);
    const body = objects[i];
    if (typeof body === 'string' && body.includes('/Subtype /Image')) {
      const head = encoder.encode(body);
      const jpeg = imageBodies[imgCursor++];
      const tail = encoder.encode('\nendstream\nendobj\n');
      chunks.push(head, jpeg, tail);
      pos += head.byteLength + jpeg.byteLength + tail.byteLength;
    } else {
      const bytes = encoder.encode(body);
      chunks.push(bytes);
      pos += bytes.byteLength;
    }
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const xrefBytes = encoder.encode(xref);
  chunks.push(xrefBytes);
  pos += xrefBytes.byteLength;
  const trailer = encoder.encode(
    `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  );
  chunks.push(trailer);
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

const PREVIEW_MAX_FRAMES = 4;
const PREVIEW_MAX_WIDTH = 720;

async function encodePreviewJpeg(blob) {
  const bmp = await createImageBitmap(blob);
  const scale = bmp.width > PREVIEW_MAX_WIDTH ? PREVIEW_MAX_WIDTH / bmp.width : 1;
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const jpeg = await new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg encode failed'))), 'image/jpeg', 0.72);
  });
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { w, h, mime: 'image/jpeg', base64: btoa(binary) };
}

async function encodePreviewFrames(frames) {
  const list = Array.isArray(frames) ? frames : [];
  const out = [];
  for (const fr of list.slice(0, PREVIEW_MAX_FRAMES)) {
    if (!fr?.blob) continue;
    const enc = await encodePreviewJpeg(fr.blob);
    out.push({
      id: fr.id || '',
      name: String(fr.name || 'Frame'),
      ...enc
    });
  }
  return { frames: out, truncated: list.length > PREVIEW_MAX_FRAMES };
}

async function captureEnginePreview(ids) {
  const work = hostApi?.exportPreview
    ? hostApi.exportPreview({ maxFrames: PREVIEW_MAX_FRAMES, ids })
    : hostApi?.exportFrames
      ? hostApi.exportFrames({ scale: 1 })
      : Promise.reject(new Error('engine exportFrames unavailable'));
  let timer;
  try {
    const frames = await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('preview export timeout')), 10000);
      })
    ]);
    return encodePreviewFrames(frames);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function blobToJpegPage(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const jpeg = await new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg encode failed'))), 'image/jpeg', 0.92);
  });
  return { bytes: new Uint8Array(await jpeg.arrayBuffer()), w: c.width, h: c.height };
}

async function runExport(fmt) {
  setStatus('导出中…');
  await persistNow();
  if (fmt === 'png') {
    if (!hostApi?.exportPng) throw new Error('engine exportPng unavailable');
    const bytes = await hostApi.exportPng();
    downloadBytes(`${stem()}.png`, 'image/png', bytes);
    setStatus('已开始下载 PNG');
    return;
  }
  if (fmt === 'svg') {
    if (!hostApi?.exportSvg) throw new Error('engine exportSvg unavailable');
    const bytes = await hostApi.exportSvg();
    downloadBytes(`${stem()}.svg`, 'image/svg+xml', bytes);
    setStatus('已开始下载 SVG');
    return;
  }
  if (fmt === 'pdf') {
    if (!hostApi?.exportFrames) throw new Error('engine exportFrames unavailable');
    const frames = await hostApi.exportFrames();
    const pages = [];
    for (const fr of frames) {
      pages.push(await blobToJpegPage(fr.blob));
    }
    const bytes = jpegPagesToPdf(pages);
    downloadBytes(`${pdfEscapeName(stem())}.pdf`, 'application/pdf', bytes);
    setStatus('已开始下载 PDF');
    return;
  }
  const snap = hostApi?.getSnapshot?.();
  const doc = wrapSnap(snap || pawDoc);
  const out = await exportPawCanvas(doc, fmt, {
    renderShape: (id) => hostApi.exportPng({ ids: [id], scale: 2, padding: 0 }),
    renderFrame: (id) => hostApi.exportPng({ ids: [id], scale: 2, padding: 0 })
  });
  if (!out.ok) throw new Error(out.error || 'export failed');
  downloadBytes(out.filename, out.mime, out.bytes);
  setStatus(`已开始下载 ${fmt.toUpperCase()}`);
}

function countLiveFrames(editor) {
  const shapes = editor?.getCurrentPageShapes?.() || [];
  return shapes.filter((s) => s && s.type === 'frame').length;
}

function isStructuralCanvasReplace(next, editor) {
  const incoming = listEngineNodes(next || {}).filter((n) => n.type === 'frame').length;
  const live = countLiveFrames(editor);
  return incoming > 0 && incoming !== live;
}

async function applyPatchFromStore() {
  if (!sessionId || !artifactId) return false;
  try {
    const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const raw = rec?.content != null ? String(rec.content) : '';
    if (!raw) return false;
    if (raw === lastJson) return true;
    const next = isPawCanvasDoc(raw) ? parsePawCanvas(raw) : null;
    const snap = next?.tldraw;
    const editor = hostApi?.getEditor?.();
    if (pointerDepth > 0 && !isStructuralCanvasReplace(next, editor)) return true;
    if (next && snap && editor && typeof editor.loadSnapshot === 'function') {
      saveArmed = false;
      try {
        const payload = snap.document ? { document: snap.document } : snap;
        editor.loadSnapshot(normalizeTldrawSnapshot(payload));
        pawDoc = next;
        lastJson = raw;
        hostApi?.applyTheme?.(next.themeId, next);
        renderChrome(hostApi);
      } finally {
        saveArmed = true;
      }
      return true;
    }
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '同步失败');
    return false;
  }
  return false;
}

function exportMenuIsOpen(menu) {
  if (!menu) return false;
  if (menu.hasAttribute('popover')) {
    try {
      return menu.matches(':popover-open');
    } catch {
      return menu.hasAttribute('popover-open');
    }
  }
  return !menu.hidden && !menu.hasAttribute('hidden');
}

function positionExportMenu(menu, btn) {
  if (!menu || !btn) return;
  const r = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.inset = 'unset';
  menu.style.top = `${Math.round(r.bottom + 4)}px`;
  menu.style.right = `${Math.round(Math.max(8, window.innerWidth - r.right))}px`;
  menu.style.left = 'auto';
  menu.style.bottom = 'auto';
  menu.style.width = 'max-content';
  menu.style.height = 'max-content';
}

function closeExportMenu(menu) {
  if (!menu) return;
  if (typeof menu.hidePopover === 'function' && menu.hasAttribute('popover')) {
    try {
      if (exportMenuIsOpen(menu)) menu.hidePopover();
    } catch {
      /* already closed */
    }
    return;
  }
  menu.setAttribute('hidden', '');
}

function openExportMenu(menu, btn) {
  if (!menu) return;
  positionExportMenu(menu, btn);
  if (typeof menu.showPopover === 'function' && menu.hasAttribute('popover')) {
    try {
      menu.showPopover();
    } catch {
      /* already open */
    }
    positionExportMenu(menu, btn);
    return;
  }
  menu.removeAttribute('hidden');
}

function setPresent(on) {
  const next = !!on;
  if (next && shell === 'slides') {
    void slidesPresenter.enter().then(() => renderChrome(hostApi));
    return;
  }
  slidesPresenter.exit();
  document.body.dataset.present = '';
}

function isPresent() {
  return slidesPresenter.isActive() || document.body.dataset.present === '1';
}

function designZoom(dir) {
  const editor = hostApi?.getEditor?.();
  if (!editor) return;
  if (dir === 0) {
    if (shell === 'slides') hostApi?.pinSlide?.(hostApi.getSlideState?.()?.frameId, { animate: false });
    else hostApi.fitContent?.();
    return;
  }
  const fn = dir > 0 ? editor.zoomIn : editor.zoomOut;
  if (typeof fn !== 'function') return;
  try {
    fn.call(editor, undefined, { animation: { duration: 80 } });
  } catch {
    try {
      fn.call(editor);
    } catch {
      /* engine variance */
    }
  }
}

function currentSlideIndex() {
  const editor = hostApi?.getEditor?.();
  const frames = hostApi?.getLayerModel?.()?.frames || [];
  if (!frames.length) return { frames, idx: -1 };
  const selected = [...(editor?.getSelectedShapeIds?.() || [])].map(String);
  let idx = frames.findIndex((f) => selected.includes(f.id));
  if (idx < 0 && selected.length && editor?.getShape) {
    let s = editor.getShape(selected[0]);
    while (s) {
      idx = frames.findIndex((f) => f.id === s.id);
      if (idx >= 0) break;
      s = s.parentId ? editor.getShape(s.parentId) : null;
    }
  }
  if (idx < 0) idx = 0;
  return { frames, idx, editor };
}

function goSlide(delta) {
  if (shell !== 'slides') return;
  if (slidesPresenter.isActive()) {
    void slidesPresenter.step(delta).then(() => renderChrome(hostApi));
    return;
  }
  const { frames, idx } = currentSlideIndex();
  const next = frames[idx + delta];
  if (!next) return;
  hostApi?.pinSlide?.(next.id, { view: 'page' });
  renderChrome(hostApi);
}

function setPickActive(on) {
  pickActive = !!on;
  document.body.dataset.pawPick = pickActive ? '1' : '';
  setStatus(pickActive ? '伸爪中 · 点选画布节点' : '');
  reportPickerState(pickActive);
}

function renderToolStrip() {
  const strip = document.getElementById('toolStrip');
  if (!strip) return;
  strip.hidden = false;
  strip.replaceChildren();
  const add = (label, fn) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', fn);
    strip.appendChild(btn);
  };
  add('选择', () => hostApi?.setTool?.('select'));
  add('文字', () => hostApi?.setTool?.('text'));
  add('矩形', () => hostApi?.setTool?.('geo', 'rectangle'));
  add('椭圆', () => hostApi?.setTool?.('geo', 'ellipse'));
  add('画板', () => hostApi?.setTool?.('frame'));
  add('图片', () => {
    const btn = document.getElementById('insertBtn');
    if (btn) btn.click();
    else hostApi?.setTool?.('asset');
  });
  if (shell === 'slides') {
    add('+ 幻灯片', () => {
      const { frames, idx } = currentSlideIndex();
      hostApi?.createBlankSlide?.(frames[idx]?.id);
      renderChrome(hostApi);
    });
    add('总览', () => {
      const cur = hostApi?.getSlideState?.()?.view;
      hostApi?.setSlideView?.(cur === 'overview' ? 'page' : 'overview');
      renderChrome(hostApi);
    });
    add('放映', () => setPresent(!isPresent()));
  }
}

let hostWired = false;
function wireHost(api) {
  hostApi = api;
  if (hostWired) return;
  hostWired = true;
  const bump = (n) => {
    pointerDepth = Math.max(0, pointerDepth + n);
  };
  window.addEventListener('pointerdown', () => bump(1), true);
  window.addEventListener('pointerup', () => bump(-1), true);
  window.addEventListener('pointercancel', () => bump(-1), true);
  document.getElementById('presentFx')?.addEventListener('click', (e) => {
    if (!slidesPresenter.isActive() || slidesPresenter.isLocked()) return;
    if (e.button !== 0) return;
    e.preventDefault();
    void goSlide(1);
  });
  mountOfficeHelp(shell === 'slides' ? 'slides' : 'design');
  selBubble = mountOfficeSelBubble(document.body, { kind: 'canvas', copiedLabel: '已复制' });
  renderToolStrip();
  installOfficeShortcuts({
    surface: shell === 'slides' ? 'slides' : 'design',
    isTyping(e) {
      if (isTypingTarget(e.target)) return true;
      try {
        if (hostApi?.getEditor?.()?.getEditingShapeId?.()) return true;
      } catch {
        /* */
      }
      return false;
    },
    isPresent: () => isPresent(),
    actions: {
      zoomIn: () => designZoom(1),
      zoomOut: () => designZoom(-1),
      zoomFit: () => designZoom(0),
      save: () => {
        void persistNow().then((ok) => {
          if (ok) setStatus('已保存');
        });
      },
      escape: () => {
        if (cancelFilmDrag()) return true;
        if (isPresent()) {
          setPresent(false);
          return true;
        }
        const closedHelp = closeOfficeHelp();
        const exportOpen = exportMenuIsOpen(document.getElementById('exportMenu'));
        if (exportOpen) closeExportMenu(document.getElementById('exportMenu'));
        const insertOpen = exportMenuIsOpen(document.getElementById('insertMenu'));
        if (insertOpen) closeExportMenu(document.getElementById('insertMenu'));
        return closedHelp || exportOpen || insertOpen;
      },
      pageNext: () => goSlide(1),
      pagePrev: () => goSlide(-1),
      present: () => setPresent(!isPresent())
    }
  });
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    void persistNow().then((ok) => {
      if (ok) setStatus('已保存');
    });
  });
  const downloadBtn = document.getElementById('downloadBtn');
  const exportMenu = document.getElementById('exportMenu');
  downloadBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!exportMenu) {
      void runExport('png').catch((err) => setStatus(err.message || '导出失败'));
      return;
    }
    if (exportMenuIsOpen(exportMenu)) closeExportMenu(exportMenu);
    else openExportMenu(exportMenu, downloadBtn);
  });
  exportMenu?.addEventListener('toggle', () => {
    if (exportMenuIsOpen(exportMenu)) positionExportMenu(exportMenu, downloadBtn);
  });
  exportMenu?.addEventListener('click', (e) => {
    const fmt = e.target?.closest?.('[data-export]')?.getAttribute('data-export');
    if (!fmt) return;
    e.preventDefault();
    e.stopPropagation();
    closeExportMenu(exportMenu);
    void runExport(fmt).catch((err) => setStatus(err.message || '导出失败'));
  });
  document.getElementById('slideNotes')?.addEventListener('change', (e) => {
    const id = e.target.dataset.nodeId;
    if (id) api.setNotes(id, e.target.value);
  });
  const insertBtn = document.getElementById('insertBtn');
  const insertMenu = document.getElementById('insertMenu');
  insertBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!insertMenu) return;
    if (exportMenuIsOpen(insertMenu)) closeExportMenu(insertMenu);
    else {
      void fillInsertMenu(insertMenu).then(() => openExportMenu(insertMenu, insertBtn));
    }
  });
  insertMenu?.addEventListener('click', (e) => {
    const id = e.target?.closest?.('[data-artifact]')?.getAttribute('data-artifact');
    if (!id) return;
    e.preventDefault();
    closeExportMenu(insertMenu);
    void insertWorkspaceImage(id);
  });
}

async function fillInsertMenu(menu) {
  if (!menu) return;
  menu.replaceChildren();
  if (!sessionId) {
    const empty = document.createElement('div');
    empty.className = 'pw-insert-empty';
    empty.textContent = '工作区暂无图片';
    menu.appendChild(empty);
    return;
  }
  let list = [];
  try {
    const rec = await workspaceRpc('listArtifacts', { sessionId });
    list = (Array.isArray(rec) ? rec : rec?.artifacts || []).filter(isRasterArtifact);
  } catch {
    list = [];
  }
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'pw-insert-empty';
    empty.textContent = '工作区暂无图片';
    menu.appendChild(empty);
    return;
  }
  for (const rec of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.artifact = rec.artifactId;
    btn.textContent = rec.displayLabel || rec.name || rec.artifactId;
    menu.appendChild(btn);
  }
}

function probeImageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = src;
  });
}

async function insertWorkspaceImage(artifactId) {
  try {
    const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
    const mime = rec?.mimeType || rec?.artifact?.mimeType || 'image/png';
    const b64 = rec?.base64 || '';
    if (!b64) throw new Error('图片读不出');
    const src = `data:${mime};base64,${b64}`;
    const size = await probeImageSize(src);
    const id = hostApi?.insertImage?.({
      src,
      name: rec?.artifact?.name || 'image',
      mimeType: mime,
      w: size.w,
      h: size.h
    });
    if (!id) throw new Error('插入失败');
    setStatus('已插入');
    renderChrome(hostApi);
  } catch (e) {
    setStatus(e instanceof Error ? e.message : '插入失败');
  }
}

async function readTldrawLicenseKey() {
  try {
    if (!hasChrome() || !chrome.storage?.local) return '';
    const rec = await chrome.storage.local.get([TLDRAW_LICENSE_STORAGE_KEY]);
    return String(rec?.[TLDRAW_LICENSE_STORAGE_KEY] || '').trim();
  } catch {
    return '';
  }
}

async function boot() {
  const engine = document.getElementById('engine');
  if (!engine) return;
  const licenseKey = await readTldrawLicenseKey();
  const license = tldrawLicenseStatus({ licenseKey });
  document.body.dataset.tldrawLicense = license.productionReady ? 'ready' : 'missing';
  let snapshot;
  if (sessionId && artifactId) {
    try {
      const rec = await workspaceRpc('readArtifact', { sessionId, artifactId });
      const raw = rec?.content != null ? String(rec.content) : '';
      const title = rec?.artifact?.name || rec?.name || '';
      if (raw) shell = shellFromArtifactText(raw, shell);
      document.body.dataset.shell = shell;
      if (titleEl) {
        titleEl.textContent = (shell === 'slides' ? 'Paw Work Slides' : 'Paw Work Design') + (title ? ` · ${title}` : '');
      }
      if (raw && !isPawCanvasDoc(raw)) {
        const dest = previewEntryForItem({ text: raw, name: title }).entry || 'artifactPreview.html';
        if (dest !== 'design.html') {
          const q = new URLSearchParams(location.search);
          location.replace(`./${dest}?${q.toString()}`);
          return;
        }
      }
      pawDoc = isPawCanvasDoc(raw) ? parsePawCanvas(raw) : null;
      if (pawDoc) {
        snapshot = pawDoc.tldraw;
        lastJson = JSON.stringify(pawDoc);
      }
    } catch {
      /* empty board */
    }
  }
  const tldrawSnap = snapshotHasSchema(snapshot) ? snapshot : undefined;
  const recs = !tldrawSnap && pawDoc ? recordsFromPawCanvas(pawDoc) : { assets: [], shapes: [] };
  selBubble = mountOfficeSelBubble(document.body, { kind: 'canvas', copiedLabel: '已复制' });
  mountDesignCanvas(engine, {
    shell,
    licenseKey,
    snapshot: tldrawSnap,
    themeId: pawDoc?.themeId || '',
    doc: pawDoc,
    assets: recs.assets,
    shapes: recs.shapes.length ? recs.shapes : !tldrawSnap && pawDoc ? shapesFromPawCanvas(pawDoc) : [],
    onSelection: reportSelection,
    onChange(snap, api) {
      scheduleSave(snap);
      renderChrome(api || hostApi);
    },
    onHydrated(editor, api) {
      saveArmed = true;
      wireHost(api);
      api?.applyTheme?.(pawDoc?.themeId, pawDoc);
      api?.fitContent?.();
      if (shell === 'slides') {
        const fr = api.getLayerModel?.()?.frames?.[0];
        if (fr?.id) api.pinSlide?.(fr.id, { view: 'page', animate: false });
      }
      renderChrome(api);
    }
  });
  if (hasChrome()) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (
        handleWorkTabPickerMessage(msg, sendResponse, {
          getActive: () => pickActive,
          setActive: setPickActive
        })
      ) {
        return false;
      }
      const aid = String(msg?.artifactId || '');
      if (aid && artifactId && aid !== artifactId) {
        sendResponse({ ok: true, ignored: true });
        return false;
      }
      if (msg?.action === 'pawwork_canvas_apply') {
        void (async () => {
          try {
            if (msg.method === 'preview') {
              sendResponse({ ok: true, ...(await captureEnginePreview(msg.ids)) });
              return;
            }
            if (msg.method === 'export' || msg.format) {
              const fmt = String(msg.format || 'png').toLowerCase();
              let bytes;
              let mime = 'application/octet-stream';
              let filename = `${stem()}.${fmt}`;
              if (fmt === 'png') {
                bytes = await hostApi.exportPng();
                mime = 'image/png';
              } else if (fmt === 'svg') {
                bytes = await hostApi.exportSvg();
                mime = 'image/svg+xml';
              } else if (fmt === 'pdf') {
                const frames = await hostApi.exportFrames();
                const pages = [];
                for (const fr of frames) pages.push(await blobToJpegPage(fr.blob));
                bytes = jpegPagesToPdf(pages);
                mime = 'application/pdf';
              } else {
                const snap = hostApi.getSnapshot?.();
                const out = await exportPawCanvas(wrapSnap(snap || pawDoc), fmt, {
                  renderShape: (id) => hostApi.exportPng({ ids: [id], scale: 2, padding: 0 }),
                  renderFrame: (id) => hostApi.exportPng({ ids: [id], scale: 2, padding: 0 })
                });
                if (!out.ok) throw new Error(out.error || 'export failed');
                bytes = out.bytes;
                mime = out.mime;
                filename = out.filename;
              }
              const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
              let binary = '';
              for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
              sendResponse({
                ok: true,
                format: fmt,
                mime,
                filename,
                base64: btoa(binary)
              });
              return;
            }
            if (!hostApi?.applyCommands) throw new Error('engine applyCommands unavailable');
            const result = hostApi.applyCommands(msg.commands, msg.selections);
            saveArmed = true;
            ignorePatchUntil = Date.now() + 4000;
            if (result?.snapshot) await persistNow(result.snapshot);
            else await persistNow();
            let preview = null;
            if (msg.preview) {
              try {
                preview = await captureEnginePreview(result?.lastIds || msg.previewIds);
              } catch {
                preview = { skipped: 'EXPORT_FAILED', frames: [] };
              }
            }
            sendResponse({
              ok: result?.ok !== false,
              liveApplied: true,
              json: lastJson,
              applied: result?.applied || [],
              readback: result?.readback || null,
              dirty: result?.readback?.nodeId || '',
              ...(preview ? { preview } : {})
            });
          } catch (e) {
            sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        })();
        return true;
      }
      if (msg?.action !== 'pawwork_html_preview_patch') return false;
      if (msg.liveApplied) {
        sendResponse({ ok: true, skipped: true, liveApplied: true });
        return false;
      }
      void applyPatchFromStore().then((ok) => {
        sendResponse({ ok: true, patched: ok !== false, reload: false });
      });
      return true;
    });
    chrome.runtime
      .sendMessage({
        action: 'html_tab_ready',
        sessionId,
        artifactId
      })
      .catch(() => {});
  }
}

boot().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err));
});
