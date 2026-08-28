/**
 * Compile semantic themeId + layoutId + slots into scene nodes (boxes, text, geo, icons).
 * Model never authors x/y/w/h on this path. Host geometry is deterministic.
 */

import {
  ALL_LAYOUT_IDS,
  allowedSlots,
  aliasToCanonical,
  columnInnerBoxes,
  compactLayoutCatalog,
  getLayout,
  listBoxes,
  POSTER_LAYOUT_IDS,
  SLIDE_LAYOUT_IDS
} from './layoutCatalog.js';
import { DEFAULT_THEME_ID, getTheme, listThemeIds, resolvePageVariant, THEME_IDS, tldrawColorForRole } from './themeCatalog.js';
import { normalizeSlideMotion, slideMotionMeta } from './slideMotion.js';
import { compileVisual, isPackagedIconVisual, validateVisual } from './visualAssets.js';

export { compactLayoutCatalog, listThemeIds, THEME_IDS, SLIDE_LAYOUT_IDS, POSTER_LAYOUT_IDS };

const LIST_SLOTS = new Set(['items', 'steps', 'stats', 'cells', 'panels']);
const VISUAL_SLOTS = new Set(['visual']);

/** Native tldraw size + scale. xl≈44–48px; cover uses scale so titles reach 88–120. */
const TYPE = Object.freeze({
  cover: { size: 'xl', scale: 2.35 },
  section: { size: 'xl', scale: 1.85 },
  page: { size: 'xl', scale: 1.22 },
  quote: { size: 'xl', scale: 1.55 },
  stat: { size: 'xl', scale: 2.45 },
  number: { size: 'xl', scale: 2.1 },
  heading: { size: 'l', scale: 1 },
  body: { size: 'l', scale: 1 },
  caption: { size: 'm', scale: 1 },
  kicker: { size: 'm', scale: 1 }
});

export function isSemanticFrame(frame) {
  if (!frame || typeof frame !== 'object') return false;
  if (String(frame.layoutId || '').trim()) return true;
  return !!(frame.slots && typeof frame.slots === 'object' && !Array.isArray(frame.slots));
}

export function compileLayoutFrame(frame = {}, opts = {}) {
  const layoutId = String(frame.layoutId || opts.layoutId || '').trim();
  const layout = getLayout(layoutId);
  if (!layout) {
    return {
      ok: false,
      error: `unknown layoutId "${layoutId || ''}" (allowed: ${ALL_LAYOUT_IDS.join(', ')})`
    };
  }
  const themeId = String(frame.themeId || opts.themeId || DEFAULT_THEME_ID).trim() || DEFAULT_THEME_ID;
  const theme = getTheme(themeId);
  if (!theme) {
    return {
      ok: false,
      error: `unknown themeId "${themeId}" (allowed: ${THEME_IDS.join(', ')})`
    };
  }
  const variantInput = frame.variant || frame.pawVariant || frame.meta?.pawVariant || opts.variant;
  const resolvedVariant = resolvePageVariant(variantInput, layout.id);
  if (!resolvedVariant.ok) return resolvedVariant;
  const variant = resolvedVariant.variant;
  const rawSlots = frame.slots && typeof frame.slots === 'object' && !Array.isArray(frame.slots) ? frame.slots : {};
  const slots = canonicalizeSlots(layout, rawSlots);
  if (!slots.ok) return slots;

  const missing = (layout.required || []).filter((name) => !slotPresent(name, slots.value));
  if (missing.length) {
    return { ok: false, error: `layout "${layout.id}" requires slot "${missing[0]}"` };
  }

  const bound = enforceLimits(layout, slots.value);
  if (!bound.ok) return bound;
  const visualErr = validateVisuals(slots.value);
  if (visualErr) return { ok: false, error: visualErr };

  const index = Number(opts.index) || 0;
  const kind = layout.kind === 'poster' ? 'poster' : 'deck';
  const frameId = String(frame.id || (kind === 'deck' ? `slide-${index + 1}` : index === 0 ? 'poster' : `frame-${index + 1}`));
  const paper = layout.paper;
  const nodes = emitNodes({
    frameId,
    layout,
    theme,
    variant,
    slots: slots.value,
    paper
  });
  const titleText = firstText(slots.value, ['title', 'quote', 'kicker']) || layout.id;
  const motion = normalizeSlideMotion(frame, { semantic: true });
  return {
    ok: true,
    layoutId: layout.id,
    themeId: theme.id,
    variant,
    frame: {
      id: frameId,
      name: String(frame.name || frame.title || titleText),
      notes: String(frame.notes || ''),
      layoutId: layout.id,
      themeId: theme.id,
      variant,
      transition: motion.transition,
      animation: motion.animation,
      nodes,
      size: { ...paper },
      overflow: false,
      meta: { pawLayout: layout.id, pawTheme: theme.id, pawVariant: variant, ...slideMotionMeta(frame, { semantic: true }) }
    }
  };
}

