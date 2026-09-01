/**
 * Deterministic visual-structure QA for compiled Design/Slides scenes.
 *
 * Operates on semantic frame/node data only — no HTML, DOM, OCR, or renderer.
 * Pure: same input → byte-equivalent JSON. Does not apply, reject, or mutate.
 *
 * Later integration (not this module): call after compile, before apply.
 */

export const CANVAS_QA_VERSION = 1;

export const QA_CODES = Object.freeze({
  NO_PAPER: 'NO_PAPER',
  WIREFRAME: 'WIREFRAME',
  SPARSE: 'SPARSE',
  OVERLAP: 'OVERLAP',
  OVERFLOW: 'OVERFLOW',
  LOW_CONTRAST: 'LOW_CONTRAST',
  TINY_TEXT: 'TINY_TEXT',
  TOO_DENSE: 'TOO_DENSE',
  INCONSISTENT_THEME: 'INCONSISTENT_THEME',
  UNDERFILLED_LAYOUT: 'UNDERFILLED_LAYOUT',
  WEAK_HIERARCHY: 'WEAK_HIERARCHY',
  OUTLINE_HEAVY: 'OUTLINE_HEAVY'
});

/**
 * Conservative thresholds. Tuned to catch title + 3 overlapping empty
 * outline boxes + one bullet dump + empty paper, without flagging
 * named title/quote slides or filled/tiled card+compare layouts.
 */
export const QA_THRESHOLDS = Object.freeze({
  /** Paper/surface must cover this fraction of the frame. */
  PAPER_COVERAGE: 0.92,
  /** Inset (px) treated as the frame safe bound for overflow. */
  SAFE_INSET_PX: 16,
  /** Overflow is hard when max out-of-bounds extent exceeds this. */
  OVERFLOW_HARD_PX: 48,
  /** Outline boxes this thin (stroke) count as wireframe strokes. */
  OUTLINE_STROKE_MAX_PX: 6,
  /** Minimum outline-box area so hairline rules are ignored. */
  OUTLINE_MIN_AREA_PX: 6400,
  /** Outline count that can indicate a wireframe slide. */
  WIREFRAME_OUTLINE_MIN: 3,
  /** IoU above this means two outlines overlap, not a tiled grid. */
  WIREFRAME_OUTLINE_IOU: 0.12,
  /** Tiled cards: IoU must stay below this to count as a grid. */
  CARD_TILE_MAX_IOU: 0.1,
  /** Containment: smaller box is inside the larger (card/paper). */
  CONTAINMENT_RATIO: 0.85,
  /** Text-vs-text IoU that is a hard collision. */
  TEXT_OVERLAP_HARD_IOU: 0.28,
  /** Any meaningful pair IoU that is at least a repair warning. */
  OVERLAP_WARN_IOU: 0.18,
  /** Unused fraction that, with little content, is SPARSE. */
  SPARSE_UNUSED: 0.72,
  /** Occupied meaningful fraction below this can be SPARSE. */
  SPARSE_OCCUPIED: 0.16,
  /** Presentation-safe minimum text size (px). tldraw `s` maps to 16. */
  TINY_TEXT_PX: 16,
  /** WCAG-like contrast for normal text. */
  CONTRAST_NORMAL: 4.5,
  /** WCAG-like contrast for large text (≥24px or ≥19px bold). */
  CONTRAST_LARGE: 3,
  LARGE_TEXT_PX: 24,
  LARGE_TEXT_BOLD_PX: 19,
  /** Character / bullet / node density for TOO_DENSE. */
  DENSE_CHARS: 720,
  DENSE_BULLETS: 10,
  DENSE_LINES: 16,
  DENSE_MEANINGFUL_NODES: 28,
  /** Occupied + high char count also counts as dense. */
  DENSE_OCCUPIED: 0.82,
  /** Content-layout occupied minimums (UNDERFILLED_LAYOUT). */
  UNDERFILLED_DEFAULT: 0.32,
  /** Page title below this (px, scaled) is WEAK_HIERARCHY. */
  TITLE_MIN_PX: 40,
  /** Title / body size ratio below this is WEAK_HIERARCHY. */
  TITLE_BODY_RATIO: 1.35,
  /** Unfilled primary containers / all primary containers. */
  OUTLINE_HEAVY_RATIO: 0.6,
  OUTLINE_HEAVY_MIN: 2
});

/**
 * Score starts at 100. Each issued code deducts once per frame
 * (scene-level codes deduct once). Clamp 0..100.
 */
export const QA_SCORE_DEDUCTIONS = Object.freeze({
  NO_PAPER: 22,
  WIREFRAME: 36,
  SPARSE: 14,
  OVERLAP_HARD: 20,
  OVERLAP_WARN: 7,
  OVERFLOW_HARD: 18,
  OVERFLOW_WARN: 7,
  LOW_CONTRAST: 10,
  TINY_TEXT: 8,
  TOO_DENSE: 12,
  INCONSISTENT_THEME: 10,
  UNDERFILLED_LAYOUT: 8,
  WEAK_HIERARCHY: 8,
  OUTLINE_HEAVY: 10
});

const HARD_CODES = new Set([QA_CODES.NO_PAPER, QA_CODES.WIREFRAME]);

const BACKGROUND_ROLES = new Set([
  'background',
  'paper',
  'surface',
  'canvas',
  'bg',
  'plate'
]);

const DECOR_ROLES = new Set([
  'decoration',
  'decor',
  'ornament',
  'accent',
  'rule',
  'divider',
  'watermark'
]);

const TITLE_ROLES = new Set(['title', 'headline', 'heading', 'kicker']);
const QUOTE_ROLES = new Set(['quote', 'pull-quote', 'attribution', 'cite']);

const INTENTIONAL_SPARSE_LAYOUTS = new Set([
  'title',
  'title-only',
  'title-slide',
  'cover',
  'hero',
  'section',
  'chapter',
  'quote',
  'title-quote',
  'pull-quote',
  'statement',
  'closing',
  'close',
  'end',
  'outro',
  'thanks',
  'thank-you',
  'poster-quote',
  'title-visual'
]);

