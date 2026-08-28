import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_MOTION_ATTRS as A,
  SITE_MOTION_CLAMPS as C,
  SITE_MOTION_CAPABILITY,
  SITE_MOTION_UNSUPPORTED,
  clampMotionNumber,
  nextCarouselIndex,
  parseTimeMs
} from '../../src/agent/vnext/sessionWorkspace/siteMotionSchema.js';
import { sanitizeSiteHtml, siteHtmlLooksExecutable } from '../../src/agent/vnext/sessionWorkspace/siteSanitize.js';
import { annotateSiteMotionBlueprint } from '../../src/agent/vnext/sessionWorkspace/siteMotionBlueprint.js';
import { mountSiteMotion, stripSiteMotionChrome } from '../../src/preview/siteMotion.js';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { loadSkillInstructions, loadSkillResource } from '../../src/agent/vnext/skills/registry.js';
import { createMemoryWindow, el } from './harness/memoryDom.mjs';
import { captureSiteMotion } from './harness/capture_site_motion.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = fs.readFileSync(path.join(root, 'tests/session-workspace/fixtures/idea-shell-motion.html'), 'utf8');
const siteJs = fs.readFileSync(path.join(root, 'src/preview/site.js'), 'utf8');
const motionJs = fs.readFileSync(path.join(root, 'src/preview/siteMotion.js'), 'utf8');
const sanitizeJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/siteSanitize.js'), 'utf8');

assert.equal(clampMotionNumber(80_000, C.intervalMs), C.intervalMs.max);
assert.equal(clampMotionNumber(100, C.intervalMs), C.intervalMs.min);
assert.equal(parseTimeMs('20s', C.durationMs), C.durationMs.max);
assert.equal(parseTimeMs('50ms', C.durationMs), C.durationMs.min);
assert.equal(nextCarouselIndex(2, 3, 1, true), 0);
assert.equal(nextCarouselIndex(0, 3, -1, false), 0);

assert.equal(siteHtmlLooksExecutable(fixture), true);
const safe = sanitizeSiteHtml(fixture);
assert.doesNotMatch(safe, /<script\b/i);
assert.doesNotMatch(safe, /\sonclick=/i);
assert.doesNotMatch(safe, /javascript:/i);
assert.match(safe, /@keyframes drift/);
assert.match(safe, /animation:\s*drift/);
assert.equal(siteHtmlLooksExecutable(safe), false);

const mapped = annotateSiteMotionBlueprint(fixture);
assert.equal(mapped.provenance, 'site-motion-blueprint@1');
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-carousel' && m.to === A.carousel));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-track' && m.to === A.track));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-item' && m.to === A.item));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-prev' && m.to === A.prev));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-next' && m.to === A.next));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-toggle' && m.to === A.toggle));
assert.ok(mapped.mappings.some((m) => m.from === 'data-hero-progress' && m.to === A.progress));
assert.ok(mapped.mappings.some((m) => m.from === 'class:reveal'));
assert.ok(mapped.warnings.some((w) => w.code === 'UNSUPPORTED_GUEST_JS'));
assert.match(mapped.html, /class="card reveal"/);
assert.match(mapped.html, new RegExp(A.carousel));
assert.doesNotMatch(mapped.html, /three\.js/);

{
  const cards = annotateSiteMotionBlueprint(`<div class="cards" data-cards>
    <div class="cards__track" data-cards-track>
      <article class="devcard">phone</article>
    </div>
    <button type="button" data-cards-next>n</button>
  </div>
  <div class="carousel" data-hero-carousel>
    <div class="carousel__track"><figure class="carousel__slide">s</figure></div>
  </div>`);
  assert.ok(cards.mappings.some((m) => m.from === 'data-cards'));
  assert.ok(cards.mappings.some((m) => m.from === 'data-cards-next'));
  assert.ok(cards.mappings.some((m) => m.from === 'class:carousel__slide' || m.from === 'class:devcard'));
  assert.match(cards.html, new RegExp(A.carousel));
  assert.match(cards.html, new RegExp(A.next));
}

const again = annotateSiteMotionBlueprint(mapped.html);
assert.ok(again.mappings.every((m) => m.from !== 'data-hero-carousel' || mapped.html.includes(A.carousel)));

