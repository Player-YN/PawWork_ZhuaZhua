import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionTools } from '../src/agent/vnext/sessionWorkspace/tools.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createSessionGuestFs } from '../src/agent/vnext/sessionWorkspace/fs.js';
import { sessionToolToModelOutput } from '../src/agent/vnext/sessionWorkspace/canvasPreview.js';
import { attachToolFailureHint } from '../src/agent/vnext/sessionWorkspace/toolReceipt.js';
import { createPageSnapshotRegistry } from '../src/agent/vnext/host/documentTarget.js';

const SCHEMA_LIMITS = {
  action: 700,
  run: 600,
  sheet: 500,
  doc: 400,
  web: 500,
  acquire: 500,
  inspect: 500,
  clarify: 400,
  task: 400
};

const FORBIDDEN_IN_DESCRIPTION = [
  /Failure codes include/i,
  /\bTAB_LEASED\b/,
  /\bNEED_PAGE\b/,
  /\bFILE_CHOOSER\b/,
  /\bRAW_ESCAPE_DENIED\b/,
  /\bNO_TARGET\b/,
  /\bSYS_MODEL_HINT\b/,
  /setRange \{/,
  /insertRow\/insertCol/
];

function sessionTools() {
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's', { sessionId: 's', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 's', executionId: 'e' });
  return createSessionTools({ store, execution: { executionId: 'e' }, fs, sessionId: 's' });
}

test('each tool description stays a short contract', () => {
  const tools = sessionTools();
  for (const [name, limit] of Object.entries(SCHEMA_LIMITS)) {
    const text = String(tools[name]?.description || '');
    assert.ok(text.length, `${name} has a description`);
    assert.ok(text.length <= limit, `${name} description ${text.length} > ${limit}`);
    for (const re of FORBIDDEN_IN_DESCRIPTION) {
      assert.doesNotMatch(text, re, `${name} description matches ${re}`);
    }
  }
  const codeDesc = String(tools.run.parameters.properties.code.description || '');
  assert.ok(codeDesc.length <= 200, `run.code.description ${codeDesc.length} > 200`);
  assert.match(codeDesc, /inspect view=sys/);
  assert.doesNotMatch(codeDesc, /sys\.tabs\.list/);
  assert.doesNotMatch(codeDesc, /Guest is QuickJS/);
});

test('action method is split; overloaded enum is gone', () => {
  const tools = sessionTools();
  const props = tools.action.parameters.properties;
  assert.equal(props.method, undefined);
  assert.deepEqual(props.uploadMethod.enum, ['auto', 'input', 'drop', 'cdp']);
  assert.deepEqual(props.pointerMethod.enum, ['point', 'cdp']);
  assert.match(props.rev.description, /Required for click, fill, select, press, scroll, fill_form, upload, pointer/);
  assert.deepEqual(tools.action.parameters.required, ['op']);
  assert.deepEqual(tools.acquire.parameters.required, ['action']);
});

test('failed receipts get code error hint; schema does not list the table', () => {
  const tools = sessionTools();
  assert.match(tools.action.description, /Failed calls return \{ok:false, code, error, hint\}/);
  const attached = attachToolFailureHint({ ok: false, code: 'STALE_REF', error: 'rev does not match the latest snapshot' });
  assert.equal(attached.hint, 'action op=snapshot then retry with the new rev');
  const kept = attachToolFailureHint({
    ok: false,
    code: 'BAD_INPUT',
    error: 'unknown sheet op',
    hint: 'legal op: setRange'
  });
  assert.equal(kept.hint, 'legal op: setRange');
  const model = sessionToolToModelOutput({
    output: { ok: false, code: 'NEED_EXPLICIT_TAB', error: 'page action requires an explicit tabId' }
  });
  assert.equal(model.type, 'json');
  assert.equal(model.value.code, 'NEED_EXPLICIT_TAB');
  assert.match(String(model.value.hint), /tabId/);
  assert.equal(sessionToolToModelOutput({ output: { ok: true, rev: 'r1' } }).value.hint, undefined);
});

test('missing mutate rev is BAD_INPUT; wrong rev is STALE_REF', () => {
  const registry = createPageSnapshotRegistry({ token: () => 'rev-a' });
  const snap = registry.capture(11, [{ frameId: 0, documentId: 'd' }]);
  assert.throws(() => registry.require(11, ''), { code: 'BAD_INPUT' });
  assert.throws(() => registry.require(11, undefined), { code: 'BAD_INPUT' });
  assert.throws(() => registry.require(11, 'rev-other'), { code: 'STALE_REF' });
  assert.equal(registry.require(11, snap.rev).rev, 'rev-a');
});
