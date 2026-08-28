import { makeRuntime, callModelTextOnly, assert } from './_fixture.mjs';

/** S-A direct question → text only (no tools, no artifacts) */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession({ title: 'qa' });
  let toolsInvoked = 0;
  const callModel = async (args) => {
    if (args.tools?.length) {
      // tools available is OK; we choose not to call them
    }
    return callModelTextOnly()(args);
  };
  // Wrap to detect tool execution via custom — use text only
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'What is HTTP caching?',
    callModel
  });
  assert(res.createdTask === false, 'must not create Task');
  assert(res.finalText && res.finalText.length > 0, 'must produce text');
  assert(res.toolCalls.length === 0, 'must not call tools for pure Q&A');
  assert(rt.listArtifacts(sess.sessionId).length === 0, 'must not create artifacts');
}
