/**
 * Playwright proof of Paw Slides present motion. Soft-skips if Chromium
 * cannot launch promptly. OOXML assertions live in test_paw_canvas_pptx_export.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSemanticDeck, QA_DECK_DIR } from './harness/seed_semantic_deck.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'artifacts/pptx-e2e');
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/tests/session-workspace/harness/semantic-deck.html';
      const file = path.normalize(path.join(root, rel.replace(/^\//, '')));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500);
          res.end(String(err.message));
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

function writeSkip(reason) {
  fs.writeFileSync(path.join(outDir, 'present-live.txt'), `skipped: ${reason}\n`);
  console.log('test_slides_present_live: skipped', reason);
}

await seedSemanticDeck();
let playwright;
try {
  playwright = await import('playwright');
} catch {
  writeSkip('playwright module missing');
  process.exit(0);
}
if (!playwright?.chromium) {
  writeSkip('playwright.chromium missing');
  process.exit(0);
}

let browser;
try {
  browser = await playwright.chromium.launch({ headless: true, timeout: 8000 });
} catch (err) {
  writeSkip(err instanceof Error ? err.message : String(err));
  process.exit(0);
}

const { server, origin } = await startServer();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}/tests/session-workspace/harness/semantic-deck.html?view=page&frame=shape:slide-1`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });
  await page.waitForFunction(() => window.__pawQa?.mounted && window.__pawQa?.presenter, { timeout: 20000 });
  const before = await page.evaluate(() => window.__pawQa.presenter.snapshotBytes());
  await page.evaluate(async () => {
    await window.__pawQa.presenter.enter();
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, 'present-enter.png') });
  const mid = Date.now();
  await page.evaluate(async () => window.__pawQa.presenter.step(1));
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outDir, `present-crossfade-${mid}.png`) });
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(outDir, 'present-slide-2.png') });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  await page.mouse.click(720, 450);
  await page.waitForTimeout(360);
  await page.screenshot({ path: path.join(outDir, 'present-after-nav.png') });
  const afterPresent = await page.evaluate(() => ({
    present: window.__pawPresent,
    after: window.__pawQa.presenter.snapshotBytes()
  }));
  await page.evaluate(() => window.__pawQa.presenter.exit());
  const afterExit = await page.evaluate(() => window.__pawQa.presenter.snapshotBytes());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    await window.__pawQa.presenter.enter();
    await window.__pawQa.presenter.step(1);
    window.__pawQa.presenter.exit();
  });
  const reduced = await page.evaluate(() => window.__pawPresent?.reduced);
  fs.writeFileSync(
    path.join(outDir, 'present-live.json'),
    JSON.stringify(
      {
        storeUnchangedDuring: before === afterPresent.after,
        storeUnchangedAfterExit: before === afterExit,
        lastTransition: afterPresent.present?.lastTransition || '',
        reduced,
        shots: ['present-enter.png', 'present-slide-2.png', 'present-after-nav.png']
      },
      null,
      2
    )
  );
  assert.equal(before, afterPresent.after, 'present must not mutate store bytes');
  assert.equal(before, afterExit, 'exit must not mutate store bytes');
  assert.ok(fs.existsSync(path.join(outDir, 'present-enter.png')));
  console.log('test_slides_present_live: ok');
} finally {
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
