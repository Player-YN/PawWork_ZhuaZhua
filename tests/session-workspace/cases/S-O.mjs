import { makeRuntime, assert } from './_fixture.mjs';

/** S-O released unreachable WebItem gets GC (product auto-GC on remove) */
export async function runCase() {
  const rt = makeRuntime();
  const g = rt.createGroup({ name: 'G' });
  const item = rt.addWebItem(g.groupId, { text: 'x' });
  rt.removeWebItem(g.groupId, item.webItemId);
  // Product path GCs unreachable items on remove — must not leave orphans
  assert(!rt.store.has('items', item.webItemId), 'auto-GC removed unreachable item');
  // Manual GC remains safe / no-op
  const { reclaimed } = rt.gcUnreachableWebItems();
  assert(Array.isArray(reclaimed), 'gc returns list');
  assert(!rt.store.has('items', item.webItemId), 'still gone');
}
