import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { createScene, isCoverOnlyPoster } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { parseMarkedHtml, defaultPasteboardBox } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { framesFromBlocks } from '../../src/agent/vnext/sessionWorkspace/frameLayout.js';
import { loadSkillInstructions } from '../../src/agent/vnext/skills/registry.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PAGE = `<!DOCTYPE html>
<html><body>
<section class="hero-section">
  <h1>闪念贝壳</h1>
  <img src="https://example.com/hero.png" alt="hero photo">
  <a class="cta" href="/watch">观看视频</a>
  <p>产品介绍不应糊成整段唯一槽</p>
</section>
</body></html>`;

// --- two Frames stay two boards ---
const two = createScene({
  kind: 'poster',
  title: 'Board',
  frames: [
    {
      id: 'poster',
      name: 'Poster',
      frameBox: { x: 0, y: 0, w: 720, h: 1080 },
      nodes: [
        { id: 'headline', type: 'headline', text: '主海报' },
        { id: 'hero', type: 'image', src: 'https://example.com/a.png', alt: 'a' },
        { id: 'body', type: 'text', text: '说明文字' }
      ]
    },
    {
      id: 'ref',
      name: 'Reference',
      frameBox: { x: 800, y: 0, w: 720, h: 1080 },
      nodes: [
        { id: 'shot', type: 'image', src: 'https://example.com/ref.png', alt: 'ref' },
        { id: 'cap', type: 'text', text: '参考截图' },
        { id: 'note', type: 'text', text: '并排 Frame' }
      ]
    }
  ]
});
assert.equal(two.ok, true, two.error);
const parsed = parseMarkedHtml(two.html);
assert.equal(parsed.plates.length, 2, 'two Frame plates');
assert.equal(parsed.plates[0].id, 'poster');
assert.equal(parsed.plates[1].id, 'ref');
assert.deepEqual(parsed.plates[0].frameBox, { x: 0, y: 0, w: 720, h: 1080 });
assert.deepEqual(parsed.plates[1].frameBox, { x: 800, y: 0, w: 720, h: 1080 });
assert.match(two.html, /data-paw-frame="poster"/);
assert.match(two.html, /data-frame-box="800,0,720,1080"/);
assert.match(two.html, /data-frame-name="Reference"/);

const boards = framesFromBlocks(
  parsed.plates.map((p) => ({
    id: p.id,
    html: p.html,
    frameBox: p.frameBox,
    frameName: p.frameName
  })),
  { kind: 'poster', styles: parsed.styles }
);
assert.equal(boards.length, 2, 'framesFromBlocks must not merge posters');
assert.notEqual(boards[0].id, boards[1].id);
assert.equal(boards[0].frameBox.x, 0);
assert.equal(boards[1].frameBox.x, 800);
assert.equal(boards[0].name, 'Poster');
assert.equal(boards[1].name, 'Reference');

const laid = framesFromBlocks(
  [
    { id: 'a', html: '<p data-paw-slot="t">a</p>' },
    { id: 'b', html: '<p data-paw-slot="u">b</p>' }
  ],
  { kind: 'poster', styles: ':root { --paw-poster-w: 720px; --paw-poster-h: 1080px; }' }
);
assert.equal(laid.length, 2);
assert.deepEqual(laid[0].frameBox, defaultPasteboardBox(0, { w: 720, h: 1080 }, 'poster'));
assert.deepEqual(laid[1].frameBox, defaultPasteboardBox(1, { w: 720, h: 1080 }, 'poster'));
assert.notEqual(laid[0].frameBox.x, laid[1].frameBox.x);

// --- poster compile ≥3 slots, text, no sole cover ---
const compiled = createScene({ op: 'fromPage', html: PAGE, kind: 'poster' });
assert.equal(compiled.ok, true, compiled.error);
assert.ok(compiled.nodes.length >= 3, `nodes ${compiled.nodes.map((n) => n.id)}`);
assert.ok(compiled.nodes.some((n) => /闪念贝壳/.test(n.text)));
assert.ok(compiled.nodes.some((n) => n.type === 'image' || /hero\.png/.test(n.src)));
assert.equal(isCoverOnlyPoster(compiled.nodes), false);

const cover = createScene({
  kind: 'poster',
  title: 'Shot',
  nodes: [{ id: 'cover', type: 'image', src: 'https://example.com/only.png', alt: 'only' }]
});
assert.equal(cover.ok, true, cover.error);
assert.equal(isCoverOnlyPoster(cover.nodes), false);
assert.ok(cover.nodes.length >= 3);
assert.ok(cover.nodes.some((n) => n.type === 'headline' || n.tag === 'h1'));
assert.ok(cover.nodes.some((n) => n.type === 'image' || n.tag === 'img'));
assert.ok((cover.html.match(/data-paw-slot=/g) || []).length >= 3);

// --- 3-page deck: write page 2 leaves 1 and 3 ---
const deck = createScene({
  kind: 'deck',
  title: 'Pitch',
  frames: [
    { id: 's1', name: 'One', nodes: [{ id: 'title', type: 'headline', text: 'PAGE-ONE' }] },
    { id: 's2', name: 'Two', nodes: [{ id: 'title', type: 'headline', text: 'PAGE-TWO' }] },
    {
      id: 's3',
      name: 'Three',
      nodes: [{ id: 'title', type: 'headline', text: 'PAGE-THREE' }],
      notes: 'speaker three'
    }
  ]
});
assert.equal(deck.ok, true, deck.error);
assert.match(deck.html, /data-paw-slide/);
assert.match(deck.html, /data-paw-notes=/);
assert.ok(deck.nodes.some((n) => /PAGE-ONE/.test(n.text)));
assert.ok(deck.nodes.some((n) => /PAGE-THREE/.test(n.text)));
assert.match(deck.html, /PAGE-TWO/);

// --- chrome contract ---
const previewHtml = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
const previewJs = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');
const stageJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/frameLayout.js'), 'utf8');
const bgJs = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
assert.match(previewHtml, /id="page"/);
assert.doesNotMatch(previewHtml, /id="layers"/);
assert.doesNotMatch(previewHtml, /id="inspector"/);
assert.doesNotMatch(previewHtml, /id="filmstrip"/);
assert.doesNotMatch(previewHtml, /class="artboard-tools/);
assert.match(stageJs, /framesFromBlocks/);
assert.doesNotMatch(stageJs, /mergePosterBoard/);
assert.match(previewJs, /srcdoc/);
assert.doesNotMatch(previewJs, /renderStandaloneHtml/);
assert.doesNotMatch(previewJs, /looksLikeStandaloneHtmlPage/);
assert.doesNotMatch(previewJs, /renderFilmstrip/);
assert.match(bgJs, /html_canvas_updated/);
assert.match(bgJs, /pawwork_html_preview_patch/);
assert.doesNotMatch(bgJs, /chrome\.tabs\.reload\(existing\.id\).*artifactPreview/);

for (const id of ['poster', 'slides', 'html-poster', 'html-deck']) {
  const playbook = loadSkillInstructions(id);
  assert.doesNotMatch(playbook, /op=html/, `${id} must not teach run op=html mutate`);
  assert.match(playbook, /`deck` tool|`deck` `setSlotText/);
}

console.log('test_visual_canvas_shells: ok');
console.log('frames', boards.map((b) => `${b.id}@${b.frameBox.x}`).join(','));
console.log('poster-nodes', compiled.nodes.length);
