import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import {
  applyEngineCommands,
  emptyPawCanvas,
  isPawCanvasDoc,
  listEngineNodes
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { ALL_LAYOUT_IDS, compactLayoutCatalog, getLayout, POSTER_LAYOUT_IDS, SLIDE_LAYOUT_IDS } from '../../src/agent/vnext/sessionWorkspace/layoutCatalog.js';
import { compileLayoutFrame, nodesWithinPaper } from '../../src/agent/vnext/sessionWorkspace/layoutCompile.js';
import { THEME_IDS } from '../../src/agent/vnext/sessionWorkspace/themeCatalog.js';
import { canvasSelectionCheck } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';

const ICON = { kind: 'icon', name: 'paw-print' };

function minimalSlots(layoutId) {
  const slots = {
    title: { title: '标题' },
    'title-visual': { title: '在选区上直接交付', visual: ICON },
    section: { title: '第二节' },
    agenda: { title: '大纲', items: ['选区', '画布', '交付'] },
    points: { title: '要点', items: [{ title: '选择', body: 'Paw ON' }, { title: '描述', body: '说出结果' }] },
    'points-icons': { title: '能力', items: [{ title: '选区', body: '圈选即上下文' }] },
    'two-col': { title: '对照', left: '运行时绑定', right: '提示词判断' },
    compare: { title: '比较', left: { title: '之前', items: ['手工排版'] }, right: { title: '之后', items: ['语义编译'] } },
    'stat-row': { title: '数字', stats: [{ value: '16:9', label: '幻灯' }, { value: '8', label: '主题' }] },
    quote: { quote: '选择加描述，直接交付。', attribution: 'Paw Work' },
    'image-caption': { visual: ICON, caption: '爪印' },
    timeline: { title: '时间', steps: [{ title: '选中' }, { title: '描述' }, { title: '交付' }] },
    process: { title: '路径', steps: [{ title: '选中' }, { title: '描述' }, { title: '编译' }] },
    matrix: { title: '矩阵', cells: [{ title: 'A', body: '一' }, { title: 'B', body: '二' }, { title: 'C', body: '三' }, { title: 'D', body: '四' }] },
    'case-study': { title: '案例', context: '选区散落', action: '语义版式', result: '可编辑幻灯' },
    closing: { title: '开始使用', subtitle: '打开 Paw' },
    'poster-hero': { title: '招聘', kicker: '2026' },
    'poster-split': { title: '发布', visual: ICON },
    'poster-event': { title: '开放日', date: '8 月 28 日' },
    'poster-quote': { quote: '在选区上直接交付' },
    'poster-product': { title: 'Paw Work', visual: ICON },
    'poster-editorial': { title: '编辑部' },
    'poster-data': { title: '数据', stats: [{ value: '6', label: '页' }, { value: '1', label: '画布' }] },
    'comic-panel': { panels: [{ caption: '选中', visual: ICON }, { caption: '交付', visual: ICON }] }
  };
  return slots[layoutId] || { title: '标题' };
}

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId });
  return { store, runtime, fs, tools, sessionId };
}

