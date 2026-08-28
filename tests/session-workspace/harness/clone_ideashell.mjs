/**
 * Live IdeaShell clone evidence via the model-callable `web act=clone` surface.
 * Skips promptly when fetch or Playwright is unavailable.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { listArtifacts } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { rewriteGuestImageSrcs } from '../../../src/agent/vnext/sessionWorkspace/htmlMedia.js';
import { assessSiteClone } from '../../../src/agent/vnext/sessionWorkspace/siteQa.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGET = 'https://ideashell.com/';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json'
};

export async function cloneIdeaShellEvidence(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 45000);
  const outDir = path.join(root, 'artifacts', 'qa-ideashell-clone');
  fs.mkdirSync(outDir, { recursive: true });
  const started = Date.now();
  try {
    const store = new SessionWorkspaceStore();
    const runtime = createSessionWorkspaceRuntime(store);
    runtime.createSession({ sessionId: 's-ideashell-live' });
    const execution = beginExecution(store, 's-ideashell-live', {});
    const guest = createSessionGuestFs(store, {
      sessionId: 's-ideashell-live',
      executionId: execution.executionId
    });
    guest.mkdirp('/artifacts');
    const tools = createSessionTools({
      store,
      execution,
      fs: guest,
      sessionId: 's-ideashell-live',
      fetchImpl: globalThis.fetch.bind(globalThis)
    });
    const cloned = await withTimeout(
      tools.web.execute({
        act: 'clone',
        source: 'url',
        url: TARGET,
        viewport: { width: 1440, height: 900 },
        assets: 'bundle',
        motion: 'declarative'
      }),
      timeoutMs,
      'clone-timeout'
    );
    if (!cloned?.ok) {
      const reason = cloned?.error || cloned?.code || 'clone-failed';
      writeJson(path.join(outDir, 'evidence.json'), { skipped: true, reason, cloned });
      return { skipped: true, reason, ok: false };
    }
    const html = guest.readFile(cloned.path);
    const painted = rewriteGuestImageSrcs(html, guest, store, 's-ideashell-live');
    fs.writeFileSync(path.join(outDir, 'site.html'), html, 'utf8');
    fs.writeFileSync(path.join(outDir, 'painted.html'), painted, 'utf8');
    dumpGuestAssets(guest, cloned.path, path.join(outDir, 'assets'), cloned.report?.bundledAssets);
    writeJson(path.join(outDir, 'clone-result.json'), {
      ok: cloned.ok,
      artifactId: cloned.artifactId,
      path: cloned.path,
      report: cloned.report,
      partial: cloned.partial,
      elapsedMs: Date.now() - started
    });
    const htmlFiles = listArtifacts(store, 's-ideashell-live').filter((a) => /\.html$/i.test(a.name || a.primaryPath || ''));
    const facts = {
      url: cloned.report?.url || TARGET,
      locale: cloned.report?.locale,
      title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '',
      lang: (/<html\b[^>]*lang=["']([^"']+)/i.exec(html) || [])[1] || '',
      bundled: cloned.report?.bundled,
      unresolved: cloned.report?.unresolved,
      cssBytes: cloned.report?.cssBytes,
      hasHero: /Any idea, captured|Your AI Thinking Partner/i.test(html),
      hasNeverMiss: /Never miss an idea/i.test(html),
      hasChinese: /不仅是记录|闪念贝壳/.test(String(html).replace(/<!--[\s\S]*?-->/g, '')),
      carousel: /data-paw-carousel/.test(html),
      remoteCss: /<link[^>]+stylesheet/i.test(html),
      scripts: /<script\b/i.test(html)
    };
    writeJson(path.join(outDir, 'fetched-facts.json'), facts);

    let shots = {};
    let renderedQa = null;
    let playwright;
    try {
      playwright = await import('playwright');
    } catch {
      writeJson(path.join(outDir, 'evidence.json'), {
        skippedBrowser: true,
        reason: 'playwright-package-missing',
        facts,
        report: cloned.report
      });
      return {
        skipped: false,
        ok: true,
        artifactCount: htmlFiles.length,
        url: facts.url,
        shots: {},
        report: cloned.report
      };
    }
    const server = await listenDir(root);
    let browser;
    try {
      browser = await Promise.race([
        playwright.chromium.launch({ headless: true }),
        sleepReject(Math.min(timeoutMs, 12000), 'chromium-launch-timeout')
      ]);
      const page = await browser.newPage();
      shots.target1440 = path.join(outDir, 'target-1440.png');
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 20000) });
        await page.waitForTimeout(800);
        await page.screenshot({ path: shots.target1440, fullPage: false });
        shots.targetLive = true;
      } catch (e) {
        shots.targetLive = false;
        shots.targetError = e instanceof Error ? e.message : String(e);
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${server.url}/tests/session-workspace/harness/ideashell_clone_lab.html`, {
        waitUntil: 'networkidle',
        timeout: Math.min(timeoutMs, 20000)
      });
      await page.waitForFunction(() => window.__cloneLab?.ready, { timeout: Math.min(timeoutMs, 15000) });
      shots.clone1440 = path.join(outDir, 'clone-1440.png');
      await page.screenshot({ path: shots.clone1440, fullPage: false });
      await page.setViewportSize({ width: 420, height: 900 });
      await page.waitForTimeout(200);
      shots.clone420 = path.join(outDir, 'clone-420.png');
      await page.screenshot({ path: shots.clone420, fullPage: false });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => window.__cloneLab.snapshot());
      await page.evaluate(() => window.__cloneLab.next());
      await page.waitForTimeout(600);
      shots.cloneAfterNext = path.join(outDir, 'clone-after-next.png');
      await page.screenshot({ path: shots.cloneAfterNext, fullPage: false });
      const afterNext = await page.evaluate(() => window.__cloneLab.snapshot());
      await page.waitForTimeout(5200);
      shots.cloneAutoplay = path.join(outDir, 'clone-autoplay.png');
      await page.screenshot({ path: shots.cloneAutoplay, fullPage: false });
      await page.evaluate(() => window.__cloneLab.scrollReveal());
      await page.waitForTimeout(400);
      shots.cloneReveal = path.join(outDir, 'clone-reveal.png');
      await page.screenshot({ path: shots.cloneReveal, fullPage: true });
      const afterReveal = await page.evaluate(() => window.__cloneLab.snapshot());

      renderedQa = assessSiteClone({
        html,
        sourceHtml: html,
        viewport: { width: 1440, height: 900 },
        bundled: undefined,
        unresolved: [],
        stripped: cloned.report?.stripped,
        motionWarnings: [],
        rendered: {
          width: 1440,
          height: 900,
          scrollWidth: before.scrollWidth,
          scrollHeight: before.scrollHeight,
          heroCards: before.cards.filter((c) => c.w > 200 && c.h > 200),
          images: before.images
        }
      });
      writeJson(path.join(outDir, 'motion.json'), { before, afterNext, afterReveal });
      writeJson(path.join(outDir, 'qa.json'), renderedQa);
    } finally {
      try {
        await browser?.close();
      } catch {
        /* ignore */
      }
      await server.close();
    }

    writeJson(path.join(outDir, 'evidence.json'), {
      skipped: false,
      url: facts.url,
      facts,
      report: cloned.report,
      shots,
      qa: renderedQa,
      artifactCount: htmlFiles.length
    });
    return {
      skipped: false,
      ok: true,
      url: facts.url,
      artifactCount: htmlFiles.length,
      shots,
      report: cloned.report,
      qa: renderedQa
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    writeJson(path.join(outDir, 'evidence.json'), { skipped: true, reason });
    return { skipped: true, reason, ok: false };
  }
}

function dumpGuestAssets(guest, htmlPath, destDir, bundled) {
  fs.mkdirSync(destDir, { recursive: true });
  const paths = new Set();
  for (const item of bundled || []) {
    if (item?.path) paths.add(item.path);
  }
  const dir = String(htmlPath || '').replace(/\/[^/]+$/, '');
  try {
    for (const p of guest.list(`${dir}/assets`) || []) {
      if (typeof p === 'string') paths.add(p);
      else if (p?.path) paths.add(p.path);
    }
  } catch {
    /* list prefix may be empty */
  }
  for (const p of paths) {
    try {
      const bytes = guest.readFileBytes(p);
      const name = String(p).split('/').pop();
      if (bytes?.byteLength && name) fs.writeFileSync(path.join(destDir, name), bytes);
    } catch {
      /* one failed asset must not break the rest */
    }
  }
}

function listenDir(dir) {
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

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function withTimeout(promise, ms, reason) {
  return Promise.race([promise, sleepReject(ms, reason)]);
}

function sleepReject(ms, reason) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(reason)), ms);
  });
}
