import assert from 'node:assert/strict';
import {
  SITE_QA_CODES,
  SITE_QA_VERSION,
  assessSiteClone
} from '../../src/agent/vnext/sessionWorkspace/siteQa.js';
import { compileSiteClone } from '../../src/agent/vnext/sessionWorkspace/siteClone.js';

function hard(result) {
  return result.issues.filter((i) => i.severity === 'hard').map((i) => i.code);
}

assert.equal(SITE_QA_VERSION, 1);

const threeCard = `<!DOCTYPE html>
<html lang="en" data-paw-kind="site">
<head>
<style data-paw-clone-css="1">
.cards { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:24px; width:960px; }
.card img { width:100%; height:160px; object-fit:cover; }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<section class="hero"><h1>Any idea, captured.</h1></section>
<section class="cards">
  <article class="card"><img src="/artifacts/ideashell/assets/01-hero-1.png" alt="Field notes"><h2>Field notes</h2></article>
  <article class="card"><img src="/artifacts/ideashell/assets/02-hero-2.png" alt="Studio wall"><h2>Studio wall</h2></article>
  <article class="card"><img src="/artifacts/ideashell/assets/03-hero-3.png" alt="Evening read"><h2>Evening read</h2></article>
</section>
</body></html>`;

const pass = assessSiteClone({
  html: threeCard,
  sourceHtml: threeCard,
  viewport: { width: 1440, height: 900 },
  bundled: [
    { path: '/artifacts/ideashell/assets/01-hero-1.png', bytes: { byteLength: 1200 } },
    { path: '/artifacts/ideashell/assets/02-hero-2.png', bytes: { byteLength: 1200 } },
    { path: '/artifacts/ideashell/assets/03-hero-3.png', bytes: { byteLength: 1200 } }
  ],
  rendered: {
    width: 1440,
    height: 900,
    scrollWidth: 1440,
    heroCards: [
      { x: 40, y: 200, w: 300, h: 360 },
      { x: 360, y: 200, w: 300, h: 360 },
      { x: 680, y: 200, w: 300, h: 360 }
    ],
    images: [
      { src: '/artifacts/ideashell/assets/01-hero-1.png', naturalWidth: 320, naturalHeight: 180, complete: true, aboveFold: true },
      { src: '/artifacts/ideashell/assets/02-hero-2.png', naturalWidth: 320, naturalHeight: 180, complete: true, aboveFold: true },
      { src: '/artifacts/ideashell/assets/03-hero-3.png', naturalWidth: 320, naturalHeight: 180, complete: true, aboveFold: true }
    ]
  }
});
assert.equal(pass.ok, true, JSON.stringify(pass.issues));
assert.deepEqual(hard(pass), []);
assert.equal(pass.codes.includes(SITE_QA_CODES.LAYOUT_COLLAPSE), false);
assert.equal(pass.codes.includes(SITE_QA_CODES.BROKEN_MEDIA), false);
assert.equal(pass.codes.includes(SITE_QA_CODES.REMOTE_STYLESHEET), false);

const remote = assessSiteClone({
  html: `<html><head><link rel="stylesheet" href="https://www.figma.com/file/abc/styles.css"></head>
  <body><h1>Any idea, captured.</h1><article class="card">a</article><article class="card">b</article><article class="card">c</article></body></html>`,
  sourceHtml: threeCard,
  viewport: { width: 1440, height: 900 }
});
assert.equal(hard(remote).includes(SITE_QA_CODES.REMOTE_STYLESHEET), true, JSON.stringify(remote.issues));
assert.equal(remote.ok, false);

const broken = assessSiteClone({
  html: `<html><head><style>.cards{display:grid;grid-template-columns:repeat(3,1fr)}</style></head>
  <body><section class="hero"><img src="hero.png" alt="hero" fetchpriority="high"></section>
  <section class="cards">
    <article class="card"><img src="missing-a.png"></article>
    <article class="card"><img src="missing-b.png"></article>
    <article class="card"><img src="missing-c.png"></article>
  </section></body></html>`,
  sourceHtml: threeCard,
  viewport: { width: 1440, height: 900 },
  bundled: [],
  rendered: {
    images: [{ src: 'hero.png', naturalWidth: 0, naturalHeight: 0, complete: true, aboveFold: true }]
  }
});
assert.equal(hard(broken).includes(SITE_QA_CODES.BROKEN_MEDIA), true, JSON.stringify(broken.issues));

const narrow = `<!DOCTYPE html><html lang="zh-CN"><head>
<style>body{margin:0}.page{max-width:360px;margin:0;padding:24px} img{width:220px}</style>
</head><body><div class="page">
<aside>01 / 随手捕捉</aside>
<h1>不仅是记录与问答。闪念贝壳记住你的所思所想。</h1>
<p>全平台无缝流转</p>
<img src="/artifacts/x/broken.png" alt="">
</div></body></html>`;
const collapse = assessSiteClone({
  html: narrow,
  sourceHtml: threeCard,
  viewport: { width: 1440, height: 900 },
  rendered: {
    width: 1440,
    height: 900,
    scrollWidth: 1440,
    heroCards: [{ x: 24, y: 120, w: 320, h: 480 }]
  }
});
assert.equal(hard(collapse).includes(SITE_QA_CODES.LAYOUT_COLLAPSE), true, JSON.stringify(collapse.issues));

const compiled = compileSiteClone({
  html: threeCard.replace('data-paw-kind="site"', ''),
  cssTexts: ['.cards { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }'],
  lang: 'en',
  url: 'https://ideashell.com/',
  assetMap: {
    '/artifacts/ideashell/assets/01-hero-1.png': '/artifacts/ideashell/assets/01-hero-1.png'
  }
});
assert.equal(compiled.ok, true, compiled.error);
assert.doesNotMatch(compiled.html, /<link[^>]+stylesheet/i);

console.log('test_site_qa: ok');
