import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { pageTextByCodePoint } from '../../src/agent/vnext/sessionWorkspace/textPage.js';
import { writeIdeaShellFixture } from './fixtures/ideashell/build.mjs';

const fixture = writeIdeaShellFixture();
assert.ok(fixture.htmlBytes > 32 * 1024, `html ${fixture.htmlBytes}`);
assert.ok(fixture.cssBytes > 100 * 1024, `css ${fixture.cssBytes}`);

const store = new SessionWorkspaceStore();
const runtime = createSessionWorkspaceRuntime(store);
const sessionId = 's-inspect-files';
runtime.createSession({ sessionId });
const execution = beginExecution(store, sessionId, {});
const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
fs.mkdirp('/scratch/ideashell');
fs.writeFile('/scratch/ideashell/index.html', fixture.html);
fs.writeFile('/scratch/ideashell/style.css', fixture.css);
const tools = createSessionTools({ store, execution, fs, sessionId });

const listing = await tools.inspect.execute({ view: 'files', path: '/scratch/ideashell', offset: 0, limit: 1 });
assert.equal(listing.ok, true, listing.error);
assert.equal(listing.listing.length, 1);
assert.equal(listing.offset, 0);
assert.equal(listing.hasMore, true);
const listing2 = await tools.inspect.execute({ view: 'files', path: '/scratch/ideashell', offset: 1, limit: 10 });
assert.ok(listing2.listing.length >= 1);
assert.notEqual(listing.listing[0], listing2.listing[0]);

const html0 = await tools.inspect.execute({
  view: 'files',
  path: '/scratch/ideashell/index.html',
  offset: 0,
  maxChars: 4000
});
assert.equal(html0.ok, true, html0.error);
assert.equal(html0.offset, 0);
assert.equal(html0.eof, false);
assert.ok(html0.nextOffset > 0);
assert.ok(html0.totalChars > 32 * 1024);
assert.equal(html0.unit, 'codePoint');
assert.match(html0.content, /IdeaShell/);
assert.ok(html0.content.length <= 4000);

const html1 = await tools.inspect.execute({
  view: 'files',
  path: '/scratch/ideashell/index.html',
  offset: html0.nextOffset,
  maxChars: 4000
});
assert.equal(html1.offset, html0.nextOffset);
assert.notEqual(html1.content, html0.content);
assert.doesNotMatch(html1.content, /^<!DOCTYPE html>/);
assert.equal(html1.content.slice(0, 40) === html0.content.slice(0, 40), false);

const css0 = await tools.inspect.execute({
  view: 'files',
  path: '/scratch/ideashell/style.css',
  offset: 0,
  maxChars: 8000
});
assert.ok(css0.totalChars > 100 * 1024);
assert.match(css0.content, /\.cards/);
const css1 = await tools.inspect.execute({
  view: 'files',
  path: '/scratch/ideashell/style.css',
  offset: css0.nextOffset,
  maxChars: 8000
});
assert.notEqual(css1.content, css0.content);
assert.equal(css1.offset, css0.nextOffset);

const cjk = '汉字测试😀结尾';
fs.writeFile('/scratch/ideashell/cjk.txt', cjk);
const mid = await tools.inspect.execute({
  view: 'files',
  path: '/scratch/ideashell/cjk.txt',
  offset: 2,
  maxChars: 500
});
assert.equal(mid.content, '测试😀结尾');
assert.equal(mid.totalChars, Array.from(cjk).length);
assert.equal(mid.eof, true);
const page = pageTextByCodePoint(cjk, 2, 500);
assert.equal(page.content, mid.content);

console.log('test_inspect_files: ok');
