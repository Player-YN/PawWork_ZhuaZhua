/**
 * Simulate desktop 测试Prompts 1–5,8 as a user through host APIs (no Chrome).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/store.js';
import { createSession } from '../../src/agent/vnext/sessionWorkspace/sessionApi.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { listArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { applyHtmlCommands, parseMarkedHtml } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { platesToPrintHtml, detectHtmlKind } from '../../src/agent/vnext/sessionWorkspace/printHtml.js';
import { isArtboardKind } from '../../src/agent/vnext/sessionWorkspace/htmlArtboard.js';
import { pdfBytesToHtml, looksLikePdf } from '../../src/agent/vnext/sessionWorkspace/pdfIngest.js';
import { workbookFromXlsxBytes } from '../../src/preview/xlsxIngest.js';
import { toggleSelection } from '../../src/agent/vnext/sessionWorkspace/frameLayout.js';
import { REPORT_HTML } from '../../src/agent/vnext/skills/html-preview/templates/reportHtml.js';

const POSTER_HTML = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="poster">
<body>
<section data-paw-block data-paw-block-id="poster">
  <p data-paw-slot="kicker" data-box="40,40,200,24">{{kicker}}</p>
  <h1 data-paw-slot="headline" data-box="40,88,640,120">{{headline}}</h1>
  <img data-paw-slot="cover" data-box="40,220,640,400" src="{{cover}}" alt="">
  <p data-paw-slot="caption" data-box="40,640,640,40">{{caption}}</p>
  <p data-paw-slot="cta" data-box="40,700,200,40">{{cta}}</p>
</section>
</body></html>`;
import * as XLSX from 'xlsx';

function fill(html, map) {
  let s = html;
  for (const [k, v] of Object.entries(map)) s = s.split(`{{${k}}}`).join(v);
  return s;
}

const store = new SessionWorkspaceStore();
const sessionId = 'verify-user';
createSession(store, { sessionId });
const execution = beginExecution(store, sessionId, {});
const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
guest.mkdirp('/artifacts');
const tools = createSessionTools({ store, execution, fs: guest, sessionId });

const poster = fill(POSTER_HTML, {
  kicker: 'Paw Work · 2026 校园招聘',
  headline: '来一起把网页变成交付物',
  cover: 'https://example.com/desk.png',
  caption: '北京 / 杭州｜产品设计、前端、Agent 工程｜本科及以上｜3 月底截止',
  cta: '投递简历 → campus@paw.work'
});
assert.match(poster, /data-paw-block-id="poster"/);
assert.match(poster, /data-paw-slot="kicker"/);
assert.match(poster, /data-paw-slot="headline"/);
assert.match(poster, /data-paw-slot="cover"/);
assert.match(poster, /data-paw-slot="caption"/);
assert.match(poster, /data-paw-slot="cta"/);
assert.match(poster, /data-box=/);
assert.equal(detectHtmlKind(poster), 'poster');
assert.equal(isArtboardKind('poster'), true);
assert.equal(isArtboardKind('document'), false);

const w1 = await tools.run.execute({
  op: 'write_artifact',
  name: 'campus_recruitment_poster.html',
  mimeType: 'text/html',
  content: poster
});
assert.equal(w1.ok, false);
assert.equal(w1.code, 'USE_CANVAS');
const compiled = await tools.run.execute({
  op: 'html',
  name: 'campus.json',
  commands: [{ op: 'fromPage', html: poster, kind: 'poster', title: 'campus' }]
});
assert.equal(compiled.ok, true, compiled.error);
const id = compiled.artifact.artifactId;

const afterTitle = applyHtmlCommands(
  poster,
  [{ op: 'setSlotText', plateId: 'poster', slotId: 'headline', text: '把选择变成结果' }],
  { draft: false }
);
assert.match(afterTitle.html, /data-paw-slot="headline"[^>]*>把选择变成结果</);
assert.match(afterTitle.html, /campus@paw.work/);
assert.match(afterTitle.html, /desk.png/);
assert.doesNotMatch(afterTitle.html, /data-paw-slot="headline"[^>]*>来一起把网页变成交付物</);

const w2 = await tools.run.execute({
  op: 'write_artifact',
  name: 'campus_recruitment_poster.html',
  mimeType: 'text/html',
  content: afterTitle.html
});
assert.equal(w2.ok, false);
assert.equal(w2.code, 'USE_CANVAS');
assert.equal(listArtifacts(store, sessionId).filter((a) => /\.json$/i.test(a.name)).length, 1);

const parsed = parseMarkedHtml(afterTitle.html);
assert.equal(parsed.plates.length, 1);

let sel = toggleSelection([], 'poster', 'headline', false);
sel = toggleSelection(sel, 'poster', 'cover', true);
assert.equal(sel.length, 2);

assert.equal(isArtboardKind('deck'), true);
assert.match(REPORT_HTML, /data-paw-slot=/);
assert.equal(isArtboardKind(detectHtmlKind(REPORT_HTML)), false);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['招聘总人数', 20],
  ['序号', '部门', 'HC', '已入职', '缺口']
]);
XLSX.utils.book_append_sheet(wb, ws, '内容页');
const xbytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
const data = workbookFromXlsxBytes(XLSX, xbytes, { name: '招聘' });
assert.equal(data.sheets['sheet-0'].name, '内容页');

const print = platesToPrintHtml(parsed.plates, {
  title: '海报',
  kind: 'poster',
  styles: parsed.styles || ':root{--paw-poster-w:720px;--paw-poster-h:1080px}'
});
assert.match(print, /print-color-adjust/);
assert.match(print, /720px !important/);

const pdfPath = 'C:/Users/yyy/Desktop/海报.pdf';
if (fs.existsSync(pdfPath)) {
  const raw = fs.readFileSync(pdfPath);
  assert.equal(looksLikePdf(raw), true);
  const pdf = await pdfBytesToHtml(raw, { title: '海报' });
  assert.match(pdf.html, /data-paw-kind="poster"/);
  console.log('prompt8 live 海报.pdf visual=', !!pdf.visual, 'kind ok');
}

const xlsxLive = 'C:/Users/yyy/Desktop/公司招聘计划统计表1.xlsx';
if (fs.existsSync(xlsxLive)) {
  const real = workbookFromXlsxBytes(XLSX, fs.readFileSync(xlsxLive), { id: 'live' });
  const sh = real.sheets['sheet-0'];
  console.log(
    'prompt9 live xlsx',
    sh.name,
    'merges',
    sh.mergeData?.length,
    'SUM',
    JSON.stringify(sh.cellData).includes('SUM')
  );
}

console.log('test_prompt_user_sim: ok');