const CONTENT_FILL_MIN = Object.freeze({
  compare: 0.4,
  'two-col': 0.4,
  'two-column': 0.4,
  'case-study': 0.4,
  matrix: 0.4,
  'image-caption': 0.4,
  points: 0.35,
  'points-icons': 0.35,
  'stat-row': 0.35,
  process: 0.32,
  timeline: 0.32,
  agenda: 0.28
});

const CARD_COMPARE_LAYOUTS = new Set([
  'cards',
  'card-grid',
  'three-up',
  'compare',
  'two-column',
  'columns',
  'split',
  'vs'
]);

const GEO_TYPES = new Set([
  'geo',
  'rect',
  'rectangle',
  'shape',
  'color-block',
  'ellipse',
  'oval',
  'polygon'
]);

const TEXT_TYPES = new Set([
  'text',
  'headline',
  'heading',
  'title',
  'subtitle',
  'quote',
  'bullet',
  'body',
  'label',
  'caption'
]);

/** Conservative px for tldraw / semantic tokens (slightly below engine paint). */
const SIZE_PX = Object.freeze({
  xs: 12,
  s: 16,
  sm: 16,
  small: 16,
  小: 16,
  m: 22,
  md: 22,
  medium: 22,
  中: 22,
  l: 32,
  lg: 32,
  large: 32,
  大: 32,
  xl: 48,
  xlarge: 48,
  xxl: 64,
  特大: 48
});

const NAMED_HEX = Object.freeze({
  black: '#1d1d1d',
  white: '#ffffff',
  grey: '#9fa6b2',
  gray: '#9fa6b2',
  red: '#e03131',
  'light-red': '#ff8787',
  orange: '#f76707',
  yellow: '#f4b942',
  green: '#2f9e44',
  'light-green': '#8ce99a',
  blue: '#1971c2',
  'light-blue': '#74c0fc',
  violet: '#7048e8',
  purple: '#7048e8',
  'light-violet': '#b197fc',
  pink: '#f06595',
  rose: '#f43f8c',
  magenta: '#e64980',
  cyan: '#22b8cf',
  teal: '#12b886',
  none: '',
  transparent: ''
});

const TOKEN_KEYS = new Set([
  'paper',
  'bg',
  'background',
  'ink',
  'fg',
  'foreground',
  'text',
  'muted',
  'accent',
  'primary',
  'surface'
]);

/**
 * @param {{
 *   shell?: string,
 *   frames?: object[],
 *   themes?: object[]|object,
 *   allowMixedThemes?: boolean
 * }} input
 * @returns {{
 *   ok: boolean,
 *   score: number,
 *   issues: Array<{code:string,severity:string,frameId:string,metrics:object,message:string}>,
 *   metrics: object
 * }}
 */
export function assessCanvasScene(input = {}) {
  const scene = normalizeScene(input);
  const issues = [];
  const frameMetrics = {};
  const roleTotals = {};
  const typeTotals = {};
  let paperMin = scene.frames.length ? 1 : 0;
  let occupiedSum = 0;
  let outlineSum = 0;
  let outlineMaxIou = 0;
  let overlapPairs = 0;
  let maxIou = 0;
  let overflowCount = 0;
  let overflowAmount = 0;
  let textChars = 0;
  let lines = 0;

  for (const frame of scene.frames) {
    const assessed = assessFrame(frame, scene);
    frameMetrics[frame.id] = assessed.metrics;
    for (const issue of assessed.issues) issues.push(issue);
    addCounts(roleTotals, assessed.metrics.roleCounts);
    addCounts(typeTotals, assessed.metrics.typeCounts);
    paperMin = Math.min(paperMin, assessed.metrics.paperCoverage);
    occupiedSum += assessed.metrics.occupiedMeaningfulRatio;
    outlineSum += assessed.metrics.outlineBoxCount;
    outlineMaxIou = Math.max(outlineMaxIou, assessed.metrics.outlineMaxIou);
    overlapPairs += assessed.metrics.overlapPairCount;
    maxIou = Math.max(maxIou, assessed.metrics.maxIou);
    overflowCount += assessed.metrics.overflowCount;
    overflowAmount += assessed.metrics.overflowAmount;
    textChars += assessed.metrics.textCharCount;
    lines += assessed.metrics.estimatedLines;
  }

  const themeReport = assessThemes(scene);
  if (themeReport.issue) issues.push(themeReport.issue);

  const n = scene.frames.length || 1;
  const metrics = stabilize({
    frameCount: scene.frames.length,
    paperCoverage: scene.frames.length ? paperMin : 0,
    occupiedMeaningfulRatio: occupiedSum / n,
    unusedRatio: 1 - occupiedSum / n,
    outlineBoxCount: outlineSum,
    outlineMaxIou,
    overlapPairCount: overlapPairs,
    maxIou,
    overflowCount,
    overflowAmount,
    textCharCount: textChars,
    estimatedLines: lines,
    contentNodeCounts: { roles: roleTotals, types: typeTotals },
    themeIds: themeReport.themeIds,
    themeConsistent: themeReport.consistent,
    frames: frameMetrics
  });

  const sorted = sortIssues(issues.map(stabilizeIssue));
  const score = scoreOf(sorted);
  const ok = !sorted.some((issue) => issue.severity === 'hard');
  return { ok, score, issues: sorted, metrics };
}

