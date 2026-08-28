/**
 * Wave 10 — acquire search/fetch BYOK (Tavily default, Brave optional, Firecrawl fetch).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { acquire } from '../../../src/agent/vnext/primitives/acquire.js';
import { shouldTryFirecrawl } from '../../../src/agent/vnext/primitives/webFetch.js';
import { searchApiConfigured } from '../../../src/agent/webAcquireSettings.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

function memFs() {
  const files = new Map();
  return {
    files,
    async mkdir() {},
    async writeFile(p, data) {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      files.set(p, bytes);
    }
  };
}

{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const acq = fs.readFileSync(path.join(root, 'src/agent/vnext/primitives/acquire.js'), 'utf8');
  const tools = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/tools.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
  record(
    'no-html-scrape-search-fallback',
    !/html\.duckduckgo/.test(acq) && /SEARCH_NOT_CONFIGURED|runConfiguredSearch/.test(acq),
    ''
  );
  record(
    'model-sees-acquire-not-vendor-tools',
    /Actions: search, fetch, map, crawl, image, note/.test(tools) &&
      !/name:\s*'tavily'/.test(tools) &&
      !/name:\s*'firecrawl'/.test(tools),
    ''
  );
  record(
    'settings-has-tavily-brave-firecrawl',
    /tavilyKeyInput/.test(html) && /braveKeyInput/.test(html) && /firecrawlKeyInput/.test(html),
    ''
  );
  record(
    'settings-vendor-cards',
    /inferenceVendorList/.test(html) && /imageVendorList/.test(html) && /webVendorList/.test(html),
    ''
  );
  record(
    'settings-dead-ui-removed',
    !/唯一产品路径/.test(html) && !/planModeToggleBtn/.test(html) && !/id="downloadTrajectoryBtn"/.test(html),
    ''
  );
  record('default-search-is-tavily', searchApiConfigured({ searchProvider: 'tavily', tavilyKey: 'x' }), '');
  record(
    'search-off-without-key',
    !searchApiConfigured({ searchProvider: 'tavily', tavilyKey: '' }),
    ''
  );
  record(
    'firecrawl-key-enables-search',
    searchApiConfigured({ searchProvider: 'tavily', tavilyKey: '', firecrawlKey: 'fc-x' }),
    ''
  );
  record(
    'tools-describe-map-crawl-without-vendor',
    /Actions: search, fetch, map, crawl, image, note/.test(tools) &&
      /host-capped/.test(tools) &&
      !/Firecrawl|Tavily|Brave/i.test(tools),
    ''
  );
}

{
  let hits = 0;
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => { hits += 1; return { ok: false }; }, webAcquire: { tavilyKey: 'x' } },
    { action: 'search' }
  );
  record(
    'search-without-query-does-not-hit-network',
    r.ok === false && r.code === 'MISSING_QUERY' && hits === 0,
    JSON.stringify(r)
  );
}

{
  let hits = 0;
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => { hits += 1; return { ok: false }; }, webAcquire: { firecrawlKey: 'fc-x' } },
    { action: 'fetch' }
  );
  record(
    'fetch-without-url-does-not-hit-network',
    r.ok === false && r.code === 'MISSING_URL' && hits === 0,
    JSON.stringify(r)
  );
}

{
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => ({ ok: false }), webAcquire: { firecrawlKey: 'fc-x' } },
    { action: 'map' }
  );
  record('map-without-url', r.ok === false && r.code === 'MISSING_URL', JSON.stringify(r));
}

{
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => ({ ok: false }), webAcquire: { firecrawlKey: 'fc-x' } },
    { action: 'crawl' }
  );
  record('crawl-without-url', r.ok === false && r.code === 'MISSING_URL', JSON.stringify(r));
}

{
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => ({ ok: false }), webAcquire: { searchProvider: 'tavily' } },
    { action: 'search', query: 'office chairs' }
  );
  record(
    'search-without-key-is-configured-error',
    r.ok === false && r.code === 'SEARCH_NOT_CONFIGURED',
    JSON.stringify(r)
  );
}

{
  const urls = [];
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { searchProvider: 'tavily', tavilyKey: 'tvly-test' },
      fetchImpl: async (url, init) => {
        urls.push(String(url));
        const body = JSON.parse(init.body || '{}');
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                title: 'Chair guide',
                url: 'https://example.com/chairs',
                content: 'Ergonomic office chairs 2026'
              }
            ]
          })
        };
      }
    },
    { action: 'search', query: 'ergonomic office chair' }
  );
  record(
    'tavily-search-returns-hits',
    r.ok && r.provider === 'tavily' && r.results?.[0]?.url === 'https://example.com/chairs' &&
      urls.some((u) => /tavily\.com\/search/.test(u)),
    `ok=${r.ok} n=${r.results?.length}`
  );
}

{
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { searchProvider: 'brave', braveKey: 'BSA-test' },
      fetchImpl: async (url) => {
        if (!String(url).includes('api.search.brave.com')) return { ok: false, status: 500 };
        return {
          ok: true,
          json: async () => ({
            web: { results: [{ title: 'Brave hit', url: 'https://brave.example/hit', description: 'ok' }] }
          })
        };
      }
    },
    { action: 'search', query: 'test' }
  );
  record(
    'brave-search-optional-provider',
    r.ok && r.provider === 'brave' && r.results?.[0]?.title === 'Brave hit',
    JSON.stringify(r.results?.[0] || r)
  );
}

{
  record('firecrawl-skips-png', shouldTryFirecrawl('https://cdn.example.com/a.png') === false, '');
  record('firecrawl-tries-html', shouldTryFirecrawl('https://example.com/blog/post') === true, '');
}

{
  const store = memFs();
  const r = await acquire(
    {
      fs: store,
      webAcquire: { firecrawlKey: 'fc-test', firecrawlBaseURL: 'https://api.firecrawl.dev' },
      fetchImpl: async (url, init) => {
        if (String(url).includes('/scrape')) {
          return {
            ok: true,
            json: async () => ({ data: { markdown: '# Hello\n\nPublic docs body.' } })
          };
        }
        return { ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => '' } };
      }
    },
    { action: 'fetch', url: 'https://docs.example.com/guide' }
  );
  const written = [...store.files.values()][0];
  const text = written ? new TextDecoder().decode(written) : '';
  record(
    'fetch-uses-firecrawl-markdown',
    r.ok && r.source === 'firecrawl' && /Public docs body/.test(text) && r.mediaType === 'text/markdown',
    `source=${r.source} media=${r.mediaType}`
  );
}

{
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { firecrawlKey: 'fc-test' },
      fetchImpl: async (url) => {
        if (String(url).includes('firecrawl')) {
          return { ok: false, status: 500, text: async () => 'down' };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/plain' },
          arrayBuffer: async () => new TextEncoder().encode('RAW_FALLBACK').buffer
        };
      }
    },
    { action: 'fetch', url: 'https://example.com/data.txt' }
  );
  record(
    'fetch-falls-back-to-http-when-firecrawl-fails',
    r.ok && r.source === 'http' && r.preview?.includes('RAW_FALLBACK'),
    `source=${r.source}`
  );
}

{
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { firecrawlKey: 'fc-test', firecrawlBaseURL: 'https://api.firecrawl.dev' },
      fetchImpl: async (url, init) => {
        if (!String(url).includes('/v2/search') && !String(url).includes('/v1/search')) {
          return { ok: false, status: 500 };
        }
        const body = JSON.parse(init.body || '{}');
        if (body.scrapeOptions || body.scrape_options) {
          return { ok: false, status: 400, text: async () => 'must not scrape every hit' };
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              web: [{ url: 'https://example.com/fc', title: 'FC hit', description: 'from search' }]
            }
          })
        };
      }
    },
    { action: 'search', query: 'only firecrawl key' }
  );
  record(
    'firecrawl-only-key-can-search',
    r.ok && r.provider === 'firecrawl' && r.results?.[0]?.url === 'https://example.com/fc',
    JSON.stringify(r.results?.[0] || r)
  );
}

{
  const r = await acquire(
    { fs: memFs(), fetchImpl: async () => ({ ok: false }), webAcquire: {} },
    { action: 'map', url: 'https://docs.example.com' }
  );
  record(
    'map-without-key-is-configured-error',
    r.ok === false && r.code === 'SITE_READ_NOT_CONFIGURED',
    JSON.stringify(r)
  );
}

{
  const posted = [];
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { firecrawlKey: 'fc-test', firecrawlBaseURL: 'https://api.firecrawl.dev' },
      fetchImpl: async (url, init) => {
        posted.push({ url: String(url), method: init?.method, body: init?.body });
        if (String(url).includes('/v2/map')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              links: [
                { url: 'https://docs.example.com/a', title: 'A', description: 'one' },
                { url: 'https://docs.example.com/b', title: 'B', description: 'two' }
              ]
            })
          };
        }
        return { ok: false, status: 404 };
      }
    },
    { action: 'map', url: 'https://docs.example.com' }
  );
  record(
    'map-lists-site-urls',
    r.ok && r.count === 2 && r.links?.[0]?.url === 'https://docs.example.com/a',
    JSON.stringify(r.links?.[0] || r)
  );
}

{
  const posted = [];
  let polls = 0;
  const r = await acquire(
    {
      fs: memFs(),
      webAcquire: { firecrawlKey: 'fc-test', firecrawlBaseURL: 'https://api.firecrawl.dev' },
      fetchImpl: async (url, init) => {
        posted.push({ url: String(url), body: init?.body });
        if (init?.method === 'POST' && String(url).includes('/crawl')) {
          const body = JSON.parse(init.body || '{}');
          if (Number(body.limit) > 8) {
            return { ok: false, status: 400, text: async () => 'limit too high' };
          }
          return { ok: true, json: async () => ({ success: true, id: 'job-1' }) };
        }
        if (String(url).includes('/crawl/job-1')) {
          polls += 1;
          if (polls === 1) {
            return { ok: true, json: async () => ({ status: 'scraping', data: [] }) };
          }
          return {
            ok: true,
            json: async () => ({
              status: 'completed',
              data: [
                {
                  markdown: '# Page',
                  metadata: { sourceURL: 'https://docs.example.com/a', title: 'A' }
                }
              ]
            })
          };
        }
        return { ok: false, status: 404 };
      }
    },
    { action: 'crawl', url: 'https://docs.example.com', limit: 10000 }
  );
  const start = posted.find((p) => p.body && String(p.url).includes('/crawl') && !String(p.url).includes('job-1'));
  const startLimit = start ? JSON.parse(start.body).limit : null;
  record(
    'crawl-is-host-capped-and-polls',
    r.ok && r.count === 1 && startLimit === 8 && polls >= 2,
    `count=${r.count} limit=${startLimit} polls=${polls}`
  );
}

console.log(`\nwave10 summary: breaches=${failed}`);
if (failed) process.exit(1);
console.log('WAVE10 PASS: Tavily search + Firecrawl fetch/map/crawl');
