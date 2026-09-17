import test from 'node:test';
import assert from 'node:assert/strict';

import { SessionWorkspaceService } from '../src/agent/vnext/service/sessionWorkspaceService.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import {
  ARTIFACT_TRUNCATED,
  assertCompleteDownload,
  decodeArtifactBase64,
  fetchCompleteArtifact
} from '../src/agent/vnext/sessionWorkspace/artifactDownload.js';

const BIG = 8 * 1024 * 1024 + 17;

test('8MiB+17 download matches first, last, and length; preview is truncated and refused', async () => {
  const store = new SessionWorkspaceStore();
  const service = new SessionWorkspaceService({ store, memoryJournal: true });
  service.ensureSession('s');
  const bytes = new Uint8Array(BIG);
  bytes[0] = 0x41;
  bytes[100] = 0x22;
  bytes[BIG - 1] = 0x5a;
  const created = await service.createArtifact({
    sessionId: 's',
    name: 'big.bin',
    mimeType: 'application/octet-stream',
    base64: Buffer.from(bytes).toString('base64')
  });
  const artifactId = created.artifact.artifactId;

  const preview = await service.readArtifactPreview({
    sessionId: 's',
    artifactId,
    maxBytes: 64 * 1024
  });
  assert.equal(preview.truncated, true);
  assert.equal(preview.preview, true);
  assert.equal(preview.prefixBytes, 64 * 1024);
  assert.equal(preview.byteLength, BIG);
  assert.throws(
    () => assertCompleteDownload(preview, decodeArtifactBase64(preview.base64)),
    (err) => err.code === ARTIFACT_TRUNCATED
  );

  const viaRead = await service.readArtifact({ sessionId: 's', artifactId, preview: true });
  assert.equal(viaRead.truncated, true);
  assert.throws(
    () => assertCompleteDownload(viaRead, decodeArtifactBase64(viaRead.base64)),
    (err) => err.code === ARTIFACT_TRUNCATED
  );

  const stub = await service.downloadArtifact({ sessionId: 's', artifactId });
  assert.equal(stub.truncated, false);
  assert.equal(stub.complete, true);
  assert.equal(stub.useChunks, true);
  assert.throws(
    () => assertCompleteDownload(stub, decodeArtifactBase64(stub.base64)),
    (err) => err.code === ARTIFACT_TRUNCATED
  );

  const full = await fetchCompleteArtifact((method, params) => service[method](params), {
    sessionId: 's',
    artifactId
  });
  assert.equal(full.bytes.byteLength, BIG);
  assert.equal(full.bytes[0], 0x41);
  assert.equal(full.bytes[100], 0x22);
  assert.equal(full.bytes[BIG - 1], 0x5a);
  assert.equal(full.truncated, false);
  assert.equal(full.complete, true);
});
