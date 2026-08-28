/**
 * Optional Playwright evidence for packaged site motion.
 * Skips cleanly when Chromium is missing or slow to start.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = path.join(root, 'artifacts', 'qa-site-motion');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json'
};

export async function captureSiteMotion(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 8000);
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return { skipped: true, reason: 'playwright-package-missing' };
  }
  if (!playwright?.chromium) return { skipped: true, reason: 'chromium-missing' };

  const server = await listenRepo(root);
  let browser;
  try {
    browser = await Promise.race([
      playwright.chromium.launch({ headless: true }),
      sleepReject(timeoutMs, 'chromium-launch-timeout')
    ]);
    const page = await browser.newPage();
    await page.goto(`${server.url}/tests/session-workspace/harness/site_motion_lab.html`, {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    });
    await page.waitForFunction(() => window.__lab?.handle, { timeout: timeoutMs });
    fs.mkdirSync(outDir, { recursive: true });
    const shot = path.join(outDir, 'lab.png');
    await page.screenshot({ path: shot, fullPage: true });
    const videoDir = path.join(outDir, 'trace');
    const context = page.context();
    const evidence = await page.evaluate(async () => {
      const doc = document.getElementById('host').contentDocument;
      const next = doc.querySelector('[data-paw-carousel-next]');
      const before = [...doc.querySelectorAll('[data-paw-carousel-item]')].findIndex((el) =>
        el.classList.contains('paw-is-active')
      );
      next.click();
      const after = [...doc.querySelectorAll('[data-paw-carousel-item]')].findIndex((el) =>
        el.classList.contains('paw-is-active')
      );
      const scripts = doc.querySelectorAll('script').length;
      const handle = window.__lab.handle;
      handle.destroy();
      return {
        before,
        after,
        scripts,
        guest: {
          script: !!doc.defaultView.__guestScriptRan,
          module: !!doc.defaultView.__guestModuleRan,
          onclick: !!doc.defaultView.__onclickRan
        },
        destroyed: handle.stats
      };
    });
    const afterShot = path.join(outDir, 'lab-after-next.png');
    await page.screenshot({ path: afterShot, fullPage: true });
    fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify({ evidence, shot, afterShot }, null, 2));
    void context;
    void videoDir;
    return { skipped: false, evidence, shot, afterShot, outDir };
  } catch (e) {
    return { skipped: true, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    try {
      await browser?.close();
    } catch {
      /* ignore */
    }
    await server.close();
  }
}

function listenRepo(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
      const file = path.resolve(dir, rel);
      const rootDir = path.resolve(dir);
      if (!file.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end('missing');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          })
      });
    });
    server.on('error', reject);
  });
}

function sleepReject(ms, reason) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(reason)), ms);
  });
}

