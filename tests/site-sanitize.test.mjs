import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isHtmlEventHandlerName,
  sanitizeSiteHtml,
  siteHtmlLooksExecutable
} from '../src/agent/vnext/sessionWorkspace/siteSanitize.js';
import { SITE_FRAME_SANDBOX, SITE_FRAME_CHANNEL, siteFrameUrl } from '../src/preview/siteFrameBridge.js';
import {
  SITE_FRAME_PAGE,
  createSiteFrameRuntime,
  isTrustedSiteChildEvent,
  isTrustedSiteParentEvent
} from '../src/sandbox/siteFrameRuntime.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('strips quoted, unquoted, entity, and mixed-case srcdoc', () => {
  const cases = [
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<iframe srcdoc=alert(1)></iframe>',
    '<IFRAME SRCDOC = "x"></IFRAME>',
    '<iframe\nsrcdoc\t=\tfoo></iframe>',
    '<iframe srcdoc=&lt;script&gt;alert(1)&lt;/script&gt;></iframe>'
  ];
  for (const html of cases) {
    const out = sanitizeSiteHtml(html);
    assert.equal(/srcdoc/i.test(out), false, html);
    assert.equal(/<script/i.test(out), false, html);
  }
});

test('entity-encoded srcdoc script does not remain executable', () => {
  const html = '<iframe srcdoc=&lt;script&gt;window.__pwned=1&lt;/script&gt;></iframe>';
  const out = sanitizeSiteHtml(html);
  assert.equal(siteHtmlLooksExecutable(out), false);
  assert.equal(/srcdoc/i.test(out), false);
  assert.equal(/__pwned/.test(out), false);
});

test('site host loads external sandbox frame; no inline srcdoc bootstrap', () => {
  const html = readFileSync(join(root, 'src/preview/site.html'), 'utf8');
  const frameHtml = readFileSync(join(root, 'src/sandbox/siteFrame.html'), 'utf8');
  const frameJs = readFileSync(join(root, 'src/sandbox/siteFrame.js'), 'utf8');
  const manifest = readFileSync(join(root, 'manifest.json'), 'utf8');
  assert.match(html, /sandbox="allow-scripts"/);
  assert.equal(/allow-same-origin/.test(html), false);
  assert.match(html, /src="\.\.\/sandbox\/siteFrame\.html"/);
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(html.replace(/<script type="module" src="site\.js"><\/script>/, '')), false);
  assert.equal(/srcdoc/i.test(html), false);
  assert.match(frameHtml, /src="siteFrame\.js"/);
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(frameHtml), false);
  assert.equal(/chrome\./.test(frameJs), false);
  assert.match(manifest, /src\/sandbox\/siteFrame\.html/);
  assert.equal(SITE_FRAME_SANDBOX, 'allow-scripts');
  assert.equal(SITE_FRAME_CHANNEL, 'paw-site-frame');
  assert.equal(SITE_FRAME_PAGE, 'src/sandbox/siteFrame.html');
  assert.match(siteFrameUrl(), /siteFrame\.html/);
});

test('parent and child postMessage require matching source + channel', () => {
  const parent = {};
  const child = {};
  const env = { channel: SITE_FRAME_CHANNEL, type: 'ready' };
  assert.equal(isTrustedSiteChildEvent({ source: child, data: env }, child), true);
  assert.equal(isTrustedSiteChildEvent({ source: parent, data: env }, child), false);
  assert.equal(isTrustedSiteChildEvent({ source: child, data: { type: 'ready' } }, child), false);
  assert.equal(isTrustedSiteParentEvent({ source: parent, data: { channel: SITE_FRAME_CHANNEL, op: 'serialize' } }, parent), true);
  assert.equal(isTrustedSiteParentEvent({ source: child, data: { channel: SITE_FRAME_CHANNEL, op: 'serialize' } }, parent), false);
});

test('serialize and click protocol stay on the host bridge', () => {
  const guest = {
    innerHTML: '<p data-paw-node="n1">hi</p>',
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };
  const document = {
    getElementById: (id) => (id === 'guest' ? guest : null)
  };
  const posted = [];
  const parent = {};
  const runtime = createSiteFrameRuntime({
    document,
    parentWindow: parent,
    postToParent: (m) => posted.push(m)
  });
  assert.match(runtime.serialize(), /data-paw-node="n1"/);
  assert.equal(
    runtime.handleParent({
      source: parent,
      data: { channel: SITE_FRAME_CHANNEL, op: 'serialize', req: 'r1' }
    }),
    true
  );
  assert.equal(
    posted.some((p) => p.type === 'serialized' && p.req === 'r1' && /n1/.test(p.html)),
    true
  );
  runtime.onGuestClick({
    target: {
      closest: () => ({ getAttribute: () => 'n1' })
    }
  });
  assert.equal(posted.some((p) => p.type === 'click' && p.nodeId === 'n1'), true);
  const n = posted.length;
  assert.equal(
    runtime.handleParent({
      source: {},
      data: { channel: SITE_FRAME_CHANNEL, op: 'serialize', req: 'evil' }
    }),
    false
  );
  assert.equal(posted.length, n);
});

