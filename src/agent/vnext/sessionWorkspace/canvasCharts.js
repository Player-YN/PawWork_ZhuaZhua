/**
 * Native bar / line / donut charts. Honest scales, editable labels, no raster.
 */

import { tldrawColorForRole } from './themeCatalog.js';

export const CHART_TYPES = ['bar', 'line', 'donut'];

export function compactChartCatalog() {
  return {
    catalog: 'charts',
    types: CHART_TYPES.slice(),
    hint: 'slots.visual = { kind:"chart", type:"bar|line|donut", data:[...], labels?, valueFormat? }'
  };
}

/**
 * @returns {{ ok: true, series: { value: number, label: string }[] } | { ok: false, error: string }}
 */
export function parseChartSeries(raw, labels) {
  if (raw == null) return { ok: false, error: 'chart needs data[]' };
  if (!Array.isArray(raw)) return { ok: false, error: 'chart data must be an array' };
  if (!raw.length) return { ok: false, error: 'chart data is empty' };
  const labelList = Array.isArray(labels) ? labels.map((v) => String(v)) : null;
  if (labelList && labelList.length !== raw.length) {
    return {
      ok: false,
      error: `chart labels length ${labelList.length} does not match data length ${raw.length}`
    };
  }
  const series = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    let value;
    let label;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      value = item.value ?? item.y ?? item.n;
      label = item.label ?? item.name ?? item.x ?? labelList?.[i] ?? String(i + 1);
    } else {
      value = item;
      label = labelList?.[i] ?? String(i + 1);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return { ok: false, error: `chart data[${i}] is not a finite number (${String(value)})` };
    }
    series.push({ value: n, label: String(label ?? '') });
  }
  if (series.every((s) => s.value === 0)) {
    return { ok: false, error: 'chart data is all zeros — nothing honest to plot' };
  }
  return { ok: true, series };
}

export function formatChartValue(value, valueFormat) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const fmt = String(valueFormat || '').trim().toLowerCase();
  if (fmt === 'percent' || fmt === '%') return `${trimNum(n)}%`;
  if (fmt === 'compact') return compactNum(n);
  if (fmt && fmt !== 'number') return `${trimNum(n)}${valueFormat}`;
  return trimNum(n);
}

/**
 * @returns {{ ok: true, nodes: object[] } | { ok: false, error: string }}
 */
export function compileChart({ type, data, labels, valueFormat, box, theme, slotName, nodeId }) {
  const chartType = String(type || '').trim().toLowerCase();
  if (!CHART_TYPES.includes(chartType)) {
    return { ok: false, error: `unknown chart type "${type || ''}" (use bar | line | donut)` };
  }
  const parsed = parseChartSeries(data, labels);
  if (!parsed.ok) return parsed;
  const b = normalizeBox(box);
  if (!b) return { ok: false, error: 'chart needs a layout box' };
  if (chartType === 'donut' && parsed.series.some((s) => s.value < 0)) {
    return { ok: false, error: 'donut chart cannot represent negative values honestly' };
  }
  if (chartType === 'donut' && parsed.series.every((s) => s.value <= 0)) {
    return { ok: false, error: 'donut chart needs at least one positive value' };
  }
  const prefix = String(nodeId || `chart-${chartType}`);
  const slot = slotName || 'visual';
  const rawNodes =
    chartType === 'bar'
      ? emitBar(prefix, b, theme, parsed.series, valueFormat, slot)
      : chartType === 'line'
        ? emitLine(prefix, b, theme, parsed.series, valueFormat, slot)
        : emitDonut(prefix, b, theme, parsed.series, valueFormat, slot);
  return { ok: true, nodes: rawNodes.map((n) => clipNode(n, b)) };
}