export function compileSemanticFrames(frameList, opts = {}) {
  const list = Array.isArray(frameList) ? frameList : [];
  const frames = [];
  for (let i = 0; i < list.length; i++) {
    const compiled = compileLayoutFrame(list[i], { ...opts, index: i });
    if (!compiled.ok) return compiled;
    frames.push(compiled.frame);
  }
  return {
    ok: true,
    source: 'layout',
    kind: opts.kind || (frames[0]?.size?.w === 1920 && frames[0]?.size?.h === 1080 ? 'deck' : 'poster'),
    title: String(opts.title || frames[0]?.name || 'Scene'),
    nodes: frames.flatMap((f) => f.nodes || []),
    frames,
    size: frames[0]?.size || null,
    overflow: false,
    themeId: opts.themeId || frames[0]?.themeId || DEFAULT_THEME_ID
  };
}

export function nodesWithinPaper(nodes, paper) {
  const w = Number(paper?.w) || 0;
  const h = Number(paper?.h) || 0;
  for (const n of nodes || []) {
    const b = n.box;
    if (!b) return false;
    if (b.x < 0 || b.y < 0) return false;
    if (b.x + b.w > w + 0.5 || b.y + b.h > h + 0.5) return false;
  }
  return true;
}

function canonicalizeSlots(layout, raw) {
  const allowed = new Set(allowedSlots(layout));
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const canonical = aliasToCanonical(layout, key);
    if (!allowed.has(canonical)) {
      return {
        ok: false,
        error: `unknown slot "${key}" for layout "${layout.id}" (allowed: ${[...allowed].join(', ')})`
      };
    }
    if (out[canonical] == null) out[canonical] = value;
  }
  return { ok: true, value: out };
}

function slotPresent(name, slots) {
  const v = slots[name];
  if (v == null) return false;
  if (typeof v === 'string') return String(v).trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    if (LIST_SLOTS.has(name)) {
      const list = asList(v);
      return list.length > 0;
    }
    if (VISUAL_SLOTS.has(name)) {
      return !!(v.kind || v.name || v.id || v.src || v.path || v.url || v.item || v.handle || v.artifactId || v.query);
    }
    return !!(v.text || v.title || v.body || v.value || v.label);
  }
  return true;
}

function enforceLimits(layout, slots) {
  const limits = layout.limits || {};
  for (const [name, value] of Object.entries(slots)) {
    if (LIST_SLOTS.has(name)) {
      const list = asList(value);
      const max = Number(limits[name] || limits.items || 8);
      if (list.length > max) {
        return { ok: false, error: `slot "${name}" exceeds ${max} items (got ${list.length})` };
      }
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const title = itemTitle(item);
        const body = itemBody(item);
        if (overLimit(title, limits.itemTitle)) {
          return { ok: false, error: `slot "${name}[${i}].title" exceeds ${limits.itemTitle} characters` };
        }
        if (overLimit(body, limits.itemBody)) {
          return { ok: false, error: `slot "${name}[${i}].body" exceeds ${limits.itemBody} characters` };
        }
        if (name === 'stats') {
          if (overLimit(item.value || itemTitle(item), limits.statValue)) {
            return { ok: false, error: `slot "stats[${i}].value" exceeds ${limits.statValue} characters` };
          }
          if (overLimit(item.label || itemBody(item), limits.statLabel)) {
            return { ok: false, error: `slot "stats[${i}].label" exceeds ${limits.statLabel} characters` };
          }
        }
      }
      continue;
    }
    if (VISUAL_SLOTS.has(name)) continue;
    if (name === 'left' || name === 'right' || name === 'context' || name === 'action' || name === 'result') {
      const col = normalizeColumn(value);
      if (overLimit(col.title, limits.itemTitle)) {
        return { ok: false, error: `slot "${name}.title" exceeds ${limits.itemTitle} characters` };
      }
      if (overLimit(col.body, limits.body)) {
        return { ok: false, error: `slot "${name}" exceeds ${limits.body} characters` };
      }
      continue;
    }
    const text = slotText(value);
    const cap = limits[name];
    if (cap && overLimit(text, cap)) {
      return { ok: false, error: `slot "${name}" exceeds ${cap} characters (got ${measure(text)})` };
    }
  }
  return { ok: true };
}

