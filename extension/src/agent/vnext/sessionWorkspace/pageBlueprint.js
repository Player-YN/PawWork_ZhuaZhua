/**
 * Host page-blueprint capture helpers.
 * Content script gathers the payload; this module stores a compact summary
 * under /scratch and never dumps giant source into the model observation.
 */

import { pageTextByCodePoint } from './textPage.js';

export const BLUEPRINT_HTML_MAX_CHARS = 1_500_000;
export const BLUEPRINT_CSS_MAX_CHARS = 400_000;
export const BLUEPRINT_CSS_TOTAL_MAX = 1_200_000;
export const BLUEPRINT_COMPUTED_MAX = 120;

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizePageBlueprint(raw = {}) {
  const url = String(raw.url || raw.href || '').trim();
  const baseUrl = String(raw.baseUrl || raw.baseHref || url || '').trim();
  const html = String(raw.html || raw.outerHTML || '').slice(0, BLUEPRINT_HTML_MAX_CHARS);
  const stylesheets = Array.isArray(raw.stylesheets)
    ? raw.stylesheets.slice(0, 32).map(normalizeSheet)
    : [];
  const computed = Array.isArray(raw.computed) ? raw.computed.slice(0, BLUEPRINT_COMPUTED_MAX) : [];
  const assets = normalizeAssetInventory(raw.assets || raw.assetInventory);
  const motion = normalizeMotionBlueprint(raw.motion);
  const viewport = {
    width: Math.max(0, Math.round(Number(raw.viewport?.width) || 0)),
    height: Math.max(0, Math.round(Number(raw.viewport?.height) || 0)),
    devicePixelRatio: Number(raw.viewport?.devicePixelRatio) || 1
  };
  const scroll = {
    width: Math.max(0, Math.round(Number(raw.scroll?.width ?? raw.scrollWidth) || 0)),
    height: Math.max(0, Math.round(Number(raw.scroll?.height ?? raw.scrollHeight) || 0))
  };
  return {
    ok: raw.ok !== false,
    url,
    baseUrl: baseUrl || url,
    title: String(raw.title || '').slice(0, 240),
    lang: String(raw.lang || raw.locale || '').slice(0, 32),
    locale: String(raw.locale || raw.lang || '').slice(0, 32),
    viewport,
    scroll,
    html,
    htmlChars: Array.from(html).length,
    htmlTruncated: html.length < String(raw.html || raw.outerHTML || '').length,
    stylesheets,
    computed,
    assets,
    motion,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.slice(0, 40) : []
  };
}

function normalizeSheet(sheet = {}) {
  const cssText = String(sheet.cssText || sheet.text || '').slice(0, BLUEPRINT_CSS_MAX_CHARS);
  return {
    href: String(sheet.href || '').trim(),
    origin: String(sheet.origin || '').trim(),
    media: String(sheet.media || '').trim(),
    inline: sheet.inline === true,
    readable: sheet.readable !== false && !!cssText,
    cssText,
    cssChars: cssText.length
  };
}

function normalizeAssetInventory(raw = {}) {
  const list = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((u) => (typeof u === 'string' ? u : String(u?.url || u?.href || '')).trim())
      .filter(Boolean)
      .slice(0, 80);
  return {
    images: list(raw.images),
    backgrounds: list(raw.backgrounds),
    posters: list(raw.posters),
    fonts: list(raw.fonts)
  };
}

function normalizeMotionBlueprint(raw = {}) {
  const keyframes = Array.isArray(raw.keyframes)
    ? raw.keyframes
        .map((k) => ({
          name: String(k.name || '').trim(),
          cssText: String(k.cssText || '').slice(0, 4000)
        }))
        .filter((k) => k.name)
        .slice(0, 40)
    : [];
  return {
    keyframes,
    keyframeNames: keyframes.map((k) => k.name),
    transitions: Array.isArray(raw.transitions) ? raw.transitions.slice(0, 40) : [],
    animations: Array.isArray(raw.animations) ? raw.animations.slice(0, 40) : []
  };
}

/**
 * Compact observation the model may see. Giant HTML/CSS stay on disk.
 * @param {object} blueprint
 * @param {{ captureDir?: string }} [extra]
 */
export function compactBlueprintSummary(blueprint, extra = {}) {
  const bp = normalizePageBlueprint(blueprint);
  const sheets = (bp.stylesheets || []).map((s) => ({
    href: s.href || (s.inline ? '(inline)' : ''),
    readable: !!s.readable,
    cssChars: s.cssChars || 0
  }));
  return {
    url: bp.url,
    baseUrl: bp.baseUrl,
    title: bp.title,
    lang: bp.lang,
    locale: bp.locale,
    viewport: bp.viewport,
    scroll: bp.scroll,
    htmlChars: bp.htmlChars,
    htmlTruncated: !!bp.htmlTruncated,
    stylesheetCount: sheets.length,
    stylesheets: sheets,
    computedCount: (bp.computed || []).length,
    assets: {
      images: bp.assets.images.length,
      backgrounds: bp.assets.backgrounds.length,
      posters: bp.assets.posters.length,
      fonts: bp.assets.fonts.length
    },
    motion: {
      keyframeNames: bp.motion.keyframeNames,
      transitionCount: (bp.motion.transitions || []).length,
      animationCount: (bp.motion.animations || []).length
    },
    warnings: bp.warnings,
    captureDir: extra.captureDir || '',
    note: 'Full markup/CSS live under captureDir. Inspect with view=files offset/maxChars. Do not rewrite from this summary.'
  };
}

/**
 * Persist capture under /scratch for this execution. Model gets the summary + path.
 * @param {{ writeFile?: Function, mkdirp?: Function }} fs
 * @param {object} blueprint
 * @param {{ executionId?: string }} [opts]
 */
export function storePageBlueprint(fs, blueprint, opts = {}) {
  if (!fs || typeof fs.writeFile !== 'function') {
    return { ok: false, error: 'fs required' };
  }
  const bp = normalizePageBlueprint(blueprint);
  const id = String(opts.executionId || Date.now().toString(36)).replace(/[^\w-]+/g, '');
  const dir = `/scratch/site-clone/${id}`;
  try {
    if (typeof fs.mkdirp === 'function') fs.mkdirp(dir);
  } catch {
    /* writeFile may still succeed */
  }
  const summary = compactBlueprintSummary(bp, { captureDir: dir });
  fs.writeFile(`${dir}/dom.html`, bp.html, { mimeType: 'text/html' });
  fs.writeFile(`${dir}/blueprint.json`, JSON.stringify(bp), { mimeType: 'application/json' });
  fs.writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2), {
    mimeType: 'application/json'
  });
  (bp.stylesheets || []).forEach((sheet, i) => {
    if (!sheet.cssText) return;
    fs.writeFile(`${dir}/sheet-${i}.css`, sheet.cssText, { mimeType: 'text/css' });
  });
  return {
    ok: true,
    captureDir: dir,
    path: `${dir}/summary.json`,
    blueprintPath: `${dir}/blueprint.json`,
    htmlPath: `${dir}/dom.html`,
    summary
  };
}

/**
 * First inspect page of a capture file — never the whole source.
 */
export function previewCaptureFile(text, maxChars = 2000) {
  return pageTextByCodePoint(text, 0, maxChars);
}
