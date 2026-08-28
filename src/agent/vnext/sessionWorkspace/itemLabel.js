/**
 * Sticky user-facing names for bound materials.
 * Numbering is per SelectionGroup and per kind (图片 / 截图 / 表格 / 文字 / …).
 * A newly created group starts at 1. Numbers stay with the item while any of
 * that kind remain in the same group (gaps after delete). When none of that
 * kind remain in the group — including 清空选中 — the next one is 1 again.
 * Handles (image1 / screenshot1) are what the user says and what the agent resolves.
 */

import { classifyContextKind } from './pickContext.js';

export const LABEL_KINDS = ['image', 'screenshot', 'text', 'table', 'video', 'link', 'vector', 'container', 'page'];

const ZH_NOUN = {
  image: '图片',
  screenshot: '截图',
  text: '文字',
  table: '表格',
  video: '视频',
  link: '链接',
  vector: '矢量',
  container: '文字',
  page: '页面'
};

const EN_NOUN = {
  image: 'Image',
  screenshot: 'Screenshot',
  text: 'Text',
  table: 'Table',
  video: 'Video',
  link: 'Link',
  vector: 'Vector',
  container: 'Text',
  page: 'Page'
};

const KIND_ALIASES = {
  image: ['image', 'img', 'pic', 'photo', '图片', '图像', '图'],
  screenshot: ['screenshot', 'screen', 'shot', 'capture', '截图'],
  text: ['text', 'txt', '文字', '文本', '文'],
  table: ['table', 'tbl', '表格', '表'],
  video: ['video', 'vid', 'movie', 'clip', '视频', '影片', '录像', 'audio', '音频'],
  link: ['link', 'url', 'href', 'file', '链接', '文件'],
  vector: ['vector', 'svg', '矢量', '图标'],
  container: ['container', 'box', 'block', 'dom', 'other', '容器'],
  page: ['page', 'webpage', '页面', '网页']
};

export function normalizeLabelKind(kind) {
  const k = String(kind || '').toLowerCase().trim();
  if (LABEL_KINDS.includes(k)) return k;
  if (k === 'img' || k === 'picture') return 'image';
  if (k === 'svg') return 'vector';
  if (k === 'audio' || k === 'media') return 'video';
  if (k === 'url' || k === 'href' || k === 'file') return 'link';
  if (k === 'webpage' || k === 'sitepage') return 'page';
  if (k === 'dom' || k === 'other' || k === 'box') return 'text';
  return '';
}

/**
 * Classify a WebItem or raw capture into a sticky label kind.
 * @param {object} itemOrCapture
 * @param {{ source?: string }} [opts]
 */
export function classifyLabelKind(itemOrCapture = {}, opts = {}) {
  const item = itemOrCapture && typeof itemOrCapture === 'object' ? itemOrCapture : {};
  const capture = item.capture && typeof item.capture === 'object' ? item.capture : item;
  return classifyContextKind(
    {
      tag: capture.preview?.tagName || capture.tag || item.tag || '',
      src: capture.src || capture.preview?.src || item.src || '',
      href: capture.href || item.href || '',
      text: capture.text || capture.preview?.textSnippet || item.text || '',
      kindHint: item.kindHint || item.kind || capture.kindHint || capture.kind || '',
      source: opts.source || item.source || capture.sourceKind || ''
    },
    { source: opts.source }
  );
}

export function itemHandle(kind, n) {
  const k = normalizeLabelKind(kind) || 'text';
  const num = Math.max(1, Math.floor(Number(n) || 0));
  return `${k}${num}`;
}

export function formatItemLabel(kind, n, lang = 'zh') {
  const k = normalizeLabelKind(kind) || 'text';
  const num = Math.max(1, Math.floor(Number(n) || 0));
  if (lang === 'en') return `${EN_NOUN[k]} ${num}`;
  return `${ZH_NOUN[k]}${num}`;
}

export function itemAliases(kind, n) {
  const k = normalizeLabelKind(kind) || 'text';
  const num = Math.max(1, Math.floor(Number(n) || 0));
  const out = new Set([
    itemHandle(k, num),
    formatItemLabel(k, num, 'zh'),
    formatItemLabel(k, num, 'en'),
    `${ZH_NOUN[k]} ${num}`,
    `${EN_NOUN[k]}${num}`
  ]);
  for (const alias of KIND_ALIASES[k] || []) {
    out.add(`${alias}${num}`);
    out.add(`${alias} ${num}`);
  }
  return [...out];
}

/**
 * Fold user text like "图片 1" / "Image-1" / "screenshot1" into handle "image1".
 * @param {string} raw
 * @returns {string}
 */
export function normalizeItemHandle(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/[\s_\-]+/g, '');
  const replacements = [
    ['screenshot', 'screenshot'],
    ['截图', 'screenshot'],
    ['container', 'text'],
    ['容器', 'text'],
    ['vector', 'vector'],
    ['矢量', 'vector'],
    ['video', 'video'],
    ['视频', 'video'],
    ['影片', 'video'],
    ['webpage', 'page'],
    ['页面', 'page'],
    ['网页', 'page'],
    ['page', 'page'],
    ['link', 'link'],
    ['链接', 'link'],
    ['table', 'table'],
    ['表格', 'table'],
    ['text', 'text'],
    ['文字', 'text'],
    ['文本', 'text'],
    ['image', 'image'],
    ['图片', 'image'],
    ['图像', 'image'],
    ['photo', 'image'],
    ['img', 'image'],
    ['pic', 'image']
  ];
  // Longer tokens first so "screenshot" wins over "shot" if we add it later.
  replacements.sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of replacements) {
    if (s.startsWith(from)) {
      s = to + s.slice(from.length);
      break;
    }
  }
  const m = /^(image|screenshot|text|table|video|link|vector|container|page)(\d+)$/.exec(s);
  return m ? `${m[1]}${m[2]}` : '';
}

