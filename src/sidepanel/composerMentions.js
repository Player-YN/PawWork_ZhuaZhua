/**
 * Composer @ mentions — candidate index for Group + sticky items.
 * DOM lives in sidepanel.js; this file is the filter/search contract.
 */

import { formatItemLabel, itemHandle, normalizeLabelKind } from '../agent/vnext/sessionWorkspace/itemLabel.js';
import { PAGES_MENTION_ID, pageRefId, normalizePageRef } from '../agent/vnext/sessionWorkspace/pageContext.js';

export const WORKSPACE_MENTION_ID = '__workspace__';
export { PAGES_MENTION_ID };

function artifactKindHint(a) {
  const mime = String(a?.mimeType || a?.mime || '').toLowerCase();
  const name = String(a?.name || '').toLowerCase();
  if (mime.includes('spreadsheet') || /\.xlsx?$|\.csv$|\.tsv$/i.test(name)) return 'sheet';
  if (mime.includes('html') || /\.html?$/i.test(name)) return 'html';
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (/\.docx?$/i.test(name) || mime.includes('word')) return 'doc';
  if (/\.pptx?$/i.test(name) || mime.includes('presentation')) return 'slides';
  return 'file';
}

/**
 * @param {Array<{
 *   groupId?: string,
 *   name?: string,
 *   itemCount?: number,
 *   items?: Array<{
 *     webItemId?: string,
 *     id?: string,
 *     labelKind?: string,
 *     kindHint?: string,
 *     kind?: string,
 *     labelN?: number,
 *     handle?: string,
 *     text?: string
 *   }>
 * }>} groups
 * @param {string[]} boundIds
 * @param {string} query
 * @param {string} [lang]
 * @param {Array<{artifactId?:string,id?:string,name?:string,mimeType?:string,mime?:string}>} [artifacts]
 * @param {Array<{url?:string,title?:string,origin?:string,current?:boolean}>} [pages]
 */