function assessFrame(frame, scene) {
  const nodes = frame.nodes;
  const issues = [];
  const roleCounts = {};
  const typeCounts = {};
  for (const node of nodes) {
    bump(roleCounts, node.role || 'unknown');
    bump(typeCounts, node.type || 'unknown');
  }

  const paperNodes = nodes.filter((n) => n.isPaper);
  const paperCoverage = coverageRatio(paperNodes, frame);
  const meaningful = nodes.filter((n) => n.meaningful);
  const occupiedMeaningfulRatio = coverageRatio(meaningful, frame);
  const unusedRatio = clamp01(1 - occupiedMeaningfulRatio);
  const outlines = nodes.filter((n) => n.isOutline);
  const outlineMaxIou = r6(maxPairIou(outlines));
  const overlap = overlapReport(meaningful);
  const overflow = overflowReport(meaningful, frame);
  const textNodes = nodes.filter((n) => n.isText);
  const textCharCount = textNodes.reduce((n, node) => n + node.chars, 0);
  const estimatedLines = textNodes.reduce((n, node) => n + node.lines, 0);

  const metrics = stabilize({
    paperCoverage,
    occupiedMeaningfulRatio,
    unusedRatio,
    outlineBoxCount: outlines.length,
    outlineMaxIou,
    overlapPairCount: overlap.pairs.length,
    maxIou: overlap.maxIou,
    overflowCount: overflow.count,
    overflowAmount: overflow.amount,
    textCharCount,
    estimatedLines,
    roleCounts,
    typeCounts,
    meaningfulCount: meaningful.length,
    textNodeCount: textNodes.length,
    bulletDump: nodes.some((n) => n.bulletItems >= 3)
  });

  if (paperCoverage + 1e-9 < QA_THRESHOLDS.PAPER_COVERAGE) {
    issues.push(
      issue(
        QA_CODES.NO_PAPER,
        'hard',
        frame.id,
        { paperCoverage },
        `No paper/surface covers ${(paperCoverage * 100).toFixed(1)}% of the frame (need ≥ ${Math.round(
          QA_THRESHOLDS.PAPER_COVERAGE * 100
        )}%).`
      )
    );
  }

  const wire = wireframeHit(frame, nodes, outlines, metrics);
  if (wire) {
    issues.push(
      issue(
        QA_CODES.WIREFRAME,
        'hard',
        frame.id,
        wire,
        'Unfilled outline boxes with sparse content look like a wireframe, not a finished slide.'
      )
    );
  }

  if (isSparse(frame, metrics) && !isIntentionalSparse(frame)) {
    issues.push(
      issue(
        QA_CODES.SPARSE,
        'warn',
        frame.id,
        {
          unusedRatio: metrics.unusedRatio,
          occupiedMeaningfulRatio: metrics.occupiedMeaningfulRatio,
          meaningfulCount: metrics.meaningfulCount,
          textCharCount
        },
        'Unused paper is high and meaningful content is thin.'
      )
    );
  }

  if (overlap.hard) {
    issues.push(
      issue(
        QA_CODES.OVERLAP,
        'hard',
        frame.id,
        { maxIou: overlap.maxIou, overlapPairCount: overlap.pairs.length, kind: 'text-text' },
        'Meaningful text nodes collide (high IoU).'
      )
    );
  } else if (overlap.warn) {
    issues.push(
      issue(
        QA_CODES.OVERLAP,
        'warn',
        frame.id,
        { maxIou: overlap.maxIou, overlapPairCount: overlap.pairs.length },
        'Meaningful content intersects more than a card-on-paper containment.'
      )
    );
  }

  if (overflow.count) {
    const hard = overflow.amount >= QA_THRESHOLDS.OVERFLOW_HARD_PX;
    issues.push(
      issue(
        QA_CODES.OVERFLOW,
        hard ? 'hard' : 'warn',
        frame.id,
        { overflowCount: overflow.count, overflowAmount: overflow.amount },
        'Meaningful nodes sit outside the frame safe bounds.'
      )
    );
  }

  const contrast = contrastIssues(frame, nodes, scene);
  issues.push(...contrast);

  const tiny = textNodes.filter((n) => n.fontPx != null && n.fontPx < QA_THRESHOLDS.TINY_TEXT_PX);
  if (tiny.length) {
    issues.push(
      issue(
        QA_CODES.TINY_TEXT,
        'warn',
        frame.id,
        { count: tiny.length, minPx: Math.min(...tiny.map((n) => n.fontPx)) },
        `Text is below the ${QA_THRESHOLDS.TINY_TEXT_PX}px presentation-safe minimum.`
      )
    );
  }

  if (isTooDense(metrics, nodes)) {
    issues.push(
      issue(
        QA_CODES.TOO_DENSE,
        'warn',
        frame.id,
        {
          textCharCount,
          estimatedLines,
          bulletMax: Math.max(0, ...nodes.map((n) => n.bulletItems)),
          meaningfulCount: metrics.meaningfulCount
        },
        'Text or shape density is too high for one frame.'
      )
    );
  }

  const underfilled = underfilledLayout(frame, metrics);
  if (underfilled) issues.push(underfilled);
  const hierarchy = weakHierarchy(frame, nodes);
  if (hierarchy) issues.push(hierarchy);
  const outlineHeavy = outlineHeavyHit(frame, nodes);
  if (outlineHeavy) issues.push(outlineHeavy);

  return { issues, metrics };
}

function wireframeHit(frame, nodes, outlines, metrics) {
  if (outlines.length < QA_THRESHOLDS.WIREFRAME_OUTLINE_MIN) return null;
  if (CARD_COMPARE_LAYOUTS.has(frame.layout)) {
    const hosted = outlines.filter((box) => hostedContent(box, nodes).length >= 1);
    if (hosted.length >= 2) return null;
  }

  const hosted = outlines.map((box) => ({ box, kids: hostedContent(box, nodes) }));
  const withContent = hosted.filter((row) => row.kids.length >= 1);
  const empty = hosted.filter((row) => row.kids.length === 0);
  const outlineIou = maxPairIou(outlines);

  // Tiled cards / compare columns: outlines do not overlap and hold content.
  if (
    withContent.length >= 2 &&
    empty.length === 0 &&
    outlineIou < QA_THRESHOLDS.CARD_TILE_MAX_IOU
  ) {
    return null;
  }
  // Diagram / Venn-like: every outline hosts its own label.
  if (withContent.length >= QA_THRESHOLDS.WIREFRAME_OUTLINE_MIN && empty.length === 0) {
    return null;
  }

  const sparseContent =
    metrics.meaningfulCount <= 3 &&
    metrics.textNodeCount <= 2 &&
    nodes.filter((n) => n.isFilledSurface && !n.isPaper).length <= 1;
  const dump = nodes.some((n) => n.bulletItems >= 3);
  const emptyCluster =
    empty.length >= QA_THRESHOLDS.WIREFRAME_OUTLINE_MIN ||
    (empty.length >= 2 && outlineIou >= QA_THRESHOLDS.WIREFRAME_OUTLINE_IOU);

  if (!emptyCluster) return null;
  if (!(sparseContent || dump || metrics.occupiedMeaningfulRatio < 0.3)) return null;

  return {
    outlineBoxCount: outlines.length,
    emptyOutlineCount: empty.length,
    maxIou: r6(outlineIou),
    occupiedMeaningfulRatio: metrics.occupiedMeaningfulRatio,
    bulletDump: dump
  };
}

