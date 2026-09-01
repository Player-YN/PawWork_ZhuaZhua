/**
 * First-class URL / page capture items (页面N).
 * User-owned only — no model tool writes groups.
 */

import { addWebItem, listGroupItems } from './groups.js';
import {
  ensureItemLabel,
  normalizeLabelKind,
  resolveBoundItemRef
} from './itemLabel.js';
import { isHttpPageUrl } from './pageContext.js';
import { pageTextByCodePoint } from './textPage.js';

export const PAGE_ITEM_CAP = 30;
export const PAGE_URL_DISPLAY_MAX = 48;
export const PAGE_KIND = 'page';

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAIL_PUNCT_RE = /[),.;:!?，。；：！？]+$/;

/**
 * Canonical compare key for dedupe + tab match.
 * Host + path (no trailing slash) + search + hash.
 */
export function normalizePageUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}${u.hash}`;
  } catch {
    return '';
  }
}

export function parseHttpUrls(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const found = [];
  const seen = new Set();
  const matches = raw.match(URL_IN_TEXT_RE) || [];
  for (const m of matches) {
    const cleaned = String(m).replace(TRAIL_PUNCT_RE, '');
    const key = normalizePageUrl(cleaned);
    if (!key || seen.has(key) || !isHttpPageUrl(key)) continue;
    seen.add(key);
    found.push(key);
  }
  return found;
}

/** All valid http(s) URLs in order, including repeats (for 去重 counts). */
export function collectHttpUrls(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const found = [];
  const matches = raw.match(URL_IN_TEXT_RE) || [];
  for (const m of matches) {
    const cleaned = String(m).replace(TRAIL_PUNCT_RE, '');
    const key = normalizePageUrl(cleaned);
    if (!key || !isHttpPageUrl(key)) continue;
    found.push(key);
  }
  return found;
}

export function truncateDisplayUrl(url, max = PAGE_URL_DISPLAY_MAX) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  const keep = Math.max(8, max - 1);
  return `${s.slice(0, keep)}…`;
}

export function pageUrlOf(item) {
  if (!item || typeof item !== 'object') return '';
  const cap = item.capture && typeof item.capture === 'object' ? item.capture : item;
  return normalizePageUrl(
    cap.url || cap.href || cap.source?.url || item.url || item.href || item.pageUrl || ''
  );
}

export function isPageItem(item) {
  if (!item || typeof item !== 'object') return false;
  const kind = normalizeLabelKind(item.labelKind || item.kindHint || item.kind || item.capture?.kindHint);
  if (kind === PAGE_KIND) return true;
  return Boolean(item.capture?.source?.addedBy) && Boolean(pageUrlOf(item));
}

export function countPageItems(store, groupId) {
  return listGroupItems(store, groupId).filter(isPageItem).length;
}

export function findPageItemByUrl(store, groupId, url) {
  const key = normalizePageUrl(url);
  if (!key) return null;
  for (const it of listGroupItems(store, groupId)) {
    if (!isPageItem(it)) continue;
    if (pageUrlOf(it) === key) return it;
  }
  return null;
}

/**
 * @param {object} [raw]
 * @returns {{ url: string, title: string, favicon: string, addedBy: string, addedAt: number }|null}
 */
export function normalizePagePayload(raw = {}, opts = {}) {
  const url = normalizePageUrl(raw.url || raw.href || raw);
  if (!url) return null;
  const addedBy = String(raw.addedBy || opts.addedBy || 'paste').toLowerCase();
  const source =
    addedBy === 'current-tab' || addedBy === 'page-click' || addedBy === 'paste' ? addedBy : 'paste';
  return {
    url,
    title: String(raw.title || raw.text || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    favicon: String(raw.favicon || raw.icon || '').trim().slice(0, 2000),
    addedBy: source,
    addedAt: Number(raw.addedAt) || Date.now()
  };
}

/**
 * Add URL items to a group. Dedupes identical URLs (returns focusedId).
 * Caps at PAGE_ITEM_CAP. Never a model-tool surface.
 *
 * @returns {{
 *   added: object[],
 *   addedCount: number,
 *   duplicates: number,
 *   capped: number,
 *   focusedId: string,
 *   notice: string,
 *   pageCount: number
 * }}
 */
export function addPageItems(store, groupId, rawList, opts = {}) {
  if (!store.has('groups', groupId)) throw new Error(`unknown group ${groupId}`);
  /** @type {object[]} */
  let payloads = [];
  let duplicates = 0;
  if (typeof rawList === 'string') {
    const collected = collectHttpUrls(rawList);
    const seenPaste = new Set();
    for (const url of collected) {
      if (seenPaste.has(url)) {
        duplicates += 1;
        continue;
      }
      seenPaste.add(url);
      const row = normalizePagePayload({ url }, opts);
      if (row) payloads.push(row);
    }
  } else if (Array.isArray(rawList)) {
    payloads = rawList.map((row) =>
      typeof row === 'string' ? normalizePagePayload({ url: row }, opts) : normalizePagePayload(row, opts)
    );
  } else if (rawList && typeof rawList === 'object') {
    payloads = [normalizePagePayload(rawList, opts)];
  }
  payloads = payloads.filter(Boolean);

  let capped = 0;
  let focusedId = '';
  const added = [];
  let live = countPageItems(store, groupId);

  for (const payload of payloads) {
    const existing = findPageItemByUrl(store, groupId, payload.url);
    if (existing) {
      duplicates += 1;
      if (!focusedId) focusedId = existing.webItemId;
      continue;
    }
    if (live >= PAGE_ITEM_CAP) {
      capped += 1;
      continue;
    }
    const item = addWebItem(store, groupId, {
      kindHint: PAGE_KIND,
      labelKind: PAGE_KIND,
      url: payload.url,
      href: payload.url,
      title: payload.title,
      text: payload.title,
      favicon: payload.favicon || undefined,
      source: {
        addedBy: payload.addedBy,
        addedAt: payload.addedAt,
        url: payload.url,
        title: payload.title,
        favicon: payload.favicon || undefined
      },
      preview: {
        tagName: 'page',
        textSnippet: payload.title || payload.url
      }
    });
    const labeled = ensureItemLabel(store, item, { kind: PAGE_KIND, groupId }).item;
    added.push(labeled);
    live += 1;
    if (!focusedId) focusedId = labeled.webItemId;
  }

  let notice = '';
  if (capped > 0) notice = `本组最多 ${PAGE_ITEM_CAP} 个链接`;
  return {
    added,
    addedCount: added.length,
    duplicates,
    capped,
    focusedId,
    notice,
    pageCount: live
  };
}

export function formatPageAddSummary(result, lang = 'zh') {
  const added = Number(result?.addedCount) || 0;
  const dup = Number(result?.duplicates) || 0;
  const cap = Number(result?.capped) || 0;
  if (lang === 'en') {
    const parts = [`Added ${added} link${added === 1 ? '' : 's'}`];
    if (dup) parts.push(`deduped ${dup}`);
    if (cap) parts.push(`cap ${PAGE_ITEM_CAP}`);
    return parts.join(', ');
  }
  const parts = [`已添加 ${added} 个链接`];
  if (dup) parts.push(`去重 ${dup}`);
  if (cap) parts.push(`已达上限`);
  return parts.join('，');
}

/**
 * Resolve acquire fetch url: raw http(s) or 页面N / pageN / wi_…
 * Full URL is returned; display truncation happens only in the world block.
 */
export function resolvePageUrlAlias(store, sessionId, ref) {
  const raw = String(ref || '').trim();
  if (!raw) return { ok: false, url: '', itemId: '', via: '' };
  const asUrl = normalizePageUrl(raw);
  if (asUrl) return { ok: true, url: asUrl, itemId: '', via: 'url' };
  const itemId = resolveBoundItemRef(store, sessionId, raw);
  if (!itemId) return { ok: false, url: '', itemId: '', via: '' };
  const item = store.get('items', itemId);
  const url = pageUrlOf(item);
  if (!url) return { ok: false, url: '', itemId, via: 'item' };
  return { ok: true, url, itemId, via: 'alias' };
}

function htmlToPlain(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromPageCapture(raw, url) {
  if (!raw || typeof raw !== 'object') return '';
  const title = String(raw.title || '').trim();
  const html = String(raw.html || raw.outerHTML || raw.content || '');
  const plain = String(raw.text || raw.preview || '').trim() || htmlToPlain(html);
  return [title || url, plain].filter(Boolean).join('\n\n');
}

/**
 * Tab-first: open tab (normalized URL) → content-script page path;
 * otherwise caller falls back to acquire fetch.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   url: string,
 *   itemId?: string,
 *   via?: string,
 *   pathUsed?: 'content-script'|'fetch',
 *   tabId?: number,
 *   path?: string,
 *   preview?: string,
 *   truncated?: boolean,
 *   mediaType?: string,
 *   bytes?: number,
 *   source?: string,
 *   action?: string,
 *   error?: string,
 *   code?: string
 * }>}
 */
export async function resolveAcquireFetch(ctx, input = {}) {
  const raw = String(input.url || input.item || input.handle || input.itemId || '').trim();
  const aliased = resolvePageUrlAlias(ctx.store, ctx.sessionId, raw);
  if (!aliased.ok) {
    return {
      ok: false,
      action: 'fetch',
      code: raw ? 'UNRESOLVED_URL' : 'MISSING_URL',
      error: raw ? 'fetch url is not a public http(s) URL or bound page alias' : 'fetch needs url'
    };
  }

  const url = aliased.url;
  const findTab = typeof ctx.hostFindTab === 'function' ? ctx.hostFindTab : null;
  const capture = typeof ctx.hostPageCapture === 'function' ? ctx.hostPageCapture : null;
  if (findTab && capture) {
    try {
      const tab = await findTab(url);
      const tabId = Number(tab?.tabId ?? tab?.id);
      const tabUrl = normalizePageUrl(tab?.url || '');
      if (tab && tab.ok !== false && Number.isFinite(tabId) && tabId > 0 && (!tabUrl || tabUrl === url)) {
        const rawPage = await capture({ tabId, url: tab.url || url });
        if (rawPage && rawPage.ok !== false && (rawPage.html || rawPage.text || rawPage.outerHTML)) {
          const body = textFromPageCapture(rawPage, url);
          const page = pageTextByCodePoint(body, 0, 12000);
          const fs = ctx.fs;
          if (fs && typeof fs.writeFile === 'function') {
            try {
              if (typeof fs.mkdirp === 'function') fs.mkdirp('/scratch/sources');
              else if (typeof fs.mkdir === 'function') await fs.mkdir('/scratch/sources');
            } catch {
              /* dir may exist */
            }
            const path = `/scratch/sources/tab_${Date.now().toString(36)}.txt`;
            const bytes = new TextEncoder().encode(body);
            await fs.writeFile(path, bytes);
            return {
              ok: true,
              action: 'fetch',
              url,
              itemId: aliased.itemId || undefined,
              via: aliased.via,
              path,
              mediaType: 'text/plain',
              bytes: bytes.byteLength,
              preview: page.content,
              truncated: page.truncated,
              source: 'tab',
              pathUsed: 'content-script',
              tabId
            };
          }
        }
      }
    } catch {
      /* fall through to fetch */
    }
  }

  return {
    ok: true,
    url,
    itemId: aliased.itemId || undefined,
    via: aliased.via,
    pathUsed: 'fetch',
    deferFetch: true
  };
}