function emitNodes({ frameId, layout, theme, variant, slots, paper }) {
  const prefix = `${safeId(frameId)}-`;
  const nodes = [];
  const themed = { ...theme, variant };
  const push = (node) => {
    nodes.push({
      ...node,
      id: uniqueNodeId(node.id, nodes),
      meta: stampMeta(node.meta || {}, layout.id, theme.id, variant, node.meta?.pawSlot, node.meta?.pawRole)
    });
  };

  push(
    geoNode(`${prefix}bg`, { x: 0, y: 0, w: paper.w, h: paper.h }, themeColor(themed, 'paper'), {
      pawSlot: '_paper',
      pawRole: 'bg'
    })
  );

  const id = layout.id;
  if (id === 'compare' || id === 'two-col') emitColumns(push, prefix, layout, themed, slots, id === 'compare');
  else if (id === 'agenda') emitAgenda(push, prefix, layout, themed, slots);
  else if (id === 'points' || id === 'points-icons') emitPoints(push, prefix, layout, themed, slots, id === 'points-icons');
  else if (id === 'stat-row' || id === 'poster-data') emitStats(push, prefix, layout, themed, slots);
  else if (id === 'timeline') emitTimeline(push, prefix, layout, themed, slots);
  else if (id === 'process') emitProcess(push, prefix, layout, themed, slots);
  else if (id === 'matrix') emitMatrix(push, prefix, layout, themed, slots);
  else if (id === 'case-study') emitCase(push, prefix, layout, themed, slots);
  else if (id === 'comic-panel') emitComic(push, prefix, layout, themed, slots);
  else emitSimple(push, prefix, layout, themed, slots);

  return nodes;
}

function emitSimple(push, prefix, layout, theme, slots) {
  emitDecor(push, prefix, layout, theme);
  for (const name of allowedSlots(layout)) {
    if (!slotPresent(name, slots)) continue;
    if (name === 'visual') {
      emitLargeVisual(push, `${prefix}visual`, layout, slots.visual, theme, 'visual');
      continue;
    }
    const box = layout.boxes[name];
    if (!box) continue;
    const role = layout.id === 'closing' && name === 'subtitle' ? 'ink' : slotRole(name);
    const type = slotType(layout.id, name);
    const align = name === 'cta' ? 'middle' : 'start';
    if (name === 'cta') {
      push(
        geoNode(`${prefix}cta-fill`, box, themeColor(theme, 'accent'), {
          pawSlot: 'cta',
          pawRole: 'accent'
        })
      );
      push(textNode(`${prefix}${name}`, box, slotText(slots[name]), theme, 'ink', type, align, name, tldrawColorForRole('ink', 'accent', theme)));
      continue;
    }
    push(textNode(`${prefix}${name}`, box, slotText(slots[name]), theme, role, type, align));
  }
}

function emitDecor(push, prefix, layout, theme) {
  const id = layout.id;
  const paperW = layout.paper.w || 1920;
  const paperH = layout.paper.h || 1080;
  if (id === 'title' || id === 'title-visual' || id === 'section' || id === 'closing') {
    push(
      geoNode(`${prefix}bar`, { x: 0, y: 0, w: 28, h: paperH }, themeColor(theme, 'accent'), {
        pawSlot: '_rule',
        pawRole: 'accent'
      })
    );
  }
  if (id === 'title' || id === 'closing') {
    const deco = Math.round(Math.min(paperW, paperH) * 0.38);
    push(
      geoNode(
        `${prefix}deco`,
        { x: paperW - deco, y: paperH - deco, w: deco, h: deco },
        themeColor(theme, 'accent2'),
        { pawSlot: '_rule', pawRole: 'decoration' },
        'ellipse'
      )
    );
  }
  if (id === 'section') {
    push(
      geoNode(`${prefix}band`, { x: 0, y: 0, w: paperW, h: 28 }, themeColor(theme, 'accent2'), {
        pawSlot: '_rule',
        pawRole: 'decoration'
      })
    );
  }
  if (id === 'quote' || id === 'poster-quote') {
    push(
      geoNode(`${prefix}mark`, { x: 160, y: 240, w: 72, h: 16 }, themeColor(theme, 'accent'), {
        pawSlot: '_rule',
        pawRole: 'accent'
      })
    );
  }
}

function emitAgenda(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  const items = asList(slots.items);
  const boxes = listBoxes(layout.id, items.length, layout.paper);
  items.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(geoNode(`${prefix}item-${i + 1}-card`, b.box, themeColor(theme, 'surface'), { pawSlot: 'items', pawRole: 'card' }));
    push(textNode(`${prefix}item-${i + 1}-num`, b.indexBox, String(i + 1).padStart(2, '0'), theme, 'accent', TYPE.heading, 'start', 'items'));
    push(textNode(`${prefix}item-${i + 1}`, b.titleBox, itemTitle(item) || itemBody(item), theme, 'ink', TYPE.body, 'start', 'items'));
  });
}

