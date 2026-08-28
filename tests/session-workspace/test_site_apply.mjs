import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { inventoryFromSession } from '../../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { scheduleActiveToolNames } from '../../src/agent/vnext/sessionWorkspace/toolSchedule.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  applySiteCommands,
  listSiteNodes,
  stampSiteHtml,
  nextSitePinIds,
  pinnedSiteIds,
  siteSelectionsFromIds,
  formatSiteSelLabel
} from '../../src/agent/vnext/sessionWorkspace/siteApply.js';
import { createArtifact, listArtifacts, revertArtifactContent } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { rewriteGuestImageSrcs } from '../../src/agent/vnext/sessionWorkspace/htmlMedia.js';
import { artifactImageName, titleFromImagePrompt } from '../../src/agent/vnext/sessionWorkspace/imageGen.js';
import { previewEntryForItem } from '../../src/agent/vnext/sessionWorkspace/openClassify.js';
import { buildWorldStateBlock } from '../../src/agent/vnext/sessionWorkspace/prompt.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const RAW = `<!DOCTYPE html>
<html data-paw-kind="site">
<head><meta charset="utf-8" /><title>Acme</title></head>
<body>
  <h1>Welcome</h1>
  <p>Hello world</p>
  <a href="/old">Docs</a>
  <img src="hero.png" alt="hero" />
