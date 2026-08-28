import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { htmlRichFlow, rewriteGuestImageSrcs } from '../../src/agent/vnext/sessionWorkspace/htmlMedia.js';
import { exportPlates } from '../../src/agent/vnext/sessionWorkspace/artifactExport.js';

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG = Uint8Array.from(Buffer.from(PNG_B64, 'base64'));
const DATA = `data:image/png;base64,${PNG_B64}`;

const flow = htmlRichFlow(`
  <h1>精选视觉</h1>
  <div class="hero-image-wrap">
    <img data-paw-slot="hero_image" src="${DATA}" alt="主视觉图">
    <div class="hero-caption">
      <span class="hero-tag" data-paw-slot="hero_tag">FEATURED VISUAL</span>
      <div class="hero-desc" data-paw-slot="hero_desc">浩瀚视野 · 构筑灵感新境</div>
    </div>
  </div>
  <ul><li>第一点</li><li>第二点</li></ul>
`);
assert.ok(flow.some((n) => n.type === 'h' && n.text.includes('精选视觉')), 'heading harvested');
assert.ok(flow.some((n) => n.type === 'img' && n.src.startsWith('data:image')), 'img harvested');
assert.ok(flow.some((n) => n.type === 'p' && /FEATURED VISUAL/.test(n.text)), 'slot caption harvested');
assert.ok(flow.some((n) => n.type === 'li' && n.text === '第一点'), 'list harvested');

const fsStub = {
  readFileBytes(p) {
    if (String(p).includes('compose_mt7d36y4')) return PNG;
    throw new Error(`ENOENT: ${p}`);
  }
};
const rewritten = rewriteGuestImageSrcs(
  '<img src="/artifacts/compose_mt7d36y4/compose_mt7d36y4.png" alt="x">',
  fsStub,
  { get() { return null; } },
  's1'
);
assert.match(rewritten, /data:image\/png;base64,/);
assert.doesNotMatch(rewritten, /\/artifacts\/compose_mt7d36y4/);

const rewrittenExt = rewriteGuestImageSrcs(
  '<img src="chrome-extension://abc/artifacts/compose_mt7d36y4/compose_mt7d36y4.png" alt="x">',
  fsStub,
  { get() { return null; } },
  's1'
);
assert.match(rewrittenExt, /data:image\/png;base64,/);

