import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { docxBytesToUniverData, looksLikeZipBytes } from '../../src/preview/docxIngest.js';
import { univerDataToSnapshot } from '../../src/agent/vnext/sessionWorkspace/docsApply.js';

function miniDocx(bodyInner) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${bodyInner}</w:body></w:document>`;
  return zipSync({
    'word/document.xml': strToU8(document),
    'word/_rels/document.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    )
  });
}

const zip = miniDocx(`
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Hello 你好</w:t></w:r></w:p>
  <w:p><w:r><w:t>Body copy 正文</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Item A</w:t></w:r></w:p>
`);
assert.equal(looksLikeZipBytes(zip), true);
assert.equal(looksLikeZipBytes(new TextEncoder().encode('Hello 你好')), false);

const data = docxBytesToUniverData(zip, { title: '_11', id: 'doc-zip' });
const snap = univerDataToSnapshot(data);
assert.equal(snap.title, '_11');
assert.ok(snap.blocks.some((b) => b.type === 'h1' && b.text.includes('Hello') && b.text.includes('你好')));
assert.ok(snap.blocks.some((b) => b.type === 'p' && b.text.includes('正文')));
assert.ok(snap.blocks.some((b) => b.type === 'li' && b.text === 'Item A'));
assert.doesNotMatch(JSON.stringify(snap), /PK/);

console.log('test_docx_ingest: ok');
