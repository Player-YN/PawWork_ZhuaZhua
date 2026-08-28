import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
  applyHtmlCommands,
  inspectHtml
} from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { exportPlates } from '../../src/agent/vnext/sessionWorkspace/artifactExport.js';
import { platesToPrintHtml, detectHtmlKind } from '../../src/agent/vnext/sessionWorkspace/printHtml.js';
import { listSkillCatalog, loadSkillInstructions, loadSkillResource } from '../../src/agent/vnext/skills/registry.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { scheduleSessionTools } from '../../src/agent/vnext/sessionWorkspace/toolSchedule.js';
import { emptyInventory } from '../../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { REPORT_HTML } from '../../src/agent/vnext/skills/html-preview/templates/reportHtml.js';

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG = Uint8Array.from(Buffer.from(PNG_B64, 'base64'));
const DATA = `data:image/png;base64,${PNG_B64}`;

const poster = `<!DOCTYPE html>
<html lang="zh-CN" data-pawwork-preview="blocks" data-paw-kind="poster">
<head><meta name="pawwork-preview" content="blocks"><title>海报</title>
<style>:root { --paw-poster-w: 720px; --bg: #1c1917; }</style></head>
<body>
<section data-paw-block data-paw-block-id="title"><h1 data-paw-slot="headline">旧标题</h1></section>
<section data-paw-block data-paw-block-id="visual"><img data-paw-slot="cover" src="old.png" alt="cover"></section>
<section data-paw-block data-paw-block-id="caption"><p data-paw-slot="caption">旧说明</p></section>
</body></html>`;

const onlyHeadline = applyHtmlCommands(poster, [
  { op: 'setSlotText', plateId: 'title', slotId: 'headline', text: '新标题' }
], { draft: false });
assert.equal(onlyHeadline.ok, true, onlyHeadline.error);
assert.match(onlyHeadline.html, /新标题/);
assert.match(onlyHeadline.html, /旧说明/);
assert.match(onlyHeadline.html, /old\.png/);
assert.doesNotMatch(onlyHeadline.html, /旧标题/);

const onlyCover = applyHtmlCommands(poster, [
  { op: 'setSlotSrc', plateId: 'visual', slotId: 'cover', src: DATA }
], { draft: false });
assert.equal(onlyCover.ok, true, onlyCover.error);
assert.match(onlyCover.html, /data:image\/png;base64,/);
assert.match(onlyCover.html, /旧标题/);
assert.match(onlyCover.html, /旧说明/);
const ins = inspectHtml(onlyCover.html, { plateId: 'visual', slotId: 'cover' });
assert.equal(ins.slotId, 'cover');
assert.match(String(ins.slot?.src || ''), /data:image\/png/);

