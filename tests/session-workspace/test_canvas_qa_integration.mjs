/**
 * Canvas QA runtime gate — persist/apply, not compile-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { applyEngineCommands, emptyPawCanvas, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { CANVAS_QA_FAILED, gateCompiledScene, qaGateMode } from '../../src/agent/vnext/sessionWorkspace/canvasQaGate.js';
import { PREVIEW_MAX_FRAMES } from '../../src/agent/vnext/sessionWorkspace/canvasPreview.js';
import { compileLayoutFrame } from '../../src/agent/vnext/sessionWorkspace/layoutCompile.js';
import { SLIDE_LAYOUT_IDS, POSTER_LAYOUT_IDS, getLayout } from '../../src/agent/vnext/sessionWorkspace/layoutCatalog.js';
import { THEME_IDS } from '../../src/agent/vnext/sessionWorkspace/themeCatalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const visualDir = path.join(here, 'fixtures/visual');
const layoutSrc = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/layoutCompile.js'), 'utf8');

const ICON = { kind: 'icon', name: 'paw-print' };
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(visualDir, name), 'utf8'));
}

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  return { store, runtime, fs: guest, tools, sessionId };
}

function seedBlankSlides(store, guest, sessionId) {
  const rec = createArtifact(store, guest, {
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

function uglyDeckInput() {
  const ugly = loadJson('ugly-wireframe.json');
  const frame = ugly.frames[0];
  return {
    kind: 'deck',
    title: 'Q3 Strategy',
    frames: [
      {
        id: frame.id,
        size: { w: frame.w, h: frame.h },
        nodes: frame.nodes
      }
    ]
  };
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

function representativeDeckSlots(layoutId) {
  const slots = {
    title: { kicker: 'Paw Work', title: '在选区上直接交付', subtitle: '选中 · 描述结果 · 得到可编辑画布', footer: 'Chrome 扩展' },
    'title-visual': { kicker: 'Chrome 扩展', title: '在选区上直接交付', subtitle: 'Paw ON · 选中 · 说出结果', visual: ICON },
    section: { kicker: '第二章', number: '02', title: '从选区到交付' },
    agenda: { kicker: '今日', title: '议程', items: ['选区即上下文', '画布即交付', '办公套件同会话', '质量门禁'] },
    points: {
      kicker: '能力',
      title: '三步交付',
      items: [
        { title: '选择', body: 'Paw ON 圈选页面上的证据' },
        { title: '描述', body: '说出想要的结果，而不是步骤' },
        { title: '交付', body: '得到可点击编辑的画布' }
      ]
    },
    'points-icons': {
      kicker: '能力',
      title: '扩展能力',
      items: [
        { title: '选区', body: '圈选即上下文', icon: 'paw-print' },
        { title: '画布', body: '可编辑交付', icon: 'star' },
        { title: '办公', body: '表格文档同会话', icon: 'check' },
        { title: '检索', body: '按需获取网页', icon: 'search' },
        { title: '质量', body: '编译后结构门禁', icon: 'sparkles' }
      ]
    },
    'two-col': {
      kicker: '分工',
      title: '绑定与判断',
      left: { title: '运行时', body: '隔离 · 写策略 · 打开路由 · 工具清单' },
      right: { title: '提示词', body: '结果类型 · 澄清 · 组合 · 质量' }
    },
    compare: {
      kicker: '对照',
      title: '之前与之后',
      left: { title: '之前', body: '手工排版，坐标由模型填写' },
      right: { title: '之后', body: '语义版式，宿主编译几何' }
    },
    'stat-row': {
      kicker: '度量',
      title: '这一次的数字',
      stats: [
        { value: '16:9', label: '幻灯画幅' },
        { value: '8', label: '内置主题' },
        { value: '16', label: '幻灯版式' }
      ]
    },
    quote: { kicker: '原则', quote: '选择加描述，直接交付。', attribution: 'Paw Work' },
    'image-caption': { kicker: '现场', title: '选区截图', visual: ICON, caption: '用户圈选的证据会进入工作区' },
    timeline: {
      kicker: '路径',
      title: '从选中到交付',
      steps: [
        { title: '选中', body: 'Paw ON 圈选' },
        { title: '描述', body: '说出结果' },
        { title: '编译', body: '宿主几何' },
        { title: '交付', body: '可编辑幻灯' }
      ]
    },
    process: {
      kicker: '流程',
      title: '四步工作流',
      steps: [
        { title: '选中', body: '圈选证据' },
        { title: '描述', body: '说出结果' },
        { title: '编译', body: '语义版式' },
        { title: '交付', body: '同一文件' }
      ]
    },
    matrix: {
      kicker: '象限',
      title: '工作面',
      cells: [
        { title: '选区', body: '页面证据' },
        { title: '幻灯', body: '16:9 画布' },
        { title: '表格', body: 'Univer 网格' },
        { title: '文档', body: '长文交付' }
      ]
    },
    'case-study': {
      kicker: '案例',
      title: '选区变成幻灯',
      context: { title: '情境', body: '选区散落在帮助页和截图里' },
      action: { title: '动作', body: '语义版式一次编译到空白幻灯' },
      result: { title: '结果', body: '六页可编辑，同一 artifact' },
      visual: ICON
    },
    closing: { title: '开始使用', subtitle: '打开 Paw · 选中 · 说出结果', cta: '打开扩展', footer: 'paw.work' }
  };
  return slots[layoutId] || { title: '标题' };
}

function representativePosterSlots(layoutId) {
  const slots = {
    'poster-hero': { kicker: '2026', title: '一起做浏览器里的工作', subtitle: '选中页面，说出结果', visual: ICON, cta: '加入' },
    'poster-split': { kicker: '发布', title: 'Paw Work', subtitle: '选区即上下文', visual: ICON, cta: '打开' },
    'poster-event': { kicker: '开放日', title: '现场演示', date: '8 月 28 日', place: '上海', visual: ICON, cta: '预约' },
    'poster-quote': { kicker: '原则', quote: '在选区上直接交付', attribution: 'Paw Work' },
    'poster-product': { kicker: '产品', title: 'Paw Work', subtitle: 'Chrome 扩展', visual: ICON, price: 'BYOK', cta: '安装' },
    'poster-editorial': { kicker: '编辑部', title: '选择之后是交付', subtitle: '不是再写一份大纲', byline: 'Paw Work', visual: ICON },
    'poster-data': {
      kicker: '度量',
      title: '一次会话',
      stats: [
        { value: '6', label: '页' },
        { value: '1', label: '画布' },
        { value: '8', label: '主题' }
      ],
      footnote: '内置目录'
    },
    'comic-panel': {
      title: '四格',
      panels: [
        { caption: '选中', visual: ICON },
        { caption: '描述', visual: ICON },
        { caption: '编译', visual: ICON },
        { caption: '交付', visual: ICON }
      ]
    }
  };
  return slots[layoutId] || { title: '海报' };
}

function seedRasterPng(store, guest, sessionId) {
  return createArtifact(store, guest, {
    sessionId,
    name: 'flatten.png',
    content: PNG_1X1,
    mimeType: 'image/png'
  });
}

function assertQaShape(qa) {
  assert.ok(qa && typeof qa === 'object');
  assert.equal(typeof qa.version, 'number');
  assert.equal(typeof qa.score, 'number');
  assert.equal(typeof qa.ok, 'boolean');
  assert.ok(Array.isArray(qa.issues));
  assert.ok(qa.metrics && typeof qa.metrics === 'object');
}

async function run() {
  // 9. No duplicate-key literals in layoutCompile (esbuild warning source)
  const stamp = layoutSrc.slice(layoutSrc.indexOf('function stampMeta'), layoutSrc.indexOf('function inferSlotFromId'));
  assert.match(stamp, /function stampMeta/);
  assert.equal((stamp.match(/pawLayout:/g) || []).length, 1, 'stampMeta must not re-list pawLayout');
  assert.equal((stamp.match(/pawTheme:/g) || []).length, 1, 'stampMeta must not re-list pawTheme');
  assert.equal((stamp.match(/pawVariant:/g) || []).length, 1, 'stampMeta must not re-list pawVariant');
  const objects = layoutSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let obj;
  const objRe = /\{[^{}]{0,500}\}/g;
  while ((obj = objRe.exec(objects))) {
    const keys = [...obj[0].matchAll(/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);
    const seen = new Set();
    for (const key of keys) {
      assert.equal(seen.has(key), false, `layoutCompile.js duplicate key ${key} in ${obj[0].slice(0, 96)}`);
      seen.add(key);
    }
  }

  // 8. Preview cap is 8 (agent readback only)
  assert.equal(PREVIEW_MAX_FRAMES, 8);

  // 1. Ugly wireframe is rejected before creation
  {
    const { runtime, tools, sessionId } = setup('s-qa-ugly-create');
    const before = runtime.listArtifacts(sessionId).length;
    const failed = await tools.run.execute({
      op: 'createScene',
      ...uglyDeckInput()
    });
    assert.equal(failed.ok, false, failed.error);
    assert.equal(failed.code, CANVAS_QA_FAILED);
    assert.ok(failed.score < 50, `ugly score ${failed.score}`);
    assert.ok((failed.issues || []).some((i) => i.code === 'WIREFRAME' || i.code === 'NO_PAPER'));
    assertQaShape(failed.qa);
    assert.equal(failed.qa.ok, false);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
  }

  // 2. Failure against a live blank deck leaves bytes identical
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-ugly-live');
    const blank = seedBlankSlides(store, guest, sessionId);
    const beforeBytes = guest.readFile(blank.primaryPath);
    const before = runtime.listArtifacts(sessionId).length;
    const failed = await tools.run.execute({
      op: 'createScene',
      artifactId: blank.artifactId,
      ...uglyDeckInput()
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, CANVAS_QA_FAILED);
    assert.equal(failed.artifactId, blank.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.equal(runtime.listArtifacts(sessionId).filter((a) => a.name === 'slides.json').length, 1);
    assert.equal(guest.readFile(blank.primaryPath), beforeBytes);
  }

  // 3 + 7. Six-frame semantic outline passes into one artifact; QA on success
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-six');
    seedBlankSlides(store, guest, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const outline = pawOutline();
    const passed = await tools.run.execute({
      op: 'createScene',
      ...outline
    });
    assert.equal(passed.ok, true, passed.error);
    assert.equal(passed.reused, true);
    assert.equal(passed.kind, 'deck');
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.equal(runtime.listArtifacts(sessionId).filter((a) => /\.json$/i.test(a.name)).length, 1);
    const nodes = listEngineNodes(guest.readFile(passed.artifact.primaryPath));
    assert.equal(nodes.filter((n) => n.type === 'frame').length, 6);
    assertQaShape(passed.qa);
    assert.equal(passed.qa.ok, true);
    assert.ok(passed.qa.score >= 50, `six-frame score ${passed.qa.score}`);
  }

  // 4. Failed semantic replacePlate preserves children; valid replacement succeeds
  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-replace');
    const created = await tools.run.execute({
      op: 'createScene',
      ...pawOutline()
    });
    assert.equal(created.ok, true, created.error);
    const artifactId = created.artifactId;
    const rec = runtime.listArtifacts(sessionId).find((a) => a.artifactId === artifactId);
    const beforeBytes = guest.readFile(rec.primaryPath);
    const beforeKids = listEngineNodes(beforeBytes).filter((n) => n.parentId === 'shape:slide-2');
    assert.ok(beforeKids.length >= 2);
    assert.ok(beforeKids.some((n) => /大纲/.test(n.text || '')));

    store.put('sessions', sessionId, {
      ...store.get('sessions', sessionId),
      activeHtml: { artifactId, selections: [{ nodeId: 'shape:slide-2' }] }
    });

    const badPlate = await tools.deck.execute({
      act: 'write',
      artifactId,
      op: 'replacePlate',
      plateId: 'slide-2',
      layoutId: 'poster-hero',
      themeId: 'ink-rose',
      slots: { title: '招聘海报不该盖住幻灯' }
    });
    assert.equal(badPlate.ok, false, 'poster recipe on a slide frame must fail QA');
    assert.equal(badPlate.code, CANVAS_QA_FAILED);
    assertQaShape(badPlate.qa);
    assert.equal(guest.readFile(rec.primaryPath), beforeBytes);
    const stillKids = listEngineNodes(guest.readFile(rec.primaryPath)).filter((n) => n.parentId === 'shape:slide-2');
    assert.deepEqual(
      stillKids.map((n) => n.nodeId).sort(),
      beforeKids.map((n) => n.nodeId).sort()
    );
    assert.ok(stillKids.some((n) => /大纲/.test(n.text || '')));

    const goodPlate = await tools.deck.execute({
      act: 'write',
      artifactId,
      op: 'replacePlate',
      plateId: 'slide-2',
      layoutId: 'quote',
      themeId: 'ink-rose',
      slots: { quote: '版式由宿主编译。', attribution: 'Paw Work' }
    });
    assert.equal(goodPlate.ok, true, goodPlate.error);
    assertQaShape(goodPlate.qa);
    assert.equal(goodPlate.qa.ok, true);
    const after = listEngineNodes(guest.readFile(rec.primaryPath));
    assert.equal(after.filter((n) => n.type === 'frame').length, 6);
    const slide2 = after.filter((n) => n.parentId === 'shape:slide-2');
    assert.ok(slide2.some((n) => /版式由宿主编译/.test(n.text || '')));
    assert.equal(slide2.some((n) => /大纲/.test(n.text || '')), false);
    const frames = after.filter((n) => n.type === 'frame');
    const s2 = frames.find((f) => f.nodeId === 'shape:slide-2');
    const beforeFrames = listEngineNodes(beforeBytes).filter((n) => n.type === 'frame');
    const beforeS2 = beforeFrames.find((f) => f.nodeId === 'shape:slide-2');
    assert.equal(s2.x, beforeS2.x);
    assert.equal(s2.y, beforeS2.y);
    assert.equal(s2.w, beforeS2.w);
    assert.equal(s2.h, beforeS2.h);
  }

  // 5. Legacy freeform design is advisory — applies even without paper
  {
    const { runtime, tools, sessionId } = setup('s-qa-freeform');
    const before = runtime.listArtifacts(sessionId).length;
    const free = await tools.run.execute({
      op: 'createScene',
      kind: 'poster',
      title: 'freeform',
      nodes: [
        { id: 'title', type: 'headline', text: '自由排版', box: { x: 40, y: 40, w: 400, h: 60 } },
        { id: 'body', type: 'text', text: '无 layoutId', box: { x: 40, y: 120, w: 400, h: 40 } }
      ]
    });
    assert.equal(free.ok, true, free.error);
    assert.equal(free.kind, 'poster');
    assertQaShape(free.qa);
    assert.equal(runtime.listArtifacts(sessionId).length, before + 1);
  }

  // 6. Deck raw frames are strict
  {
    const { runtime, tools, sessionId } = setup('s-qa-raw-deck');
    const before = runtime.listArtifacts(sessionId).length;
    const raw = await tools.run.execute({
      op: 'createScene',
      kind: 'deck',
      frames: [
        {
          id: 'slide-1',
          nodes: [
            { id: 'title', type: 'headline', text: 'Raw dump', box: { x: 80, y: 48, w: 720, h: 64 } },
            {
              id: 'bullets',
              type: 'text',
              text: '• one\n• two\n• three\n• four',
              box: { x: 80, y: 780, w: 1760, h: 220 }
            }
          ]
        }
      ]
    });
    assert.equal(raw.ok, false);
    assert.equal(raw.code, CANVAS_QA_FAILED);
    assert.ok((raw.issues || []).some((i) => i.severity === 'hard'));
    assert.equal(runtime.listArtifacts(sessionId).length, before);

    const okRaw = await tools.run.execute({
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
    assert.equal(okRaw.ok, true, okRaw.error);
    assertQaShape(okRaw.qa);
  }

  {
    const isolated = setup('s-qa-engine-iso');
    const made = await isolated.tools.run.execute({ op: 'createScene', ...pawOutline() });
    assert.equal(made.ok, true, made.error);
    const rec = isolated.runtime.listArtifacts(isolated.sessionId)[0];
    const before = isolated.fs.readFile(rec.primaryPath);
    const canvas = JSON.parse(before);
    const failed = applyEngineCommands(canvas, [
      {
        op: 'replacePlate',
        plateId: 'slide-2',
        layoutId: 'poster-hero',
        themeId: 'ink-rose',
        slots: { title: '不该写入' }
      }
    ]);
    assert.equal(failed.ok, false);
    assert.equal(failed.code, CANVAS_QA_FAILED);
    assert.equal(failed.doc, undefined);
    assert.equal(isolated.fs.readFile(rec.primaryPath), before);
    assert.ok(listEngineNodes(before).some((n) => /大纲/.test(n.text || '')));
  }

  assert.equal(qaGateMode({ kind: 'deck', op: 'fromRaster', source: 'raster' }), 'strict');
  assert.equal(qaGateMode({ kind: 'poster', op: 'fromRaster', source: 'raster' }), 'advisory');

  {
    const { runtime, tools, sessionId } = setup('s-qa-ops-deck');
    const ugly = uglyDeckInput();
    const before = runtime.listArtifacts(sessionId).length;
    for (const op of ['fromPage', 'fromSelection', 'fromRaster']) {
      const failed = await tools.run.execute({
        op,
        kind: 'deck',
        title: 'Q3 Strategy',
        ...(op === 'fromRaster' ? { item: 'screenshot1', path: '/artifacts/missing.png' } : {}),
        frames: ugly.frames
      });
      assert.equal(failed.ok, false, `${op} deck must be strict: ${failed.error}`);
      assert.equal(failed.code, CANVAS_QA_FAILED, `${op} deck code`);
      assert.ok((failed.issues || []).some((i) => i.code === 'WIREFRAME' || i.code === 'NO_PAPER'), `${op} issues`);
      assert.equal(runtime.listArtifacts(sessionId).length, before, `${op} must not persist a deck`);
    }
  }

  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-ops-design');
    const png = seedRasterPng(store, guest, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const freeform = [
      { id: 'title', type: 'headline', text: '自由排版', box: { x: 40, y: 40, w: 400, h: 60 } },
      { id: 'body', type: 'text', text: '无 layoutId', box: { x: 40, y: 120, w: 400, h: 40 } }
    ];
    let posterId = '';
    for (const op of ['fromPage', 'fromSelection', 'fromRaster']) {
      const free = await tools.run.execute({
        op,
        kind: 'poster',
        title: `free-${op}`,
        ...(op === 'fromRaster' ? { path: png.primaryPath } : {}),
        nodes: freeform
      });
      assert.equal(free.ok, true, `${op} design advisory: ${free.error}`);
      assert.equal(free.kind, 'poster');
      assertQaShape(free.qa);
      if (!posterId) posterId = free.artifactId;
      else assert.equal(free.artifactId, posterId, `${op} must reuse the first poster in this execution`);
    }
    assert.equal(runtime.listArtifacts(sessionId).length, before + 1);
  }

  {
    const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-live-8');
    const blank = seedBlankSlides(store, guest, sessionId);
    const png = seedRasterPng(store, guest, sessionId);
    const beforeBytes = guest.readFile(blank.primaryPath);
    const before = runtime.listArtifacts(sessionId).length;
    const ugly = uglyDeckInput();
    const attempts = [
      { op: 'fromPage', kind: 'deck', artifactId: blank.artifactId, frames: ugly.frames },
      { op: 'fromSelection', kind: 'deck', artifactId: blank.artifactId, frames: ugly.frames },
      { op: 'fromRaster', kind: 'deck', artifactId: blank.artifactId, path: png.primaryPath, nodes: ugly.frames[0].nodes },
      { op: 'fromPage', artifactId: blank.artifactId, frames: ugly.frames },
      { op: 'fromSelection', artifactId: blank.artifactId, frames: ugly.frames },
      { op: 'fromRaster', artifactId: blank.artifactId, path: png.primaryPath, nodes: ugly.frames[0].nodes },
      { op: 'fromPage', kind: 'deck', artifactId: blank.artifactId, frames: ugly.frames },
      { op: 'fromRaster', kind: 'deck', artifactId: blank.artifactId, path: png.primaryPath, frames: ugly.frames }
    ];
    assert.equal(attempts.length, 8);
    for (let i = 0; i < attempts.length; i++) {
      const failed = await tools.run.execute(attempts[i]);
      assert.equal(failed.ok, false, `live attempt ${i} ${attempts[i].op}: ${failed.error}`);
      assert.equal(failed.code, CANVAS_QA_FAILED, `live attempt ${i} code`);
      assert.equal(failed.artifactId, blank.artifactId, `live attempt ${i} must name the same artifact`);
      assert.equal(runtime.listArtifacts(sessionId).length, before, `live attempt ${i} artifact count`);
      assert.equal(guest.readFile(blank.primaryPath), beforeBytes, `live attempt ${i} bytes`);
    }
    assert.equal(runtime.listArtifacts(sessionId).filter((a) => a.name === 'slides.json').length, 1);
  }

  {
    const scores = [];
    for (const layoutId of SLIDE_LAYOUT_IDS) {
      for (const themeId of THEME_IDS) {
        const compiled = compileLayoutFrame({ id: layoutId, layoutId, slots: representativeDeckSlots(layoutId) }, { themeId });
        assert.equal(compiled.ok, true, `${layoutId}/${themeId}: ${compiled.error}`);
        const paper = getLayout(layoutId).paper;
        assert.equal(compiled.frame.size.w, paper.w, `${layoutId} must stay on slide paper`);
        assert.equal(compiled.frame.size.h, paper.h);
        const gated = gateCompiledScene(
          {
            ok: true,
            kind: 'deck',
            source: 'layout',
            layoutId,
            themeId,
            frames: [compiled.frame],
            nodes: compiled.frame.nodes,
            size: compiled.frame.size
          },
          { op: 'createScene', kind: 'deck' }
        );
        assert.equal(gated.ok, true, `${layoutId}/${themeId}: ${gated.error || JSON.stringify(gated.qa?.issues)}`);
        assert.equal(gated.qa.ok, true);
        assert.equal(
          (gated.qa.issues || []).some((i) => i.severity === 'hard'),
          false,
          `${layoutId}/${themeId} hard ${JSON.stringify(gated.qa.issues)}`
        );
        assert.ok(gated.qa.score >= 90, `${layoutId}/${themeId} score ${gated.qa.score}`);
        const warnCodes = (gated.qa.issues || []).map((i) => i.code);
        if (['compare', 'process', 'points-icons', 'timeline', 'matrix', 'stat-row', 'case-study'].includes(layoutId)) {
          assert.equal(warnCodes.includes('UNDERFILLED_LAYOUT'), false, `${layoutId}/${themeId} UNDERFILLED ${JSON.stringify(gated.qa.issues)}`);
          assert.equal(warnCodes.includes('WEAK_HIERARCHY'), false, `${layoutId}/${themeId} WEAK_HIERARCHY ${JSON.stringify(gated.qa.issues)}`);
          assert.equal(warnCodes.includes('OUTLINE_HEAVY'), false, `${layoutId}/${themeId} OUTLINE_HEAVY ${JSON.stringify(gated.qa.issues)}`);
        }
        scores.push(gated.qa.score);
      }
    }
    assert.equal(scores.length, 128);
    console.log(`deck-matrix n=128 min=${Math.min(...scores)} max=${Math.max(...scores)}`);
  }

  {
    for (const layoutId of POSTER_LAYOUT_IDS) {
      const paper = getLayout(layoutId).paper;
      assert.notEqual(`${paper.w}x${paper.h}`, '1920x1080', `${layoutId} must keep poster paper`);
      for (const themeId of THEME_IDS) {
        const compiled = compileLayoutFrame({ id: layoutId, layoutId, slots: representativePosterSlots(layoutId) }, { themeId });
        assert.equal(compiled.ok, true, `${layoutId}/${themeId}: ${compiled.error}`);
        assert.equal(compiled.frame.size.w, paper.w, `${layoutId}/${themeId} width`);
        assert.equal(compiled.frame.size.h, paper.h, `${layoutId}/${themeId} height`);
        const gated = gateCompiledScene(
          {
            ok: true,
            kind: 'poster',
            source: 'layout',
            layoutId,
            themeId,
            frames: [compiled.frame],
            nodes: compiled.frame.nodes,
            size: compiled.frame.size
          },
          { op: 'createScene', kind: 'poster' }
        );
        assert.equal(gated.ok, true, `${layoutId}/${themeId}: ${gated.error || JSON.stringify(gated.qa?.issues)}`);
        assert.equal(
          (gated.qa.issues || []).some((i) => i.severity === 'hard'),
          false,
          `${layoutId}/${themeId} hard ${JSON.stringify(gated.qa.issues)}`
        );
      }
    }
  }

  console.log('test_canvas_qa_integration: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