/**
 * Group that currently lists this item. Membership is the counter scope.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} webItemId
 * @returns {string}
 */
export function findItemGroupId(store, webItemId) {
  const id = String(webItemId || '');
  if (!id) return '';
  for (const gid of store.keys('groupMembers')) {
    const members = /** @type {string[]} */ (store.get('groupMembers', gid) || []);
    if (members.includes(id)) return String(gid);
  }
  return '';
}

/**
 * Highest live number for this kind in one group.
 * Unknown / empty group → 0, so the next label is 1.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} kind
 * @param {string} [groupId]
 */
export function maxLiveLabelN(store, kind, groupId) {
  const k = normalizeLabelKind(kind) || classifyLabelKind({ kindHint: kind }) || 'text';
  const gid = String(groupId || '');
  if (!gid) return 0;
  const members = /** @type {string[]} */ (store.get('groupMembers', gid) || []);
  let max = 0;
  for (const mid of members) {
    const it = store.get('items', mid);
    if (!it) continue;
    const ik = normalizeLabelKind(it.labelKind);
    if (ik !== k) continue;
    const n = Math.floor(Number(it.labelN) || 0);
    if (n > max) max = n;
  }
  return max;
}

/**
 * Next number for a kind inside one group. Gaps stay while any of that kind
 * remain in the group; when none remain, this returns 1.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} kind
 * @param {string} [groupId]
 * @returns {number}
 */
export function allocateLabelN(store, kind, groupId) {
  return maxLiveLabelN(store, kind, groupId) + 1;
}

/**
 * Attach a sticky label if missing. Existing labelKind/labelN never change.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {object} item
 * @param {{ source?: string, kind?: string, n?: number, groupId?: string }} [opts]
 * @returns {{ item: object, assigned: boolean }}
 */
export function ensureItemLabel(store, item, opts = {}) {
  if (!item || !item.webItemId) return { item, assigned: false };
  const existingKind = normalizeLabelKind(item.labelKind);
  const existingN = Number(item.labelN);
  if (existingKind && Number.isFinite(existingN) && existingN > 0) {
    return { item, assigned: false };
  }
  const kind =
    normalizeLabelKind(opts.kind) ||
    existingKind ||
    classifyLabelKind(item, { source: opts.source });
  const groupId = String(opts.groupId || '') || findItemGroupId(store, item.webItemId);
  const n =
    Number.isFinite(Number(opts.n)) && Number(opts.n) > 0
      ? Math.floor(Number(opts.n))
      : allocateLabelN(store, kind, groupId);
  const next = { ...item, labelKind: kind, labelN: n };
  store.put('items', item.webItemId, next);
  return { item: next, assigned: true };
}

export function labeledItemView(item, lang = 'zh') {
  const kind = normalizeLabelKind(item?.labelKind) || classifyLabelKind(item);
  const n = Number(item?.labelN) || 0;
  if (!n) return null;
  const snippet = String(
    item.capture?.text || item.capture?.preview?.textSnippet || item.text || ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  /** @type {{ id: string, handle: string, kind: string, label: string, snippet?: string }} */
  const view = {
    id: String(item.webItemId),
    handle: itemHandle(kind, n),
    kind,
    label: formatItemLabel(kind, n, lang)
  };
  if (kind === 'text' && snippet) view.snippet = snippet;
  if (kind === 'page') {
    const cap = item.capture && typeof item.capture === 'object' ? item.capture : item;
    const url = String(cap.url || cap.href || cap.source?.url || item.url || '').trim();
    if (url) view.url = url.length > 48 ? `${url.slice(0, 47)}…` : url;
  }
  return view;
}

/**
 * Compact bound-item index for the world block (no URLs / hashes).
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 */
export function listBoundItemIndex(store, sessionId) {
  const gids = /** @type {string[]} */ (store.get('sessionBindings', sessionId) || []);
  /** @type {object[]} */
  const out = [];
  for (const gid of gids) {
    const members = /** @type {string[]} */ (store.get('groupMembers', gid) || []);
    for (const mid of members) {
      const raw = store.get('items', mid);
      if (!raw) continue;
      const { item } = ensureItemLabel(store, raw, { groupId: gid });
      const view = labeledItemView(item);
      if (view) out.push(view);
    }
  }
  return out;
}

/**
 * Resolve a user/model ref (webItemId or image1 / 图片1 / screenshot 1) to a bound item id.
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {string} sessionId
 * @param {string} ref
 * @returns {string}
 */
export function resolveBoundItemRef(store, sessionId, ref) {
  const raw = String(ref || '').trim();
  if (!raw) return '';
  if (store.has('items', raw)) {
    const members = listBoundItemIndex(store, sessionId);
    if (members.some((m) => m.id === raw)) return raw;
  }
  const handle = normalizeItemHandle(raw);
  if (!handle) return '';
  const members = listBoundItemIndex(store, sessionId);
  const hit = members.find((m) => m.handle === handle);
  return hit ? hit.id : '';
}

export function isVisualLabelKind(kind) {
  const k = normalizeLabelKind(kind);
  return k === 'image' || k === 'screenshot' || k === 'vector';
}