function isSparse(frame, metrics) {
  if (metrics.meaningfulCount >= 4 && metrics.textCharCount >= 80) return false;
  const unusedHeavy =
    metrics.unusedRatio >= QA_THRESHOLDS.SPARSE_UNUSED && metrics.meaningfulCount <= 2;
  const emptyHeavy =
    metrics.occupiedMeaningfulRatio < QA_THRESHOLDS.SPARSE_OCCUPIED &&
    metrics.textCharCount < 120 &&
    metrics.meaningfulCount <= 3;
  return unusedHeavy || emptyHeavy;
}

function isIntentionalSparse(frame) {
  if (INTENTIONAL_SPARSE_LAYOUTS.has(frame.layout)) return true;
  const roles = new Set(frame.nodes.filter((n) => n.meaningful).map((n) => n.role));
  if (!roles.size) return false;
  for (const role of roles) {
    if (!TITLE_ROLES.has(role) && !QUOTE_ROLES.has(role) && role !== 'subtitle') return false;
  }
  return frame.nodes.some((n) => TITLE_ROLES.has(n.role) || QUOTE_ROLES.has(n.role));
}

function isTooDense(metrics, nodes) {
  const bullets = Math.max(0, ...nodes.map((n) => n.bulletItems));
  if (metrics.textCharCount >= QA_THRESHOLDS.DENSE_CHARS) return true;
  if (bullets >= QA_THRESHOLDS.DENSE_BULLETS) return true;
  if (metrics.estimatedLines >= QA_THRESHOLDS.DENSE_LINES) return true;
  if (metrics.meaningfulCount >= QA_THRESHOLDS.DENSE_MEANINGFUL_NODES) return true;
  return (
    metrics.occupiedMeaningfulRatio >= QA_THRESHOLDS.DENSE_OCCUPIED &&
    metrics.textCharCount >= 480
  );
}

function underfilledLayout(frame, metrics) {
  if (!frame.layout || isIntentionalSparse(frame)) return null;
  const min = CONTENT_FILL_MIN[frame.layout] ?? QA_THRESHOLDS.UNDERFILLED_DEFAULT;
  if (!(frame.layout in CONTENT_FILL_MIN) && !CARD_COMPARE_LAYOUTS.has(frame.layout)) return null;
  if (metrics.occupiedMeaningfulRatio + 1e-9 >= min) return null;
  return issue(
    QA_CODES.UNDERFILLED_LAYOUT,
    'warn',
    frame.id,
    { occupiedMeaningfulRatio: metrics.occupiedMeaningfulRatio, min },
    `Meaningful occupied area ${(metrics.occupiedMeaningfulRatio * 100).toFixed(0)}% is below the ${frame.layout} baseline (${Math.round(min * 100)}%).`
  );
}

function weakHierarchy(frame, nodes) {
  if (!frame.layout) return null;
  const titleNode =
    nodes.find((n) => n.isText && (n.pawSlot === 'title' || n.role === 'title')) ||
    nodes.find((n) => n.isText && n.type === 'headline');
  if (!titleNode || titleNode.fontPx == null) return null;
  const bodies = nodes.filter(
    (n) =>
      n.isText &&
      n.fontPx &&
      n !== titleNode &&
      (n.pawSlot === 'body' ||
        n.role === 'body' ||
        /body|caption/.test(String(n.pawSlot || n.role || '')))
  );
  const bodyPx = bodies.length ? Math.max(...bodies.map((n) => n.fontPx)) : null;
  const tooSmall = titleNode.fontPx + 1e-9 < QA_THRESHOLDS.TITLE_MIN_PX;
  const ratio = bodyPx ? titleNode.fontPx / bodyPx : Infinity;
  const weakRatio = Number.isFinite(ratio) && ratio + 1e-9 < QA_THRESHOLDS.TITLE_BODY_RATIO;
  if (!tooSmall && !weakRatio) return null;
  return issue(
    QA_CODES.WEAK_HIERARCHY,
    'warn',
    frame.id,
    { titlePx: titleNode.fontPx, bodyPx, ratio: Number.isFinite(ratio) ? r2(ratio) : null },
    tooSmall
      ? `Semantic title is ${titleNode.fontPx}px; page titles should stay ≥ ${QA_THRESHOLDS.TITLE_MIN_PX}px.`
      : `Title/body size ratio ${r2(ratio)} is below ${QA_THRESHOLDS.TITLE_BODY_RATIO}.`
  );
}

function outlineHeavyHit(frame, nodes) {
  if (!frame.layout) return null;
  const containers = nodes.filter((n) => n.isGeo && !n.isPaper && !n.isDecor && n.box && area(n.box) >= QA_THRESHOLDS.OUTLINE_MIN_AREA_PX);
  if (containers.length < QA_THRESHOLDS.OUTLINE_HEAVY_MIN) return null;
  const outlines = containers.filter((n) => n.isOutline || !n.isFilledSurface);
  const ratio = outlines.length / containers.length;
  if (ratio + 1e-9 < QA_THRESHOLDS.OUTLINE_HEAVY_RATIO || outlines.length < QA_THRESHOLDS.OUTLINE_HEAVY_MIN) {
    return null;
  }
  return issue(
    QA_CODES.OUTLINE_HEAVY,
    'warn',
    frame.id,
    { outlineCount: outlines.length, containerCount: containers.length, ratio: r6(ratio) },
    'Primary containers are mostly unfilled outlines rather than filled surfaces.'
  );
}

