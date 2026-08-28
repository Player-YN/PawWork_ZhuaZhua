/**
 * Playbook vs host — documented skill shapes must reach the right door
 * and honor path / src / item / handle / artifactId aliases.
 */
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { inventoryFromSession } from '../../../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { listEngineNodes, isPawCanvasDoc } from '../../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { encodePngRgba } from '../../../src/agent/vnext/sessionWorkspace/rasterScan.js';
import { resolveOfficeAsset } from '../../../src/agent/vnext/sessionWorkspace/sheetImageHydrate.js';
import { classifyOpenArtifact } from '../../../src/agent/vnext/sessionWorkspace/openClassify.js';
import { loadSkillInstructions } from '../../../src/agent/vnext/skills/registry.js';
import { buildSessionAgentInstructions } from '../../../src/agent/vnext/sessionWorkspace/prompt.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function colorBlockPng() {
  const w = 32;
  const h = 24;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 225;
    data[i + 1] = 29;
    data[i + 2] = 72;
    data[i + 3] = 255;
  }
  const dataUrl = encodePngRgba({ width: w, height: h, data });
  const b64 = String(dataUrl).split(',')[1] || '';
  return Buffer.from(b64, 'base64');
}

function setup(id) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: id });
  const execution = beginExecution(store, id, {});
  const fs = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  fs.mkdirp('/scratch/sources');
  const tools = createSessionTools({ store, execution, fs, sessionId: id });
  return { store, runtime, fs, tools, sessionId: id };
}

