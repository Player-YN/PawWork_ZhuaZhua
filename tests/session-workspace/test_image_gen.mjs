import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionWorkspaceStore } from '../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  generateSessionImage,
  resolveImageRuntimeConfig,
  extractImageBytes,
  buildOpenRouterImageBody,
  buildOpenRouterChatImageBody,
  buildOpenAiImageBody
} from '../../src/agent/vnext/sessionWorkspace/imageGen.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution, settleExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import {
  defaultImageConfig,
  normalizeProvider,
  applyProviderImageModel,
  PROVIDER_PRESETS,
  OPENROUTER_API_BASE
} from '../../src/agent/llm.js';
import { isLikelyImageGenModel, parseModelsResponse } from '../../src/agent/modelCatalog.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);
const pngB64 = Buffer.from(PNG).toString('base64');
const pngDataUrl = `data:image/png;base64,${pngB64}`;

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function makeWorkspace() {
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('img');
  const store = svc.runtime.store;
  const ex = beginExecution(store, 'img');
  const fsG = createSessionGuestFs(store, { sessionId: 'img', executionId: ex.executionId });
  fsG.mkdirp('/artifacts');
  return { store, fs: fsG, ex };
}

async function runGen(settings, fetchImpl, extra = {}) {
  const ws = makeWorkspace();
  const out = await generateSessionImage({
    store: ws.store,
    fs: ws.fs,
    sessionId: 'img',
    prompt: extra.prompt || 'a red panda',
    aspectRatio: extra.aspectRatio,
    fetchImpl,
    settings
  });
  settleExecution(ws.store, ws.ex, 'settled');
  return out;
}

const orSettings = {
  apiKey: 'sk-or-chat',
  apiBase: 'https://openrouter.ai/api/v1',
  image: {
    enabled: true,
    protocol: 'openrouter-image',
    path: '/images',
    model: 'black-forest-labs/flux.2-pro'
  }
};

// Detection: VLM with input image / no output image is excluded
{
  const vlm = {
    id: 'openai/gpt-4o',
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }
  };
  assert.equal(isLikelyImageGenModel(vlm.id, vlm), false);
  const parsed = parseModelsResponse({
    data: [
      vlm,
      {
        id: 'google/gemini-2.5-flash-image',
        architecture: { output_modalities: ['text', 'image'] }
      }
    ]
  });
  assert.equal(
    parsed.some((m) => m.id === 'openai/gpt-4o' && m.image),
    false
  );
  assert.equal(
    parsed.some((m) => m.id === 'google/gemini-2.5-flash-image' && m.image),
    true
  );
}

