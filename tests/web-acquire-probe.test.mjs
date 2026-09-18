import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firecrawlCreditUsageUrls,
  firecrawlAuthHeaders,
  summarizeFirecrawlCreditUsage,
  tavilySearchProbeUrl,
  tavilySearchProbeBody,
  braveSearchProbeUrl,
  braveSearchProbeHeaders,
  normalizeWebAcquireSettings,
  sttModelsUrl,
  sttProbeUrl,
  inferSttProtocol,
  DEFAULT_STT_BASE_URL
} from '../src/agent/webAcquireSettings.js';

test('Firecrawl credit-usage URLs try v2 then v1', () => {
  assert.deepEqual(firecrawlCreditUsageUrls('https://api.firecrawl.dev/'), [
    'https://api.firecrawl.dev/v2/team/credit-usage',
    'https://api.firecrawl.dev/v1/team/credit-usage'
  ]);
});

test('summarizeFirecrawlCreditUsage reads v2 remainingCredits', () => {
  const got = summarizeFirecrawlCreditUsage({
    success: true,
    data: { remainingCredits: 42, planCredits: 100 }
  });
  assert.deepEqual(got, { ok: true, remaining: 42, plan: 100 });
});

test('summarizeFirecrawlCreditUsage reads v1 remaining_credits', () => {
  const got = summarizeFirecrawlCreditUsage({
    success: true,
    data: { remaining_credits: 7 }
  });
  assert.equal(got.ok, true);
  assert.equal(got.remaining, 7);
});

test('summarizeFirecrawlCreditUsage rejects success:false', () => {
  const got = summarizeFirecrawlCreditUsage({ success: false, data: { remainingCredits: 1 } });
  assert.equal(got.ok, false);
});

test('Firecrawl probe uses Bearer auth', () => {
  assert.equal(firecrawlAuthHeaders('fc-test').Authorization, 'Bearer fc-test');
});

test('Tavily probe is a tiny search POST', () => {
  assert.equal(tavilySearchProbeUrl('https://api.tavily.com/'), 'https://api.tavily.com/search');
  assert.deepEqual(tavilySearchProbeBody('tvly-x'), {
    api_key: 'tvly-x',
    query: 'ping',
    max_results: 1,
    search_depth: 'basic'
  });
});

test('remote http acquire bases are not kept', () => {
  const got = normalizeWebAcquireSettings({
    tavilyBaseURL: 'http://proxy.invalid',
    firecrawlBaseURL: 'http://proxy.invalid/v1',
    sttBaseURL: 'http://proxy.invalid/v1'
  });
  assert.equal(got.tavilyBaseURL, 'https://api.tavily.com');
  assert.equal(got.firecrawlBaseURL, 'https://api.firecrawl.dev');
  assert.equal(got.sttBaseURL, DEFAULT_STT_BASE_URL);
});

test('STT models probe is GET /models on the OpenAI-compatible root', () => {
  assert.equal(sttModelsUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1/models');
  assert.equal(sttProbeUrl('https://api.groq.com/openai/v1', 'groq'), 'https://api.groq.com/openai/v1/models');
  assert.equal(sttProbeUrl('https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen'), 'https://dashscope.aliyuncs.com/compatible-mode/v1/models');
  assert.equal(inferSttProtocol('groq', 'https://api.groq.com/openai/v1'), 'openai-transcriptions');
});

test('Brave probe is a tiny web search GET', () => {
  assert.equal(
    braveSearchProbeUrl('https://api.search.brave.com'),
    'https://api.search.brave.com/res/v1/web/search?q=ping&count=1'
  );
  assert.equal(braveSearchProbeHeaders('BSA')['X-Subscription-Token'], 'BSA');
});