function emitBar(prefix, box, theme, series, valueFormat, slot) {
  const pad = 16;
  const labelH = 26;
  const valueH = 22;
  const plot = { x: box.x + pad, y: box.y + pad + valueH, w: box.w - pad * 2, h: box.h - pad * 2 - labelH - valueH };
  const values = series.map((s) => s.value);
  const yMin = Math.min(0, ...values);
  const yMax = Math.max(0, ...values);
  const span = yMax - yMin || 1;
  const zeroY = plot.y + plot.h - ((0 - yMin) / span) * plot.h;
  const n = series.length;
  const gap = 10;
  const barW = Math.max(8, Math.floor((plot.w - gap * Math.max(0, n - 1)) / n));
  const nodes = [
    geo(
      `${prefix}-axis`,
      { x: plot.x, y: Math.round(zeroY) - 1, w: plot.w, h: 3 },
      color(theme, 'rule'),
      meta(slot, 'decoration', 'bar'),
      'rectangle'
    )
  ];
  series.forEach((s, i) => {
    const x = plot.x + i * (barW + gap);
    const top = plot.y + plot.h - ((s.value - yMin) / span) * plot.h;
    const y = Math.min(zeroY, top);
    const h = Math.max(4, Math.abs(zeroY - top));
    nodes.push(
      geo(
        `${prefix}-bar-${i + 1}`,
        { x: Math.round(x), y: Math.round(y), w: barW, h: Math.round(h) },
        color(theme, i % 2 ? 'accent2' : 'accent'),
        meta(slot, 'visual', 'bar'),
        'rectangle'
      )
    );
    nodes.push(
      text(
        `${prefix}-val-${i + 1}`,
        { x: Math.round(x), y: Math.round(y) - valueH, w: barW, h: valueH },
        formatChartValue(s.value, valueFormat),
        theme,
        'ink',
        's',
        slot,
        'bar'
      )
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: Math.round(x), y: plot.y + plot.h + 4, w: barW, h: labelH },
        s.label,
        theme,
        'muted',
        's',
        slot,
        'bar'
      )
    );
  });
  return nodes;
}

function emitLine(prefix, box, theme, series, valueFormat, slot) {
  const pad = 20;
  const labelH = 24;
  const plot = { x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: box.h - pad * 2 - labelH };
  const values = series.map((s) => s.value);
  const yMin = Math.min(0, ...values);
  const yMax = Math.max(0, ...values);
  const span = yMax - yMin || 1;
  const zeroY = plot.y + plot.h - ((0 - yMin) / span) * plot.h;
  const nodes = [
    geo(
      `${prefix}-axis`,
      { x: plot.x, y: Math.round(zeroY) - 1, w: plot.w, h: 3 },
      color(theme, 'rule'),
      meta(slot, 'decoration', 'line'),
      'rectangle'
    )
  ];
  const pts = series.map((s, i) => {
    const t = series.length === 1 ? 0.5 : i / (series.length - 1);
    return {
      x: plot.x + t * plot.w,
      y: plot.y + plot.h - ((s.value - yMin) / span) * plot.h,
      label: s.label,
      value: s.value
    };
  });
  for (let i = 0; i < pts.length - 1; i++) {
    nodes.push(lineNode(`${prefix}-seg-${i + 1}`, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, theme, slot, 'line'));
  }
  pts.forEach((p, i) => {
    nodes.push(
      geo(
        `${prefix}-pt-${i + 1}`,
        { x: Math.round(p.x - 6), y: Math.round(p.y - 6), w: 12, h: 12 },
        color(theme, 'accent'),
        meta(slot, 'visual', 'line'),
        'ellipse'
      )
    );
    nodes.push(
      text(
        `${prefix}-val-${i + 1}`,
        { x: Math.round(p.x - 24), y: Math.round(p.y) - 26, w: 48, h: 20 },
        formatChartValue(p.value, valueFormat),
        theme,
        'ink',
        's',
        slot,
        'line'
      )
    );
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: Math.round(p.x - 28), y: plot.y + plot.h + 4, w: 56, h: labelH },
        p.label,
        theme,
        'muted',
        's',
        slot,
        'line'
      )
    );
  });
  return nodes;
}

