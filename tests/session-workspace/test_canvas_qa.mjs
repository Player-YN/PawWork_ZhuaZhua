/**
 * Deterministic visual-structure QA — fixtures + API contract.
 * Does not import sceneCompile / canvasOps (layout worker owns those).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessCanvasScene,
  CANVAS_QA_VERSION,
  QA_CODES,
  QA_SCORE_DEDUCTIONS,
  QA_THRESHOLDS
} from '../../src/agent/vnext/sessionWorkspace/canvasQa.js';
import { qaGateMode } from '../../src/agent/vnext/sessionWorkspace/canvasQaGate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const visualDir = path.join(here, 'fixtures/visual');
const srcDir = path.join(here, '../../src/agent/vnext/sessionWorkspace');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(visualDir, name), 'utf8'));
}

function codes(result) {
  return result.issues.map((i) => i.code);
}

function hasCode(result, code) {
  return result.issues.some((i) => i.code === code);
}

function hardCodes(result) {
  return result.issues.filter((i) => i.severity === 'hard').map((i) => i.code);
}

const qaSrc = fs.readFileSync(path.join(srcDir, 'canvasQa.js'), 'utf8');
assert.match(qaSrc, /assessCanvasScene/);
assert.doesNotMatch(qaSrc, /from ['"]\.\/sceneCompile/);
assert.doesNotMatch(qaSrc, /from ['"]\.\/canvasOps/);
assert.equal(CANVAS_QA_VERSION, 1);
assert.equal(QA_THRESHOLDS.PAPER_COVERAGE, 0.92);
assert.ok(QA_SCORE_DEDUCTIONS.WIREFRAME > QA_SCORE_DEDUCTIONS.SPARSE);

// 1. Ugly wireframe analogue
const ugly = assessCanvasScene(loadJson('ugly-wireframe.json'));
assert.ok(hasCode(ugly, QA_CODES.WIREFRAME), `expected WIREFRAME, got ${codes(ugly)}`);
assert.ok(hasCode(ugly, QA_CODES.NO_PAPER), `ugly slide must lack paper, got ${codes(ugly)}`);
assert.ok(ugly.score < 50, `ugly score should be low, got ${ugly.score}`);
assert.equal(ugly.ok, false);
assert.ok(ugly.metrics.outlineBoxCount >= 3);
assert.ok(ugly.metrics.outlineMaxIou > 0.12, `outline IoU ${ugly.metrics.outlineMaxIou}`);

// 2. Six named-layout-like scenes — no hard issues
const named = loadJson('named-layouts.json');
assert.equal(named.frames.length, 6);
const professional = assessCanvasScene(named);
assert.deepEqual(
  hardCodes(professional),
  [],
  `named layouts must not raise hard issues: ${JSON.stringify(professional.issues, null, 2)}`
);
assert.equal(professional.ok, true);
assert.ok(professional.score >= 80, `named layouts should score high, got ${professional.score}`);
for (const frame of named.frames) {
  const one = assessCanvasScene({ shell: 'slides', themes: named.themes, frames: [frame] });
  assert.deepEqual(hardCodes(one), [], `${frame.id} hard: ${codes(one)}`);
  assert.equal(hasCode(one, QA_CODES.WIREFRAME), false, `${frame.id} must not be WIREFRAME`);
}

// 3. Legitimate outlined card / two-column layout is not a wireframe
const cards = assessCanvasScene(loadJson('cards-outlined.json'));
assert.equal(hasCode(cards, QA_CODES.WIREFRAME), false, `cards flagged wireframe: ${JSON.stringify(cards.issues)}`);
assert.equal(cards.ok, true);
assert.ok(cards.metrics.outlineBoxCount >= 3);

// 4. Intentional title / quote layouts are not SPARSE
const title = assessCanvasScene({
  shell: 'slides',
  themes: named.themes,
  frames: [named.frames.find((f) => f.id === 'slide-title')]
});
const quote = assessCanvasScene({
  shell: 'slides',
  themes: named.themes,
  frames: [named.frames.find((f) => f.id === 'slide-quote')]
});
assert.equal(hasCode(title, QA_CODES.SPARSE), false, `title marked sparse: ${JSON.stringify(title.issues)}`);
assert.equal(hasCode(quote, QA_CODES.SPARSE), false, `quote marked sparse: ${JSON.stringify(quote.issues)}`);

const section = assessCanvasScene({
  shell: 'slides',
  themes: named.themes,
  frames: [
    {
      id: 'slide-section',
      w: 1920,
      h: 1080,
      layout: 'section',
      meta: { pawLayout: 'section', pawTheme: named.themes[0].id },
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#f7f4ef',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'title',
          type: 'headline',
          text: '第二章',
          box: { x: 80, y: 540, w: 1760, h: 160 },
          size: 'xl',
          color: '#1a1614',
          meta: { pawRole: 'title' }
        }
      ]
    }
  ]
});
const closing = assessCanvasScene({
  shell: 'slides',
  themes: named.themes,
  frames: [
    {
      id: 'slide-closing',
      w: 1920,
      h: 1080,
      layout: 'closing',
      meta: { pawLayout: 'closing', pawTheme: named.themes[0].id },
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#f7f4ef',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'title',
          type: 'headline',
          text: '开始使用',
          box: { x: 160, y: 360, w: 1600, h: 160 },
          size: 'xl',
          color: '#1a1614',
          meta: { pawRole: 'title' }
        }
      ]
    }
  ]
});
assert.equal(hasCode(section, QA_CODES.SPARSE), false, `section marked sparse: ${JSON.stringify(section.issues)}`);
assert.equal(hasCode(closing, QA_CODES.SPARSE), false, `closing marked sparse: ${JSON.stringify(closing.issues)}`);

assert.equal(qaGateMode({ kind: 'deck', op: 'fromRaster', source: 'raster' }), 'strict');
assert.equal(qaGateMode({ kind: 'deck', op: 'fromPage', source: 'page' }), 'strict');
assert.equal(qaGateMode({ kind: 'deck', op: 'fromSelection', source: 'selection' }), 'strict');
assert.equal(qaGateMode({ kind: 'slides', op: 'fromRaster' }), 'strict');
assert.equal(qaGateMode({ kind: 'poster', op: 'fromRaster', source: 'raster' }), 'advisory');
assert.equal(qaGateMode({ kind: 'poster', op: 'fromPage', source: 'page' }), 'advisory');
assert.equal(qaGateMode({ kind: 'poster', op: 'fromSelection', source: 'selection' }), 'advisory');
assert.equal(qaGateMode({ kind: 'poster', hasLayoutId: true }), 'strict');
assert.equal(qaGateMode({ kind: 'poster', source: 'layout' }), 'strict');

const tokenTiny = assessCanvasScene({
  shell: 'slides',
  frames: [
    {
      id: 'slide-token-tiny',
      w: 1920,
      h: 1080,
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#ffffff',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'fine',
          type: 'text',
          text: 'token xs',
          size: 'xs',
          color: '#111111',
          box: { x: 80, y: 80, w: 400, h: 32 }
        }
      ]
    }
  ]
});
assert.ok(hasCode(tokenTiny, QA_CODES.TINY_TEXT), `size xs must map below 16px: ${codes(tokenTiny)}`);

const tokenSafe = assessCanvasScene({
  shell: 'slides',
  frames: [
    {
      id: 'slide-token-s',
      w: 1920,
      h: 1080,
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#ffffff',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'body',
          type: 'text',
          text: 'token s',
          props: { size: 's' },
          color: '#111111',
          box: { x: 80, y: 80, w: 400, h: 40 }
        }
      ]
    }
  ]
});
assert.equal(hasCode(tokenSafe, QA_CODES.TINY_TEXT), false, `tldraw s must not be tiny: ${JSON.stringify(tokenSafe.issues)}`);

// 5. Each issue code from a dedicated fixture
const cases = loadJson('issue-cases.json');
const overflow = assessCanvasScene(cases.overflow);
assert.ok(hasCode(overflow, QA_CODES.OVERFLOW), codes(overflow));
assert.ok(
  overflow.issues.some((i) => i.code === QA_CODES.OVERFLOW && i.severity === 'hard'),
  'severe overflow should be hard'
);

const overlap = assessCanvasScene(cases.overlap);
assert.ok(hasCode(overlap, QA_CODES.OVERLAP), codes(overlap));
assert.ok(
  overlap.issues.some((i) => i.code === QA_CODES.OVERLAP && i.severity === 'hard'),
  'text-vs-text collision should be hard'
);

const contrast = assessCanvasScene(cases.contrast);
assert.ok(hasCode(contrast, QA_CODES.LOW_CONTRAST), 'deliberate low-contrast fixture must still fire');

const tiny = assessCanvasScene(cases.tiny);
assert.ok(hasCode(tiny, QA_CODES.TINY_TEXT), codes(tiny));

const dense = assessCanvasScene(cases.dense);
assert.ok(hasCode(dense, QA_CODES.TOO_DENSE), codes(dense));

const mixed = assessCanvasScene(cases.themes);
assert.ok(hasCode(mixed, QA_CODES.INCONSISTENT_THEME), codes(mixed));
const allowed = assessCanvasScene({ ...cases.themes, allowMixedThemes: true });
assert.equal(hasCode(allowed, QA_CODES.INCONSISTENT_THEME), false);

// 6. Legacy raw nodes: no throw, conservative, paper from full-frame geo
const legacy = assessCanvasScene(loadJson('legacy-raw.json'));
assert.equal(typeof legacy.ok, 'boolean');
assert.equal(typeof legacy.score, 'number');
assert.ok(Array.isArray(legacy.issues));
assert.ok(legacy.metrics.paperCoverage >= QA_THRESHOLDS.PAPER_COVERAGE);
assert.equal(hasCode(legacy, QA_CODES.WIREFRAME), false);

// 7. Determinism — same input, byte-equivalent JSON
const a = JSON.stringify(assessCanvasScene(named));
const b = JSON.stringify(assessCanvasScene(JSON.parse(JSON.stringify(named))));
assert.equal(a, b);
const u1 = JSON.stringify(ugly);
const u2 = JSON.stringify(assessCanvasScene(loadJson('ugly-wireframe.json')));
assert.equal(u1, u2);

// Empty / junk input must stay pure and quiet
const empty = assessCanvasScene({});
assert.equal(empty.ok, true);
assert.equal(empty.score, 100);
assert.deepEqual(empty.issues, []);
assert.doesNotThrow(() => assessCanvasScene(null));
assert.doesNotThrow(() => assessCanvasScene({ frames: [null, { nodes: [undefined, 3] }] }));

assert.ok(legacy.metrics.contentNodeCounts.types);
assert.ok(Number.isFinite(professional.metrics.occupiedMeaningfulRatio));
assert.ok(Number.isFinite(professional.metrics.textCharCount));

const underfilled = assessCanvasScene({
  shell: 'slides',
  frames: [
    {
      id: 'slide-thin',
      w: 1920,
      h: 1080,
      layout: 'compare',
      meta: { pawLayout: 'compare' },
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#f7f4ef',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'title',
          type: 'headline',
          text: '对照',
          size: 's',
          color: '#111111',
          box: { x: 96, y: 96, w: 400, h: 40 },
          meta: { pawSlot: 'title', pawRole: 'title' }
        },
        {
          id: 'body',
          type: 'text',
          text: 'thin copy',
          size: 's',
          color: '#333333',
          box: { x: 96, y: 160, w: 400, h: 32 },
          meta: { pawSlot: 'body', pawRole: 'body' }
        }
      ]
    }
  ]
});
assert.ok(hasCode(underfilled, QA_CODES.UNDERFILLED_LAYOUT), `expected UNDERFILLED, got ${codes(underfilled)}`);
assert.ok(hasCode(underfilled, QA_CODES.WEAK_HIERARCHY), `expected WEAK_HIERARCHY, got ${codes(underfilled)}`);
assert.equal(
  underfilled.issues.find((i) => i.code === QA_CODES.UNDERFILLED_LAYOUT)?.severity,
  'warn'
);

const outlines = assessCanvasScene({
  shell: 'slides',
  frames: [
    {
      id: 'slide-outlines',
      w: 1920,
      h: 1080,
      layout: 'points',
      meta: { pawLayout: 'points' },
      nodes: [
        {
          id: 'paper',
          type: 'geo',
          fillKind: 'solid',
          fill: '#ffffff',
          box: { x: 0, y: 0, w: 1920, h: 1080 },
          meta: { pawRole: 'background' }
        },
        {
          id: 'a',
          type: 'geo',
          fillKind: 'none',
          fill: 'none',
          box: { x: 96, y: 240, w: 520, h: 400 },
          meta: { pawRole: 'card' }
        },
        {
          id: 'b',
          type: 'geo',
          fillKind: 'none',
          fill: 'none',
          box: { x: 700, y: 240, w: 520, h: 400 },
          meta: { pawRole: 'card' }
        },
        {
          id: 'c',
          type: 'geo',
          fillKind: 'none',
          fill: 'none',
          box: { x: 1304, y: 240, w: 520, h: 400 },
          meta: { pawRole: 'card' }
        },
        {
          id: 't',
          type: 'headline',
          text: '要点',
          size: 'xl',
          scale: 1.22,
          color: '#111',
          box: { x: 96, y: 96, w: 800, h: 80 },
          meta: { pawSlot: 'title', pawRole: 'title' }
        }
      ]
    }
  ]
});
assert.ok(hasCode(outlines, QA_CODES.OUTLINE_HEAVY), `expected OUTLINE_HEAVY, got ${codes(outlines)}`);

console.log(
  `canvasQa ok ugly=${ugly.score} named=${professional.score} cards=${cards.score} issues=${professional.issues.length}`
);
