/**
 * Theme-aware tldraw-native motifs. Each id expands into geo/text/line/arrow/icon
 * nodes that scale into a host-provided box. No raster.
 */

import { iconSvgDataUrl } from './canvasPresets.js';
import { CANVAS_ICONS } from './canvasIconPack.js';
import { tldrawColorForRole, themeHexForRole } from './themeCatalog.js';

export const MOTIF_IDS = [
  'browser-window',
  'workflow-arrow',
  'radial-network',
  'stacked-cards',
  'metric-ring',
  'data-bars',
  'data-line',
  'funnel',
  'quadrant',
  'timeline-rail',
  'checklist-stack',
  'device-frame'
];

const MOTIF_META = {
  'browser-window': { name: 'Browser window', category: 'product' },
  'workflow-arrow': { name: 'Workflow arrow', category: 'process' },
  'radial-network': { name: 'Radial network', category: 'process' },
  'stacked-cards': { name: 'Stacked cards', category: 'product' },
  'metric-ring': { name: 'Metric ring', category: 'data' },
  'data-bars': { name: 'Data bars', category: 'data' },
  'data-line': { name: 'Data line', category: 'data' },
  funnel: { name: 'Funnel', category: 'data' },
  quadrant: { name: 'Quadrant', category: 'data' },
  'timeline-rail': { name: 'Timeline rail', category: 'process' },
  'checklist-stack': { name: 'Checklist stack', category: 'process' },
  'device-frame': { name: 'Device frame', category: 'product' }
};

export function listMotifIds() {
  return MOTIF_IDS.slice();
}

export function compactMotifCatalog() {
  return {
    catalog: 'motifs',
    count: MOTIF_IDS.length,
    motifs: MOTIF_IDS.map((id) => ({ id, ...MOTIF_META[id] })),
    hint: 'slots.visual = { kind:"motif", id:"browser-window", data? }'
  };
}

export function searchMotifs(query, opts = {}) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const limit = Math.max(1, Math.min(12, Number(opts.limit) || 8));
  if (!q) return MOTIF_IDS.slice(0, limit).map((id) => ({ id, ...MOTIF_META[id], score: 0 }));
  const scored = MOTIF_IDS.map((id) => {
    const meta = MOTIF_META[id];
    let score = 0;
    if (id === q) score += 100;
    if (id.includes(q)) score += 40;
    if (String(meta.name).toLowerCase().includes(q)) score += 30;
    if (meta.category === q || String(meta.category).includes(q)) score += 20;
    return { id, ...meta, score };
  }).filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

/**
 * @returns {{ ok: true, nodes: object[] } | { ok: false, error: string, suggestions?: object[] }}
 */
export function compileMotif({ id, box, theme, data, slotName, nodeId }) {
  const motifId = String(id || '').trim();
  if (!MOTIF_IDS.includes(motifId)) {
    const suggestions = searchMotifs(motifId, { limit: 5 });
    return {
      ok: false,
      error: `unknown motif "${motifId}" — suggestions: ${suggestions.map((s) => s.id).join(', ') || MOTIF_IDS.join(', ')}`,
      suggestions
    };
  }
  const b = normalizeBox(box);
  if (!b) return { ok: false, error: 'motif needs a layout box' };
  const prefix = String(nodeId || `motif-${motifId}`);
  const slot = slotName || 'visual';
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const nodes = BUILDERS[motifId](prefix, b, theme, payload, slot).map((n) => clipNode(n, b));
  return { ok: true, nodes };
}

const BUILDERS = {
  'browser-window': emitBrowserWindow,
  'workflow-arrow': emitWorkflowArrow,
  'radial-network': emitRadialNetwork,
  'stacked-cards': emitStackedCards,
  'metric-ring': emitMetricRing,
  'data-bars': emitDataBars,
  'data-line': emitDataLine,
  funnel: emitFunnel,
  quadrant: emitQuadrant,
  'timeline-rail': emitTimelineRail,
  'checklist-stack': emitChecklist,
  'device-frame': emitDeviceFrame
};

