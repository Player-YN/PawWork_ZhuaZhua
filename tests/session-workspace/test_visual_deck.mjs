/**
 * Playwright visual capture of the real tldraw harness.
 * Requires `npm run playwright:install`. Not part of baseline unit tests.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSemanticDeck, QA_DECK_DIR } from './harness/seed_semantic_deck.mjs';
import { captureSemanticDeck } from './harness/capture_semantic_deck.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
void root;

const seeded = await seedSemanticDeck();
assert.ok(seeded.artifactId);
const captured = await captureSemanticDeck();
assert.equal(captured.mounted, true);
assert.equal((captured.consoleErrors || []).length, 0, String(captured.consoleErrors));
assert.ok(captured.overview?.boxes?.length >= 7);
assert.equal(captured.overview?.spreadFrames, false);
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'overview.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'overview-v2.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'overview-before-reorder.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'overview-after-reorder.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'overview-after-edits.png')));
assert.equal(captured.reorder?.after?.length, 7);
assert.equal(captured.reorder?.after?.[5]?.id, 'shape:slide-2');
assert.deepEqual(
  [...(captured.reorder?.before || [])].map((f) => f.id).sort(),
  [...(captured.reorder?.after || [])].map((f) => f.id).sort()
);
assert.equal(captured.reorder?.state?.frameId, 'shape:slide-2');
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'slide-4-before.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'slide-4-after.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'slide-4-v2-before.png')));
assert.ok(fs.existsSync(path.join(QA_DECK_DIR, 'slide-4-v2-after.png')));
for (const id of ['slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5', 'slide-6', 'slide-7']) {
  assert.ok(fs.existsSync(path.join(QA_DECK_DIR, `frame-v2-${id}.png`)), `missing frame-v2-${id}.png`);
}
assert.notEqual(captured.afterName, '一次会话里的五件事');
if (captured.overview?.license) {
  assert.equal(typeof captured.overview.license.productionReady, 'boolean');
}

console.log('test_visual_deck: ok');