function emitPoints(push, prefix, layout, theme, slots, withIcon) {
  emitHeading(push, prefix, layout, theme, slots);
  const items = asList(slots.items);
  const boxes = listBoxes(layout.id, items.length, layout.paper);
  items.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(
      geoNode(`${prefix}item-${i + 1}-card`, b.box, themeColor(theme, 'surface'), {
        pawSlot: `items`,
        pawRole: 'card'
      })
    );
    push(
      geoNode(
        `${prefix}item-${i + 1}-bar`,
        { x: b.box.x, y: b.box.y, w: b.box.w, h: 16 },
        themeColor(theme, i % 2 ? 'accent2' : 'accent'),
        { pawSlot: 'items', pawRole: 'accent' }
      )
    );
    if (withIcon && b.iconBox) {
      const well = {
        x: b.iconBox.x - 8,
        y: b.iconBox.y - 8,
        w: b.iconBox.w + 16,
        h: b.iconBox.h + 16
      };
      push(
        geoNode(`${prefix}item-${i + 1}-well`, well, themeColor(theme, 'accent2'), {
          pawSlot: 'items',
          pawRole: 'decoration'
        })
      );
      const vis = item.visual || { kind: 'icon', name: item.icon || defaultItemIcon(i) };
      emitVisual(push, `${prefix}item-${i + 1}-icon`, b.iconBox, vis, theme, `items`);
    }
    push(textNode(`${prefix}item-${i + 1}-title`, b.titleBox, itemTitle(item), theme, 'ink', TYPE.heading, 'start', 'items'));
    if (itemBody(item)) {
      push(textNode(`${prefix}item-${i + 1}-body`, b.bodyBox, itemBody(item), theme, 'muted', TYPE.body, 'start', 'items'));
    }
  });
}

function emitStats(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  const stats = asList(slots.stats);
  const boxes = listBoxes(layout.id, stats.length, layout.paper);
  stats.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(
      geoNode(`${prefix}stat-${i + 1}-card`, b.box, themeColor(theme, 'surface'), {
        pawSlot: 'stats',
        pawRole: 'card'
      })
    );
    push(
      geoNode(
        `${prefix}stat-${i + 1}-bar`,
        { x: b.box.x, y: b.box.y, w: b.box.w, h: 16 },
        themeColor(theme, i % 2 ? 'accent2' : 'accent'),
        { pawSlot: 'stats', pawRole: 'accent' }
      )
    );
    push(textNode(`${prefix}stat-${i + 1}-value`, b.valueBox, String(item.value || itemTitle(item)), theme, 'accent', TYPE.stat, 'start', 'stats'));
    push(textNode(`${prefix}stat-${i + 1}-label`, b.labelBox, String(item.label || itemBody(item) || ''), theme, 'muted', TYPE.body, 'start', 'stats'));
  });
}

function emitTimeline(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  const steps = asList(slots.steps);
  const boxes = listBoxes(layout.id, steps.length, layout.paper);
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  if (first && last) {
    const railY = first.box.y - 28;
    push(
      geoNode(
        `${prefix}rail`,
        { x: first.box.x, y: railY, w: last.box.x + last.box.w - first.box.x, h: 20 },
        themeColor(theme, 'accent'),
        { pawSlot: '_rule', pawRole: 'accent' }
      )
    );
  }
  steps.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(geoNode(`${prefix}step-${i + 1}-card`, b.box, themeColor(theme, 'surface'), { pawSlot: 'steps', pawRole: 'card' }));
    push(
      geoNode(
        `${prefix}step-${i + 1}-foot`,
        { x: b.box.x, y: b.box.y + b.box.h - 16, w: b.box.w, h: 16 },
        themeColor(theme, 'accent'),
        { pawSlot: 'steps', pawRole: 'accent' }
      )
    );
    push(geoNode(`${prefix}step-${i + 1}-dot`, b.nodeBox, themeColor(theme, 'accent'), { pawSlot: 'steps', pawRole: 'accent' }));
    push(
      textNode(
        `${prefix}step-${i + 1}-n`,
        b.nodeBox,
        String(i + 1).padStart(2, '0'),
        theme,
        'paper',
        TYPE.heading,
        'middle',
        'steps',
        tldrawColorForRole('ink', 'accent', theme)
      )
    );
    push(textNode(`${prefix}step-${i + 1}-title`, b.titleBox, itemTitle(item), theme, 'ink', TYPE.heading, 'start', 'steps'));
    if (itemBody(item)) {
      push(textNode(`${prefix}step-${i + 1}-body`, b.bodyBox, itemBody(item), theme, 'muted', TYPE.body, 'start', 'steps'));
    }
  });
}

