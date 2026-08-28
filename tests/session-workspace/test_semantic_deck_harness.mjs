/**
 * Node-only semantic deck identity + mount contract (no browser).
 * Pixel capture lives in `npm run test:visual-deck`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSemanticDeck, QA_DECK_DIR } from './harness/seed_semantic_deck.mjs';
import { listEngineNodes, parsePawCanvas } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'tests/session-workspace/harness/semantic-deck.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'tests/session-workspace/harness/semantic-deck.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');

assert.match(html, /design-runtime\.css/);
assert.match(js, /mountDesignCanvas/);
assert.match(js, /design-runtime\.js/);
assert.match(js, /applyPawThemePalette/);
assert.doesNotMatch(js, /spreadFrames:\s*true/);
assert.match(runtime, /export function mountDesignCanvas/);
assert.match(runtime, /maybeMigrateSlideStrip/);
assert.match(runtime, /PAW_TLDRAW_LICENSE_KEY|resolveTldrawLicenseKey/);
assert.match(runtime, /export function applyPawThemePalette/);

const seeded = await seedSemanticDeck();
const identity = JSON.parse(fs.readFileSync(path.join(QA_DECK_DIR, 'identity.json'), 'utf8'));
assert.equal(identity.artifactCountBefore, 1);
assert.equal(identity.artifactCountAfterCreate, 1);
assert.equal(identity.artifactCountAfterReplace, 1);
assert.equal(identity.sameArtifact, true);
assert.equal(identity.artifactId, seeded.artifactId);
assert.equal(identity.frameIdsBefore.length, 7);
assert.equal(identity.frameIdsAfter.length, 7);
assert.deepEqual(identity.frameIdsBefore, identity.frameIdsAfter);
assert.equal(identity.slide4Unchanged, true);
assert.equal(identity.otherFramesUnchanged, true);
assert.ok(identity.createQa?.ok, JSON.stringify(identity.createQa));
assert.ok(identity.replaceQa?.ok, JSON.stringify(identity.replaceQa));
assert.ok(identity.createQa.score >= 90, `create score ${identity.createQa.score}`);

const before = fs.readFileSync(path.join(QA_DECK_DIR, 'deck.json'), 'utf8');
const after = fs.readFileSync(path.join(QA_DECK_DIR, 'deck-after-replace.json'), 'utf8');
const beforeDoc = parsePawCanvas(before);
const afterDoc = parsePawCanvas(after);
assert.equal(beforeDoc.themeId, 'ink-rose');
assert.equal(afterDoc.themeId, 'ink-rose');
const beforeNodes = listEngineNodes(before);
const afterNodes = listEngineNodes(after);
assert.equal(beforeNodes.filter((n) => n.type === 'frame').length, 7);
assert.equal(afterNodes.filter((n) => n.type === 'frame').length, 7);
assert.ok(beforeNodes.some((n) => /在选区上直接交付/.test(n.text || '')));
assert.ok(afterNodes.some((n) => /replacePlate 只改这一页/.test(n.text || '')));
assert.equal(
  afterNodes.filter((n) => n.parentId === 'shape:slide-4').some((n) => /一次会话里的五件事/.test(n.text || '')),
  false
);
assert.ok(beforeNodes.some((n) => n.parentId === 'shape:slide-1' && n.type === 'image'));

const beforeFrames = beforeNodes.filter((n) => n.type === 'frame').sort((a, b) => a.x - b.x);
const afterFrames = afterNodes.filter((n) => n.type === 'frame').sort((a, b) => a.x - b.x);
assert.equal(beforeFrames.length, 7);
for (let i = 1; i < beforeFrames.length; i++) {
  assert.ok(beforeFrames[i].x > beforeFrames[i - 1].x + beforeFrames[i - 1].w);
}
const slide4Before = beforeNodes.find((n) => n.nodeId === 'shape:slide-4');
const slide4After = afterNodes.find((n) => n.nodeId === 'shape:slide-4');
assert.equal(slide4Before.text, '一次会话里的五件事');
assert.equal(slide4After.text, 'replacePlate 只改这一页的孩子，不另开文件。');
assert.equal(slide4After.x, slide4Before.x);
assert.equal(slide4After.y, slide4Before.y);
assert.equal(afterFrames.find((f) => f.nodeId === 'shape:slide-4').x, slide4Before.x);
assert.equal(identity.slide4NameBefore, '一次会话里的五件事');
assert.equal(identity.slide4NameAfter, 'replacePlate 只改这一页的孩子，不另开文件。');

const designHost = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
assert.match(designHost, /pointerdown/);
assert.match(designHost, /commitFilmReorder/);
assert.match(designHost, /is-drop-before|paintFilmDrop/);

console.log('test_semantic_deck_harness: ok');
