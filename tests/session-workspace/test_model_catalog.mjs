import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseModelsResponse,
  shrinkModelList,
  isLikelyNonChatModel,
  isLikelyImageGenModel,
  hasImageOutputModality,
  imageModelsFromList,
  chatModelsFromList,
  modelsEndpointURL,
  probeOpenAICompatibleApi,
  isVisionCapableModel,
  classifyChatVisionCapability,
  isKnownTextOnlyChatModel,
  normalizeChatModelId
} from '../../src/agent/modelCatalog.js';
import { normalizeProvider, setActiveProviderModel } from '../../src/agent/llm.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const parsed = parseModelsResponse({
  data: [
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'text-embedding-3-small' },
    { id: 'anthropic/claude-sonnet-4' }
  ]
});
assert.equal(parsed.some((m) => m.id === 'text-embedding-3-small'), false);
assert.ok(parsed.some((m) => m.id === 'openai/gpt-4o'));
assert.ok(parsed.some((m) => m.id === 'anthropic/claude-sonnet-4'));
assert.equal(isLikelyNonChatModel('text-embedding-3-large'), true);
assert.equal(isLikelyNonChatModel('openai/gpt-4o'), false);
assert.equal(isLikelyImageGenModel('google/gemini-2.5-flash-image'), true);
assert.equal(
  isLikelyImageGenModel('black-forest-labs/flux.2-pro', {
    architecture: { output_modalities: ['image'] }
  }),
  true
);
assert.equal(isLikelyImageGenModel('openai/gpt-4o'), false);
assert.equal(
  hasImageOutputModality({
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }
  }),
  false
);
assert.equal(
  isLikelyImageGenModel('openai/gpt-4o', {
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }
  }),
  false
);
assert.equal(
  isLikelyImageGenModel('some-vlm-image-preview', {
    architecture: { input_modalities: ['image'], output_modalities: ['text'] }
  }),
  false
);
assert.equal(
  isLikelyImageGenModel('google/gemini-2.5-flash-image', {
    architecture: { output_modalities: ['text', 'image'] }
  }),
  true
);
const mixed = parseModelsResponse({
  data: [
    { id: 'openai/gpt-4o' },
    { id: 'google/gemini-2.5-flash-image' },
    {
      id: 'black-forest-labs/flux.2-pro',
      architecture: { output_modalities: ['image'] }
    }
  ]
});
assert.ok(imageModelsFromList(mixed).some((m) => m.id.includes('flash-image')));
assert.ok(chatModelsFromList(mixed).some((m) => m.id === 'openai/gpt-4o'));
assert.equal(chatModelsFromList(mixed).some((m) => m.image), false);
assert.equal(modelsEndpointURL('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1/models');

const many = Array.from({ length: 80 }, (_, i) => ({ id: `m-${String(i).padStart(2, '0')}` }));
const shrunk = shrinkModelList(many, { query: 'm-1', limit: 10 });
assert.ok(shrunk.total >= 10);
assert.ok(shrunk.items.length <= 10);

const probed = await probeOpenAICompatibleApi('', '');
assert.equal(probed.ok, false);
assert.equal(probed.count, 0);

const rec = normalizeProvider({
  id: 'prov_x',
  name: 'OpenRouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: 'sk-or-test',
  model: 'openai/gpt-4o',
  lastProbe: { ok: true, at: 1, count: 128 }
});
assert.equal(rec.lastProbe.ok, true);
assert.equal(rec.lastProbe.count, 128);
assert.equal(typeof setActiveProviderModel, 'function');

const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const llm = fs.readFileSync(path.join(root, 'src/agent/llm.js'), 'utf8');
assert.match(html, /探测 API|apiProbeBtn/);
assert.match(html, /id="providerModelCatalog"/);
assert.match(html, /id="providerImageCatalog"/);
assert.match(html, /id="providerImageKeyInput"/);
assert.match(html, /data-image-preset="openai"/);
assert.match(html, /id="providerImageProbeBtn"/);
assert.match(html, /id="apiProbeResult"/);
assert.match(html, /id="modelSelectSearch"/);
assert.match(js, /model-select-group/);
assert.match(js, /onProbeImageModelsClick/);
assert.match(js, /modelPickerOpenId/);
assert.match(js, /probeOpenAICompatibleApi/);
assert.match(js, /setActiveProviderModel/);
assert.match(js, /persistComposerModel/);
assert.match(js, /modelsForProvider/);
assert.match(llm, /export async function setActiveProviderModel/);
assert.match(llm, /lastProbe/);

assert.equal(normalizeChatModelId('x-ai/grok-4.6'), 'grok-4.6');
assert.equal(isVisionCapableModel('x-ai/grok-4.6'), true);
assert.equal(isVisionCapableModel('x-ai/grok-4.6-fast'), true);
assert.equal(classifyChatVisionCapability('custom-byok-unknown-7'), 'unknown');
assert.equal(isVisionCapableModel('custom-byok-unknown-7'), true);
assert.equal(isKnownTextOnlyChatModel('deepseek-v4-flash'), true);
assert.equal(isVisionCapableModel('deepseek-v4-flash'), false);

console.log('test_model_catalog: ok');
