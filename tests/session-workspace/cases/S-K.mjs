import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-K deleting session deletes its artifacts */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'a',
    callModel: callModelWriteArtifact('gone.md', 'x')
  });
  assert(rt.listArtifacts(sess.sessionId).length === 1, 'precondition');
  rt.deleteSession(sess.sessionId);
  assert(!rt.getSession(sess.sessionId), 'session gone');
  assert(rt.listArtifacts(sess.sessionId).length === 0, 'artifacts gone');
}
