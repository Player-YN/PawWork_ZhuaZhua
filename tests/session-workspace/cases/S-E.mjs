import { makeRuntime, callModelWriteArtifact, callModelUpdateArtifact, assert } from './_fixture.mjs';

/** S-E later turn modifies previous artifact */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'write report',
    callModel: callModelWriteArtifact('note.md', 'v1')
  });
  const arts = rt.listArtifacts(sess.sessionId);
  assert(arts.length === 1, 'artifact exists');
  const id = arts[0].artifactId;
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'update the report',
    callModel: callModelUpdateArtifact(id, 'v2-edited')
  });
  const arts2 = rt.listArtifacts(sess.sessionId);
  assert(arts2.length === 1, 'still one artifact');
  assert(arts2[0].artifactId === id, 'same artifact id');
  const fs = rt.guestFs(sess.sessionId, null);
  assert(fs.readFile(arts2[0].primaryPath) === 'v2-edited', 'content updated in place');
}
