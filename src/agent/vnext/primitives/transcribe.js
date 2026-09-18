/**
 * Audio → text. Groq/custom: POST {base}/audio/transcriptions.
 * 千问: DashScope chat/completions + input_audio.
 * 豆包: 火山方舟 /responses + input_audio.
 * 讯飞: raasr /upload + /getResult (key = appId:secretKey).
 */

import { assertSafeByokEndpointUrl, redactSecretsInText } from '../../safeEndpointUrl.js';
import { assertUploadGuestPath } from '../host/uploadChannel.js';
import { assertPublicHttpUrl } from './netGuard.js';
import {
  DEFAULT_STT_BASE_URL,
  DEFAULT_STT_MODEL,
  inferSttProtocol,
  normalizeWebAcquireSettings,
  sttAuthHeaders,
  sttProbeUrl,
  sttTranscriptionUrl
} from '../../webAcquireSettings.js';

export const STT_MAX_BYTES = 25 * 1024 * 1024;

const AUDIO_EXT = /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)(\?|$)/i;

const AUDIO_MIME = {
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm'
};

function fail(action, code, error, extra = {}) {
  return { ok: false, action, code, error, ...extra };
}

function clip(value, length) {
  const text = value == null ? null : String(value);
  return text && text.length > length ? text.slice(0, length) + '…' : text;
}

export function guessAudioMime(filename, fallback = 'application/octet-stream') {
  const m = /\.([a-z0-9]{2,8})$/i.exec(String(filename || ''));
  if (!m) return fallback;
  return AUDIO_MIME[m[1].toLowerCase()] || fallback;
}

export function looksLikeAudioName(name) {
  return AUDIO_EXT.test(String(name || ''));
}

/**
 * Tiny silent PCM WAV (~50 ms, 8 kHz mono). Used by tests / optional probe.
 * Not a user recording.
 */
export function buildSilentWavBytes() {
  const sampleRate = 8000;
  const samples = 400;
  const dataSize = samples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const ascii = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}

/**
 * @param {{
 *   bytes: Uint8Array,
 *   filename?: string,
 *   mimeType?: string,
 *   model?: string,
 *   language?: string
 * }} input
 */
export function buildTranscriptionForm(input = {}) {
  const filename = sanitizeName(input.filename || 'audio.wav');
  const mime = String(input.mimeType || '').trim() || guessAudioMime(filename, 'audio/wav');
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes || []);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), filename);
  form.append('model', String(input.model || DEFAULT_STT_MODEL).trim() || DEFAULT_STT_MODEL);
  const language = String(input.language || '').trim();
  if (language) form.append('language', language);
  return form;
}

function sanitizeName(name) {
  return String(name || 'audio.wav').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'audio.wav';
}

export function redactSttError(text, apiKey) {
  return redactSecretsInText(text, [apiKey]);
}