function seedBlankSlides(store, fs, sessionId) {
  const rec = createArtifact(store, fs, {
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

function pawOutline() {
  return {
    themeId: 'ink-rose',
    kind: 'deck',
    frames: [
      {
        id: 'slide-1',
        layoutId: 'title-visual',
        slots: {
          kicker: 'Chrome 扩展',
          title: '在选区上直接交付',
          subtitle: 'Paw ON · 选中 · 说出结果',
          visual: ICON
        }
      },
      {
        id: 'slide-2',
        layoutId: 'agenda',
        slots: { title: '大纲', items: ['选区即上下文', '画布即交付', '办公套件同会话'] }
      },
      {
        id: 'slide-3',
        layoutId: 'points',
        slots: {
          title: '能力',
          items: [
            { title: '选择', body: 'Paw ON 圈选' },
            { title: '描述', body: '说出结果' },
            { title: '交付', body: '可编辑画布' }
          ]
        }
      },
      {
        id: 'slide-4',
        layoutId: 'two-col',
        slots: {
          title: '绑定',
          left: { title: '运行时', body: '隔离 · 写策略 · 打开路由' },
          right: { title: '提示词', body: '结果类型 · 澄清 · 组合' }
        }
      },
      {
        id: 'slide-5',
        layoutId: 'process',
        slots: { title: '路径', steps: [{ title: '选中' }, { title: '描述' }, { title: '编译' }, { title: '交付' }] }
      },
      {
        id: 'slide-6',
        layoutId: 'closing',
        slots: { title: '开始使用', subtitle: '打开 Paw · 选中 · 说出结果' }
      }
    ]
  };
}

function assertNoModelBoxes(frames) {
  for (const fr of frames) {
    assert.equal(fr.nodes, undefined);
    assert.equal(fr.box, undefined);
    const json = JSON.stringify(fr.slots || {});
    assert.equal(json.includes('"x":'), false, 'slots must not author x/y/w/h');
  }
}

async function run() {
  for (const layoutId of ALL_LAYOUT_IDS) {
    const layout = getLayout(layoutId);
    assert.ok(layout, layoutId);
    const a = compileLayoutFrame({ id: 'f1', layoutId, slots: minimalSlots(layoutId) }, { themeId: 'editorial' });
    const b = compileLayoutFrame({ id: 'f1', layoutId, slots: minimalSlots(layoutId) }, { themeId: 'editorial' });
    assert.equal(a.ok, true, `${layoutId}: ${a.error}`);
    assert.equal(b.ok, true, `${layoutId}: ${b.error}`);
    assert.deepEqual(
      a.frame.nodes.map((n) => ({ id: n.id, type: n.type, box: n.box, text: n.text })),
      b.frame.nodes.map((n) => ({ id: n.id, type: n.type, box: n.box, text: n.text })),
      `${layoutId} must be deterministic`
    );
    assert.equal(nodesWithinPaper(a.frame.nodes, layout.paper), true, `${layoutId} boxes leave paper`);
    assert.ok(a.frame.nodes.some((n) => n.meta?.pawLayout === layoutId));
    assert.ok(a.frame.nodes.some((n) => n.meta?.pawTheme === 'editorial'));
    assert.ok(a.frame.nodes.some((n) => n.meta?.pawRole === 'bg'));
  }

  for (const themeId of THEME_IDS) {
    const compiled = compileLayoutFrame(
      { id: 'theme', layoutId: 'title', themeId, slots: { title: '主题' } },
      {}
    );
    assert.equal(compiled.ok, true, themeId);
    assert.equal(compiled.themeId, themeId);
    assert.ok(compiled.frame.nodes.every((n) => n.meta.pawTheme === themeId));
  }

  const unknownTheme = compileLayoutFrame({ layoutId: 'title', themeId: 'neon-void', slots: { title: 'x' } });
  assert.equal(unknownTheme.ok, false);
  assert.match(unknownTheme.error, /unknown themeId/);
  const unknownLayout = compileLayoutFrame({ layoutId: 'hero-blob', slots: { title: 'x' } });
  assert.equal(unknownLayout.ok, false);
  assert.match(unknownLayout.error, /unknown layoutId/);
  const unknownSlot = compileLayoutFrame({ layoutId: 'title', slots: { title: 'x', blob: 'no' } });
  assert.equal(unknownSlot.ok, false);
  assert.match(unknownSlot.error, /unknown slot/);

  const cjk = createScene({
    op: 'createScene',
    kind: 'deck',
    themeId: 'ink-rose',
    frames: [
      {
        id: 'slide-1',
        layoutId: 'title-visual',
        slots: { title: '在选区上直接交付', subtitle: '可编辑文字', visual: ICON }
      }
    ]
  });
  assert.equal(cjk.ok, true, cjk.error);
  const cjkText = (cjk.nodes || []).filter((n) => n.type === 'headline' || n.type === 'heading' || n.type === 'text');
  assert.ok(cjkText.some((n) => n.text.includes('在选区上直接交付')));
  assert.ok(cjkText.every((n) => n.type !== 'image'));
  const engineCjk = listEngineNodes(cjk.canvas);
  assert.ok(engineCjk.some((n) => n.type === 'text' && /在选区上/.test(n.text || '')));

  const outline = pawOutline();
  assertNoModelBoxes(outline.frames);
  const six = createScene({ op: 'createScene', ...outline });
  assert.equal(six.ok, true, six.error);
  assert.equal(six.kind, 'deck');
  assert.equal(six.frames.length, 6);
  assert.equal(six.frames.filter((f) => f.nodes?.length).length, 6);
  const sixFrames = listEngineNodes(six.canvas).filter((n) => n.type === 'frame');
  assert.equal(sixFrames.length, 6);
  assert.ok(six.nodes.every((n) => n.box && n.provenance === 'layout'));

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-layout-live');
    const blank = seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      artifactId: blank.artifactId,
      ...outline
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(compiled.artifactId, blank.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    const names = runtime.listArtifacts(sessionId).map((a) => a.name);
    assert.equal(names.filter((n) => n === 'slides.json').length, 1);
    const raw = fs.readFile(blank.primaryPath);
    assert.equal(isPawCanvasDoc(raw), true);
    const nodes = listEngineNodes(raw);
    assert.equal(nodes.filter((n) => n.type === 'frame').length, 6);
    assert.ok(nodes.some((n) => /在选区上直接交付/.test(n.text || '')));
  }

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-layout-blank-reg');
    const blank = seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      commands: [
        {
          artifactId: blank.artifactId,
          kind: 'deck',
          frames: [
            {
              id: 'slide-1',
              nodes: [
                { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
                { id: 'headline', type: 'headline', text: '回归', box: { x: 80, y: 80, w: 1760, h: 120 } }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.match(fs.readFile(blank.primaryPath), /回归/);
  }

  const rawNodes = createScene({
    op: 'createScene',
    kind: 'deck',
    frames: [
      {
        id: 'slide-1',
        nodes: [
          { id: 'bg', type: 'geo', fill: '#111111', box: { x: 0, y: 0, w: 1920, h: 1080 } },
          { id: 'headline', type: 'headline', text: '自由排版', box: { x: 80, y: 80, w: 1600, h: 100 } }
        ]
      }
    ]
  });
  assert.equal(rawNodes.ok, true, rawNodes.error);
  assert.equal(rawNodes.source, 'frames');
  assert.ok(rawNodes.nodes.some((n) => n.id === 'headline' && n.box.x === 80));

  const replaced = applyEngineCommands(six.canvas, [
    {
      op: 'replacePlate',
      plateId: 'slide-2',
      layoutId: 'quote',
      themeId: 'forest',
      slots: { quote: '版式由宿主编译。', attribution: 'Stage 1A' }
    }
  ]);
  assert.equal(replaced.ok, true, replaced.error);
  const after = listEngineNodes(replaced.doc);
  const frames = after.filter((n) => n.type === 'frame');
  assert.ok(frames.some((f) => f.nodeId === 'shape:slide-2'));
  assert.equal(frames.length, 6);
  assert.ok(after.some((n) => /版式由宿主编译/.test(n.text || '')));
  assert.ok(after.some((n) => /在选区上直接交付/.test(n.text || '')));
  const slide2Kids = after.filter((n) => n.parentId === 'shape:slide-2');
  assert.ok(slide2Kids.length >= 2);
  assert.equal(
    slide2Kids.some((n) => /大纲/.test(n.text || '')),
    false,
    'replacePlate must drop previous children'
  );
  const slide2 = frames.find((f) => f.nodeId === 'shape:slide-2');
  const beforeSlide2 = sixFrames.find((f) => f.nodeId === 'shape:slide-2');
  assert.equal(slide2.x, beforeSlide2.x);
  assert.equal(slide2.y, beforeSlide2.y);
  assert.equal(slide2.w, beforeSlide2.w);
  assert.equal(slide2.h, beforeSlide2.h);

  const needSel = canvasSelectionCheck([{ op: 'replacePlate', layoutId: 'title', slots: { title: 'x' } }], []);
  assert.equal(needSel.ok, false);
  assert.equal(needSel.code, 'NEED_SELECTION');
  const needSelApply = applyEngineCommands(six.canvas, [{ op: 'replacePlate', layoutId: 'title', slots: { title: 'x' } }]);
  assert.equal(needSelApply.ok, false);
  assert.equal(needSelApply.code, 'NEED_SELECTION');

  {
    const visual = compileLayoutFrame(
      { id: 'slide-1', layoutId: 'title-visual', slots: { title: '在选区上直接交付', visual: ICON } },
      { themeId: 'ink-rose' }
    );
    assert.equal(visual.ok, true, visual.error);
    const visBox = getLayout('title-visual').boxes.visual;
    const icon = visual.frame.nodes.find((n) => n.id === 'slide-1-visual');
    const card = visual.frame.nodes.find((n) => n.id === 'slide-1-visual-card');
    const deco = visual.frame.nodes.find((n) => n.id === 'slide-1-visual-deco');
    assert.ok(card, 'title-visual must emit a surface card');
    assert.ok(deco && deco.geo === 'ellipse', 'title-visual must emit decorative geometry');
    assert.ok(icon && icon.type === 'image');
    assert.ok(icon.box.w <= visBox.w * 0.5 + 1, `icon w ${icon.box.w} must stay within the visual column`);
    assert.ok(icon.box.h <= visBox.h * 0.5 + 1, `icon h ${icon.box.h} must stay within the visual column`);
    assert.ok(icon.box.w >= Math.min(visBox.w, visBox.h) * 0.34, 'cover motif must own its region');
    assert.notEqual(icon.box.w, visBox.w);
    assert.notEqual(icon.box.h, visBox.h);
    assert.ok(visual.frame.nodes.every((n) => !String(n.fill || '').startsWith('#')), 'semantic fills are named colors');
    assert.equal(visual.variant, 'dark');
    assert.equal(visual.frame.nodes.find((n) => n.meta?.pawRole === 'bg')?.fill, 'violet');
    assert.equal(visual.frame.nodes.find((n) => n.meta?.pawSlot === 'title')?.color, 'light-violet');
    assert.ok(visual.frame.nodes.filter((n) => n.type === 'geo').every((n) => n.dash === 'solid'));
  }

  {
    const five = compileLayoutFrame(
      {
        id: 'slide-4',
        layoutId: 'points-icons',
        slots: {
          title: '能力',
          items: [
            { title: '选区', body: '圈选即上下文', icon: 'paw-print' },
            { title: '画布', body: '可编辑交付', icon: 'star' },
            { title: '办公', body: '表格文档同会话', icon: 'check' },
            { title: '检索', body: '按需获取网页', icon: 'search' },
            { title: '质量', body: '编译后结构门禁', icon: 'sparkles' }
          ]
        }
      },
      { themeId: 'ink-rose' }
    );
    assert.equal(five.ok, true, five.error);
    const cards = five.frame.nodes.filter((n) => n.meta?.pawRole === 'card');
    assert.equal(cards.length, 5, 'five items must emit five cards, not a 2×3 hole');
    const paper = getLayout('points-icons').paper;
    assert.equal(nodesWithinPaper(five.frame.nodes, paper), true);
    const row1 = cards.filter((n) => n.box.y === cards[0].box.y);
    const row2 = cards.filter((n) => n.box.y !== cards[0].box.y);
    assert.equal(row1.length, 3);
    assert.equal(row2.length, 2);
    const mid1 = (Math.min(...row1.map((n) => n.box.x)) + Math.max(...row1.map((n) => n.box.x + n.box.w))) / 2;
    const mid2 = (Math.min(...row2.map((n) => n.box.x)) + Math.max(...row2.map((n) => n.box.x + n.box.w))) / 2;
    assert.ok(Math.abs(mid1 - mid2) < 8, `second row must be centered under the first (${mid1} vs ${mid2})`);
  }

  assert.equal(SLIDE_LAYOUT_IDS.length, 16);
  assert.equal(POSTER_LAYOUT_IDS.length, 8);

  {
    const catalog = compactLayoutCatalog();
    const statRow = catalog.layouts.deck['stat-row'];
    const twoCol = catalog.layouts.deck['two-col'];
    assert.ok(statRow, 'compact catalog must expose stat-row');
    assert.deepEqual(statRow.required, ['title', 'stats']);
    assert.deepEqual(statRow.optional, ['kicker']);
    assert.ok(twoCol, 'compact catalog must expose two-col');
    assert.deepEqual(twoCol.required, ['title', 'left', 'right']);
    assert.deepEqual(twoCol.optional, ['kicker']);
    assert.equal(JSON.stringify(statRow).includes('description'), false);
  }

  const compileSrc = fs.readFileSync(new URL('../../src/agent/vnext/sessionWorkspace/layoutCompile.js', import.meta.url), 'utf8');
  const stamp = compileSrc.slice(compileSrc.indexOf('function stampMeta'), compileSrc.indexOf('function inferSlotFromId'));
  assert.equal((stamp.match(/pawLayout:/g) || []).length, 1);
  assert.equal((stamp.match(/pawTheme:/g) || []).length, 1);
  assert.equal((stamp.match(/pawVariant:/g) || []).length, 1);

  const badVariant = compileLayoutFrame({ layoutId: 'title', variant: 'neon-void', slots: { title: 'x' } });
  assert.equal(badVariant.ok, false);
  assert.match(badVariant.error, /unknown variant/);

  console.log('test_layout_compile: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
