/**
 * Wave 4 — abort, orphan scratch sweep, GC on remove.
 */
import {
  SessionWorkspaceStore,
  createDurableSessionWorkspaceStore,
  __resetDurableMemoryBackends
} from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { createArtifact } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { sweepOrphanScratch } from '../../../src/agent/vnext/sessionWorkspace/gc.js';

let failed = 0;
function record(name, ok, detail) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

// Abort must stop work — model hangs until signal aborts
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  let modelCalls = 0;
  let continuedAfterAbort = false;
  const hangModel = async ({ signal }) => {
    modelCalls += 1;
    return await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        if (signal?.aborted) {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        } else {
          continuedAfterAbort = true;
          resolve({ text: 'should-not-finish', toolCalls: [] });
        }
      }, 2000);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  };
  const p = svc.sendMessage({
    sessionId: 's1',
    content: 'long work',
    callModel: hangModel
  });
  // Abort shortly after start
  await new Promise((r) => setTimeout(r, 50));
  const abortRes = await svc.abortTask({ sessionId: 's1' });
  let aborted = false;
  try {
    await p;
  } catch (e) {
    aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || e));
  }
  // Give hang timer a chance to fire if abort failed
  await new Promise((r) => setTimeout(r, 100));
  record(
    'abort-stops-model',
    abortRes.aborted && aborted && !continuedAfterAbort,
    `aborted=${aborted} continued=${continuedAfterAbort} modelCalls=${modelCalls}`
  );
}

// Abort by executionId must work mid-flight (register before await returns)
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s-eid');
  let continuedAfterAbort = false;
  const hangModel = async ({ signal }) =>
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        if (signal?.aborted) {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        } else {
          continuedAfterAbort = true;
          resolve({ text: 'should-not-finish', toolCalls: [] });
        }
      }, 2000);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  const p = svc.sendMessage({
    sessionId: 's-eid',
    content: 'long work',
    callModel: hangModel
  });
  let eid = null;
  for (let i = 0; i < 40 && !eid; i++) {
    await new Promise((r) => setTimeout(r, 25));
    const keys = [...svc._activeByExecution.keys()];
    if (keys.length) eid = keys[0];
  }
  const abortRes = await svc.abortTask({ executionId: eid });
  let aborted = false;
  try {
    await p;
  } catch (e) {
    aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || e));
  }
  await new Promise((r) => setTimeout(r, 80));
  record(
    'abort-by-executionId-during-inflight',
    Boolean(eid) && abortRes.aborted && aborted && !continuedAfterAbort,
    `eid=${eid} aborted=${aborted} continued=${continuedAfterAbort}`
  );
}

// sendMessage hydrates OPFS blobs before tools run (cold start)
{
  const store = new SessionWorkspaceStore();
  let hydrateCalls = 0;
  store.hydrateSessionBlobs = async (sid) => {
    hydrateCalls += 1;
    return { hydrated: 0, sessionId: sid };
  };
  const svc = new SessionWorkspaceService({ store });
  svc.ensureSession('hydrate');
  await svc.sendMessage({
    sessionId: 'hydrate',
    content: 'hi',
    callModel: async () => ({ text: 'ok', toolCalls: [] })
  });
  record('sendMessage-hydrates-session-blobs', hydrateCalls >= 1, `calls=${hydrateCalls}`);
}

// Orphan scratch after crash/reopen
{
  __resetDurableMemoryBackends();
  const dbName = `orphan-${Date.now()}`;
  const store1 = await createDurableSessionWorkspaceStore({ dbName });
  store1.put('sessions', 's1', { sessionId: 's1', messages: [] });
  // Simulate crash mid-execution: write scratch without settle
  store1.put('fsNodes', '/tmp/s1/exec_dead/orphan.txt', {
    path: '/tmp/s1/exec_dead/orphan.txt',
    guestPath: '/scratch/orphan.txt',
    kind: 'file',
    sessionId: 's1',
    executionId: 'exec_dead',
    durable: false
  });
  store1.putBlob('fs:/tmp/s1/exec_dead/orphan.txt', new TextEncoder().encode('ORPHAN'), {
    mimeType: 'text/plain'
  });
  // Durable artifact must survive
  const fsArt = createSessionGuestFs(store1, { sessionId: 's1', executionId: null });
  fsArt.mkdirp('/artifacts');
  createArtifact(store1, fsArt, { sessionId: 's1', name: 'keep.md', content: 'keep-me' });
  await store1.flush();

  const store2 = await createDurableSessionWorkspaceStore({ dbName });
  const orphanNode = store2.get('fsNodes', '/tmp/s1/exec_dead/orphan.txt');
  const orphanBlob = store2.getBlob('fs:/tmp/s1/exec_dead/orphan.txt');
  const arts = store2.keys('artifacts').map((id) => store2.get('artifacts', id));
  const artOk = arts.some((a) => a?.sessionId === 's1');
  record(
    'orphan-scratch-swept-on-open',
    !orphanNode && !orphanBlob && artOk,
    `node=${!!orphanNode} blob=${!!orphanBlob} arts=${arts.length}`
  );
}

// Manual sweep still works
{
  const store = new SessionWorkspaceStore();
  store.put('fsNodes', '/tmp/x/e1/a.txt', {
    path: '/tmp/x/e1/a.txt',
    guestPath: '/scratch/a.txt',
    sessionId: 'x'
  });
  store.putBlob('fs:/tmp/x/e1/a.txt', new Uint8Array([1]));
  const r = sweepOrphanScratch(store);
  record('sweepOrphanScratch-api', r.removedPaths.length >= 1, JSON.stringify(r));
}

// GC on removeWebItem
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const g = svc.runtime.createGroup({ name: 'G' });
  const item = svc.runtime.addWebItem(g.groupId, { text: 'bye' });
  const id = item.webItemId;
  svc.runtime.removeWebItem(g.groupId, id);
  const still = svc.runtime.store.get('items', id);
  record('gc-on-remove-item', !still, `item=${!!still}`);
}

// Delete session cascade
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('gone');
  const fs = createSessionGuestFs(svc.runtime.store, { sessionId: 'gone', executionId: null });
  fs.mkdirp('/artifacts');
  createArtifact(svc.runtime.store, fs, { sessionId: 'gone', name: 'x.md', content: 'x' });
  await svc.sendMessage({
    sessionId: 'gone',
    content: 'hi',
    callModel: async () => ({ text: 'yo', toolCalls: [] })
  });
  await svc.deleteSession({ sessionId: 'gone' });
  // Do not call listArtifacts/ensureSession — that would re-create an empty session.
  const artKeys = svc.runtime.store
    .keys('artifacts')
    .filter((id) => svc.runtime.store.get('artifacts', id)?.sessionId === 'gone');
  const sess = svc.runtime.store.get('sessions', 'gone');
  const msgs = sess?.messages;
  record(
    'delete-session-cascade',
    !sess && artKeys.length === 0,
    `sess=${!!sess} arts=${artKeys.length} msgs=${msgs?.length}`
  );
}

console.log(`\nwave4 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE4 PASS: lifecycle attacks defeated');