function bytesToBase64(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (typeof Buffer !== 'undefined') return Buffer.from(buf).toString('base64');
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function dataUrlForAudio(bytes, mimeType) {
  const mime = String(mimeType || '').trim() || 'audio/webm';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export function parseIflytekKey(apiKey) {
  const raw = String(apiKey || '').trim();
  const idx = raw.indexOf(':');
  if (idx <= 0 || idx === raw.length - 1) {
    return { ok: false, error: '讯飞 Key 格式为 appId:secretKey' };
  }
  return { ok: true, appId: raw.slice(0, idx).trim(), secret: raw.slice(idx + 1).trim() };
}

/** RFC 1321 MD5, hex lowercase. Used by 讯飞 raasr signa. */
export function md5Hex(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const words = new Uint32Array((((bytes.length + 8) >>> 6) + 1) * 16);
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  words[words.length - 2] = bytes.length * 8;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  const add32 = (x, y) => (x + y) | 0;
  const cmn = (q, aa, bb, x, s, t) => {
    aa = add32(add32(aa, q), add32(x, t));
    return add32((aa << s) | (aa >>> (32 - s)), bb);
  };
  const ff = (aa, bb, cc, dd, x, s, t) => cmn((bb & cc) | (~bb & dd), aa, bb, x, s, t);
  const gg = (aa, bb, cc, dd, x, s, t) => cmn((bb & dd) | (cc & ~dd), aa, bb, x, s, t);
  const hh = (aa, bb, cc, dd, x, s, t) => cmn(bb ^ cc ^ dd, aa, bb, x, s, t);
  const ii = (aa, bb, cc, dd, x, s, t) => cmn(cc ^ (bb | ~dd), aa, bb, x, s, t);
  for (let i = 0; i < words.length; i += 16) {
    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;
    a = ff(a, b, c, d, words[i + 0], 7, -680876936);
    d = ff(d, a, b, c, words[i + 1], 12, -389564586);
    c = ff(c, d, a, b, words[i + 2], 17, 606105819);
    b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4], 7, -176418897);
    d = ff(d, a, b, c, words[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, b, c, d, words[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, words[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10], 17, -42063);
    b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, words[i + 13], 12, -40341101);
    c = ff(c, d, a, b, words[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, words[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, words[i + 1], 5, -165796510);
    d = gg(d, a, b, c, words[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11], 14, 643717713);
    b = gg(b, c, d, a, words[i + 0], 20, -373897302);
    a = gg(a, b, c, d, words[i + 5], 5, -701558691);
    d = gg(d, a, b, c, words[i + 10], 9, 38016083);
    c = gg(c, d, a, b, words[i + 15], 14, -660478335);
    b = gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, b, c, d, words[i + 9], 5, 568446438);
    d = gg(d, a, b, c, words[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3], 14, -187363961);
    b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, words[i + 2], 9, -51403784);
    c = gg(c, d, a, b, words[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, words[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, words[i + 5], 4, -378558);
    d = hh(d, a, b, c, words[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, b, c, d, words[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, words[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7], 16, -155497632);
    b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13], 4, 681279174);
    d = hh(d, a, b, c, words[i + 0], 11, -358537222);
    c = hh(c, d, a, b, words[i + 3], 16, -722521979);
    b = hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, b, c, d, words[i + 9], 4, -640364487);
    d = hh(d, a, b, c, words[i + 12], 11, -421815835);
    c = hh(c, d, a, b, words[i + 15], 16, 530742520);
    b = hh(b, c, d, a, words[i + 2], 23, -995338651);
    a = ii(a, b, c, d, words[i + 0], 6, -198630844);
    d = ii(d, a, b, c, words[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, b, c, d, words[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, words[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10], 15, -1051523);
    b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, words[i + 15], 10, -30611744);
    c = ii(c, d, a, b, words[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4], 6, -145523070);
    d = ii(d, a, b, c, words[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2], 15, 718787259);
    b = ii(b, c, d, a, words[i + 9], 21, -343485551);
    a = add32(a, oa);
    b = add32(b, ob);
    c = add32(c, oc);
    d = add32(d, od);
  }
  const hex = (n) => {
    const u = n >>> 0;
    return (
      (u & 0xff).toString(16).padStart(2, '0') +
      ((u >>> 8) & 0xff).toString(16).padStart(2, '0') +
      ((u >>> 16) & 0xff).toString(16).padStart(2, '0') +
      ((u >>> 24) & 0xff).toString(16).padStart(2, '0')
    );
  };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

export async function hmacSha1Base64(secret, message) {
  const enc = new TextEncoder();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto.subtle unavailable');
  const key = await subtle.importKey('raw', enc.encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, enc.encode(String(message || '')));
  return bytesToBase64(new Uint8Array(sig));
}

export async function iflytekSigna(appId, secret, ts) {
  return hmacSha1Base64(secret, md5Hex(`${appId}${ts}`));
}

export function iflytekProbeSucceeded(status, body) {
  const text = String(body || '');
  if (/illegal sign|invalid signa|签名错误|signa error/i.test(text)) return false;
  if (Number(status) >= 500) return false;
  return Number(status) < 500;
}

export async function buildSttProbeRequest(input = {}) {
  const apiKey = String(input.apiKey || '').trim();
  const baseURL = String(input.baseURL || DEFAULT_STT_BASE_URL).replace(/\/$/, '');
  const protocol = inferSttProtocol(input.providerId, baseURL);
  if (protocol === 'iflytek-raasr') {
    const parsed = parseIflytekKey(apiKey);
    if (!parsed.ok) throw Object.assign(new Error(parsed.error), { code: 'BAD_INPUT' });
    const ts = String(Math.floor((input.now || Date.now()) / 1000));
    const signa = await iflytekSigna(parsed.appId, parsed.secret, ts);
    const url = `${sttProbeUrl(baseURL, 'iflytek')}?appId=${encodeURIComponent(parsed.appId)}&ts=${encodeURIComponent(ts)}&signa=${encodeURIComponent(signa)}&orderId=probe&resultType=transfer`;
    return { url, method: 'GET', headers: { Accept: 'application/json' } };
  }
  return {
    url: sttProbeUrl(baseURL, input.providerId),
    method: 'GET',
    headers: sttAuthHeaders(apiKey)
  };
}

/**
 * POST vendor-shaped transcription.
 * @returns {Promise<{ ok: true, text: string, language?: string|null, duration?: number|null, model: string } | { ok: false, code: string, error: string }>}
 */
export async function transcribeAudioFile(input = {}) {
  const apiKey = String(input.apiKey || '').trim();
  const model = String(input.model || DEFAULT_STT_MODEL).trim() || DEFAULT_STT_MODEL;
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  if (!apiKey) return fail('transcribe', 'STT_NOT_CONFIGURED', '转写 API Key 未配置');
  if (typeof fetchImpl !== 'function') return fail('transcribe', 'FETCH_UNAVAILABLE', 'fetch unavailable');

  let root;
  try {
    root = String(input.baseURL || DEFAULT_STT_BASE_URL).replace(/\/$/, '');
    assertSafeByokEndpointUrl(root, 'STT Base URL');
  } catch (error) {
    return fail(
      'transcribe',
      error?.code || 'INSECURE_ENDPOINT',
      redactSttError(error instanceof Error ? error.message : String(error), apiKey)
    );
  }

  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes || []);
  if (!bytes.byteLength) return fail('transcribe', 'BAD_INPUT', 'audio is empty');
  if (bytes.byteLength > STT_MAX_BYTES) {
    return fail('transcribe', 'TOO_LARGE', `audio exceeds ${STT_MAX_BYTES} bytes`);
  }

  const protocol = input.protocol || inferSttProtocol(input.provider, root);
  const ctx = {
    apiKey,
    model,
    bytes,
    root,
    fetchImpl,
    signal: input.signal,
    filename: input.filename,
    mimeType: input.mimeType,
    language: input.language,
    duration: input.duration
  };
  if (protocol === 'iflytek-raasr') return transcribeIflytekRaasr(ctx);
  if (protocol === 'dashscope-chat-asr') return transcribeDashscopeChat(ctx);
  if (protocol === 'ark-responses') return transcribeArkResponses(ctx);
  return transcribeOpenAiMultipart(ctx);
}

async function transcribeOpenAiMultipart(ctx) {
  let endpoint;
  try {
    endpoint = sttTranscriptionUrl(ctx.root);
    assertSafeByokEndpointUrl(endpoint, 'STT Base URL');
  } catch (error) {
    return fail(
      'transcribe',
      error?.code || 'INSECURE_ENDPOINT',
      redactSttError(error instanceof Error ? error.message : String(error), ctx.apiKey)
    );
  }
  const form = buildTranscriptionForm({
    bytes: ctx.bytes,
    filename: ctx.filename,
    mimeType: ctx.mimeType,
    model: ctx.model,
    language: ctx.language
  });
  return postTranscription(ctx, endpoint, {
    method: 'POST',
    headers: sttAuthHeaders(ctx.apiKey),
    body: form,
    signal: ctx.signal
  });
}

async function transcribeDashscopeChat(ctx) {
  let endpoint;
  try {
    endpoint = `${ctx.root}/chat/completions`;
    assertSafeByokEndpointUrl(endpoint, 'STT Base URL');
  } catch (error) {
    return fail('transcribe', error?.code || 'INSECURE_ENDPOINT', redactSttError(error.message, ctx.apiKey));
  }
  const asrOptions = { enable_itn: true };
  if (ctx.language) asrOptions.language = String(ctx.language);
  return postTranscription(ctx, endpoint, {
    method: 'POST',
    headers: { ...sttAuthHeaders(ctx.apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model || 'qwen3-asr-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: dataUrlForAudio(ctx.bytes, ctx.mimeType) }
            }
          ]
        }
      ],
      asr_options: asrOptions
    }),
    signal: ctx.signal
  });
}

