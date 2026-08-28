/**
 * tldraw 5.3.2 required shape props: emitters write complete records, and
 * parse/hydration fills legacy url-less geo (and sibling defaults) before store load.
 */
import assert from 'node:assert/strict';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { compileLayoutFrame } from '../../src/agent/vnext/sessionWorkspace/layoutCompile.js';
import { compileMotif } from '../../src/agent/vnext/sessionWorkspace/canvasMotifs.js';
import { compileChart } from '../../src/agent/vnext/sessionWorkspace/canvasCharts.js';
import { expandPresetCommands } from '../../src/agent/vnext/sessionWorkspace/canvasPresets.js';
import { applyStoreCommands } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';
import {
  compileSceneToPawCanvas,
  emptyPawCanvas,
  parsePawCanvas
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import {
  TLDRAW_SCHEMA_VERSION,
  TLDRAW_SHAPE_PROP_DEFAULTS,
  missingTldrawShapeProps,
  normalizeTldrawSnapshot
} from '../../src/agent/vnext/sessionWorkspace/tldrawShapeProps.js';
import { getTheme } from '../../src/agent/vnext/sessionWorkspace/themeCatalog.js';

assert.equal(TLDRAW_SCHEMA_VERSION, '5.3.2');
for (const type of ['geo', 'text', 'image', 'frame', 'group', 'note', 'arrow', 'line', 'highlight']) {
  assert.ok(TLDRAW_SHAPE_PROP_DEFAULTS[type], `missing defaults for ${type}`);
}
assert.ok('url' in TLDRAW_SHAPE_PROP_DEFAULTS.geo);
assert.ok('url' in TLDRAW_SHAPE_PROP_DEFAULTS.image);
assert.ok('url' in TLDRAW_SHAPE_PROP_DEFAULTS.note);
assert.ok('color' in TLDRAW_SHAPE_PROP_DEFAULTS.frame);
assert.ok('labelColor' in TLDRAW_SHAPE_PROP_DEFAULTS.geo);
assert.ok('growY' in TLDRAW_SHAPE_PROP_DEFAULTS.geo);
assert.ok('scale' in TLDRAW_SHAPE_PROP_DEFAULTS.geo);
assert.ok('flipX' in TLDRAW_SHAPE_PROP_DEFAULTS.geo);

function storeOf(doc) {
  return doc?.tldraw?.document?.store || {};
}

function shapeRecords(doc) {
  return Object.values(storeOf(doc)).filter((r) => r && r.typeName === 'shape' && r.type);
}

function assertCompleteStore(doc, label) {
  const shapes = shapeRecords(doc);
  assert.ok(shapes.length, `${label}: expected shapes`);
  for (const rec of shapes) {
    const missing = missingTldrawShapeProps(rec.type, rec.props);
    assert.equal(missing.length, 0, `${label} ${rec.id} (${rec.type}) missing ${missing.join(', ')}`);
  }
}

const theme = getTheme('ink-rose');
const box = { x: 40, y: 40, w: 480, h: 280 };

const layout = compileLayoutFrame({
  id: 'slide-1',
  layoutId: 'points',
  themeId: 'ink-rose',
  slots: {
    title: '能力',
    items: [
      { title: '选择', body: 'Paw ON' },
      { title: '描述', body: '说出结果' }
    ]
  }
});
assert.equal(layout.ok, true, layout.error);
assert.ok(layout.frame.nodes.some((n) => n.type === 'geo'), 'layout should emit geo paper/cards');
const layoutDoc = compileSceneToPawCanvas({
  kind: 'deck',
  title: 'Layout',
  themeId: 'ink-rose',
  frames: [layout.frame]
});
assertCompleteStore(layoutDoc, 'layoutCompile');
assert.ok(
  shapeRecords(layoutDoc).some((r) => r.type === 'geo' && r.props.url === ''),
  'layout geo must include url: ""'
);

const motif = compileMotif({
  id: 'browser-window',
  box,
  theme,
  slotName: 'visual',
  nodeId: 'motif'
});
assert.equal(motif.ok, true, motif.error);
assert.ok(motif.nodes.some((n) => n.type === 'geo'));
const motifDoc = compileSceneToPawCanvas({
  kind: 'poster',
  title: 'Motif',
  themeId: 'ink-rose',
  nodes: motif.nodes
});
assertCompleteStore(motifDoc, 'canvasMotifs');

const chart = compileChart({
  type: 'bar',
  data: [
    { value: 3, label: 'A' },
    { value: 8, label: 'B' }
  ],
  box,
  theme,
  slotName: 'visual',
  nodeId: 'chart'
});
assert.equal(chart.ok, true, chart.error);
assert.ok(chart.nodes.some((n) => n.type === 'geo' || n.type === 'line'));
const chartDoc = compileSceneToPawCanvas({
  kind: 'poster',
  title: 'Chart',
  themeId: 'ink-rose',
  nodes: chart.nodes
});
assertCompleteStore(chartDoc, 'canvasCharts');

const scene = createScene({
  op: 'createScene',
  kind: 'deck',
  themeId: 'ink-rose',
  frames: [
    {
      id: 'slide-1',
      layoutId: 'title-visual',
      slots: {
        kicker: 'Chrome',
        title: '在选区上直接交付',
        visual: { kind: 'motif', id: 'device-frame' }
      }
    }
  ]
});
assert.equal(scene.ok, true, scene.error);
assertCompleteStore(scene.canvas, 'createScene');

const blank = emptyPawCanvas({ shell: 'design', title: 'Ops' });
const store = structuredClone(blank.tldraw.document.store);
const created = applyStoreCommands(
  store,
  [
    { op: 'createShape', shapeType: 'geo', id: 'block', box: { x: 12, y: 12, w: 80, h: 40 }, fill: 'red' },
    { op: 'createShape', shapeType: 'text', id: 'label', box: { x: 12, y: 60, w: 160, h: 32 }, text: 'hi' },
    { op: 'createFrame', id: 'extra', w: 200, h: 200, name: 'Extra' }
  ],
  { shell: 'design' }
);
assert.equal(created.ok, true, created.error);
assertCompleteStore({ tldraw: { document: { store } } }, 'canvasOps createShape');

const bubble = expandPresetCommands([{ op: 'createShape', preset: 'speech-bubble', text: 'ok', x: 40, y: 40 }]);
const presetStore = {};
const presetApplied = applyStoreCommands(presetStore, bubble.commands, { shell: 'design' });
assert.equal(presetApplied.ok, true, presetApplied.error);
assertCompleteStore({ tldraw: { document: { store: presetStore } } }, 'canvasPresets');

const incompleteGeo = {
  geo: 'rectangle',
  dash: 'solid',
  w: 120,
  h: 40,
  color: 'black',
  fill: 'solid',
  size: 'm',
  font: 'sans',
  align: 'middle',
  verticalAlign: 'middle',
  richText: { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
};
assert.ok(missingTldrawShapeProps('geo', incompleteGeo).includes('url'));
assert.ok(missingTldrawShapeProps('geo', incompleteGeo).includes('scale'));
assert.ok(missingTldrawShapeProps('geo', incompleteGeo).includes('labelColor'));
assert.ok(missingTldrawShapeProps('geo', incompleteGeo).includes('flipX'));

const legacy = {
  pawCanvas: 1,
  shell: 'design',
  title: 'Legacy',
  tldraw: {
    schema: { schemaVersion: 2, sequences: {} },
    document: {
      schema: { schemaVersion: 2, sequences: {} },
      store: {
        'document:document': { id: 'document:document', typeName: 'document', gridSize: 10, name: '', meta: {} },
        'page:page': { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} },
        'shape:frame': {
          id: 'shape:frame',
          typeName: 'shape',
          type: 'frame',
          x: 80,
          y: 80,
          rotation: 0,
          index: 'a1',
          parentId: 'page:page',
          isLocked: false,
          opacity: 1,
          props: { w: 960, h: 1440, name: 'Board' },
          meta: {}
        },
        'shape:card': {
          id: 'shape:card',
          typeName: 'shape',
          type: 'geo',
          x: 40,
          y: 40,
          rotation: 0,
          index: 'a2',
          parentId: 'shape:frame',
          isLocked: false,
          opacity: 1,
          props: { ...incompleteGeo },
          meta: { pawKind: 'geo' }
        },
        'shape:copy': {
          id: 'shape:copy',
          typeName: 'shape',
          type: 'text',
          x: 40,
          y: 100,
          rotation: 0,
          index: 'a3',
          parentId: 'shape:frame',
          isLocked: false,
          opacity: 1,
          props: {
            color: 'black',
            size: 'm',
            font: 'sans',
            textAlign: 'start',
            autoSize: false,
            w: 200,
            richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
          },
          meta: {}
        }
      }
    }
  }
};

assert.equal(legacy.tldraw.document.store['shape:card'].props.url, undefined);
assert.equal(legacy.tldraw.document.store['shape:frame'].props.color, undefined);
assert.equal(legacy.tldraw.document.store['shape:copy'].props.scale, undefined);

const parsed = parsePawCanvas(JSON.stringify(legacy));
assert.ok(parsed);
assertCompleteStore(parsed, 'parsePawCanvas legacy');
assert.equal(parsed.tldraw.document.store['shape:card'].props.url, '');
assert.equal(parsed.tldraw.document.store['shape:frame'].props.color, 'black');
assert.equal(parsed.tldraw.document.store['shape:copy'].props.scale, 1);

const rawSnap = structuredClone(legacy.tldraw);
assert.equal(rawSnap.document.store['shape:card'].props.url, undefined);
const hydrated = normalizeTldrawSnapshot(rawSnap);
assert.equal(hydrated.document.store['shape:card'].props.url, '');
assert.equal(missingTldrawShapeProps('geo', hydrated.document.store['shape:card'].props).length, 0);

console.log('test_tldraw_shape_props: ok');
