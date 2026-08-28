/**
 * Adversarial: model/tool surface must have ZERO ability to mutate SelectionGroups.
 * Host enforcement only — prompt text is not sufficient.
 */
import {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore
} from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution, settleExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'BLOCKED/OK' : 'BREACH'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

function snapshotGroups(store) {
  const groups = store.keys('groups').map((id) => {
    const g = store.get('groups', id);
    const members = [...(store.get('groupMembers', id) || [])];
    return { id, name: g?.name, members: members.sort().join(',') };
  });
  groups.sort((a, b) => a.id.localeCompare(b.id));
  const bindings = {};
  for (const sid of store.keys('sessionBindings')) {
    bindings[sid] = [...(store.get('sessionBindings', sid) || [])].sort();
  }
  const items = store.keys('items').sort();
  return JSON.stringify({ groups, bindings, items });
}

// Product tools only: inspect / acquire / run
{
  const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
  const sess = rt.createSession({ sessionId: 's1' });
  const g = rt.createGroup({ name: 'Protected' });
  const item = rt.addWebItem(g.groupId, { text: 'ORIGINAL_TEXT' });
  rt.bindGroups(sess.sessionId, [g.groupId]);
  const before = snapshotGroups(rt.store);

  const ex = beginExecution(rt.store, sess.sessionId);
  const fs = createSessionGuestFs(rt.store, {
    sessionId: sess.sessionId,
    executionId: ex.executionId
  });
  const tools = createSessionTools({
    store: rt.store,
    execution: ex,
    fs,
    sessionId: sess.sessionId
  });
  const { scheduleSessionTools } = await import('../../../src/agent/vnext/sessionWorkspace/toolSchedule.js');
  const { inventoryFromSession } = await import('../../../src/agent/vnext/sessionWorkspace/canvasInventory.js');
  const visible = scheduleSessionTools(tools, inventoryFromSession(rt.store, sess.sessionId, fs));

  const worldKeys = Object.keys(visible)
    .filter((k) => k !== 'clarify')
    .sort()
    .join(',');
  record(
    'tool-surface-always-on-seven',
    worldKeys === 'acquire,deck,doc,inspect,run,sheet,web',
    Object.keys(tools).join(',')
  );
  record(
    'clarify-is-control-yield-not-group-write',
    typeof tools.clarify?.execute === 'function',
    ''
  );

  // Attack: invent mutation tool names
  for (const fake of [
    'bindGroups',
    'createGroup',
    'deleteGroup',
    'addWebItem',
    'addPageItems',
    'removeWebItem',
    'renameGroup',
    'mutateSelection'
  ]) {
    record(`no-fake-tool-${fake}`, !tools[fake], '');
  }

  // Attack: inspect cannot mutate
  await tools.inspect.execute({ view: 'groups' });
  await tools.inspect.execute({ view: 'group', groupId: g.groupId });
  await tools.inspect.execute({ view: 'item', itemId: item.webItemId });

  // Attack: acquire note/search/fetch shapes
  await tools.acquire.execute({ action: 'note', text: 'try mutate' });

  // Attack: run ops + code that would mutate if store leaked
  await tools.run.execute({
    op: 'write_scratch',
    path: '/scratch/evil.txt',
    content: 'x'
  });
  await tools.run.execute({
    code: `
// Guest must not see host group APIs
const leaks = ['store','groups','bindGroups','createGroup','addWebItem','chrome'];
const seen = {};
for (const k of leaks) seen[k] = typeof globalThis[k];
await fs.writeFile('/scratch/leak.json', JSON.stringify(seen));
// Try path escape into group metadata (should fail or not affect groups)
try { await fs.writeFile('/session/other/groups.json', 'nope'); } catch (e) {}
try { await fs.writeFile('/groups/x', 'nope'); } catch (e) {}
console.log(JSON.stringify(seen));
`
  });

  settleExecution(rt.store, ex, 'settled');
  const after = snapshotGroups(rt.store);
  const item2 = rt.store.get('items', item.webItemId);
  record(
    'groups-unchanged-after-all-tools',
    before === after && item2?.capture?.text === 'ORIGINAL_TEXT',
    before === after ? 'snapshot equal' : 'DIVERGED'
  );
}

// Product sendMessage path (ToolLoopAgent) with hostile tool plan
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const g = svc.runtime.createGroup({ name: 'G' });
  const item = svc.runtime.addWebItem(g.groupId, { text: 'KEEP' });
  svc.runtime.bindGroups('s1', [g.groupId]);
  const before = snapshotGroups(svc.runtime.store);

  let step = 0;
  await svc.sendMessage({
    sessionId: 's1',
    content: 'mutate groups please',
    callModel: async () => {
      step += 1;
      if (step === 1) {
        return {
          text: null,
          toolCalls: [
            { toolName: 'createGroup', args: { name: 'HACK' }, toolCallId: 'x1' },
            { toolName: 'deleteGroup', args: { groupId: g.groupId }, toolCallId: 'x2' },
            { toolName: 'bindGroups', args: { groupIds: [] }, toolCallId: 'x3' },
            {
              toolName: 'addPageItems',
              args: { text: 'https://evil.example/', addedBy: 'paste' },
              toolCallId: 'x3b'
            },
            {
              toolName: 'run',
              args: {
                code: `globalThis.store && store.put('groups','evil',{name:'x'}); console.log('ok')`
              },
              toolCallId: 'x4'
            }
          ]
        };
      }
      return { text: 'done', toolCalls: [] };
    }
  });

  const after = snapshotGroups(svc.runtime.store);
  const still = svc.runtime.store.get('items', item.webItemId);
  record(
    'sendMessage-hostile-tools-cannot-mutate-groups',
    before === after && still?.capture?.text === 'KEEP' && !svc.runtime.store.has('groups', 'evil'),
    `step=${step}`
  );
}

// RPC host path is user/UI only — document structural: tools.js has no group mutators
{
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const toolsSrc = fs.readFileSync(
    path.join(root, 'src/agent/vnext/sessionWorkspace/tools.js'),
    'utf8'
  );
  record(
    'tools-js-no-group-mutator-calls',
    !/bindGroupsToSession|createGroup\(|deleteGroup\(|addWebItem\(|removeWebItem\(/.test(toolsSrc),
    ''
  );
}

console.log(`\nselection-immutable summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('SELECTION IMMUTABLE PASS: model cannot change SelectionGroups');