async function transcribeArkResponses(ctx) {
  let endpoint;
  try {
    endpoint = `${ctx.root}/responses`;
    assertSafeByokEndpointUrl(endpoint, 'STT Base URL');
  } catch (error) {
    return fail('transcribe', error?.code || 'INSECURE_ENDPOINT', redactSttError(error.message, ctx.apiKey));
  }
  return postTranscription(ctx, endpoint, {
    method: 'POST',
    headers: { ...sttAuthHeaders(ctx.apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ctx.model,
      instructions: 'Transcribe the audio to plain text only.',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_audio',
              audio_url: dataUrlForAudio(ctx.bytes, ctx.mimeType)
            }
          ]
        }
      ]
    }),
    signal: ctx.signal
  });
}

async function transcribeIflytekRaasr(ctx) {
  const parsed = parseIflytekKey(ctx.apiKey);
  if (!parsed.ok) return fail('transcribe', 'BAD_INPUT', parsed.error);
  const sleep = typeof ctx.sleep === 'function'
    ? ctx.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const ts = String(Math.floor(Date.now() / 1000));
  let signa;
  try {
    signa = await iflytekSigna(parsed.appId, parsed.secret, ts);
  } catch (error) {
    return fail('transcribe', 'STT_HTTP', redactSttError(error instanceof Error ? error.message : String(error), ctx.apiKey));
  }
  const filename = encodeURIComponent(String(ctx.filename || 'clip.webm').replace(/[^\w.-]+/g, '_') || 'clip.webm');
  const duration = Math.max(1, Math.round(Number(ctx.duration) || 15));
  let uploadUrl;
  try {
    uploadUrl = `${ctx.root}/upload?appId=${encodeURIComponent(parsed.appId)}&ts=${encodeURIComponent(ts)}&signa=${encodeURIComponent(signa)}&fileName=${filename}&fileSize=${ctx.bytes.byteLength}&duration=${duration}`;
    assertSafeByokEndpointUrl(`${ctx.root}/upload`, 'STT Base URL');
  } catch (error) {
    return fail('transcribe', error?.code || 'INSECURE_ENDPOINT', redactSttError(error.message, ctx.apiKey));
  }
  let uploadRes;
  try {
    uploadRes = await ctx.fetchImpl(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', Accept: 'application/json' },
      body: ctx.bytes,
      signal: ctx.signal
    });
  } catch (error) {
    return fail('transcribe', error?.code || 'STT_HTTP', redactSttError(error instanceof Error ? error.message : String(error), ctx.apiKey));
  }
  const uploadRaw = await readResponseText(uploadRes);
  const uploadJson = parseJson(uploadRaw);
  const orderId = uploadJson?.content?.orderId || uploadJson?.orderId || '';
  if (!uploadRes?.ok || !orderId) {
    return fail('transcribe', 'STT_HTTP', redactSttError(`HTTP ${uploadRes?.status || ''} ${uploadRaw}`.trim(), ctx.apiKey));
  }
  for (let i = 0; i < 20; i++) {
    const qTs = String(Math.floor(Date.now() / 1000));
    const qSigna = await iflytekSigna(parsed.appId, parsed.secret, qTs);
    const queryUrl = `${ctx.root}/getResult?appId=${encodeURIComponent(parsed.appId)}&ts=${encodeURIComponent(qTs)}&signa=${encodeURIComponent(qSigna)}&orderId=${encodeURIComponent(orderId)}&resultType=transfer`;
    let queryRes;
    try {
      queryRes = await ctx.fetchImpl(queryUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctx.signal });
    } catch (error) {
      return fail('transcribe', error?.code || 'STT_HTTP', redactSttError(error instanceof Error ? error.message : String(error), ctx.apiKey));
    }
    const queryRaw = await readResponseText(queryRes);
    const parsedBody = parseTranscriptionBody(queryRaw);
    if (parsedBody.text) {
      return { ok: true, action: 'transcribe', text: parsedBody.text, language: parsedBody.language, duration: parsedBody.duration, model: ctx.model };
    }
    const status = Number(parseJson(queryRaw)?.content?.orderInfo?.status ?? parseJson(queryRaw)?.status);
    if (Number.isFinite(status) && status < 0) {
      return fail('transcribe', 'STT_HTTP', redactSttError(queryRaw, ctx.apiKey));
    }
    await sleep(400);
  }
  return fail('transcribe', 'STT_EMPTY', '讯飞转写超时');
}

