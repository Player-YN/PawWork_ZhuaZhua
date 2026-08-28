/**
 * Visual slot grammar + provenance + compact catalog read surface.
 * Compiles icon / motif / chart / image into native scene nodes.
 */

import { CANVAS_ICONS } from './canvasIconPack.js';
import { iconSvgDataUrl } from './canvasPresets.js';
import {
  compactIconCatalog,
  resolveIconName,
  searchIcons,
  suggestIcons,
  unknownIconError
} from './iconCatalog.js';
import { compactMotifCatalog, compileMotif, listMotifIds, searchMotifs } from './canvasMotifs.js';
import { compactChartCatalog, compileChart } from './canvasCharts.js';
import { buildGeneratedImageBrief } from './imageBrief.js';
import { tldrawColorForRole, themeHexForRole } from './themeCatalog.js';
import { officeImageRef } from './sheetImageHydrate.js';

export const VISUAL_KINDS = ['icon', 'motif', 'chart', 'image'];
export const ASSET_KINDS = ['selection', 'workspace', 'icon', 'motif', 'chart', 'generated'];

export function compactVisualCatalog() {
  const icons = compactIconCatalog();
  const motifs = compactMotifCatalog();
  const charts = compactChartCatalog();
  return {
    kinds: VISUAL_KINDS.slice(),
    icons: { count: icons.count, common: icons.common, categories: icons.categories, hint: icons.hint },
    motifs: motifs.motifs.map((m) => m.id),
    charts: charts.types,
    image: { aliases: ['path', 'artifactId', 'item', 'handle'], fit: ['cover', 'contain'] },
    generated: {
      catalog: 'image-brief',
      acquire: 'image',
      args: ['layoutId', 'themeId', 'subject'],
      hint: 'deck act=read catalog="image-brief" layoutId themeId subject'
    }
  };
}

export function readVisualCatalog(input = {}) {
  const kind = String(input.catalog || '').trim().toLowerCase();
  const query = String(input.query || input.q || input.name || '').trim();
  const limit = clampInt(input.limit, 1, 24, 8);
  if (kind === 'icons' || kind === 'icon') {
    if (!query) return { ok: true, ...compactIconCatalog() };
    const icons = searchIcons(query, { limit });
    return { ok: true, catalog: 'icons', query, count: icons.length, icons };
  }
  if (kind === 'motifs' || kind === 'motif') {
    if (!query) return { ok: true, ...compactMotifCatalog() };
    return { ok: true, catalog: 'motifs', query, motifs: searchMotifs(query, { limit }) };
  }
  if (kind === 'charts' || kind === 'chart') {
    return { ok: true, ...compactChartCatalog() };
  }
  if (kind === 'visuals' || kind === 'visual') {
    return { ok: true, catalog: 'visuals', ...compactVisualCatalog() };
  }
  if (kind === 'image-brief' || kind === 'imagebrief' || kind === 'image_brief') {
    return publicImageBrief(input, query);
  }
  return {
    ok: false,
    error: `unknown catalog "${kind || ''}" (use icons | motifs | charts | visuals | image-brief)`
  };
}

function publicImageBrief(input, query) {
  const subject = String(input.subject || input.intent || query || '').trim();
  const brief = buildGeneratedImageBrief({
    layoutId: input.layoutId,
    themeId: input.themeId,
    subject,
    slot: input.slot,
    fit: input.fit,
    focalPoint: input.focalPoint
  });
  return {
    ok: true,
    catalog: 'image-brief',
    layoutId: String(input.layoutId || '').trim(),
    themeId: String(input.themeId || '').trim(),
    subject: subject || String(brief.acquire?.prompt || '').slice(0, 80),
    aspectRatio: brief.aspectRatio,
    width: brief.width,
    height: brief.height,
    palette: brief.palette,
    prompt: brief.prompt,
    noText: brief.noText === true,
    noWatermark: brief.noWatermark === true,
    acquire: {
      action: 'image',
      aspect_ratio: brief.acquire?.aspect_ratio || brief.aspectRatio,
      prompt: brief.acquire?.prompt || brief.prompt
    }
  };
}

/**
 * Parse a visual slot value. Strings stay backward-compatible (icon id or image alias).
 */
