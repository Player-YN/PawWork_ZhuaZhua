import { makeRuntime, callModelInspectThenAnswer, assert } from './_fixture.mjs';

/** S-C selected-context question → inspect + answer, no artifact */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const g = rt.createGroup({ name: 'Photos' });
  rt.addWebItem(g.groupId, { text: 'cat photo', src: 'https://example.com/cat.png', kindHint: 'image' });
  rt.bindGroups(sess.sessionId, [g.groupId]);

  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'What is in my selection?',
    callModel: callModelInspectThenAnswer()
  });
  assert(res.toolCalls.some((t) => t.toolName === 'inspect'), 'should inspect');
  assert(res.finalText && res.finalText.length > 0, 'should answer');
  assert(rt.listArtifacts(sess.sessionId).length === 0, 'no artifact required');
}
