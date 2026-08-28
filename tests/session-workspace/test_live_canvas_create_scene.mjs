import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { emptyPawCanvas, isPawCanvasDoc, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { loadSkillInstructions } from '../../src/agent/vnext/skills/registry.js';
import { buildSessionAgentInstructions, buildWorldStateBlock } from '../../src/agent/vnext/sessionWorkspace/prompt.js';

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

async function run() {
  {
    const { tools } = setup('s-run-schema');
    const props = tools.run.parameters?.properties || {};
    assert.ok(props.themeId, 'run schema must accept themeId');
    assert.ok(props.frames, 'run schema must accept frames[]');
    assert.ok(props.kind, 'run schema must accept kind');
  }
  const deckSkill = loadSkillInstructions('slides', { sessionId: 's-live-canvas' }) || '';
  assert.match(deckSkill, /open Slides canvas|already has a Slides canvas|reused by the host/i);
  assert.match(deckSkill, /createScene/, 'skill still compiles via createScene');

  const system = buildSessionAgentInstructions({ sessionId: 's-live-canvas' });
  assert.match(system, /already open \(activeHtml\)/);
  assert.match(system, /second slides\.json/);
  assert.match(system, /themeId/);
  assert.match(system, /layoutId/);
  assert.match(system, /CANVAS_QA_FAILED/);
  assert.match(system, /one visual artifact/);
  assert.doesNotMatch(system, /poster-hero|title-visual|hanbai/);

  const world = buildWorldStateBlock({
    activeHtml: { artifactId: 'art_open', overview: { shell: 'slides', frames: [], nodeCount: 1 } }
  });
  assert.match(world, /one Slides file holds many 16:9 frames/);
  assert.doesNotMatch(world, /Do not create a second slides\.json/);

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-live-cmd-aid');
    const blank = seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      commands: [
        {
          artifactId: blank.artifactId,
          kind: 'deck',
          title: 'Paw Work',
          frames: [
            {
              id: 'slide-1',
              nodes: [
                { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
                { id: 'headline', type: 'headline', text: '重塑浏览器端 AI 生产力', box: { x: 80, y: 80, w: 1760, h: 120 } }
              ]
            },
            {
              id: 'slide-2',
              nodes: [
                { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
                { id: 'headline', type: 'headline', text: '核心能力', box: { x: 80, y: 80, w: 1760, h: 100 } },
                { id: 'body', type: 'text', text: '选区 · 画布 · 办公套件', box: { x: 80, y: 220, w: 1760, h: 80 } }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true);
    assert.equal(compiled.artifactId, blank.artifactId);
    assert.equal(compiled.kind, 'deck');
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    const raw = fs.readFile(blank.primaryPath);
    assert.equal(isPawCanvasDoc(raw), true);
    const nodes = listEngineNodes(raw);
    assert.ok(nodes.some((n) => /重塑浏览器端/.test(n.text || '')), JSON.stringify(nodes.map((n) => n.text)));
    assert.ok(nodes.filter((n) => n.type === 'frame').length >= 2);
  }

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-live-focus');
    const blank = seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      nodes: [
        { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
        { id: 'headline', type: 'headline', text: '开场', box: { x: 80, y: 80, w: 1600, h: 100 } },
        { id: 'body', type: 'text', text: '写在已打开的空白幻灯上', box: { x: 80, y: 220, w: 1600, h: 80 } }
      ]
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true, 'unspecified kind + open slides must infer deck and reuse');
    assert.equal(compiled.artifactId, blank.artifactId);
    assert.equal(compiled.kind, 'deck');
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    assert.match(fs.readFile(blank.primaryPath), /开场/);
  }

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-live-empty');
    const blank = seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const empty = await tools.run.execute({
      op: 'createScene',
      commands: [{ artifactId: blank.artifactId }]
    });
    assert.equal(empty.ok, false);
    assert.match(String(empty.error || ''), /frames\[\]|nodes|already open/i);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
    const still = await tools.run.execute({
      op: 'createScene',
      commands: [{}]
    });
    assert.equal(still.ok, false);
    assert.match(String(still.error || ''), /already open|needs html|frames\[\]|nodes/i);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
  }

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-live-poster-aside');
    seedBlankSlides(store, fs, sessionId);
    const before = runtime.listArtifacts(sessionId).length;
    const poster = await tools.run.execute({
      op: 'createScene',
      kind: 'poster',
      title: 'hiring',
      nodes: [{ id: 't', type: 'text', text: '海报', box: { x: 40, y: 40, w: 400, h: 60 } }]
    });
    assert.equal(poster.ok, true, poster.error);
    assert.equal(poster.kind, 'poster');
    assert.notEqual(poster.reused, true);
    assert.equal(runtime.listArtifacts(sessionId).length, before + 1);
  }

  {
    const store = new SessionWorkspaceStore();
    const runtime = createSessionWorkspaceRuntime(store);
    runtime.createSession({ sessionId: 's-live-fake-apply' });
    const execution = beginExecution(store, 's-live-fake-apply', {});
    const fs = createSessionGuestFs(store, { sessionId: 's-live-fake-apply', executionId: execution.executionId });
    fs.mkdirp('/artifacts');
    const blank = seedBlankSlides(store, fs, 's-live-fake-apply');
    const tools = createSessionTools({
      store,
      execution,
      fs,
      sessionId: 's-live-fake-apply',
      hostCanvas: async () => ({ ok: true, result: { ok: true, liveApplied: true, applied: [] } })
    });
    await tools.run.execute({
      op: 'createScene',
      kind: 'deck',
      title: 'seed',
      frames: [
        {
          id: 'slide-4',
          layoutId: 'points',
          slots: { kicker: 'K', title: '一次会话里的五件事', points: ['a', 'b', 'c'] }
        }
      ]
    });
    const replaced = await tools.deck.execute({
      act: 'write',
      op: 'replacePlate',
      plateId: 'slide-4',
      layoutId: 'quote',
      themeId: 'ink-rose',
      slots: {
        kicker: '同一页，换版式',
        quote: 'replacePlate 只改这一页的孩子，不另开文件。',
        attribution: 'Paw Work'
      }
    });
    assert.equal(replaced.ok, true, replaced.error);
    const raw = fs.readFile(blank.primaryPath);
    const nodes = listEngineNodes(raw);
    assert.ok(
      nodes.some((n) => /replacePlate 只改这一页/.test(n.text || '')),
      'liveApplied without replacePlate must fall through to store compile'
    );
  }

  {
    const { store, runtime, fs, tools, sessionId } = setup('s-live-unfocused');
    const rec = createArtifact(store, fs, {
      sessionId,
      name: 'slides.json',
      content: JSON.stringify(emptyPawCanvas({ shell: 'slides', title: 'Slides' })),
      mimeType: 'application/json'
    });
    const before = runtime.listArtifacts(sessionId).length;
    const compiled = await tools.run.execute({
      op: 'createScene',
      kind: 'deck',
      title: '未对焦也复用',
      nodes: [
        { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
        { id: 'headline', type: 'headline', text: '唯一幻灯', box: { x: 80, y: 80, w: 800, h: 80 } }
      ]
    });
    assert.equal(compiled.ok, true, compiled.error);
    assert.equal(compiled.reused, true, 'sole slides.json must be reused without activeHtml');
    assert.equal(compiled.artifactId, rec.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, before);
  }

  {
    const { runtime, tools, sessionId } = setup('s-live-fresh');
    const created = await tools.run.execute({
      op: 'createScene',
      kind: 'deck',
      title: 'Fresh',
      nodes: [
        { id: 'bg', type: 'geo', fill: '#0b1b3a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
        { id: 'headline', type: 'headline', text: '新文件', box: { x: 80, y: 80, w: 800, h: 80 } }
      ]
    });
    assert.equal(created.ok, true, created.error);
    assert.notEqual(created.reused, true);
    assert.ok(created.artifact?.artifactId);
    assert.equal(runtime.listArtifacts(sessionId).length, 1);
  }

  console.log('test_live_canvas_create_scene: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