function emitBrowserWindow(prefix, box, theme, data, slot) {
  const nodes = [];
  const chrome = 36;
  nodes.push(geo(`${prefix}-frame`, box, color(theme, 'surface'), meta(slot, 'card', 'browser-window'), 'rectangle'));
  nodes.push(
    geo(
      `${prefix}-bar`,
      { x: box.x, y: box.y, w: box.w, h: chrome },
      color(theme, 'accent'),
      meta(slot, 'accent', 'browser-window'),
      'rectangle'
    )
  );
  const dot = 10;
  const gap = 8;
  for (let i = 0; i < 3; i++) {
    nodes.push(
      geo(
        `${prefix}-dot-${i + 1}`,
        { x: box.x + 14 + i * (dot + gap), y: box.y + 13, w: dot, h: dot },
        color(theme, 'paper'),
        meta(slot, 'decoration', 'browser-window'),
        'ellipse'
      )
    );
  }
  const title = String(data.title || data.label || 'app.example');
  nodes.push(
    text(
      `${prefix}-url`,
      { x: box.x + 80, y: box.y + 6, w: Math.max(80, box.w - 100), h: 24 },
      title,
      theme,
      'paper',
      's',
      slot,
      'browser-window'
    )
  );
  const screen = { x: box.x + 16, y: box.y + chrome + 16, w: box.w - 32, h: box.h - chrome - 32 };
  nodes.push(geo(`${prefix}-screen`, screen, color(theme, 'paper'), meta(slot, 'visual', 'browser-window'), 'rectangle'));
  const iconName = pickIcon(data.icon || 'globe');
  const iconS = Math.round(Math.min(screen.w, screen.h) * 0.22);
  nodes.push(
    iconNode(
      `${prefix}-icon`,
      {
        x: Math.round(screen.x + (screen.w - iconS) / 2),
        y: Math.round(screen.y + (screen.h - iconS) / 2),
        w: iconS,
        h: iconS
      },
      iconName,
      theme,
      slot,
      'browser-window'
    )
  );
  return nodes;
}

function emitWorkflowArrow(prefix, box, theme, data, slot) {
  const labels = listOf(data.steps || data.labels || data.items, ['发现', '编译', '交付']);
  const n = clamp(labels.length, 2, 5);
  const items = labels.slice(0, n);
  const gap = 20;
  const arrowW = 28;
  const usable = box.w - arrowW * (n - 1) - gap * (n - 1);
  const stepW = Math.floor(usable / n);
  const nodes = [];
  items.forEach((label, i) => {
    const x = box.x + i * (stepW + gap + arrowW);
    const card = { x, y: box.y + 16, w: stepW, h: box.h - 32 };
    nodes.push(geo(`${prefix}-step-${i + 1}`, card, color(theme, 'surface'), meta(slot, 'card', 'workflow-arrow'), 'rectangle'));
    nodes.push(
      text(
        `${prefix}-step-${i + 1}-t`,
        { x: card.x + 12, y: card.y + Math.round(card.h / 2) - 20, w: card.w - 24, h: 40 },
        String(label),
        theme,
        'ink',
        'm',
        slot,
        'workflow-arrow'
      )
    );
    if (i < n - 1) {
      nodes.push(
        geo(
          `${prefix}-arr-${i + 1}`,
          { x: x + stepW + 4, y: box.y + Math.round(box.h / 2) - 14, w: arrowW, h: 28 },
          color(theme, 'accent'),
          meta(slot, 'accent', 'workflow-arrow'),
          'arrow-right'
        )
      );
    }
  });
  return nodes;
}

