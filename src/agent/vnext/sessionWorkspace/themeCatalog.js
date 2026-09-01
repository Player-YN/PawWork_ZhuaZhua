/**
 * Host-owned Design/Slides themes. Semantic tokens only — geometry lives in layouts.
 * Stable IDs are the contract; hex values are host paint, not model coordinates.
 */

export const THEME_IDS = [
  'hanbai',
  'ink-rose',
  'midnight-cyan',
  'forest',
  'studio-amber',
  'editorial',
  'cobalt',
  'mono'
];

const THEMES = {
  hanbai: {
    id: 'hanbai',
    name: 'Hanbai',
    paper: '#F4EDE1',
    ink: '#1C1410',
    muted: '#6B5E55',
    accent: '#B43326',
    accent2: '#D4A017',
    rule: '#C4B8A8',
    font: 'serif',
    surface: '#EBE2D4'
  },
  'ink-rose': {
    id: 'ink-rose',
    name: 'Ink Rose',
    paper: '#F7F1F2',
    ink: '#2A1A1F',
    muted: '#6A4E56',
    accent: '#A13D4C',
    accent2: '#E8B4BC',
    rule: '#E0D0D4',
    font: 'sans',
    surface: '#EFE6E8'
  },
  'midnight-cyan': {
    id: 'midnight-cyan',
    name: 'Midnight Cyan',
    paper: '#0B1B2B',
    ink: '#E8F4F8',
    muted: '#8AA8B5',
    accent: '#2EC4D6',
    accent2: '#F0B429',
    rule: '#1A3344',
    font: 'sans',
    surface: '#122536'
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    paper: '#F3F0E6',
    ink: '#1B2E24',
    muted: '#4F6256',
    accent: '#2F6B4F',
    accent2: '#C4A35A',
    rule: '#D5D0C4',
    font: 'serif',
    surface: '#E8E4D8'
  },
  'studio-amber': {
    id: 'studio-amber',
    name: 'Studio Amber',
    paper: '#1A1612',
    ink: '#F5EDE0',
    muted: '#A89880',
    accent: '#E8A317',
    accent2: '#F0C96A',
    rule: '#3A3228',
    font: 'sans',
    surface: '#241E18'
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    paper: '#F7F4EE',
    ink: '#161616',
    muted: '#6E6A64',
    accent: '#9B1D2E',
    accent2: '#1F4B7A',
    rule: '#D8D3C8',
    font: 'serif',
    surface: '#EFEBE3'
  },
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt',
    paper: '#F4F6F8',
    ink: '#0E1C2F',
    muted: '#5B6B7C',
    accent: '#1F4E8C',
    accent2: '#E07A2F',
    rule: '#D0D6DE',
    font: 'sans',
    surface: '#E8ECF0'
  },
  mono: {
    id: 'mono',
    name: 'Mono',
    paper: '#FFFFFF',
    ink: '#111111',
    muted: '#6B6B6B',
    accent: '#111111',
    accent2: '#9A9A9A',
    rule: '#D0D0D0',
    font: 'sans',
    surface: '#F4F4F4'
  }
};

export const DEFAULT_THEME_ID = 'editorial';

export const PAGE_VARIANT_IDS = Object.freeze(['paper', 'surface', 'accent', 'dark']);
export const DEFAULT_VARIANT_ID = 'paper';

/** Layout defaults. One theme; pages may alternate variants. */
export const DEFAULT_VARIANT_BY_LAYOUT = Object.freeze({
  title: 'dark',
  'title-visual': 'dark',
  section: 'accent',
  closing: 'dark',
  quote: 'paper',
  'poster-quote': 'paper',
  'poster-hero': 'dark',
  'poster-editorial': 'dark'
});

export function listThemeIds() {
  return THEME_IDS.slice();
}

export function listPageVariants() {
  return PAGE_VARIANT_IDS.slice();
}

export function getTheme(themeId) {
  const id = String(themeId || '').trim();
  return THEMES[id] ? { ...THEMES[id] } : null;
}

export function resolveTheme(themeId, fallbackId = DEFAULT_THEME_ID) {
  return getTheme(themeId) || getTheme(fallbackId);
}

export function isPageVariant(value) {
  return PAGE_VARIANT_IDS.includes(String(value || '').trim());
}

