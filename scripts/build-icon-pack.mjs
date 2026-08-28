/**
 * Pack the full Lucide ISC set from `lucide-static` into committed runtime modules.
 * The packed extension ships only the generated modules, never node_modules.
 *
 *   node scripts/build-icon-pack.mjs
 *   node scripts/build-icon-pack.mjs --check
 *
 * Output is deterministic: SVG ids sorted, aliases sorted, stable JSON.
 * Search aliases include Lucide tags.json when the package ships it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lucideRoot = path.join(root, 'node_modules', 'lucide-static');
const iconsDir = path.join(lucideRoot, 'icons');
const tagsPath = path.join(lucideRoot, 'tags.json');
const packPath = path.join(root, 'src', 'agent', 'vnext', 'sessionWorkspace', 'canvasIconPack.js');
const indexPath = path.join(root, 'src', 'agent', 'vnext', 'sessionWorkspace', 'iconCatalogIndex.js');

/** Full lucide-static set is required; refuse a silent curated fallback. */
const MIN_FULL_ICON_COUNT = 1500;

const CATEGORY_RULES = [
  ['people', /^(user|users|contact|id-card|smile|frown|meh|heart|handshake|thumbs|award|trophy|medal|crown|ghost|baby|accessibility|person|venus|mars|family|angry|annoyed|laugh|kiss|hand-heart)/],
  ['communication', /^(mail|message|messages|megaphone|bell|rss|at-sign|phone|voicemail|send|reply|forward|inbox|podcast|speech)/],
  ['commerce', /^(shopping|store|tag|receipt|wallet|credit-card|banknote|coins|circle-dollar|badge-dollar|badge-percent|hand-coins|piggy|package|truck|basket|cart)/],
  ['food', /^(utensils|coffee|wine|cake|pizza|apple|banana|beef|soup|salad|cookie|popcorn|beer|martini|cherry|citrus|cooking|cup-soda|ice-cream|donut|sandwich|salad)/],
  ['education', /^(graduation|school|university|backpack|pencil-ruler)/],
  ['business', /^(briefcase|building|factory|warehouse|landmark|hotel|hospital|presentation|projector|podium|gavel|scale|target|goal|rocket|kanban|workflow|network)/],
  ['data', /^(chart|pie-chart|bar-chart|line-chart|area-chart|database|table|sheet|sigma|percent|hash|binary|activity|trending|gauge)/],
  ['device', /^(monitor|smartphone|tablet|laptop|pc-case|keyboard|mouse|speaker|headphones|mic|camera|video|webcam|tv|watch|gamepad|printer|scanner|cpu|memory|hard-drive|server|router|antenna|radio|bluetooth|wifi|battery|plug|cable|usb|hdmi|nfc)/],
  ['files', /^(file|folder|archive|clipboard|notebook|book|library|sticky-note)/],
  ['time', /^(calendar|clock|timer|hourglass|alarm|history)/],
  ['security', /^(lock|unlock|key|shield|ban|fingerprint|scan-face|scan-eye|vault)/],
  ['navigation', /^(map|compass|globe|earth|locate|navigation|route|signpost|milestone|home|house|arrow|move|expand|minimize|maximize)/],
  ['media', /^(image|images|music|film|clapperboard|palette|paint|aperture|crop|frame|sun|moon|sparkle|star|flame|lightbulb|lamp)/],
  ['action', /^(check|x$|plus|minus|copy|trash|pencil|edit|save|download|upload|share|undo|redo|refresh|search|filter|sliders|settings|wrench|wand|zap|play|pause|eye|info|circle-|square-|triangle-|badge-|bookmark|flag|pin|paperclip|link|qr-code|scan|list|toggle|power|log-|external)/]
];

const TAG_CATEGORY = [
  ['food', ['food', 'drink', 'fruit', 'meal', 'restaurant', 'grocery', 'beverage', 'cooking']],
  ['education', ['education', 'school', 'university', 'learning', 'study', 'academic', 'college']],
  ['commerce', ['money', 'finance', 'currency', 'payment', 'shopping', 'banking']],
  ['people', ['people', 'person', 'emotion', 'face', 'family']],
  ['communication', ['mail', 'email', 'message', 'chat', 'phone', 'social', 'notification']],
  ['business', ['business', 'office', 'work']],
  ['data', ['chart', 'graph', 'analytics', 'statistics']],
  ['device', ['device', 'computer', 'hardware', 'electronics']],
  ['files', ['document', 'folder', 'file']],
  ['time', ['time', 'calendar', 'clock', 'schedule']],
  ['security', ['security', 'privacy', 'protection']],
  ['navigation', ['navigation', 'map', 'location', 'travel']],
  ['media', ['photo', 'music', 'video', 'art']]
];

function categorize(id, tags) {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(id)) return cat;
  }
  const toks = new Set();
  for (const tag of tags || []) {
    const raw = String(tag).toLowerCase();
    toks.add(raw);
    for (const part of raw.split(/[\s,/]+/)) toks.add(part);
  }
  for (const [cat, keys] of TAG_CATEGORY) {
    if (keys.some((k) => toks.has(k))) return cat;
  }
  return 'object';
}

function minifySvg(svg) {
  return String(svg || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ class="[^"]*"/g, '')
    .replace(/ width="24"/g, '')
    .replace(/ height="24"/g, '')
    .replace(/> </g, '><')
    .trim();
}