// OpenRouter template ships the canonical image origin (same host as chat; path /images)
{
  const or = PROVIDER_PRESETS.find((p) => p.id === 'openrouter');
  assert.ok(or);
  assert.equal(or.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(or.image.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(or.image.baseURL, OPENROUTER_API_BASE);
  assert.equal(or.image.path, '/images');
  assert.equal(or.image.protocol, 'openrouter-image');
}

// image baseUrl empty → inherits chat; apiKey empty → inherits chat key
{
  const cfg = resolveImageRuntimeConfig({
    apiKey: 'sk-or-chat',
    apiBase: 'https://openrouter.ai/api/v1',
    image: { enabled: true, protocol: 'openrouter-image', path: '/images', model: 'google/gemini-2.5-flash-image' }
  });
  assert.equal(cfg.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(cfg.apiKey, 'sk-or-chat');
  assert.equal(cfg.path, '/images');
}

// image baseUrl set → used for image; chat base stays on settings
{
  const settings = {
    apiKey: 'sk-or-chat',
    apiBase: 'https://openrouter.ai/api/v1',
    image: {
      enabled: true,
      protocol: 'openai-image',
      path: '/images/generations',
      model: 'gpt-image-1',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-openai'
    }
  };
  const cfg = resolveImageRuntimeConfig(settings);
  assert.equal(cfg.baseURL, 'https://api.openai.com/v1');
  assert.equal(cfg.apiKey, 'sk-openai');
  assert.equal(settings.apiBase, 'https://openrouter.ai/api/v1');
  assert.equal(settings.apiKey, 'sk-or-chat');
}

// Settings round-trip: image.apiKey + baseURL persist on the chat vendor record
{
  const rec = normalizeProvider({
    id: 'prov_img',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-chat',
    model: 'openai/gpt-4o',
    image: defaultImageConfig({
      enabled: true,
      protocol: 'openrouter-image',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-image',
      path: '/images',
      model: 'google/gemini-2.5-flash-image'
    })
  });
  assert.equal(rec.image.enabled, true);
  assert.equal(rec.image.apiKey, 'sk-or-image');
  assert.equal(rec.image.baseURL, 'https://openrouter.ai/api/v1');
  const cfg = resolveImageRuntimeConfig({
    apiKey: rec.apiKey,
    apiBase: rec.baseURL,
    image: rec.image
  });
  assert.equal(cfg.apiKey, 'sk-or-image');
  assert.equal(cfg.protocol, 'openrouter-image');
  assert.equal(cfg.baseURL, 'https://openrouter.ai/api/v1');
}

// Switching image model does not rewrite chat model / key / base
{
  const rec = normalizeProvider({
    id: 'prov_img',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-chat',
    model: 'openai/gpt-4o',
    image: defaultImageConfig({
      enabled: true,
      protocol: 'openrouter-image',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-image',
      path: '/images',
      model: 'google/gemini-2.5-flash-image'
    })
  });
  const next = applyProviderImageModel(rec, 'black-forest-labs/flux.2-pro');
  assert.equal(next.model, 'openai/gpt-4o');
  assert.equal(next.apiKey, 'sk-or-chat');
  assert.equal(next.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(next.image.model, 'black-forest-labs/flux.2-pro');
  assert.equal(next.image.apiKey, 'sk-or-image');
  assert.equal(next.image.baseURL, 'https://openrouter.ai/api/v1');
}

// Distinct image origin is the request host; chat origin is not concatenated
{
  const urls = [];
  const out = await runGen(
    {
      apiKey: 'sk-or-chat',
      apiBase: 'https://openrouter.ai/api/v1',
      image: {
        enabled: true,
        protocol: 'openai-image',
        path: '/images/generations',
        model: 'gpt-image-1',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-openai'
      }
    },
    async (url, init = {}) => {
      urls.push(String(url));
      assert.match(String(init.headers?.Authorization || ''), /sk-openai/);
      return jsonRes(200, { data: [{ b64_json: pngB64, media_type: 'image/png' }] });
    }
  );
  assert.equal(out.ok, true, out.error);
  assert.ok(urls.every((u) => u.startsWith('https://api.openai.com/v1/')));
  assert.ok(!urls.some((u) => /openrouter/i.test(u)));
}

// Empty image key inherits chat key on the wire
{
  const auth = [];
  const out = await runGen(
    {
      apiKey: 'sk-or-shared',
      apiBase: 'https://openrouter.ai/api/v1',
      image: {
        enabled: true,
        protocol: 'openrouter-image',
        path: '/images',
        model: 'google/gemini-2.5-flash-image'
      }
    },
    async (url, init = {}) => {
      auth.push(String(init.headers?.Authorization || ''));
      return jsonRes(200, { data: [{ b64_json: pngB64, media_type: 'image/png' }] });
    }
  );
  assert.equal(out.ok, true, out.error);
  assert.ok(auth.every((h) => h === 'Bearer sk-or-shared'));
}

// Image key wins over chat key on the Authorization header
{
  /** @type {string[]} */
  const auth = [];
  const out = await runGen(
    {
      apiKey: 'sk-or-chat',
      apiBase: 'https://openrouter.ai/api/v1',
      image: {
        enabled: true,
        protocol: 'openrouter-image',
        path: '/images',
        model: 'google/gemini-2.5-flash-image',
        apiKey: 'sk-or-image-only',
        baseURL: 'https://openrouter.ai/api/v1'
      }
    },
    async (url, init = {}) => {
      auth.push(String(init.headers?.Authorization || ''));
      assert.match(String(url), /\/images$/);
      return jsonRes(200, { data: [{ b64_json: pngB64, media_type: 'image/png' }] });
    }
  );
  assert.equal(out.ok, true);
  assert.ok(auth.every((h) => h === 'Bearer sk-or-image-only'));
}

// Missing key → named NO_API_KEY (never silent)
{
  const out = await runGen(
    {
      apiKey: '',
      apiBase: 'https://openrouter.ai/api/v1',
      image: { enabled: true, protocol: 'openrouter-image', path: '/images', model: 'x' }
    },
    async () => {
      throw new Error('fetch must not run without a key');
    }
  );
  assert.equal(out.ok, false);
  assert.equal(out.code, 'NO_API_KEY');
  assert.match(String(out.error), /NO_API_KEY|API Key/i);
}

// OpenRouter chat-completions shape (message.images data URL) — /images 404 fallback
{
  const urls = [];
  const out = await runGen(orSettings, async (url, init = {}) => {
    urls.push(String(url));
    if (String(url).includes('/chat/completions')) {
      const body = JSON.parse(String(init.body || '{}'));
      assert.deepEqual(body.modalities, ['image', 'text']);
      return jsonRes(200, {
        choices: [
          {
            message: {
              role: 'assistant',
              images: [{ type: 'image_url', image_url: { url: pngDataUrl } }]
            }
          }
        ]
      });
    }
    return jsonRes(404, { error: { message: 'not found; use chat completions' } });
  });
  assert.equal(out.ok, true, out.error);
  assert.ok(urls.some((u) => u.endsWith('/images')));
  assert.ok(urls.some((u) => u.endsWith('/chat/completions')));
}

// OpenRouter /images 200 already in message.images (no second hop)
{
  const urls = [];
  const out = await runGen(orSettings, async (url) => {
    urls.push(String(url));
    return jsonRes(200, {
      choices: [
        {
          message: {
            images: [{ image_url: { url: pngDataUrl } }]
          }
        }
      ]
    });
  });
  assert.equal(out.ok, true, out.error);
  assert.equal(urls.length, 1);
}

// OpenAI /images/generations b64_json
{
  const out = await runGen(
    {
      apiKey: 'sk-openai',
      apiBase: 'https://api.openai.com/v1',
      image: {
        enabled: true,
        protocol: 'openai-image',
        path: '/images/generations',
        model: 'gpt-image-1'
      }
    },
    async (url, init = {}) => {
      assert.match(String(url), /\/images\/generations$/);
      const body = JSON.parse(String(init.body || '{}'));
      assert.equal(body.response_format, 'b64_json');
      assert.equal(body.aspect_ratio, undefined);
      return jsonRes(200, { data: [{ b64_json: pngB64 }] });
    },
    { aspectRatio: '16:9' }
  );
  assert.equal(out.ok, true, out.error);
}

// VLM text-only chat response → NOT_IMAGE_OUTPUT
{
  const out = await runGen(orSettings, async (url) => {
    if (String(url).includes('/chat/completions') || String(url).includes('/images')) {
      return jsonRes(200, {
        choices: [{ message: { role: 'assistant', content: 'I can describe images but not generate them.' } }]
      });
    }
    throw new Error(`unexpected ${url}`);
  });
  assert.equal(out.ok, false);
  assert.equal(out.code, 'NOT_IMAGE_OUTPUT');
  assert.match(String(out.error), /NOT_IMAGE_OUTPUT/);
}

// Provider HTTP error carries status + message
{
  const out = await runGen(orSettings, async () =>
    jsonRes(402, { error: { message: 'Payment required for flux.2-pro' } })
  );
  assert.equal(out.ok, false);
  assert.equal(out.code, 'IMAGE_HTTP');
  assert.equal(out.status, 402);
  assert.match(String(out.error), /402/);
  assert.match(String(out.error), /Payment required/);
}

// extractImageBytes covers documented shapes
{
  const fromOrImages = extractImageBytes({ data: [{ b64_json: pngB64 }] });
  assert.ok(fromOrImages.bytes?.byteLength);
  const fromChat = extractImageBytes({
    choices: [{ message: { images: [{ image_url: { url: pngDataUrl } }] } }]
  });
  assert.ok(fromChat.bytes?.byteLength);
  const fromContent = extractImageBytes({
    choices: [
      {
        message: {
          content: [{ type: 'image_url', image_url: { url: pngDataUrl } }]
        }
      }
    ]
  });
  assert.ok(fromContent.bytes?.byteLength);
}

const orBody = buildOpenRouterImageBody('m', 'p', '16:9', []);
assert.equal(orBody.output_format, undefined);
assert.equal(orBody.aspect_ratio, '16:9');
const chatBody = buildOpenRouterChatImageBody('m', 'p', '1:1', []);
assert.deepEqual(chatBody.modalities, ['image', 'text']);
assert.deepEqual(chatBody.image_config, { aspect_ratio: '1:1' });
const oaiBody = buildOpenAiImageBody('gpt-image-1', 'p', [], '16:9');
assert.equal(oaiBody.size, undefined);
assert.equal(buildOpenAiImageBody('gpt-image-1', 'p', [], '1024x1024').size, '1024x1024');

const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
assert.match(html, /id="providerImageKeyInput"/);
assert.match(html, /type="password"[^>]*id="providerImageKeyInput"|id="providerImageKeyInput"[^>]*type="password"/);
assert.match(html, /inherit chat \/ 与推理相同/);
assert.match(html, /https:\/\/openrouter\.ai\/api\/v1/);
assert.doesNotMatch(html, /id="imageSameApiCheck"/);
assert.doesNotMatch(html, /id="imageCustomApiFields"[^>]*hidden/);
assert.match(js, /providerImageKeyInput/);
assert.match(js, /imageOverrides\.apiKey|nextImage\.apiKey/);
assert.match(js, /fetchImageGenModels/);
assert.match(js, /OPENROUTER_API_BASE/);
assert.match(js, /imgBase\.value = OPENROUTER_API_BASE/);
assert.match(js, /pickComposerImageModel/);
assert.match(js, /setActiveProviderImageModel/);

console.log('test_image_gen: ok');
