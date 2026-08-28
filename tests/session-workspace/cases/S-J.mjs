/**
 * S-J: artifact survives runtime restart via PRODUCT durable store path.
 *
 * Spot-check: create DurableSessionWorkspaceStore → write artifact → flush →
 * NEW store instance same dbName → artifact count 1 (not 0).
 * Does NOT rely on test-only exportSnapshot/importSnapshot handoff.
 */
import { assert, callModelWriteArtifact } from './_fixture.mjs';
import {
  createSessionWorkspaceRuntime,
  createDurableSessionWorkspaceStore,
  __resetDurableMemoryBackends
} from '../../../src/agent/vnext/sessionWorkspace/index.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';

export async function runCase() {
  __resetDurableMemoryBackends();
  const dbName = `pawwork-sj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Instance 1 — product-shaped service
  const store1 = await createDurableSessionWorkspaceStore({ dbName });
  assert(store1.kind === 'durable', 'store must be durable kind');
  const svc1 = await SessionWorkspaceService.create({
    store: store1,
    callModel: callModelWriteArtifact('persist.md', 'after-restart')
  });
  const sess = svc1.ensureSession('sess_restart');
  await svc1.sendMessage({
    sessionId: sess.sessionId,
    content: 'save report',
    callModel: callModelWriteArtifact('persist.md', 'after-restart')
  });
  const arts1 = await svc1.listArtifacts({ sessionId: 'sess_restart' });
  assert(arts1.length === 1, `pre-restart artifact count=${arts1.length}`);
  await store1.flush();

  // Instance 2 — brand new service/store, same dbName (simulates offscreen recreate)
  const store2 = await createDurableSessionWorkspaceStore({ dbName });
  const svc2 = await SessionWorkspaceService.create({ store: store2 });
  const arts2 = await svc2.listArtifacts({ sessionId: 'sess_restart' });
  assert(arts2.length === 1, `post-restart artifact count must be 1 not 0 (got ${arts2.length})`);
  const read = await svc2.readArtifact({
    sessionId: 'sess_restart',
    artifactId: arts2[0].artifactId
  });
  assert(read.content === 'after-restart', 'artifact content restored via product path');

  // Pure memory store must NOT magically recover (contrast)
  const memRt = createSessionWorkspaceRuntime();
  memRt.ensureSession('sess_restart');
  assert(memRt.listArtifacts('sess_restart').length === 0, 'fresh memory store has no artifacts');

  __resetDurableMemoryBackends();
}
