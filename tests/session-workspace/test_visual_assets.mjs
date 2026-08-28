import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { emptyPawCanvas, isPawCanvasDoc, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { compileLayoutFrame, nodesWithinPaper } from '../../src/agent/vnext/sessionWorkspace/layoutCompile.js';
import { getLayout, SLIDE_LAYOUT_IDS, POSTER_LAYOUT_IDS } from '../../src/agent/vnext/sessionWorkspace/layoutCatalog.js';
import { CANVAS_ICON_IDS, CANVAS_ICONS } from '../../src/agent/vnext/sessionWorkspace/canvasIconPack.js';
import { compactIconCatalog, resolveIconName, searchIcons } from '../../src/agent/vnext/sessionWorkspace/iconCatalog.js';
import { compileMotif, MOTIF_IDS } from '../../src/agent/vnext/sessionWorkspace/canvasMotifs.js';
import { compileChart, parseChartSeries } from '../../src/agent/vnext/sessionWorkspace/canvasCharts.js';
import {
  compactVisualCatalog,
  compileVisual,
  parseVisual,
  readVisualCatalog
} from '../../src/agent/vnext/sessionWorkspace/visualAssets.js';
import { buildGeneratedImageBrief } from '../../src/agent/vnext/sessionWorkspace/imageBrief.js';
import { compactPresetCatalog } from '../../src/agent/vnext/sessionWorkspace/canvasPresets.js';
import { gateCompiledScene } from '../../src/agent/vnext/sessionWorkspace/canvasQaGate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACK_BEFORE_BYTES = 38 * 1024;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fsGuest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fsGuest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: fsGuest, sessionId });
  return { store, runtime, fs: fsGuest, tools, sessionId };
}

function seedBlankSlides(store, fsGuest, sessionId) {
  const rec = createArtifact(store, fsGuest, {
    sessionId,
    name: 'slides.json',
    content: JSON.stringify(emptyPawCanvas({ shell: 'slides', title: 'Slides' })),
    mimeType: 'application/json'
  });
  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: { artifactId: rec.artifactId, selections: [{ nodeId: 'shape:frame' }] }
  });
  return rec;
}

