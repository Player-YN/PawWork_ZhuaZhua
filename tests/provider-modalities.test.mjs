import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChatProvider,
  isImageOnlyProvider,
  isImageProvider,
  listChatProviders,
  listImageProviders,
  resolveActiveImageProvider,
  imageVendorLabel,
  normalizeProvider,
  applyProviderImageModel
} from '../src/agent/llm.js';

test('image-only purpose is not a chat provider', () => {
  const image = normalizeProvider({
    id: 'img1',
    purpose: 'image',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: '',
    image: { enabled: true, protocol: 'openrouter-image', model: 'google/gemini-2.5-flash-image' }
  });
  assert.equal(isImageOnlyProvider(image), true);
  assert.equal(isChatProvider(image), false);
  assert.equal(isImageProvider(image), true);
  assert.equal(imageVendorLabel(image), 'OpenRouter');
});

test('chat provider with nested image appears in both lists', () => {
  const chat = normalizeProvider({
    id: 'c1',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test',
    model: 'deepseek-v4-flash',
    image: {
      enabled: true,
      protocol: 'openrouter-image',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-2.5-flash-image'
    }
  });
  assert.equal(isChatProvider(chat), true);
  assert.equal(isImageOnlyProvider(chat), false);
  assert.equal(isImageProvider(chat), true);
  const providers = [chat, normalizeProvider({ id: 'c2', name: 'OR', baseURL: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o' })];
  assert.deepEqual(listChatProviders(providers).map((p) => p.id), ['c1', 'c2']);
  assert.deepEqual(listImageProviders(providers).map((p) => p.id), ['c1']);
  assert.equal(imageVendorLabel(chat), 'OpenRouter');
});

test('active image id stays independent of the chat vendor', () => {
  const chat = normalizeProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash'
  });
  const image = normalizeProvider({
    id: 'or-img',
    purpose: 'image',
    name: 'OpenRouter',
    image: { enabled: true, protocol: 'openrouter-image', model: 'flux' }
  });
  const none = resolveActiveImageProvider([chat], 'or-img');
  assert.equal(none.activeImageProviderId, null);
  const hit = resolveActiveImageProvider([chat, image], 'or-img');
  assert.equal(hit.activeImageProviderId, 'or-img');
  const fallback = resolveActiveImageProvider([chat, image], 'missing');
  assert.equal(fallback.activeImageProviderId, 'or-img');
});

test('applyProviderImageModel does not change the chat model', () => {
  const next = applyProviderImageModel(
    { id: 'p', model: 'deepseek-v4-flash', image: { enabled: true, model: 'old' } },
    'google/gemini-2.5-flash-image'
  );
  assert.equal(next.model, 'deepseek-v4-flash');
  assert.equal(next.image.model, 'google/gemini-2.5-flash-image');
  assert.equal(next.image.enabled, true);
});
