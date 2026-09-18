import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STT_BASE_URL,
  DEFAULT_STT_MODEL,
  findSttProvider,
  inferSttProtocol,
  normalizeWebAcquireSettings,
  sttAuthHeaders,
  sttConfigured,
  sttModelsUrl,
  sttProbeUrl,
  sttTranscriptionUrl
} from '../src/agent/webAcquireSettings.js';
import { redactSecretsInText } from '../src/agent/safeEndpointUrl.js';
import {
  buildSilentWavBytes,
  buildSttProbeRequest,
  buildTranscriptionForm,
  md5Hex,
  parseIflytekKey,
  transcribeAcquire,
  transcribeAudioFile
} from '../src/agent/vnext/primitives/transcribe.js';

test('STT presets use documented vendor bases', () => {
  assert.equal(findSttProvider('groq').baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(findSttProvider('groq').model, 'whisper-large-v3');
  assert.equal(findSttProvider('iflytek').baseURL, 'https://raasr.xfyun.cn/v2/api');
  assert.equal(findSttProvider('doubao').baseURL, 'https://ark.cn-beijing.volces.com/api/v3');
  assert.equal(findSttProvider('qwen').baseURL, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(findSttProvider('qwen').model, 'qwen3-asr-flash');
  assert.equal(inferSttProtocol('qwen', findSttProvider('qwen').baseURL), 'dashscope-chat-asr');
  assert.equal(inferSttProtocol('doubao', findSttProvider('doubao').baseURL), 'ark-responses');
  assert.equal(sttProbeUrl(findSttProvider('qwen').baseURL, 'qwen'), 'https://dashscope.aliyuncs.com/compatible-mode/v1/models');
  assert.equal(sttProbeUrl(findSttProvider('iflytek').baseURL, 'iflytek'), 'https://raasr.xfyun.cn/v2/api/getResult');
});

test('md5 and 讯飞 key format', () => {
  assert.equal(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5Hex('hello'), '5d41402abc4b2a76b9719d911017c592');
  assert.equal(parseIflytekKey('app:secret').ok, true);
  assert.equal(parseIflytekKey('nosplit').ok, false);
});

test('STT settings default to Groq whisper-large-v3', () => {
  const got = normalizeWebAcquireSettings({});
  assert.equal(got.sttProvider, 'groq');
  assert.equal(got.sttBaseURL, DEFAULT_STT_BASE_URL);
  assert.equal(got.sttModel, DEFAULT_STT_MODEL);
  assert.equal(got.sttKey, '');
  assert.equal(sttConfigured(got), false);
});

test('STT settings keep search keys and accept a custom HTTPS base', () => {
  const got = normalizeWebAcquireSettings({
    tavilyKey: 'tvly-keep',
    sttProvider: 'openai-compatible',
    sttKey: 'gsk_testkeyvalue',
    sttBaseURL: 'https://relay.example/v1/',
    sttModel: 'whisper-1'
  });
  assert.equal(got.tavilyKey, 'tvly-keep');
  assert.equal(got.sttProvider, 'openai-compatible');
  assert.equal(got.sttKey, 'gsk_testkeyvalue');
  assert.equal(got.sttBaseURL, 'https://relay.example/v1');
  assert.equal(got.sttModel, 'whisper-1');
  assert.equal(sttConfigured(got), true);
});

test('remote http STT bases fall back to Groq HTTPS', () => {
  const got = normalizeWebAcquireSettings({
    sttBaseURL: 'http://proxy.invalid/v1'
  });
  assert.equal(got.sttBaseURL, DEFAULT_STT_BASE_URL);
});

test('localhost http STT bases are kept', () => {
  const got = normalizeWebAcquireSettings({
    sttBaseURL: 'http://127.0.0.1:8080/v1'
  });
  assert.equal(got.sttBaseURL, 'http://127.0.0.1:8080/v1');
});

test('STT probe and transcription URLs sit on the OpenAI-compatible root', () => {
  assert.equal(sttModelsUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1/models');
  assert.equal(
    sttTranscriptionUrl('https://api.groq.com/openai/v1/'),
    'https://api.groq.com/openai/v1/audio/transcriptions'
  );
  assert.equal(sttAuthHeaders('gsk_abc').Authorization, 'Bearer gsk_abc');
});

test('silent wav is a tiny RIFF file', () => {
  const wav = buildSilentWavBytes();
  assert.ok(wav.byteLength < 2048);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
});

test('transcription POST is multipart to /audio/transcriptions', async () => {
  let seen = null;
  const wav = buildSilentWavBytes();
  const form = buildTranscriptionForm({
    bytes: wav,
    filename: 'clip.wav',
    model: 'whisper-large-v3',
    language: 'zh'
  });
  assert.equal(form.get('model'), 'whisper-large-v3');
  assert.equal(form.get('language'), 'zh');
  assert.ok(form.get('file'));

  const out = await transcribeAudioFile({
    apiKey: 'gsk_secret_test_key_value',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'whisper-large-v3',
    bytes: wav,
    filename: 'clip.wav',
    language: 'zh',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: '你好', language: 'zh', duration: 0.5 })
      };
    }
  });
  assert.equal(out.ok, true);
  assert.equal(out.text, '你好');
  assert.equal(seen.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer gsk_secret_test_key_value');
  assert.ok(seen.init.body instanceof FormData);
  assert.equal(seen.init.body.get('model'), 'whisper-large-v3');
  assert.equal(seen.init.body.get('language'), 'zh');
});