function emitProcess(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  const steps = asList(slots.steps);
  const boxes = listBoxes(layout.id, steps.length, layout.paper);
  steps.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(geoNode(`${prefix}step-${i + 1}-card`, b.box, themeColor(theme, 'surface'), { pawSlot: 'steps', pawRole: 'card' }));
    push(
      geoNode(
        `${prefix}step-${i + 1}-foot`,
        { x: b.box.x, y: b.box.y + b.box.h - 16, w: b.box.w, h: 16 },
        themeColor(theme, 'accent'),
        { pawSlot: 'steps', pawRole: 'accent' }
      )
    );
  });
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  if (first && last && boxes.length >= 2) {
    const midY = first.indexBox.y + Math.round(first.indexBox.h / 2);
    const x = first.indexBox.x + first.indexBox.w;
    const w = last.indexBox.x - x;
    push(
      geoNode(
        `${prefix}band`,
        { x: first.box.x, y: midY - 20, w: last.box.x + last.box.w - first.box.x, h: 40 },
        themeColor(theme, 'accent2'),
        { pawSlot: '_rule', pawRole: 'decoration' }
      )
    );
    if (w > 8) {
      push(
        geoNode(`${prefix}connector`, { x, y: midY - 10, w, h: 20 }, themeColor(theme, 'accent'), {
          pawSlot: '_rule',
          pawRole: 'accent'
        })
      );
    }
  }
  steps.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(geoNode(`${prefix}step-${i + 1}-num`, b.indexBox, themeColor(theme, 'accent'), { pawSlot: 'steps', pawRole: 'accent' }));
    push(textNode(`${prefix}step-${i + 1}-n`, b.indexBox, String(i + 1), theme, 'paper', TYPE.number, 'middle', 'steps', tldrawColorForRole('ink', 'accent', theme)));
    push(textNode(`${prefix}step-${i + 1}-title`, b.titleBox, itemTitle(item), theme, 'ink', TYPE.heading, 'start', 'steps'));
    if (itemBody(item)) {
      push(textNode(`${prefix}step-${i + 1}-body`, b.bodyBox, itemBody(item), theme, 'muted', TYPE.body, 'start', 'steps'));
    }
  });
}

function emitMatrix(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  const cells = asList(slots.cells).slice(0, 4);
  const boxes = listBoxes(layout.id, cells.length, layout.paper);
  cells.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(geoNode(`${prefix}cell-${i + 1}`, b.box, themeColor(theme, i % 3 === 0 ? 'accent' : 'surface'), { pawSlot: 'cells', pawRole: 'card' }));
    const titleRole = i % 3 === 0 ? 'ink' : 'ink';
    const bodyRole = i % 3 === 0 ? 'ink' : 'muted';
    const titleColor = i % 3 === 0 ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    const bodyColor = i % 3 === 0 ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    push(textNode(`${prefix}cell-${i + 1}-title`, b.titleBox, itemTitle(item), theme, titleRole, TYPE.heading, 'start', 'cells', titleColor));
    if (itemBody(item)) {
      push(textNode(`${prefix}cell-${i + 1}-body`, b.bodyBox, itemBody(item), theme, bodyRole, TYPE.body, 'start', 'cells', bodyColor));
    }
  });
  if (boxes[0] && boxes[3]) {
    const grid = {
      x: boxes[0].box.x,
      y: boxes[0].box.y,
      w: boxes[1].box.x + boxes[1].box.w - boxes[0].box.x,
      h: boxes[2].box.y + boxes[2].box.h - boxes[0].box.y
    };
    push(
      geoNode(`${prefix}axis-v`, { x: grid.x + Math.round(grid.w / 2) - 8, y: grid.y, w: 16, h: grid.h }, themeColor(theme, 'accent'), {
        pawSlot: '_rule',
        pawRole: 'accent'
      })
    );
    push(
      geoNode(`${prefix}axis-h`, { x: grid.x, y: grid.y + Math.round(grid.h / 2) - 8, w: grid.w, h: 16 }, themeColor(theme, 'accent'), {
        pawSlot: '_rule',
        pawRole: 'accent'
      })
    );
  }
}

