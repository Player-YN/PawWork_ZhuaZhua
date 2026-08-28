import { makeRuntime, assert } from './_fixture.mjs';

/** S-L deleting session does not delete SelectionGroup */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const g = rt.createGroup({ name: 'Shared' });
  rt.addWebItem(g.groupId, { text: 'keep me' });
  rt.bindGroups(sess.sessionId, [g.groupId]);
  rt.deleteSession(sess.sessionId);
  assert(rt.store.has('groups', g.groupId), 'group survives session delete');
  const members = rt.store.get('groupMembers', g.groupId);
  assert(Array.isArray(members) && members.length === 1, 'members survive');
}
