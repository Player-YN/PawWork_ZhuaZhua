/**
 * Host-owned slide/poster layout library + slot grammar.
 * Deterministic 1920×1080 slide paper; posters declare their own paper.
 * Not a 200-template pixel dump — recipes + compositional slots.
 */

export const SLIDE_PAPER = { w: 1920, h: 1080 };

/** 12-column slide grid. Outer margin 96px (80–120 band); gutter 24px. */
export const SLIDE_MARGIN = 96;
export const SLIDE_GUTTER = 24;
export const SLIDE_COLS = 12;
/** Content pages: kicker → title → body band. Title box fits 48–64px type. */
export const SLIDE_KICKER_Y = 96;
export const SLIDE_TITLE_Y = 144;
export const SLIDE_TITLE_H = 96;
export const SLIDE_CONTENT_TOP = 268;

export function colX(col, paper = SLIDE_PAPER) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : Math.round((paper.w / SLIDE_PAPER.w) * SLIDE_MARGIN);
  const gutter = paper.w === SLIDE_PAPER.w ? SLIDE_GUTTER : Math.round((paper.w / SLIDE_PAPER.w) * SLIDE_GUTTER);
  const inner = paper.w - margin * 2;
  const width = (inner - gutter * (SLIDE_COLS - 1)) / SLIDE_COLS;
  return Math.round(margin + col * (width + gutter));
}

export function colW(span, paper = SLIDE_PAPER) {
  const n = Math.max(1, Math.min(SLIDE_COLS, Number(span) || 1));
  const gutter = paper.w === SLIDE_PAPER.w ? SLIDE_GUTTER : Math.round((paper.w / SLIDE_PAPER.w) * SLIDE_GUTTER);
  const inner = paper.w - (paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : Math.round((paper.w / SLIDE_PAPER.w) * SLIDE_MARGIN)) * 2;
  const width = (inner - gutter * (SLIDE_COLS - 1)) / SLIDE_COLS;
  return Math.round(n * width + (n - 1) * gutter);
}

export const SLIDE_LAYOUT_IDS = [
  'title',
  'title-visual',
  'section',
  'agenda',
  'points',
  'points-icons',
  'two-col',
  'compare',
  'stat-row',
  'quote',
  'image-caption',
  'timeline',
  'process',
  'matrix',
  'case-study',
  'closing'
];

export const POSTER_LAYOUT_IDS = [
  'poster-hero',
  'poster-split',
  'poster-event',
  'poster-quote',
  'poster-product',
  'poster-editorial',
  'poster-data',
  'comic-panel'
];

export const ALL_LAYOUT_IDS = [...SLIDE_LAYOUT_IDS, ...POSTER_LAYOUT_IDS];

const SLIDE_LIMITS = {
  title: 64,
  kicker: 32,
  subtitle: 120,
  footer: 48,
  quote: 180,
  caption: 100,
  body: 240,
  cta: 32,
  number: 8,
  itemTitle: 48,
  itemBody: 120,
  items: 8,
  stats: 4,
  steps: 6,
  cells: 4,
  panels: 4,
  statValue: 16,
  statLabel: 36
};

function slide(id, spec) {
  return {
    id,
    kind: 'deck',
    paper: { ...SLIDE_PAPER },
    limits: { ...SLIDE_LIMITS, ...(spec.limits || {}) },
    ...spec
  };
}

function poster(id, paper, spec) {
  return {
    id,
    kind: 'poster',
    paper: { w: paper.w, h: paper.h },
    limits: { ...SLIDE_LIMITS, items: 6, ...(spec.limits || {}) },
    ...spec
  };
}