function emitColumns(push, prefix, layout, theme, slots, compare) {
  emitHeading(push, prefix, layout, theme, slots);
  for (const side of ['left', 'right']) {
    if (!slotPresent(side, slots)) continue;
    const outer = layout.boxes[side];
    const col = normalizeColumn(slots[side]);
    const fill = compare && side === 'right' ? 'accent' : 'surface';
    const titleRole = 'ink';
    const bodyRole = fill === 'accent' ? 'ink' : 'muted';
    const titleColor = fill === 'accent' ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    const bodyColor = fill === 'accent' ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    const labelColor = fill === 'accent' ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    push(
      geoNode(`${prefix}${side}-card`, outer, themeColor(theme, fill), {
        pawSlot: side,
        pawRole: 'card'
      })
    );
    push(
      geoNode(
        `${prefix}${side}-rail`,
        { x: outer.x, y: outer.y, w: 20, h: outer.h },
        themeColor(theme, side === 'right' && compare ? 'accent2' : 'accent'),
        { pawSlot: side, pawRole: 'accent' }
      )
    );
    if (compare) {
      push(
        geoNode(
          `${prefix}${side}-bar`,
          { x: outer.x, y: outer.y, w: outer.w, h: 28 },
          themeColor(theme, side === 'left' ? 'accent' : 'accent2'),
          { pawSlot: side, pawRole: 'accent' }
        )
      );
    }
    const inner = columnInnerBoxes(outer);
    if (compare) {
      if (col.title) {
        push(
          textNode(
            `${prefix}${side}-title`,
            inner.labelBox,
            col.title,
            theme,
            fill === 'accent' ? 'ink' : 'accent',
            TYPE.kicker,
            'start',
            side,
            labelColor
          )
        );
      }
      if (col.value) {
        push(textNode(`${prefix}${side}-metric`, inner.titleBox, col.value, theme, titleRole, TYPE.page, 'start', side, titleColor));
        if (col.body) {
          push(textNode(`${prefix}${side}-body`, inner.bodyBox, col.body, theme, bodyRole, TYPE.body, 'start', side, bodyColor));
        }
      } else if (col.body) {
        push(
          textNode(
            `${prefix}${side}-body`,
            { ...inner.titleBox, h: inner.titleBox.h + 96 },
            col.body,
            theme,
            titleRole,
            TYPE.page,
            'start',
            side,
            titleColor
          )
        );
      }
    } else {
      if (col.title) {
        push(textNode(`${prefix}${side}-title`, inner.titleBox, col.title, theme, titleRole, TYPE.page, 'start', side, titleColor));
      }
      if (col.body) {
        push(textNode(`${prefix}${side}-body`, inner.bodyBox, col.body, theme, bodyRole, TYPE.body, 'start', side, bodyColor));
      }
    }
    if (col.items.length) {
      const startY = inner.bodyBox.y + (compare && col.body && col.value ? 8 : col.body && !compare ? 8 : 0);
      col.items.slice(0, 6).forEach((item, i) => {
        const y = startY + i * 80;
        if (y + 56 > outer.y + outer.h - 32) return;
        push(
          textNode(
            `${prefix}${side}-item-${i + 1}`,
            { x: inner.titleBox.x, y, w: inner.titleBox.w, h: 72 },
            itemTitle(item) || itemBody(item),
            theme,
            titleRole,
            TYPE.body,
            'start',
            side,
            titleColor
          )
        );
      });
    }
  }
}

function emitCase(push, prefix, layout, theme, slots) {
  emitHeading(push, prefix, layout, theme, slots);
  if (slotPresent('visual', slots) && layout.boxes.visual) {
    emitLargeVisual(push, `${prefix}visual`, layout, slots.visual, theme, 'visual');
  }
  const fills = { context: 'surface', action: 'surface', result: 'accent' };
  for (const name of ['context', 'action', 'result']) {
    if (!slotPresent(name, slots)) continue;
    const outer = layout.boxes[name];
    const col = normalizeColumn(slots[name]);
    const fill = fills[name];
    push(geoNode(`${prefix}${name}-card`, outer, themeColor(theme, fill), { pawSlot: name, pawRole: 'card' }));
    const inner = columnInnerBoxes(outer);
    const labelColor = fill === 'accent' ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    const bodyColor = fill === 'accent' ? tldrawColorForRole('ink', 'accent', theme) : undefined;
    push(textNode(`${prefix}${name}-label`, inner.labelBox || inner.titleBox, col.title || name, theme, fill === 'accent' ? 'ink' : 'accent', TYPE.kicker, 'start', name, labelColor));
    push(textNode(`${prefix}${name}-body`, inner.bodyBox, col.body || itemTitle(slots[name]), theme, 'ink', TYPE.body, 'start', name, bodyColor));
  }
}

function emitComic(push, prefix, layout, theme, slots) {
  if (slotPresent('title', slots) && layout.boxes.title) {
    push(textNode(`${prefix}title`, layout.boxes.title, slotText(slots.title), theme, 'ink', 'l'));
  }
  const panels = asList(slots.panels);
  const boxes = listBoxes(layout.id, panels.length, layout.paper);
  panels.forEach((item, i) => {
    const b = boxes[i];
    if (!b) return;
    push(
      geoNode(`${prefix}panel-${i + 1}`, b.box, themeColor(theme, 'surface'), {
        pawSlot: 'panels',
        pawRole: 'card'
      })
    );
    const vis = item.visual || item.image || (item.icon ? { kind: 'icon', name: item.icon } : null);
    if (vis) emitVisual(push, `${prefix}panel-${i + 1}-visual`, b.visualBox, vis, theme, 'panels');
    const caption = item.caption || itemTitle(item) || itemBody(item);
    if (caption) push(textNode(`${prefix}panel-${i + 1}-caption`, b.captionBox, caption, theme, 'ink', 's'));
  });
}

