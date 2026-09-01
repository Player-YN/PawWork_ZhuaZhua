/**
 * Deterministic Lucide icon search. Host-side only — default deck read
 * never dumps the full pack into model context.
 */

import { CANVAS_ICON_IDS, CANVAS_ICON_PACK_LICENSE, CANVAS_ICON_PACK_PROVIDER, CANVAS_ICONS } from './canvasIconPack.js';
import { ICON_CATALOG_INDEX } from './iconCatalogIndex.js';

export const ICON_LICENSE = CANVAS_ICON_PACK_LICENSE;
export const ICON_PROVIDER = CANVAS_ICON_PACK_PROVIDER;

export const COMMON_ICON_IDS = [
  'check',
  'users',
  'briefcase',
  'chart-column',
  'database',
  'smartphone',
  'settings',
  'search',
  'mail',
  'calendar',
  'globe',
  'shield',
  'rocket',
  'lightbulb',
  'paw-print',
  'image',
  'handshake',
  'workflow',
  'target',
  'file-text'
].filter((id) => !!CANVAS_ICONS[id]);

/** Extra English + Chinese aliases layered on the generated token index. */
const EXTRA_ALIASES = {
  users: ['team', 'teamwork', 'collaborate', 'collaboration', 'group', 'staff', '协作', '团队', '人员', '同事'],
  'users-round': ['team', '协作', '团队'],
  'user-plus': ['invite', 'add-user', '加人', '邀请'],
  handshake: ['partner', 'deal', '合作', '协作', '握手'],
  workflow: ['pipeline', 'process', '流程', '协作'],
  'git-merge': ['merge', '合并', '协作'],
  search: ['find', 'lookup', '搜索', '查找'],
  settings: ['gear', 'config', '偏好', '设置'],
  'chart-column': ['bar', 'bars', 'stats', '图表', '柱状', '数据'],
  'chart-line': ['trend', '折线', '趋势'],
  'chart-pie': ['donut', 'pie', '饼图'],
  database: ['data', 'storage', '数据', '数据库'],
  briefcase: ['work', 'office', 'business', '商务', '公文包'],
  smartphone: ['phone', 'mobile', '手机', '设备'],
  monitor: ['desktop', 'screen', '显示器', '设备'],
  laptop: ['notebook', '电脑', '设备'],
  tablet: ['pad', '平板'],
  mail: ['email', 'inbox', '邮件', '邮箱'],
  'message-circle': ['chat', 'comment', '消息', '聊天'],
  calendar: ['date', 'schedule', '日历', '日程'],
  clock: ['time', '时间'],
  globe: ['world', 'web', '地球', '网络'],
  shield: ['security', 'safe', '安全', '防护'],
  lock: ['secure', '锁定'],
  rocket: ['launch', 'ship', '发布', '起飞'],
  lightbulb: ['idea', 'insight', '想法', '灵感'],
  target: ['goal', 'aim', '目标'],
  'trending-up': ['growth', '增长', '上升'],
  'shopping-cart': ['buy', 'cart', '购物'],
  wallet: ['money', 'pay', '钱包', '支付'],
  'file-text': ['doc', 'document', '文档', '文件'],
  folder: ['directory', '文件夹'],
  image: ['photo', 'picture', '图片'],
  camera: ['shot', '拍照'],
  home: ['house', '主页', '首页'],
  check: ['ok', 'done', 'success', '完成', '成功'],
  'triangle-alert': ['warning', 'warn', '警告'],
  info: ['about', '提示'],
  plus: ['add', 'create', '添加'],
  'trash-2': ['delete', 'remove', '删除'],
  pencil: ['edit', 'write', '编辑'],
  download: ['save', '下载'],
  upload: ['import', '上传'],
  share: ['forward', '分享'],
  'share-2': ['forward', '分享'],
  link: ['url', 'href', '链接'],
  'map-pin': ['location', 'place', '地点', '定位'],
  building: ['office', 'company', '公司', '大楼'],
  'building-2': ['office', 'company', '公司'],
  cpu: ['chip', 'compute', '芯片'],
  server: ['host', '服务器'],
  cloud: ['saas', '云'],
  code: ['dev', 'engineer', '代码'],
  terminal: ['cli', 'shell', '终端'],
  'graduation-cap': ['learn', 'education', '教育', '毕业'],
  'paw-print': ['paw', '爪', '爪印'],
  star: ['favorite', '收藏'],
  heart: ['like', '喜欢'],
  zap: ['fast', 'energy', '闪电'],
  sparkles: ['ai', 'magic', '闪光'],
  'wand-sparkles': ['ai', 'magic', '魔法']
};

