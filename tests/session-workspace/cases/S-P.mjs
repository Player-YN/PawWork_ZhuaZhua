import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-P storage pressure never auto-deletes artifacts */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'a',
    callModel: callModelWriteArtifact('precious.md', 'keep')
  });
  // Add disposable cache + orphan item
  rt.store.put('meta', 'cache:foo', { big: true });
  const g = rt.createGroup({ name: 'tmp' });
  const orphan = rt.addWebItem(g.groupId, { text: 'o' });
  rt.removeWebItem(g.groupId, orphan.webItemId);

  const result = rt.applyStoragePressure({ level: 'critical' });
  assert(result.artifactsPreserved >= 1, 'artifacts preserved count');
  assert(rt.listArtifacts(sess.sessionId).length === 1, 'artifact still listed');
  const fs = rt.guestFs(sess.sessionId, null);
  assert(fs.readFile(rt.listArtifacts(sess.sessionId)[0].primaryPath) === 'keep', 'bytes intact');
  assert(!rt.store.has('meta', 'cache:foo'), 'cache reclaimed');
}
