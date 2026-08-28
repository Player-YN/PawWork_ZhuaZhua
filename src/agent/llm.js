/**
 * Provider settings for BYOK OpenAI-compatible HTTPS.
 * Inference goes through AI SDK (`createPageWandLanguageModel`), not this file.
 *
 *   pagewand_providers: [{ id, name, baseURL, apiKey, model, createdAt, image?, lastProbe? }]
 *   pagewand_active_provider_id: string
 * Legacy keys (pagewand_api_key / pagewand_api_base / selected_model) migrate once.
 *
 * Chat baseURL + model are chat-only. Optional provider.image is a separate
 * image-generation endpoint config (never overwrite chat base with image path).
 */

export const DEFAULT_BASE = 'https://api.deepseek.com/v1';

/** MiniMax-oriented image-gen defaults (path is relative to image base / chat origin). */
export const DEFAULT_IMAGE_PROTOCOL = 'minimax-image';
export const DEFAULT_IMAGE_PATH = '/image_generation';
export const DEFAULT_IMAGE_MODEL = 'image-01';

/** chrome.storage.local keys */
export const PROVIDERS_STORAGE_KEY = 'pagewand_providers';
export const ACTIVE_PROVIDER_ID_KEY = 'pagewand_active_provider_id';

/**
 * UI presets — fill form templates; user still edits before save.
 * Protocol is OpenAI-compatible only (chat completions shape).
 */
export const PROVIDER_PRESETS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    apiKeyPlaceholder: 'sk-...'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKeyPlaceholder: 'sk-...'
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    baseURL: '',
    model: '',
    apiKeyPlaceholder: 'sk-... / any key'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o',
    apiKeyPlaceholder: 'sk-or-...'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseURL: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-Text-01',
    apiKeyPlaceholder: 'eyJ... / API key',
    // Suggested image defaults when user enables image gen (chat base stays chat-only)
    image: {
      enabled: false,
      protocol: DEFAULT_IMAGE_PROTOCOL,
      path: DEFAULT_IMAGE_PATH,
      model: DEFAULT_IMAGE_MODEL
    }
  }
];

/**
 * @typedef {{
 *   enabled: boolean,
 *   protocol: string,
 *   baseURL?: string,
 *   apiKey?: string,
 *   path?: string,
 *   model?: string
 * }} PageWandProviderImage
 *
 * @typedef {{
 *   ok: boolean,
 *   at: number,
 *   count: number,
 *   error?: string
 * }} PageWandProviderProbe
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   baseURL: string,
 *   apiKey: string,
 *   model: string,
 *   createdAt: number,
 *   image?: PageWandProviderImage,
 *   lastProbe?: PageWandProviderProbe
 * }} PageWandProvider
 */

function normalizeLastProbe(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const at = Number(raw.at);
  const count = Number(raw.count);
  /** @type {PageWandProviderProbe} */
  const out = {
    ok: raw.ok === true,
    at: Number.isFinite(at) ? at : 0,
    count: Number.isFinite(count) && count >= 0 ? Math.round(count) : 0
  };
  if (typeof raw.error === 'string' && raw.error.trim()) out.error = raw.error.trim().slice(0, 240);
  return out;
}

/**
 * MiniMax-style image config defaults. enabled is always false unless overridden.
 * @param {Partial<PageWandProviderImage>} [overrides]
 * @returns {PageWandProviderImage}
 */
export function defaultImageConfig(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  /** @type {PageWandProviderImage} */
  const cfg = {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : false,
    protocol:
      typeof o.protocol === 'string' && o.protocol.trim()
        ? o.protocol.trim()
        : DEFAULT_IMAGE_PROTOCOL,
    path:
      typeof o.path === 'string' && o.path.trim()
        ? o.path.trim()
        : DEFAULT_IMAGE_PATH,
    model:
      typeof o.model === 'string' && o.model.trim()
        ? o.model.trim()
        : DEFAULT_IMAGE_MODEL
  };
  if (typeof o.baseURL === 'string' && o.baseURL.trim()) {
    cfg.baseURL = o.baseURL.trim().replace(/\/$/, '');
  }
  if (typeof o.apiKey === 'string' && o.apiKey.trim()) {
    cfg.apiKey = o.apiKey.trim();
  }
  return cfg;
}

/**
 * Normalize optional provider.image. Returns undefined when input is absent/invalid
 * so providers without image config stay lean.
 * @param {unknown} image
 * @returns {PageWandProviderImage|undefined}
 */
export function normalizeImageConfig(image) {
  if (image == null || typeof image !== 'object') return undefined;
  return defaultImageConfig(/** @type {Partial<PageWandProviderImage>} */ (image));
}

function hasChromeLocalStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function hasRuntimeBridge() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function';
}

/**
 * chrome.storage.local is available in the SW / sidepanel, not in offscreen.
 * Offscreen (and any other chrome.runtime-only context) goes through the SW.
 */
async function storageGet(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  if (hasChromeLocalStorage()) {
    return (await chrome.storage.local.get(list)) || {};
  }
  if (hasRuntimeBridge()) {
    const res = await chrome.runtime.sendMessage({
      target: 'pawwork-background',
      action: 'storage_local_get',
      keys: list
    });
    if (!res?.ok) throw new Error(res?.error || 'storage_local_get failed');
    return res.result || {};
  }
  return {};
}