const INDEX_BY_ID = new Map(ICON_CATALOG_INDEX.map((row) => [row.id, row]));

const CATEGORIES = [...new Set(ICON_CATALOG_INDEX.map((row) => row.category))].sort();

function extraFor(id) {
  return EXTRA_ALIASES[id] || [];
}

export function tokenizeIconQuery(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^icon:/, '');
  if (!s) return [];
  const out = [];
  const parts = s.split(/[\s,;|/]+/).filter(Boolean);
  for (const part of parts) {
    if (/[\u3400-\u9fff]/.test(part)) {
      out.push(part);
      continue;
    }
    for (const tok of part.split(/[-_]+/)) {
      if (tok) out.push(tok);
    }
    if (part.includes('-')) out.push(part);
  }
  return [...new Set(out)];
}

function haystack(entry) {
  const extra = extraFor(entry.id);
  return [entry.id, entry.category, ...(entry.aliases || []), ...extra].map((s) => String(s).toLowerCase());
}

function tokenScore(tok, entry, hay) {
  const id = entry.id;
  if (id === tok) return 100;
  if (hay.includes(tok)) return 80;
  if (tok.length >= 3 && (id.startsWith(tok) || (entry.aliases || []).some((a) => a.startsWith(tok)))) return 45;
  if (tok.length >= 3 && (id.includes(tok) || hay.some((h) => h.includes(tok)))) return 22;
  return 0;
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {{ id: string, score: number, category: string, aliases: string[] }[]}
 */
export function searchIcons(query, opts = {}) {
  const limit = clampInt(opts.limit, 1, 24, 8);
  const tokens = tokenizeIconQuery(query);
  if (!tokens.length) return [];
  const scored = [];
  for (const entry of ICON_CATALOG_INDEX) {
    let score = 0;
    const hay = haystack(entry);
    for (const tok of tokens) {
      score += tokenScore(tok, entry, hay);
      if (entry.category === tok) score += 25;
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit).map(({ entry, score }) => ({
    id: entry.id,
    score,
    category: entry.category,
    aliases: [...new Set([...(entry.aliases || []), ...extraFor(entry.id)])].slice(0, 8)
  }));
}

export function resolveIconName(nameOrQuery) {
  const raw = String(nameOrQuery || '')
    .trim()
    .replace(/^icon:/, '');
  if (!raw) return { ok: false, error: 'icon needs name or query', suggestions: suggestIcons('icon', 5) };
  if (CANVAS_ICONS[raw]) return { ok: true, name: raw };
  const hits = searchIcons(raw, { limit: 5 });
  const tokens = tokenizeIconQuery(raw);
  const confident =
    hits.length &&
    (hits[0].id === raw ||
      (hits[0].score >= 80 && tokens.length <= 2) ||
      hits[0].score >= 160);
  if (confident) {
    return { ok: true, name: hits[0].id, resolvedFrom: raw };
  }
  return {
    ok: false,
    error: unknownIconError(raw, hits),
    suggestions: hits.length ? hits : suggestIcons(raw, 5)
  };
}

export function suggestIcons(raw, limit = 5) {
  const hits = searchIcons(raw, { limit });
  if (hits.length) return hits;
  return COMMON_ICON_IDS.slice(0, limit).map((id) => ({
    id,
    score: 0,
    category: INDEX_BY_ID.get(id)?.category || 'object',
    aliases: extraFor(id)
  }));
}

export function unknownIconError(name, hits) {
  const ids = (hits && hits.length ? hits : suggestIcons(name, 5)).map((h) => h.id);
  return `unknown icon "${name}" — suggestions: ${ids.join(', ')}. Search via deck act=read catalog="icons" query="${name}"`;
}

export function compactIconCatalog() {
  const byCat = {};
  for (const row of ICON_CATALOG_INDEX) {
    byCat[row.category] = (byCat[row.category] || 0) + 1;
  }
  return {
    catalog: 'icons',
    count: CANVAS_ICON_IDS.length,
    license: ICON_LICENSE,
    provider: ICON_PROVIDER,
    categories: CATEGORIES.map((id) => ({ id, count: byCat[id] || 0 })),
    common: COMMON_ICON_IDS.slice(),
    hint: 'deck act=read catalog="icons" query="协作 团队" limit=8'
  };
}

export function listIconCategories() {
  return CATEGORIES.slice();
}

export function getIconRecord(id) {
  const row = INDEX_BY_ID.get(String(id || ''));
  if (!row) return null;
  return { ...row, aliases: [...new Set([...(row.aliases || []), ...extraFor(row.id)])] };
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
