import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseModelsResponse,
  shrinkModelList,
  filterPickerGroup,
  isLikelyNonChatModel,
  isLikelyImageGenModel,
  hasImageOutputModality,
  imageModelsFromList,
  chatModelsFromList,
  buildProviderPickerGroups,
  applyProviderProbeResult,
  refreshPickerCatalogFromProbe,
  formatModelChipLabel,
  shortModelId,
  modelsEndpointURL,
  probeOpenAICompatibleApi,
  isVisionCapableModel,
  classifyChatVisionCapability,
  isKnownTextOnlyChatModel,
  normalizeChatModelId
} from '../../src/agent/modelCatalog.js';
import {
  normalizeProvider,
  setActiveProviderModel,
  setActiveProviderImageModel,
  applyProviderImageModel
} from '../../src/agent/llm.js';

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
assert.ok(imageModelsFromList(mixed).some((m) => m.id.includes('flux')));
assert.ok(chatModelsFromList(mixed).some((m) => m.id === 'openai/gpt-4o'));
assert.equal(chatModelsFromList(mixed).some((m) => m.image), false);
assert.equal(chatModelsFromList(mixed).some((m) => m.id.includes('flash-image')), false);
assert.equal(chatModelsFromList(mixed).some((m) => m.id.includes('flux')), false);
assert.equal(
  chatModelsFromList([{ id: 'google/gemini-2.5-flash-image' }, { id: 'openai/gpt-4o' }]).some((m) =>
    m.id.includes('flash-image')
  ),
  false
);
assert.ok(
  imageModelsFromList([{ id: 'google/gemini-2.5-flash-image' }]).some((m) => m.id.includes('flash-image'))
);

assert.equal(shortModelId('google/gemini-2.5-flash-image'), 'gemini-2.5-flash-image');
assert.equal(formatModelChipLabel('openai/gpt-4o', 'google/gemini-2.5-flash-image'), 'gpt-4o · gemini-2.5-flash-image');
assert.equal(formatModelChipLabel('openai/gpt-4o', ''), 'gpt-4o');

{
  const noImage = buildProviderPickerGroups(
    { model: 'openai/gpt-4o' },
    { chat: chatModelsFromList(mixed), image: imageModelsFromList(mixed) }
  );
  assert.ok(noImage.chat.some((m) => m.id === 'openai/gpt-4o'));
  assert.equal(noImage.image.length, 0);

  const withImage = buildProviderPickerGroups(
    {
      model: 'openai/gpt-4o',
      image: { enabled: true, model: 'google/gemini-2.5-flash-image' }
    },
    { chat: chatModelsFromList(mixed), image: imageModelsFromList(mixed) }
  );
  assert.ok(withImage.chat.some((m) => m.id === 'openai/gpt-4o'));
  assert.ok(!withImage.chat.some((m) => m.id.includes('flash-image')));
  assert.ok(!withImage.chat.some((m) => m.id.includes('flux')));
  assert.ok(withImage.image.some((m) => m.id.includes('flash-image')));
  assert.ok(withImage.image.some((m) => m.id.includes('flux')));
  assert.ok(!withImage.image.some((m) => m.id === 'openai/gpt-4o'));

  const leaked = buildProviderPickerGroups(
    {
      model: 'openai/gpt-4o',
      image: { enabled: true, model: 'black-forest-labs/flux.2-pro' }
    },
    {
      chat: [
        { id: 'openai/gpt-4o' },
        { id: 'google/gemini-2.5-flash-image' },
        { id: 'black-forest-labs/flux.2-pro' }
      ],
      image: imageModelsFromList(mixed)
    }
  );
  assert.deepEqual(
    leaked.chat.map((m) => m.id),
    ['openai/gpt-4o']
  );
  assert.ok(!leaked.image.some((m) => m.id === 'openai/gpt-4o'));

  const chatOnly = withImage.chat;
  const imageOnly = withImage.image;
  const chatFlux = filterPickerGroup(chatOnly, 'flux');
  assert.equal(chatFlux.items.length, 0);
  assert.equal(chatFlux.total, 0);
  const imageFlux = filterPickerGroup(imageOnly, 'flux');
  assert.ok(imageFlux.items.some((m) => m.id.includes('flux')));
  assert.ok(!imageFlux.items.some((m) => m.id === 'openai/gpt-4o'));
  const chatGpt = filterPickerGroup(chatOnly, 'gpt');
  assert.ok(chatGpt.items.some((m) => m.id === 'openai/gpt-4o'));
  assert.ok(!chatGpt.items.some((m) => m.id.includes('flux')));
  assert.equal(filterPickerGroup(imageOnly, 'gpt-4o').items.length, 0);
  assert.equal(filterPickerGroup(chatOnly, '').items.length, chatOnly.length);
  assert.equal(filterPickerGroup(imageOnly, '').items.length, imageOnly.length);
  assert.equal(filterPickerGroup(chatOnly, 'zzzz-no-such-model').items.length, 0);
  assert.equal(filterPickerGroup([], 'gpt').items.length, 0);
}

