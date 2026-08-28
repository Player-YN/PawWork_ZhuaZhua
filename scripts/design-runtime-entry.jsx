/**
 * Preview-tab entry for Paw Work Design / Slides (tldraw engine).
 * Bundled to src/preview/vendor/design-runtime.js — never imported from node_modules in the extension.
 */
import './canvas-readback-hint.js';
import { createRoot } from 'react-dom/client';
import {
  Tldraw,
  createShapeId,
  toRichText,
  DefaultColorStyle,
  DefaultFontStyle,
  DefaultSizeStyle,
  DefaultTextAlignStyle,
  DefaultFillStyle,
  FrameShapeUtil,
  GeoShapeGeoStyle
} from 'tldraw';
import 'tldraw/tldraw.css';
import {
  normalizeCanvasOp,
  resolveOpIds,
  pinnedNodeIds,
  mapTldrawColor,
  mapTldrawSize,
  mapTldrawFont,
  mapTldrawAlign,
  mapAlignOperation,
  TEXT_OPS,
  IMAGE_OPS
} from '../src/agent/vnext/sessionWorkspace/canvasOps.js';
import {
  placeBlankSlide,
  slideCameraOptions,
  boxToBounds
} from '../src/agent/vnext/sessionWorkspace/slidesStage.js';
import {
  isTopLevelSlideFrame,
  migrateOverlappingSlideFrames,
  planDeleteFrame,
  planReorderByOrder,
  planReorderFrames,
  placeFramesInStrip,
  slideFallbackName,
  sortFramesForStrip
} from '../src/agent/vnext/sessionWorkspace/slidesLayout.js';
import { resolveTldrawLicenseKey, tldrawLicenseStatus } from '../src/agent/vnext/sessionWorkspace/tldrawLicense.js';
import { fillTldrawShapeProps, normalizeTldrawSnapshot } from '../src/agent/vnext/sessionWorkspace/tldrawShapeProps.js';
import {
  buildTldrawColorPalettes,
  CJK_SANS_STACK,
  CJK_SERIF_STACK,
  inferDocumentThemeId,
  themeCssVarMap
} from '../src/agent/vnext/sessionWorkspace/themeCatalog.js';

const PAW_THEME_STYLE_ID = 'paw-tldraw-theme-palette';
/* Verified tldraw 5.3.2 CSS vars on .tl-container: --tl-font-sans --tl-font-serif --tl-font-draw --tl-font-mono */

function applyThemeCssVars(hostEl, themeId) {
  const vars = themeCssVarMap(themeId);
  if (!vars || !hostEl || typeof hostEl.querySelector !== 'function') return vars;
  const scope = hostEl.closest?.('#engine') || hostEl;
  if (scope instanceof HTMLElement) {
    scope.setAttribute('data-paw-theme', themeId);
    for (const [name, value] of Object.entries(vars)) {
      scope.style.setProperty(name, value);
    }
  }
  const containers = hostEl.querySelectorAll?.('.tl-container, .paw-engine-host') || [];
  for (const el of containers) {
    if (!(el instanceof HTMLElement)) continue;
    el.setAttribute('data-paw-theme', themeId);
    for (const [name, value] of Object.entries(vars)) {
      el.style.setProperty(name, value);
    }
  }
  let sheet = hostEl.ownerDocument?.getElementById(PAW_THEME_STYLE_ID);
  if (!sheet && hostEl.ownerDocument) {
    sheet = hostEl.ownerDocument.createElement('style');
    sheet.id = PAW_THEME_STYLE_ID;
    hostEl.ownerDocument.head.appendChild(sheet);
  }
  if (sheet) {
    const decls = Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
    sheet.textContent = `#engine, #engine .paw-engine-host, #engine .tl-container, .paw-qa-engine, .paw-qa-engine .paw-engine-host, .paw-qa-engine .tl-container { ${decls} }`;
  }
  return vars;
}

function mergePalette(base, named) {
  const next = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [key, entry] of Object.entries(named || {})) {
    const prev = next[key] && typeof next[key] === 'object' ? next[key] : {};
    next[key] = { ...prev, ...entry };
  }
  return next;
}

/**
 * Paint catalog tokens onto tldraw 5.3.2 ThemeManager named colors.
 * Shape fills use getColorValue (JS palette), not --tl-color-*. Export uses the same theme.
 */
export function applyPawThemePalette(editor, hostEl, themeId) {
  const id = String(themeId || '').trim();
  const palettes = buildTldrawColorPalettes(id);
  if (!editor || !palettes) return null;
  const base = (typeof editor.getTheme === 'function' && editor.getTheme('default')) || editor.getCurrentTheme?.() || {};
  const tldrawThemeId = `paw-${id}`;
  const next = {
    ...base,
    id: tldrawThemeId,
    fonts: {
      ...(base.fonts || {}),
      sans: { ...(base.fonts?.sans || {}), fontFamily: CJK_SANS_STACK },
      serif: { ...(base.fonts?.serif || {}), fontFamily: CJK_SERIF_STACK }
    },
    colors: {
      light: mergePalette(base.colors?.light, palettes.light),
      dark: mergePalette(base.colors?.dark, palettes.dark)
    }
  };
  if (typeof editor.updateTheme === 'function') editor.updateTheme(next);
  if (typeof editor.setCurrentTheme === 'function') editor.setCurrentTheme(tldrawThemeId);
  const vars = applyThemeCssVars(hostEl, id);
  return { themeId: id, tldrawThemeId, vars };
}

export function inferPawThemeId(editor, doc) {
  const store = editor?.store?.serialize?.() || editor?.getSnapshot?.()?.document?.store || {};
  return inferDocumentThemeId(doc, store);
}

function shapeText(shape) {
  if (!shape) return '';
  const p = shape.props || {};
  if (typeof p.name === 'string' && shape.type === 'frame') return p.name;
  if (typeof p.text === 'string') return p.text;
  const rt = p.richText;
  if (rt && typeof rt === 'object') return walkRich(rt);
  return String(shape.meta?.pawText || '');
}

function walkRich(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.text === 'string') return node.text;
  return (Array.isArray(node.content) ? node.content : []).map(walkRich).join('');
}

