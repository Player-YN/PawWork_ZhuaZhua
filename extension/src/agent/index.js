/**
 * Paw Work agent public entry — Web Workspace Runtime (product).
 * Product loop: sidepanel → background → offscreen SessionWorkspaceService.
 * LLM/settings: src/agent/llm.js (BYOK cloud API)
 */

export * from './vnext/index.js';

export {
  loadLlmSettings,
  loadProvidersState,
  saveProvidersState,
  upsertProvider,
  deleteProvider,
  setActiveProviderId,
  setActiveProviderModel,
  setActiveProviderImageModel,
  applyProviderImageModel,
  generateProviderId,
  normalizeProvider,
  normalizeImageConfig,
  defaultImageConfig,
  PROVIDER_PRESETS,
  PROVIDERS_STORAGE_KEY,
  ACTIVE_PROVIDER_ID_KEY,
  DEFAULT_BASE,
  OPENROUTER_API_BASE,
  DEFAULT_IMAGE_PROTOCOL,
  DEFAULT_IMAGE_PATH,
  DEFAULT_IMAGE_MODEL
} from './llm.js';