{
  const { doc, win } = createMemoryWindow();
  const carousel = el(doc, 'div', { [A.carousel]: '', [A.interval]: '2500', [A.autoplay]: 'true' });
  const track = el(doc, 'div', { [A.track]: '' });
  const a = el(doc, 'article', { [A.item]: '', text: 'A' });
  const b = el(doc, 'article', { [A.item]: '', text: 'B' });
  const c = el(doc, 'article', { [A.item]: '', text: 'C' });
  track.appendChild(a);
  track.appendChild(b);
  track.appendChild(c);
  const prev = el(doc, 'button', { [A.prev]: '', text: 'prev' });
  const next = el(doc, 'button', { [A.next]: '', text: 'next' });
  const toggle = el(doc, 'button', { [A.toggle]: '', text: 'toggle' });
  const progress = el(doc, 'div', { [A.progress]: '' });
  const fill = el(doc, 'span');
  progress.appendChild(fill);
  carousel.appendChild(track);
  carousel.appendChild(prev);
  carousel.appendChild(next);
  carousel.appendChild(toggle);
  carousel.appendChild(progress);
  const stagger = el(doc, 'div', { [A.stagger]: '80' });
  stagger.appendChild(el(doc, 'p', { text: 'one' }));
  stagger.appendChild(el(doc, 'p', { text: 'two' }));
  const marquee = el(doc, 'div', { [A.marquee]: '', [A.speed]: '40', text: 'hello world ' });
  const parallax = el(doc, 'div', { [A.parallax]: '', [A.amount]: '80', text: 'band' });
  const tabs = el(doc, 'div', { [A.tabs]: '' });
  const tab1 = el(doc, 'button', { [A.tab]: '', 'aria-controls': 'p1', text: 'Ink' });
  const tab2 = el(doc, 'button', { [A.tab]: '', 'aria-controls': 'p2', text: 'Paper' });
  const p1 = el(doc, 'div', { [A.tabPanel]: '', id: 'p1', text: 'Ink panel' });
  const p2 = el(doc, 'div', { [A.tabPanel]: '', id: 'p2', text: 'Paper panel' });
  tabs.appendChild(tab1);
  tabs.appendChild(tab2);
  tabs.appendChild(p1);
  tabs.appendChild(p2);
  const acc = el(doc, 'div', { [A.accordion]: '' });
  const item = el(doc, 'div', { [A.accordionItem]: '' });
  const trig = el(doc, 'button', { [A.accordionTrigger]: '', 'aria-expanded': 'false', 'aria-controls': 'acc1', text: 'Q' });
  const panel = el(doc, 'div', { [A.accordionPanel]: '', id: 'acc1', text: 'A' });
  panel.hidden = true;
  item.appendChild(trig);
  item.appendChild(panel);
  acc.appendChild(item);
  const hover = el(doc, 'div', { [A.hover]: 'lift', text: 'card' });
  doc.body.appendChild(carousel);
  doc.body.appendChild(stagger);
  doc.body.appendChild(marquee);
  doc.body.appendChild(parallax);
  doc.body.appendChild(tabs);
  doc.body.appendChild(acc);
  doc.body.appendChild(hover);

  const handle = mountSiteMotion(doc, { reducedMotion: false });
  assert.equal(handle.diagnostics.length, 0, JSON.stringify(handle.diagnostics));
  assert.ok(doc.getElementById('paw-site-motion'));
  assert.equal(a.classList.contains('paw-is-active'), true);
  assert.equal(b.getAttribute('aria-hidden'), 'true');
  next.dispatchEvent({ type: 'click' });
  assert.equal(b.classList.contains('paw-is-active'), true);
  assert.match(String(fill.style.width || ''), /66|67/);
  prev.dispatchEvent({ type: 'click' });
  assert.equal(a.classList.contains('paw-is-active'), true);
  const playing = toggle.getAttribute('aria-pressed');
  toggle.dispatchEvent({ type: 'click' });
  assert.notEqual(toggle.getAttribute('aria-pressed'), playing);
  carousel.dispatchEvent({ type: 'keydown', key: 'ArrowRight', target: carousel, preventDefault() {} });
  assert.equal(b.classList.contains('paw-is-active'), true);
  track.dispatchEvent({ type: 'pointerdown', clientX: 200, button: 0, pointerId: 1 });
  track.dispatchEvent({ type: 'pointermove', clientX: 120, pointerId: 1 });
  track.dispatchEvent({ type: 'pointerup', clientX: 110, pointerId: 1 });
  assert.equal(c.classList.contains('paw-is-active'), true);
  win.flushIntervals();
  const children = [...stagger.children];
  assert.ok(children[0].hasAttribute(A.motion));
  for (const io of win._observers) io.trigger(true);
  assert.equal(children[0].classList.contains('paw-motion-in'), true);
  assert.ok(marquee.querySelector('.paw-marquee-row'));
  assert.equal(marquee.querySelector('[aria-hidden="true"]')?.getAttribute('data-paw-motion-runtime'), 'marquee-clone');
  const parallaxY = Number((parallax.style.transform || '').match(/translate3d\(0,\s*(-?[\d.]+)/)?.[1] || 0);
  assert.ok(Math.abs(parallaxY) <= C.parallaxPx.max);
  tab2.dispatchEvent({ type: 'click' });
  assert.equal(tab2.getAttribute('aria-selected'), 'true');
  assert.equal(p2.hidden, false);
  assert.equal(p1.hidden, true);
  trig.dispatchEvent({ type: 'click' });
  assert.equal(trig.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);
  assert.equal(hover.getAttribute('tabindex'), '0');
  assert.ok(handle.stats.observers >= 1);
  assert.ok(handle.stats.listeners >= 1);
  handle.destroy();
  assert.equal(handle.stats.observers, 0);
  assert.equal(handle.stats.timers, 0);
  assert.equal(handle.stats.listeners, 0);
  assert.equal(win.timerCount(), 0);
  assert.equal(win.observerCount(), 0);
}

{
  const { doc, win } = createMemoryWindow({ reducedMotion: true });
  const carousel = el(doc, 'div', { [A.carousel]: '', [A.autoplay]: 'true' });
  const track = el(doc, 'div', { [A.track]: '' });
  track.appendChild(el(doc, 'div', { [A.item]: '', text: '1' }));
  track.appendChild(el(doc, 'div', { [A.item]: '', text: '2' }));
  carousel.appendChild(track);
  const reveal = el(doc, 'p', { [A.motion]: 'fade-up', text: 'shown' });
  const marquee = el(doc, 'div', { [A.marquee]: '', text: 'x' });
  const parallax = el(doc, 'div', { [A.parallax]: '', text: 'y' });
  doc.body.appendChild(carousel);
  doc.body.appendChild(reveal);
  doc.body.appendChild(marquee);
  doc.body.appendChild(parallax);
  const handle = mountSiteMotion(doc, { reducedMotion: true });
  assert.equal(handle.reduced, true);
  assert.equal(reveal.classList.contains('paw-motion-in'), true);
  assert.equal(win.timerCount(), 0);
  assert.equal(parallax.style.transform || '', '');
  assert.equal(marquee.querySelector('.paw-marquee-row'), null);
  handle.destroy();
}

{
  const { doc } = createMemoryWindow();
  const wrap = el(doc, 'section');
  const carousel = el(doc, 'div', { [A.carousel]: '' });
  const track = el(doc, 'div', { [A.track]: '' });
  const a = el(doc, 'article', { [A.item]: '', text: 'A' });
  const b = el(doc, 'article', { [A.item]: '', text: 'B' });
  track.appendChild(a);
  track.appendChild(b);
  carousel.appendChild(track);
  const next = el(doc, 'button', { [A.next]: '', text: 'next' });
  wrap.appendChild(carousel);
  wrap.appendChild(next);
  doc.body.appendChild(wrap);
  const handle = mountSiteMotion(doc, { reducedMotion: true });
  next.dispatchEvent({ type: 'click' });
  assert.equal(b.classList.contains('paw-is-active'), true, 'sibling next outside carousel root');
  handle.destroy();
}

{
  const { doc } = createMemoryWindow();
  const section = el(doc, 'section');
  const media = el(doc, 'div');
  const carousel = el(doc, 'div', { [A.carousel]: '' });
  const track = el(doc, 'div', { [A.track]: '' });
  const a = el(doc, 'article', { [A.item]: '', text: 'A' });
  const b = el(doc, 'article', { [A.item]: '', text: 'B' });
  track.appendChild(a);
  track.appendChild(b);
  carousel.appendChild(track);
  media.appendChild(carousel);
  const controls = el(doc, 'div');
  const next = el(doc, 'button', { [A.next]: '', text: 'next' });
  controls.appendChild(next);
  section.appendChild(media);
  section.appendChild(controls);
  doc.body.appendChild(section);
  const handle = mountSiteMotion(doc, { reducedMotion: true });
  next.dispatchEvent({ type: 'click' });
  assert.equal(b.classList.contains('paw-is-active'), true, 'next in sibling controls outside media wrap');
  handle.destroy();
}

{
  const { doc } = createMemoryWindow();
  const carousel = el(doc, 'div', { [A.carousel]: '' });
  const track = el(doc, 'div', { [A.track]: '' });
  const a = el(doc, 'article', { [A.item]: '', text: 'A' });
  const b = el(doc, 'article', { [A.item]: '', text: 'B' });
  track.appendChild(a);
  track.appendChild(b);
  const next = el(doc, 'button', { [A.next]: '', text: 'next' });
  carousel.appendChild(track);
  carousel.appendChild(next);
  doc.body.appendChild(carousel);
  const handle = mountSiteMotion(doc, { pickActive: () => true });
  next.dispatchEvent({ type: 'click' });
  assert.equal(a.classList.contains('paw-is-active'), true);
  assert.equal(b.classList.contains('paw-is-active'), false);
  handle.destroy();
}

{
  const { doc } = createMemoryWindow();
  const boom = el(doc, 'div', { [A.carousel]: '' });
  boom.querySelector = () => {
    throw new Error('carousel exploded');
  };
  const ok = el(doc, 'p', { [A.motion]: 'fade', text: 'still here' });
  doc.body.appendChild(boom);
  doc.body.appendChild(ok);
  const handle = mountSiteMotion(doc);
  assert.ok(handle.diagnostics.some((d) => d.component.startsWith('carousel')));
  assert.equal(ok.ownerDocument, doc);
  handle.destroy();
}

{
  const { doc } = createMemoryWindow();
  const p = el(doc, 'p', { [A.motion]: 'fade-up', text: 'x' });
  doc.body.appendChild(p);
  const h1 = mountSiteMotion(doc);
  const h2 = mountSiteMotion(doc);
  assert.notEqual(h1, h2);
  h1.destroy();
  h2.destroy();
  stripSiteMotionChrome(doc);
  assert.equal(doc.getElementById('paw-site-motion'), null);
}

assert.match(siteJs, /mountSiteMotion/);
assert.match(siteJs, /sanitizeSiteHtml/);
assert.match(siteJs, /teardownMotion|unmountSiteMotion/);
assert.match(siteJs, /srcdoc/);
assert.match(siteJs, /pickActive/);
assert.match(fs.readFileSync(path.join(root, 'src/preview/site.html'), 'utf8'), /workLock\.js/);
assert.doesNotMatch(motionJs, /workLock|paw_work_lock/);
assert.doesNotMatch(motionJs, /\*\s*\{[^}]*animation\s*:\s*none/);
assert.doesNotMatch(motionJs, /\beval\s*\(|new\s+Function\b|chrome\.|fetch\s*\(|XMLHttpRequest|WebSocket|import\s*\(/);
assert.doesNotMatch(sanitizeJs, /\beval\s*\(|new\s+Function\b/);
assert.ok(SITE_MOTION_UNSUPPORTED.includes('webgl'));
assert.equal(SITE_MOTION_CAPABILITY.guestScripts, false);
assert.equal(SITE_MOTION_CAPABILITY.eval, false);

const playbook = loadSkillInstructions('html-site');
assert.match(playbook, /data-paw-\*/);
assert.match(playbook, /prefers-reduced-motion/);
assert.match(playbook, /motion blueprint/);
assert.match(playbook, /never paste source JavaScript/);
const motionRes = JSON.parse(loadSkillResource('html-site', 'motion.json'));
assert.equal(motionRes.runtime, 'packaged');
assert.deepEqual(motionRes.clamps.intervalMs, C.intervalMs);

{
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: 's-motion' });
  const execution = beginExecution(store, 's-motion', {});
  const guest = createSessionGuestFs(store, { sessionId: 's-motion', executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId: 's-motion' });
  const created = await tools.run.execute({
    op: 'write_artifact',
    name: 'motion.html',
    mimeType: 'text/html',
    content: mapped.html
  });
  assert.equal(created.ok, true, created.error);
  const read = await tools.web.execute({ act: 'read' });
  assert.equal(read.ok, true, read.error);
  assert.equal(read.motion.runtime, 'packaged');
  assert.equal(read.motion.guestScripts, false);
  const inspected = await tools.inspect.execute({ view: 'html', artifactId: created.artifact.artifactId });
  assert.equal(inspected.motion.runtime, 'packaged');
}

const evidenceDir = path.join(root, 'artifacts', 'qa-site-motion');
fs.mkdirSync(evidenceDir, { recursive: true });
const capture = await captureSiteMotion({ timeoutMs: 8000 });
if (capture.skipped) {
  console.log(`test_site_motion: playwright skipped (${capture.reason})`);
} else {
  assert.equal(capture.evidence.scripts, 0);
  assert.equal(capture.evidence.guest.script, false);
  assert.equal(capture.evidence.after, 1);
  assert.ok(fs.existsSync(capture.shot));
}
fs.writeFileSync(
  path.join(evidenceDir, 'contract.json'),
  JSON.stringify(
    {
      sanitizer: { scripts: false, onclick: !/\sonclick=/i.test(safe), javascript: !/javascript:/i.test(safe) },
      blueprint: { mappings: mapped.mappings, warnings: mapped.warnings, provenance: mapped.provenance },
      capability: SITE_MOTION_CAPABILITY,
      playwright: capture.skipped ? { skipped: true, reason: capture.reason } : { skipped: false, shot: capture.shot }
    },
    null,
    2
  )
);

console.log('test_site_motion: ok');