function layerRecord(s) {
  return {
    id: s.id,
    type: s.type,
    parentId: s.parentId,
    text: shapeText(s),
    notes: String(s.meta?.pawNotes || ''),
    pawKind: String(s.meta?.pawType || s.meta?.pawKind || ''),
    isLocked: s.isLocked === true,
    hidden: Number(s.opacity) === 0
  };
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

function viewportReady(editor) {
  const b = editor?.getViewportScreenBounds?.();
  const w = Number(b?.width ?? b?.w);
  const h = Number(b?.height ?? b?.h);
  return Number.isFinite(w) && Number.isFinite(h) && w > 8 && h > 8;
}

function cameraSane(editor) {
  const cam = editor?.getCamera?.();
  if (!cam) return false;
  return (
    Number.isFinite(cam.x) &&
    Number.isFinite(cam.y) &&
    Number.isFinite(cam.z) &&
    cam.z > 0.001 &&
    cam.z < 64
  );
}

function frameBounds(editor) {
  const frames = (editor.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
  const selected = [...(editor.getSelectedShapeIds?.() || [])];
  let target = frames.find((f) => selected.includes(f.id));
  if (!target && selected.length) {
    let s = editor.getShape(selected[0]);
    while (s) {
      if (s.type === 'frame') {
        target = s;
        break;
      }
      s = s.parentId ? editor.getShape(s.parentId) : null;
    }
  }
  if (!target) target = frames[0];
  if (!target || !editor.getShapePageBounds) return null;
  return editor.getShapePageBounds(target);
}

function applySlideCamera(editor, state = {}) {
  if (!editor) return false;
  const view = state.view === 'overview' ? 'overview' : 'page';
  let bounds = boxToBounds(state.bounds);
  if (view === 'page' && !bounds) bounds = boxToBounds(frameBounds(editor));
  const cam = slideCameraOptions(bounds, view);
  try {
    const prev = typeof editor.getCameraOptions === 'function' ? editor.getCameraOptions() : {};
    editor.setCameraOptions({ ...prev, ...cam });
  } catch {
    /* engine variance */
  }
  const duration = state.animate ? 160 : 0;
  try {
    if (view === 'overview') {
      editor.zoomToFit?.({ animation: { duration } });
    } else if (cam.constraints?.bounds && typeof editor.zoomToBounds === 'function') {
      editor.zoomToBounds(cam.constraints.bounds, { force: true, animation: { duration } });
    }
  } catch {
    return false;
  }
  return cameraSane(editor);
}

function fitContent(editor, hostEl, shell, slideState) {
  if (!editor) return false;
  try {
    if (hostEl && typeof editor.updateViewportScreenBounds === 'function') {
      editor.updateViewportScreenBounds(hostEl);
    }
  } catch {
    /* measure later */
  }
  if (!viewportReady(editor)) return false;
  if (shell === 'slides') {
    const ok = applySlideCamera(editor, slideState || { view: 'page' });
    if (ok) return true;
  }
  try {
    const bounds = shell === 'slides' ? frameBounds(editor) : editor.getCurrentPageBounds?.();
    if (bounds && Number(bounds.width) > 0 && typeof editor.zoomToBounds === 'function') {
      editor.zoomToBounds(bounds, { animation: { duration: 0 }, inset: 48 });
    } else if (typeof editor.zoomToFit === 'function') {
      editor.zoomToFit({ animation: { duration: 0 } });
    }
  } catch {
    return false;
  }
  if (cameraSane(editor)) return true;
  try {
    editor.setCamera({ x: 0, y: 0, z: 1 });
  } catch {
    /* ignore */
  }
  return cameraSane(editor);
}

function contentInView(editor) {
  try {
    const page = editor.getCurrentPageBounds?.();
    const vp = editor.getViewportPageBounds?.();
    if (!page || !vp) return true;
    const pw = Number(page.width ?? page.w);
    const ph = Number(page.height ?? page.h);
    if (!(pw > 1 && ph > 1)) return true;
    const overlapW = Math.min(page.x + pw, vp.x + vp.w) - Math.max(page.x, vp.x);
    const overlapH = Math.min(page.y + ph, vp.y + vp.h) - Math.max(page.y, vp.y);
    return overlapW > 8 && overlapH > 8;
  } catch {
    return true;
  }
}

function bindViewport(editor, hostEl, shell, getSlideState) {
  if (!editor || !hostEl) return () => {};
  let fitted = false;
  let pointerDown = 0;
  const slideState = () => (typeof getSlideState === 'function' ? getSlideState() : { view: 'page' });
  const measure = () => {
    try {
      editor.updateViewportScreenBounds?.(hostEl);
    } catch {
      /* ignore */
    }
  };
  const sync = (opts = {}) => {
    measure();
    if (pointerDown > 0 && !opts.force) return;
    if (!viewportReady(editor)) return;
    if (!fitted) {
      fitted = fitContent(editor, hostEl, shell, slideState());
      return;
    }
    if (shell === 'slides') {
      applySlideCamera(editor, { ...slideState(), animate: false });
      return;
    }
    if (!cameraSane(editor) || opts.force) {
      fitContent(editor, hostEl, shell, slideState());
    }
  };
  const onDown = () => {
    pointerDown += 1;
  };
  const onUp = () => {
    pointerDown = Math.max(0, pointerDown - 1);
    if (pointerDown === 0) {
      window.requestAnimationFrame(() => {
        measure();
        if (!cameraSane(editor)) fitContent(editor, hostEl, shell, slideState());
      });
    }
  };
  sync();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (pointerDown > 0) {
      measure();
      return;
    }
    sync();
  }) : null;
  try {
    ro?.observe(hostEl);
  } catch {
    /* ignore */
  }
  const onWin = () => sync();
  window.addEventListener('resize', onWin);
  hostEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const interval = window.setInterval(() => {
    if (fitted && cameraSane(editor)) {
      window.clearInterval(interval);
      return;
    }
    if (pointerDown > 0) return;
    sync();
  }, 250);
  window.setTimeout(() => window.clearInterval(interval), 8000);
  return () => {
    window.removeEventListener('resize', onWin);
    hostEl.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.clearInterval(interval);
    try {
      ro?.disconnect();
    } catch {
      /* ignore */
    }
  };
}

/** Stable identities — a new options/components object remounts the editor and flashes .tl-loading over the canvas.
 * Inherit official SDK defaults (maxPages 40, all authoring tools). Do not cap pages.
 * Hide only surfaces we do not ship: collab, debug, loading flash.
 * Keep PageMenu, NavigationPanel, Minimap, VideoToolbar, Toolbar, StylePanel, ActionsMenu, ContextMenu, MainMenu.
 * Do not pass overrides that delete laser / asset / clipboard / undo actions.
 */