test('remote http STT endpoint is rejected before fetch', async () => {
  let called = false;
  const out = await transcribeAudioFile({
    apiKey: 'gsk_secret_test_key_value',
    baseURL: 'http://evil.example/v1',
    bytes: buildSilentWavBytes(),
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200, text: async () => '{"text":"x"}' };
    }
  });
  assert.equal(called, false);
  assert.equal(out.ok, false);
  assert.equal(out.code, 'INSECURE_ENDPOINT');
  assert.equal(String(out.error || '').includes('gsk_secret_test_key_value'), false);
});

test('STT HTTP errors redact the key', async () => {
  const out = await transcribeAudioFile({
    apiKey: 'gsk_secret_test_key_value',
    baseURL: 'https://api.groq.com/openai/v1',
    bytes: buildSilentWavBytes(),
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid gsk_secret_test_key_value'
    })
  });
  assert.equal(out.ok, false);
  assert.equal(String(out.error || '').includes('gsk_secret_test_key_value'), false);
  assert.match(String(out.error || ''), /REDACTED|HTTP 401/i);
});

test('redactSecretsInText strips Groq gsk_ keys', () => {
  assert.equal(redactSecretsInText('bad gsk_abcdefghijklmnop'), 'bad [REDACTED]');
});

test('acquire transcribe writes guest text and hides the key', async () => {
  const files = new Map();
  const fs = {
    mkdirp() {
      return { ok: true };
    },
    writeFile(path, data) {
      files.set(path, String(data));
      return { ok: true, path };
    },
    readFileBytes(path) {
      const raw = files.get(path);
      if (!raw) throw new Error(`ENOENT: ${path}`);
      return new TextEncoder().encode(raw);
    }
  };
  files.set('/scratch/clip.wav', 'not-really-wav');
  const out = await transcribeAcquire(
    {
      fs,
      webAcquire: { sttKey: 'gsk_secret_test_key_value', sttBaseURL: 'https://api.groq.com/openai/v1' },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: 'transcribed clip' })
      })
    },
    { path: '/scratch/clip.wav' }
  );
  assert.equal(out.ok, true);
  assert.equal(out.action, 'transcribe');
  assert.match(out.path, /^\/scratch\/sources\/.+\.txt$/);
  assert.equal(files.get(out.path), 'transcribed clip');
  assert.equal(JSON.stringify(out).includes('gsk_secret_test_key_value'), false);
});

test('千问 adapter POSTs chat/completions with input_audio', async () => {
  let seen = null;
  const out = await transcribeAudioFile({
    apiKey: 'sk-dash',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    provider: 'qwen',
    model: 'qwen3-asr-flash',
    bytes: buildSilentWavBytes(),
    filename: 'clip.webm',
    mimeType: 'audio/webm',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: '你好千问' } }] })
      };
    }
  });
  assert.equal(out.ok, true);
  assert.equal(out.text, '你好千问');
  assert.equal(seen.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, 'qwen3-asr-flash');
  assert.equal(body.messages[0].content[0].type, 'input_audio');
});

test('豆包 adapter POSTs /responses with input_audio', async () => {
  let seen = null;
  const out = await transcribeAudioFile({
    apiKey: 'ak-volc',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    provider: 'doubao',
    model: 'doubao-seed-2-0-lite-260428',
    bytes: buildSilentWavBytes(),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, text: async () => JSON.stringify({ output_text: '豆包转写' }) };
    }
  });
  assert.equal(out.ok, true);
  assert.equal(out.text, '豆包转写');
  assert.equal(seen.url, 'https://ark.cn-beijing.volces.com/api/v3/responses');
});

test('讯飞 probe URL is signed getResult', async () => {
  const spec = await buildSttProbeRequest({
    apiKey: 'appid:secret',
    baseURL: 'https://raasr.xfyun.cn/v2/api',
    providerId: 'iflytek',
    now: 1_700_000_000_000
  });
  assert.equal(spec.method, 'GET');
  assert.match(spec.url, /^https:\/\/raasr\.xfyun\.cn\/v2\/api\/getResult\?/);
  assert.match(spec.url, /appId=appid/);
  assert.match(spec.url, /signa=/);
});

test('讯飞 adapter uploads then polls getResult', async () => {
  const urls = [];
  const out = await transcribeAudioFile({
    apiKey: 'appid:secret',
    baseURL: 'https://raasr.xfyun.cn/v2/api',
    provider: 'iflytek',
    bytes: buildSilentWavBytes(),
    filename: 'clip.webm',
    duration: 2,
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.includes('/upload')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ content: { orderId: 'ord-1' } }) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ content: { orderResult: '讯飞转写正文' } })
      };
    }
  });
  assert.equal(out.ok, true);
  assert.equal(out.text, '讯飞转写正文');
  assert.ok(urls.some((u) => u.includes('/upload')));
  assert.ok(urls.some((u) => u.includes('/getResult')));
});

test('acquire transcribe rejects a private audio URL', async () => {
  const out = await transcribeAcquire(
    {
      webAcquire: { sttKey: 'gsk_x', sttBaseURL: 'https://api.groq.com/openai/v1' },
      fetchImpl: async () => {
        throw new Error('should not fetch');
      }
    },
    { url: 'http://127.0.0.1/secret.wav' }
  );
  assert.equal(out.ok, false);
  assert.equal(out.code, 'NET_DENIED');
});
