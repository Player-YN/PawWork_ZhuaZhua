import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';

/** S-G cross-session FS read denied */
export async function runCase() {
  const rt = makeRuntime();
  const a = rt.createSession();
  const b = rt.createSession();
  await rt.sendMessage({
    sessionId: a.sessionId,
    content: 'file',
    callModel: callModelWriteArtifact('x.md', 'private')
  });
  const fsB = rt.guestFs(b.sessionId, null);
  let denied = false;
  try {
    fsB.readFile('/sessions/' + a.sessionId + '/artifacts/x.md');
  } catch (e) {
    denied = /FS_DENIED|not allowed/i.test(String(e.message || e));
  }
  assert(denied, 'cross-session path must be denied');
  // Also deny reading other session via host-like path
  denied = false;
  try {
    fsB.readFile('/artifacts/../../../session/' + a.sessionId + '/artifacts/x');
  } catch (e) {
    denied = true;
  }
  assert(denied, 'path traversal must fail');
}
