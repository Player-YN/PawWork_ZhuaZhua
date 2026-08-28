import { makeRuntime, callModelTextOnly, assert } from './_fixture.mjs';

/** S-R no Task object created per normal message */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const beforeKeys = new Set(rt.store.keys('meta'));
  const res = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'hello',
    callModel: callModelTextOnly()
  });
  assert(res.createdTask === false, 'createdTask flag false');
  // No Task collections exist on SessionWorkspaceStore
  assert(typeof rt.store.tasks === 'undefined', 'no tasks map on store');
  assert(!('taskInputs' in rt.store), 'no taskInputs');
  // Response must not include taskId as workspace owner
  assert(res.taskId == null, 'no taskId');
  assert(res.executionId, 'execution bookkeeping id only');
}