function emitRadialNetwork(prefix, box, theme, data, slot) {
  const labels = listOf(data.nodes || data.labels || data.items, ['选区', '画布', '表格', '文档']);
  const n = clamp(labels.length, 3, 6);
  const items = labels.slice(0, n);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) * 0.32;
  const hubS = Math.round(Math.min(box.w, box.h) * 0.22);
  const satS = Math.round(Math.min(box.w, box.h) * 0.16);
  const nodes = [];
  items.forEach((label, i) => {
    const ang = (-Math.PI / 2 + (i * 2 * Math.PI) / n);
    const sx = cx + Math.cos(ang) * r;
    const sy = cy + Math.sin(ang) * r;
    nodes.push(lineNode(`${prefix}-spoke-${i + 1}`, cx, cy, sx, sy, theme, slot, 'radial-network'));
    const sat = { x: Math.round(sx - satS / 2), y: Math.round(sy - satS / 2), w: satS, h: satS };
    nodes.push(geo(`${prefix}-sat-${i + 1}`, sat, color(theme, 'surface'), meta(slot, 'card', 'radial-network'), 'ellipse'));
    nodes.push(
      text(
        `${prefix}-sat-${i + 1}-t`,
        { x: sat.x - 10, y: sat.y + satS + 4, w: satS + 20, h: 22 },
        String(label),
        theme,
        'muted',
        's',
        slot,
        'radial-network'
      )
    );
  });
  nodes.push(
    geo(
      `${prefix}-hub`,
      { x: Math.round(cx - hubS / 2), y: Math.round(cy - hubS / 2), w: hubS, h: hubS },
      color(theme, 'accent'),
      meta(slot, 'visual', 'radial-network'),
      'ellipse'
    )
  );
  nodes.push(
    text(
      `${prefix}-hub-t`,
      { x: Math.round(cx - hubS / 2), y: Math.round(cy - 12), w: hubS, h: 24 },
      String(data.center || data.title || 'Paw'),
      theme,
      'paper',
      's',
      slot,
      'radial-network'
    )
  );
  return nodes;
}

function emitStackedCards(prefix, box, theme, data, slot) {
  const n = 3;
  const inset = 18;
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const shift = (n - 1 - i) * 14;
    const card = {
      x: box.x + inset + shift,
      y: box.y + inset + shift,
      w: box.w - inset * 2 - (n - 1) * 14,
      h: box.h - inset * 2 - (n - 1) * 14
    };
    const role = i === n - 1 ? 'card' : 'decoration';
    nodes.push(geo(`${prefix}-card-${i + 1}`, card, color(theme, i === n - 1 ? 'surface' : 'accent2'), meta(slot, role, 'stacked-cards'), 'rectangle'));
  }
  const front = nodes[nodes.length - 1].box;
  nodes.push(
    text(
      `${prefix}-title`,
      { x: front.x + 24, y: front.y + 24, w: front.w - 48, h: 40 },
      String(data.title || data.label || '卡片'),
      theme,
      'ink',
      'l',
      slot,
      'stacked-cards'
    )
  );
  if (data.body) {
    nodes.push(
      text(
        `${prefix}-body`,
        { x: front.x + 24, y: front.y + 72, w: front.w - 48, h: Math.max(32, front.h - 100) },
        String(data.body),
        theme,
        'muted',
        'm',
        slot,
        'stacked-cards'
      )
    );
  }
  return nodes;
}

function emitMetricRing(prefix, box, theme, data, slot) {
  const s = Math.round(Math.min(box.w, box.h) * 0.72);
  const ring = {
    x: Math.round(box.x + (box.w - s) / 2),
    y: Math.round(box.y + 8),
    w: s,
    h: s
  };
  const hole = Math.round(s * 0.56);
  const nodes = [
    geo(`${prefix}-ring`, ring, color(theme, 'accent'), meta(slot, 'visual', 'metric-ring'), 'ellipse'),
    geo(
      `${prefix}-hole`,
      {
        x: Math.round(ring.x + (s - hole) / 2),
        y: Math.round(ring.y + (s - hole) / 2),
        w: hole,
        h: hole
      },
      color(theme, 'paper'),
      meta(slot, 'decoration', 'metric-ring'),
      'ellipse'
    ),
    text(
      `${prefix}-value`,
      { x: ring.x, y: ring.y + Math.round(s * 0.36), w: s, h: 40 },
      String(data.value || data.label || '72%'),
      theme,
      'ink',
      'l',
      slot,
      'metric-ring'
    )
  ];
  if (data.caption || data.title) {
    nodes.push(
      text(
        `${prefix}-cap`,
        { x: box.x, y: ring.y + s + 4, w: box.w, h: 24 },
        String(data.caption || data.title),
        theme,
        'muted',
        's',
        slot,
        'metric-ring'
      )
    );
  }
  return nodes;
}

