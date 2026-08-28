import { makeRuntime, assert } from './_fixture.mjs';

/** S-M group mutation visible to future inspect */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const g = rt.createGroup({ name: 'Live' });
  rt.bindGroups(sess.sessionId, [g.groupId]);
  rt.addWebItem(g.groupId, { text: 'one' });
  let counts = [];
  const callModel = async () => {
    // always inspect group
    return {
      text: null,
      toolCalls: [{ toolName: 'inspect', args: { view: 'group', groupId: g.groupId }, toolCallId: 'c1' }]
    };
  };
  // Multi-step ending with text after inspect
  let step = 0;
  const cm = async () => {
    step++;
    if (step % 2 === 1) {
      return {
        text: null,
        toolCalls: [{ toolName: 'inspect', args: { view: 'group', groupId: g.groupId }, toolCallId: `c${step}` }]
      };
    }
    return { text: 'ok', toolCalls: [] };
  };
  const r1 = await rt.sendMessage({ sessionId: sess.sessionId, content: 'look', callModel: cm });
  const n1 = r1.toolCalls.find((t) => t.toolName === 'inspect')?.result?.items?.length;
  assert(n1 === 1, 'first inspect sees 1');
  rt.addWebItem(g.groupId, { text: 'two' });
  step = 0;
  const r2 = await rt.sendMessage({ sessionId: sess.sessionId, content: 'look again', callModel: cm });
  const n2 = r2.toolCalls.find((t) => t.toolName === 'inspect')?.result?.items?.length;
  assert(n2 === 2, 'future inspect sees mutation');
}