{
  const deck = loadSkillInstructions('slides') || '';
  const poster = loadSkillInstructions('poster') || '';
  const briefing = loadSkillInstructions('briefing-deck') || '';
  const system = buildSessionAgentInstructions({ sessionId: 's-playbook-prompt' });
  const fences = [...deck.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  const outline = fences.find((ex) => ex.op === 'createScene');
  const replace = fences.find((ex) => ex.op === 'replacePlate');
  const outlineJson = JSON.stringify(outline || {});
  record('skill-deck-semantic-happy-path', /createScene/.test(deck) && /themeId/.test(deck) && /replacePlate/.test(deck));
  record(
    'skill-deck-example-one-artifact-many-frames',
    !!outline && outline.kind === 'deck' && Array.isArray(outline.frames) && outline.frames.length >= 2 && !outlineJson.includes('"box"'),
    outline ? `frames=${outline.frames.length}` : 'missing createScene example'
  );
  record(
    'skill-deck-example-no-model-box',
    !!outline && outline.frames.every((fr) => fr.layoutId && fr.slots && !fr.nodes && !fr.box) && !outlineJson.includes('"x":'),
    outlineJson.slice(0, 80)
  );
  record(
    'skill-replacePlate-semantic',
    !!replace && !!(replace.plateId || replace.frameId) && !!replace.layoutId && !!replace.slots && !('box' in replace)
  );
  record('skill-exact-theme-ids', /hanbai/.test(deck) && /ink-rose/.test(deck) && /midnight-cyan/.test(deck) && /forest/.test(deck) && /studio-amber/.test(deck) && /editorial/.test(deck) && /cobalt/.test(deck) && /mono/.test(deck));
  record('skill-exact-slide-layouts', /title-visual/.test(deck) && /case-study/.test(deck) && /closing/.test(deck));
  record('skill-exact-poster-layouts', /poster-hero/.test(poster) && /comic-panel/.test(poster) && /poster-editorial/.test(poster));
  record('skill-poster-tldraw-not-html', /tldraw/.test(poster) && /Paw Work Design/.test(poster) && !/Four rounds|four rounds/.test(poster));
  record('skill-briefing-same-semantic-flow', /slides/.test(briefing) && /3–7|3-7/.test(briefing) && /notes/.test(briefing));
  record(
    'skill-visual-callable-catalogs',
    /catalog="icons"/.test(deck) && /catalog="image-brief"/.test(deck) && /catalog="image-brief"/.test(poster) && !/buildGeneratedImageBrief/.test(deck)
  );
  record(
    'skill-chart-honesty',
    (/Never invent statistics|Never fabricate chart data/.test(deck)) &&
      /Never invent statistics/.test(briefing) &&
      /never invent statistics/.test(poster)
  );
  record(
    'skill-compose-not-a-deck',
    /slides/.test(loadSkillInstructions('compose-image') || '') && !/frames:\s*\[\{\s*id/.test(loadSkillInstructions('compose-image') || '')
  );
  record(
    'prompt-semantic-invariants',
    /themeId/.test(system) && /layoutId/.test(system) && /CANVAS_QA_FAILED/.test(system) && /one visual artifact/.test(system)
  );
}

const PAGE = `<!DOCTYPE html>
<html lang="zh-CN"><body>
  <h1>闪念贝壳</h1>
  <img src="https://example.com/hero.png" alt="hero">
  <a href="/watch">观看视频</a>
</body></html>`;

const SITE = `<!DOCTYPE html>
<html data-paw-kind="site">
<body><h1>Welcome</h1><img src="old.png" alt="hero" /></body>
</html>`;

const DOC = `<!DOCTYPE html>
<html data-paw-kind="document"><body><p>Long report</p></body></html>`;

{
  const { store, runtime, fs, tools, sessionId } = setup('s-playbook-skeleton');
  const plate = createArtifact(store, fs, {
    sessionId,
    name: 'compose_plate.png',
    content: PNG_1X1,
    mimeType: 'image/png'
  });
  record(
    'acquire-image-shape-returns-artifact-path',
    /^\/artifacts\/.+\.png$/i.test(plate.primaryPath) && !!plate.artifactId,
    plate.primaryPath
  );

  const g = runtime.createGroup({ name: 'caps', sessionId });
  const shot = runtime.addWebItem(g.groupId, {
    src: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
    kindHint: 'screenshot'
  });
  runtime.bindGroups(sessionId, [g.groupId]);
  const inspected = await tools.inspect.execute({ view: 'item', item: '截图1', includeMedia: false });
  record(
    'inspect-view-item-handle-alias',
    inspected.ok === true && inspected.item?.webItemId === shot.webItemId,
    inspected.error || inspected.item?.handle || ''
  );

  const created = await tools.run.execute({
    op: 'createScene',
    kind: 'poster',
    title: '海报',
    nodes: [
      { id: 'bg', type: 'geo', fill: '#111827', box: { x: 0, y: 0, w: 960, h: 1440 } },
      { id: 'plate', type: 'image', path: plate.primaryPath, box: { x: 40, y: 80, w: 880, h: 520 } },
      { id: 'headline', type: 'headline', text: '标题', box: { x: 40, y: 620, w: 880, h: 72 } }
    ]
  });
  record(
    'createScene-top-level-path-no-op-html',
    created.ok === true && created.op === 'html' && !!created.artifact?.artifactId,
    created.error || created.op
  );
  const inv = inventoryFromSession(store, sessionId, fs);
  record('inventory-lists-poster', inv.poster.includes(created.artifact?.artifactId), JSON.stringify(inv));

  const deckRead = await tools.deck.execute({ act: 'read' });
  record(
    'deck-sees-poster-canvas',
    deckRead.ok === true && Array.isArray(deckRead.available) && deckRead.available.length > 0,
    deckRead.error || deckRead.code || ''
  );

  const nodes = listEngineNodes(fs.readFile(created.artifact.primaryPath));
  const imgNode = nodes.find((n) => n.type === 'image');
  record('createScene-image-node-from-path', !!imgNode, imgNode ? imgNode.nodeId : 'none');

  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: {
      artifactId: created.artifact.artifactId,
      selections: [{ nodeId: imgNode?.nodeId }]
    }
  });
  const srcd = await tools.deck.execute({
    act: 'write',
    op: 'setSlotSrc',
    path: plate.primaryPath
  });
  record(
    'deck-setSlotSrc-path-resolves',
    srcd.ok === true && !/unresolved|not found|NO_CANVAS/i.test(String(srcd.error || '')),
    srcd.error || srcd.dirty || ''
  );

  const resolved = await resolveOfficeAsset(store, sessionId, plate.primaryPath, { fs });
  record(
    'setSlotSrc-path-would-resolve',
    resolved.ok === true && /^data:image\//i.test(resolved.src || ''),
    resolved.error || ''
  );

  const viaAid = await tools.run.execute({
    op: 'fromRaster',
    kind: 'poster',
    artifactId: plate.artifactId,
    title: 'from-aid',
    nodes: [{ id: 't', type: 'text', text: 'Hi', box: { x: 0, y: 0, w: 80, h: 24 } }]
  });
  record(
    'fromRaster-image-artifactId-not-canvas-target',
    viaAid.ok === true && viaAid.op === 'html' && viaAid.op !== 'sheet',
    viaAid.error || viaAid.code || viaAid.op
  );
}

{
  const { store, fs, tools, sessionId } = setup('s-playbook-raster');
  const flatten = createArtifact(store, fs, {
    sessionId,
    name: 'flatten.png',
    content: colorBlockPng(),
    mimeType: 'image/png'
  });
  const compiled = await tools.run.execute({
    op: 'fromRaster',
    scan: 'auto',
    kind: 'poster',
    path: flatten.primaryPath,
    title: '还原',
    nodes: [{ id: 'headline', type: 'headline', text: 'CTA', box: { x: 4, y: 2, w: 24, h: 6 } }]
  });
  record(
    'fromRaster-top-level-path-scan-auto',
    compiled.ok === true && compiled.op === 'html',
    compiled.error || compiled.op
  );
  const inv = inventoryFromSession(store, sessionId, fs);
  record(
    'fromRaster-inventory-poster',
    compiled.ok && inv.poster.includes(compiled.artifact?.artifactId),
    JSON.stringify(inv)
  );
  const raw = compiled.ok ? fs.readFile(compiled.artifact.primaryPath) : '';
  record('fromRaster-persists-pawCanvas', compiled.ok && isPawCanvasDoc(raw), '');

  const asCommands = await tools.run.execute({
    commands: [
      {
        op: 'fromRaster',
        scan: false,
        kind: 'deck',
        src: flatten.primaryPath,
        title: 'slides',
        size: { w: 1920, h: 1080 },
        nodes: [
          { id: 'bg', type: 'geo', fill: '#111111', box: { x: 0, y: 0, w: 1920, h: 1080 } },
          { id: 't', type: 'text', text: 'Title', box: { x: 80, y: 80, w: 800, h: 80 } }
        ]
      }
    ]
  });
  record(
    'fromRaster-commands-without-op-html-kind-deck',
    asCommands.ok === true && asCommands.op === 'html' && asCommands.kind === 'deck',
    asCommands.error || `${asCommands.op}/${asCommands.kind}`
  );
  const inv2 = inventoryFromSession(store, sessionId, fs);
  record('fromRaster-deck-inventory', inv2.deck.includes(asCommands.artifact?.artifactId), JSON.stringify(inv2));
}

{
  const { store, fs, tools, sessionId } = setup('s-playbook-frompage');
  fs.writeFile('/scratch/sources/page.html', PAGE, { mimeType: 'text/html' });
  const fromPath = await tools.run.execute({
    op: 'fromPage',
    kind: 'poster',
    path: '/scratch/sources/page.html',
    title: '这页'
  });
  record(
    'fromPage-path-from-acquire-fetch',
    fromPath.ok === true && fromPath.op === 'html',
    fromPath.error || fromPath.op
  );
  const raw = fromPath.ok ? fs.readFile(fromPath.artifact.primaryPath) : '';
  const nodes = fromPath.ok ? listEngineNodes(raw) : [];
  record(
    'fromPage-extracted-leaves',
    nodes.some((n) => /闪念贝壳/.test(n.text || '')) && nodes.some((n) => /hero\.png/.test(n.src || '')),
    nodes.map((n) => n.text || n.src).join('|').slice(0, 120)
  );

  const nested = await tools.run.execute({
    fromPage: { html: PAGE, kind: 'deck', title: 'Brief' }
  });
  record(
    'fromPage-nested-object-no-op',
    nested.ok === false && nested.code === 'CANVAS_QA_FAILED' && nested.op === 'html',
    nested.error || nested.code || nested.op
  );
}

{
  const { store, runtime, fs, tools, sessionId } = setup('s-playbook-fromsel');
  const g = runtime.createGroup({ name: 'sel', sessionId });
  runtime.addWebItem(g.groupId, {
    src: 'https://cdn.example/shot.png',
    kindHint: 'image'
  });
  runtime.bindGroups(sessionId, [g.groupId]);
  const sel = await tools.run.execute({
    op: 'fromSelection',
    kind: 'poster',
    item: '图片1'
  });
  record(
    'fromSelection-item-handle',
    sel.ok === true && sel.op === 'html',
    sel.error || sel.op
  );
  const nodes = sel.ok ? listEngineNodes(fs.readFile(sel.artifact.primaryPath)) : [];
  record(
    'fromSelection-handle-became-image-node',
    nodes.some((n) => n.type === 'image' && /shot\.png/.test(n.src || '')),
    nodes.map((n) => `${n.type}:${n.src || n.text}`).join('|').slice(0, 160)
  );
}

{
  const { store, fs, tools, sessionId } = setup('s-playbook-sheet');
  const top = await tools.run.execute({
    op: 'createWorkbook',
    name: 'listing.csv',
    sheets: [{ name: 'Sheet1', rows: [['主图', '标题', '价格', '来源', '链接']] }]
  });
  record(
    'createWorkbook-top-level-op',
    top.ok === true && top.op === 'sheet' && !!top.artifact?.artifactId,
    top.error || top.op
  );
  const inv = inventoryFromSession(store, sessionId, fs);
  record('inventory-lists-sheet', inv.sheet.includes(top.artifact?.artifactId), JSON.stringify(inv));

  const viaFields = await tools.run.execute({
    op: 'sheet',
    name: 'second.csv',
    sheets: [{ name: 'Sheet1', rows: [['A']] }]
  });
  record(
    'sheet-createWorkbook-from-top-level-sheets',
    viaFields.ok === true && viaFields.op === 'sheet',
    viaFields.error || viaFields.op
  );

  const wrote = await tools.sheet.execute({
    act: 'write',
    artifactId: top.artifact.artifactId,
    commands: [{ command: 'setRange', a1: 'B1', value: '标题列' }]
  });
  record(
    'sheet-command-alias',
    wrote.ok === true && String(wrote.readback?.values?.[0]?.[0] || wrote.readback?.value || '').includes('标题'),
    wrote.error || JSON.stringify(wrote.readback || {})
  );
}

{
  const { store, fs, tools, sessionId } = setup('s-playbook-site-doc');
  const site = await tools.run.execute({
    op: 'write_artifact',
    name: 'home.html',
    mimeType: 'text/html',
    content: SITE
  });
  record('site-write-artifact', site.ok === true, site.error || site.code || '');
  const inv = inventoryFromSession(store, sessionId, fs);
  record('inventory-lists-web', inv.web.includes(site.artifact?.artifactId), JSON.stringify(inv));

  const plate = createArtifact(store, fs, {
    sessionId,
    name: 'hero.png',
    content: PNG_1X1,
    mimeType: 'image/png'
  });
  const read = await tools.web.execute({ act: 'read' });
  const img = (read.nodes || []).find((n) => n.tag === 'img');
  const setSrc = await tools.web.execute({
    act: 'write',
    nodeId: img?.nodeId,
    path: plate.primaryPath
  });
  record(
    'web-setSrc-path-alias',
    setSrc.ok === true && !setSrc.code,
    setSrc.error || setSrc.code || ''
  );

  const doc = await tools.run.execute({
    op: 'write_artifact',
    name: 'report.html',
    mimeType: 'text/html',
    content: DOC
  });
  record('document-write-artifact', doc.ok === true, doc.error || doc.code || '');
  record(
    'open-classify-document-kind',
    classifyOpenArtifact({ text: DOC }).kind === 'html-document' &&
      classifyOpenArtifact({ text: DOC }).canvas === 'docs',
    JSON.stringify(classifyOpenArtifact({ text: DOC }))
  );
  const inv2 = inventoryFromSession(store, sessionId, fs);
  record(
    'inventory-lists-document',
    inv2.doc.includes(doc.artifact?.artifactId),
    JSON.stringify(inv2)
  );
  const docRead = await tools.doc.execute({ act: 'read', artifactId: doc.artifact.artifactId });
  record(
    'doc-tool-sees-write-artifact-document',
    docRead.ok === true && docRead.code !== 'NO_CANVAS',
    docRead.error || docRead.code || ''
  );
}

{
  const { tools } = setup('s-playbook-wrong-door');
  const miss = await tools.deck.execute({ act: 'read' });
  record(
    'deck-no-canvas-is-NO_CANVAS-not-sheet',
    miss.ok === false && miss.code === 'NO_CANVAS',
    miss.code || miss.error || ''
  );
  const emptyRaster = await tools.run.execute({
    commands: [{ op: 'fromRaster', path: '/artifacts/missing/missing.png' }]
  });
  record(
    'fromRaster-missing-not-sheet-door',
    emptyRaster.op !== 'sheet' && !/unknown op|sheet requires/i.test(String(emptyRaster.error || '')),
    `${emptyRaster.op}: ${emptyRaster.error || ''}`
  );
}

console.log(`\nwave_canvas_playbook: failed=${failed}`);
if (failed > 0) process.exit(1);
console.log('wave_canvas_playbook: ok');