{
  const provider = {
    id: 'prov_picker',
    name: 'OpenRouter',
    model: 'openai/gpt-4o',
    image: { enabled: true, model: 'google/gemini-2.5-flash-image' }
  };
  const mockList = parseModelsResponse({
    data: [
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'anthropic/claude-sonnet-4' },
      { id: 'google/gemini-2.5-flash-image' },
      {
        id: 'black-forest-labs/flux.2-pro',
        architecture: { output_modalities: ['image'] }
      }
    ]
  });
  const probe = { ok: true, models: mockList, count: mockList.length };
  const applied = applyProviderProbeResult(provider, probe, 42);
  assert.equal(applied.lastProbe.ok, true);
  assert.equal(applied.lastProbe.at, 42);
  assert.equal(applied.provider.model, 'openai/gpt-4o');
  assert.equal(applied.provider.image.model, 'google/gemini-2.5-flash-image');
  assert.ok(applied.catalog.chat.some((m) => m.id === 'openai/gpt-4o'));
  assert.ok(applied.catalog.chat.some((m) => m.id === 'anthropic/claude-sonnet-4'));
  assert.equal(applied.catalog.chat.some((m) => m.id.includes('flux')), false);
  assert.ok(applied.catalog.image.some((m) => m.id.includes('flash-image')));
  assert.ok(applied.catalog.image.some((m) => m.id.includes('flux')));

  const refreshed = refreshPickerCatalogFromProbe(provider, probe, 42);
  assert.equal(refreshed.lastProbe.ok, true);
  assert.equal(refreshed.groups.chat[0].id, 'openai/gpt-4o');
  assert.equal(refreshed.groups.image[0].id, 'google/gemini-2.5-flash-image');
  assert.ok(refreshed.groups.chat.some((m) => m.id === 'anthropic/claude-sonnet-4'));
  assert.ok(refreshed.groups.image.some((m) => m.id.includes('flux')));
  assert.ok(!refreshed.groups.chat.some((m) => m.id.includes('flux')));

  const failed = refreshPickerCatalogFromProbe(provider, { ok: false, error: 'HTTP 401', models: [] });
  assert.equal(failed.lastProbe.ok, false);
  assert.match(failed.lastProbe.error, /401/);
  assert.ok(failed.groups.chat.some((m) => m.id === 'openai/gpt-4o'));
  assert.ok(failed.groups.image.some((m) => m.id.includes('flash-image')));
}
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
assert.equal(typeof setActiveProviderImageModel, 'function');
assert.equal(typeof applyProviderImageModel, 'function');

const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
const llm = fs.readFileSync(path.join(root, 'src/agent/llm.js'), 'utf8');
assert.match(html, /探测 API|apiProbeBtn/);
assert.match(html, /id="providerModelCatalog"/);
assert.match(html, /id="providerImageCatalog"/);
assert.match(html, /id="providerImageKeyInput"/);
assert.match(html, /data-image-preset="openai"/);
assert.match(html, /id="providerImageProbeBtn"/);
assert.match(html, /id="apiProbeResult"/);
assert.equal(html.includes('id="modelSelectSearch"'), false);
assert.match(html, /id="modelSelectList"/);
assert.equal(/id="modelSelectList"[^>]*role="listbox"/.test(html), false);
assert.match(js, /model-select-group/);
assert.match(js, /model-select-pane/);
assert.match(js, /model-select-pane-toggle/);
assert.match(js, /model-select-pane-search/);
assert.match(js, /model-select-pane-list/);
assert.match(js, /modelPickerPaneOpen/);
assert.match(js, /modelPickerPaneQuery/);
assert.match(js, /filterPickerGroup/);
assert.match(js, /dataset\.kind = kind/);
assert.match(js, /addPane\(body, 'chat'/);
assert.match(js, /addPane\(body, 'image'/);
assert.match(css, /\.model-select-pane-list/);
assert.match(css, /\.model-select-pane-label/);
assert.match(css, /\.model-select-pane-toggle/);
assert.match(css, /\.model-select-pane-body/);
const i18nSrc = fs.readFileSync(path.join(root, 'src/sidepanel/i18n.js'), 'utf8');
assert.match(i18nSrc, /modelPickerSearchChat/);
assert.match(i18nSrc, /modelPickerSearchImage/);
assert.match(i18nSrc, /modelPickerNoMatch/);
assert.match(js, /onProbeImageModelsClick/);
assert.match(js, /modelPickerOpenId/);
assert.match(js, /probeOpenAICompatibleApi/);
assert.match(js, /setActiveProviderModel/);
assert.match(js, /setActiveProviderImageModel/);
assert.match(js, /pickComposerImageModel/);
assert.match(js, /buildProviderPickerGroups/);
assert.match(js, /modelPickerChat/);
assert.match(js, /modelPickerImage/);
assert.match(js, /persistComposerModel/);
assert.match(js, /modelsForProvider/);
assert.match(js, /probeAndPersistProviderCatalog/);
assert.match(js, /onPickerProbeProvider/);
assert.match(js, /model-select-probe/);
assert.match(js, /paintPickerProbeRow/);
assert.match(css, /\.model-select-probe/);
assert.match(css, /\.model-select-group-body/);
assert.match(css, /padding: 0 0 0 var\(--space-3\)/);
assert.match(i18nSrc, /modelPickerProbe/);
assert.match(i18nSrc, /modelPickerProbing/);
assert.match(llm, /export async function setActiveProviderModel/);
assert.match(llm, /export async function setActiveProviderImageModel/);
assert.match(llm, /OPENROUTER_API_BASE/);
assert.match(llm, /baseURL: OPENROUTER_API_BASE/);
assert.match(llm, /lastProbe/);

assert.equal(normalizeChatModelId('x-ai/grok-4.6'), 'grok-4.6');
assert.equal(isVisionCapableModel('x-ai/grok-4.6'), true);
assert.equal(isVisionCapableModel('x-ai/grok-4.6-fast'), true);
assert.equal(classifyChatVisionCapability('custom-byok-unknown-7'), 'unknown');
assert.equal(isVisionCapableModel('custom-byok-unknown-7'), true);
assert.equal(isKnownTextOnlyChatModel('deepseek-v4-flash'), true);
assert.equal(isVisionCapableModel('deepseek-v4-flash'), false);

console.log('test_model_catalog: ok');