function overlapReport(nodes) {
  const pairs = [];
  let maxIou = 0;
  let hard = false;
  let warn = false;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (ignoreOverlapPair(a, b)) continue;
      const iou = rectIou(a.box, b.box);
      if (iou <= 0) continue;
      maxIou = Math.max(maxIou, iou);
      const textPair = a.isText && b.isText;
      if (textPair && iou >= QA_THRESHOLDS.TEXT_OVERLAP_HARD_IOU) {
        hard = true;
        pairs.push({ a: a.id, b: b.id, iou: r6(iou), kind: 'text-text' });
        continue;
      }
      if (iou >= QA_THRESHOLDS.OVERLAP_WARN_IOU) {
        warn = true;
        pairs.push({ a: a.id, b: b.id, iou: r6(iou), kind: textPair ? 'text-text' : 'content' });
      }
    }
  }
  return { pairs, maxIou: r6(maxIou), hard, warn: warn && !hard };
}

function ignoreOverlapPair(a, b) {
  if (a.isPaper || b.isPaper) return true;
  if (a.isDecor || b.isDecor) return true;
  if (a.isOutline || b.isOutline) return true;
  if (contained(a.box, b.box) || contained(b.box, a.box)) {
    // Card / surface hosting text or image is intended.
    if (a.isFilledSurface !== b.isFilledSurface) return true;
    if (a.isText !== b.isText) return true;
    return false;
  }
  return false;
}

function overflowReport(nodes, frame) {
  const inset = QA_THRESHOLDS.SAFE_INSET_PX;
  const safe = {
    x: frame.box.x + inset,
    y: frame.box.y + inset,
    w: Math.max(0, frame.box.w - inset * 2),
    h: Math.max(0, frame.box.h - inset * 2)
  };
  let count = 0;
  let amount = 0;
  for (const node of nodes) {
    if (!node.box) continue;
    const ext = overflowExtent(node.box, frame.box);
    if (ext <= 1) continue;
    // Still inside the outer frame but past the safe inset — mild.
    const pastSafe = overflowExtent(node.box, safe);
    if (ext <= 1 && pastSafe <= 0) continue;
    count += 1;
    amount = Math.max(amount, ext);
  }
  return { count, amount: r2(amount) };
}

function contrastIssues(frame, nodes, scene) {
  const out = [];
  const texts = nodes.filter((n) => n.isText && n.chars > 0 && n.box);
  let worst = Infinity;
  let hits = 0;
  for (const text of texts) {
    const fg = resolveColor(text.fg, text.themeId, scene, 'fg');
    const bg = resolveColor(bgBehind(text, nodes, frame), text.themeId, scene, 'bg');
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (!Number.isFinite(ratio)) continue;
    const large =
      (text.fontPx || 0) >= QA_THRESHOLDS.LARGE_TEXT_PX ||
      (text.bold && (text.fontPx || 0) >= QA_THRESHOLDS.LARGE_TEXT_BOLD_PX);
    const need = large ? QA_THRESHOLDS.CONTRAST_LARGE : QA_THRESHOLDS.CONTRAST_NORMAL;
    if (ratio + 1e-9 < need) {
      hits += 1;
      worst = Math.min(worst, ratio);
    }
  }
  if (hits) {
    out.push(
      issue(
        QA_CODES.LOW_CONTRAST,
        'warn',
        frame.id,
        { count: hits, minRatio: r2(worst) },
        `Resolved text contrast ${r2(worst)}:1 is below WCAG-like ${QA_THRESHOLDS.CONTRAST_NORMAL} (3.0 large).`
      )
    );
  }
  return out;
}

function bgBehind(text, nodes, frame) {
  if (!text?.box) return frame.fill || 'paper';
  const c = center(text.box);
  const hosts = nodes
    .filter((n) => n !== text && n.box && hasResolvableFill(n) && pointInRect(c, n.box))
    .sort((a, b) => area(a.box) - area(b.box));
  if (hosts[0]) return hosts[0].bg || hosts[0].fill;
  if (frame.fill) return frame.fill;
  return 'paper';
}

function hasResolvableFill(node) {
  if (node.isPaper || node.isFilledSurface) return true;
  const fill = String(node.fill || node.bg || '').trim();
  return !!(fill && fill !== 'none' && fill !== 'transparent');
}

function assessThemes(scene) {
  const ids = [];
  const seen = new Set();
  let semantic = false;
  let missing = 0;
  for (const frame of scene.frames) {
    if (frame.layout || frame.themeId || frame.nodes.some((n) => n.role && n.role !== 'unknown')) {
      semantic = true;
    }
    const id = frame.themeId || firstTheme(frame.nodes);
    if (id) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    } else {
      missing += 1;
    }
  }
  ids.sort();
  const allowed = scene.allowMixedThemes;
  const consistent = ids.length <= 1 && !(semantic && ids.length === 1 && missing > 0 && scene.frames.length > 1);
  if (allowed || scene.frames.length <= 1 || !semantic) {
    return { themeIds: ids, consistent: ids.length <= 1, issue: null };
  }
  if (ids.length > 1 || (ids.length === 1 && missing > 0)) {
    return {
      themeIds: ids,
      consistent: false,
      issue: issue(
        QA_CODES.INCONSISTENT_THEME,
        'warn',
        '',
        { themeIds: ids, missingFrames: missing },
        ids.length > 1
          ? `Semantic frames use unrelated theme ids (${ids.join(', ')}).`
          : 'Some semantic frames are missing a theme id.'
      )
    };
  }
  return { themeIds: ids, consistent: true, issue: null };
}

function firstTheme(nodes) {
  for (const node of nodes) {
    if (node.themeId) return node.themeId;
  }
  return '';
}

