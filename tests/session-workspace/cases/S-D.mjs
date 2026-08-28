import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-D artifact request → run + durable artifact */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'Create a markdown report of hello world',
    callModel: callModelWriteArtifact('hello.md', '# Hello\nworld')
  });
  assert(res.toolCalls.some((t) => t.toolName === 'run'), 'should run');
  const arts = rt.listArtifacts(sess.sessionId);
  assert(arts.length === 1, 'one artifact');
  assert(arts[0].name.includes('hello') || arts[0].primaryPath.includes('hello'), 'named artifact');
  const fs = rt.guestFs(sess.sessionId, null);
  // guest fs without execution can still read durable artifacts
  const text = fs.readFile(arts[0].primaryPath);
  assert(text.includes('Hello'), 'artifact content durable');
}