function emitHeading(push, prefix, layout, theme, slots) {
  if (slotPresent('kicker', slots) && layout.boxes.kicker) {
    push(textNode(`${prefix}kicker`, layout.boxes.kicker, slotText(slots.kicker), theme, 'muted', TYPE.kicker));
  }
  if (slotPresent('title', slots) && layout.boxes.title) {
    push(textNode(`${prefix}title`, layout.boxes.title, slotText(slots.title), theme, 'ink', slotType(layout.id, 'title')));
  }
  if (slotPresent('subtitle', slots) && layout.boxes.subtitle) {
    push(textNode(`${prefix}subtitle`, layout.boxes.subtitle, slotText(slots.subtitle), theme, 'muted', TYPE.body));
  }
  if (slotPresent('footnote', slots) && layout.boxes.footnote) {
    push(textNode(`${prefix}footnote`, layout.boxes.footnote, slotText(slots.footnote), theme, 'muted', TYPE.caption));
  }
}

function validateVisuals(slots) {
  const err = validateVisual(slots.visual);
  if (err) return err;
  for (const name of ['items', 'panels', 'steps']) {
    for (const item of asList(slots[name] || [])) {
      if (item.icon && !item.visual) {
        const iconErr = validateVisual({ kind: 'icon', name: item.icon });
        if (iconErr) return iconErr;
      }
      if (item.visual) {
        const visErr = validateVisual(item.visual);
        if (visErr) return visErr;
      }
    }
  }
  return '';
}

function emitLargeVisual(push, id, layout, raw, theme, slotName) {
  const box = layout.boxes?.visual;
  if (!box) return;
  const largeIcon = isPackagedIconVisual(raw) && Math.min(box.w, box.h) >= 360;
  if (largeIcon) {
    emitIconMotif(push, id, box, raw, theme, slotName);
    return;
  }
  emitVisual(push, id, box, raw, theme, slotName);
}

function emitIconMotif(push, id, box, raw, theme, slotName) {
  push(
    geoNode(`${id}-card`, box, themeColor(theme, 'card'), {
      pawSlot: slotName,
      pawRole: 'card'
    })
  );
  const inset = 28;
  const deco = Math.round(Math.min(box.w, box.h) * 0.84);
  push(
    geoNode(
      `${id}-deco`,
      {
        x: Math.round(box.x + (box.w - deco) / 2),
        y: Math.round(box.y + (box.h - deco) / 2),
        w: deco,
        h: deco
      },
      themeColor(theme, 'accent2'),
      { pawSlot: slotName, pawRole: 'decoration' },
      'ellipse'
    )
  );
  push(
    geoNode(
      `${id}-bar`,
      { x: box.x + inset, y: box.y + inset, w: 28, h: box.h - inset * 2 },
      themeColor(theme, 'accent'),
      { pawSlot: slotName, pawRole: 'accent' }
    )
  );
  const iconS = Math.round(Math.min(box.w, box.h) * 0.42);
  const iconBox = {
    x: Math.round(box.x + (box.w - iconS) / 2),
    y: Math.round(box.y + (box.h - iconS) / 2),
    w: iconS,
    h: iconS
  };
  emitVisual(push, id, iconBox, raw, theme, slotName);
}

function emitVisual(push, id, box, raw, theme, slotName) {
  if (!box) return;
  const compiled = compileVisual({ raw, box, theme, slotName, nodeId: id });
  if (!compiled.ok) {
    push(textNode(id, box, compiled.error, theme, 'muted', 's', 'start', slotName));
    return;
  }
  for (const node of compiled.nodes || []) push(node);
}

function themeColor(theme, role) {
  return tldrawColorForRole(role, theme?.variant, theme) || tldrawColorForRole('ink', theme?.variant, theme);
}

function textNode(id, box, text, theme, role, sizeOrType, align = 'start', slot, colorOverride) {
  const type = normalizeType(sizeOrType);
  const color = colorOverride || themeColor(theme, role);
  const slotName = slot || String(id).replace(/^.*?(kicker|title|subtitle|footer|quote|caption|cta|number|byline|date|place|price|attribution|footnote|visual).*$/i, (_, s) => s.toLowerCase());
  const pawSlot = slot || inferSlotFromId(id);
  const size = type.size;
  const scale = type.scale;
  return {
    id,
    type: size === 'xl' ? 'headline' : size === 'l' ? 'heading' : 'text',
    tag: size === 'xl' ? 'h1' : size === 'l' ? 'h2' : 'p',
    text: String(text || ''),
    box: { ...box },
    color,
    fill: color,
    size,
    scale,
    font: theme.font,
    align,
    provenance: 'layout',
    meta: { pawSlot: pawSlot || slotName, pawRole: role }
  };
}

function geoNode(id, box, fill, meta, geo = 'rectangle') {
  return {
    id,
    type: 'geo',
    tag: 'div',
    geo,
    text: '',
    box: { ...box },
    fill,
    color: fill,
    fillKind: 'solid',
    dash: 'solid',
    provenance: 'layout',
    meta
  };
}

