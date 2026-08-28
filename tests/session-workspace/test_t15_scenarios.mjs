/**
 * T15 product scenarios: conversation → discuss → execute → multi-artifact → isolation → restart
 */
import {
  makeRuntime,
  callModelTextOnly,
  callModelWriteArtifact,
  assert
} from './cases/_fixture.mjs';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/runSession.product.js';

const rt = makeRuntime();
const session = rt.createSession({ title: 'product-flow' });

// discuss
await rt.sendMessage({
  sessionId: session.sessionId,
  content: 'What can you do?',
  callModel: callModelTextOnly()
});
assert(rt.listArtifacts(session.sessionId).length === 0, 'discuss no artifacts');

// execute deliverable
await rt.sendMessage({
  sessionId: session.sessionId,
  content: 'Write notes.md',
  callModel: callModelWriteArtifact('notes.md', 'note-1')
});
assert(rt.listArtifacts(session.sessionId).length === 1, 'one artifact');

// second artifact
await rt.sendMessage({
  sessionId: session.sessionId,
  content: 'Write summary.md',
  callModel: callModelWriteArtifact('summary.md', 'sum-1')
});
assert(rt.listArtifacts(session.sessionId).length === 2, 'multi-artifact session');

// isolation
const other = rt.createSession({ title: 'other' });
assert(rt.listArtifacts(other.sessionId).length === 0, 'isolated');

// restart
const snap = rt.exportSnapshot();
const rt2 = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
rt2.importSnapshot(snap);
assert(rt2.listArtifacts(session.sessionId).length === 2, 'restart keeps artifacts');
const fs = rt2.guestFs(session.sessionId, null);
const paths = rt2.listArtifacts(session.sessionId).map((a) => a.primaryPath);
assert(paths.every((p) => fs.exists(p)), 'all artifact files exist after restart');

console.log('T15 SCENARIOS PASS');