test('mixed-case, slash, whitespace, entity, and svg on* handlers are stripped', () => {
  const cases = [
    ['<img src=x OnError="alert(1)">', /OnError/i, /alert\(1\)/],
    ['<img src=x ONERROR=alert(1)>', /ONERROR/i, /alert\(1\)/],
    ['<body OnLoad=alert(1)>', /OnLoad/i, /alert\(1\)/],
    ['<img/onerror=alert(1)>', /onerror/i, /alert\(1\)/],
    ['<img/OnError=alert(1)>', /OnError/i, /alert\(1\)/],
    ['<img/onerror="alert(1)">', /onerror/i, /alert\(1\)/],
    ['<img\tonerror=alert(1)>', /onerror/i, /alert\(1\)/],
    ['<img\nonerror=alert(1)>', /onerror/i, /alert\(1\)/],
    ['<img \tonerror = alert(1)>', /onerror/i, /alert\(1\)/],
    ['<img src=x onerror=&quot;alert(1)&quot;>', /onerror/i, /alert\(1\)/],
    ['<img src=x OnError=&quot;alert(1)&quot;>', /OnError/i, /alert\(1\)/],
    ['<svg onload=alert(1)>', /onload/i, /alert\(1\)/],
    ['<svg OnLoad="alert(1)">', /OnLoad/i, /alert\(1\)/],
    ['<svg/onload=alert(1)>', /onload/i, /alert\(1\)/],
    ['<IMG/OnError=alert(1)>', /OnError/i, /alert\(1\)/],
    ['<img src=x &#111;nerror=alert(1)>', /onerror/i, /alert\(1\)/]
  ];
  for (const [html, nameRe, payloadRe] of cases) {
    const out = sanitizeSiteHtml(html);
    assert.equal(nameRe.test(out), false, html);
    assert.equal(payloadRe.test(out), false, html);
    assert.equal(siteHtmlLooksExecutable(out), false, html);
    assert.match(out, /^<(img|body|svg|IMG)\b/i);
  }
});

test('javascript: mixed case and colon entities stay neutralized', () => {
  for (const html of [
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href=JaVaScRiPt:alert(1)>x</a>',
    '<a href="javascript: alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="javascript&#58;alert(1)">x</a>'
  ]) {
    const out = sanitizeSiteHtml(html);
    assert.equal(/javascript/i.test(out), false, html);
    assert.equal(/alert\(1\)/.test(out), false, html);
    assert.equal(siteHtmlLooksExecutable(out), false, html);
  }
});

test('text and legal attributes are not treated as handlers', () => {
  assert.equal(isHtmlEventHandlerName('onerror'), true);
  assert.equal(isHtmlEventHandlerName('OnLoad'), true);
  assert.equal(isHtmlEventHandlerName('open'), false);
  assert.equal(isHtmlEventHandlerName('data-onerror'), false);
  const keep = {
    text: '<p>docs say onerror= is an event</p>',
    textMixed: '<p>the string OnError=alert(1) is documentation</p>',
    audio: '<audio controls src="clip.mp3">',
    dataAttr: '<div data-onerror="keep">x</div>',
    className: '<button class="onerror-btn">go</button>',
    quoted: '<img src="ok.png" alt="onerror= docs" title="onerror= text">',
    open: '<details open><summary>x</summary></details>'
  };
  for (const html of Object.values(keep)) {
    assert.equal(siteHtmlLooksExecutable(sanitizeSiteHtml(html)), false, html);
  }
  assert.equal(sanitizeSiteHtml(keep.text), keep.text);
  assert.equal(sanitizeSiteHtml(keep.textMixed), keep.textMixed);
  assert.equal(sanitizeSiteHtml(keep.audio), keep.audio);
  assert.equal(sanitizeSiteHtml(keep.dataAttr), keep.dataAttr);
  assert.equal(sanitizeSiteHtml(keep.className), keep.className);
  assert.equal(sanitizeSiteHtml(keep.quoted), keep.quoted);
  assert.match(sanitizeSiteHtml(keep.open), /<details open>/i);
});