export function defaultVariantForLayout(layoutId) {
  const id = String(layoutId || '').trim();
  return DEFAULT_VARIANT_BY_LAYOUT[id] || DEFAULT_VARIANT_ID;
}

/**
 * Resolve a compact optional semantic variant. Unknown values fail.
 * Empty / omitted → layout default (or paper).
 */
export function resolvePageVariant(value, layoutId) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { ok: true, variant: defaultVariantForLayout(layoutId) };
  }
  if (!isPageVariant(raw)) {
    return {
      ok: false,
      error: `unknown variant "${raw}" (allowed: ${PAGE_VARIANT_IDS.join(', ')})`
    };
  }
  return { ok: true, variant: raw };
}

export function compactThemeCatalog() {
  return THEME_IDS.slice();
}

/**
 * tldraw 5.3.2 DefaultColorStyle names (TLColorStyle.mjs).
 * Semantic roles map onto this closed set; ThemeManager remaps their paint.
 *
 * ThemeManager is document-global (one hex per name). Mixed page variants
 * therefore compile onto an expanded stable named-style map so every
 * variant's bg/ink/card can paint simultaneously — not a per-frame palette swap.
 */
export const TLDRAW_COLOR_NAMES = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
];

/** Paper-variant role → native color style (backward compatible). */
export const ROLE_TO_TLDRAW_COLOR = Object.freeze({
  ink: 'black',
  muted: 'grey',
  paper: 'white',
  surface: 'yellow',
  accent: 'red',
  accent2: 'orange',
  rule: 'light-red',
  bg: 'white',
  card: 'yellow',
  decoration: 'orange',
  visual: 'black'
});

/**
 * (variant, role) → DefaultColorStyle name. Hex lives in themeNamedPalette.
 * paper/surface/accent reuse white/black/yellow/red so light pages stay
 * compatible; dark* names (violet, light-violet, blue, green) hold the
 * dark-field tokens so a dark cover and a paper body can coexist.
 */
export const VARIANT_ROLE_TO_TLDRAW_COLOR = Object.freeze({
  paper: {
    bg: 'white',
    paper: 'white',
    ink: 'black',
    muted: 'grey',
    card: 'yellow',
    surface: 'yellow',
    accent: 'red',
    accent2: 'orange',
    rule: 'light-red',
    decoration: 'orange',
    visual: 'black'
  },
  surface: {
    bg: 'yellow',
    paper: 'yellow',
    ink: 'black',
    muted: 'grey',
    card: 'white',
    surface: 'white',
    accent: 'red',
    accent2: 'orange',
    rule: 'light-red',
    decoration: 'orange',
    visual: 'black'
  },
  accent: {
    bg: 'red',
    paper: 'red',
    ink: 'white',
    muted: 'light-blue',
    card: 'orange',
    surface: 'orange',
    accent: 'orange',
    accent2: 'yellow',
    rule: 'orange',
    decoration: 'orange',
    visual: 'white'
  },
  dark: {
    bg: 'violet',
    paper: 'violet',
    ink: 'light-violet',
    muted: 'blue',
    card: 'green',
    surface: 'green',
    accent: 'red',
    accent2: 'orange',
    rule: 'blue',
    decoration: 'orange',
    visual: 'light-violet'
  }
});

export const CJK_SANS_STACK =
  "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif";
export const CJK_SERIF_STACK =
  "Georgia, 'Songti SC', 'SimSun', 'Noto Serif SC', 'PMingLiU', serif";

/** Verified tldraw 5.3.2 font CSS variables on `.tl-container`. */
export const TLDRAW_FONT_CSS_VARS = Object.freeze({
  sans: '--tl-font-sans',
  serif: '--tl-font-serif',
  draw: '--tl-font-draw',
  mono: '--tl-font-mono'
});

export function tldrawColorForRole(role, variant, theme) {
  const key = String(role || '').trim().toLowerCase();
  const v = isPageVariant(variant) ? variant : DEFAULT_VARIANT_ID;
  const map = VARIANT_ROLE_TO_TLDRAW_COLOR[v] || VARIANT_ROLE_TO_TLDRAW_COLOR.paper;
  void theme;
  return map[key] || ROLE_TO_TLDRAW_COLOR[key] || '';
}