function loadTags() {
  if (!fs.existsSync(tagsPath)) return {};
  const raw = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const key of Object.keys(raw).sort()) {
    const val = raw[key];
    if (!Array.isArray(val)) continue;
    out[key] = val.map((t) => String(t)).filter(Boolean);
  }
  return out;
}

/** Drop Lucide tag crumbs that collide with English filler and wreck search. */
const TAG_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'app',
  'apps',
  'at',
  'by',
  'for',
  'form',
  'from',
  'icon',
  'icons',
  'in',
  'misc',
  'no',
  'none',
  'not',
  'of',
  'off',
  'on',
  'or',
  'other',
  'sign',
  'svg',
  'symbol',
  'the',
  'to',
  'ui',
  'ux',
  'with'
]);
const SHORT_TAG_ALLOW = new Set(['ai', 'tv', 'qr', 'hd', '3d', 'ok']);

function keepTagToken(tok) {
  if (!tok) return false;
  if (TAG_STOPWORDS.has(tok)) return false;
  if (tok.length >= 3) return true;
  return SHORT_TAG_ALLOW.has(tok);
}

function aliasesFor(id, tags) {
  const tokens = String(id)
    .split('-')
    .map((t) => t.trim())
    .filter((t) => t && t.length > 1);
  const extra = [];
  for (const tag of tags || []) {
    const raw = String(tag)
      .trim()
      .toLowerCase();
    if (!raw || TAG_STOPWORDS.has(raw)) continue;
    if (raw.length >= 3 || SHORT_TAG_ALLOW.has(raw)) extra.push(raw);
    for (const part of raw.split(/[\s,/]+/)) {
      const tok = part.replace(/[^a-z0-9-]/g, '');
      if (keepTagToken(tok)) extra.push(tok);
    }
  }
  return [...new Set([...tokens, ...extra])].sort();
}

function loadIconIds() {
  return fs
    .readdirSync(iconsDir)
    .filter((n) => n.endsWith('.svg'))
    .map((n) => n.replace(/\.svg$/, ''))
    .sort();
}

function packIcons(ids) {
  const icons = {};
  const missing = [];
  for (const id of ids) {
    const p = path.join(iconsDir, `${id}.svg`);
    if (!fs.existsSync(p)) {
      missing.push(id);
      continue;
    }
    icons[id] = minifySvg(fs.readFileSync(p, 'utf8'));
  }
  return { icons, missing };
}

function indexFor(ids, tagsById) {
  return ids.map((id) => ({
    id,
    aliases: aliasesFor(id, tagsById[id] || []),
    category: categorize(id, tagsById[id] || [])
  }));
}

if (!fs.existsSync(iconsDir)) {
  console.error('build-icon-pack: lucide-static icons not found (devDependency)');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(lucideRoot, 'package.json'), 'utf8'));
const ids = loadIconIds();
const packed = packIcons(ids);
if (packed.missing.length) {
  console.error(`build-icon-pack: missing lucide icons: ${packed.missing.slice(0, 12).join(', ')}`);
  process.exit(1);
}
if (ids.length < MIN_FULL_ICON_COUNT) {
  console.error(`build-icon-pack: full set too small (${ids.length} < ${MIN_FULL_ICON_COUNT})`);
  process.exit(1);
}

const icons = packed.icons;
const mode = 'full';
const tagsById = loadTags();
const index = indexFor(Object.keys(icons), tagsById);
const packBody = `/**
 * Generated by scripts/build-icon-pack.mjs from lucide-static@${pkg.version}
 * (Lucide, ISC license — https://lucide.dev). Do not edit by hand.
 * Full packaged Lucide set for Design/Slides.
 */
export const CANVAS_ICON_PACK_VERSION = ${JSON.stringify(pkg.version)};
export const CANVAS_ICON_PACK_LICENSE = "ISC";
export const CANVAS_ICON_PACK_PROVIDER = "lucide";
export const CANVAS_ICON_PACK_MODE = ${JSON.stringify(mode)};

/** @type {Record<string, string>} icon id → svg markup (stroke: currentColor) */
export const CANVAS_ICONS = ${JSON.stringify(icons)};

export const CANVAS_ICON_IDS = Object.keys(CANVAS_ICONS);
`;

const indexBody = `/**
 * Generated by scripts/build-icon-pack.mjs from lucide-static@${pkg.version}
 * Compact searchable index (id / aliases / category). Do not edit by hand.
 */
export const ICON_CATALOG_INDEX = ${JSON.stringify(index)};
`;

const check = process.argv.includes('--check');
if (check) {
  const havePack = fs.existsSync(packPath) ? fs.readFileSync(packPath, 'utf8') : '';
  const haveIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  if (havePack !== packBody || haveIndex !== indexBody) {
    console.error(
      'build-icon-pack --check: generated modules are stale or missing. Run `npm run build:icons` and keep both runtime files tracked.'
    );
    process.exit(1);
  }
  console.log(
    `build-icon-pack --check: ok ${Object.keys(icons).length} icons (${mode})`
  );
} else {
  fs.writeFileSync(packPath, packBody);
  fs.writeFileSync(indexPath, indexBody);
  const packBytes = fs.statSync(packPath).size;
  const indexBytes = fs.statSync(indexPath).size;
  console.log(
    `build-icon-pack: wrote ${Object.keys(icons).length} icons (${mode}) → ${path.relative(root, packPath)} ${packBytes} bytes; index ${indexBytes} bytes`
  );
}
