import assert from 'node:assert/strict';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/store.js';
import { createSession } from '../../src/agent/vnext/sessionWorkspace/sessionApi.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { listArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { applyHtmlCommands } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { alignBoxes, distributeBoxes, resolveHtmlUpsertTarget } from '../../src/agent/vnext/sessionWorkspace/htmlArtboard.js';
import { platesToPrintHtml } from '../../src/agent/vnext/sessionWorkspace/printHtml.js';
import { toggleSelection } from '../../src/agent/vnext/sessionWorkspace/frameLayout.js';
import { formatRpcError } from '../../src/agent/vnext/host/rpcError.js';
const POSTER_HTML = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="poster">
<body>
<section data-paw-block data-paw-block-id="poster">
  <p data-paw-slot="kicker" data-box="40,40,200,24">{{kicker}}</p>
  <h1 data-paw-slot="headline" data-box="40,88,640,120">{{headline}}</h1>
  <img data-paw-slot="cover" src="{{cover}}" alt="">
  <p data-paw-slot="caption">{{caption}}</p>
  <p data-paw-slot="cta">{{cta}}</p>
</section>
</body></html>`;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const board = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="poster">
<head><style>:root { --paw-poster-w: 720px; --paw-poster-h: 1080px; }</style></head>
<body>
<section data-paw-block data-paw-block-id="poster">
  <h1 data-paw-slot="headline" data-box="40,80,200,40">A</h1>
  <p data-paw-slot="caption" data-box="80,200,200,40">B</p>
  <p data-paw-slot="cta" data-box="300,200,100,40">C</p>
</section>
</body></html>`;

const aligned = applyHtmlCommands(
  board,
  [{ op: 'align', align: 'left', plateId: 'poster', slotIds: ['headline', 'caption'] }],
  { draft: false }
);
assert.equal(aligned.ok, true, aligned.error);
assert.match(aligned.html, /data-box="40,80,200,40"/);
assert.match(aligned.html, /data-box="40,200,200,40"/);

const z = applyHtmlCommands(
  board,
  [{ op: 'reorderSlots', plateId: 'poster', order: ['cta', 'headline', 'caption'] }],
  { draft: false }
);
assert.equal(z.ok, true, z.error);
const ctaAt = z.html.indexOf('data-paw-slot="cta"');
const headAt = z.html.indexOf('data-paw-slot="headline"');
assert.ok(ctaAt >= 0 && ctaAt < headAt);

const grouped = applyHtmlCommands(
  board,
  [{ op: 'group', plateId: 'poster', slotIds: ['headline', 'caption'], groupId: 'g1' }],
  { draft: false }
);
assert.match(grouped.html, /data-paw-group="g1"/);

const hid = applyHtmlCommands(
  board,
  [{ op: 'setHidden', plateId: 'poster', slotId: 'cta', value: true }],
  { draft: false }
);
assert.match(hid.html, /data-paw-hidden="1"/);

const boxes = alignBoxes(
  [
    { id: 'a', x: 10, y: 10, w: 20, h: 10 },
    { id: 'b', x: 50, y: 40, w: 20, h: 10 }
  ],
  'left'
);
assert.equal(boxes[0].x, 10);
assert.equal(boxes[1].x, 10);

const dist = distributeBoxes(
  [
    { id: 'a', x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', x: 20, y: 0, w: 10, h: 10 },
    { id: 'c', x: 90, y: 0, w: 10, h: 10 }
  ],
  'x'
);
assert.equal(dist.length, 3);

assert.match(POSTER_HTML, /data-paw-block-id="poster"/);
assert.match(POSTER_HTML, /data-box="40,88,640,120"/);
assert.doesNotMatch(POSTER_HTML, /data-paw-block-id="title"/);

const store = new SessionWorkspaceStore();
const sessionId = 's-artboard';
createSession(store, { sessionId });
const execution = beginExecution(store, sessionId, {});
const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
guest.mkdirp('/artifacts');
const tools = createSessionTools({ store, execution, fs: guest, sessionId });

const blocked = await tools.run.execute({
  op: 'write_artifact',
  name: 'campus_recruitment_poster.html',
  mimeType: 'text/html',
  content: POSTER_HTML.replace(/\{\{headline\}\}/g, '来一起').replace(/\{\{kicker\}\}/g, 'K')
    .replace(/\{\{cover\}\}/g, 'x.png')
    .replace(/\{\{caption\}\}/g, 'cap')
    .replace(/\{\{cta\}\}/g, '投')
});
assert.equal(blocked.ok, false);
assert.equal(blocked.code, 'USE_CANVAS');
const compiled = await tools.run.execute({
  op: 'html',
  name: 'campus_recruitment_poster.json',
  commands: [
    {
      op: 'createScene',
      kind: 'poster',
      title: '新标题',
      nodes: [{ id: 'headline', type: 'headline', text: '新标题' }]
    }
  ]
});
assert.equal(compiled.ok, true, compiled.error);
assert.match(String(compiled.artifact?.name || ''), /\.json$/i);

const previewJs = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/preview/artifactPreview.js'),
  'utf8'
);
const previewHtml = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/preview/artifactPreview.html'),
  'utf8'
);
assert.doesNotMatch(previewJs, /toggleSelection/);
assert.match(previewJs, /srcdoc/);
assert.doesNotMatch(previewJs, /mountArtboardKonva/);
assert.doesNotMatch(previewJs, /from '\\.\/artboardStage/);
assert.equal(fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/preview/artboardStage.js')), false);
assert.equal(fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/preview/artboardKonva.js')), false);
assert.doesNotMatch(previewHtml, /id="layers"/);
assert.doesNotMatch(previewHtml, /class="artboard-tools/);
assert.match(previewHtml, /id="page"/);
assert.equal(formatRpcError({ message: 'no api key' }), 'no api key');
assert.doesNotMatch(formatRpcError({ foo: 1, error: { message: 'model 401' } }), /\[object Object\]/);
assert.doesNotMatch(formatRpcError({}), /\[object Object\]/);

const one = toggleSelection([], 'poster', 'headline', false);
const two = toggleSelection(one, 'poster', 'cover', true);
assert.equal(two.length, 2);
assert.equal(toggleSelection(two, 'poster', 'cover', true).length, 1);

const printed = platesToPrintHtml(
  [{ id: 'poster', html: '<img data-paw-slot="cover" data-box="48,208,624,520" src="x.png" class="is-slot-selected">' }],
  { title: '海报', kind: 'poster', styles: ':root { --paw-poster-w: 720px; --paw-poster-h: 1080px; }' }
);
assert.match(printed, /print-color-adjust:\s*exact/);
assert.match(printed, /size:\s*7\.5/);
assert.doesNotMatch(printed, /is-slot-selected/);
assert.match(printed, /height: 1080px !important/);
assert.doesNotMatch(printed, /body\.paw-kind-poster img \{[^}]*height:\s*100%/);
assert.match(printed, /left:48px;top:208px;width:624px;height:520px/);

console.log('test_html_artboard: ok');
