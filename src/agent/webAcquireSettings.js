import { isSafeByokEndpointUrl } from './safeEndpointUrl.js';

/**
 * Web acquire: search (Tavily default, Brave optional) + Firecrawl fetch + STT.
 * Storage key pagewand_web_acquire. Model sees acquire search|fetch|transcribe.
 */

export const WEB_ACQUIRE_STORAGE_KEY = 'pagewand_web_acquire';

export const DEFAULT_STT_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_STT_MODEL = 'whisper-large-v3';

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

/**
 * STT presets. Groq / custom use OpenAI POST {base}/audio/transcriptions.
 * 千问 uses DashScope compatible-mode chat + input_audio.
 * 豆包 uses 火山方舟 Responses + input_audio.
 * 讯飞 uses raasr upload/getResult (HMAC; key = appId:secretKey).
 */
export const STT_PROVIDERS = [
  {
    id: 'groq',
    name: 'Groq',
    baseURL: DEFAULT_STT_BASE_URL,
    model: DEFAULT_STT_MODEL,
    protocol: 'openai-transcriptions',
    probe: 'models',
    keyPlaceholder: 'gsk_...'
  },
  {
    id: 'iflytek',
    name: '讯飞',
    baseURL: 'https://raasr.xfyun.cn/v2/api',
    model: 'ifasr',
    protocol: 'iflytek-raasr',
    probe: 'iflytek',
    keyPlaceholder: 'appId:secretKey'
  },
  {
    id: 'doubao',
    name: '豆包',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-0-lite-260428',
    protocol: 'ark-responses',
    probe: 'models',
    keyPlaceholder: 'ak-...'
  },
  {
    id: 'qwen',
    name: '千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-asr-flash',
    protocol: 'dashscope-chat-asr',
    probe: 'models',
    keyPlaceholder: 'sk-...'
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI-compatible',
    baseURL: DEFAULT_STT_BASE_URL,
    model: DEFAULT_STT_MODEL,
    protocol: 'openai-transcriptions',
    probe: 'models',
    keyPlaceholder: 'sk-...'
  }
];

const STT_PROVIDER_IDS = new Set(STT_PROVIDERS.map((row) => row.id));

export function findSttProvider(id) {
  return STT_PROVIDERS.find((row) => row.id === String(id || '')) || null;
}

export function inferSttProtocol(providerId, baseURL) {
  const id = String(providerId || '').toLowerCase();
  let host = '';
  try {
    host = new URL(String(baseURL || '')).hostname.toLowerCase();
  } catch {
    host = '';
  }
  if (id === 'iflytek' || /raasr\.xfyun|xf-yun\.com|xfyun\.cn/.test(host)) return 'iflytek-raasr';
  if (id === 'doubao' || /volces\.com|openspeech\.bytedance/.test(host)) return 'ark-responses';
  if (id === 'qwen' || /dashscope\.aliyuncs/.test(host)) return 'dashscope-chat-asr';
  return 'openai-transcriptions';
}

export function defaultWebAcquireSettings() {
  return {
    searchProvider: 'tavily',
    tavilyKey: '',
    tavilyBaseURL: 'https://api.tavily.com',
    braveKey: '',
    firecrawlKey: '',
    firecrawlBaseURL: 'https://api.firecrawl.dev',
    sttProvider: 'groq',
    sttKey: '',
    sttBaseURL: DEFAULT_STT_BASE_URL,
    sttModel: DEFAULT_STT_MODEL
  };
}

function trimStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function safeAcquireBase(raw, fallback) {
  const d = String(fallback || '').replace(/\/$/, '');
  const s = trimStr(raw, d).replace(/\/$/, '');
  return isSafeByokEndpointUrl(s) ? s : d;
}