function stampMeta(meta, layoutId, themeId, variant, slot, role) {
  return {
    ...meta,
    pawLayout: layoutId,
    pawTheme: themeId,
    pawVariant: variant,
    pawSlot: slot || meta.pawSlot || '',
    pawRole: role || meta.pawRole || 'ink'
  };
}

function inferSlotFromId(id) {
  const s = String(id || '');
  const m =
    /-(kicker|title|subtitle|footer|quote|caption|cta|number|byline|date|place|price|attribution|footnote|visual|left|right|context|action|result|items|steps|stats|cells|panels)(?:-|$)/.exec(
      s
    );
  if (m) return m[1];
  if (/-bg$/.test(s) || /-paper$/.test(s)) return '_paper';
  if (/-rule$/.test(s)) return '_rule';
  return '';
}

function uniqueNodeId(id, nodes) {
  const used = new Set(nodes.map((n) => n.id));
  let next = String(id || 'slot');
  let n = 2;
  while (used.has(next)) next = `${id}-${n++}`;
  return next;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(normalizeItem);
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items.map(normalizeItem);
    if (Array.isArray(value.steps)) return value.steps.map(normalizeItem);
    return [normalizeItem(value)];
  }
  if (value == null || value === '') return [];
  return [normalizeItem(value)];
}

function normalizeItem(raw) {
  if (raw == null) return { title: '', body: '' };
  if (typeof raw === 'string' || typeof raw === 'number') return { title: String(raw), body: '' };
  return {
    title: String(raw.title || raw.label || raw.text || raw.name || ''),
    body: String(raw.body || raw.caption || raw.desc || raw.description || ''),
    value: raw.value != null ? String(raw.value) : '',
    label: raw.label != null ? String(raw.label) : '',
    icon: raw.icon || raw.name || '',
    visual: raw.visual || raw.image || null,
    caption: raw.caption || ''
  };
}

function normalizeColumn(raw) {
  if (raw == null) return { title: '', body: '', value: '', items: [] };
  if (typeof raw === 'string' || typeof raw === 'number') return { title: '', body: String(raw), value: '', items: [] };
  if (Array.isArray(raw)) return { title: '', body: '', value: '', items: raw.map(normalizeItem) };
  return {
    title: String(raw.title || raw.label || ''),
    body: String(raw.body || raw.text || ''),
    value: String(raw.value || raw.metric || ''),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : []
  };
}

function itemTitle(item) {
  return String(item?.title || item?.value || '').trim();
}

function itemBody(item) {
  return String(item?.body || item?.label || item?.caption || '').trim();
}

function slotText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value.text || value.title || value.body || value.value || '');
}

function firstText(slots, names) {
  for (const n of names) {
    const t = slotText(slots[n]);
    if (t) return t;
  }
  return '';
}

function slotRole(name) {
  if (name === 'kicker' || name === 'subtitle' || name === 'footer' || name === 'caption' || name === 'attribution' || name === 'byline' || name === 'footnote') {
    return 'muted';
  }
  if (name === 'cta' || name === 'number' || name === 'price') return 'accent';
  if (name === 'visual') return 'visual';
  return 'ink';
}

function slotType(layoutId, name) {
  if (name === 'title') {
    if (layoutId === 'title' || layoutId === 'title-visual' || layoutId === 'closing') return TYPE.cover;
    if (layoutId === 'section') return TYPE.section;
    return TYPE.page;
  }
  if (name === 'quote' || name === 'number') return layoutId === 'section' ? TYPE.number : TYPE.quote;
  if (name === 'subtitle' || name === 'cta' || name === 'price') return TYPE.body;
  if (name === 'kicker' || name === 'footer' || name === 'caption' || name === 'byline' || name === 'attribution') {
    return TYPE.caption;
  }
  return TYPE.body;
}

function normalizeType(value) {
  if (value && typeof value === 'object' && value.size) {
    return { size: value.size, scale: Number(value.scale) > 0 ? Number(value.scale) : 1 };
  }
  const token = String(value || 'm');
  if (token === 'xl') return { size: 'xl', scale: 1 };
  if (token === 'l') return { size: 'l', scale: 1 };
  if (token === 's') return { size: 's', scale: 1 };
  return { size: 'm', scale: 1 };
}

function slotSize(name) {
  return slotType('', name).size;
}

function defaultItemIcon(i) {
  const names = ['check', 'star', 'sparkles', 'zap', 'lightbulb', 'rocket'];
  return names[i % names.length];
}

function overLimit(text, cap) {
  if (!cap) return false;
  return measure(text) > cap;
}

function measure(text) {
  return Array.from(String(text || '')).length;
}

function safeId(raw) {
  return (
    String(raw || 'frame')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 48) || 'frame'
  );
}