function scoreOf(issues) {
  let score = 100;
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.code}:${issue.frameId}:${issue.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    score -= deductionFor(issue);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function deductionFor(issue) {
  if (issue.code === QA_CODES.OVERLAP) {
    return issue.severity === 'hard' ? QA_SCORE_DEDUCTIONS.OVERLAP_HARD : QA_SCORE_DEDUCTIONS.OVERLAP_WARN;
  }
  if (issue.code === QA_CODES.OVERFLOW) {
    return issue.severity === 'hard' ? QA_SCORE_DEDUCTIONS.OVERFLOW_HARD : QA_SCORE_DEDUCTIONS.OVERFLOW_WARN;
  }
  return QA_SCORE_DEDUCTIONS[issue.code] || 0;
}

function issue(code, severity, frameId, metrics, message) {
  const sev = HARD_CODES.has(code) || severity === 'hard' ? (severity === 'warn' ? 'warn' : 'hard') : severity;
  return {
    code,
    severity: sev,
    frameId: String(frameId || ''),
    metrics: stabilize(metrics || {}),
    message: String(message || '')
  };
}

function normalizeScene(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const themes = normalizeThemes(raw.themes);
  const framesIn = Array.isArray(raw.frames) ? raw.frames : [];
  const frames = [];
  for (let i = 0; i < framesIn.length; i++) {
    const frame = normalizeFrame(framesIn[i], i, themes);
    if (frame) frames.push(frame);
  }
  return {
    shell: raw.shell === 'slides' || raw.shell === 'deck' ? 'slides' : 'design',
    frames,
    themes,
    allowMixedThemes: !!(raw.allowMixedThemes || themes.allowMixed)
  };
}

function normalizeThemes(raw) {
  const tokensById = Object.create(null);
  let allowMixed = false;
  if (!raw) return { tokensById, allowMixed, ids: [] };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      if (item.allowMixed) allowMixed = true;
      const id = String(item.id || item.name || '').trim();
      if (!id) continue;
      tokensById[id] = flattenTokens(item.tokens || item);
    }
  } else if (typeof raw === 'object') {
    if (raw.allowMixed || raw.allowMixedThemes) allowMixed = true;
    const list = Array.isArray(raw.items) ? raw.items : null;
    if (list) return normalizeThemes(list);
    for (const [id, tokens] of Object.entries(raw)) {
      if (id === 'allowMixed' || id === 'allowMixedThemes' || id === 'items') continue;
      if (tokens && typeof tokens === 'object') tokensById[id] = flattenTokens(tokens.tokens || tokens);
    }
  }
  return { tokensById, allowMixed, ids: Object.keys(tokensById).sort() };
}

function flattenTokens(obj) {
  const out = Object.create(null);
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'name' || k === 'allowMixed') continue;
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function normalizeFrame(raw, index, themes) {
  if (raw == null || typeof raw !== 'object') return null;
  const size = raw.size && typeof raw.size === 'object' ? raw.size : raw;
  const w = num(raw.w ?? raw.width ?? size.w, 1920);
  const h = num(raw.h ?? raw.height ?? size.h, 1080);
  const box = rectOf(raw.box || raw.frameBox, { x: 0, y: 0, w, h }) || { x: 0, y: 0, w, h };
  box.w = w;
  box.h = h;
  const meta = metaOf(raw);
  const nodesIn = Array.isArray(raw.nodes) ? raw.nodes : Array.isArray(raw.children) ? raw.children : [];
  const nodes = [];
  for (let i = 0; i < nodesIn.length; i++) {
    const node = normalizeNode(nodesIn[i], i, {
      w,
      h,
      themes,
      frameTheme: meta.pawTheme || raw.theme || raw.themeId
    });
    if (node) nodes.push(node);
  }
  return {
    id: String(raw.id || raw.nodeId || raw.name || `frame-${index + 1}`),
    layout: String(meta.pawLayout || raw.layout || raw.pawLayout || '').trim().toLowerCase(),
    themeId: String(meta.pawTheme || raw.themeId || raw.theme || '').trim(),
    fill: raw.fill || raw.paper || raw.background || meta.fill || '',
    box,
    nodes
  };
}

