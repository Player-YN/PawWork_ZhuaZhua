/**
 * BYOK web acquire: search (Tavily default, Brave optional) + Firecrawl fetch.
 * Storage key pagewand_web_acquire. Model still only sees acquire search|fetch.
 */

export const WEB_ACQUIRE_STORAGE_KEY = 'pagewand_web_acquire';

export const SEARCH_PROVIDERS = [
  {
    id: 'tavily',
    name: 'Tavily',
    baseURL: 'https://api.tavily.com',
    keyPlaceholder: 'tvly-...'
  },
  {
    id: 'brave',
    name: 'Brave Search',
    baseURL: 'https://api.search.brave.com',
    keyPlaceholder: 'BSA...'
  }
];

export function defaultWebAcquireSettings() {
  return {
    searchProvider: 'tavily',
    tavilyKey: '',
    tavilyBaseURL: 'https://api.tavily.com',
    braveKey: '',
    firecrawlKey: '',
    firecrawlBaseURL: 'https://api.firecrawl.dev'
  };
}

function trimStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

export function normalizeWebAcquireSettings(raw = {}) {
  const d = defaultWebAcquireSettings();
  const o = raw && typeof raw === 'object' ? raw : {};
  const provider = String(o.searchProvider || d.searchProvider).toLowerCase();
  return {
    searchProvider: provider === 'brave' ? 'brave' : 'tavily',
    tavilyKey: trimStr(o.tavilyKey),
    tavilyBaseURL: trimStr(o.tavilyBaseURL, d.tavilyBaseURL).replace(/\/$/, ''),
    braveKey: trimStr(o.braveKey),
    firecrawlKey: trimStr(o.firecrawlKey),
    firecrawlBaseURL: trimStr(o.firecrawlBaseURL, d.firecrawlBaseURL).replace(/\/$/, '')
  };
}

export function searchApiConfigured(settings) {
  const s = normalizeWebAcquireSettings(settings);
  if (s.searchProvider === 'brave' && s.braveKey) return true;
  if (s.tavilyKey) return true;
  return Boolean(s.firecrawlKey);
}

export function firecrawlConfigured(settings) {
  return Boolean(normalizeWebAcquireSettings(settings).firecrawlKey);
}

export async function loadWebAcquireSettings() {
  const empty = defaultWebAcquireSettings();
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local?.get) return empty;
    const bag = await chrome.storage.local.get(WEB_ACQUIRE_STORAGE_KEY);
    return normalizeWebAcquireSettings(bag?.[WEB_ACQUIRE_STORAGE_KEY]);
  } catch {
    return empty;
  }
}

export async function saveWebAcquireSettings(patch = {}) {
  const prev = await loadWebAcquireSettings();
  const take = (key) =>
    Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : prev[key];
  const next = normalizeWebAcquireSettings({
    ...prev,
    ...patch,
    tavilyKey: take('tavilyKey'),
    braveKey: take('braveKey'),
    firecrawlKey: take('firecrawlKey')
  });
  if (typeof chrome !== 'undefined' && chrome?.storage?.local?.set) {
    await chrome.storage.local.set({ [WEB_ACQUIRE_STORAGE_KEY]: next });
  }
  return next;
}
