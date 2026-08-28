/**
 * Execution-end is a terminal settle: host always emits it, and live progress
 * must drop stale host lamps (正在获取文件) even if a tool-result was lost.
 */
import assert from 'node:assert/strict';
import { makeRuntime } from './cases/_fixture.mjs';
import { SessionWorkspaceStore } from '../../src/agent/vnext/runSession.product.js';
import {
  SessionWorkspaceService,
  stripWorkspaceUiEvent
} from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  createLiveProgressState,
  applyLiveProgress
} from '../../src/agent/vnext/sessionWorkspace/liveProgress.js';

function collectTypes(events) {
  return events.map((e) => e?.type).filter(Boolean);
}

{
  const rt = makeRuntime();
  const sess = rt.createSession();
  const events = [];
  const result = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'hello',
    callModel: async () => ({ text: 'done', toolCalls: [] }),
    onEvent: (ev) => events.push(ev)
  });
  const types = collectTypes(events);
  assert.ok(types.includes('assistant-final'), 'success emits assistant-final');
  const end = [...events].reverse().find((e) => e?.type === 'execution-end');
  assert.ok(end, 'success always emits execution-end');
  assert.equal(end.status, 'completed');
  assert.equal(end.executionId, result.executionId);
  const rec = rt.store.get('executions', result.executionId);
  assert.equal(rec?.status, 'settled');
  const last = types[types.length - 1];
  assert.equal(last, 'execution-end', 'execution-end is the terminal event');
}

{
  const rt = makeRuntime();
  const sess = rt.createSession();
  const events = [];
  let caught = false;
  try {
    await rt.sendMessage({
      sessionId: sess.sessionId,
      content: 'boom',
      callModel: async () => {
        throw new Error('model exploded');
      },
      onEvent: (ev) => events.push(ev)
    });
  } catch {
    caught = true;
  }
  assert.equal(caught, true);
  const end = [...events].reverse().find((e) => e?.type === 'execution-end');
  assert.ok(end, 'failed turn still emits execution-end');
  assert.equal(end.status, 'failed');
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s-abort');
  const events = [];
  const hang = async ({ signal }) =>
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve({ text: 'late', toolCalls: [] }), 2000);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  const p = svc.sendMessage({
    sessionId: 's-abort',
    content: 'long',
    callModel: hang,
    onEvent: (ev) => events.push(ev)
  });
  await new Promise((r) => setTimeout(r, 40));
  await svc.abortTask({ sessionId: 's-abort' });
  let aborted = false;
  try {
    await p;
  } catch (e) {
    aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || e));
  }
  assert.equal(aborted, true);
  const end = [...events].reverse().find((e) => e?.type === 'execution-end');
  assert.ok(end, 'abort still emits execution-end');
  assert.equal(end.status, 'aborted');
  const sessAfter = await svc.getSession({ sessionId: 's-abort' });
  const asst = [...(sessAfter.messages || [])].reverse().find((m) => m.role === 'assistant');
  assert.ok(
    (asst?.path || []).some((e) => e?.type === 'error' && e.code === 'user_stop'),
    'abort is a path event before persist (not a green last run)'
  );
}

{
  const leaked = [];
  const onUnhandled = (reason) => {
    leaked.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
    svc.ensureSession('s-abort-tool');
    const events = [];
    let toolStarted = false;
    const fetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        toolStarted = true;
        const stop = () => {
          // Chrome fetch rejects with abort reason (was a bare 'user_stop' string).
          reject(init?.signal?.reason ?? new Error('aborted'));
        };
        if (init?.signal?.aborted) {
          stop();
          return;
        }
        init?.signal?.addEventListener('abort', stop, { once: true });
      });
    let step = 0;
    const p = svc.sendMessage({
      sessionId: 's-abort-tool',
      content: 'fetch then stop',
      fetchImpl,
      callModel: async () => {
        step += 1;
        if (step === 1) {
          return {
            text: null,
            toolCalls: [
              {
                toolName: 'acquire',
                args: { action: 'fetch', url: 'https://example.com/doc' },
                toolCallId: 'c-abort'
              }
            ]
          };
        }
        return { text: 'should-not-finish', toolCalls: [] };
      },
      onEvent: (ev) => events.push(ev)
    });
    for (let i = 0; i < 40 && !toolStarted; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(toolStarted, true, 'acquire fetch started before abort');
    await svc.abortTask({ sessionId: 's-abort-tool' });
    let aborted = false;
    try {
      await p;
    } catch (e) {
      aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || e));
    }
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(aborted, true);
    const end = [...events].reverse().find((e) => e?.type === 'execution-end');
    assert.ok(end, 'abort mid-tool still emits execution-end');
    assert.equal(end.status, 'aborted');
    assert.equal(
      leaked.length,
      0,
      `unhandled rejections: ${leaked
        .map((r) => (r instanceof Error ? r.stack || r.message : String(r)))
        .join(' | ')}`
    );
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

{
  let st = applyLiveProgress(createLiveProgressState(), {
    type: 'tool-call',
    name: 'acquire',
    args: { action: 'fetch', url: 'https://ideashell.com/' }
  });
  assert.equal(st.visible, true);
  assert.match(st.label, /获取文件|Fetching a file/);
  assert.equal(st.pendingTools, 1);
  st = applyLiveProgress(st, { type: 'execution-end', status: 'completed' });
  assert.equal(st.visible, false, 'execution-end hides 正在获取文件');
  assert.equal(st.pendingTools, 0);
  assert.equal(st.label, '');
}

{
  let st = applyLiveProgress(createLiveProgressState(), {
    type: 'tool-call',
    name: 'acquire',
    args: { action: 'fetch' }
  });
  st = applyLiveProgress(st, {
    type: 'tool-result',
    name: 'acquire',
    result: { ok: true, action: 'fetch', preview: '<!DOCTYPE html>'.repeat(500) }
  });
  assert.equal(st.visible, false, 'acquire fetch tool-result clears the lamp');
  st = applyLiveProgress(st, { type: 'assistant-final', content: '已完成复刻。' });
  st = applyLiveProgress(st, { type: 'execution-end', status: 'completed' });
  assert.equal(st.visible, false);
  assert.equal(st.pendingTools, 0);
}

{
  const clipped = stripWorkspaceUiEvent({
    type: 'tool-result',
    name: 'acquire',
    sessionId: 's1',
    result: {
      ok: true,
      action: 'fetch',
      preview: 'X'.repeat(4000)
    }
  });
  assert.equal(clipped.sessionId, 's1');
  assert.ok(String(clipped.result.preview).length < 2000, 'UI event clips nested acquire preview');
  const finalEv = stripWorkspaceUiEvent({
    type: 'assistant-final',
    content: 'Y'.repeat(1200),
    sessionId: 's1'
  });
  assert.equal(finalEv.content.length, 1200, 'assistant-final content is not clipped');
}

console.log('test_execution_settle: ok');
