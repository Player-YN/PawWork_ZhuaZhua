import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-F new session has isolated workspace */
export async function runCase() {
  const rt = makeRuntime();
  const a = rt.createSession({ title: 'A' });
  const b = rt.createSession({ title: 'B' });
  await rt.sendMessage({
    sessionId: a.sessionId,
    content: 'make file',
    callModel: callModelWriteArtifact('only-a.md', 'secret-a')
  });
  assert(rt.listArtifacts(a.sessionId).length === 1, 'A has artifact');
  assert(rt.listArtifacts(b.sessionId).length === 0, 'B starts empty');
}
