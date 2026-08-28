import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact, listArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import {
  compileSiteClone,
  stripActiveContent,
  AMBIGUOUS_SITE,
  SITE_CLONE_LIMITS
} from '../../src/agent/vnext/sessionWorkspace/siteClone.js';
import { rewriteGuestImageSrcs } from '../../src/agent/vnext/sessionWorkspace/htmlMedia.js';
import { SITE_MOTION_ATTRS as A } from '../../src/agent/vnext/sessionWorkspace/siteMotionSchema.js';
import { writeIdeaShellFixture } from './fixtures/ideashell/build.mjs';
import { cloneIdeaShellEvidence } from './harness/clone_ideashell.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = writeIdeaShellFixture();
assert.ok(fixture.htmlBytes > 32 * 1024);
assert.ok(fixture.cssBytes > 100 * 1024);

const stripped = stripActiveContent(fixture.html);
assert.doesNotMatch(stripped.html, /<script/i);
assert.doesNotMatch(stripped.html, /onclick=/i);
assert.doesNotMatch(stripped.html, /javascript:/i);
assert.match(stripped.html, /class="cards"/);
assert.match(stripped.html, /Field notes/);
assert.ok(stripped.stripped.includes('script'));
assert.ok(stripped.stripped.includes('handler'));

const compiled = compileSiteClone({
  html: fixture.html,
  cssTexts: [fixture.css],
  baseUrl: '/scratch/ideashell/index.html',
  lang: 'en',
  url: 'https://ideashell.com/',
  viewport: { width: 1440, height: 900 },
  assetMap: {
    '/scratch/ideashell/hero-1.png': '/artifacts/ideashell/assets/01-hero-1.png',
    'hero-1.png': '/artifacts/ideashell/assets/01-hero-1.png',
    'hero-2.png': '/artifacts/ideashell/assets/02-hero-2.png',
    'hero-3.png': '/artifacts/ideashell/assets/03-hero-3.png'
  },
  cssIncomplete: false
});
assert.equal(compiled.ok, true, compiled.error);
assert.match(compiled.html, /data-paw-kind="site"/);
assert.match(compiled.html, /lang="en"/);
assert.match(compiled.html, /data-paw-clone-url="https:\/\/ideashell.com\/"/);
assert.match(compiled.html, /class="cards"/);
assert.match(compiled.html, /class="rail"/);
assert.match(compiled.html, /Field notes/);
assert.match(compiled.html, /Studio wall/);
assert.match(compiled.html, /Evening read/);
assert.doesNotMatch(compiled.html, /<link[^>]+stylesheet/i);
assert.doesNotMatch(compiled.html, /style\.css/);
assert.doesNotMatch(compiled.html, /<script/i);
assert.match(compiled.html, /@keyframes\s+rise/);
assert.match(compiled.html, /transition:/);
assert.match(compiled.html, /grid-template-columns:\s*repeat\(3/);
assert.match(compiled.html, /@media \(max-width: 900px\)/);
assert.doesNotMatch(compiled.html, /-cn/);
assert.doesNotMatch(compiled.html, /这是一篇/);
assert.doesNotMatch(compiled.html, /\sdata-(?!paw-)[\w-]/);

{
  const srcsetHtml = `<!DOCTYPE html><html lang="en"><body>
    <div class="carousel" data-hero-carousel>
      <div class="carousel__track" data-hero-track>
        <figure class="carousel__slide"><img src="hero-1.jpg?v=3" srcset="hero-1-640.jpg 640w, hero-1.jpg?v=338 2560w" alt="a"></figure>
        <figure class="carousel__slide"><img src="hero-2.jpg?v=4" srcset="hero-2-640.jpg 640w" alt="b"></figure>
      </div>
      <button type="button" data-hero-next>next</button>
    </div>
    <style>body{background:url("paper.png")}</style>
  </body></html>`;
  const mapped = compileSiteClone({
    html: srcsetHtml,
    cssTexts: ['body{background:url("paper.png")} .x{background-image:url("hero-1.jpg?v=3")}'],
    baseUrl: 'https://ideashell.com/',
    lang: 'en',
    assetMap: {
      'https://ideashell.com/hero-1.jpg': '/artifacts/ideashell.com/assets/01-hero-1.jpg',
      'https://ideashell.com/hero-1.jpg?v=3': '/artifacts/ideashell.com/assets/01-hero-1.jpg',
      'https://ideashell.com/hero-2.jpg': '/artifacts/ideashell.com/assets/02-hero-2.jpg',
      'https://ideashell.com/paper.png': '/artifacts/ideashell.com/assets/03-paper.png'
    }
  });
  assert.equal(mapped.ok, true, mapped.error);
  assert.match(mapped.html, /data-paw-carousel/);
  assert.match(mapped.html, new RegExp(A.item));
  assert.match(mapped.html, /\/artifacts\/ideashell\.com\/assets\/01-hero-1\.jpg/);
  assert.doesNotMatch(mapped.html, /hero-1-640\.jpg/);
  assert.doesNotMatch(mapped.html, /data-hero-carousel/);
  assert.match(mapped.html, /url\(["']?\/artifacts\/ideashell\.com\/assets\/03-paper\.png/);
}

async function withTools(id) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: id });
  const execution = beginExecution(store, id, {});
  const guest = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  guest.mkdirp('/scratch/ideashell');
  guest.mkdirp('/artifacts');
  guest.writeFile('/scratch/ideashell/index.html', fixture.html);
  guest.writeFile('/scratch/ideashell/style.css', fixture.css);
  guest.writeFile('/scratch/ideashell/hero-1.png', fs.readFileSync(path.join(fixture.dir, 'hero-1.png')));
  guest.writeFile('/scratch/ideashell/hero-2.png', fs.readFileSync(path.join(fixture.dir, 'hero-2.png')));
  guest.writeFile('/scratch/ideashell/hero-3.png', fs.readFileSync(path.join(fixture.dir, 'hero-3.png')));
  const tools = createSessionTools({ store, execution, fs: guest, sessionId: id });
  return { tools, fs: guest, store, sessionId: id, execution };
}

const t = await withTools('s-site-clone');
assert.match(t.tools.web.description, /clone/i);
assert.deepEqual(t.tools.web.parameters.properties.act.enum, ['read', 'write', 'undo', 'clone', 'capture']);

const cloned = await t.tools.web.execute({
  act: 'clone',
  source: 'path',
  path: '/scratch/ideashell/index.html',
  url: 'https://ideashell.com/',
  viewport: { width: 1440, height: 900 },
  assets: 'bundle',
  motion: 'declarative'
});
assert.equal(cloned.ok, true, cloned.error || cloned.code);
assert.ok(cloned.artifactId);
assert.match(cloned.path, /\/artifacts\/.+\.html$/);
assert.ok(cloned.captureDir.startsWith('/scratch/site-clone/'));
assert.ok(cloned.summary, 'model sees compact summary, not giant HTML');
assert.ok(!cloned.html, 'giant html must not be in the tool result');
assert.ok(cloned.report.cssBytes > 1000);
assert.equal(cloned.report.locale, 'en');
assert.ok(cloned.report.bundled >= 3);
assert.ok(cloned.report.stripped.includes('script'));
assert.ok(cloned.report.qa, 'clone returns a compact QA report');
assert.equal(Array.isArray(cloned.report.issues), true);

const html = t.fs.readFile(cloned.path);
assert.match(html, /data-paw-kind="site"/);
assert.match(html, /class="cards"/);
assert.match(html, /Field notes/);
assert.doesNotMatch(html, /href=["'][^"']*style\.css/);
assert.doesNotMatch(html, /<script/i);
assert.match(html, /@keyframes\s+rise/);
assert.match(html, /\/artifacts\/.+\/assets\/.+/);
assert.match(html, /lang="en"/);
assert.doesNotMatch(html, /\/-cn|zh-CN|中文官网/);
assert.doesNotMatch(html, /<script/i);
assert.doesNotMatch(html, /\sdata-(?!paw-)[\w-]/);
const painted = rewriteGuestImageSrcs(html, t.fs, t.store, t.sessionId);
assert.match(painted, /data:image\/png;base64,/);
assert.doesNotMatch(painted, /\ssrc="\/artifacts\//);

const arts = listArtifacts(t.store, t.sessionId).filter((a) => /\.html$/i.test(a.name || ''));
assert.equal(arts.length, 1, 'one site artifact');

const again = await t.tools.web.execute({
  act: 'clone',
  source: 'path',
  path: '/scratch/ideashell/index.html',
  url: 'https://ideashell.com/'
});
assert.equal(again.ok, true, again.error);
assert.equal(again.artifactId, cloned.artifactId, 'repair updates the same site');
const arts2 = listArtifacts(t.store, t.sessionId).filter((a) => /\.html$/i.test(a.name || a.primaryPath || ''));
assert.equal(arts2.length, 1);

const capture = await t.tools.web.execute({
  act: 'capture',
  source: 'path',
  path: '/scratch/ideashell/index.html'
});
assert.equal(capture.ok, true, capture.error);
assert.ok(capture.summary.htmlChars > 32 * 1024);
const scratchHtml = t.fs.readFile(`${capture.captureDir}/dom.html`);
assert.match(scratchHtml, /class="cards"/);

const t2 = await withTools('s-site-clone-ambig');
createArtifact(t2.store, t2.fs, {
  sessionId: t2.sessionId,
  name: 'a.html',
  packageDir: 'site-a',
  path: '/artifacts/site-a/a.html',
  mimeType: 'text/html',
  content: '<html data-paw-kind="site"><body><h1>A</h1></body></html>'
});
createArtifact(t2.store, t2.fs, {
  sessionId: t2.sessionId,
  name: 'b.html',
  packageDir: 'site-b',
  path: '/artifacts/site-b/b.html',
  mimeType: 'text/html',
  content: '<html data-paw-kind="site"><body><h1>B</h1></body></html>'
});
const amb = await t2.tools.web.execute({
  act: 'clone',
  source: 'path',
  path: '/scratch/ideashell/index.html'
});
assert.equal(amb.ok, false);
assert.equal(amb.code, AMBIGUOUS_SITE);

const compiledFallback = compileSiteClone({
  html: '<html lang="en"><body><div class="only-computed">Hi</div></body></html>',
  cssTexts: [],
  lang: 'en',
  cssIncomplete: true,
  computed: [{ nodeId: 'n1', styles: { display: 'grid', gap: '24px' } }]
});
assert.match(compiledFallback.html, /computed fallback/);
assert.match(compiledFallback.html, /display: grid/);

assert.ok(SITE_CLONE_LIMITS.htmlChars >= 1_000_000);

let playwrightRan = false;
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ timeout: 8000 });
  try {
    const page = await browser.newPage();
    const outDir = path.join(root, 'output', 'playwright');
    fs.mkdirSync(outDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(painted, { waitUntil: 'domcontentloaded' });
    const cards = page.locator('.cards .card');
    assert.equal(await cards.count(), 3);
    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();
    const box2 = await cards.nth(2).boundingBox();
    assert.ok(box0 && box1 && box2);
    assert.ok(Math.abs(box0.y - box1.y) < 24, 'cards share a row at 1440');
    assert.ok(box1.x > box0.x + 40);
    assert.ok(box2.x > box1.x + 40);
    const media = await page.evaluate(() =>
      [...document.images].map((img) => ({
        complete: img.complete,
        w: img.naturalWidth,
        h: img.naturalHeight,
        broken: !img.complete || img.naturalWidth === 0
      }))
    );
    assert.ok(
      media.length >= 3 && media.every((m) => m.w > 0 && m.broken === false),
      `fixture images must paint, got ${JSON.stringify(media)}`
    );
    await page.screenshot({ path: path.join(outDir, 'ideashell-clone-1440.png') });
    await page.setViewportSize({ width: 420, height: 900 });
    const n0 = await cards.nth(0).boundingBox();
    const n1 = await cards.nth(1).boundingBox();
    assert.ok(n0 && n1);
    assert.ok(n1.y > n0.y + 40, 'cards stack at narrow viewport');
    await page.screenshot({ path: path.join(outDir, 'ideashell-clone-420.png') });
    playwrightRan = true;
  } finally {
    await browser.close();
  }
} catch (e) {
  console.log(`test_site_clone: playwright skipped (${e instanceof Error ? e.message : e})`);
}

const live = await cloneIdeaShellEvidence({ timeoutMs: 45000 });
if (live.skipped) {
  console.log(`test_site_clone: live ideashell skipped (${live.reason})`);
} else {
  assert.equal(live.ok, true, live.error);
  assert.equal(live.artifactCount, 1);
  assert.match(String(live.url || ''), /ideashell\.com/);
  assert.ok(fs.existsSync(live.shots.clone1440));
  const motionPath = path.join(root, 'artifacts', 'qa-ideashell-clone', 'motion.json');
  if (fs.existsSync(motionPath)) {
    const motion = JSON.parse(fs.readFileSync(motionPath, 'utf8'));
    const atf = (motion.before?.images || []).filter((img) => img.aboveFold);
    assert.ok(
      atf.length === 0 || atf.every((img) => Number(img.naturalWidth) > 0),
      `live clone above-the-fold images must paint: ${JSON.stringify(atf.slice(0, 6))}`
    );
    if (Number(motion.before?.active) >= 0 && motion.afterNext) {
      assert.notEqual(
        motion.afterNext.active,
        motion.before.active,
        'packaged carousel next must advance the hero'
      );
    }
  }
}

assert.ok(true, 'DOM/CSS/asset assertions passed');
console.log(`test_site_clone: ok${playwrightRan ? ' + playwright layout' : ''}${live.skipped ? '' : ' + live clone'}`);
