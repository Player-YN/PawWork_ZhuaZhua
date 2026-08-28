/**
 * Univer doc export: live IDocumentData logic in HTML + sidecar, not p/h1 flatten.
 */
import assert from 'node:assert/strict';
import { snapshotToUniverData } from '../../src/agent/vnext/sessionWorkspace/docsApply.js';
import {
  extractDocumentSnapshot,
  htmlForDocumentExport,
  injectDocumentSnapshot,
  isDocumentData,
  normalizeUniverDoc,
  univerDataToExportHtml
} from '../../src/preview/docExport.js';

function run() {
  const data = snapshotToUniverData(
    {
      title: 'Brief',
      blocks: [
        { id: 't', type: 'h1', text: 'Hello' },
        { id: 'p', type: 'p', text: 'Body copy' },
        { id: 'l', type: 'li', list: 'ul', text: 'Item A' },
        { id: 'img', type: 'img', src: 'https://cdn.example/cover.png', text: 'cover' }
      ]
    },
    { id: 'doc-1' }
  );
  assert.equal(isDocumentData(data), true);
  const st = data.body.paragraphs[1].startIndex;
  data.body.textRuns = [{ st: st - 'Body copy'.length, ed: st, ts: { bl: 1 } }];

  const html = htmlForDocumentExport(data, { title: 'Brief' });
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>Item A<\/li>/);
  assert.match(html, /src="https:\/\/cdn\.example\/cover\.png"/);
  assert.match(html, /<strong>Body copy<\/strong>/);
  assert.match(html, /id="paw-document"/);
  assert.doesNotMatch(html, /data-paw-block-type="p"/);

  const snap = extractDocumentSnapshot(html);
  assert.ok(snap);
  assert.equal(snap.id, 'doc-1');
  assert.ok((snap.body.paragraphs || []).some((p) => p.bullet));
  assert.ok(Object.keys(snap.drawings || {}).length >= 1);
  assert.equal(snap.body.textRuns[0].ts.bl, 1);

  const jsonOnly = JSON.stringify(data);
  assert.equal(extractDocumentSnapshot(jsonOnly).id, 'doc-1');

  const brokenTable = normalizeUniverDoc({
    body: { dataStream: `hi\u000F\r\n` }
  }, { id: 'fix-1' });
  assert.equal(brokenTable.id, 'fix-1');
  assert.doesNotMatch(brokenTable.body.dataStream, /\u000F/);
  assert.ok(brokenTable.documentStyle.pageSize.width);
  assert.ok(brokenTable.body.paragraphs.length);
  assert.equal(isDocumentData({ sheets: {}, body: { dataStream: 'x' } }), false);

  const flat = univerDataToExportHtml(data);
  const injected = injectDocumentSnapshot(flat, data);
  assert.ok(extractDocumentSnapshot(injected)?.drawings);

  console.log('test_doc_export: ok');
}

run();
