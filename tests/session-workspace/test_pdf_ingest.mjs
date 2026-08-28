import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  pdfBytesToHtml,
  PDF_RECONSTRUCTION_WARNING,
  bytesForPdfPreview,
  looksLikePdf
} from '../../src/agent/vnext/sessionWorkspace/pdfIngest.js';
import { seedPlatesFromArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifactStage.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(dir, 'fixtures', 'pdf', 'simple.pdf');

function latin1FromBytes(u8) {
  return Buffer.from(u8).toString('latin1');
}

function assertReadableHtml(result, needle) {
  assert.equal(result.ok, true);
  assert.match(result.html, /data-pawwork-preview="blocks"/);
  assert.match(result.html, /data-paw-block/);
  assert.match(result.html, new RegExp(needle));
  const plateText = String(result.html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(plateText, /%PDF-/);
  assert.equal(/\x00|\x01|\x02/.test(plateText), false);
}

function makeFlatePdf(userText) {
  const content = `BT\n/F1 24 Tf\n72 720 Td\n(${userText}) Tj\nET\n`;
  const flate = zlib.deflateSync(Buffer.from(content, 'latin1'));
  const stream = latin1FromBytes(flate);
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${flate.length} /Filter /FlateDecode >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
trailer
<< /Root 1 0 R /Size 6 >>
startxref
0
%%EOF
`;
  return Uint8Array.from(Buffer.from(body, 'latin1'));
}

function makeCjkPdf() {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 52 >>
stream
BT
/F1 24 Tf
72 720 Td
<FEFF4F60597D> Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
  return Uint8Array.from(Buffer.from(body, 'latin1'));
}

async function withNoZlib(fn) {
  const orig = process.getBuiltinModule;
  process.getBuiltinModule = () => null;
  try {
    return await fn();
  } finally {
    process.getBuiltinModule = orig;
  }
}

async function run() {
  const bytes = fs.readFileSync(fixture);
  const result = await pdfBytesToHtml(bytes);
  assertReadableHtml(result, 'PawPdfHello');
  assert.match(result.html, /data-paw-pdf="reconstructed"/);
  assert.match(result.html, /data-paw-slot="t0"/);
  assert.equal(typeof result.warning, 'string');
  assert.match(result.warning, /not original PDF bytes/i);
  assert.equal(result.warning, PDF_RECONSTRUCTION_WARNING);
  assert.doesNotMatch(JSON.stringify(result), /cannot edit PDF/i);

  const garbage = await pdfBytesToHtml(new Uint8Array([0, 1, 2, 3, 255, 0, 9]));
  assert.equal(garbage.ok, true);
  assert.match(garbage.html, /data-paw-block/);
  assert.match(garbage.html, /data-pawwork-preview="blocks"/);
  assert.doesNotMatch(JSON.stringify(garbage), /cannot edit PDF/i);

  const empty = await pdfBytesToHtml(new Uint8Array(0));
  assert.equal(empty.ok, true);
  assert.match(empty.html, /data-paw-block/);

  const flateBytes = makeFlatePdf('PawPdfHello');
  assert.equal(looksLikePdf(flateBytes), true);
  const flate = await withNoZlib(() => pdfBytesToHtml(flateBytes));
  assertReadableHtml(flate, 'PawPdfHello');

  const latin1 = latin1FromBytes(flateBytes);
  const fromLatin1 = await withNoZlib(() => pdfBytesToHtml(latin1));
  assertReadableHtml(fromLatin1, 'PawPdfHello');

  const previewFeed = bytesForPdfPreview({ base64: '', content: latin1 });
  assert.equal(previewFeed.byteLength, flateBytes.byteLength);
  assert.equal(previewFeed[0], 0x25);
  const fromFeed = await withNoZlib(() => pdfBytesToHtml(previewFeed));
  assertReadableHtml(fromFeed, 'PawPdfHello');

  const cjk = await pdfBytesToHtml(makeCjkPdf());
  assertReadableHtml(cjk, '你好');

  const posterPath = 'C:/Users/yyy/Desktop/海报.pdf';
  if (fs.existsSync(posterPath)) {
    const poster = await pdfBytesToHtml(fs.readFileSync(posterPath), { title: '海报' });
    assert.equal(poster.ok, true);
    assert.match(poster.html, /data:image\/jpeg;base64,/);
    assert.match(poster.html, /data-paw-kind="poster"/);
    assert.match(poster.html, /data-paw-slot="cover"/);
    assert.match(poster.warning || '', /not layered|bitmap/i);
    assert.doesNotMatch(poster.html, /ĐÂ|Ã¦|Ã¥/);
  }

  const previewSrc = fs.readFileSync(
    path.join(dir, '../../src/preview/artifactPreview.js'),
    'utf8'
  );
  assert.match(previewSrc, /bytesForPdfPreview/);
  assert.match(previewSrc, /await pdfBytesToHtml/);
  assert.doesNotMatch(previewSrc, /applyHtmlDraftAction/);

  const seeded = seedPlatesFromArtifacts([
    { name: 'simple.html', mimeType: 'text/html', text: result.html }
  ]);
  assert.match(String(seeded.styles || result.html), /--paw-poster-w|--paw-slide-w|--pw-page-w|612px/);
  assert.match(result.html, /data-paw-kind="(poster|deck)"/);
  const plateBlob = JSON.stringify(seeded.plates);
  assert.match(plateBlob, /PawPdfHello/);
  assert.doesNotMatch(
    String(seeded.plates.map((p) => p.text || p.html).join(' ')).replace(/<[^>]+>/g, ' '),
    /%PDF-/
  );

  console.log('test_pdf_ingest: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

