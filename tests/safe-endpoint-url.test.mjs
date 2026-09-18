import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeByokEndpointUrl,
  isLoopbackHost,
  isSafeByokEndpointUrl,
  redactSecretsInText
} from '../src/agent/safeEndpointUrl.js';
import { createExtensionFetch } from '../src/agent/provider.js';
import { probeOpenAICompatibleApi } from '../src/agent/modelCatalog.js';
import { normalizeWebAcquireSettings } from '../src/agent/webAcquireSettings.js';

test('loopback hosts allow local http models', () => {
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('127.0.0.8'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.equal(isLoopbackHost('[::1]'), true);
  assert.equal(isLoopbackHost('example.com'), false);
  assert.equal(isLoopbackHost('192.168.1.10'), false);
});

test('remote http and ws BYOK URLs are rejected', () => {
  assert.equal(isSafeByokEndpointUrl('https://api.deepseek.com/v1'), true);
  assert.equal(isSafeByokEndpointUrl('http://localhost:11434/v1'), true);
  assert.equal(isSafeByokEndpointUrl('http://127.0.0.1:1234/v1'), true);
  assert.equal(isSafeByokEndpointUrl('http://[::1]:11434/v1'), true);
  assert.equal(isSafeByokEndpointUrl('http://evil.example/v1'), false);
  assert.equal(isSafeByokEndpointUrl('ws://evil.example/v1'), false);
  assert.equal(isSafeByokEndpointUrl('ws://localhost:8080'), false);
  assert.equal(isSafeByokEndpointUrl('https://user:sk-secret@api.example.com/v1'), false);
  assert.throws(
    () => assertSafeByokEndpointUrl('http://evil.example/v1', 'Provider Base URL'),
    (err) => err?.code === 'INSECURE_ENDPOINT'
  );
});

test('redactSecretsInText strips keys and Bearer tokens', () => {
  assert.equal(
    redactSecretsInText('bad key sk-abcdefghijklmnop and Bearer abcdefghijklmnopqrst', ['tvly-secretkey']),
    'bad key [REDACTED] and [REDACTED]'
  );
  assert.equal(redactSecretsInText('ok tvly-secretkey', ['tvly-secretkey']), 'ok [REDACTED]');
});

test('createExtensionFetch does not send Authorization over remote http', async () => {
  let called = false;
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  try {
    const fetchImpl = createExtensionFetch();
    await assert.rejects(
      () =>
        fetchImpl('http://evil.example/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: 'Bearer sk-secret-key-value' },
          body: '{}'
        }),
      (err) => err?.code === 'INSECURE_ENDPOINT' && called === false
    );
  } finally {
    globalThis.fetch = prev;
  }
});

test('probeOpenAICompatibleApi refuses remote http before GET /models', async () => {
  let called = false;
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  try {
    const probe = await probeOpenAICompatibleApi('http://evil.example/v1', 'sk-secret-key-value');
    assert.equal(probe.ok, false);
    assert.equal(called, false);
    assert.match(String(probe.error || ''), /HTTPS/i);
    assert.equal(String(probe.error || '').includes('sk-secret-key-value'), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test('unsafe acquire bases fall back to official HTTPS', () => {
  const got = normalizeWebAcquireSettings({
    tavilyBaseURL: 'http://evil.example',
    firecrawlBaseURL: 'ws://evil.example',
    tavilyKey: 'tvly-x'
  });
  assert.equal(got.tavilyBaseURL, 'https://api.tavily.com');
  assert.equal(got.firecrawlBaseURL, 'https://api.firecrawl.dev');
});