export function buildMentionCandidates(groups, boundIds, query, lang = 'zh', artifacts = [], pages = []) {
  const q = String(query || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  const bound = new Set((boundIds || []).map((id) => String(id)));
  const sorted = [...(Array.isArray(groups) ? groups : [])].sort((a, b) => {
    const ab = bound.has(String(a.groupId)) ? 0 : 1;
    const bb = bound.has(String(b.groupId)) ? 0 : 1;
    return ab - bb;
  });
  const out = [];
  for (const g of sorted) {
    const gid = String(g.groupId || '');
    if (!gid) continue;
    const isBound = bound.has(gid);
    const name = String(g.name || '').trim() || (lang === 'en' ? 'Group' : '组');
    out.push({
      kind: 'group',
      id: gid,
      groupId: gid,
      label: name,
      handle: '',
      bound: isBound,
      itemCount: Number(g.itemCount) || (Array.isArray(g.items) ? g.items.length : 0),
      itemKind: '',
      parentName: '',
      kicker:
        String(g.kind || '') === 'clipboard' || /^clipboard$|^剪切板$/i.test(name)
          ? lang === 'en'
            ? 'Clipboard'
            : '剪切板'
          : lang === 'en'
            ? 'Group'
            : '组'
    });
    for (const it of Array.isArray(g.items) ? g.items : []) {
      const itemId = String(it.webItemId || it.id || '');
      if (!itemId) continue;
      const kind = normalizeLabelKind(it.labelKind || it.kindHint || it.kind) || 'container';
      const n = Number(it.labelN) || 0;
      const handle = String(it.handle || '') || (n ? itemHandle(kind, n) : '');
      const label = n
        ? formatItemLabel(kind, n, lang === 'en' ? 'en' : 'zh')
        : String(it.text || handle || 'item').replace(/\s+/g, ' ').trim().slice(0, 24) ||
          (lang === 'en' ? 'Item' : '条目');
      out.push({
        kind: 'item',
        id: itemId,
        groupId: gid,
        label,
        handle,
        bound: isBound,
        itemCount: 0,
        itemKind: kind,
        parentName: name,
        kicker: name
      });
    }
  }
  const files = Array.isArray(artifacts) ? artifacts : [];
  if (files.length) {
    const wsLabel = lang === 'en' ? 'Workspace' : '工作区';
    out.push({
      kind: 'workspace',
      id: WORKSPACE_MENTION_ID,
      groupId: WORKSPACE_MENTION_ID,
      label: wsLabel,
      handle: '',
      bound: true,
      itemCount: files.length,
      itemKind: '',
      parentName: '',
      kicker: lang === 'en' ? 'File' : '文件'
    });
    for (const a of files) {
      const id = String(a.artifactId || a.id || '');
      if (!id) continue;
      const name = String(a.name || 'file').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
      out.push({
        kind: 'artifact',
        id,
        groupId: WORKSPACE_MENTION_ID,
        label: name,
        handle: '',
        bound: true,
        itemCount: 0,
        itemKind: artifactKindHint(a),
        parentName: wsLabel,
        kicker: artifactKindHint(a)
      });
    }
  }
  const pageList = (Array.isArray(pages) ? pages : [])
    .map((p) => {
      const ref = normalizePageRef(p);
      if (!ref) return null;
      return { ...ref, current: p?.current === true };
    })
    .filter(Boolean);
  if (pageList.length) {
    const pagesLabel = lang === 'en' ? 'Pages' : '页面';
    out.push({
      kind: 'pages',
      id: PAGES_MENTION_ID,
      groupId: PAGES_MENTION_ID,
      label: pagesLabel,
      handle: '',
      bound: true,
      itemCount: pageList.length,
      itemKind: '',
      parentName: '',
      kicker: lang === 'en' ? 'Page' : '页面'
    });
    for (const p of pageList) {
      const id = pageRefId(p);
      if (!id) continue;
      out.push({
        kind: 'page',
        id,
        groupId: PAGES_MENTION_ID,
        label: p.current ? p.host : p.title || p.host,
        handle: p.host,
        bound: true,
        itemCount: 0,
        itemKind: 'page',
        parentName: pagesLabel,
        kicker: p.current ? (lang === 'en' ? 'Current' : '当前页') : pagesLabel,
        url: p.url,
        origin: p.origin,
        title: p.title
      });
    }
  }
  if (!q) return out;
  const groupHits = new Set();
  const itemGroupHits = new Set();
  for (const c of out) {
    if (!mentionHaystack(c).includes(q)) continue;
    if (c.kind === 'group' || c.kind === 'workspace' || c.kind === 'pages') groupHits.add(c.id);
    else itemGroupHits.add(c.groupId);
  }
  return out.filter((c) => {
    if (c.kind === 'group' || c.kind === 'workspace' || c.kind === 'pages') {
      return groupHits.has(c.id) || itemGroupHits.has(c.id);
    }
    return mentionHaystack(c).includes(q) || groupHits.has(c.groupId);
  });
}

/**
 * Nest a flat candidate list into collapsible Group sections.
 * @param {ReturnType<typeof buildMentionCandidates>} flat
 */
export function nestMentionCandidates(flat) {
  /** @type {Array<{ group: object|null, items: object[] }>} */
  const sections = [];
  const byId = new Map();
  for (const c of Array.isArray(flat) ? flat : []) {
    if (c.kind === 'group' || c.kind === 'workspace' || c.kind === 'pages') {
      const row = { group: c, items: [] };
      sections.push(row);
      byId.set(String(c.id), row);
      continue;
    }
    if (c.kind !== 'item' && c.kind !== 'artifact' && c.kind !== 'page') continue;
    const gid = String(c.groupId || '');
    let row = byId.get(gid);
    if (!row) {
      row = {
        group: {
          kind: 'group',
          id: gid,
          groupId: gid,
          label: c.parentName || c.kicker || 'Group',
          handle: '',
          bound: !!c.bound,
          itemCount: 0,
          itemKind: '',
          parentName: '',
          kicker: c.kicker || ''
        },
        items: []
      };
      sections.push(row);
      byId.set(gid, row);
    }
    row.items.push(c);
  }
  return sections;
}

export function mentionHaystack(c) {
  return [c.label, c.handle, c.parentName, c.kicker, c.kind, c.itemKind, c.url, c.origin, c.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function normalizeComposerMentions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const m of raw.slice(0, 32)) {
    if (!m || typeof m !== 'object') continue;
    const kind =
      m.kind === 'item'
        ? 'item'
        : m.kind === 'artifact'
          ? 'artifact'
          : m.kind === 'page'
            ? 'page'
            : m.kind === 'skill'
              ? 'skill'
              : 'group';
    const id = String(m.id || '').slice(0, 96);
    if (!id) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind,
      id,
      groupId: String(m.groupId || (kind === 'group' ? id : '')).slice(0, 96),
      label: String(m.label || '').slice(0, 80),
      handle: String(m.handle || '').slice(0, 40),
      ...(kind === 'page' && m.url ? { url: String(m.url).slice(0, 2000) } : {})
    });
  }
  return out;
}
