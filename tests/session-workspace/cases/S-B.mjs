import { makeRuntime, callModelTextOnly, assert } from './_fixture.mjs';

/** S-B selected context unrelated → no inspect (model chooses; we verify path allows text-only with bindings) */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const g = rt.createGroup({ name: 'Big' });
  for (let i = 0; i < 20; i++) {
    rt.addWebItem(g.groupId, { text: `item ${i}`, kindHint: 'text' });
  }
  rt.bindGroups(sess.sessionId, [g.groupId]);

  let inspectCalled = false;
  const callModel = async (args) => {
    // Even with tools present, answer without inspect
    return { text: 'JS closures capture lexical environment.', toolCalls: [] };
  };
  // Intercept tools by using callModel that never emits tool calls
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'What is a JS closure?',
    callModel
  });
  assert(res.toolCalls.length === 0, 'unrelated Q must not force inspect');
  assert(res.boundGroups?.length === 1, 'ambient groups still bound');
  assert(res.boundGroups[0].itemCount === 20, 'compact count only');
  // Initial system prompt must not embed all 20 item bodies
  assert(!String(res.systemPromptPreview || '').includes('item 19'), 'must not dump all items into system preview');
}