function emitDataBars(prefix, box, theme, data, slot) {
  const values = numbersOf(data.values || data.data, [4, 7, 5, 9]);
  const labels = listOf(data.labels, values.map((_, i) => String.fromCharCode(65 + i)));
  const n = values.length;
  const pad = 16;
  const labelH = 24;
  const plot = { x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: box.h - pad * 2 - labelH };
  const max = Math.max(1, ...values);
  const gap = 10;
  const barW = Math.max(8, Math.floor((plot.w - gap * (n - 1)) / n));
  const nodes = [];
  values.forEach((v, i) => {
    const h = Math.max(8, Math.round((v / max) * plot.h));
    const x = plot.x + i * (barW + gap);
    const y = plot.y + plot.h - h;
    nodes.push(
      geo(`${prefix}-bar-${i + 1}`, { x, y, w: barW, h }, color(theme, i % 2 ? 'accent2' : 'accent'), meta(slot, 'visual', 'data-bars'), 'rectangle')
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x, y: plot.y + plot.h + 2, w: barW, h: labelH },
        String(labels[i] || ''),
        theme,
        'muted',
        's',
        slot,
        'data-bars'
      )
    );
  });
  return nodes;
}

function emitDataLine(prefix, box, theme, data, slot) {
  const values = numbersOf(data.values || data.data, [3, 5, 4, 8, 6]);
  const labels = listOf(data.labels, values.map((_, i) => String(i + 1)));
  const pad = 20;
  const labelH = 24;
  const plot = { x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: box.h - pad * 2 - labelH };
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const span = maxV - minV || 1;
  const nodes = [
    geo(
      `${prefix}-axis`,
      { x: plot.x, y: plot.y + plot.h, w: plot.w, h: 4 },
      color(theme, 'rule'),
      meta(slot, 'decoration', 'data-line'),
      'rectangle'
    )
  ];
  const n = values.length;
  const pts = values.map((v, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = plot.x + t * plot.w;
    const y = plot.y + plot.h - ((v - minV) / span) * plot.h;
    return { x, y };
  });
  for (let i = 0; i < pts.length - 1; i++) {
    nodes.push(lineNode(`${prefix}-seg-${i + 1}`, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, theme, slot, 'data-line'));
  }
  pts.forEach((p, i) => {
    nodes.push(
      geo(
        `${prefix}-pt-${i + 1}`,
        { x: Math.round(p.x - 6), y: Math.round(p.y - 6), w: 12, h: 12 },
        color(theme, 'accent'),
        meta(slot, 'visual', 'data-line'),
        'ellipse'
      )
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: Math.round(p.x - 20), y: plot.y + plot.h + 4, w: 40, h: labelH },
        String(labels[i] || ''),
        theme,
        'muted',
        's',
        slot,
        'data-line'
      )
    );
  });
  return nodes;
}

function emitFunnel(prefix, box, theme, data, slot) {
  const labels = listOf(data.stages || data.labels || data.items, ['访问', '意向', '成交']);
  const n = clamp(labels.length, 2, 5);
  const items = labels.slice(0, n);
  const gap = 10;
  const rowH = Math.floor((box.h - 16 - gap * (n - 1)) / n);
  const nodes = [];
  items.forEach((label, i) => {
    const shrink = Math.round((box.w * 0.18 * i) / Math.max(1, n - 1));
    const y = box.y + 8 + i * (rowH + gap);
    const row = { x: box.x + shrink, y, w: box.w - shrink * 2, h: rowH };
    nodes.push(
      geo(`${prefix}-row-${i + 1}`, row, color(theme, i % 2 ? 'accent2' : 'accent'), meta(slot, 'visual', 'funnel'), 'trapezoid')
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: row.x + 12, y: row.y + Math.round(rowH / 2) - 14, w: row.w - 24, h: 28 },
        String(label),
        theme,
        'paper',
        's',
        slot,
        'funnel'
      )
    );
  });
  return nodes;
}