async function run() {
  assert.ok(CANVAS_ICON_IDS.length >= 1500, `icon pack too small: ${CANVAS_ICON_IDS.length}`);
  const packPath = new URL('../../src/agent/vnext/sessionWorkspace/canvasIconPack.js', import.meta.url);
  const packSrc = fs.readFileSync(packPath, 'utf8');
  const packBytes = fs.statSync(packPath).size;
  assert.match(packSrc, /ISC license/);
  assert.match(packSrc, /lucide-static/);
  assert.match(packSrc, /CANVAS_ICON_PACK_MODE = "full"/);
  assert.ok(packBytes < 2.5 * 1024 * 1024, `icon pack too large: ${packBytes}`);
  assert.ok(packBytes > PACK_BEFORE_BYTES, `expected pack to grow from ~52 icons (${packBytes} vs ${PACK_BEFORE_BYTES})`);
  for (const id of CANVAS_ICON_IDS) {
    assert.match(CANVAS_ICONS[id], /^<svg/);
    assert.doesNotMatch(CANVAS_ICONS[id], /(href|src)\s*=\s*["']https?:|url\(\s*["']?https?:/i);
  }

  const team = searchIcons('协作 团队', { limit: 8 });
  assert.ok(team.length >= 1 && team.length <= 8);
  assert.ok(
    team.some((h) => h.id === 'users' || h.id === 'users-round' || h.id === 'handshake'),
    `expected team/collab icons, got ${team.map((h) => h.id).join(',')}`
  );
  assert.ok(team[0].score >= team[team.length - 1].score);
  const again = searchIcons('协作 团队', { limit: 8 });
  assert.deepEqual(again.map((h) => h.id), team.map((h) => h.id));

  const finance = searchIcons('finance', { limit: 8 });
  assert.ok(finance.length >= 1 && finance.length <= 8);
  assert.ok(
    finance.some((h) =>
      ['wallet', 'banknote', 'coins', 'circle-dollar-sign', 'badge-dollar-sign', 'hand-coins', 'piggy-bank'].includes(h.id)
    ),
    `expected finance icons, got ${finance.map((h) => h.id).join(',')}`
  );
  const education = searchIcons('education', { limit: 8 });
  assert.ok(education.length >= 1 && education.length <= 8);
  assert.ok(
    education.some((h) =>
      ['graduation-cap', 'school', 'university', 'book-open', 'library', 'library-big', 'book', 'backpack'].includes(h.id)
    ),
    `expected education icons, got ${education.map((h) => h.id).join(',')}`
  );
  const food = searchIcons('food', { limit: 8 });
  assert.ok(food.length >= 1 && food.length <= 8);
  assert.ok(
    food.some((h) => ['utensils', 'pizza', 'apple', 'coffee', 'cooking-pot', 'soup'].includes(h.id)),
    `expected food icons, got ${food.map((h) => h.id).join(',')}`
  );
  assert.deepEqual(
    searchIcons('finance', { limit: 8 }).map((h) => h.id),
    finance.map((h) => h.id)
  );

  const unknown = resolveIconName('zzzz-not-an-icon-qqq');
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /suggestions:/);
  assert.ok(unknown.suggestions?.length >= 1);

  const compactIcons = compactIconCatalog();
  assert.ok(compactIcons.count >= 1500);
  assert.ok(compactIcons.common.length <= 24);
  assert.ok(!Object.prototype.hasOwnProperty.call(compactIcons, 'icons'));
  const dump = readVisualCatalog({ catalog: 'icons' });
  assert.equal(dump.ok, true);
  assert.equal(dump.icons, undefined);
  assert.ok(dump.common.length <= 24);
  const searched = readVisualCatalog({ catalog: 'icons', query: '协作 团队', limit: 8 });
  assert.equal(searched.ok, true);
  assert.ok(searched.icons.length <= 8);
  assert.ok(searched.icons.length >= 1);

  const visuals = compactVisualCatalog();
  assert.ok(visuals.motifs.length >= 12);
  for (const id of MOTIF_IDS) assert.ok(visuals.motifs.includes(id), id);
  assert.deepEqual(visuals.charts, ['bar', 'line', 'donut']);
  assert.equal(visuals.generated.catalog, 'image-brief');
  assert.equal(visuals.generated.helper, undefined);
  assert.deepEqual(visuals.generated.args, ['layoutId', 'themeId', 'subject']);
  const presets = compactPresetCatalog();
  assert.ok(presets.icons.count >= 1500);
  assert.ok(presets.icons.common.length <= 24);

  const box = { x: 100, y: 80, w: 600, h: 480 };
  for (const id of MOTIF_IDS) {
    const a = compileMotif({ id, box, theme: { id: 'editorial', font: 'serif', ink: '#161616' }, slotName: 'visual', nodeId: `m-${id}` });
    const b = compileMotif({ id, box, theme: { id: 'editorial', font: 'serif', ink: '#161616' }, slotName: 'visual', nodeId: `m-${id}` });
    assert.equal(a.ok, true, `${id}: ${a.error}`);
    assert.deepEqual(
      a.nodes.map((n) => ({ id: n.id, type: n.type, box: n.box, text: n.text })),
      b.nodes.map((n) => ({ id: n.id, type: n.type, box: n.box, text: n.text })),
      `${id} must be deterministic`
    );
    for (const n of a.nodes) {
      assert.ok(n.box.x >= box.x - 0.5, `${id} ${n.id} x`);
      assert.ok(n.box.y >= box.y - 0.5, `${id} ${n.id} y`);
      assert.ok(n.box.x + n.box.w <= box.x + box.w + 1, `${id} ${n.id} right ${n.box.x + n.box.w}`);
      assert.ok(n.box.y + n.box.h <= box.y + box.h + 1, `${id} ${n.id} bottom ${n.box.y + n.box.h}`);
      if (n.src) {
        assert.match(String(n.src), /^(data:image\/svg\+xml)/);
        assert.doesNotMatch(String(n.src), /^https?:/);
      }
      assert.equal(n.meta?.pawAssetKind === 'motif' || n.meta?.pawAssetKind === 'icon', true, `${id} provenance`);
    }
    const framed = compileLayoutFrame(
      { id: id, layoutId: 'title-visual', variant: 'paper', slots: { title: '母题', visual: { kind: 'motif', id } } },
      { themeId: 'editorial' }
    );
    assert.equal(framed.ok, true, `${id} layout: ${framed.error}`);
    assert.equal(nodesWithinPaper(framed.frame.nodes, getLayout('title-visual').paper), true, `${id} paper`);
    const gated = gateCompiledScene(
      { ok: true, source: 'layout', kind: 'deck', themeId: 'editorial', frames: [framed.frame], nodes: framed.frame.nodes, size: framed.frame.size },
      { kind: 'deck', source: 'layout' }
    );
    assert.equal(gated.ok, true, `${id} QA: ${gated.error || JSON.stringify(gated.qa?.issues)}`);
    assert.ok(gated.qa.score >= 90, `${id} score ${gated.qa.score}`);
  }

  const bar = compileChart({
    type: 'bar',
    data: [12, 19, 7],
    labels: ['A', 'B', 'C'],
    box: { x: 0, y: 0, w: 640, h: 400 },
    theme: { font: 'sans' },
    nodeId: 'c-bar'
  });
  assert.equal(bar.ok, true, bar.error);
  assert.ok(bar.nodes.some((n) => n.type === 'geo' && n.meta?.pawAssetKind === 'chart'));
  assert.ok(bar.nodes.filter((n) => n.type === 'text').length >= 6);
  const bar2 = compileChart({
    type: 'bar',
    data: [12, 19, 7],
    labels: ['A', 'B', 'C'],
    box: { x: 0, y: 0, w: 640, h: 400 },
    theme: { font: 'sans' },
    nodeId: 'c-bar'
  });
  assert.deepEqual(bar.nodes.map((n) => n.box), bar2.nodes.map((n) => n.box));

  const line = compileChart({ type: 'line', data: [3, 5, 4, 8], labels: ['a', 'b', 'c', 'd'], box: { x: 10, y: 10, w: 500, h: 300 }, nodeId: 'c-line' });
  assert.equal(line.ok, true, line.error);
  const donut = compileChart({ type: 'donut', data: [40, 35, 25], labels: ['A', 'B', 'C'], box: { x: 0, y: 0, w: 480, h: 400 }, nodeId: 'c-donut' });
  assert.equal(donut.ok, true, donut.error);
  assert.ok(donut.nodes.every((n) => n.type !== 'image' || /^data:image\/svg/.test(n.src || '')));

  assert.equal(parseChartSeries([], []).ok, false);
  assert.match(compileChart({ type: 'bar', data: [1, Number.NaN], box: { x: 0, y: 0, w: 200, h: 200 } }).error, /finite/);
  assert.match(compileChart({ type: 'bar', data: [1, 2], labels: ['a'], box: { x: 0, y: 0, w: 200, h: 200 } }).error, /labels length/);
  assert.match(compileChart({ type: 'donut', data: [-1, 2], box: { x: 0, y: 0, w: 200, h: 200 } }).error, /negative/);
  assert.match(compileChart({ type: 'bar', data: [0, 0], box: { x: 0, y: 0, w: 200, h: 200 } }).error, /zeros/);
  assert.match(compileChart({ type: 'blob', data: [1], box: { x: 0, y: 0, w: 200, h: 200 } }).error, /unknown chart type/);

  const img = parseVisual({ kind: 'image', path: '/artifacts/hero.png', fit: 'cover', alt: '工作区截图' });
  assert.equal(img.ok, true, img.error);
  const imgNodes = compileVisual({
    raw: { kind: 'image', path: '/artifacts/hero.png', artifactId: 'art_hero', fit: 'contain', alt: '工作区截图' },
    box: { x: 20, y: 20, w: 200, h: 160 },
    slotName: 'visual',
    nodeId: 'vis'
  });
  assert.equal(imgNodes.ok, true);
  assert.equal(imgNodes.nodes[0].src, '/artifacts/hero.png');
  assert.equal(imgNodes.nodes[0].meta.pawAssetKind, 'workspace');
  assert.equal(imgNodes.nodes[0].meta.pawAssetPath, '/artifacts/hero.png');
  assert.equal(imgNodes.nodes[0].meta.pawAssetArtifactId, 'art_hero');
  assert.equal(imgNodes.nodes[0].meta.pawAlt, '工作区截图');
  assert.doesNotMatch(imgNodes.nodes[0].src, /^https?:/);
  const remote = parseVisual({ kind: 'image', url: 'https://example.com/x.png' });
  assert.equal(remote.ok, false);
  assert.match(remote.error, /durable truth/);

  const brief = buildGeneratedImageBrief({
    layoutId: 'title-visual',
    themeId: 'editorial',
    subject: 'quiet product still life'
  });
  assert.ok(brief.aspectRatio);
  assert.ok(brief.width >= 720);
  assert.equal(brief.noText, true);
  assert.equal(brief.noWatermark, true);
  assert.match(brief.prompt, /no text|不要出现任何文字/i);
  assert.match(brief.prompt, /watermark/i);
  assert.equal(brief.acquire.action, 'image');
  assert.equal(brief.acquire.aspect_ratio, brief.aspectRatio);
  assert.equal(brief.palette.accent.length > 0, true);
  assert.ok(!brief.fetch && !brief.url);

  const briefCat = readVisualCatalog({
    catalog: 'image-brief',
    layoutId: 'title-visual',
    themeId: 'editorial',
    subject: 'quiet product still life'
  });
  assert.equal(briefCat.ok, true, briefCat.error);
  assert.equal(briefCat.catalog, 'image-brief');
  assert.equal(briefCat.aspectRatio, brief.aspectRatio);
  assert.equal(briefCat.width, brief.width);
  assert.equal(briefCat.height, brief.height);
  assert.equal(briefCat.noText, true);
  assert.equal(briefCat.noWatermark, true);
  assert.match(briefCat.prompt, /no text|不要出现任何文字/i);
  assert.match(briefCat.prompt, /watermark/i);
  assert.equal(briefCat.acquire.action, 'image');
  assert.equal(briefCat.acquire.aspect_ratio, briefCat.aspectRatio);
  assert.equal(briefCat.acquire.prompt, briefCat.prompt);
  assert.ok(!briefCat.fetch && !briefCat.url && !briefCat.apiKey && !briefCat.helper);
  assert.equal(briefCat.buildGeneratedImageBrief, undefined);
  const unknownCat = readVisualCatalog({ catalog: 'not-a-catalog' });
  assert.equal(unknownCat.ok, false);
  assert.match(unknownCat.error, /image-brief/);

  const iconVis = compileLayoutFrame(
    { id: 's1', layoutId: 'title-visual', variant: 'paper', slots: { title: '图标', visual: { kind: 'icon', query: '协作 团队' } } },
    { themeId: 'editorial' }
  );
  assert.equal(iconVis.ok, true, iconVis.error);
  assert.ok(iconVis.frame.nodes.some((n) => n.meta?.pawAssetKind === 'icon' && n.meta?.pawIconId));

  assert.equal(SLIDE_LAYOUT_IDS.length, 16);
  assert.equal(POSTER_LAYOUT_IDS.length, 8);
  const visualLayouts = {
    'title-visual': { title: 'T', visual: { kind: 'icon', name: 'paw-print' } },
    'image-caption': { visual: { kind: 'icon', name: 'paw-print' }, caption: 'c' },
    'case-study': { title: '案例', context: '选区', action: '编译', result: '交付', visual: { kind: 'motif', id: 'metric-ring' } },
    'points-icons': { title: '点', items: [{ title: '一', icon: 'check' }] },
    'poster-hero': { title: '海', visual: { kind: 'icon', name: 'star' } },
    'poster-split': { title: '海', visual: { kind: 'chart', type: 'bar', data: [2, 4, 3], labels: ['a', 'b', 'c'] } },
    'poster-event': { title: '日', date: '8 月', visual: { kind: 'icon', name: 'calendar' } },
    'poster-product': { title: '品', visual: { kind: 'motif', id: 'device-frame' } },
    'poster-editorial': { title: '辑', visual: { kind: 'icon', name: 'book-open' } },
    'comic-panel': { panels: [{ caption: 'A', visual: { kind: 'icon', name: 'star' } }] }
  };
  for (const [layoutId, slots] of Object.entries(visualLayouts)) {
    const compiled = compileLayoutFrame({ id: layoutId, layoutId, slots }, { themeId: 'editorial' });
    assert.equal(compiled.ok, true, `${layoutId}: ${compiled.error}`);
    assert.equal(JSON.stringify(slots).includes('"x":'), false);
  }

  const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/visual/semantic-7-visual.json'), 'utf8'));
  assert.equal(fixture.frames.length, 7);
  const kinds = new Set();
  for (const fr of fixture.frames) {
    const vis = fr.slots?.visual;
    if (vis?.kind) kinds.add(vis.kind);
    assert.equal(JSON.stringify(fr.slots || {}).includes('"x":'), false);
  }
  assert.ok(kinds.has('icon') && kinds.has('motif') && kinds.has('chart') && kinds.has('image'));

  {
    const { store, runtime, fs: fsGuest, tools, sessionId } = setup('s-visual-7');
    const blank = seedBlankSlides(store, fsGuest, sessionId);
    createArtifact(store, fsGuest, {
      sessionId,
      name: 'hero.png',
      content: PNG_1X1,
      mimeType: 'image/png'
    });
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      artifactId: blank.artifactId,
      ...fixture
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(compiled.artifactId, blank.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).filter((a) => /\.json$/i.test(a.name)).length, 1);
    assert.ok(runtime.listArtifacts(sessionId).length >= before);
    const raw = fsGuest.readFile(blank.primaryPath);
    assert.equal(isPawCanvasDoc(raw), true);
    const nodes = listEngineNodes(raw);
    assert.equal(nodes.filter((n) => n.type === 'frame').length, 7);
    const scene = createScene({ op: 'createScene', ...fixture });
    assert.equal(scene.ok, true, scene.error);
    assert.ok(scene.nodes.some((n) => n.meta?.pawAssetKind === 'icon'));
    assert.ok(scene.nodes.some((n) => n.meta?.pawMotifId === 'browser-window'));
    assert.ok(scene.nodes.some((n) => n.meta?.pawChartType === 'bar'));
    const imageNode = scene.nodes.find((n) => n.meta?.pawAssetKind === 'workspace');
    assert.ok(imageNode, 'workspace image missing');
    assert.equal(imageNode.src, '/artifacts/hero.png');
    assert.doesNotMatch(String(imageNode.src), /^https?:/);
  }

  {
    const { tools } = setup('s-visual-deck-catalog');
    const hit = await tools.deck.execute({ act: 'read', catalog: 'icons', query: '协作 团队', limit: 8 });
    assert.equal(hit.ok, true, hit.error);
    assert.ok(hit.icons?.length >= 1 && hit.icons.length <= 8);
    const motifs = await tools.deck.execute({ act: 'read', catalog: 'motifs' });
    assert.equal(motifs.ok, true);
    assert.ok(motifs.motifs.length >= 12);
    const imageBrief = await tools.deck.execute({
      act: 'read',
      catalog: 'image-brief',
      layoutId: 'title-visual',
      themeId: 'editorial',
      subject: 'quiet product still life'
    });
    assert.equal(imageBrief.ok, true, imageBrief.error);
    assert.equal(imageBrief.catalog, 'image-brief');
    assert.ok(imageBrief.aspectRatio);
    assert.ok(imageBrief.width >= 720);
    assert.match(imageBrief.prompt, /no text|不要出现任何文字/i);
    assert.match(imageBrief.prompt, /watermark/i);
    assert.equal(imageBrief.acquire.action, 'image');
    assert.equal(imageBrief.acquire.aspect_ratio, imageBrief.aspectRatio);
  }

  const officeJs = fs.readFileSync(new URL('../../src/agent/vnext/sessionWorkspace/officeTools.js', import.meta.url), 'utf8');
  assert.match(officeJs, /catalog="icons"/);
  assert.match(officeJs, /catalog="image-brief"/);
  assert.match(officeJs, /readVisualCatalog/);
  const toolsJs = fs.readFileSync(new URL('../../src/agent/vnext/sessionWorkspace/tools.js', import.meta.url), 'utf8');
  assert.match(toolsJs, /kind:icon\|motif\|chart\|image/);
  assert.match(toolsJs, /catalog="image-brief"/);
  assert.match(toolsJs, /compile does not generate images/);

  console.log(
    `test_visual_assets: ok icons=${CANVAS_ICON_IDS.length} pack=${packBytes}B motifs=${MOTIF_IDS.length}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
