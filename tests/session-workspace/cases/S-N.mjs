import { makeRuntime, assert } from './_fixture.mjs';
import { isWebItemLeased } from '../../../src/agent/vnext/sessionWorkspace/execution.js';

/** S-N active execution lease protects used WebItem from GC */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const g = rt.createGroup({ name: 'L' });
  const item = rt.addWebItem(g.groupId, { text: 'leased' });
  rt.bindGroups(sess.sessionId, [g.groupId]);

  let midExecutionCheck = false;
  let step = 0;
  const callModel = async () => {
    step++;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [
          {
            toolName: 'inspect',
            args: { view: 'item', itemId: item.webItemId },
            toolCallId: 'c1'
          }
        ]
      };
    }
    // During same execution after inspect, remove from group and try GC
    rt.removeWebItem(g.groupId, item.webItemId);
    const leased = isWebItemLeased(rt.store, item.webItemId);
    midExecutionCheck = leased === true;
    // GC should not reclaim while leased
    rt.gcUnreachableWebItems();
    assert(rt.store.has('items', item.webItemId), 'leased item survives GC mid-execution');
    return { text: 'protected', toolCalls: [] };
  };

  await rt.sendMessage({ sessionId: sess.sessionId, content: 'inspect item', callModel });
  assert(midExecutionCheck, 'lease active mid execution');
  // After settle, leases released — GC can reclaim
  rt.gcUnreachableWebItems();
  assert(!rt.store.has('items', item.webItemId), 'after settle unreachable item GC');
}