function emitQuadrant(prefix, box, theme, data, slot) {
  const labels = listOf(data.cells || data.labels || data.items, ['A', 'B', 'C', 'D']);
  const gap = 12;
  const colW = Math.floor((box.w - gap) / 2);
  const rowH = Math.floor((box.h - gap) / 2);
  const nodes = [];
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cell = { x: box.x + col * (colW + gap), y: box.y + row * (rowH + gap), w: colW, h: rowH };
    nodes.push(geo(`${prefix}-q-${i + 1}`, cell, color(theme, 'surface'), meta(slot, 'card', 'quadrant'), 'rectangle'));
    nodes.push(
      text(
        `${prefix}-q-${i + 1}-t`,
        { x: cell.x + 16, y: cell.y + 16, w: cell.w - 32, h: 32 },
        String(labels[i] || ''),
        theme,
        'ink',
        'm',
        slot,
        'quadrant'
      )
    );
  }
  return nodes;
}

function emitTimelineRail(prefix, box, theme, data, slot) {
  const labels = listOf(data.steps || data.labels || data.items, ['选中', '描述', '编译', '交付']);
  const n = clamp(labels.length, 2, 6);
  const items = labels.slice(0, n);
  const railY = box.y + Math.round(box.h * 0.38);
  const pad = 28;
  const nodes = [
    geo(
      `${prefix}-rail`,
      { x: box.x + pad, y: railY, w: box.w - pad * 2, h: 8 },
      color(theme, 'rule'),
      meta(slot, 'decoration', 'timeline-rail'),
      'rectangle'
    )
  ];
  items.forEach((label, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = box.x + pad + t * (box.w - pad * 2);
    nodes.push(
      geo(
        `${prefix}-dot-${i + 1}`,
        { x: Math.round(cx - 8), y: railY - 4, w: 16, h: 16 },
        color(theme, 'accent'),
        meta(slot, 'accent', 'timeline-rail'),
        'ellipse'
      )
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: Math.round(cx - 60), y: railY + 20, w: 120, h: 36 },
        String(label),
        theme,
        'ink',
        's',
        slot,
        'timeline-rail'
      )
    );
  });
  return nodes;
}

function emitChecklist(prefix, box, theme, data, slot) {
  const labels = listOf(data.items || data.labels || data.steps, ['圈选上下文', '描述结果', '编译画布']);
  const n = clamp(labels.length, 2, 5);
  const items = labels.slice(0, n);
  const rowH = Math.floor((box.h - 16) / n);
  const iconS = Math.min(28, Math.max(18, rowH - 16));
  const nodes = [];
  items.forEach((label, i) => {
    const y = box.y + 8 + i * rowH;
    nodes.push(
      iconNode(
        `${prefix}-ck-${i + 1}`,
        { x: box.x + 8, y: y + Math.round((rowH - iconS) / 2), w: iconS, h: iconS },
        'check',
        theme,
        slot,
        'checklist-stack'
      )
    );
    nodes.push(
      text(
        `${prefix}-tx-${i + 1}`,
        { x: box.x + 16 + iconS, y, w: box.w - 28 - iconS, h: rowH },
        String(label),
        theme,
        'ink',
        'm',
        slot,
        'checklist-stack'
      )
    );
  });
  return nodes;
}

function emitDeviceFrame(prefix, box, theme, data, slot) {
  const nodes = [];
  nodes.push(geo(`${prefix}-bezel`, box, color(theme, 'ink'), meta(slot, 'card', 'device-frame'), 'rectangle'));
  const inset = 14;
  const screen = { x: box.x + inset, y: box.y + inset + 10, w: box.w - inset * 2, h: box.h - inset * 2 - 28 };
  nodes.push(geo(`${prefix}-screen`, screen, color(theme, 'surface'), meta(slot, 'visual', 'device-frame'), 'rectangle'));
  nodes.push(
    geo(
      `${prefix}-home`,
      { x: Math.round(box.x + box.w / 2 - 10), y: box.y + box.h - 22, w: 20, h: 8 },
      color(theme, 'paper'),
      meta(slot, 'decoration', 'device-frame'),
      'ellipse'
    )
  );
  const iconName = pickIcon(data.icon || 'smartphone');
  const iconS = Math.round(Math.min(screen.w, screen.h) * 0.24);
  nodes.push(
    iconNode(
      `${prefix}-icon`,
      {
        x: Math.round(screen.x + (screen.w - iconS) / 2),
        y: Math.round(screen.y + (screen.h - iconS) / 2),
        w: iconS,
        h: iconS
      },
      iconName,
      theme,
      slot,
      'device-frame'
    )
  );
  return nodes;
}