async function postTranscription(ctx, endpoint, init) {
  let response;
  try {
    response = await ctx.fetchImpl(endpoint, init);
  } catch (error) {
    return fail(
      'transcribe',
      error?.code || 'STT_HTTP',
      redactSttError(error instanceof Error ? error.message : String(error), ctx.apiKey)
    );
  }
  const raw = await readResponseText(response);
  if (!response?.ok) {
    return fail(
      'transcribe',
      'STT_HTTP',
      redactSttError(`HTTP ${response?.status || ''} ${raw}`.trim(), ctx.apiKey)
    );
  }
  const parsed = parseTranscriptionBody(raw);
  if (!parsed.text) {
    return fail('transcribe', 'STT_EMPTY', 'transcription returned no text');
  }
  return {
    ok: true,
    action: 'transcribe',
    text: parsed.text,
    language: parsed.language,
    duration: parsed.duration,
    model: ctx.model
  };
}

function parseJson(raw) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return null;
  }
}

async function readResponseText(response) {
  if (!response) return '';
  try {
    if (typeof response.text === 'function') return await response.text();
  } catch {
    /* fall through */
  }
  return '';
}

export function parseTranscriptionBody(raw) {
  const s = String(raw || '').trim();
  if (!s) return { text: '', language: null, duration: null };
  try {
    const json = JSON.parse(s);
    const choice = json?.choices?.[0]?.message?.content;
    const ark = typeof json?.output_text === 'string' ? json.output_text : collectArkText(json?.output);
    const ifly = collectIflytekText(json);
    const text =
      (typeof json?.text === 'string' && json.text) ||
      (typeof json?.transcript === 'string' && json.transcript) ||
      (typeof choice === 'string' && choice) ||
      ark ||
      ifly ||
      '';
    const language = typeof json?.language === 'string' ? json.language : null;
    const duration = Number.isFinite(Number(json?.duration)) ? Number(json.duration) : null;
    return { text: String(text).trim(), language, duration };
  } catch {
    return { text: s, language: null, duration: null };
  }
}

