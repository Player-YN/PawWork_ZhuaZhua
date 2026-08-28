import assert from 'node:assert/strict';
import { htmlWritePolicy } from '../../src/agent/vnext/sessionWorkspace/htmlWritePolicy.js';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { emptyPawCanvas } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';

const comic = `<!DOCTYPE html><html><head><style>.x{color:red}</style></head><body><h1>漫画</h1></body></html>`;
assert.equal(htmlWritePolicy(comic, 'paw-comic-book.html').allow, false);
assert.equal(htmlWritePolicy(comic, 'paw-comic-book.html').code, 'USE_CANVAS');

const site = `<!DOCTYPE html><html data-paw-kind="site"><body><h1>Home</h1></body></html>`;
assert.equal(htmlWritePolicy(site, 'home.html').allow, true);
assert.equal(htmlWritePolicy(site, 'home.html').kind, 'site');

const doc = `<html data-paw-kind="document" id="paw-document"><body><p>Hi</p></body></html>`;
assert.equal(htmlWritePolicy(doc, 'note.html').allow, true);

const canvas = JSON.stringify(emptyPawCanvas({ title: 'A' }));
assert.equal(htmlWritePolicy(canvas, 'a.json').allow, false);
assert.equal(htmlWritePolicy(canvas, 'a.json').code, 'USE_CANVAS');
assert.equal(htmlWritePolicy({ ok: true, rows: [1] }, 'data.json').allow, true);

assert.equal(htmlWritePolicy('# hello', 'n.md').allow, true);

async function withTools(id) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId: id });
  const execution = beginExecution(store, id, {});
  const fs = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId: id });
  return { tools, fs, store, sessionId: id };
}

const t = await withTools('s-html-policy');
const blocked = await t.tools.run.execute({
  op: 'write_artifact',
  name: 'pretty.html',
  mimeType: 'text/html',
  content: comic
});
assert.equal(blocked.ok, false);
assert.equal(blocked.code, 'USE_CANVAS');

const allowed = await t.tools.run.execute({
  op: 'write_artifact',
  name: 'home.html',
  mimeType: 'text/html',
  content: site
});
assert.equal(allowed.ok, true, allowed.error);
const stored = t.fs.readFile(allowed.artifact.primaryPath);
assert.match(stored, /data-paw-kind="site"/);
assert.match(stored, /data-paw-node=/);

const scene = await t.tools.run.execute({
  op: 'html',
  name: 'poster.json',
  commands: [{ op: 'createScene', kind: 'poster', title: 'P', nodes: [{ id: 't', type: 'text', text: 'Hi' }] }]
});
assert.equal(scene.ok, true, scene.error);

console.log('test_html_write_policy: ok');
