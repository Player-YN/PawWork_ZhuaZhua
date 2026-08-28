/**
 * Component-library presets for Design/Slides (HANDOFF Q2=B).
 * Speech bubbles / comic panels / title bars / color blocks compile to
 * deterministic geo+text createShape commands; icons compile to image shapes
 * fed by the packaged Lucide subset. Presets are capability, not policy:
 * expansion happens in the deck write path before selection checks and before
 * the live editor sees the commands, so both the headless JSON path and the
 * live tab receive plain ops they already understand.
 */

import { CANVAS_ICONS } from './canvasIconPack.js';
import { COMMON_ICON_IDS, compactIconCatalog } from './iconCatalog.js';

const COMPONENT_PRESETS = {
  'speech-bubble': {
    name: '对话气泡 Speech bubble',
    build(cmd, ids) {
      const x = num(cmd.x, 80);
      const y = num(cmd.y, 80);
      const w = num(cmd.w, 320);
      const h = num(cmd.h, 150);
      return [
        {
          op: 'createShape',
          id: ids.next('bubble'),
          shapeType: 'geo',
          geo: 'oval',
          x,
          y,
          w,
          h,
          fill: cmd.fill || 'white',
          fillKind: 'semi',
          text: textOf(cmd),
          parentId: cmd.parentId
        },
        {
          op: 'createShape',
          id: ids.next('bubble-tail'),
          shapeType: 'geo',
          geo: 'triangle',
          x: x + Math.round(w * 0.18),
          y: y + h - 6,
          w: 36,
          h: 30,
          degrees: 180,
          fill: cmd.fill || 'white',
          fillKind: 'semi',
          parentId: cmd.parentId
        }
      ];
    }
  },
  'thought-bubble': {
    name: '思考气泡 Thought bubble',
    build(cmd, ids) {
      const x = num(cmd.x, 80);
      const y = num(cmd.y, 80);
      const w = num(cmd.w, 300);
      const h = num(cmd.h, 150);
      return [
        {
          op: 'createShape',
          id: ids.next('thought'),
          shapeType: 'geo',
          geo: 'cloud',
          x,
          y,
          w,
          h,
          fill: cmd.fill || 'white',
          fillKind: 'semi',
          text: textOf(cmd),
          parentId: cmd.parentId
        },
        {
          op: 'createShape',
          id: ids.next('thought-dot1'),
          shapeType: 'geo',
          geo: 'ellipse',
          x: x + Math.round(w * 0.16),
          y: y + h + 6,
          w: 26,
          h: 20,
          fill: cmd.fill || 'white',
          fillKind: 'semi',
          parentId: cmd.parentId
        },
        {
          op: 'createShape',
          id: ids.next('thought-dot2'),
          shapeType: 'geo',
          geo: 'ellipse',
          x: x + Math.round(w * 0.08),
          y: y + h + 30,
          w: 14,
          h: 12,
          fill: cmd.fill || 'white',
          fillKind: 'semi',
          parentId: cmd.parentId
        }
      ];
    }
  },
  'shout-bubble': {
    name: '爆炸气泡 Shout bubble',
    build(cmd, ids) {
      return [
        {
          op: 'createShape',
          id: ids.next('shout'),
          shapeType: 'geo',
          geo: 'star',
          x: num(cmd.x, 80),
          y: num(cmd.y, 80),
          w: num(cmd.w, 300),
          h: num(cmd.h, 220),
          fill: cmd.fill || 'yellow',
          fillKind: 'semi',
          text: textOf(cmd),
          parentId: cmd.parentId
        }
      ];
    }
  },
  'comic-panel': {
    name: '漫画格 Comic panel',
    build(cmd, ids) {
      return [
        {
          op: 'createShape',
          id: ids.next('panel'),
          shapeType: 'geo',
          geo: 'rectangle',
          x: num(cmd.x, 40),
          y: num(cmd.y, 40),
          w: num(cmd.w, 420),
          h: num(cmd.h, 420),
          fill: cmd.fill || 'black',
          fillKind: 'none',
          dash: 'solid',
          size: 'l',
          text: '',
          parentId: cmd.parentId
        }
      ];
    }
  },
  'title-bar': {
    name: '标题条 Title bar',
    build(cmd, ids) {
      return [
        {
          op: 'createShape',
          id: ids.next('title-bar'),
          shapeType: 'geo',
          geo: 'rectangle',
          x: num(cmd.x, 40),
          y: num(cmd.y, 40),
          w: num(cmd.w, 640),
          h: num(cmd.h, 88),
          fill: cmd.fill || 'blue',
          fillKind: 'semi',
          size: 'xl',
          text: textOf(cmd),
          parentId: cmd.parentId
        }
      ];
    }
  },
  'caption-strip': {
    name: '旁白条 Caption strip',
    build(cmd, ids) {
      return [
        {
          op: 'createShape',
          id: ids.next('caption'),
          shapeType: 'geo',
          geo: 'rectangle',
          x: num(cmd.x, 40),
          y: num(cmd.y, 40),
          w: num(cmd.w, 480),
          h: num(cmd.h, 56),
          fill: cmd.fill || 'yellow',
          fillKind: 'semi',
          size: 's',
          text: textOf(cmd),
          parentId: cmd.parentId
        }
      ];
    }
  },
  'color-block': {
    name: '色块 Color block',
    build(cmd, ids) {
      return [
        {
          op: 'createShape',
          id: ids.next('block'),
          shapeType: 'geo',
          geo: 'rectangle',
          x: num(cmd.x, 40),
          y: num(cmd.y, 40),
          w: num(cmd.w, 240),
          h: num(cmd.h, 160),
          fill: cmd.fill || 'blue',
          fillKind: 'solid',
          text: textOf(cmd),
          parentId: cmd.parentId
        }
      ];
    }
  }
};