function geo(id, box, fill, metaObj, geoType = 'rectangle') {
  return {
    id,
    type: 'geo',
    tag: 'div',
    geo: geoType,
    text: '',
    box: { ...box },
    fill,
    color: fill,
    fillKind: 'solid',
    dash: 'solid',
    provenance: 'layout',
    meta: metaObj
  };
}

function text(id, box, value, theme, role, size, slot, motifId) {
  const fill = color(theme, role === 'paper' ? 'paper' : role);
  return {
    id,
    type: size === 'l' ? 'heading' : 'text',
    tag: size === 'l' ? 'h2' : 'p',
    text: String(value || ''),
    box: { ...box },
    color: fill,
    fill,
    size,
    font: theme?.font || 'sans',
    align: 'start',
    provenance: 'layout',
    meta: meta(slot, role === 'paper' ? 'ink' : role, motifId)
  };
}

function iconNode(id, box, name, theme, slot, motifId) {
  const src = iconSvgDataUrl(name, themeHex(theme, 'ink'));
  return {
    id,
    type: 'image',
    tag: 'img',
    src,
    alt: name,
    box: { ...box },
    provenance: 'layout',
    meta: {
      ...meta(slot, 'visual', motifId),
      pawAssetKind: 'icon',
      pawIconId: name,
      pawLicense: 'ISC',
      pawProvider: 'lucide',
      pawAlt: name
    }
  };
}

function lineNode(id, x1, y1, x2, y2, theme, slot, motifId) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(4, Math.hypot(dx, dy));
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    id,
    type: 'line',
    tag: 'div',
    geo: 'rectangle',
    text: '',
    box: { x: Math.round(x1), y: Math.round(y1 - 2), w: Math.round(len), h: 4 },
    degrees: deg,
    fill: color(theme, 'rule'),
    color: color(theme, 'rule'),
    fillKind: 'solid',
    dash: 'solid',
    provenance: 'layout',
    meta: { ...meta(slot, 'decoration', motifId), pawKind: 'line' }
  };
}

function meta(slot, role, motifId) {
  return {
    pawSlot: slot,
    pawRole: role,
    pawAssetKind: 'motif',
    pawMotifId: motifId
  };
}

function color(theme, role) {
  return tldrawColorForRole(role === 'paper' ? 'paper' : role, theme?.variant, theme) || tldrawColorForRole('ink', theme?.variant, theme);
}

function themeHex(theme, role) {
  return themeHexForRole(theme, role, theme?.variant) || theme?.ink || '#111111';
}

function normalizeBox(box) {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w);
  const h = Number(box.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n)) || w < 8 || h < 8) return null;
  return { x, y, w, h };
}

function listOf(raw, fallback) {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((v) => (v && typeof v === 'object' ? String(v.title || v.label || v.text || v.name || '') : String(v)));
  }
  return fallback.slice();
}

function numbersOf(raw, fallback) {
  if (Array.isArray(raw) && raw.length) {
    const nums = raw.map((v) => Number(v && typeof v === 'object' ? v.value : v));
    if (nums.every((n) => Number.isFinite(n))) return nums;
  }
  return fallback.slice();
}

function pickIcon(name) {
  const id = String(name || '').replace(/^icon:/, '');
  return CANVAS_ICONS[id] ? id : 'globe';
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function clipNode(node, box) {
  if (!node?.box) return node;
  const x = Math.max(box.x, node.box.x);
  const y = Math.max(box.y, node.box.y);
  const r = Math.min(box.x + box.w, node.box.x + node.box.w);
  const b = Math.min(box.y + box.h, node.box.y + node.box.h);
  return { ...node, box: { x, y, w: Math.max(4, r - x), h: Math.max(4, b - y) } };
}