const deck = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="deck">
<head><style>:root { --paw-slide-w: 960px; --paw-slide-h: 540px; }</style></head>
<body>
<section data-paw-block data-paw-block-id="s1"><img data-paw-slot="hero" src="a.png" alt="a"><h1 data-paw-slot="title">A</h1></section>
<section data-paw-block data-paw-block-id="s2"><img data-paw-slot="hero" src="b.png" alt="b"><h1 data-paw-slot="title">B</h1></section>
</body></html>`;
const prop = applyHtmlCommands(deck, [{ op: 'propagateSlotSrc', slotId: 'hero', src: DATA }], { draft: false });
assert.equal(prop.ok, true, prop.error);
assert.equal((prop.html.match(/data:image\/png;base64,/g) || []).length >= 2, true);
assert.match(prop.html, />A</);
assert.match(prop.html, />B</);
assert.doesNotMatch(prop.html, /a\.png/);
assert.doesNotMatch(prop.html, /b\.png/);

const propFromClick = applyHtmlCommands(
  deck,
  [{ op: 'propagateSlotSrc', src: DATA }],
  { selections: [{ plateId: 's1', slotId: 'hero' }], draft: false }
);
assert.equal(propFromClick.ok, true, propFromClick.error);
assert.equal((propFromClick.html.match(/data:image\/png;base64,/g) || []).length >= 2, true);
assert.doesNotMatch(propFromClick.html, /a\.png/);
assert.doesNotMatch(propFromClick.html, /b\.png/);
assert.match(propFromClick.html, />A</);
assert.match(propFromClick.html, />B</);

const plates = [
  {
    kind: 'html',
    id: 's1',
    html: `<h1>路演</h1><img data-paw-slot="hero" src="${DATA}" alt="主视觉">`
  },
  {
    kind: 'html',
    id: 's2',
    html: `<h2>要点</h2><p>独立段落</p><img src="${DATA}" alt="b">`
  }
];
const pptx = exportPlates(plates, 'pptx', {
  title: '路演',
  styles: ':root { --paw-slide-w: 960px; --bg: #0f172a; --text-main: #f8fafc; }',
  kind: 'deck'
});
const pptxFiles = unzipSync(pptx.bytes);
assert.ok(
  Object.keys(pptxFiles).some((n) => n.startsWith('ppt/media/')),
  'pptx embeds media'
);
assert.match(strFromU8(pptxFiles['ppt/slides/slide1.xml'] || new Uint8Array()), /<p:pic>/);
assert.match(strFromU8(pptxFiles['ppt/slides/slide1.xml'] || new Uint8Array()), /路演/);

const docx = exportPlates(plates, 'docx', { title: '路演' });
const docxFiles = unzipSync(docx.bytes);
assert.ok(Object.keys(docxFiles).some((n) => n.startsWith('word/media/')));
assert.match(strFromU8(docxFiles['word/document.xml'] || new Uint8Array()), /r:embed=/);
assert.match(strFromU8(docxFiles['word/document.xml'] || new Uint8Array()), /路演/);

const print = platesToPrintHtml(plates, {
  title: '路演',
  kind: 'deck',
  styles: ':root { --paw-slide-w: 960px; }'
});
assert.match(print, /paw-print/);
assert.match(print, /paw-kind-deck/);
assert.doesNotMatch(print, /id="bar"/);
assert.doesNotMatch(print, /class="pw-handle"/);
assert.doesNotMatch(print, /data-act="/);
assert.match(print, /路演/);
assert.match(print, /<img/);
assert.equal(detectHtmlKind('<html data-paw-kind="deck">'), 'deck');
assert.equal(detectHtmlKind('<html data-paw-kind="poster">'), 'poster');
assert.equal(detectHtmlKind(REPORT_HTML), 'document');
assert.match(REPORT_HTML, /data-paw-slot="title"/);
assert.match(REPORT_HTML, /data-paw-slot="lead"/);

const pdfOut = exportPlates(plates, 'pdf', { title: '路演', kind: 'deck' });
const pdfHtml = new TextDecoder().decode(pdfOut.bytes);
assert.match(pdfOut.filename, /print\.html$/);
assert.match(pdfHtml, /paw-print/);
assert.doesNotMatch(pdfHtml, /id="bar"/);
assert.doesNotMatch(pdfHtml, /class="pw-handle"/);
assert.doesNotMatch(pdfHtml, /data-act="/);

const cat = listSkillCatalog();
const ids = cat.map((s) => s.id);
assert.ok(ids.includes('slides'));
assert.ok(ids.includes('poster'));
assert.ok(ids.includes('visual-compile'));
assert.ok(ids.includes('listing-sheet'));
assert.ok(ids.includes('briefing-deck'));
assert.ok(ids.includes('remake-poster'));
assert.equal(ids.includes('csv-table'), false);
assert.equal(ids.includes('markdown-report'), false);
assert.ok(ids.includes('html-preview'));
assert.ok(ids.includes('html-site'));
assert.ok(ids.includes('sheet-nl'));
const deckDesc = cat.find((s) => s.id === 'slides').description;
const posterDesc = cat.find((s) => s.id === 'poster').description;
const siteDesc = cat.find((s) => s.id === 'html-site').description;
assert.match(deckDesc, /幻灯片|PPT|slides/i);
assert.match(posterDesc, /海报/);
assert.match(siteDesc, /官网|landing|website/i);
assert.match(posterDesc, /html-site/);
assert.match(deckDesc, /html-site/);
assert.equal(loadSkillResource('slides', 'templates/deck.html'), null);
assert.equal(loadSkillResource('poster', 'templates/poster.html'), null);
assert.equal(loadSkillResource('html-deck', 'templates/deck.html'), null, 'html-deck alias still resolves');
assert.equal(loadSkillResource('html-poster', 'templates/poster.html'), null, 'html-poster alias still resolves');

for (const id of ['slides', 'poster', 'html-deck', 'html-poster']) {
  const playbook = loadSkillInstructions(id);
  assert.ok(playbook.length > 40, id);
  assert.doesNotMatch(playbook, /op=html/, `${id} must not teach run op=html mutate`);
  assert.doesNotMatch(playbook, /op=sheet/, `${id} must not teach run op=sheet mutate`);
  assert.doesNotMatch(playbook, /op=doc/, `${id} must not teach run op=doc mutate`);
  assert.match(playbook, /`deck` tool|`deck` `setSlotText/, `${id} daily edits use the deck tool`);
}
{
  const playbook = loadSkillInstructions('html-preview');
  assert.ok(playbook.length > 40);
  assert.doesNotMatch(playbook, /op=html/);
  assert.doesNotMatch(playbook, /op=sheet/);
  assert.doesNotMatch(playbook, /`deck` tool/);
  assert.match(playbook, /`doc` tool/);
}
const sitePlay = loadSkillInstructions('html-site');
assert.ok(sitePlay.length > 40);
assert.doesNotMatch(sitePlay, /op=html/);
assert.doesNotMatch(sitePlay, /op=sheet/);
assert.doesNotMatch(sitePlay, /op=doc/);
assert.match(sitePlay, /`web` tool/);
assert.match(sitePlay, /web write only/);
assert.match(sitePlay, /act=clone/);
assert.match(sitePlay, /report\.partial/);
assert.match(sitePlay, /Never manually rewrite fetched source|never manually rewrite fetched source/i);
assert.match(sitePlay, /data-paw-kind="site"/);
assert.match(sitePlay, /data-paw-\*/);
assert.match(sitePlay, /prefers-reduced-motion/);
assert.doesNotMatch(sitePlay, /`deck` tool/);
assert.match(String(loadSkillResource('html-site', 'templates/site.html')), /data-paw-kind="site"/);
assert.match(String(loadSkillResource('html-site', 'motion.json')), /"runtime": "packaged"/);

const tools = createSessionTools({
  store: { get() { return null; }, has() { return false; }, put() {} },
  execution: { executionId: 'e1' },
  fs: { readFileBytes() { return new Uint8Array(); } },
  sessionId: 's1'
});

const toolNames = Object.keys(scheduleSessionTools(tools, emptyInventory())).sort();
assert.deepEqual(toolNames, ['acquire', 'clarify', 'deck', 'doc', 'inspect', 'run', 'sheet', 'web']);
assert.equal(toolNames.includes('html-deck'), false);
assert.equal(toolNames.includes('html-poster'), false);
assert.equal(toolNames.includes('slides'), false);
assert.equal(toolNames.includes('poster'), false);

console.log('test_html_office_canvas: ok');