const ICON_PREFIX = 'icon:';
const DEFAULT_ICON_TINT = '#1a1a1a';

export function listCanvasPresets() {
  const components = Object.entries(COMPONENT_PRESETS).map(([id, def]) => ({
    id,
    name: def.name,
    kind: 'component'
  }));
  const icons = COMMON_ICON_IDS.map((id) => ({
    id: `${ICON_PREFIX}${id}`,
    name: id,
    kind: 'icon'
  }));
  return [...components, ...icons];
}

/** Compact catalog for the deck read surface (ids only, grouped). Never dumps the full icon pack. */
export function compactPresetCatalog() {
  const icons = compactIconCatalog();
  return {
    components: Object.keys(COMPONENT_PRESETS),
    icons: {
      count: icons.count,
      common: icons.common.map((id) => `${ICON_PREFIX}${id}`),
      hint: icons.hint
    }
  };
}

export function iconSvgDataUrl(iconId, color) {
  const key = String(iconId || '').replace(ICON_PREFIX, '');
  const svg = CANVAS_ICONS[key];
  if (!svg) return '';
  const tinted = svg.replace(/currentColor/g, safeCssColor(color) || DEFAULT_ICON_TINT);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
}

export function isPresetCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return false;
  const preset = String(cmd.preset || '').trim();
  if (!preset) return false;
  const op = String(cmd.op || '').trim();
  return op === '' || op === 'createShape' || op === 'insertPreset';
}

/**
 * Replace preset commands with concrete createShape (+setSlotSrc) ops.
 * Non-preset commands pass through untouched.
 * @returns {{ commands: object[], unknown: string[] }}
 */
export function expandPresetCommands(commands) {
  const list = Array.isArray(commands) ? commands : [];
  const out = [];
  const unknown = [];
  let n = 0;
  const ids = {
    next(base) {
      n += 1;
      return `${base}_${Date.now().toString(36)}_${n}`;
    }
  };
  for (const cmd of list) {
    if (!isPresetCommand(cmd)) {
      out.push(cmd);
      continue;
    }
    const preset = String(cmd.preset || '').trim();
    if (preset.startsWith(ICON_PREFIX) || CANVAS_ICONS[preset]) {
      const src = iconSvgDataUrl(preset, cmd.color || cmd.fill);
      if (!src) {
        unknown.push(preset);
        continue;
      }
      const sid = ids.next(`icon-${preset.replace(ICON_PREFIX, '').replace(/[^a-z0-9-]/gi, '')}`);
      const w = num(cmd.w, 96);
      const h = num(cmd.h, 96);
      out.push(
        {
          op: 'createShape',
          id: sid,
          shapeType: 'image',
          x: num(cmd.x, 60),
          y: num(cmd.y, 60),
          w,
          h,
          parentId: cmd.parentId
        },
        { op: 'setSlotSrc', nodeId: `shape:${sid}`, src }
      );
      continue;
    }
    const def = COMPONENT_PRESETS[preset];
    if (!def) {
      unknown.push(preset);
      continue;
    }
    out.push(...def.build(cmd, ids));
  }
  return { commands: out, unknown };
}

function textOf(cmd) {
  if (cmd.text != null) return String(cmd.text);
  if (cmd.value != null) return String(cmd.value);
  return '';
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : v === 0 ? 0 : fallback;
}

function safeCssColor(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^[a-z-]{3,24}$/i.test(s)) return s;
  return '';
}
