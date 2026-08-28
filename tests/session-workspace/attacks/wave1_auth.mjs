/**
 * Wave 1 adversarial attacks — object authorization.
 * Every attack must FAIL (be denied). Exit 0 only if all attacks blocked.
 */
import {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore
} from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution, settleExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { createArtifact } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';

let failed = 0;
const results = [];

function attack(name, fn) {
  return { name, fn };
}

function record(name, blocked, detail) {
  const status = blocked ? 'BLOCKED' : 'BREACH';
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!blocked) failed += 1;
}

const cases = [
  attack('unbound-group-inspect', async () => {
    const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
    const sess = rt.createSession();
    const g = rt.createGroup({ name: 'Secret' });
    rt.addWebItem(g.groupId, { text: 'SECRET_PAYLOAD' });
    // intentionally NOT bound
    const ex = beginExecution(rt.store, sess.sessionId);
    const fs = createSessionGuestFs(rt.store, { sessionId: sess.sessionId, executionId: ex.executionId });
    const tools = createSessionTools({ store: rt.store, execution: ex, fs, sessionId: sess.sessionId });
    const out = await tools.inspect.execute({ view: 'group', groupId: g.groupId });
    settleExecution(rt.store, ex, 'settled');
    const leaked = out.ok && JSON.stringify(out).includes('SECRET');
    record('unbound-group-inspect', !out.ok && out.code === 'AUTH_DENIED' && !leaked, JSON.stringify(out));
  }),

  attack('unbound-item-inspect', async () => {
    const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
    const sess = rt.createSession();
    const g = rt.createGroup({ name: 'G' });
    const item = rt.addWebItem(g.groupId, { text: 'ITEM_SECRET' });
    const ex = beginExecution(rt.store, sess.sessionId);
    const fs = createSessionGuestFs(rt.store, { sessionId: sess.sessionId, executionId: ex.executionId });
    const tools = createSessionTools({ store: rt.store, execution: ex, fs, sessionId: sess.sessionId });
    const out = await tools.inspect.execute({ view: 'item', itemId: item.webItemId });
    settleExecution(rt.store, ex, 'settled');
    const leaked = out.ok && JSON.stringify(out).includes('ITEM_SECRET');
    record('unbound-item-inspect', !out.ok && out.code === 'AUTH_DENIED' && !leaked, JSON.stringify(out));
  }),

  attack('cross-session-artifact-update', async () => {
    const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
    const a = rt.createSession({ sessionId: 'sessA' });
    const b = rt.createSession({ sessionId: 'sessB' });
    const fsA = createSessionGuestFs(rt.store, { sessionId: a.sessionId, executionId: null });
    fsA.mkdirp('/artifacts');
    const art = createArtifact(rt.store, fsA, {
      sessionId: a.sessionId,
      name: 'owned.md',
      content: 'original-A'
    });
    const exB = beginExecution(rt.store, b.sessionId);
    const fsB = createSessionGuestFs(rt.store, { sessionId: b.sessionId, executionId: exB.executionId });
    const toolsB = createSessionTools({
      store: rt.store,
      execution: exB,
      fs: fsB,
      sessionId: b.sessionId
    });
    const out = await toolsB.run.execute({
      op: 'update_artifact',
      artifactId: art.artifactId,
      content: 'HACKED-BY-B'
    });
    settleExecution(rt.store, exB, 'settled');
    const still = fsA.readFile(art.primaryPath);
    const blocked = !out.ok && still === 'original-A';
    record('cross-session-artifact-update', blocked, `out=${JSON.stringify(out)} still=${still}`);
  }),

  attack('cross-session-artifact-delete', async () => {
    const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
    svc.ensureSession('A');
    svc.ensureSession('B');
    const fsA = createSessionGuestFs(svc.runtime.store, { sessionId: 'A', executionId: null });
    fsA.mkdirp('/artifacts');
    const art = createArtifact(svc.runtime.store, fsA, {
      sessionId: 'A',
      name: 'keep.md',
      content: 'alive'
    });
    let denied = false;
    try {
      await svc.deleteArtifact({ sessionId: 'B', artifactId: art.artifactId });
    } catch {
      denied = true;
    }
    const arts = await svc.listArtifacts({ sessionId: 'A' });
    record(
      'cross-session-artifact-delete',
      denied && arts.length === 1,
      `denied=${denied} artsA=${arts.length}`
    );
  }),

  attack('cross-session-artifact-read', async () => {
    const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
    svc.ensureSession('A');
    svc.ensureSession('B');
    const fsA = createSessionGuestFs(svc.runtime.store, { sessionId: 'A', executionId: null });
    fsA.mkdirp('/artifacts');
    const art = createArtifact(svc.runtime.store, fsA, {
      sessionId: 'A',
      name: 'private.md',
      content: 'TOP_SECRET'
    });
    let denied = false;
    try {
      await svc.readArtifact({ sessionId: 'B', artifactId: art.artifactId });
    } catch {
      denied = true;
    }
    record('cross-session-artifact-read', denied, `denied=${denied}`);
  }),

  attack('cross-session-fs-guest-jail', async () => {
    const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
    const a = rt.createSession({ sessionId: 'fsA' });
    const b = rt.createSession({ sessionId: 'fsB' });
    const fsA = createSessionGuestFs(rt.store, { sessionId: a.sessionId, executionId: null });
    fsA.mkdirp('/artifacts');
    fsA.writeFile('/artifacts/x.md', 'AAA');
    const fsB = createSessionGuestFs(rt.store, { sessionId: b.sessionId, executionId: null });
    let denied = false;
    try {
      // Attempt host-style escape
      fsB.readFile('/session/fsA/artifacts/x.md');
    } catch {
      denied = true;
    }
    // B listing must not see A's guest path content
    let saw = false;
    try {
      const listing = fsB.list('/artifacts');
      saw = listing.some((p) => {
        try {
          return fsB.readFile(p).includes('AAA');
        } catch {
          return false;
        }
      });
    } catch {
      /* ignore */
    }
    record('cross-session-fs-guest-jail', denied && !saw, `denied=${denied} saw=${saw}`);
  })
];

for (const c of cases) {
  try {
    await c.fn();
  } catch (e) {
    record(c.name, false, `throw: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\nwave1 summary: attacks=${cases.length} breaches=${failed}`);
if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log('WAVE1 PASS: all authorization attacks blocked');
}
