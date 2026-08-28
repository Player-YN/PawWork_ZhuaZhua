import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { classifyCanvasKind } from '../../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { classifyOpenArtifact, previewEntryForKind, previewEntryForItem } from '../../src/agent/vnext/sessionWorkspace/openClassify.js';
import { createScene, documentFromArtifactText } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import {
  applyEngineCommands,
  canvasKindFromDoc,
  compileSceneToPawCanvas,
  emptyPawCanvas,
  exportPawCanvas,
  isPawCanvasDoc,
  listEngineNodes,
  parsePawCanvas,
  shapesFromPawCanvas,
  createPayloads,
  recordsFromPawCanvas,
  hydratePawCanvasImages,
  imageSrcNeedsHostPixels,
  isDisplayableImageSrc,
  normalizeImageSrc,
  summarizeImageSrc,
  unresolvedEngineImages
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const hostJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');

assert.match(html, /id="engine"/);
assert.match(html, /overflow:\s*hidden/);
assert.match(html, /data-export="png"/);
assert.match(html, /id="saveBtn"/);
assert.match(html, /id="layerList"/);
assert.match(html, /id="filmstrip"/);
assert.match(hostJs, /mountDesignCanvas/);
assert.match(hostJs, /html_tab_state/);
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
assert.match(hostJs, /shapesFromPawCanvas/);
assert.match(hostJs, /persistNow/);
assert.match(hostJs, /exportPng/);
assert.match(hostJs, /renderChrome/);
assert.doesNotMatch(hostJs, /documentFromArtifactText/);
assert.match(runtimeEntry, /opts\.shapes/);
assert.match(runtimeEntry, /createShape\(payload\)/);
assert.match(runtimeEntry, /toImage/);
assert.match(runtimeEntry, /exportPng/);
assert.match(runtimeEntry, /createAssets/);
assert.match(hostJs, /recordsFromPawCanvas/);
assert.match(hostJs, /saveArmed/);
assert.match(hostJs, /pawwork_html_preview_patch/);
assert.match(hostJs, /applyPatchFromStore/);
assert.doesNotMatch(hostJs, /location\.reload/);
assert.match(hostJs, /tldraw: \{ document \}/);
const previewJs = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');
assert.match(previewJs, /previewEntryForItem/);
assert.match(previewJs, /design\.html/);
assert.doesNotMatch(previewJs, /is-artboard/);
const backgroundJs = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
assert.match(backgroundJs, /previewEntryForItem/);
assert.match(backgroundJs, /wantDesign !== haveDesign/);
assert.match(backgroundJs, /site\.html/);
assert.match(hostJs, /previewEntryForItem/);

const designDoc = emptyPawCanvas({ shell: 'design', title: 'Board A' });
const slidesDoc = emptyPawCanvas({ shell: 'slides', title: 'Deck A' });
assert.equal(isPawCanvasDoc(designDoc), true);
assert.equal(canvasKindFromDoc(designDoc), 'poster');
assert.equal(canvasKindFromDoc(slidesDoc), 'deck');
assert.equal(classifyCanvasKind({ name: 'design.json' }, JSON.stringify(designDoc)), 'poster');
const fatCanvas = {
  ...designDoc,
  tldraw: {
    ...(designDoc.tldraw || {}),
    store: {
      ...((designDoc.tldraw && designDoc.tldraw.store) || {}),
      'asset:fat': { typeName: 'asset', type: 'image', props: { src: `data:image/jpeg;base64,${'A'.repeat(20000)}` } }
    }
  }
};
const fatBytes = new TextEncoder().encode(JSON.stringify(fatCanvas));
assert.ok(fatBytes.byteLength > 12000);
assert.equal(
  classifyCanvasKind({ name: 'design.json', mimeType: 'application/json' }, fatBytes),
  'poster',
  'inventory must classify a fat pawCanvas (embedded plate) without parsing the 12KB head'
);
assert.equal(
  classifyCanvasKind(
    { name: 'paw-intro-comic.html', mimeType: 'text/html' },
    '<html><body><h1>我是小爪 Paw</h1></body></html>'
  ),
  null
);
assert.equal(classifyCanvasKind({ name: 'slides.json' }, JSON.stringify(slidesDoc)), 'deck');
assert.equal(classifyOpenArtifact({ text: JSON.stringify(designDoc) }).kind, 'json-canvas');
assert.equal(previewEntryForKind('json-canvas'), 'design.html');
assert.equal(previewEntryForKind('xlsx'), 'sheet.html');
assert.equal(previewEntryForKind('docx'), 'docs.html');
assert.equal(previewEntryForItem({ text: JSON.stringify(designDoc) }).entry, 'design.html');
assert.equal(
  previewEntryForItem({
    text: '<html data-pawwork-preview="blocks" data-paw-kind="poster"><p data-paw-slot="t">x</p></html>'
  }).entry,
  'artifactPreview.html'
);
assert.equal(
  previewEntryForItem({
    text: '<html data-pawwork-preview="blocks" data-paw-kind="deck"><p data-paw-slot="t">x</p></html>'
  }).entry,
  'artifactPreview.html'
);
assert.equal(
  previewEntryForItem({
    name: 'book.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }).entry,
  'sheet.html'
);
assert.equal(
  previewEntryForItem({
    name: 'paw-intro-comic.html',
    mimeType: 'text/html',
    text: '<html><body><h1>我是小爪 Paw</h1><p>一起玩办公</p></body></html>'
  }).entry,
  'artifactPreview.html'
);
assert.equal(
  previewEntryForItem({
    text: '<html data-paw-kind="site"><body><h1>Home</h1></body></html>'
  }).entry,
  'site.html'
);
assert.equal(previewEntryForKind('html-plates'), 'artifactPreview.html');

const PAGE = `<html><body><h1>闪念贝壳</h1><img src="https://example.com/hero.png" alt="hero"><p>说明文字</p></body></html>`;
const compiled = createScene({ op: 'fromPage', html: PAGE, kind: 'poster', title: '闪念' });
assert.equal(compiled.ok, true, compiled.error);
assert.equal(isPawCanvasDoc(compiled.canvas), true);
assert.ok(listEngineNodes(compiled.canvas).some((n) => n.type === 'frame'));
assert.ok(listEngineNodes(compiled.canvas).some((n) => n.type === 'text' && /闪念/.test(n.text)));

const PAGE2 = `<html><body>
<h1>产品</h1><p>介绍A</p>
<h2>社交</h2><p>介绍B</p>
<h2>公司</h2><p>介绍C</p>
</body></html>`;
const compiled2 = createScene({ op: 'fromPage', html: PAGE2, kind: 'poster', title: '站' });
assert.equal(compiled2.ok, true, compiled2.error);
const nodes2 = listEngineNodes(compiled2.canvas);
const frames2 = nodes2.filter((n) => n.type === 'frame');
assert.ok(frames2.length >= 2, 'heading sections become nested frames, not one flat poster');
assert.ok(frames2.some((f) => /社交/.test(String(f.text || f.name || ''))));
assert.ok(listEngineNodes(compiled.canvas).some((n) => n.type === 'image'));
const fromHtmlFile = documentFromArtifactText(compiled.html, { kind: 'poster' });
assert.equal(isPawCanvasDoc(fromHtmlFile), true);
assert.ok(listEngineNodes(fromHtmlFile).some((n) => n.type === 'text'));

const nodes = listEngineNodes(compiled.canvas);
const payloads = shapesFromPawCanvas(compiled.canvas);
assert.equal(createPayloads(compiled.canvas).length, payloads.length);
assert.ok(payloads.some((p) => p.type === 'frame'));
assert.ok(payloads.some((p) => p.type === 'text'));
assert.ok(payloads.some((p) => p.type === 'image'));
const PIX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const withImg = createScene({
  op: 'createScene',
  kind: 'poster',
  nodes: [
    { id: 'headline', type: 'headline', text: 'Title' },
    { id: 'hero', type: 'image', src: PIX, box: { x: 40, y: 200, w: 800, h: 400 } }
  ]
});
assert.equal(withImg.ok, true, withImg.error);
const recs = recordsFromPawCanvas(withImg.canvas);
assert.ok(recs.assets.length >= 1, 'image node must emit a tldraw asset');
assert.ok(recs.assets.some((a) => String(a.props?.src || '').startsWith('data:image/')));
assert.ok(recs.shapes.some((s) => s.type === 'image' && s.props?.assetId));
const hydrated = await hydratePawCanvasImages(withImg.canvas, async (ref) => {
  if (String(ref).includes('screenshot1') || String(ref).includes('artifact:')) {
    return { ok: true, src: PIX };
  }
  return { ok: false, error: 'nope' };
});
const pending = compileSceneToPawCanvas({
  kind: 'poster',
  title: 'x',
  nodes: [{ id: 'devices', type: 'image', src: 'artifact://bound/screenshot1', box: { x: 0, y: 0, w: 100, h: 80 } }]
});
const afterHydrate = await hydratePawCanvasImages(pending, async (ref) => {
  assert.match(String(ref), /screenshot1|artifact:/);
  return { ok: true, src: PIX };
});
assert.ok(
  recordsFromPawCanvas(afterHydrate).assets.some((a) => String(a.props?.src || '').startsWith('data:image/')),
  'artifact:// screenshot refs must resolve to data URLs in assets'
);
assert.equal(isDisplayableImageSrc(PIX), true);
assert.equal(imageSrcNeedsHostPixels('artifact://bound/screenshot1'), true);
assert.equal(imageSrcNeedsHostPixels('截图1'), true);
assert.equal(imageSrcNeedsHostPixels('screenshot1'), true);
assert.equal(imageSrcNeedsHostPixels('/artifacts/cover.png'), true);
assert.equal(imageSrcNeedsHostPixels('blob:https://x/1'), true);
assert.equal(imageSrcNeedsHostPixels('https://example.com/a.png'), false);
assert.equal(normalizeImageSrc('//cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
assert.match(summarizeImageSrc(PIX), /data:image\/png;base64,…/);
assert.equal(unresolvedEngineImages(pending).length, 1);
assert.equal(unresolvedEngineImages(afterHydrate).length, 0);

const mediaPage = createScene({
  op: 'fromPage',
  kind: 'poster',
  html: `<html><body>
    <img srcset="https://example.com/a.jpg 1x, https://example.com/a2.jpg 2x" alt="set">
    <video poster="https://example.com/poster.png"></video>
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>
    <img alt="empty">
    <div style="background-image:url(https://example.com/bg.png)">hero</div>
  </body></html>`
});
assert.equal(mediaPage.ok, true, mediaPage.error);
const mediaNodes = listEngineNodes(mediaPage.canvas).filter((n) => n.type === 'image');
assert.ok(mediaNodes.some((n) => /example.com\/a\.jpg/.test(n.src)), 'srcset first url');
assert.ok(mediaNodes.some((n) => /poster\.png/.test(n.src)), 'video poster');
assert.ok(mediaNodes.some((n) => /^data:image\/svg\+xml/.test(n.src)), 'inline svg becomes data url');
assert.ok(mediaNodes.some((n) => /bg\.png/.test(n.src)), 'css background-image');
assert.equal(
  mediaNodes.filter((n) => !n.src).length,
  0,
  'empty img must not emit a blank image node'
);
for (const n of nodes) {
  const hit = payloads.find((p) => p.id === n.nodeId);
  assert.ok(hit, `hydrate payload missing nodeId ${n.nodeId}`);
  if (n.type === 'text') assert.match(JSON.stringify(hit.props || hit.meta || {}), new RegExp(n.text.slice(0, 8)));
  if (n.type === 'image') assert.ok(hit.props?.url || hit.meta?.src);
}
assert.equal(payloads[0].type, 'frame');

const fromSel = createScene({
  op: 'fromSelection',
  kind: 'poster',
  fragments: [{ html: '<h2>选区标题</h2>' }, { html: '<img src="https://example.com/shot.png" alt="s">' }]
});
assert.equal(fromSel.ok, true);
assert.ok(listEngineNodes(fromSel.canvas).some((n) => /选区标题/.test(n.text)));
assert.ok(listEngineNodes(fromSel.canvas).some((n) => n.type === 'image'));

async function withTools(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  return { store, runtime, tools, guest };
}

async function run() {
  const a = await withTools('s-engine-a');
  const created = await a.tools.run.execute({
    op: 'html',
    name: 'poster.html',
    commands: [{ op: 'createScene', source: 'page', html: PAGE, kind: 'poster', title: '闪念贝壳' }]
  });
  assert.equal(created.ok, true, created.error);
  const artifactId = created.artifact.artifactId;
  const raw = a.guest.readFile(created.artifact.primaryPath);
  assert.equal(isPawCanvasDoc(raw), true);
  const beforeBytes = String(raw);
  const nodes = listEngineNodes(raw);
  const textNode = nodes.find((n) => n.type === 'text' && n.text);
  assert.ok(textNode, 'compiled snapshot has editable text');
  assert.ok(nodes.some((n) => n.type === 'frame'));
  assert.ok(nodes.some((n) => n.type === 'image') || /png|jpg|http/i.test(JSON.stringify(raw)));

  const denied = await a.tools.deck.execute({
    act: 'write',
    artifactId,
    text: 'SHOULD NOT LAND'
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'NEED_SELECTION');
  const afterDeny = a.guest.readFile(created.artifact.primaryPath);
  assert.equal(afterDeny, beforeBytes);

  const wrote = await a.tools.deck.execute({
    act: 'write',
    artifactId,
    nodeId: textNode.nodeId,
    text: 'Hello Engine'
  });
  assert.equal(wrote.ok, true, wrote.error);
  const after = parsePawCanvas(a.guest.readFile(created.artifact.primaryPath));
  const nextNodes = listEngineNodes(after);
  const changed = nextNodes.find((n) => n.nodeId === textNode.nodeId);
  assert.equal(changed.text, 'Hello Engine');
  const others = nextNodes.filter((n) => n.nodeId !== textNode.nodeId && n.type === 'text');
  for (const o of others) {
    assert.notEqual(o.text, 'Hello Engine');
  }

  const png = exportPawCanvas(after, 'png');
  assert.equal(png.ok, false);
  assert.equal(png.code, 'NEED_TAB');
  const pdf = exportPawCanvas(after, 'pdf');
  assert.equal(pdf.ok, false);
  assert.equal(pdf.code, 'NEED_TAB');

  const slides = compileSceneToPawCanvas({
    kind: 'deck',
    title: 'Talk',
    frames: [
      { id: 's1', name: 'One', nodes: [{ id: 't1', type: 'text', text: 'P1' }], size: { w: 1920, h: 1080 } },
      { id: 's2', name: 'Two', nodes: [{ id: 't2', type: 'text', text: 'P2' }], size: { w: 1920, h: 1080 } }
    ]
  });
  const pptx = await exportPawCanvas(slides, 'pptx');
  assert.equal(pptx.ok, true, pptx.error);
  assert.ok(pptx.bytes.byteLength > 100);
  assert.equal(pptx.bytes[0], 0x50);
  assert.equal(pptx.bytes[1], 0x4b);
  const pptxText = Buffer.from(pptx.bytes).toString('utf8');
  assert.match(pptxText, /ppt\/slides\/slide1\.xml/);
  assert.match(pptxText, /ppt\/slides\/slide2\.xml/);

  const seen = await a.tools.deck.execute({ act: 'read', artifactId });
  assert.equal(seen.ok, true);
  assert.ok(Array.isArray(seen.frames) && seen.frames.length >= 1);
  assert.ok(Array.isArray(seen.ops) && seen.ops.includes('align'));
  const texts = (seen.nodes || []).filter((n) => n.type === 'text');
  if (texts.length >= 2) {
    const aligned = await a.tools.deck.execute({
      artifactId,
      align: 'left',
      nodeIds: [texts[0].nodeId, texts[1].nodeId]
    });
    assert.equal(aligned.ok, true, aligned.error);
    assert.ok(aligned.applied.includes('align'));
  }

  const exported = await a.tools.deck.execute({ act: 'export', format: 'pptx', artifactId });
  assert.equal(exported.ok, true, exported.error);
  assert.match(String(exported.filename || exported.artifactId || ''), /pptx|artifact/i);
  const pngExport = await a.tools.deck.execute({ act: 'export', format: 'png', artifactId });
  assert.equal(pngExport.ok, false);
  assert.equal(pngExport.code, 'NEED_TAB');

  const isolated = applyEngineCommands(JSON.parse(beforeBytes), [{ op: 'setSlotText', text: 'x' }], {
    selections: []
  });
  assert.equal(isolated.ok, false);
  assert.equal(isolated.code, 'NEED_SELECTION');

  const missingBound = await a.tools.run.execute({
    op: 'html',
    name: 'shot.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        nodes: [{ id: 'devices', type: 'image', src: 'artifact://bound/screenshot1', box: { x: 0, y: 0, w: 100, h: 80 } }]
      }
    ]
  });
  assert.equal(missingBound.ok, false, 'unresolved bound screenshot must not persist a blank image');
  assert.match(String(missingBound.error || ''), /screenshot1|pixels|image/i);

  const imgBoard = await a.tools.run.execute({
    op: 'html',
    name: 'hero.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        nodes: [
          { id: 'headline', type: 'headline', text: 'Hi' },
          { id: 'hero', type: 'image', src: PIX, box: { x: 0, y: 80, w: 200, h: 100 } }
        ]
      }
    ]
  });
  assert.equal(imgBoard.ok, true, imgBoard.error);
  const imgId = imgBoard.artifact.artifactId;
  const refusedSrc = await a.tools.deck.execute({
    act: 'write',
    artifactId: imgId,
    nodeId: 'shape:hero',
    src: 'artifact://bound/screenshot1'
  });
  assert.equal(refusedSrc.ok, false, 'deck setSlotSrc must not write unresolved artifact:// onto the engine');
  const still = parsePawCanvas(a.guest.readFile(imgBoard.artifact.primaryPath));
  const hero = listEngineNodes(still).find((n) => n.nodeId === 'shape:hero');
  assert.ok(String(hero?.src || '').startsWith('data:image/'), 'previous pixels must stay');

  console.log('test_engine_canvas_a: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