export function themeHexForRole(theme, role, variant) {
  const t = theme && typeof theme === 'object' && theme.paper ? theme : getTheme(theme);
  if (!t) return '';
  const tokens = resolveVariantTokens(t, variant || t.variant);
  const key = String(role || '').trim().toLowerCase();
  if (key === 'muted') return tokens.muted;
  if (key === 'accent') return tokens.accent;
  if (key === 'accent2' || key === 'decoration') return tokens.accent2;
  if (key === 'rule') return tokens.rule;
  if (key === 'surface' || key === 'card') return tokens.card;
  if (key === 'paper' || key === 'bg') return tokens.bg;
  return tokens.ink;
}

/**
 * Contrast-safe role hexes for one page variant. Does not change themeId.
 */
export function resolveVariantTokens(theme, variant) {
  const t = theme && typeof theme === 'object' && theme.paper ? theme : getTheme(theme);
  const fallback = {
    bg: '#F7F4EE',
    ink: '#161616',
    muted: '#6E6A64',
    card: '#EFEBE3',
    accent: '#9B1D2E',
    accent2: '#1F4B7A',
    rule: '#D8D3C8'
  };
  if (!t) return fallback;
  const v = isPageVariant(variant) ? variant : DEFAULT_VARIANT_ID;
  const paper = t.paper;
  const ink = t.ink;
  const surface = t.surface || paper;
  const accent = t.accent;
  const accent2 = t.accent2;
  const muted = t.muted;
  const rule = t.rule;
  if (v === 'surface') {
    return {
      bg: surface,
      ink: contrastInk(surface, ink, paper),
      muted: contrastMuted(surface, muted, ink, paper),
      card: paper,
      accent,
      accent2,
      rule
    };
  }
  if (v === 'accent') {
    const onAccent = contrastInk(accent, paper, ink);
    return {
      bg: accent,
      ink: onAccent,
      muted: mixToward(onAccent, accent, 0.38),
      card: pickCardOn(accent, accent2, onAccent, darkenHex(accent, 0.18)),
      accent: accent2,
      accent2: surface,
      rule: mixToward(onAccent, accent, 0.55)
    };
  }
  if (v === 'dark') {
    const bg = darkField(t);
    const onDark = contrastInk(bg, paper, ink);
    return {
      bg,
      ink: onDark,
      muted: mixToward(onDark, bg, 0.42),
      card: pickCardOn(bg, liftDark(bg), onDark, mixToward(bg, onDark, 0.12)),
      accent,
      accent2,
      rule: mixToward(onDark, bg, 0.58)
    };
  }
  return {
    bg: paper,
    ink: contrastInk(paper, ink, paper),
    muted,
    card: surface,
    accent,
    accent2,
    rule
  };
}

/**
 * Named-style → catalog hex for the given theme.
 * QA, compiler, and ThemeManager share this map.
 * Includes every variant's paints so mixed pages render in one editor theme.
 */
export function themeNamedPalette(themeId) {
  const theme = getTheme(themeId);
  if (!theme) return null;
  const paper = resolveVariantTokens(theme, 'paper');
  const surface = resolveVariantTokens(theme, 'surface');
  const accent = resolveVariantTokens(theme, 'accent');
  const dark = resolveVariantTokens(theme, 'dark');
  return {
    black: paper.ink,
    grey: paper.muted,
    white: paper.bg,
    red: paper.accent,
    orange: paper.accent2,
    'light-red': paper.rule,
    yellow: paper.card || surface.bg,
    blue: dark.muted,
    'light-blue': accent.muted,
    green: dark.card,
    'light-green': surface.card,
    violet: dark.bg,
    'light-violet': dark.ink
  };
}

export function themeTokenBag(themeId) {
  const theme = getTheme(themeId);
  if (!theme) return null;
  const named = themeNamedPalette(themeId);
  const paper = resolveVariantTokens(theme, 'paper');
  const dark = resolveVariantTokens(theme, 'dark');
  const accent = resolveVariantTokens(theme, 'accent');
  return {
    paper: theme.paper,
    ink: theme.ink,
    muted: theme.muted,
    accent: theme.accent,
    accent2: theme.accent2,
    rule: theme.rule,
    surface: theme.surface,
    ...named,
    'paper.bg': paper.bg,
    'dark.bg': dark.bg,
    'dark.ink': dark.ink,
    'accent.bg': accent.bg,
    'accent.ink': accent.ink
  };
}