function normalizeNode(raw, index, ctx) {
  if (raw == null) return null;
  if (typeof raw !== 'object') {
    return {
      id: `n${index + 1}`,
      type: 'text',
      role: 'unknown',
      box: null,
      text: String(raw),
      chars: String(raw).length,
      isText: true,
      meaningful: !!String(raw).trim(),
      bulletItems: 0,
      lines: 1
    };
  }
  const meta = metaOf(raw);
  const props = raw.props && typeof raw.props === 'object' ? raw.props : {};
  const type = String(raw.type || raw.geo || props.geo || meta.pawType || meta.pawKind || 'unknown')
    .trim()
    .toLowerCase();
  const box = rectOf(raw.box || raw, {
    x: raw.x ?? props.x,
    y: raw.y ?? props.y,
    w: raw.w ?? raw.width ?? props.w,
    h: raw.h ?? raw.height ?? props.h
  });
  const role = String(meta.pawRole || raw.role || raw.pawRole || '').trim().toLowerCase();
  const text = String(raw.text || raw.value || raw.alt || meta.pawText || props.text || '');
  const fillKind = String(raw.fillKind || props.fill || '').trim().toLowerCase();
  const fill = raw.fill || raw.color || meta.fill || props.color || '';
  const stroke = raw.stroke || raw.strokeColor || props.stroke || '';
  const strokeWidth = num(raw.strokeWidth ?? raw.strokeWidthPx ?? props.strokeWidth, NaN);
  const dash = String(raw.dash || props.dash || '').trim().toLowerCase();
  const fontPx = fontSizePx(raw, props, meta);
  const themeId = String(meta.pawTheme || raw.themeId || raw.theme || ctx.frameTheme || '').trim();
  const src = String(raw.src || raw.url || raw.path || meta.src || '');
  const isText = TEXT_TYPES.has(type) || (!!text.trim() && !GEO_TYPES.has(type) && type !== 'image');
  const isGeo = GEO_TYPES.has(type);
  const isImage = type === 'image' || type === 'img' || (!!src && !isGeo && !isText);
  const isBgRole = BACKGROUND_ROLES.has(role);
  const isDecor = DECOR_ROLES.has(role);
  const filled = isFilled(fillKind, fill);
  const frameArea = Math.max(1, ctx.w * ctx.h);
  const boxArea = box ? area(box) : 0;
  const coversPaper = !!box && boxArea / frameArea >= QA_THRESHOLDS.PAPER_COVERAGE;
  const isPaper =
    isBgRole ||
    (coversPaper && (isGeo || isImage) && (filled || isImage || isBgRole)) ||
    (coversPaper && isImage);
  const isOutline = !!(
    box &&
    isGeo &&
    !isPaper &&
    !isDecor &&
    !filled &&
    boxArea >= QA_THRESHOLDS.OUTLINE_MIN_AREA_PX &&
    (Number.isNaN(strokeWidth) || strokeWidth <= QA_THRESHOLDS.OUTLINE_STROKE_MAX_PX)
  );
  const isFilledSurface = !!(box && isGeo && filled && !isPaper);
  const inferredRole =
    role ||
    (isPaper ? 'background' : isDecor ? 'decoration' : isText ? inferTextRole(type, text, meta) : isImage ? 'image' : isOutline ? 'outline' : isGeo ? 'shape' : 'unknown');
  const chars = isText ? [...text].length : 0;
  return {
    id: String(raw.id || raw.nodeId || raw.slotId || meta.pawSlot || `n${index + 1}`),
    type: type || 'unknown',
    role: inferredRole,
    pawSlot: String(meta.pawSlot || raw.slot || '').trim().toLowerCase(),
    themeId,
    box,
    text,
    chars,
    lines: isText ? estimateLines(text, box, fontPx) : 0,
    bulletItems: isText ? countBullets(text) : 0,
    fontPx,
    bold: isBold(raw, props, meta),
    fg: isText ? raw.color || raw.fill || meta.color || props.color || '' : '',
    fill: String(fill || ''),
    bg: String(raw.background || raw.bg || (filled ? fill : '') || ''),
    src,
    isText,
    isGeo,
    isImage,
    isPaper,
    isDecor,
    isOutline,
    isFilledSurface,
    meaningful: !isPaper && !isDecor && !isOutline && !!(isText ? text.trim() : box),
    fillKind,
    dash,
    stroke: String(stroke || '')
  };
}

function inferTextRole(type, text, meta) {
  if (TITLE_ROLES.has(type)) return 'title';
  if (QUOTE_ROLES.has(type)) return 'quote';
  if (meta.pawSlot && /title|headline|heading/i.test(meta.pawSlot)) return 'title';
  if (meta.pawSlot && /quote/i.test(meta.pawSlot)) return 'quote';
  if (countBullets(text) >= 3) return 'body';
  return type === 'text' ? 'body' : type || 'body';
}

function isFilled(fillKind, fill) {
  if (fillKind === 'none' || fillKind === 'empty' || fillKind === 'hollow') return false;
  if (fillKind === 'solid' || fillKind === 'semi' || fillKind === 'pattern' || fillKind === 'tint') return true;
  const s = String(fill || '')
    .trim()
    .toLowerCase();
  if (!s || s === 'none' || s === 'transparent' || s === 'empty') return false;
  return true;
}

function fontSizePx(raw, props, meta) {
  const candidates = [raw.fontSize, raw.fontSizePx, raw.textSize, meta.fontSize, props.fontSize, props.fontSizePx];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return conservativeScaledPx(n, raw, props);
  }
  const token = sizeToken(props.size) || sizeToken(raw.size) || sizeToken(meta.size);
  if (!token) return null;
  if (SIZE_PX[token]) return conservativeScaledPx(SIZE_PX[token], raw, props);
  const n = Number(token);
  return Number.isFinite(n) && n > 0 ? conservativeScaledPx(n, raw, props) : null;
}

function sizeToken(value) {
  if (value == null || typeof value === 'object') return '';
  return String(value).trim().toLowerCase();
}

function conservativeScaledPx(px, raw, props) {
  const scale = Number(raw?.scale ?? props?.scale);
  if (Number.isFinite(scale) && scale > 0) return px * scale;
  return px;
}

function isBold(raw, props, meta) {
  const w = String(raw.fontWeight || raw.weight || props.fontWeight || meta.fontWeight || '').toLowerCase();
  return w === 'bold' || w === '700' || w === '800' || w === '900' || raw.bold === true;
}

function estimateLines(text, box, fontPx) {
  const t = String(text || '');
  if (!t) return 0;
  const explicit = t.split(/\r?\n/).filter((line) => line.trim().length || t.includes('\n')).length || 1;
  const px = fontPx || SIZE_PX.m;
  const w = box && box.w > 0 ? box.w : 640;
  const cpl = Math.max(8, Math.floor(w / Math.max(6, px * 0.55)));
  const wrapped = Math.ceil(t.replace(/\s+/g, ' ').trim().length / cpl) || 1;
  return Math.max(explicit, wrapped);
}

function countBullets(text) {
  const lines = String(text || '').split(/\r?\n/);
  let n = 0;
  for (const line of lines) {
    if (/^\s*(?:[•●○■□▪▫–—\-\*]|\d+[\.)]|[a-z][\.)])\s+\S/i.test(line)) n += 1;
  }
  return n;
}

function hostedContent(box, nodes) {
  if (!box?.box) return [];
  return nodes.filter((n) => {
    if (n === box || n.isPaper || n.isOutline || n.isDecor) return false;
    if (!n.meaningful || !n.box) return false;
    return contained(n.box, box.box) || centerInside(n.box, box.box);
  });
}

function coverageRatio(nodes, frame) {
  const rects = nodes.map((n) => clipRect(n.box, frame.box)).filter(Boolean);
  return r6(unionArea(rects) / Math.max(1, area(frame.box)));
}

function rectOf(value, fallback = {}) {
  const src = value && typeof value === 'object' ? value : {};
  const x = num(src.x ?? fallback.x, NaN);
  const y = num(src.y ?? fallback.y, NaN);
  const w = num(src.w ?? src.width ?? fallback.w, NaN);
  const h = num(src.h ?? src.height ?? fallback.h, NaN);
  if (![x, y, w, h].every((n) => Number.isFinite(n)) || !(w > 0) || !(h > 0)) return null;
  return { x, y, w, h };
}

