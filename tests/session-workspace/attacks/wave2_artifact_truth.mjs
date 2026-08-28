/**
 * Wave 2 adversarial attacks — artifact truth, package delete, binary round-trip.
 */
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import {
  createArtifact,
  deleteArtifact,
  writePackageFile,
  registerWrittenArtifacts
} from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { validateArtifactBytes } from '../../../src/agent/vnext/sessionWorkspace/artifactValidate.js';

let failed = 0;

function record(name, ok, detail) {
  console.log(`[${ok ? 'BLOCKED/OK' : 'BREACH'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

// Minimal valid PNG (1x1)
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

// Minimal PDF
const PDF = new TextEncoder().encode('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

// Fake office (plain text)
{
  const v = validateArtifactBytes('fake.xlsx', 'plain text not zip');
  record('reject-fake-xlsx', !v.valid, v.error);
}
{
  const v = validateArtifactBytes('fake.png', 'not a png');
  record('reject-fake-png', !v.valid, v.error);
}
{
  const v = validateArtifactBytes('fake.pdf', 'not a pdf');
  record('reject-fake-pdf', !v.valid, v.error);
}

// createArtifact must throw on fake formats
{
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's1', { sessionId: 's1', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 's1', executionId: null });
  fs.mkdirp('/artifacts');
  let threw = false;
  try {
    createArtifact(store, fs, { sessionId: 's1', name: 'evil.xlsx', content: 'plain text' });
  } catch (e) {
    threw = /ARTIFACT_TRUTH|zip/i.test(String(e.message || e));
  }
  record('createArtifact-rejects-fake-xlsx', threw, '');
}

// Real PNG round-trip via product service
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const fs = createSessionGuestFs(svc.runtime.store, { sessionId: 's1', executionId: null });
  fs.mkdirp('/artifacts');
  const art = createArtifact(svc.runtime.store, fs, {
    sessionId: 's1',
    name: 'pixel.png',
    content: PNG,
    mimeType: 'image/png'
  });
  const read = await svc.readArtifact({ sessionId: 's1', artifactId: art.artifactId });
  const back = new Uint8Array(Buffer.from(String(read.base64 || ''), 'base64'));
  const equal =
    back.byteLength === PNG.byteLength && back.every((b, i) => b === PNG[i]);
  record('png-binary-roundtrip', equal, `len=${back.byteLength}`);
}

// PDF round-trip
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const fs = createSessionGuestFs(svc.runtime.store, { sessionId: 's1', executionId: null });
  fs.mkdirp('/artifacts');
  const art = createArtifact(svc.runtime.store, fs, {
    sessionId: 's1',
    name: 'doc.pdf',
    content: PDF,
    mimeType: 'application/pdf'
  });
  const read = await svc.readArtifact({ sessionId: 's1', artifactId: art.artifactId });
  const back = new Uint8Array(Buffer.from(String(read.base64 || ''), 'base64'));
  const equal = back.byteLength === PDF.byteLength && new TextDecoder().decode(back).startsWith('%PDF-');
  record('pdf-binary-roundtrip', equal, `len=${back.byteLength}`);
}

// Package recursive delete
{
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's1', { sessionId: 's1', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 's1', executionId: null });
  fs.mkdirp('/artifacts');
  const art = createArtifact(store, fs, {
    sessionId: 's1',
    name: 'report.html',
    packageDir: 'pkg',
    content: '<html><body>hi</body></html>',
    mimeType: 'text/html'
  });
  writePackageFile(store, fs, {
    sessionId: 's1',
    artifactId: art.artifactId,
    path: '/artifacts/pkg/source.ts',
    content: 'export const x = 1;\n',
    mimeType: 'text/plain'
  });
  const before = fs.list('/artifacts/pkg');
  const del = deleteArtifact(store, fs, 's1', art.artifactId);
  const after = fs.list('/artifacts/pkg');
  const gone = del.deleted && after.length === 0 && before.length >= 2;
  record('package-recursive-delete', gone, `before=${before.length} after=${after.length}`);
}

// Silent reject is a breach: fake bytes under /artifacts must surface, not vanish
{
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's1', { sessionId: 's1', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 's1', executionId: null });
  fs.mkdirp('/artifacts');
  fs.writeFile('/artifacts/evil.png', 'not a png');
  const { created, rejected } = registerWrittenArtifacts(store, fs, 's1', [
    '/artifacts/evil.png'
  ]);
  const arts = store.keys('artifacts');
  record(
    'register-written-surfaces-fake-png',
    created.length === 0 &&
      rejected.length === 1 &&
      /ARTIFACT_TRUTH|png/i.test(rejected[0]?.error || '') &&
      arts.length === 0,
    `created=${created.length} rejected=${JSON.stringify(rejected)} arts=${arts.length}`
  );
}

console.log(`\nwave2 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE2 PASS: artifact truth attacks defeated');