export function themeCssVarMap(themeId) {
  const named = themeNamedPalette(themeId);
  if (!named) return null;
  const vars = {
    [TLDRAW_FONT_CSS_VARS.sans]: CJK_SANS_STACK,
    [TLDRAW_FONT_CSS_VARS.serif]: CJK_SERIF_STACK
  };
  for (const [name, hex] of Object.entries(named)) {
    vars[`--paw-palette-${name}`] = hex;
  }
  vars['--paw-theme-paper'] = named.white;
  vars['--paw-theme-ink'] = named.black;
  vars['--paw-theme-muted'] = named.grey;
  vars['--paw-theme-accent'] = named.red;
  vars['--paw-theme-accent2'] = named.orange;
  vars['--paw-theme-rule'] = named['light-red'];
  vars['--paw-theme-surface'] = named.yellow;
  vars['--paw-theme-dark'] = named.violet;
  vars['--paw-theme-dark-ink'] = named['light-violet'];
  return vars;
}

function remapColorEntry(hex, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const paint = String(hex || '').trim() || base.solid || '#000000';
  return {
    ...base,
    solid: paint,
    fill: paint,
    linedFill: paint,
    semi: paint,
    pattern: paint
  };
}

/**
 * ThemeManager color bags for tldraw 5.3.2 (defaultThemes.mjs).
 * Shape paint uses getColorValue(colors, name, 'solid'|'fill'|…), not CSS vars.
 */
export function buildTldrawColorPalettes(themeId) {
  const named = themeNamedPalette(themeId);
  if (!named) return null;
  const remap = (modeFallback) => {
    const next = { ...(modeFallback || {}) };
    for (const name of TLDRAW_COLOR_NAMES) {
      if (!named[name]) continue;
      next[name] = remapColorEntry(named[name], modeFallback?.[name]);
    }
    return next;
  };
  return { light: remap({}), dark: remap({}) };
}

export function inferDocumentThemeId(doc, store) {
  const direct = String(doc?.themeId || doc?.tldraw?.themeId || '').trim();
  if (direct && getTheme(direct)) return direct;
  const recs = store || doc?.tldraw?.document?.store || doc?.tldraw?.store || {};
  const docMeta = recs['document:document']?.meta?.pawTheme;
  if (docMeta && getTheme(docMeta)) return String(docMeta);
  for (const rec of Object.values(recs)) {
    const tid = rec?.meta?.pawTheme;
    if (tid && getTheme(tid)) return String(tid);
  }
  return '';
}

function contrastInk(bg, a, b) {
  const ra = contrastRatio(bg, a);
  const rb = contrastRatio(bg, b);
  if (ra >= rb && ra >= 3) return a;
  if (rb > ra && rb >= 3) return b;
  return ra >= rb ? a : b;
}

function contrastMuted(bg, muted, ink, paper) {
  if (contrastRatio(bg, muted) >= 3) return muted;
  return mixToward(contrastInk(bg, ink, paper), bg, 0.4);
}

function pickCardOn(bg, candidate, ink, fallback) {
  if (candidate && contrastRatio(candidate, ink) >= 3 && contrastRatio(candidate, bg) >= 1.08) {
    return candidate;
  }
  if (fallback && contrastRatio(fallback, ink) >= 3) return fallback;
  return mixToward(bg, ink, 0.14);
}

function darkField(theme) {
  if (luminance(theme.paper) < 0.22) return darkenHex(theme.paper, 0.06) || theme.paper;
  if (luminance(theme.ink) < 0.22) return theme.ink;
  return '#161014';
}

function liftDark(bg) {
  return mixToward(bg, '#ffffff', 0.1);
}

function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return 1;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function hexToRgb(hex) {
  const s = normHex(hex).replace('#', '');
  if (s.length !== 6) return null;
  const n = parseInt(s, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  const h = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function normHex(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s[0] === '#' && s.length === 4) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  if (s[0] === '#' && s.length >= 7) return s.slice(0, 7).toLowerCase();
  return s.toLowerCase();
}

function mixToward(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from || to || '';
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

function darkenHex(hex, amount) {
  return mixToward(hex, '#000000', amount);
}