function collectArkText(output) {
  if (!Array.isArray(output)) return '';
  const parts = [];
  for (const row of output) {
    const content = row?.content;
    if (typeof content === 'string') parts.push(content);
    else if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item?.text === 'string') parts.push(item.text);
        if (typeof item?.output_text === 'string') parts.push(item.output_text);
      }
    }
  }
  return parts.join('').trim();
}

function collectIflytekText(json) {
  const orderResult = json?.content?.orderResult || json?.orderResult;
  if (typeof orderResult === 'string' && orderResult.trim() && !orderResult.trim().startsWith('{')) {
    return orderResult.trim();
  }
  let parsed = orderResult;
  if (typeof orderResult === 'string') {
    try { parsed = JSON.parse(orderResult); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') return '';
  const lattice = Array.isArray(parsed.lattice) ? parsed.lattice : [];
  const bits = [];
  for (const row of lattice) {
    const json1best = row?.json_1best;
    let best = json1best;
    if (typeof json1best === 'string') {
      try { best = JSON.parse(json1best); } catch { best = null; }
    }
    const ws = best?.st?.rt?.[0]?.ws;
    if (!Array.isArray(ws)) continue;
    for (const word of ws) {
      const cw = word?.cw;
      if (Array.isArray(cw)) {
        for (const c of cw) {
          if (typeof c?.w === 'string') bits.push(c.w);
        }
      }
    }
  }
  return bits.join('').trim();
}

/**
 * Resolve guest path / artifact / public audio URL, then transcribe.
 */
export async function transcribeAcquire(ctx, input = {}) {
  const settings = normalizeWebAcquireSettings(ctx.webAcquire);
  if (!settings.sttKey) {
    return fail(
      'transcribe',
      'STT_NOT_CONFIGURED',
      '转写 API Key 未配置。请在设置 → 转写 / 听写中填写。'
    );
  }

  const source = await resolveTranscribeSource(ctx, input);
  if (!source.ok) return source;

  const result = await transcribeAudioFile({
    apiKey: settings.sttKey,
    baseURL: settings.sttBaseURL,
    model: String(input.model || settings.sttModel || DEFAULT_STT_MODEL).trim(),
    provider: settings.sttProvider,
    bytes: source.bytes,
    filename: source.filename,
    mimeType: source.mimeType,
    language: input.language,
    fetchImpl: ctx.fetchImpl || globalThis.fetch,
    signal: ctx.signal
  });
  if (!result.ok) return result;

  if (ctx.fs && typeof ctx.fs.writeFile === 'function') {
    try {
      if (typeof ctx.fs.mkdirp === 'function') ctx.fs.mkdirp('/scratch/sources');
    } catch {
      /* writeFile will surface the real error */
    }
    const outName = sanitizeName(input.filename || `transcribe_${Date.now().toString(36)}.txt`);
    const path = outName.startsWith('/scratch/')
      ? outName
      : `/scratch/sources/${outName.endsWith('.txt') ? outName : `${outName.replace(/\.[a-z0-9]+$/i, '')}.txt`}`;
    ctx.fs.writeFile(path, result.text, { mimeType: 'text/plain' });
    return {
      ok: true,
      action: 'transcribe',
      path,
      text: clip(result.text, 8000),
      language: result.language,
      duration: result.duration,
      model: result.model,
      source: source.kind,
      bytes: source.bytes.byteLength
    };
  }

  return {
    ok: true,
    action: 'transcribe',
    text: clip(result.text, 8000),
    language: result.language,
    duration: result.duration,
    model: result.model,
    source: source.kind,
    bytes: source.bytes.byteLength
  };
}

async function resolveTranscribeSource(ctx, input) {
  const path = String(input.path || '').trim();
  const artifactId = String(input.artifactId || '').trim();
  const url = String(input.url || '').trim();
  if (!path && !artifactId && !url) {
    return fail(
      'transcribe',
      'MISSING_AUDIO',
      'transcribe needs path, artifactId, or a public http(s) audio url'
    );
  }

  if (path) {
    if (!ctx.fs || typeof ctx.fs.readFileBytes !== 'function') {
      return fail('transcribe', 'FS_DENIED', 'guest filesystem is unavailable');
    }
    const gate = assertUploadGuestPath(path);
    if (!gate.ok) return fail('transcribe', gate.code, gate.error);
    let bytes;
    try {
      bytes = ctx.fs.readFileBytes(gate.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/ENOENT/i.test(message)) return fail('transcribe', 'ENOENT', message);
      if (/FS_DENIED/i.test(message)) return fail('transcribe', 'FS_DENIED', message);
      return fail('transcribe', 'BAD_INPUT', message);
    }
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || []);
    if (!bytes.byteLength) return fail('transcribe', 'BAD_INPUT', 'audio file is empty');
    if (bytes.byteLength > STT_MAX_BYTES) {
      return fail('transcribe', 'TOO_LARGE', `audio exceeds ${STT_MAX_BYTES} bytes`);
    }
    return {
      ok: true,
      kind: 'path',
      path: gate.path,
      bytes,
      filename: fileNameFromPath(gate.path),
      mimeType: guessAudioMime(gate.path)
    };
  }

  if (artifactId) {
    if (!ctx.store || !ctx.sessionId) {
      return fail('transcribe', 'BAD_INPUT', 'artifactId requires a session store');
    }
    const rec = ctx.store.get('artifacts', artifactId);
    if (!rec || String(rec.sessionId) !== String(ctx.sessionId)) {
      return fail('transcribe', rec ? 'AUTH_DENIED' : 'NOT_FOUND', rec ? 'artifact not owned' : 'artifact not found');
    }
    const primary = String(rec.primaryPath || '');
    const gate = assertUploadGuestPath(primary);
    if (!gate.ok) return fail('transcribe', gate.code, gate.error);
    if (!ctx.fs || typeof ctx.fs.readFileBytes !== 'function') {
      return fail('transcribe', 'FS_DENIED', 'guest filesystem is unavailable');
    }
    let bytes;
    try {
      bytes = ctx.fs.readFileBytes(gate.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail('transcribe', /ENOENT/i.test(message) ? 'ENOENT' : 'BAD_INPUT', message);
    }
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || []);
    if (!bytes.byteLength) return fail('transcribe', 'BAD_INPUT', 'audio file is empty');
    if (bytes.byteLength > STT_MAX_BYTES) {
      return fail('transcribe', 'TOO_LARGE', `audio exceeds ${STT_MAX_BYTES} bytes`);
    }
    return {
      ok: true,
      kind: 'artifact',
      artifactId,
      path: gate.path,
      bytes,
      filename: rec.name || fileNameFromPath(gate.path),
      mimeType: rec.mimeType || guessAudioMime(gate.path)
    };
  }

  const gate = assertPublicHttpUrl(url);
  if (!gate.ok) return fail('transcribe', gate.code || 'NET_DENIED', gate.error);
  const fetchImpl = ctx.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return fail('transcribe', 'FETCH_UNAVAILABLE', 'fetch unavailable');
  let response;
  try {
    response = await fetchImpl(gate.url.href, { credentials: 'omit', signal: ctx.signal });
  } catch (error) {
    return fail('transcribe', 'STT_HTTP', error instanceof Error ? error.message : String(error));
  }
  if (!response?.ok) {
    return fail('transcribe', 'STT_HTTP', `HTTP ${response?.status || ''} fetching audio`.trim());
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  if (!buf.byteLength) return fail('transcribe', 'BAD_INPUT', 'audio url returned empty body');
  if (buf.byteLength > STT_MAX_BYTES) {
    return fail('transcribe', 'TOO_LARGE', `audio exceeds ${STT_MAX_BYTES} bytes`);
  }
  const contentType = response.headers?.get?.('content-type') || '';
  const filename = sanitizeName(input.filename || fileNameFromUrl(gate.url) || 'audio.wav');
  return {
    ok: true,
    kind: 'url',
    url: gate.url.href,
    bytes: buf,
    filename,
    mimeType: contentType.split(';')[0].trim() || guessAudioMime(filename)
  };
}

function fileNameFromPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts[parts.length - 1] || 'audio.wav';
}

function fileNameFromUrl(url) {
  const base = String(url?.pathname || '').split('/').filter(Boolean).at(-1);
  return base && AUDIO_EXT.test(base) ? base : 'audio.wav';
}