export function parseVisual(raw) {
  if (raw == null || raw === '') return { ok: true, kind: 'empty' };
  if (typeof raw === 'string' || typeof raw === 'number') {
    const s = String(raw).trim();
    const name = s.replace(/^icon:/, '');
    if (CANVAS_ICONS[name] && !/^(https?:|data:|\/|artifact:)/i.test(s)) {
      return { ok: true, kind: 'icon', name };
    }
    if (/^(https?:)/i.test(s) && !looksLikeAlias(s)) {
      return {
        ok: false,
        error: 'image visual needs a workspace path, artifactId, item, or handle — remote URL is not durable truth'
      };
    }
    if (looksLikeAlias(s) || /[./]/.test(s) || /^(data:|\/|artifact:)/i.test(s)) {
      return { ok: true, kind: 'image', src: s, fit: 'cover' };
    }
    const resolved = resolveIconName(name);
    if (resolved.ok) return { ok: true, kind: 'icon', name: resolved.name, query: name };
    return { ok: false, error: resolved.error, suggestions: resolved.suggestions };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'visual must be a string or object' };
  }
  const kind = String(raw.kind || inferObjectKind(raw)).trim().toLowerCase();
  if (kind === 'icon') {
    const q = String(raw.name || raw.icon || raw.query || '').replace(/^icon:/, '');
    const resolved = resolveIconName(q);
    if (!resolved.ok) return resolved;
    return { ok: true, kind: 'icon', name: resolved.name, query: raw.query || '', alt: String(raw.alt || resolved.name) };
  }
  if (kind === 'motif') {
    const id = String(raw.id || raw.motif || raw.name || '').trim();
    if (!id) return { ok: false, error: 'motif visual needs id', suggestions: listMotifIds().map((m) => ({ id: m })) };
    return { ok: true, kind: 'motif', id, data: raw.data && typeof raw.data === 'object' ? raw.data : {} };
  }
  if (kind === 'chart') {
    return {
      ok: true,
      kind: 'chart',
      type: String(raw.type || raw.chart || '').trim().toLowerCase(),
      data: raw.data,
      labels: raw.labels,
      valueFormat: raw.valueFormat || raw.format || ''
    };
  }
  if (kind === 'image') {
    const src = officeImageRef({ ...raw, value: undefined }, { allowValue: false }) || String(raw.artifactId || '').trim();
    if (!src) {
      return { ok: false, error: 'image visual needs path, artifactId, item, or handle' };
    }
    if (/^https?:/i.test(src) && !raw.path && !raw.artifactId && !raw.item && !raw.handle) {
      return {
        ok: false,
        error: 'image visual needs a workspace path, artifactId, item, or handle — remote URL is not durable truth'
      };
    }
    const fit = String(raw.fit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
    return {
      ok: true,
      kind: 'image',
      src,
      path: raw.path ? String(raw.path) : '',
      artifactId: raw.artifactId ? String(raw.artifactId) : '',
      item: raw.item ? String(raw.item) : '',
      handle: raw.handle ? String(raw.handle) : '',
      fit,
      focalPoint: normalizeFocal(raw.focalPoint),
      alt: String(raw.alt || raw.caption || ''),
      generated: raw.generated === true || raw.origin === 'generated'
    };
  }
  if (kind === 'empty') return { ok: true, kind: 'empty' };
  return { ok: false, error: `unknown visual kind "${kind}" (use icon | motif | chart | image)` };
}

export function validateVisual(raw) {
  const parsed = parseVisual(raw);
  if (!parsed.ok) return parsed.error;
  if (parsed.kind === 'chart') {
    const compiled = compileChart({
      type: parsed.type,
      data: parsed.data,
      labels: parsed.labels,
      valueFormat: parsed.valueFormat,
      box: { x: 0, y: 0, w: 400, h: 300 }
    });
    if (!compiled.ok) return compiled.error;
  }
  if (parsed.kind === 'motif') {
    const compiled = compileMotif({
      id: parsed.id,
      box: { x: 0, y: 0, w: 400, h: 300 },
      data: parsed.data
    });
    if (!compiled.ok) return compiled.error;
  }
  return '';
}

export function isPackagedIconVisual(raw) {
  const parsed = parseVisual(raw);
  return parsed.ok && parsed.kind === 'icon' && !!CANVAS_ICONS[parsed.name];
}

/**
 * Compile a visual into scene nodes that fit `box`.
 */
export function compileVisual({ raw, box, theme, slotName, nodeId }) {
  const parsed = parseVisual(raw);
  if (!parsed.ok) return parsed;
  if (parsed.kind === 'empty') return { ok: true, nodes: [] };
  const prefix = String(nodeId || slotName || 'visual');
  const slot = slotName || 'visual';
  if (parsed.kind === 'icon') {
    return { ok: true, nodes: [iconImageNode(prefix, box, parsed, theme, slot)] };
  }
  if (parsed.kind === 'motif') {
    return compileMotif({
      id: parsed.id,
      box,
      theme,
      data: parsed.data,
      slotName: slot,
      nodeId: prefix
    });
  }
  if (parsed.kind === 'chart') {
    return compileChart({
      type: parsed.type,
      data: parsed.data,
      labels: parsed.labels,
      valueFormat: parsed.valueFormat,
      box,
      theme,
      slotName: slot,
      nodeId: prefix
    });
  }
  return { ok: true, nodes: [workspaceImageNode(prefix, box, parsed, slot)] };
}

