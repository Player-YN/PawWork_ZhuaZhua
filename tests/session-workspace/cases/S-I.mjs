import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-I artifact survives execution settle */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'artifact',
    callModel: callModelWriteArtifact('keep.md', 'durable')
  });
  assert(res.executionId, 'execution settled');
  const arts = rt.listArtifacts(sess.sessionId);
  assert(arts.length === 1, 'artifact remains after settle');
  const fs = rt.guestFs(sess.sessionId, null);
  assert(fs.readFile(arts[0].primaryPath) === 'durable', 'bytes remain');
}