async function storageSet(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (hasChromeLocalStorage()) {
    await chrome.storage.local.set(obj);
    return;
  }
  if (hasRuntimeBridge()) {
    const res = await chrome.runtime.sendMessage({
      target: 'pawwork-background',
      action: 'storage_local_set',
      values: obj
    });
    if (!res?.ok) throw new Error(res?.error || 'storage_local_set failed');
  }
}

/** @returns {string} */
export function generateProviderId() {
  return `prov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize one provider record.
 * Chat fields (baseURL, model) stay chat-only. Optional `image` is preserved/normalized.
 * @param {Partial<PageWandProvider>} p
 * @returns {PageWandProvider|null}
 */
export function normalizeProvider(p) {
  if (!p || typeof p !== 'object') return null;
  const id = typeof p.id === 'string' && p.id ? p.id : generateProviderId();
  const name = (typeof p.name === 'string' && p.name.trim()) || 'Provider';
  const baseURL = typeof p.baseURL === 'string' ? p.baseURL.trim().replace(/\/$/, '') : '';
  const apiKey = typeof p.apiKey === 'string' ? p.apiKey : '';
  const model = typeof p.model === 'string' ? p.model.trim() : '';
  const createdAt =
    typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : Date.now();
  /** @type {PageWandProvider} */
  const out = { id, name, baseURL, apiKey, model, createdAt };
  const image = normalizeImageConfig(/** @type {any} */ (p).image);
  if (image) out.image = image;
  const lastProbe = normalizeLastProbe(/** @type {any} */ (p).lastProbe);
  if (lastProbe) out.lastProbe = lastProbe;
  return out;
}

/**
 * Migrate legacy single-key settings → pagewand_providers once.
 * Also ensures active id is valid when providers exist.
 * @returns {Promise<{ providers: PageWandProvider[], activeProviderId: string|null, active: PageWandProvider|null, migrated: boolean }>}
 */
export async function loadProvidersState() {
  const res = await storageGet([
    PROVIDERS_STORAGE_KEY,
    ACTIVE_PROVIDER_ID_KEY,
    'pagewand_api_key',
    'pagewand_api_base',
    'selected_model',
    'DEEPSEEK_API_KEY'
  ]);

  let providers = Array.isArray(res[PROVIDERS_STORAGE_KEY])
    ? res[PROVIDERS_STORAGE_KEY].map(normalizeProvider).filter(Boolean)
    : [];
  let activeProviderId =
    typeof res[ACTIVE_PROVIDER_ID_KEY] === 'string' ? res[ACTIVE_PROVIDER_ID_KEY] : null;
  let migrated = false;

  // Migration: old single-key / base / model → one "DeepSeek" provider
  if (providers.length === 0) {
    const oldKey = res.pagewand_api_key || res.DEEPSEEK_API_KEY || '';
    const hasLegacy =
      !!oldKey ||
      !!res.pagewand_api_base ||
      !!res.selected_model ||
      !!res.DEEPSEEK_API_KEY;

    if (hasLegacy) {
      const id = generateProviderId();
      const legacy = normalizeProvider({
        id,
        name: 'DeepSeek',
        baseURL: res.pagewand_api_base || DEFAULT_BASE,
        apiKey: oldKey,
        model: res.selected_model || 'deepseek-v4-flash',
        createdAt: Date.now()
      });
      providers = [legacy];
      activeProviderId = id;
      migrated = true;
      await storageSet({
        [PROVIDERS_STORAGE_KEY]: providers,
        [ACTIVE_PROVIDER_ID_KEY]: activeProviderId
      });
    }
  }

  if (activeProviderId && !providers.some((p) => p.id === activeProviderId)) {
    activeProviderId = providers[0]?.id || null;
    migrated = true;
    await storageSet({ [ACTIVE_PROVIDER_ID_KEY]: activeProviderId });
  }

  if (!activeProviderId && providers.length > 0) {
    activeProviderId = providers[0].id;
    migrated = true;
    await storageSet({ [ACTIVE_PROVIDER_ID_KEY]: activeProviderId });
  }

  const active = providers.find((p) => p.id === activeProviderId) || null;
  return { providers, activeProviderId, active, migrated };
}

/**
 * Persist providers list + optional active id. Also mirrors legacy keys from active provider
 * so older readers / status badges stay consistent.
 * @param {PageWandProvider[]} providers
 * @param {string|null} [activeProviderId]
 */
export async function saveProvidersState(providers, activeProviderId) {
  const list = (Array.isArray(providers) ? providers : []).map(normalizeProvider).filter(Boolean);
  let activeId =
    activeProviderId !== undefined
      ? activeProviderId
      : (await storageGet([ACTIVE_PROVIDER_ID_KEY]))[ACTIVE_PROVIDER_ID_KEY] || null;

  if (activeId && !list.some((p) => p.id === activeId)) {
    activeId = list[0]?.id || null;
  }
  if (!activeId && list.length > 0) activeId = list[0].id;

  const active = list.find((p) => p.id === activeId) || null;
  /** @type {Record<string, unknown>} */
  const toStore = {
    [PROVIDERS_STORAGE_KEY]: list,
    [ACTIVE_PROVIDER_ID_KEY]: activeId
  };

  // Mirror active provider → legacy keys (backward compatible)
  if (active) {
    if (active.apiKey) {
      toStore.pagewand_api_key = active.apiKey;
      toStore.DEEPSEEK_API_KEY = active.apiKey;
    }
    if (active.baseURL) {
      toStore.pagewand_api_base = active.baseURL.replace(/\/$/, '');
    }
    if (active.model) {
      toStore.selected_model = active.model;
    }
  }

  await storageSet(toStore);
  return { providers: list, activeProviderId: activeId, active };
}

/**
 * Set active provider by id (must already exist).
 * @param {string} providerId
 */
export async function setActiveProviderId(providerId) {
  const { providers } = await loadProvidersState();
  if (!providers.some((p) => p.id === providerId)) {
    throw new Error('PROVIDER_NOT_FOUND');
  }
  return saveProvidersState(providers, providerId);
}

/**
 * Switch chat model on an existing provider without re-entering Base URL / API key.
 * @param {string} modelId
 * @param {{ providerId?: string|null }} [opts]
 */
export async function setActiveProviderModel(modelId, opts = {}) {
  const id = String(modelId || '').trim();
  if (!id) throw new Error('MODEL_REQUIRED');
  const { providers, activeProviderId } = await loadProvidersState();
  const targetId = String(opts.providerId || activeProviderId || '').trim();
  const idx = providers.findIndex((p) => p.id === targetId);
  if (idx < 0) {
    await storageSet({ selected_model: id });
    return { providers, activeProviderId, active: null, model: id };
  }
  providers[idx] = { ...providers[idx], model: id };
  return saveProvidersState(providers, targetId);
}

/**
 * Insert or update a provider; optionally make it active.
 * @param {Partial<PageWandProvider>} provider
 * @param {{ makeActive?: boolean }} [opts]
 */
export async function upsertProvider(provider, opts = {}) {
  const { providers, activeProviderId } = await loadProvidersState();
  const next = normalizeProvider(provider);
  if (!next) throw new Error('INVALID_PROVIDER');
  const idx = providers.findIndex((p) => p.id === next.id);
  // Preserve existing API key when UI sends empty (user left field blank = keep)
  if (idx >= 0) {
    if (!next.apiKey && providers[idx].apiKey) {
      next.apiKey = providers[idx].apiKey;
    }
    // Preserve image config when caller omits `image` (partial chat-only updates)
    if (next.image === undefined && providers[idx].image) {
      next.image = providers[idx].image;
    }
    if (next.lastProbe === undefined && providers[idx].lastProbe) {
      next.lastProbe = providers[idx].lastProbe;
    }
    if (!next.createdAt) next.createdAt = providers[idx].createdAt;
    providers[idx] = next;
  } else {
    providers.push(next);
  }
  const makeActive = opts.makeActive !== false;
  const newActive = makeActive ? next.id : activeProviderId;
  return saveProvidersState(providers, newActive);
}

/**
 * Delete a provider. If it was active, activate the first remaining.
 * @param {string} providerId
 */
export async function deleteProvider(providerId) {
  const { providers, activeProviderId } = await loadProvidersState();
  const list = providers.filter((p) => p.id !== providerId);
  let newActive = activeProviderId;
  if (activeProviderId === providerId) {
    newActive = list[0]?.id || null;
  }
  return saveProvidersState(list, newActive);
}

/**
 * Load LLM settings from chrome.storage.local (active OpenAI-compatible provider).
 * @returns {Promise<{
 *   apiKey: string,
 *   apiBase: string,
 *   model: string,
 *   providerId: string|null,
 *   providerName: string,
 *   providers: PageWandProvider[],
 *   activeProviderId: string|null
 * }>}
 */
export async function loadLlmSettings() {
  const { providers, activeProviderId, active } = await loadProvidersState();

  if (active) {
    return {
      apiKey: active.apiKey || '',
      apiBase: (active.baseURL || DEFAULT_BASE).replace(/\/$/, ''),
      model: active.model || 'deepseek-v4-flash',
      providerId: active.id,
      providerName: active.name || 'Provider',
      providers,
      activeProviderId,
      /** Optional image-gen config (chat baseURL stays separate). */
      image: active.image || undefined
    };
  }

  // No providers yet (fresh install): fall back to legacy keys if any
  const res = await storageGet([
    'pagewand_api_key',
    'pagewand_api_base',
    'selected_model',
    'DEEPSEEK_API_KEY'
  ]);
  return {
    apiKey: res.pagewand_api_key || res.DEEPSEEK_API_KEY || '',
    apiBase: (res.pagewand_api_base || DEFAULT_BASE).replace(/\/$/, ''),
    model: res.selected_model || 'deepseek-v4-flash',
    providerId: null,
    providerName: '',
    providers: [],
    activeProviderId: null,
    image: undefined
  };
}
