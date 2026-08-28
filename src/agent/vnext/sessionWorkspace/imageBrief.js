/**
 * Theme-aware generated-image brief. Does not call the network.
 * Skills / runtime descriptions pass the result to acquire({ action: 'image' }).
 */

import { NO_TEXT_PROMPT_CLAUSE, stampNoTextPrompt } from './imageGen.js';
import { DEFAULT_THEME_ID, getTheme, resolveTheme } from './themeCatalog.js';
import { getLayout } from './layoutCatalog.js';

const RATIOS = [
  { id: '1:1', w: 1, h: 1, pxW: 1024, pxH: 1024 },
  { id: '4:3', w: 4, h: 3, pxW: 1024, pxH: 768 },
  { id: '3:4', w: 3, h: 4, pxW: 768, pxH: 1024 },
  { id: '16:9', w: 16, h: 9, pxW: 1280, pxH: 720 },
  { id: '9:16', w: 9, h: 16, pxW: 720, pxH: 1280 },
  { id: '3:2', w: 3, h: 2, pxW: 1200, pxH: 800 },
  { id: '2:3', w: 2, h: 3, pxW: 800, pxH: 1200 }
];

export function nearestAspectRatio(w, h) {
  const width = Math.max(1, Number(w) || 1);
  const height = Math.max(1, Number(h) || 1);
  const target = width / height;
  let best = RATIOS[0];
  let bestDiff = Infinity;
  for (const r of RATIOS) {
    const diff = Math.abs(r.w / r.h - target);
    if (diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  return { ...best };
}

export function visualSlotBox(layoutId, slotName = 'visual') {
  const layout = getLayout(layoutId);
  if (!layout) return null;
  const box = layout.boxes?.[slotName];
  return box ? { ...box } : null;
}

/**
 * @param {{
 *   box?: { w?: number, h?: number },
 *   layoutId?: string,
 *   slot?: string,
 *   theme?: object,
 *   themeId?: string,
 *   intent?: string,
 *   fit?: 'cover'|'contain',
 *   focalPoint?: { x?: number, y?: number },
 *   subject?: string
 * }} [input]
 */
export function buildGeneratedImageBrief(input = {}) {
  const slot = String(input.slot || 'visual');
  const box = input.box && typeof input.box === 'object' ? input.box : visualSlotBox(input.layoutId, slot) || { w: 1024, h: 768 };
  const w = Number(box.w) || 1024;
  const h = Number(box.h) || 768;
  const ratio = nearestAspectRatio(w, h);
  const theme = input.theme || resolveTheme(input.themeId) || getTheme(DEFAULT_THEME_ID);
  const fit = String(input.fit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
  const focal = {
    x: clamp01(Number(input.focalPoint?.x)),
    y: clamp01(Number(input.focalPoint?.y))
  };
  const subject = String(input.subject || input.intent || 'abstract editorial illustration for a product slide').trim();
  const artDirection = [
    `${theme?.name || theme?.id || 'Editorial'} palette`,
    `paper ${theme?.paper || '#F7F4EE'}`,
    `ink ${theme?.ink || '#161616'}`,
    `accent ${theme?.accent || '#9B1D2E'}`,
    `accent2 ${theme?.accent2 || '#1F4B7A'}`,
    'flat geometric illustration, quiet composition, no collage, no stock-photo look'
  ].join('; ');
  const composition = [
    fit === 'cover' ? 'fill the frame; subject near the focal point' : 'contain the subject with quiet margins',
    `focal point ${focal.x.toFixed(2)}, ${focal.y.toFixed(2)}`,
    'leave breathing room for overlay text that will be added as native canvas nodes'
  ].join('; ');
  const prompt = stampNoTextPrompt(`${subject}. ${artDirection}. ${composition}. No watermark.`);
  return {
    aspectRatio: ratio.id,
    width: ratio.pxW,
    height: ratio.pxH,
    palette: {
      paper: theme?.paper || '',
      ink: theme?.ink || '',
      muted: theme?.muted || '',
      accent: theme?.accent || '',
      accent2: theme?.accent2 || '',
      surface: theme?.surface || ''
    },
    artDirection,
    noText: true,
    noWatermark: true,
    noTextClause: NO_TEXT_PROMPT_CLAUSE,
    composition: { fit, focalPoint: focal, guidance: composition },
    prompt,
    acquire: {
      action: 'image',
      aspect_ratio: ratio.id,
      prompt
    },
    then: 'pass the returned artifact path or artifactId into slots.visual { kind:"image", path|artifactId, fit, alt }'
  };
}

function clamp01(n) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}
