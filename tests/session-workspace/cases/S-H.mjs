import { makeRuntime, assert } from './_fixture.mjs';

/** S-H execution scratch removed after settle */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  let scratchPath = null;
  const callModel = async () => {
    // single step: write scratch via run then answer
    return {
      text: null,
      toolCalls: [
        {
          toolName: 'run',
          args: { op: 'write_scratch', path: '/scratch/tmp.txt', content: 'tmp' },
          toolCallId: 'c1'
        }
      ]
    };
  };
  // Need multi-step: first tool, second text
  let step = 0;
  const callModel2 = async () => {
    step++;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [
          {
            toolName: 'run',
            args: { op: 'write_scratch', path: '/scratch/tmp.txt', content: 'tmp' },
            toolCallId: 'c1'
          }
        ]
      };
    }
    return { text: 'done', toolCalls: [] };
  };
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'use scratch',
    callModel: callModel2
  });
  assert(res.executionId, 'had execution');
  // After settle, scratch host nodes gone
  const prefix = `/tmp/${sess.sessionId}/${res.executionId}`;
  const leftover = rt.store.keys('fsNodes').filter((p) => String(p).startsWith(prefix));
  assert(leftover.length === 0, 'scratch cleared after settle');
}