const LAYOUTS = {
  title: slide('title', {
    required: ['title'],
    optional: ['kicker', 'subtitle', 'footer'],
    boxes: {
      kicker: { x: 96, y: 300, w: 1728, h: 40 },
      title: { x: 96, y: 360, w: 1400, h: 240 },
      subtitle: { x: 96, y: 640, w: 1320, h: 88 },
      footer: { x: 96, y: 960, w: 1728, h: 40 }
    }
  }),
  'title-visual': slide('title-visual', {
    required: ['title'],
    optional: ['kicker', 'subtitle', 'visual'],
    boxes: {
      kicker: { x: 96, y: 240, w: colW(7), h: 36 },
      title: { x: 96, y: 300, w: colW(7), h: 280 },
      subtitle: { x: 96, y: 620, w: colW(7), h: 120 },
      visual: { x: colX(7), y: 160, w: colW(5), h: 760 }
    }
  }),
  section: slide('section', {
    required: ['title'],
    optional: ['kicker', 'number'],
    boxes: {
      number: { x: 96, y: 200, w: 560, h: 200 },
      kicker: { x: 96, y: 440, w: 1728, h: 40 },
      title: { x: 96, y: 500, w: 1728, h: 200 }
    }
  }),
  agenda: slide('agenda', {
    required: ['title', 'items'],
    optional: ['kicker'],
    aliases: { points: 'items' },
    limits: { ...SLIDE_LIMITS, items: 8 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  points: slide('points', {
    required: ['title', 'items'],
    optional: ['kicker'],
    aliases: { points: 'items' },
    limits: { ...SLIDE_LIMITS, items: 6 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  'points-icons': slide('points-icons', {
    required: ['title', 'items'],
    optional: ['kicker'],
    aliases: { points: 'items' },
    limits: { ...SLIDE_LIMITS, items: 6 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  'two-col': slide('two-col', {
    required: ['title', 'left', 'right'],
    optional: ['kicker'],
    aliases: { col1: 'left', col2: 'right' },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H },
      left: { x: colX(0), y: SLIDE_CONTENT_TOP, w: colW(6), h: 716 },
      right: { x: colX(6), y: SLIDE_CONTENT_TOP, w: colW(6), h: 716 }
    }
  }),
  compare: slide('compare', {
    required: ['title', 'left', 'right'],
    optional: ['kicker'],
    aliases: { col1: 'left', col2: 'right' },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H },
      left: { x: colX(0), y: SLIDE_CONTENT_TOP, w: colW(6), h: 716 },
      right: { x: colX(6), y: SLIDE_CONTENT_TOP, w: colW(6), h: 716 }
    }
  }),
  'stat-row': slide('stat-row', {
    required: ['title', 'stats'],
    optional: ['kicker'],
    aliases: { metrics: 'stats' },
    limits: { ...SLIDE_LIMITS, stats: 4 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  quote: slide('quote', {
    required: ['quote'],
    optional: ['attribution', 'kicker'],
    aliases: { text: 'quote', cite: 'attribution' },
    boxes: {
      kicker: { x: 160, y: 200, w: 1600, h: 40 },
      quote: { x: 160, y: 300, w: 1600, h: 400 },
      attribution: { x: 160, y: 760, w: 1600, h: 64 }
    }
  }),
  'image-caption': slide('image-caption', {
    required: ['visual'],
    optional: ['title', 'caption', 'kicker'],
    aliases: { image: 'visual' },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 28 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: 64 },
      visual: { x: 96, y: SLIDE_CONTENT_TOP, w: 1728, h: 680 },
      caption: { x: 96, y: 964, w: 1728, h: 40 }
    }
  }),
  timeline: slide('timeline', {
    required: ['title', 'steps'],
    optional: ['kicker'],
    aliases: { items: 'steps' },
    limits: { ...SLIDE_LIMITS, steps: 6 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  process: slide('process', {
    required: ['title', 'steps'],
    optional: ['kicker'],
    aliases: { items: 'steps' },
    limits: { ...SLIDE_LIMITS, steps: 5 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  matrix: slide('matrix', {
    required: ['title', 'cells'],
    optional: ['kicker'],
    aliases: { items: 'cells' },
    limits: { ...SLIDE_LIMITS, cells: 4 },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: 1728, h: SLIDE_TITLE_H }
    }
  }),
  'case-study': slide('case-study', {
    required: ['title', 'context', 'action', 'result'],
    optional: ['kicker', 'visual'],
    aliases: { image: 'visual' },
    boxes: {
      kicker: { x: 96, y: SLIDE_KICKER_Y, w: 1728, h: 36 },
      title: { x: 96, y: SLIDE_TITLE_Y, w: colW(8), h: SLIDE_TITLE_H },
      visual: { x: colX(9), y: 96, w: colW(3), h: 96 },
      context: { x: colX(0), y: SLIDE_CONTENT_TOP, w: colW(4), h: 716 },
      action: { x: colX(4), y: SLIDE_CONTENT_TOP, w: colW(4), h: 716 },
      result: { x: colX(8), y: SLIDE_CONTENT_TOP, w: colW(4), h: 716 }
    }
  }),
  closing: slide('closing', {
    required: ['title'],
    optional: ['subtitle', 'cta', 'footer'],
    boxes: {
      title: { x: 160, y: 280, w: 1600, h: 280 },
      subtitle: { x: 160, y: 580, w: 1600, h: 88 },
      cta: { x: 160, y: 720, w: 520, h: 104 },
      footer: { x: 160, y: 960, w: 1600, h: 40 }
    }
  }),

  'poster-hero': poster('poster-hero', { w: 960, h: 1440 }, {
    required: ['title'],
    optional: ['kicker', 'subtitle', 'visual', 'cta'],
    aliases: { image: 'visual' },
    boxes: {
      visual: { x: 0, y: 0, w: 960, h: 720 },
      kicker: { x: 56, y: 760, w: 848, h: 36 },
      title: { x: 56, y: 812, w: 848, h: 220 },
      subtitle: { x: 56, y: 1050, w: 848, h: 160 },
      cta: { x: 56, y: 1288, w: 400, h: 72 }
    }
  }),
  'poster-split': poster('poster-split', { w: 960, h: 1440 }, {
    required: ['title', 'visual'],
    optional: ['kicker', 'subtitle', 'cta'],
    aliases: { image: 'visual' },
    boxes: {
      visual: { x: 0, y: 0, w: 960, h: 640 },
      kicker: { x: 56, y: 700, w: 848, h: 36 },
      title: { x: 56, y: 752, w: 848, h: 200 },
      subtitle: { x: 56, y: 972, w: 848, h: 240 },
      cta: { x: 56, y: 1288, w: 400, h: 72 }
    }
  }),
  'poster-event': poster('poster-event', { w: 960, h: 1440 }, {
    required: ['title', 'date'],
    optional: ['kicker', 'place', 'visual', 'cta'],
    aliases: { image: 'visual', venue: 'place' },
    boxes: {
      kicker: { x: 56, y: 64, w: 848, h: 36 },
      title: { x: 56, y: 120, w: 848, h: 240 },
      date: { x: 56, y: 380, w: 848, h: 64 },
      place: { x: 56, y: 456, w: 848, h: 48 },
      visual: { x: 56, y: 540, w: 848, h: 640 },
      cta: { x: 56, y: 1288, w: 400, h: 72 }
    }
  }),
  'poster-quote': poster('poster-quote', { w: 960, h: 1350 }, {
    required: ['quote'],
    optional: ['attribution', 'kicker'],
    aliases: { text: 'quote', cite: 'attribution' },
    boxes: {
      kicker: { x: 64, y: 80, w: 832, h: 36 },
      quote: { x: 64, y: 280, w: 832, h: 720 },
      attribution: { x: 64, y: 1080, w: 832, h: 80 }
    }
  }),
  'poster-product': poster('poster-product', { w: 960, h: 1440 }, {
    required: ['title', 'visual'],
    optional: ['kicker', 'subtitle', 'price', 'cta'],
    aliases: { image: 'visual' },
    boxes: {
      visual: { x: 80, y: 80, w: 800, h: 720 },
      kicker: { x: 56, y: 840, w: 848, h: 32 },
      title: { x: 56, y: 884, w: 848, h: 140 },
      subtitle: { x: 56, y: 1036, w: 848, h: 80 },
      price: { x: 56, y: 1140, w: 848, h: 72 },
      cta: { x: 56, y: 1288, w: 400, h: 72 }
    }
  }),
  'poster-editorial': poster('poster-editorial', { w: 1080, h: 1440 }, {
    required: ['title'],
    optional: ['kicker', 'subtitle', 'byline', 'visual'],
    aliases: { image: 'visual', deck: 'subtitle' },
    boxes: {
      kicker: { x: 64, y: 64, w: 952, h: 36 },
      title: { x: 64, y: 120, w: 952, h: 280 },
      subtitle: { x: 64, y: 420, w: 952, h: 160 },
      byline: { x: 64, y: 600, w: 952, h: 40 },
      visual: { x: 64, y: 680, w: 952, h: 680 }
    }
  }),
  'poster-data': poster('poster-data', { w: 1440, h: 960 }, {
    required: ['title', 'stats'],
    optional: ['kicker', 'footnote'],
    aliases: { metrics: 'stats' },
    limits: { ...SLIDE_LIMITS, stats: 4 },
    boxes: {
      kicker: { x: 64, y: 48, w: 1312, h: 32 },
      title: { x: 64, y: 92, w: 1312, h: 88 },
      footnote: { x: 64, y: 880, w: 1312, h: 40 }
    }
  }),
  'comic-panel': poster('comic-panel', { w: 1080, h: 1080 }, {
    required: ['panels'],
    optional: ['title'],
    aliases: { items: 'panels' },
    limits: { ...SLIDE_LIMITS, panels: 4 },
    boxes: {
      title: { x: 40, y: 24, w: 1000, h: 56 }
    }
  })
};

export function listLayoutIds(kind) {
  if (kind === 'deck' || kind === 'slide' || kind === 'slides') return SLIDE_LAYOUT_IDS.slice();
  if (kind === 'poster' || kind === 'design') return POSTER_LAYOUT_IDS.slice();
  return ALL_LAYOUT_IDS.slice();
}

export function getLayout(layoutId) {
  const id = String(layoutId || '').trim();
  const layout = LAYOUTS[id];
  return layout ? { ...layout, paper: { ...layout.paper }, boxes: { ...(layout.boxes || {}) } } : null;
}

export function allowedSlots(layout) {
  const req = layout?.required || [];
  const opt = layout?.optional || [];
  return [...req, ...opt];
}

export function aliasToCanonical(layout, key) {
  const aliases = layout?.aliases || {};
  return aliases[key] || key;
}

/** Repeat-slot geometry. Returns boxes that stay inside paper. */
export function listBoxes(layoutId, count, paper) {
  const n = Math.max(0, Math.min(8, Number(count) || 0));
  const id = String(layoutId || '');
  if (id === 'agenda') return agendaBoxes(n, paper);
  if (id === 'points') return pointsBoxes(n, paper, false);
  if (id === 'points-icons') return pointsBoxes(n, paper, true);
  if (id === 'stat-row' || id === 'poster-data') return statBoxes(n, paper, id === 'poster-data');
  if (id === 'timeline') return timelineBoxes(n, paper);
  if (id === 'process') return processBoxes(n, paper);
  if (id === 'matrix') return matrixBoxes(n, paper);
  if (id === 'comic-panel') return comicBoxes(n, paper);
  return [];
}

function agendaBoxes(n, paper) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 80;
  const top = paper.w === SLIDE_PAPER.w ? SLIDE_CONTENT_TOP : 232;
  const bottom = paper.h - margin;
  const gap = 20;
  const h = Math.min(148, Math.floor((bottom - top - gap * Math.max(0, n - 1)) / Math.max(1, n)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = top + i * (h + gap);
    out.push({
      index: i,
      box: { x: margin, y, w: paper.w - margin * 2, h },
      indexBox: { x: margin, y, w: 120, h },
      titleBox: { x: margin + 144, y, w: paper.w - margin * 2 - 144, h }
    });
  }
  return out;
}

function pointsRowPlan(n) {
  if (n <= 0) return [];
  if (n <= 3) return Array.from({ length: n }, () => 1);
  if (n === 4) return [2, 2];
  if (n === 5) return [3, 2];
  if (n === 6) return [3, 3];
  if (n === 7) return [4, 3];
  return [4, 4].map((c, i) => (i === 0 ? Math.ceil(n / 2) : Math.floor(n / 2)));
}

function pointsBoxes(n, paper, withIcon) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 80;
  const top = paper.w === SLIDE_PAPER.w ? SLIDE_CONTENT_TOP : 232;
  const gapX = paper.w === SLIDE_PAPER.w ? SLIDE_GUTTER : 32;
  const gapY = 28;
  const innerW = paper.w - margin * 2;
  const availH = paper.h - top - margin;
  const rows = pointsRowPlan(n);
  const rowH = Math.floor((availH - gapY * Math.max(0, rows.length - 1)) / Math.max(1, rows.length));
  const maxCols = Math.max(1, ...rows);
  const colW = maxCols === 1 ? innerW : Math.floor((innerW - gapX * (maxCols - 1)) / maxCols);
  const out = [];
  let i = 0;
  for (let r = 0; r < rows.length; r++) {
    const count = rows[r];
    const rowW = count * colW + Math.max(0, count - 1) * gapX;
    const startX = margin + Math.round((innerW - rowW) / 2);
    const y = top + r * (rowH + gapY);
    for (let c = 0; c < count; c++) {
      const x = startX + c * (colW + gapX);
      const icon = withIcon ? { x: x + 36, y: y + 36, w: 112, h: 112 } : null;
      const textX = x + 36;
      const textW = colW - 72;
      const titleY = withIcon ? y + 168 : y + 40;
      out.push({
        index: i,
        box: { x, y, w: colW, h: rowH },
        iconBox: icon,
        titleBox: { x: textX, y: titleY, w: textW, h: 56 },
        bodyBox: { x: textX, y: titleY + 64, w: textW, h: Math.max(48, rowH - (titleY - y) - 88) }
      });
      i += 1;
    }
  }
  return out;
}

function statBoxes(n, paper, landscapePoster) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 64;
  const top = landscapePoster ? 220 : SLIDE_CONTENT_TOP;
  const h = landscapePoster ? 520 : paper.h - top - margin;
  const gap = paper.w === SLIDE_PAPER.w ? SLIDE_GUTTER : 32;
  const innerW = paper.w - margin * 2;
  const w = Math.floor((innerW - gap * Math.max(0, n - 1)) / Math.max(1, n));
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = margin + i * (w + gap);
    out.push({
      index: i,
      box: { x, y: top, w, h },
      valueBox: { x: x + 36, y: top + 120, w: w - 72, h: 220 },
      labelBox: { x: x + 36, y: top + 360, w: w - 72, h: 96 }
    });
  }
  return out;
}

function timelineBoxes(n, paper) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 80;
  const innerW = paper.w - margin * 2;
  const stepW = Math.floor(innerW / Math.max(1, n));
  const cardY = paper.w === SLIDE_PAPER.w ? 320 : 360;
  const cardH = paper.h - cardY - margin;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = margin + i * stepW;
    const w = stepW - 24;
    out.push({
      index: i,
      box: { x, y: cardY, w, h: cardH },
      nodeBox: { x: x + 28, y: cardY + 32, w: 88, h: 88 },
      titleBox: { x: x + 28, y: cardY + 140, w: w - 56, h: 72 },
      bodyBox: { x: x + 28, y: cardY + 224, w: w - 56, h: Math.max(80, cardH - 260) }
    });
  }
  return out;
}

function processBoxes(n, paper) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 80;
  const gap = paper.w === SLIDE_PAPER.w ? SLIDE_GUTTER : 32;
  const innerW = paper.w - margin * 2;
  const w = Math.floor((innerW - gap * Math.max(0, n - 1)) / Math.max(1, n));
  const top = paper.w === SLIDE_PAPER.w ? SLIDE_CONTENT_TOP : 280;
  const h = paper.h - top - margin;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = margin + i * (w + gap);
    out.push({
      index: i,
      box: { x, y: top, w, h },
      indexBox: { x: x + 28, y: top + 36, w: 160, h: 160 },
      titleBox: { x: x + 28, y: top + 220, w: w - 56, h: 80 },
      bodyBox: { x: x + 28, y: top + 312, w: w - 56, h: Math.max(80, h - 360) }
    });
  }
  return out;
}

function matrixBoxes(n, paper) {
  const margin = paper.w === SLIDE_PAPER.w ? SLIDE_MARGIN : 80;
  const top = paper.w === SLIDE_PAPER.w ? SLIDE_CONTENT_TOP : 280;
  const gap = 20;
  const innerW = paper.w - margin * 2;
  const innerH = paper.h - top - margin;
  const colW = Math.floor((innerW - gap) / 2);
  const rowH = Math.floor((innerH - gap) / 2);
  const out = [];
  for (let i = 0; i < Math.min(n, 4); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + gap);
    const y = top + row * (rowH + gap);
    out.push({
      index: i,
      box: { x, y, w: colW, h: rowH },
      titleBox: { x: x + 40, y: y + 40, w: colW - 80, h: 72 },
      bodyBox: { x: x + 40, y: y + 128, w: colW - 80, h: rowH - 176 }
    });
  }
  return out;
}

function comicBoxes(n, paper) {
  const titleH = 80;
  const top = 100;
  const gap = 20;
  const innerW = paper.w - 80;
  const innerH = paper.h - top - 40;
  const cols = n <= 2 ? n : 2;
  const rows = Math.ceil(n / Math.max(1, cols));
  const colW = Math.floor((innerW - gap * Math.max(0, cols - 1)) / Math.max(1, cols));
  const rowH = Math.floor((innerH - gap * Math.max(0, rows - 1)) / Math.max(1, rows));
  const out = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 40 + col * (colW + gap);
    const y = top + row * (rowH + gap);
    out.push({
      index: i,
      box: { x, y, w: colW, h: rowH },
      visualBox: { x: x + 12, y: y + 12, w: colW - 24, h: Math.max(80, rowH - 88) },
      captionBox: { x: x + 12, y: y + rowH - 64, w: colW - 24, h: 48 },
      titleH
    });
  }
  return out;
}

export function columnInnerBoxes(outer) {
  const pad = 48;
  return {
    labelBox: { x: outer.x + pad, y: outer.y + pad, w: outer.w - pad * 2, h: 44 },
    titleBox: { x: outer.x + pad, y: outer.y + pad + 52, w: outer.w - pad * 2, h: 160 },
    bodyBox: { x: outer.x + pad, y: outer.y + pad + 228, w: outer.w - pad * 2, h: Math.max(40, outer.h - pad * 2 - 228) }
  };
}

function compactSlotContract(id) {
  const layout = LAYOUTS[id];
  return {
    required: (layout?.required || []).slice(),
    optional: (layout?.optional || []).slice()
  };
}

export function compactLayoutCatalog() {
  return {
    themes: [
      'hanbai',
      'ink-rose',
      'midnight-cyan',
      'forest',
      'studio-amber',
      'editorial',
      'cobalt',
      'mono'
    ],
    layouts: {
      deck: Object.fromEntries(SLIDE_LAYOUT_IDS.map((id) => [id, compactSlotContract(id)])),
      design: Object.fromEntries(POSTER_LAYOUT_IDS.map((id) => [id, compactSlotContract(id)]))
    },
    contract:
      'themeId + frames[{id,layoutId,slots,variant?}] — host compiles geometry into pawCanvas nodes. variant is paper|surface|accent|dark inside one themeId. raw frames[].nodes remains a freeform escape hatch. replacePlate {layoutId,themeId?,variant?,slots} rewrites the selected frame children.',
    variants: ['paper', 'surface', 'accent', 'dark'],
    visuals: {
      kinds: ['icon', 'motif', 'chart', 'image'],
      hint: 'deck act=read catalog="icons" query="协作 团队" limit=8'
    }
  };
}