function metaOf(raw) {
  const meta = raw?.meta && typeof raw.meta === 'object' ? raw.meta : {};
  return meta;
}

function clipRect(box, frame) {
  if (!box || !frame) return null;
  const x1 = Math.max(box.x, frame.x);
  const y1 = Math.max(box.y, frame.y);
  const x2 = Math.min(box.x + box.w, frame.x + frame.w);
  const y2 = Math.min(box.y + box.h, frame.y + frame.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function unionArea(rects) {
  const rs = rects.filter((r) => r && r.w > 0 && r.h > 0);
  if (!rs.length) return 0;
  const xs = uniqueSorted(rs.flatMap((r) => [r.x, r.x + r.w]));
  let areaSum = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const strip = x1 - x0;
    if (strip <= 0) continue;
    const bands = rs
      .filter((r) => r.x < x1 && r.x + r.w > x0)
      .map((r) => [r.y, r.y + r.h])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let covered = 0;
    let cur0 = null;
    let cur1 = null;
    for (const [a, b] of bands) {
      if (cur0 == null) {
        cur0 = a;
        cur1 = b;
        continue;
      }
      if (a > cur1) {
        covered += cur1 - cur0;
        cur0 = a;
        cur1 = b;
      } else {
        cur1 = Math.max(cur1, b);
      }
    }
    if (cur0 != null) covered += cur1 - cur0;
    areaSum += strip * covered;
  }
  return areaSum;
}

function uniqueSorted(nums) {
  return [...new Set(nums.map((n) => Number(n)).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function area(box) {
  return box && box.w > 0 && box.h > 0 ? box.w * box.h : 0;
}

function intersectArea(a, b) {
  if (!a || !b) return 0;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

function rectIou(a, b) {
  const inter = intersectArea(a, b);
  const u = area(a) + area(b) - inter;
  return u > 0 ? inter / u : 0;
}

function contained(inner, outer) {
  const inter = intersectArea(inner, outer);
  const small = Math.min(area(inner), area(outer));
  return small > 0 && inter / small >= QA_THRESHOLDS.CONTAINMENT_RATIO;
}

function center(box) {
  if (!box) return { x: 0, y: 0 };
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function pointInRect(p, box) {
  return p.x >= box.x && p.y >= box.y && p.x <= box.x + box.w && p.y <= box.y + box.h;
}

function centerInside(inner, outer) {
  return pointInRect(center(inner), outer);
}

function maxPairIou(nodes) {
  let max = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      max = Math.max(max, rectIou(nodes[i].box, nodes[j].box));
    }
  }
  return max;
}

function overflowExtent(box, frame) {
  const left = frame.x - box.x;
  const top = frame.y - box.y;
  const right = box.x + box.w - (frame.x + frame.w);
  const bottom = box.y + box.h - (frame.y + frame.h);
  return Math.max(0, left, top, right, bottom);
}

function resolveColor(value, themeId, scene, slot) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hex = parseColor(raw, themeId, scene);
  if (hex) return hex;
  if (TOKEN_KEYS.has(raw.toLowerCase())) {
    return parseColor(themeToken(themeId, scene, raw.toLowerCase(), slot), themeId, scene);
  }
  return '';
}

function themeToken(themeId, scene, key, slot) {
  const bag = (themeId && scene.themes.tokensById[themeId]) || firstThemeTokens(scene);
  if (!bag) return '';
  const aliases = {
    paper: ['paper', 'bg', 'background', 'surface'],
    bg: ['bg', 'paper', 'background', 'surface'],
    background: ['background', 'paper', 'bg', 'surface'],
    ink: ['ink', 'fg', 'foreground', 'text'],
    fg: ['fg', 'ink', 'foreground', 'text'],
    foreground: ['foreground', 'ink', 'fg', 'text'],
    text: ['text', 'ink', 'fg']
  };
  const keys = aliases[key] || aliases[slot] || [key];
  for (const k of keys) {
    if (bag[k]) return bag[k];
  }
  return '';
}

function firstThemeTokens(scene) {
  const id = scene.themes.ids[0];
  return id ? scene.themes.tokensById[id] : null;
}

function parseColor(value, themeId, scene) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (scene) {
    const tok = themeToken(themeId, scene, s.toLowerCase());
    if (tok && tok !== s) return parseColor(tok, themeId, scene);
  }
  if (NAMED_HEX[s.toLowerCase()] !== undefined) return NAMED_HEX[s.toLowerCase()];
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
    }
    if (h.length >= 6 && /^[0-9a-fA-F]+$/.test(h)) return `#${h.slice(0, 6).toLowerCase()}`;
    return '';
  }
  const rgb = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(s);
  if (rgb) return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  return '';
}

function rgbToHex(r, g, b) {
  const hex = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return Infinity;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return null;
  const n = parseInt(s, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function stabilize(value) {
  if (Array.isArray(value)) return value.map(stabilize);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number.isInteger(value) ? value : r6(value);
    }
    return value;
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stabilize(value[key]);
  }
  return out;
}

function stabilizeIssue(row) {
  return {
    code: String(row.code),
    severity: String(row.severity),
    frameId: String(row.frameId || ''),
    metrics: stabilize(row.metrics || {}),
    message: String(row.message || '')
  };
}

function sortIssues(issues) {
  return issues.slice().sort((a, b) => {
    return (
      a.code.localeCompare(b.code) ||
      a.frameId.localeCompare(b.frameId) ||
      a.severity.localeCompare(b.severity) ||
      a.message.localeCompare(b.message)
    );
  });
}

function addCounts(into, extra) {
  for (const [k, v] of Object.entries(extra || {})) bump(into, k, v);
}

function bump(map, key, n = 1) {
  const k = String(key || 'unknown');
  map[k] = (map[k] || 0) + n;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function r6(n) {
  return Number(Number(n).toFixed(6));
}

function r2(n) {
  return Number(Number(n).toFixed(2));
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