export function normalizeWebAcquireSettings(raw = {}) {
  const d = defaultWebAcquireSettings();
  const o = raw && typeof raw === 'object' ? raw : {};
  const provider = String(o.searchProvider || d.searchProvider).toLowerCase();
  const sttProviderRaw = String(o.sttProvider || d.sttProvider).toLowerCase();
  const sttProvider = STT_PROVIDER_IDS.has(sttProviderRaw) ? sttProviderRaw : 'groq';
  const preset = findSttProvider(sttProvider) || findSttProvider('groq');
  return {
    searchProvider: provider === 'brave' ? 'brave' : 'tavily',
    tavilyKey: trimStr(o.tavilyKey),
    tavilyBaseURL: safeAcquireBase(o.tavilyBaseURL, d.tavilyBaseURL),
    braveKey: trimStr(o.braveKey),
    firecrawlKey: trimStr(o.firecrawlKey),
    firecrawlBaseURL: safeAcquireBase(o.firecrawlBaseURL, d.firecrawlBaseURL),
    sttProvider,
    sttKey: trimStr(o.sttKey),
    sttBaseURL: safeAcquireBase(o.sttBaseURL, preset?.baseURL || d.sttBaseURL),
    sttModel: trimStr(o.sttModel, preset?.model || d.sttModel)
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

export function sttConfigured(settings) {
  return Boolean(normalizeWebAcquireSettings(settings).sttKey);
}

export function sttModelsUrl(baseURL) {
  const root = String(baseURL || DEFAULT_STT_BASE_URL).replace(/\/$/, '');
  return `${root}/models`;
}

export function sttTranscriptionUrl(baseURL) {
  const root = String(baseURL || DEFAULT_STT_BASE_URL).replace(/\/$/, '');
  return `${root}/audio/transcriptions`;
}

/** Cheap probe URL. 讯飞 signs getResult in transcribe.buildSttProbeRequest. */
export function sttProbeUrl(baseURL, providerId) {
  const protocol = inferSttProtocol(providerId, baseURL);
  const root = String(baseURL || DEFAULT_STT_BASE_URL).replace(/\/$/, '');
  if (protocol === 'iflytek-raasr') return `${root}/getResult`;
  return `${root}/models`;
}

export function sttAuthHeaders(apiKey) {
  return {
    Authorization: `Bearer ${String(apiKey || '').trim()}`,
    Accept: 'application/json'
  };
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

/** GET credit-usage: v2 first, then v1. */
export function firecrawlCreditUsageUrls(baseURL) {
  const root = String(baseURL || 'https://api.firecrawl.dev').replace(/\/$/, '');
  return [`${root}/v2/team/credit-usage`, `${root}/v1/team/credit-usage`];
}

export function firecrawlAuthHeaders(apiKey) {
  return {
    Authorization: `Bearer ${String(apiKey || '').trim()}`,
    Accept: 'application/json'
  };
}

/**
 * Parse Firecrawl team credit-usage JSON.
 * @returns {{ ok: boolean, remaining: number|null, plan: number|null }}
 */
export function summarizeFirecrawlCreditUsage(json) {
  const data =
    json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  if (!data || typeof data !== 'object') return { ok: false, remaining: null, plan: null };
  const remainingRaw = data.remainingCredits ?? data.remaining_credits;
  const planRaw = data.planCredits ?? data.plan_credits;
  const remaining = Number(remainingRaw);
  const plan = Number(planRaw);
  const hasRemaining = Number.isFinite(remaining);
  const failed = json && json.success === false;
  return {
    ok: !failed && hasRemaining,
    remaining: hasRemaining ? remaining : null,
    plan: Number.isFinite(plan) ? plan : null
  };
}

export function tavilySearchProbeUrl(baseURL) {
  const root = String(baseURL || 'https://api.tavily.com').replace(/\/$/, '');
  return `${root}/search`;
}

export function tavilySearchProbeBody(apiKey) {
  return {
    api_key: String(apiKey || '').trim(),
    query: 'ping',
    max_results: 1,
    search_depth: 'basic'
  };
}

export function braveSearchProbeUrl(baseURL) {
  const root = String(baseURL || 'https://api.search.brave.com').replace(/\/$/, '');
  return `${root}/res/v1/web/search?q=ping&count=1`;
}

export function braveSearchProbeHeaders(apiKey) {
  return {
    Accept: 'application/json',
    'X-Subscription-Token': String(apiKey || '').trim()
  };
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
    firecrawlKey: take('firecrawlKey'),
    sttKey: take('sttKey')
  });
  if (typeof chrome !== 'undefined' && chrome?.storage?.local?.set) {
    await chrome.storage.local.set({ [WEB_ACQUIRE_STORAGE_KEY]: next });
  }
  return next;
}
