/**
 * Independent OOXML inspection for pawCanvas PPTX (not PptxGenJS).
 * Used by export post-process and tests.
 */

import { unzipSync, zipSync, strFromU8, strToU8 } from '../../../preview/vendor/fflate.js';

export const PPTX_SLIDE_EMU = Object.freeze({ cx: 12192000, cy: 6858000 });
export const PAW_PINK = /F43F8C/i;
export const APP_EXAMPLE = /app\.example/i;

export function unzipPptx(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return unzipSync(u8);
}

export function zipPptx(files) {
  return zipSync(files);
}

export function readPptxText(files, name) {
  const data = files[name];
  if (!data) return '';
  return typeof data === 'string' ? data : strFromU8(data);
}

export function writePptxText(files, name, text) {
  files[name] = strToU8(String(text || ''));
}

/**
 * @param {Uint8Array|ArrayBuffer} bytes
 */
export function inspectPawCanvasPptx(bytes) {
  const files = unzipPptx(bytes);
  const names = Object.keys(files);
  const pres = readPptxText(files, 'ppt/presentation.xml');
  const sz = /<p:sldSz\b([^>]*)\/?>/.exec(pres);
  const attrs = sz?.[1] || '';
  const cx = Number(/cx="(\d+)"/.exec(attrs)?.[1] || 0);
  const cy = Number(/cy="(\d+)"/.exec(attrs)?.[1] || 0);
  const slideFiles = names
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideIndex(a) - slideIndex(b));
  const slides = slideFiles.map((name, i) => inspectSlide(files, name, i));
  const media = names.filter((n) => n.startsWith('ppt/media/'));
  const hasAppExample = names.some((n) => APP_EXAMPLE.test(readPptxText(files, n)));
  const hasPawPink = names.some((n) => PAW_PINK.test(readPptxText(files, n)));
  return {
    ok: true,
    fileCount: names.length,
    slideCount: slides.length,
    cx,
    cy,
    wide16x9: cx === PPTX_SLIDE_EMU.cx && cy === PPTX_SLIDE_EMU.cy,
    slides,
    media,
    hasAppExample,
    hasPawPink,
    names
  };
}

function slideIndex(name) {
  return Number(/slide(\d+)\.xml$/.exec(name)?.[1] || 0);
}

function inspectSlide(files, name, index) {
  const xml = readPptxText(files, name);
  const relName = `ppt/slides/_rels/slide${index + 1}.xml.rels`;
  const rels = readPptxText(files, relName);
  const grp = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml);
  const rootCx = Number(grp?.[1] || 0);
  const rootCy = Number(grp?.[2] || 0);
  const texts = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1]));
  const pics = (xml.match(/<p:pic\b/g) || []).length;
  const shapes = (xml.match(/<p:sp\b/g) || []).length;
  const connectors = (xml.match(/<p:cxnSp\b/g) || []).length;
  const bg = /<p:bg[\s>]/.test(xml) || /<p:bgPr[\s>]/.test(xml);
  const bgHex = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(xml)?.[1] || '';
  const transition = inspectTransition(xml);
  const animation = inspectAnimation(xml);
  const cnvPrIds = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]));
  const imageRels = (rels.match(/relationships\/image"/g) || []).length;
  return {
    name,
    slideName: /<p:cSld[^>]*\bname="([^"]*)"/.exec(xml)?.[1] || '',
    texts,
    textCount: texts.filter((t) => String(t || '').trim()).length,
    pics,
    shapes,
    connectors,
    drawables: shapes + pics + connectors,
    hasBackground: bg,
    bgHex,
    rootCx,
    rootCy,
    zeroRoot: rootCx === 0 && rootCy === 0,
    transition,
    animation,
    cnvPrIds,
    imageRels,
    rels
  };
}

function inspectTransition(xml) {
  if (!/<p:transition[\s>]/.test(xml)) return { type: 'none', present: false };
  if (/<p:fade[\s/>]/.test(xml)) return { type: 'fade', present: true };
  if (/<p:push[\s/>]/.test(xml)) return { type: 'push', present: true };
  if (/<p:wipe[\s/>]/.test(xml)) return { type: 'wipe', present: true };
  if (/<p:cut[\s/>]/.test(xml)) return { type: 'none', present: true };
  return { type: 'other', present: true };
}

function inspectAnimation(xml) {
  if (!/<p:timing[\s>]/.test(xml)) {
    return { present: false, targets: [], fade: false, afterEffect: false, withEffect: false };
  }
  const targets = [...xml.matchAll(/<p:spTgt\b[^>]*\bspid="(\d+)"/g)].map((m) => Number(m[1]));
  return {
    present: true,
    targets: [...new Set(targets)],
    fade: /<p:animEffect\b[^>]*\bfilter="fade"/i.test(xml),
    afterEffect: /nodeType="afterEffect"/.test(xml),
    withEffect: /nodeType="withEffect"/.test(xml)
  };
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Strengthen ZIP-only checks: slide count, 16:9, backgrounds, drawables, media rels.
 * @param {Uint8Array} bytes
 * @param {{ minSlides?: number, expectNames?: string[], requireImages?: boolean }} [opts]
 */
export function validatePawCanvasPptx(bytes, opts = {}) {
  const info = inspectPawCanvasPptx(bytes);
  const errors = [];
  if (!info.wide16x9) {
    errors.push(`sldSz ${info.cx}x${info.cy} (want ${PPTX_SLIDE_EMU.cx}x${PPTX_SLIDE_EMU.cy})`);
  }
  const minSlides = opts.minSlides != null ? opts.minSlides : 1;
  if (info.slideCount < minSlides) errors.push(`slide count ${info.slideCount} < ${minSlides}`);
  if (Array.isArray(opts.expectNames) && opts.expectNames.length) {
    const got = info.slides.map((s) => s.slideName);
    opts.expectNames.forEach((name, i) => {
      if (name && got[i] !== name) errors.push(`slide ${i + 1} name "${got[i]}" != "${name}"`);
    });
  }
  const minDraw = opts.minDrawables != null ? opts.minDrawables : 1;
  info.slides.forEach((s, i) => {
    if (!s.hasBackground) errors.push(`slide ${i + 1} missing background`);
    if (s.drawables < minDraw) errors.push(`slide ${i + 1} drawable count ${s.drawables}`);
    if (s.zeroRoot) errors.push(`slide ${i + 1} 0×0 root group`);
    if (opts.requireText && s.textCount < 1) errors.push(`slide ${i + 1} has no text`);
  });
  const anyPic = info.slides.some((s) => s.pics > 0);
  if ((opts.requireImages || anyPic) && info.media.length === 0) {
    errors.push('images present in slides but ppt/media is empty');
  }
  if (anyPic) {
    info.slides.forEach((s, i) => {
      if (s.pics > 0 && s.imageRels < 1) errors.push(`slide ${i + 1} missing image relationship`);
    });
  }
  return {
    ok: errors.length === 0,
    error: errors[0] || null,
    errors,
    info
  };
}
