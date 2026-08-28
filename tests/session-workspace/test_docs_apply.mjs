import assert from 'node:assert/strict';
import {
  applyDocCommands,
  DOC_OPS,
  emptyDocSnapshot,
  overviewFromDocSnapshot,
  parseDocSnapshot,
  serializeDocHtml,
  snapshotToUniverData,
  univerDataToSnapshot
} from '../../src/agent/vnext/sessionWorkspace/docsApply.js';

function run() {
  assert.ok(DOC_OPS.includes('createDocument'));
  assert.ok(DOC_OPS.includes('insertList'));

  const created = applyDocCommands(emptyDocSnapshot(), [
    { op: 'createDocument', title: 'Report' },
    { op: 'setText', text: 'Hello body' },
    { op: 'insertImage', src: 'https://example.com/a.png' }
  ]);
  assert.equal(created.ok, true);
  assert.equal(created.snapshot.title, 'Report');
  assert.equal(created.snapshot.blocks.length, 2);
  assert.equal(created.snapshot.blocks[0].type, 'p');
  assert.equal(created.snapshot.blocks[0].text, 'Hello body');
  assert.equal(created.snapshot.blocks[1].type, 'img');
  assert.equal(created.snapshot.blocks[1].src, 'https://example.com/a.png');
  assert.equal(created.applied.length, 3);

  const html = serializeDocHtml(created.snapshot);
  assert.match(html, /data-pawwork-preview="blocks"/);
  assert.match(html, /name="pawwork-preview"/);
  assert.match(html, /data-paw-block-type="p"/);
  assert.match(html, /Hello body/);
  assert.match(html, /src="https:\/\/example.com\/a\.png"/);

  const round = parseDocSnapshot(html);
  assert.equal(round.title, 'Report');
  assert.equal(round.blocks.length, 2);
  assert.equal(round.blocks[0].type, 'p');
  assert.equal(round.blocks[0].text, 'Hello body');
  assert.equal(round.blocks[1].type, 'img');
  assert.equal(round.blocks[1].src, 'https://example.com/a.png');

  const jsonRound = parseDocSnapshot(JSON.stringify(created.snapshot));
  assert.equal(jsonRound.blocks[1].src, 'https://example.com/a.png');

  const para = applyDocCommands(created.snapshot, [
    { op: 'insertParagraph', text: 'Second', heading: true }
  ]);
  assert.equal(para.snapshot.blocks[2].type, 'h1');
  assert.equal(para.snapshot.blocks[2].text, 'Second');

  const data = snapshotToUniverData(created.snapshot, { id: 'unit-doc' });
  assert.equal(data.id, 'unit-doc');
  assert.match(data.body.dataStream, /Hello body/);
  assert.doesNotMatch(data.body.dataStream, /!\[image\]\(/);
  assert.ok(Object.keys(data.drawings || {}).length >= 1);
  const fromUniver = univerDataToSnapshot(data);
  assert.equal(fromUniver.blocks[0].text, 'Hello body');
  assert.equal(fromUniver.blocks[1].type, 'img');
  assert.equal(fromUniver.blocks[1].src, 'https://example.com/a.png');

  const missingImg = applyDocCommands(emptyDocSnapshot(), [{ op: 'insertImage' }]);
  assert.equal(missingImg.ok, false);
  assert.match(String(missingImg.error), /url\/src/);

  const skipped = applyDocCommands(emptyDocSnapshot(), [{ op: 'notADocOp', text: 'x' }]);
  assert.equal(skipped.applied.length, 0);
  assert.equal(skipped.ok, true);

  const ov = overviewFromDocSnapshot(created.snapshot, { artifactId: 'a1' });
  assert.equal(ov.blockCount, 2);
  assert.equal(ov.artifactId, 'a1');

  const jsUrl = applyDocCommands(emptyDocSnapshot(), [
    { op: 'insertImage', url: 'javascript:alert(1)' }
  ]);
  assert.equal(jsUrl.ok, false);

  console.log('test_docs_apply: ok');
}

run();