const rewrittenSrcset = rewriteGuestImageSrcs(
  '<img src="/artifacts/compose_mt7d36y4/compose_mt7d36y4.png" srcset="/artifacts/compose_mt7d36y4/compose_mt7d36y4.png 1x" poster="/artifacts/compose_mt7d36y4/compose_mt7d36y4.png" alt="x">',
  fsStub,
  { get() { return null; } },
  's1'
);
assert.match(rewrittenSrcset, /srcset="data:image\/png;base64,/);
assert.match(rewrittenSrcset, /poster="data:image\/png;base64,/);

const plates = [
  {
    kind: 'html',
    id: 'hero',
    title: '精选视觉宣传海报',
    html: `<h1>精选视觉宣传海报</h1>
      <img data-paw-slot="hero_image" src="${DATA}" alt="主视觉图">
      <p data-paw-slot="hero_desc">浩瀚视野 · 构筑灵感新境</p>`
  },
  {
    kind: 'html',
    id: 'gallery',
    title: 'Gallery',
    html: `<h2>画廊</h2><img src="${DATA}" alt="a"><img src="${DATA}" alt="b">`,
    inlineImages: [
      { bytes: PNG, mime: 'image/png', src: DATA, alt: 'a' },
      { bytes: PNG, mime: 'image/png', src: `${DATA}#2`, alt: 'b' }
    ]
  }
];

const docx = exportPlates(plates, 'docx', { title: '精选视觉宣传海报' });
assert.equal(docx.filename.endsWith('.docx'), true);
assert.equal(docx.bytes[0], 0x50);
assert.equal(docx.bytes[1], 0x4b);
const docxFiles = unzipSync(docx.bytes);
const docxNames = Object.keys(docxFiles);
assert.ok(
  docxNames.some((n) => n.startsWith('word/media/image')),
  `docx must embed media, got ${docxNames.join(',')}`
);
const documentXml = strFromU8(docxFiles['word/document.xml'] || new Uint8Array());
assert.match(documentXml, /<a:blip r:embed=/);
assert.match(documentXml, /精选视觉宣传海报/);
assert.match(documentXml, /浩瀚视野/);

const pptx = exportPlates(plates, 'pptx', { title: '精选视觉宣传海报' });
assert.equal(pptx.filename.endsWith('.pptx'), true);
const pptxFiles = unzipSync(pptx.bytes);
const pptxNames = Object.keys(pptxFiles);
assert.ok(
  pptxNames.some((n) => n.startsWith('ppt/media/image')),
  `pptx must embed media, got ${pptxNames.join(',')}`
);
const slide1 = strFromU8(pptxFiles['ppt/slides/slide1.xml'] || new Uint8Array());
assert.match(slide1, /<p:pic>/);
assert.match(slide1, /<a:blip r:embed=/);

const textOnly = exportPlates(
  [{ kind: 'html', title: 'T', html: '<h1>T</h1><p>B</p>', text: 'B' }],
  'docx',
  { title: 'Mix' }
);
assert.ok(textOnly.bytes.byteLength > 10);

const poster = [
  {
    kind: 'html',
    id: 'hero',
    html: `<h1>探索光影与自然的视觉之旅</h1>
      <img data-paw-slot="hero_image" src="${DATA}" alt="主视觉图">
      <p>FEATURED VISUAL</p><p>浩瀚视野 · 构筑灵感新境</p>`
  },
  {
    kind: 'html',
    id: 'gallery',
    html: `<h2>画廊</h2>
      <h3>璀璨光华 · 创意维度</h3>
      <img src="${DATA}" alt="a">
      <h3>暮色余晖 · 沉静意境</h3>
      <img src="${DATA}" alt="b">`
  }
];
const posterDocx = exportPlates(poster, 'docx', { title: '精选视觉宣传海报' });
const posterDocxFiles = unzipSync(posterDocx.bytes);
const posterMedia = Object.keys(posterDocxFiles).filter((n) => n.startsWith('word/media/'));
assert.equal(posterMedia.length >= 3, true, `expected ≥3 embedded images, got ${posterMedia.join(',')}`);
const posterXml = strFromU8(posterDocxFiles['word/document.xml'] || new Uint8Array());
assert.match(posterXml, /Heading2/);
assert.match(posterXml, /璀璨光华/);

const posterPptx = exportPlates(poster, 'pptx', {
  title: '精选视觉宣传海报',
  styles: ':root { --bg: #0f172a; --text-main: #f8fafc; --accent: #3b82f6; }'
});
const posterPptxFiles = unzipSync(posterPptx.bytes);
const pptMedia = Object.keys(posterPptxFiles).filter((n) => n.startsWith('ppt/media/'));
assert.equal(pptMedia.length >= 3, true, `pptx media ${pptMedia.join(',')}`);
const slideHero = strFromU8(posterPptxFiles['ppt/slides/slide1.xml'] || new Uint8Array());
assert.match(slideHero, /<p:pic>/);
assert.match(slideHero, /<a:srgbClr val="0F172A"\/>/);
assert.match(slideHero, /<a:srgbClr val="F8FAFC"\/>/);

const htmlKeep = exportPlates(
  [
    {
      id: 'hero',
      html: `<h1 data-paw-slot="headline">标题</h1><img data-paw-slot="cover" src="https://cdn.example/a.png" alt="c">`
    }
  ],
  'html',
  { title: '海报', styles: ':root { --paw-poster-w: 720px; }', kind: 'poster' }
);
const htmlText = Buffer.from(htmlKeep.bytes).toString('utf8');
assert.match(htmlText, /data-pawwork-preview="blocks"/);
assert.match(htmlText, /data-paw-kind="poster"/);
assert.match(htmlText, /data-paw-slot="headline"/);
assert.match(htmlText, /src="https:\/\/cdn\.example\/a\.png"/);
assert.doesNotMatch(htmlText, /print-plate/);

console.log('test_html_export: ok');