const TLDRAW_OPTIONS = { maxFontsToLoadBeforeRender: 0 };
const TLDRAW_COMPONENTS = {
  LoadingScreen: null,
  DebugPanel: null,
  DebugMenu: null,
  SharePanel: null,
  CursorChatBubble: null,
  PeopleMenu: null,
  FollowingIndicator: null
};
const TLDRAW_AUTHORING_TOOLS = [
  'select',
  'hand',
  'draw',
  'eraser',
  'text',
  'geo',
  'arrow',
  'line',
  'frame',
  'note',
  'highlight',
  'laser',
  'asset'
];
const TLDRAW_SHAPE_UTILS = [FrameShapeUtil.configure({ showColors: true })];

function currentFrameIds(editor, ids) {
  const selected = Array.isArray(ids) ? ids : [...(editor.getSelectedShapeIds?.() || [])];
  const frames = [];
  for (const id of selected) {
    let s = editor.getShape(id);
    while (s) {
      if (s.type === 'frame') {
        frames.push(s.id);
        break;
      }
      s = s.parentId ? editor.getShape(s.parentId) : null;
    }
  }
  if (frames.length) return [...new Set(frames)];
  const pageFrames = (editor.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
  return pageFrames.map((s) => s.id);
}

function applyLiveCommands(editor, commands, selections, shell) {
  const list = Array.isArray(commands) ? commands : [];
  const pinned = pinnedNodeIds(selections);
  const applied = [];
  let lastIds = [];
  if (typeof editor.markHistoryStoppingPoint === 'function') {
    editor.markHistoryStoppingPoint('agent');
  }
  const run = (fn) => {
    if (typeof editor.run === 'function') editor.run(fn);
    else fn();
  };
  run(() => {
    for (const cmd of list) {
      if (!cmd || typeof cmd !== 'object') continue;
      const op = normalizeCanvasOp(cmd.op || cmd.type);
      if (!op) continue;
      const ids = resolveOpIds(cmd, pinned.length ? pinned : [...(editor.getSelectedShapeIds?.() || [])]);
      const pick = () => {
        if (ids.length && typeof editor.setSelectedShapes === 'function') editor.setSelectedShapes(ids);
        else if (ids.length && typeof editor.select === 'function') {
          editor.select(...ids);
        }
      };
      try {
        if (TEXT_OPS.has(op)) {
          const id = ids[0];
          const shape = editor.getShape(id);
          if (!shape) continue;
          const text = cmd.text != null ? String(cmd.text) : cmd.value != null ? String(cmd.value) : '';
          if (shape.type === 'frame') {
            editor.updateShape({ id, type: 'frame', props: { ...shape.props, name: text } });
          } else if (shape.props?.richText != null || shape.type === 'text' || shape.type === 'geo' || shape.type === 'note') {
            editor.updateShape({
              id,
              type: shape.type,
              props: { ...shape.props, richText: toRichText(text) },
              meta: { ...shape.meta, pawText: text }
            });
          } else {
            editor.updateShape({
              id,
              type: shape.type,
              props: { ...shape.props, text },
              meta: { ...shape.meta, pawText: text }
            });
          }
          lastIds = [id];
          applied.push(op);
          continue;
        }
        if (IMAGE_OPS.has(op) && op !== 'propagateSlotSrc') {
          const id = ids[0];
          const shape = editor.getShape(id);
          if (!shape) continue;
          const src = String(cmd.src || cmd.value || '');
          let assetId = shape.props?.assetId;
          if (src && typeof editor.createAssets === 'function') {
            assetId = assetId || `asset:${String(id).replace(/^shape:/, '')}`;
            const w = Number(shape.props?.w) || 320;
            const h = Number(shape.props?.h) || 200;
            try {
              editor.createAssets([
                {
                  id: assetId,
                  typeName: 'asset',
                  type: 'image',
                  props: { w, h, name: assetId, isAnimated: false, mimeType: 'image/png', src },
                  meta: {}
                }
              ]);
            } catch {
              /* asset may already exist */
            }
          }
          editor.updateShape({
            id,
            type: shape.type,
            props: { ...shape.props, assetId, url: '' },
            meta: { ...shape.meta, src }
          });
          lastIds = [id];
          applied.push(op);
          continue;
        }
        if (op === 'propagateSlotSrc') {
          const srcShape = editor.getShape(ids[0]);
          const src = String(cmd.src || srcShape?.meta?.src || '');
          for (const s of editor.getCurrentPageShapes()) {
            if (s.type !== 'image' || s.id === ids[0]) continue;
            editor.updateShape({ id: s.id, type: 'image', meta: { ...s.meta, src } });
          }
          applied.push(op);
          continue;
        }
        if (op === 'setBox') {
          const id = ids[0];
          const shape = editor.getShape(id);
          if (!shape) continue;
          const b = cmd.box || cmd;
          editor.updateShape({
            id,
            type: shape.type,
            x: b.x != null ? Number(b.x) : shape.x,
            y: b.y != null ? Number(b.y) : shape.y,
            props: {
              ...shape.props,
              ...(b.w != null ? { w: Number(b.w) } : {}),
              ...(b.h != null ? { h: Number(b.h) } : {})
            }
          });
          lastIds = [id];
          applied.push(op);
          continue;
        }
        if (op === 'setFill' || op === 'setStyle') {
          pick();
          const color = mapTldrawColor(cmd.fill || cmd.color || cmd.style?.color);
          if (color && DefaultColorStyle) editor.setStyleForSelectedShapes(DefaultColorStyle, color);
          const font = mapTldrawFont(cmd.font || cmd.style?.font);
          if (font && DefaultFontStyle) editor.setStyleForSelectedShapes(DefaultFontStyle, font);
          const size = mapTldrawSize(cmd.size || cmd.style?.size);
          if (size && DefaultSizeStyle) editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
          const align = mapTldrawAlign(cmd.align || cmd.textAlign || cmd.style?.align);
          if (align && DefaultTextAlignStyle) editor.setStyleForSelectedShapes(DefaultTextAlignStyle, align);
          const fillKind = cmd.fillKind || cmd.style?.fill;
          if (fillKind && DefaultFillStyle) editor.setStyleForSelectedShapes(DefaultFillStyle, fillKind);
          if (cmd.geo) {
            for (const id of ids) {
              const shape = editor.getShape(id);
              if (shape?.type === 'geo') {
                editor.updateShape({ id, type: 'geo', props: { ...shape.props, geo: String(cmd.geo) } });
              }
            }
          }
          if (cmd.dash) {
            for (const id of ids) {
              const shape = editor.getShape(id);
              if (shape?.props && 'dash' in (shape.props || {})) {
                editor.updateShape({ id, type: shape.type, props: { ...shape.props, dash: String(cmd.dash) } });
              }
            }
          }
          lastIds = ids;
          applied.push(op);
          continue;
        }
        if (op === 'setOpacity' || op === 'hide' || op === 'show') {
          pick();
          const o =
            op === 'hide' ? 0 : op === 'show' ? 1 : Math.max(0, Math.min(1, Number(cmd.opacity ?? cmd.value ?? 1)));
          editor.setOpacityForSelectedShapes(o);
          applied.push(op);
          continue;
        }
        if (op === 'lock' || op === 'unlock') {
          for (const id of ids) {
            const shape = editor.getShape(id);
            if (shape) editor.updateShape({ id, type: shape.type, isLocked: op === 'lock' });
          }
          applied.push(op);
          continue;
        }
        if (op === 'setNotes') {
          const id = ids[0];
          const shape = editor.getShape(id);
          if (shape) {
            editor.updateShape({ id, type: shape.type, meta: { ...shape.meta, pawNotes: String(cmd.notes || cmd.text || '') } });
          }
          applied.push(op);
          continue;
        }
        if (op === 'align' && ids.length >= 2) {
          editor.alignShapes(ids, mapAlignOperation(cmd.align || cmd.value || cmd.axis));
          lastIds = ids;
          applied.push(op);
          continue;
        }
        if (op === 'distribute' && ids.length >= 2) {
          const axis = String(cmd.axis || cmd.value || 'horizontal').toLowerCase();
          editor.distributeShapes(ids, axis.startsWith('v') ? 'vertical' : 'horizontal');
          applied.push(op);
          continue;
        }
        if (op === 'pack' && ids.length) {
          editor.packShapes(ids, Number(cmd.gap) || 16);
          applied.push(op);
          continue;
        }
        if (op === 'stack' && ids.length >= 2) {
          const axis = String(cmd.axis || cmd.value || 'horizontal').toLowerCase();
          editor.stackShapes(ids, axis.startsWith('v') ? 'vertical' : 'horizontal', Number(cmd.gap) || 16);
          applied.push(op);
          continue;
        }
        if (op === 'stretch' && ids.length >= 2) {
          const axis = String(cmd.axis || cmd.value || 'horizontal').toLowerCase();
          editor.stretchShapes(ids, axis.startsWith('v') ? 'vertical' : 'horizontal');
          applied.push(op);
          continue;
        }
        if (op === 'flip') {
          const axis = String(cmd.axis || cmd.value || 'horizontal').toLowerCase();
          editor.flipShapes(ids, axis.startsWith('v') ? 'vertical' : 'horizontal');
          applied.push(op);
          continue;
        }
        if (op === 'rotate') {
          const deg = Number(cmd.degrees ?? cmd.deg ?? cmd.value) || 0;
          const rad = cmd.radians != null ? Number(cmd.radians) : (deg * Math.PI) / 180;
          editor.rotateShapesBy(ids, rad);
          applied.push(op);
          continue;
        }
        if (op === 'nudge') {
          editor.nudgeShapes(ids, {
            x: Number(cmd.x ?? cmd.dx ?? cmd.offset?.x) || 0,
            y: Number(cmd.y ?? cmd.dy ?? cmd.offset?.y) || 0
          });
          applied.push(op);
          continue;
        }
        if (op === 'group' && ids.length >= 2) {
          editor.groupShapes(ids);
          lastIds = [...editor.getSelectedShapeIds()];
          applied.push(op);
          continue;
        }
        if (op === 'ungroup') {
          editor.ungroupShapes(ids);
          applied.push(op);
          continue;
        }
        if (op === 'bringToFront') {
          editor.bringToFront(ids);
          applied.push(op);
          continue;
        }
        if (op === 'sendToBack') {
          editor.sendToBack(ids);
          applied.push(op);
          continue;
        }
        if (op === 'bringForward') {
          editor.bringForward(ids);
          applied.push(op);
          continue;
        }
        if (op === 'sendBackward') {
          editor.sendBackward(ids);
          applied.push(op);
          continue;
        }
        if (op === 'reparent') {
          const parentId = String(cmd.parentId || cmd.frameId || '');
          if (parentId && typeof editor.reparentShapes === 'function') editor.reparentShapes(ids, parentId);
          applied.push(op);
          continue;
        }
        if (op === 'delete' || op === 'deletePlate') {
          editor.deleteShapes(ids);
          if (shell === 'slides') {
            const remaining = sortFramesForStrip(topLevelPageFrames(editor)).map((f) => ({
              id: f.id,
              x: f.x,
              y: f.y,
              w: f.props?.w,
              h: f.props?.h,
              index: f.index
            }));
            applyStripBoxes(editor, planDeleteFrame(remaining, '').frames);
          }
          applied.push(op);
          lastIds = [];
          continue;
        }
        if (op === 'duplicate') {
          editor.duplicateShapes(ids);
          lastIds = [...editor.getSelectedShapeIds()];
          applied.push(op);
          continue;
        }
        if (op === 'reorder') {
          const order = Array.isArray(cmd.order || cmd.nodeIds) ? cmd.order || cmd.nodeIds : ids;
          const boxes = sortFramesForStrip(topLevelPageFrames(editor)).map((f) => ({
            id: f.id,
            x: f.x,
            y: f.y,
            w: f.props?.w,
            h: f.props?.h,
            index: f.index
          }));
          const planned = planReorderByOrder(boxes, order);
          if (planned.changed) applyStripBoxes(editor, planned.frames, { writeIndex: true });
          lastIds = planned.order.map(String);
          const keep = String(cmd.keepId || cmd.nodeId || lastIds[0] || '');
          if (keep && editor.getShape(keep)) editor.select(keep);
          applied.push(op);
          continue;
        }
        if (op === 'createFrame' || op === 'insertPlate' || op === 'createShape') {
          const type = op === 'createShape' ? String(cmd.shapeType || cmd.shape || 'geo') : 'frame';
          const id = createShapeId(String(cmd.id || type).replace(/^shape:/, ''));
          const slides = shell === 'slides';
          const w = Number(cmd.w || cmd.box?.w) || (type === 'frame' ? (slides ? 1920 : 960) : 240);
          const h = Number(cmd.h || cmd.box?.h) || (type === 'frame' ? (slides ? 1080 : 1440) : 120);
          const frames = topLevelPageFrames(editor);
          const lastFr = frames[frames.length - 1];
          let x =
            Number(cmd.x || cmd.box?.x) ||
            (type === 'frame' && lastFr ? lastFr.x + (Number(lastFr.props?.w) || w) + 200 : 80);
          let y = Number(cmd.y || cmd.box?.y) || (lastFr ? lastFr.y : 80);
          const text = String(cmd.text || cmd.value || cmd.name || '');
          if (slides && type === 'frame') {
            const afterId = String(cmd.afterId || cmd.after || '').trim();
            const boxes = frames.map((f) => ({ id: f.id, ...frameBox(editor, f), index: f.index }));
            let idx = afterId
              ? boxes.findIndex((f) => f.id === afterId || f.id === `shape:${afterId.replace(/^shape:/, '')}`)
              : boxes.length - 1;
            if (idx < 0) idx = boxes.length - 1;
            const { spec, next } = placeBlankSlide(boxes, idx, { w, h, name: text || slideFallbackName(boxes.length) });
            x = spec.x;
            y = spec.y;
            applyStripBoxes(editor, next.filter((f) => f.id));
          }
          const payload = {
            id,
            type: type === 'rect' ? 'geo' : type,
            x,
            y,
            props: {}
          };
          if (payload.type === 'frame') {
            payload.props = fillTldrawShapeProps('frame', {
              w,
              h,
              name: text || (slides ? slideFallbackName(frames.length) : 'Frame')
            });
          } else if (payload.type === 'text') {
            payload.props = fillTldrawShapeProps('text', { w, richText: toRichText(text), autoSize: false });
          } else if (payload.type === 'geo') {
            payload.props = fillTldrawShapeProps('geo', {
              w,
              h,
              geo: cmd.geo || 'rectangle',
              richText: toRichText(text)
            });
          } else if (payload.type === 'note') {
            payload.props = fillTldrawShapeProps('note', { richText: toRichText(text), color: 'yellow' });
          } else if (payload.type === 'arrow' || payload.type === 'line' || payload.type === 'highlight') {
            payload.props = fillTldrawShapeProps(payload.type, { color: 'black', size: 'm' });
          }
          if (cmd.parentId) payload.parentId = cmd.parentId;
          else if (payload.type !== 'frame') {
            const frameId = currentFrameIds(editor, ids)[0];
            if (frameId) payload.parentId = frameId;
          }
          editor.createShape(payload);
          lastIds = [id];
          if (payload.type === 'frame' && editor.zoomToBounds && editor.getShapePageBounds) {
            const b = editor.getShapePageBounds(editor.getShape(id));
            if (b) editor.zoomToBounds(b, { animation: { duration: 160 }, inset: 48 });
          }
          applied.push(op);
          continue;
        }
        if (op === 'theme') {
          const theme = cmd.theme && typeof cmd.theme === 'object' ? cmd.theme : cmd;
          const targets = ids.length ? ids : currentFrameIds(editor, ids);
          const kids = [];
          for (const fid of targets) {
            const shape = editor.getShape(fid);
            if (shape?.type === 'frame') {
              for (const s of editor.getCurrentPageShapes()) {
                if (s.parentId === fid) kids.push(s.id);
              }
            } else kids.push(fid);
          }
          if (kids.length) editor.setSelectedShapes(kids);
          const color = mapTldrawColor(theme.color || theme.fill || theme.primary);
          if (color && DefaultColorStyle) editor.setStyleForSelectedShapes(DefaultColorStyle, color);
          const font = mapTldrawFont(theme.font);
          if (font && DefaultFontStyle) editor.setStyleForSelectedShapes(DefaultFontStyle, font);
          const size = mapTldrawSize(theme.size);
          if (size && DefaultSizeStyle) editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
          applied.push(op);
          continue;
        }
        if (op === 'layout') {
          const frameId = currentFrameIds(editor, ids)[0];
          const kids = editor.getCurrentPageShapes().filter((s) => s.parentId === frameId).map((s) => s.id);
          const layout = String(cmd.layout || cmd.value || 'pack').toLowerCase();
          if (kids.length && layout.includes('stack')) {
            editor.stackShapes(kids, layout.includes('h') ? 'horizontal' : 'vertical', 16);
          } else if (kids.length && editor.packShapes) {
            editor.packShapes(kids, 16);
          }
          applied.push(op);
          continue;
        }
        if (op === 'select' && ids.length) {
          editor.setSelectedShapes?.(ids) || editor.select?.(...ids);
          applied.push(op);
          continue;
        }
        if (op === 'zoomToSelection') {
          editor.zoomToSelection?.({ animation: { duration: 160 } });
          applied.push(op);
          continue;
        }
        if (op === 'zoomToFit') {
          editor.zoomToFit?.({ animation: { duration: 160 } });
          applied.push(op);
          continue;
        }
        if (op === 'zoomToFrame') {
          const fid = currentFrameIds(editor, ids)[0];
          const shape = fid && editor.getShape(fid);
          if (shape && editor.zoomToBounds) {
            const b = editor.getShapePageBounds(shape);
            if (b) editor.zoomToBounds(b, { animation: { duration: 160 }, inset: 48 });
          }
          applied.push(op);
          continue;
        }
        if (op === 'crop' && ids[0] && typeof editor.setCroppingShape === 'function') {
          editor.setCroppingShape(ids[0]);
          applied.push(op);
        }
      } catch {
        /* skip invalid op; host still persists */
      }
    }
  });
  return { applied, lastIds };
}

function pageFrames(editor) {
  return (editor?.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
}

function topLevelPageFrames(editor) {
  const pageId = editor?.getCurrentPageId?.() || 'page:page';
  return pageFrames(editor).filter((s) => isTopLevelSlideFrame(s, pageId));
}

function applyStripBoxes(editor, frames, opts = {}) {
  const list = Array.isArray(frames) ? frames : [];
  for (let i = 0; i < list.length; i++) {
    const box = list[i];
    if (!box?.id) continue;
    editor.updateShape({ id: box.id, type: 'frame', x: box.x, y: box.y });
    if (!opts.writeIndex) continue;
    try {
      editor.updateShape({ id: box.id, type: 'frame', index: `a${(i + 1).toString(36)}` });
    } catch {
      /* fractional-index variance — strip x/y remain the order SoT */
    }
  }
}

function maybeMigrateSlideStrip(editor, shell) {
  if (shell !== 'slides' || !editor) return false;
  const frames = topLevelPageFrames(editor).map((f) => ({
    id: f.id,
    x: f.x,
    y: f.y,
    w: f.props?.w,
    h: f.props?.h,
    index: f.index
  }));
  const result = migrateOverlappingSlideFrames(frames);
  if (!result.migrated) return false;
  applyStripBoxes(editor, result.frames);
  return true;
}

function frameBox(editor, shape) {
  if (!editor || !shape) return null;
  return boxToBounds(editor.getShapePageBounds?.(shape) || { x: shape.x, y: shape.y, w: shape.props?.w, h: shape.props?.h });
}

function makeHostApi(getEditor, shell, getHostEl) {
  const slide = { view: 'page', frameId: '' };
  const slideState = () => {
    const editor = getEditor();
    const frames = pageFrames(editor);
    let target = slide.frameId ? editor?.getShape?.(slide.frameId) : null;
    if (!target || target.type !== 'frame') {
      target = frames.find((f) => f.id === slide.frameId) || frames[0] || null;
      slide.frameId = target?.id || '';
    }
    return { view: slide.view, bounds: frameBox(editor, target), frameId: slide.frameId };
  };
  return {
    getEditor,
    getSlideState: slideState,
    getSnapshot() {
      const editor = getEditor();
      if (!editor) return null;
      return editor.getSnapshot ? editor.getSnapshot() : { store: editor.store.serialize() };
    },
    loadSnapshot(snap) {
      const editor = getEditor();
      if (!editor || !snap || typeof editor.loadSnapshot !== 'function') return false;
      editor.loadSnapshot(normalizeTldrawSnapshot(snap));
      return true;
    },
    getLayerModel() {
      const editor = getEditor();
      if (!editor) return { pages: [], shapes: [], frames: [], tree: [], currentPageId: '' };
      const pages = editor.getPages().map((p) => ({ id: p.id, name: p.name || 'Page' }));
      const currentPageId = editor.getCurrentPageId();
      const shapes = editor.getCurrentPageShapesSorted().map(layerRecord);
      const frames =
        shell === 'slides'
          ? sortFramesForStrip(topLevelPageFrames(editor)).map(layerRecord)
          : shapes.filter((s) => s.type === 'frame');
      return {
        pages,
        shapes,
        frames,
        tree: nestLayerTree(shapes, currentPageId),
        currentPageId
      };
    },
    fitContent() {
      const editor = getEditor();
      return fitContent(editor, editor?.getContainer?.() || null, shell, slideState());
    },
    pinSlide(id, opts = {}) {
      const editor = getEditor();
      if (!editor) return false;
      if (opts.view === 'overview' || opts.view === 'page') slide.view = opts.view;
      if (id) {
        slide.frameId = id;
        if (slide.view === 'page') editor.select(id);
      }
      return applySlideCamera(editor, { ...slideState(), animate: opts.animate !== false });
    },
    setSlideView(view) {
      slide.view = view === 'overview' ? 'overview' : 'page';
      return this.pinSlide(slide.frameId, { view: slide.view, animate: true });
    },
    createBlankSlide(afterId) {
      const editor = getEditor();
      if (!editor) return '';
      const frames = topLevelPageFrames(editor);
      const boxes = frames.map((f) => ({ id: f.id, ...frameBox(editor, f), index: f.index }));
      const idx = afterId ? boxes.findIndex((f) => f.id === afterId) : boxes.length - 1;
      const { spec, next } = placeBlankSlide(boxes, idx);
      applyStripBoxes(editor, next.filter((f) => f.id));
      const id = createShapeId();
      editor.createShape({
        id,
        type: 'frame',
        x: spec.x,
        y: spec.y,
        parentId: editor.getCurrentPageId(),
        props: { w: spec.w, h: spec.h, name: spec.name }
      });
      slide.view = 'page';
      this.pinSlide(id, { view: 'page' });
      return id;
    },
    duplicateSlide(id) {
      const editor = getEditor();
      const shape = editor?.getShape?.(id);
      if (!editor || !shape || shape.type !== 'frame') return '';
      const frames = topLevelPageFrames(editor);
      if (typeof editor.duplicateShapes === 'function') {
        editor.duplicateShapes([id]);
      } else {
        return this.createBlankSlide(id);
      }
      const after = topLevelPageFrames(editor);
      const dup = after.find((f) => f.id !== id && !frames.some((p) => p.id === f.id));
      const dupId = dup?.id || [...(editor.getSelectedShapeIds?.() || [])].find((sid) => sid !== id) || '';
      if (dupId) {
        const ordered = sortFramesForStrip(frames).map((f) => f.id);
        const srcIdx = ordered.indexOf(id);
        const nextIds = [...ordered.slice(0, srcIdx + 1), dupId, ...ordered.slice(srcIdx + 1)];
        const boxes = nextIds.map((fid) => {
          const f = editor.getShape(fid);
          const box = frameBox(editor, f);
          return { id: fid, ...(box || {}), w: box?.w || f?.props?.w, h: box?.h || f?.props?.h };
        });
        applyStripBoxes(editor, placeFramesInStrip(boxes));
        slide.view = 'page';
        this.pinSlide(dupId, { view: 'page' });
      }
      return dupId;
    },
    deleteSlide(id) {
      const editor = getEditor();
      const frames = topLevelPageFrames(editor);
      if (!editor || frames.length <= 1) return false;
      const idx = frames.findIndex((f) => f.id === id);
      if (idx < 0) return false;
      editor.deleteShapes([id]);
      const remaining = sortFramesForStrip(topLevelPageFrames(editor)).map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        w: f.props?.w,
        h: f.props?.h,
        index: f.index
      }));
      applyStripBoxes(editor, planDeleteFrame(remaining, '').frames);
      const next = remaining[idx] || remaining[idx - 1];
      if (next && next.id !== id) this.pinSlide(next.id, { view: 'page' });
      return true;
    },
    /**
     * Reorder top-level slide Frames in the host strip.
     * One tldraw history transaction via editor.run + markHistoryStoppingPoint.
     * Does not create/delete/duplicate. Pin + camera follow `id` / moved frame.
     */
    reorderSlides(spec = {}) {
      const editor = getEditor();
      if (!editor) return { ok: false, changed: false, order: [], frameId: '' };
      const boxes = sortFramesForStrip(topLevelPageFrames(editor)).map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        w: f.props?.w,
        h: f.props?.h,
        index: f.index
      }));
      const orderArg = Array.isArray(spec) ? spec : spec.order;
      const planned = Array.isArray(orderArg)
        ? planReorderByOrder(boxes, orderArg)
        : planReorderFrames(
            boxes,
            spec.fromIndex != null
              ? spec.fromIndex
              : boxes.findIndex((f) => f.id === spec.id || f.id === `shape:${String(spec.id || '').replace(/^shape:/, '')}`),
            spec.toIndex
          );
      const keepId =
        String(spec.id || spec.keepId || (Number.isInteger(planned.from) ? boxes[planned.from]?.id : '') || slide.frameId || '').trim();
      if (!planned.changed) {
        return { ok: true, changed: false, order: boxes.map((f) => f.id), frameId: keepId || slide.frameId };
      }
      const apply = () => applyStripBoxes(editor, planned.frames, { writeIndex: true });
      if (typeof editor.markHistoryStoppingPoint === 'function') {
        editor.markHistoryStoppingPoint('reorderSlides');
      }
      if (typeof editor.run === 'function') editor.run(apply);
      else apply();
      if (keepId && editor.getShape(keepId)) {
        this.pinSlide(keepId, { view: spec.view || 'page', animate: spec.animate !== false });
      }
      return { ok: true, changed: true, order: planned.order, frameId: keepId };
    },
    insertImage(opts = {}) {
      const editor = getEditor();
      const src = String(opts.src || '');
      if (!editor || !src) return '';
      const w = Number(opts.w) > 0 ? Number(opts.w) : 800;
      const h = Number(opts.h) > 0 ? Number(opts.h) : 600;
      const name = String(opts.name || 'image');
      const mimeType = String(opts.mimeType || 'image/png');
      const assetId = `asset:${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        editor.createAssets?.([
          {
            id: assetId,
            typeName: 'asset',
            type: 'image',
            props: { w, h, name, isAnimated: false, mimeType, src }
          }
        ]);
      } catch {
        /* asset may already exist */
      }
      const id = createShapeId();
      const frame = slide.frameId ? editor.getShape(slide.frameId) : pageFrames(editor)[0];
      const box = frameBox(editor, frame);
      const vp = editor.getViewportPageBounds?.();
      const x = box ? box.x + 48 : Number(vp?.x || 0) + 80;
      const y = box ? box.y + 48 : Number(vp?.y || 0) + 80;
      editor.createShape({
        id,
        type: 'image',
        x,
        y,
        parentId: frame?.id || editor.getCurrentPageId(),
        props: fillTldrawShapeProps('image', {
          w: Math.min(w, box ? box.w - 96 : w),
          h: Math.min(h, box ? box.h - 96 : h),
          assetId
        })
      });
      editor.select(id);
      return id;
    },
    setTool(id, geo) {
      const editor = getEditor();
      if (!editor) return;
      const tool = String(id || 'select');
      if (geo && GeoShapeGeoStyle && typeof editor.setStyleForNextShapes === 'function') {
        try {
          editor.setStyleForNextShapes(GeoShapeGeoStyle, geo);
        } catch {
          /* style id variance */
        }
      }
      if (typeof editor.setCurrentTool === 'function') editor.setCurrentTool(tool);
    },
    select(id) {
      const editor = getEditor();
      if (!editor || !id) return;
      editor.select(id);
    },
    getSelectionScreenBounds() {
      const editor = getEditor();
      const b =
        editor?.getSelectionRotatedScreenBounds?.() ||
        editor?.getSelectionScreenBounds?.() ||
        null;
      if (!b) return null;
      const x = Number(b.x ?? b.left);
      const y = Number(b.y ?? b.top);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        x,
        y,
        left: x,
        top: y,
        w: Number(b.w ?? b.width) || 0,
        h: Number(b.h ?? b.height) || 0,
        width: Number(b.width ?? b.w) || 0,
        height: Number(b.height ?? b.h) || 0
      };
    },
    setPage(id) {
      const editor = getEditor();
      if (!editor || !id) return;
      editor.setCurrentPage(id);
    },
    setNotes(id, text) {
      const editor = getEditor();
      const shape = editor?.getShape(id);
      if (!editor || !shape) return;
      editor.updateShape({ id, type: shape.type, meta: { ...shape.meta, pawNotes: String(text || '') } });
    },
    async exportPng(opts = {}) {
      const editor = getEditor();
      if (!editor || typeof editor.toImage !== 'function') {
        throw new Error('engine exportPng unavailable');
      }
      const ids = opts.ids?.length ? opts.ids : currentFrameIds(editor);
      const target = ids.length ? ids : [...editor.getCurrentPageShapeIds()];
      const { blob } = await editor.toImage(target, {
        format: 'png',
        scale: Number(opts.scale) || 2,
        background: opts.background !== false,
        padding: opts.padding != null ? Number(opts.padding) : 0
      });
      const buf = await blob.arrayBuffer();
      return new Uint8Array(buf);
    },
    async exportSvg(opts = {}) {
      const editor = getEditor();
      if (!editor || typeof editor.getSvgString !== 'function') {
        throw new Error('engine exportSvg unavailable');
      }
      const ids = opts.ids?.length ? opts.ids : currentFrameIds(editor);
      const target = ids.length ? ids : [...editor.getCurrentPageShapeIds()];
      const out = await editor.getSvgString(target, {
        background: opts.background !== false,
        padding: opts.padding != null ? Number(opts.padding) : 0
      });
      const svg = typeof out === 'string' ? out : out?.svg || '';
      return new TextEncoder().encode(svg);
    },
    async exportFrames(opts = {}) {
      const editor = getEditor();
      if (!editor || typeof editor.toImage !== 'function') return [];
      const frames = (editor.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
      const list = Array.isArray(opts.frames) && opts.frames.length
        ? opts.frames
        : frames.length
          ? frames
          : [{ id: null, props: { name: 'Page' } }];
      const limit = Number(opts.limit) > 0 ? Number(opts.limit) : list.length;
      const out = [];
      for (const fr of list.slice(0, limit)) {
        const ids = fr.id ? [fr.id] : [...editor.getCurrentPageShapeIds()];
        const { blob } = await editor.toImage(ids, {
          format: 'png',
          scale: Number(opts.scale) || 2,
          background: true,
          padding: 0
        });
        out.push({
          id: fr.id,
          name: String(fr.props?.name || 'Frame'),
          bytes: new Uint8Array(await blob.arrayBuffer()),
          blob
        });
      }
      return out;
    },
    async exportPreview(opts = {}) {
      const editor = getEditor();
      if (!editor || typeof editor.toImage !== 'function') return [];
      const max = Number(opts.maxFrames) || 4;
      const want = new Set((opts.ids || []).map((id) => String(id || '')));
      const frames = (editor.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
      let list = frames.length ? frames : [{ id: null, props: { name: 'Page' } }];
      if (want.size) {
        const picked = [];
        for (const fr of list) {
          if (want.has(fr.id)) picked.push(fr);
        }
        for (const id of want) {
          let cur = editor.getShape?.(id);
          while (cur?.parentId) {
            const parent = editor.getShape?.(cur.parentId);
            if (parent?.type === 'frame') {
              if (!picked.some((f) => f.id === parent.id)) picked.push(parent);
              break;
            }
            cur = parent;
          }
        }
        if (picked.length) list = picked;
      }
      return this.exportFrames({ scale: 1, limit: max, frames: list });
    },
    applyCommands(commands, selections) {
      const editor = getEditor();
      if (!editor) return { ok: false, error: 'editor unavailable' };
      const result = applyLiveCommands(editor, commands, selections, shell);
      const snap = editor.getSnapshot ? editor.getSnapshot() : null;
      const selected = [...(editor.getSelectedShapeIds?.() || [])];
      const last = result.lastIds?.[0] || selected[0] || '';
      const shape = last ? editor.getShape(last) : null;
      return {
        ok: true,
        applied: result.applied,
        lastIds: result.lastIds,
        snapshot: snap,
        readback: {
          nodeId: last,
          nodeIds: result.lastIds || selected,
          type: shape?.type || '',
          text: shapeText(shape),
          notes: String(shape?.meta?.pawNotes || '')
        }
      };
    },
    applyTheme(themeId, doc) {
      const editor = getEditor();
      const host = typeof getHostEl === 'function' ? getHostEl() : null;
      const id = String(themeId || inferPawThemeId(editor, doc) || '').trim();
      return applyPawThemePalette(editor, host, id);
    }
  };
}

/**
 * @param {HTMLElement} el
 * @param {{
 *   shell?: string,
 *   licenseKey?: string,
 *   snapshot?: object,
 *   shapes?: object[],
 *   onMount?: Function,
 *   onChange?: Function,
 *   onSelection?: Function,
 *   onHydrated?: Function
 * }} [opts]
 *
 * licenseKey is the official tldraw 5.3.2 `<Tldraw licenseKey>` prop.
 * Prefer mount option, then build-time PAW_TLDRAW_LICENSE_KEY. Missing key
 * keeps official watermark/dev behavior and reports productionReady=false.
 */
export function mountDesignCanvas(el, opts = {}) {
  const root = createRoot(el);
  const resolvedLicense = resolveTldrawLicenseKey({ licenseKey: opts.licenseKey });
  const licenseKey = resolvedLicense.key;
  const license = tldrawLicenseStatus({ licenseKey: opts.licenseKey });
  let editorRef = null;
  const api = makeHostApi(() => editorRef, opts.shell, () => el);

  function Engine() {
    return (
      <div className="paw-engine-host" style={{ position: 'absolute', inset: 0 }}>
        <Tldraw
          licenseKey={licenseKey || undefined}
          snapshot={opts.snapshot ? normalizeTldrawSnapshot(opts.snapshot) : undefined}
          autoFocus={false}
          options={TLDRAW_OPTIONS}
          components={TLDRAW_COMPONENTS}
          shapeUtils={TLDRAW_SHAPE_UTILS}
          onMount={(editor) => {
            editorRef = editor;
            try {
              opts.onMount?.(editor, api);
            } catch {
              /* host must not throw */
            }
            const store = editor.store;
            const assets = Array.isArray(opts.assets) ? opts.assets : [];
            if (assets.length && typeof editor.createAssets === 'function') {
              try {
                editor.createAssets(assets);
              } catch {
                /* skip invalid assets */
              }
            }
            const shapes = Array.isArray(opts.shapes) ? opts.shapes : [];
            if (shapes.length) {
              for (const payload of shapes) {
                try {
                  if (payload?.id && editor.getShape(payload.id)) continue;
                  const next = { ...payload };
                  if (next.type) next.props = fillTldrawShapeProps(next.type, next.props);
                  editor.createShape(next);
                } catch {
                  /* skip invalid record */
                }
              }
            } else if (!editor.getCurrentPageShapes().some((s) => s.type === 'frame')) {
              const id = createShapeId('frame');
              editor.createShape({
                id,
                type: 'frame',
                x: 80,
                y: 80,
                props: fillTldrawShapeProps('frame', {
                  w: opts.shell === 'slides' ? 1920 : 960,
                  h: opts.shell === 'slides' ? 1080 : 1440,
                  name: opts.shell === 'slides' ? slideFallbackName(0) : 'Frame'
                })
              });
            }
            maybeMigrateSlideStrip(editor, opts.shell);
            bindViewport(editor, el, opts.shell, () => api.getSlideState?.());
            try {
              const themeId = String(opts.themeId || inferPawThemeId(editor, opts.doc) || '').trim();
              if (themeId) applyPawThemePalette(editor, el, themeId);
            } catch {
              /* theme is optional */
            }
            try {
              opts.onHydrated?.(editor, api);
            } catch {
              /* host */
            }
            const emitSel = () => {
              const ids = editor.getSelectedShapeIds();
              const nodes = ids.map((id) => {
                const s = editor.getShape(id);
                return {
                  nodeId: String(id),
                  type: s?.type || '',
                  text: shapeText(s),
                  notes: String(s?.meta?.pawNotes || '')
                };
              });
              try {
                opts.onSelection?.(nodes, api);
              } catch {
                /* host */
              }
            };
            store.listen(
              () => {
                try {
                  const snap = editor.getSnapshot ? editor.getSnapshot() : { store: store.serialize() };
                  opts.onChange?.(snap, api);
                } catch {
                  /* host */
                }
              },
              { source: 'user', scope: 'document' }
            );
            store.listen(emitSel);
            emitSel();
          }}
        />
      </div>
    );
  }

  root.render(<Engine />);
  return {
    unmount() {
      root.unmount();
    },
    license,
    ...api
  };
}

export {
  makeHostApi,
  TLDRAW_AUTHORING_TOOLS,
  TLDRAW_COMPONENTS,
  TLDRAW_OPTIONS,
  inferDocumentThemeId,
  resolveTldrawLicenseKey,
  tldrawLicenseStatus
};