function emitDonut(prefix, box, theme, series, valueFormat, slot) {
  const total = series.reduce((s, r) => s + Math.max(0, r.value), 0);
  const s = Math.round(Math.min(box.w, box.h) * 0.62);
  const ring = {
    x: Math.round(box.x + (box.w - s) / 2),
    y: Math.round(box.y + 8),
    w: s,
    h: s
  };
  const cx = ring.x + s / 2;
  const cy = ring.y + s / 2;
  const hole = Math.round(s * 0.52);
  const tiles = 12;
  const counts = largestRemainder(
    series.map((r) => Math.max(0, r.value)),
    tiles
  );
  const colors = ['accent', 'accent2', 'ink', 'muted'];
  const nodes = [
    geo(`${prefix}-track`, ring, color(theme, 'surface'), meta(slot, 'decoration', 'donut'), 'ellipse')
  ];
  let k = 0;
  counts.forEach((count, i) => {
    for (let j = 0; j < count; j++) {
      const ang = ((k + 0.5) / tiles) * Math.PI * 2 - Math.PI / 2;
      const ringR = s * 0.36;
      const tile = 18;
      nodes.push(
        geo(
          `${prefix}-seg-${i + 1}-${j + 1}`,
          {
            x: Math.round(cx + Math.cos(ang) * ringR - tile / 2),
            y: Math.round(cy + Math.sin(ang) * ringR - tile / 2),
            w: tile,
            h: tile
          },
          color(theme, colors[i % colors.length]),
          meta(slot, 'visual', 'donut'),
          'ellipse'
        )
      );
      k += 1;
    }
  });
  nodes.push(
    geo(
      `${prefix}-hole`,
      { x: Math.round(cx - hole / 2), y: Math.round(cy - hole / 2), w: hole, h: hole },
      color(theme, 'paper'),
      meta(slot, 'decoration', 'donut'),
      'ellipse'
    )
  );
  nodes.push(
    text(
      `${prefix}-total`,
      { x: Math.round(cx - hole / 2), y: Math.round(cy - 14), w: hole, h: 28 },
      formatChartValue(total, valueFormat),
      theme,
      'ink',
      'm',
      slot,
      'donut'
    )
  );
  const labelW = Math.floor((box.w - 16) / Math.min(4, series.length));
  series.forEach((row, i) => {
    nodes.push(
      text(
        `${prefix}-lab-${i + 1}`,
        { x: box.x + 8 + (i % 4) * labelW, y: ring.y + s + 8, w: labelW, h: 22 },
        `${row.label} ${formatChartValue(row.value, valueFormat)}`,
        theme,
        'muted',
        's',
        slot,
        'donut'
      )
    );
  });
  return nodes;
}

function largestRemainder(values, seats) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const raw = values.map((v) => (v / total) * seats);
  const counts = raw.map((v) => Math.floor(v));
  let left = seats - counts.reduce((s, n) => s + n, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const row of order) {
    if (left <= 0) break;
    counts[row.i] += 1;
    left -= 1;
  }
  return counts;
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

function text(id, box, value, theme, role, size, slot, chartType) {
  const fill = color(theme, role);
  return {
    id,
    type: 'text',
    tag: 'p',
    text: String(value || ''),
    box: { ...box },
    color: fill,
    fill,
    size,
    font: theme?.font || 'sans',
    align: 'start',
    provenance: 'layout',
    meta: meta(slot, role, chartType)
  };
}

function lineNode(id, x1, y1, x2, y2, theme, slot, chartType) {
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
    fill: color(theme, 'accent'),
    color: color(theme, 'accent'),
    fillKind: 'solid',
    dash: 'solid',
    provenance: 'layout',
    meta: { ...meta(slot, 'decoration', chartType), pawKind: 'line' }
  };
}

function meta(slot, role, chartType) {
  return {
    pawSlot: slot,
    pawRole: role,
    pawAssetKind: 'chart',
    pawChartType: chartType
  };
}

function color(theme, role) {
  return tldrawColorForRole(role, theme?.variant, theme) || tldrawColorForRole('ink', theme?.variant, theme);
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

function trimNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function compactNum(n) {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${trimNum(n / 1e6)}M`;
  if (abs >= 1e3) return `${trimNum(n / 1e3)}k`;
  return trimNum(n);
}

function clipNode(node, box) {
  if (!node?.box) return node;
  const x = Math.max(box.x, node.box.x);
  const y = Math.max(box.y, node.box.y);
  const r = Math.min(box.x + box.w, node.box.x + node.box.w);
  const btm = Math.min(box.y + box.h, node.box.y + node.box.h);
  return { ...node, box: { x, y, w: Math.max(4, r - x), h: Math.max(4, btm - y) } };
}