</body>
</html>`;

const stamped = stampSiteHtml(RAW);
assert.match(stamped, /data-paw-kind="site"/);
assert.match(stamped, /data-paw-node="n1"/);
const nodes = listSiteNodes(stamped);
assert.ok(nodes.some((n) => n.tag === 'h1' && n.text.includes('Welcome')));
assert.ok(nodes.some((n) => n.tag === 'a' && n.href === '/old'));
assert.ok(nodes.some((n) => n.tag === 'img' && n.src === 'hero.png'));

const h1 = nodes.find((n) => n.tag === 'h1');
const deny = applySiteCommands(stamped, [{ op: 'setText', text: 'Next' }]);
assert.equal(deny.ok, false);
assert.equal(deny.code, 'NEED_SELECTION');

const renamed = applySiteCommands(stamped, [{ op: 'setText', nodeId: h1.nodeId, text: 'Acme Cloud' }]);
assert.equal(renamed.ok, true);
assert.match(renamed.html, />Acme Cloud</);
assert.equal(renamed.readback.text, 'Acme Cloud');

const replacedHtml = applySiteCommands(renamed.html, [
  {
    op: 'replaceHtml',
    html: `<!DOCTYPE html><html data-paw-kind="site"><body><h1>整页替换</h1><p>path bind</p></body></html>`
  }
]);
assert.equal(replacedHtml.ok, true, replacedHtml.error);
assert.match(replacedHtml.html, /整页替换/);
assert.match(replacedHtml.html, /data-paw-kind="site"/);
const unmarked = applySiteCommands(renamed.html, [{ op: 'replaceHtml', html: '<div>pretty poster</div>' }]);
assert.equal(unmarked.ok, false);
assert.equal(unmarked.code, 'USE_CANVAS');

const link = nodes.find((n) => n.tag === 'a');
const hrefed = applySiteCommands(renamed.html, [{ op: 'setHref', nodeId: link.nodeId, href: '/docs' }]);
assert.match(hrefed.html, /href="\/docs"/);

const img = nodes.find((n) => n.tag === 'img');
const srcd = applySiteCommands(hrefed.html, [{ op: 'setSrc', nodeId: img.nodeId, src: 'next.png' }]);
assert.match(srcd.html, /src="next.png"/);

const viaSel = applySiteCommands(
  srcd.html,
  [{ op: 'setText', text: 'Pinned' }],
  { selections: [{ nodeId: h1.nodeId }] }
);
assert.equal(viaSel.ok, true);
assert.match(viaSel.html, />Pinned</);

const pNode = nodes.find((n) => n.tag === 'p');
assert.deepEqual(nextSitePinIds([], 'n1'), ['n1']);
assert.deepEqual(nextSitePinIds(['n1'], 'n2', { ctrlKey: true }), ['n1', 'n2']);
assert.deepEqual(nextSitePinIds(['n1', 'n2'], 'n1', { metaKey: true }), ['n2']);
assert.deepEqual(nextSitePinIds(['n1', 'n2'], 'n3'), ['n3']);
assert.deepEqual(nextSitePinIds(['n1', 'n2'], ''), []);
assert.deepEqual(nextSitePinIds(['n1'], 'n3', { shiftKey: true }, ['n1', 'n2', 'n3']), ['n1', 'n2', 'n3']);
assert.deepEqual(pinnedSiteIds([{ nodeId: 'n1' }, { slotId: 'n2' }, { nodeId: 'n1' }]), ['n1', 'n2']);
const twoPins = applySiteCommands(stamped, [{ op: 'setText', text: 'Both' }], {
  selections: [{ nodeId: h1.nodeId }, { nodeId: pNode.nodeId }]
});
assert.equal(twoPins.ok, true);
assert.match(twoPins.html, />Both</);
assert.equal((twoPins.html.match(/>Both</g) || []).length, 2);
assert.deepEqual(twoPins.selected, [h1.nodeId, pNode.nodeId]);
assert.deepEqual(twoPins.nodeIds, [h1.nodeId, pNode.nodeId]);
const pair = siteSelectionsFromIds(stamped, [h1.nodeId, pNode.nodeId]);
assert.equal(pair.length, 2);
assert.equal(formatSiteSelLabel(pair), '已选 2 项');

const needDel = applySiteCommands(stamped, [{ op: 'remove' }]);
assert.equal(needDel.ok, false);
assert.equal(needDel.code, 'NEED_SELECTION');
const deleted = applySiteCommands(stamped, [{ op: 'remove', nodeId: h1.nodeId }]);
assert.equal(deleted.ok, true);
assert.doesNotMatch(deleted.html, />Welcome</);
assert.equal(deleted.available.includes(h1.nodeId), false);
assert.equal(deleted.selected.includes(h1.nodeId), false);
const duped = applySiteCommands(stamped, [{ op: 'duplicate', nodeId: h1.nodeId }]);
assert.equal(duped.ok, true);
assert.equal((duped.html.match(/>Welcome</g) || []).length, 2);
assert.ok(duped.nodeIds.length >= 1);
assert.ok(duped.nodeIds[0] !== h1.nodeId);

function setup(id) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: id });
  const execution = beginExecution(store, id, {});
  const guest = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const events = [];
  const tools = createSessionTools({
    store,
    execution,
    fs: guest,
    sessionId: id,
    onEvent: (ev) => events.push(ev)
  });
  return { store, guest, tools, sessionId: id, events };
}

const { store, guest, tools, sessionId, events } = setup('s-site');
assert.equal(typeof tools.web.execute, 'function');

const created = await tools.run.execute({
  op: 'write_artifact',
  name: 'home.html',
  mimeType: 'text/html',
  content: RAW
});
assert.equal(created.ok, true, created.error);
assert.ok(events.some((e) => e.type === 'artifact_preview' && e.kind === 'site'));
const htmlNow = guest.readFile(created.artifact.primaryPath);
assert.match(htmlNow, /data-paw-node=/);

const inv = inventoryFromSession(store, sessionId, guest);
assert.ok(inv.web.includes(created.artifact.artifactId));
assert.ok(scheduleActiveToolNames(inv).includes('web'));
assert.equal(previewEntryForItem({ text: htmlNow, name: 'home.html' }).entry, 'site.html');

const world = buildWorldStateBlock({
  canvases: inv,
  activeHtml: {
    artifactId: created.artifact.artifactId,
    kind: 'site',
    overview: { kind: 'site', selections: [{ nodeId: h1.nodeId }] }
  }
});
assert.match(world, /open website page/);
assert.match(world, /tools themselves stay available/);
assert.doesNotMatch(world, /MUST call/);

const read = await tools.web.execute({ act: 'read' });
assert.equal(read.ok, true, read.error);
assert.ok(read.nodes.some((n) => n.tag === 'h1'));
assert.equal(read.motion?.runtime, 'packaged');
assert.equal(read.motion?.guestScripts, false);

const miss = await tools.web.execute({ act: 'write', text: 'Nope' });
assert.equal(miss.ok, false);
assert.equal(miss.code, 'NEED_SELECTION');

const wrote = await tools.web.execute({
  act: 'write',
  nodeId: read.nodes.find((n) => n.tag === 'h1').nodeId,
  text: 'Clicked title'
});
assert.equal(wrote.ok, true, wrote.error);
assert.equal(wrote.readback.text, 'Clicked title');
assert.match(guest.readFile(created.artifact.primaryPath), />Clicked title</);
assert.ok(events.some((e) => e.type === 'html_canvas_updated'));

store.put('sessions', sessionId, {
  ...store.get('sessions', sessionId),
  activeHtml: {
    artifactId: created.artifact.artifactId,
    selections: [{ nodeId: read.nodes.find((n) => n.tag === 'p').nodeId }]
  }
});
const pinned = await tools.web.execute({ act: 'write', text: 'Body copy' });
assert.equal(pinned.ok, true, pinned.error);
assert.match(guest.readFile(created.artifact.primaryPath), />Body copy</);

const h1Id = read.nodes.find((n) => n.tag === 'h1').nodeId;
const pId = read.nodes.find((n) => n.tag === 'p').nodeId;
const svc = new SessionWorkspaceService({ store });
await svc.setActiveHtml({
  sessionId,
  artifactId: created.artifact.artifactId,
  overview: {
    kind: 'site',
    selections: [
      { nodeId: h1Id, tag: 'h1', text: 'Clicked title', kind: 'text' },
      { nodeId: pId, tag: 'p', text: 'Body copy', kind: 'text' }
    ]
  }
});
const hostPins = store.get('sessions', sessionId).activeHtml.selections;
assert.equal(hostPins.length, 2);
assert.deepEqual(hostPins.map((s) => s.nodeId), [h1Id, pId]);
const hostRead = await tools.web.execute({ act: 'read' });
assert.deepEqual(hostRead.selected, [h1Id, pId]);
assert.equal(hostRead.selections.length, 2);
const both = await tools.web.execute({ act: 'write', text: 'Together' });
assert.equal(both.ok, true, both.error);
assert.deepEqual(both.selected, [h1Id, pId]);
assert.equal((guest.readFile(created.artifact.primaryPath).match(/>Together</g) || []).length, 2);
const inspected = await tools.inspect.execute({ view: 'html' });
assert.equal(inspected.kind, 'site');
assert.deepEqual(inspected.selected, [h1Id, pId]);
assert.equal(inspected.selections.length, 2);

const sitePage = fs.readFileSync(path.join(root, 'src/preview/site.html'), 'utf8');
const siteJs = fs.readFileSync(path.join(root, 'src/preview/site.js'), 'utf8');
assert.match(sitePage, /id="page"/);
assert.match(sitePage, /id="undoBtn"/);
assert.match(siteJs, /srcdoc/);
assert.match(siteJs, /mountSiteMotion/);
assert.match(siteJs, /sanitizeSiteHtml/);
assert.match(siteJs, /html_tab_state/);
assert.match(siteJs, /nextSitePinIds/);
assert.match(siteJs, /ctrlKey|metaKey/);
assert.match(siteJs, /rewriteGuestMedia/);
assert.match(siteJs, /revertArtifact/);
assert.doesNotMatch(siteJs, /artboardStage|artboardKonva|mergePosterBoard/);

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG = Uint8Array.from(Buffer.from(PNG_B64, 'base64'));
const avatar = createArtifact(store, guest, {
  sessionId,
  name: '帅哥头像.png',
  displayLabel: '帅哥头像',
  mimeType: 'image/png',
  content: PNG
});
assert.equal(avatar.name, '帅哥头像.png');
assert.equal(avatar.displayLabel, '帅哥头像');

const imgNode = read.nodes.find((n) => n.tag === 'img');
const embedded = await tools.web.execute({
  act: 'write',
  nodeId: imgNode.nodeId,
  src: avatar.primaryPath
});
assert.equal(embedded.ok, true, embedded.error);
assert.equal(embedded.readback.src, avatar.primaryPath);
assert.match(guest.readFile(created.artifact.primaryPath), /src="\/artifacts\/帅哥头像\/帅哥头像\.png"/);
assert.doesNotMatch(guest.readFile(created.artifact.primaryPath), /data:image/);

const painted = rewriteGuestImageSrcs(guest.readFile(created.artifact.primaryPath), guest, store, sessionId);
assert.match(painted, /data:image\/png;base64,/);
assert.doesNotMatch(painted, /src="\/artifacts\/帅哥头像/);

const beforeUndo = guest.readFile(created.artifact.primaryPath);
const undone = await tools.web.execute({ act: 'undo' });
assert.equal(undone.ok, true, undone.error);
assert.doesNotMatch(guest.readFile(created.artifact.primaryPath), /帅哥头像/);
assert.match(guest.readFile(created.artifact.primaryPath), /src="hero\.png"/);
const redone = revertArtifactContent(store, guest, sessionId, created.artifact.artifactId);
assert.equal(redone.ok, true);
assert.equal(guest.readFile(created.artifact.primaryPath), beforeUndo);

const again = await tools.run.execute({
  op: 'write_artifact',
  name: 'result.html',
  mimeType: 'text/html',
  content: RAW.replace('Welcome', 'Patched in place')
});
assert.equal(again.ok, true, again.error);
assert.equal(again.updated, true);
assert.equal(again.artifact.artifactId, created.artifact.artifactId);
assert.equal(listArtifacts(store, sessionId).filter((a) => /\.html$/i.test(a.name)).length, 1);
assert.match(guest.readFile(created.artifact.primaryPath), /Patched in place/);

assert.equal(titleFromImagePrompt('handsome portrait headshot of a stylish man'), '帅哥头像');
assert.equal(titleFromImagePrompt('把这个头像改成一个帅哥'), '帅哥头像');
assert.equal(artifactImageName('', 'handsome portrait headshot'), '帅哥头像.png');
assert.equal(artifactImageName('paw-hello.png'), 'paw-hello.png');
assert.match(artifactImageName(''), /^compose_/);

console.log('test_site_apply: ok');