export function stampAssetMeta(base, extra = {}) {
  return {
    ...base,
    pawAssetKind: extra.pawAssetKind || base.pawAssetKind || '',
    ...(extra.pawIconId || base.pawIconId ? { pawIconId: extra.pawIconId || base.pawIconId } : {}),
    ...(extra.pawMotifId || base.pawMotifId ? { pawMotifId: extra.pawMotifId || base.pawMotifId } : {}),
    ...(extra.pawChartType || base.pawChartType ? { pawChartType: extra.pawChartType || base.pawChartType } : {}),
    ...(extra.pawAlt || base.pawAlt ? { pawAlt: extra.pawAlt || base.pawAlt } : {}),
    ...(extra.pawLicense || base.pawLicense ? { pawLicense: extra.pawLicense || base.pawLicense } : {}),
    ...(extra.pawProvider || base.pawProvider ? { pawProvider: extra.pawProvider || base.pawProvider } : {}),
    ...sourceMeta(extra)
  };
}

function iconImageNode(id, box, parsed, theme, slot) {
  const src = iconSvgDataUrl(parsed.name, themeHexForRole(theme, 'ink', theme?.variant) || theme?.ink || '#111111');
  return {
    id,
    type: 'image',
    tag: 'img',
    src,
    alt: parsed.alt || parsed.name,
    box: { ...box },
    provenance: 'layout',
    meta: stampAssetMeta(
      { pawSlot: slot, pawRole: 'visual', pawIcon: parsed.name },
      {
        pawAssetKind: 'icon',
        pawIconId: parsed.name,
        pawAlt: parsed.alt || parsed.name,
        pawLicense: 'ISC',
        pawProvider: 'lucide'
      }
    )
  };
}

function workspaceImageNode(id, box, parsed, slot) {
  const kind = inferImageAssetKind(parsed);
  return {
    id,
    type: 'image',
    tag: 'img',
    src: parsed.src,
    alt: parsed.alt || slot || 'image',
    box: { ...box },
    fit: parsed.fit || 'cover',
    focalPoint: parsed.focalPoint || { x: 0.5, y: 0.5 },
    provenance: 'layout',
    meta: stampAssetMeta(
      { pawSlot: slot, pawRole: 'visual', src: parsed.src },
      {
        pawAssetKind: kind,
        pawAlt: parsed.alt || '',
        path: parsed.path || '',
        artifactId: parsed.artifactId || '',
        item: parsed.item || '',
        handle: parsed.handle || '',
        pawFit: parsed.fit || 'cover',
        pawFocalPoint: parsed.focalPoint || { x: 0.5, y: 0.5 }
      }
    )
  };
}

function inferImageAssetKind(parsed) {
  if (parsed.generated) return 'generated';
  const src = String(parsed.src || '');
  if (parsed.item || parsed.handle || /^(图片|截图|image|img|screenshot|wi_)/i.test(src)) return 'selection';
  return 'workspace';
}

function inferObjectKind(raw) {
  if (raw.type && (raw.data != null || raw.labels)) return 'chart';
  if (raw.id && listMotifIds().includes(String(raw.id))) return 'motif';
  if (raw.name || raw.icon || raw.query) return 'icon';
  if (raw.path || raw.artifactId || raw.item || raw.handle || raw.src) return 'image';
  return '';
}

function looksLikeAlias(s) {
  return (
    /^\/(?:artifacts|scratch)\//i.test(s) ||
    /^artifact:/i.test(s) ||
    /^wi_/i.test(s) ||
    /^(图片|截图|image|img|screenshot)\s*\d+$/i.test(s) ||
    /^data:image\//i.test(s)
  );
}

function normalizeFocal(raw) {
  if (!raw || typeof raw !== 'object') return { x: 0.5, y: 0.5 };
  const x = Number(raw.x);
  const y = Number(raw.y);
  return {
    x: Number.isFinite(x) ? clamp01(x) : 0.5,
    y: Number.isFinite(y) ? clamp01(y) : 0.5
  };
}

function sourceMeta(extra) {
  const out = {};
  if (extra.path) out.pawAssetPath = String(extra.path);
  if (extra.artifactId) out.pawAssetArtifactId = String(extra.artifactId);
  if (extra.item) out.pawAssetItem = String(extra.item);
  if (extra.handle) out.pawAssetHandle = String(extra.handle);
  if (extra.pawFit) out.pawFit = extra.pawFit;
  if (extra.pawFocalPoint) out.pawFocalPoint = extra.pawFocalPoint;
  return out;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export { searchIcons, suggestIcons, unknownIconError, tldrawColorForRole };
