import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionTools } from '../src/agent/vnext/sessionWorkspace/tools.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createSessionGuestFs } from '../src/agent/vnext/sessionWorkspace/fs.js';
import { classifyRisk, needsDispatchTicket } from '../src/agent/vnext/host/riskClassify.js';
import { handleWorkspacePageAction, invalidatePageActionTarget } from '../src/agent/vnext/host/pageActionHost.js';
import { resetTabLeases } from '../src/agent/vnext/host/tabLease.js';
import { actionResultToModelFacts } from '../src/agent/vnext/sessionWorkspace/actionObserve.js';
import { answerApprovalWaiter, waitForApproval } from '../src/agent/vnext/sessionWorkspace/approvalGate.js';
import {
  clampListenSeconds,
  createTabListenRuntime,
  energyFromRms,
  parseListenOp,
  resolveListenStreamId,
  sliceRingChunks
} from '../src/agent/vnext/host/tabListen.js';

function sessionTools(hostPageAction) {
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's', { sessionId: 's', messages: [] });
  const execution = { executionId: 'e' };
  const fs = createSessionGuestFs(store, { sessionId: 's', executionId: 'e' });
  return { tools: createSessionTools({ store, execution, fs, sessionId: 's', hostPageAction }), fs, store };
}

function fixture(opts = {}) {
  resetTabLeases();
  invalidatePageActionTarget(11);
  const state = {
    url: opts.url || 'https://example.com/a',
    streamId: opts.streamId || 'sid-11',
    grantError: opts.grantError || '',
    getCalls: 0
  };
  globalThis.chrome = {
    tabs: {
      get: async (id) => ({ id, url: state.url, title: 'Talk', windowId: 1 })
    },
    webNavigation: {
      getFrame: async () => ({ frameId: 0, documentId: 'doc-a', documentLifecycle: 'active', url: state.url }),
      getAllFrames: async () => [{ frameId: 0, parentFrameId: -1, documentId: 'doc-a', url: state.url }]
    },
    scripting: { executeScript: async () => [] },
    tabCapture: {
      getMediaStreamId: async ({ targetTabId }) => {
        state.getCalls++;
        if (state.grantError) {
          const err = new Error(state.grantError);
          throw err;
        }
        return `${state.streamId}-${targetTabId}`;
      }
    }
  };
  return state;
}

test('action schema adds listen without rewriting the existing essay', () => {
  const { tools } = sessionTools(async () => ({ ok: true }));
  const op = tools.action.parameters.properties.op;
  assert.ok(op.enum.includes('listen'));
  assert.match(op.description, /listen=start\|clip\|stop\|wait/);
  assert.deepEqual(tools.action.parameters.properties.listen.enum, ['start', 'clip', 'stop', 'wait']);
  assert.equal(tools.action.parameters.properties.seconds.type, 'number');
  assert.equal(tools.action.parameters.properties.transcribe.type, 'boolean');
  assert.match(tools.action.description, /pointer/);
  assert.match(tools.action.description, /listen/);
  assert.doesNotMatch(tools.action.description, /listen=start/);
});

test('classify listen is page-read and does not need rev or a ticket', () => {
  const start = classifyRisk({ channel: 'action', op: 'listen', listen: 'start' });
  const clip = classifyRisk({ channel: 'action', op: 'listen', listen: 'clip' });
  assert.equal(start.risk, 'read');
  assert.equal(clip.risk, 'read');
  assert.equal(needsDispatchTicket(start), false);
  assert.equal(start.reason, 'action:listen');
});

test('listen start does not require rev; clip SW path only authorizes', async () => {
  const state = fixture();
  const start = await handleWorkspacePageAction({
    tabId: 11,
    sessionId: 's',
    executionId: 'e',
    op: 'listen',
    listen: 'start'
  });
  assert.equal(start.ok, true);
  assert.equal(start.streamId, 'sid-11-11');
  assert.equal(start.listen, 'start');
  assert.equal(state.getCalls, 1);

  const clip = await handleWorkspacePageAction({
    tabId: 11,
    sessionId: 's',
    executionId: 'e',
    op: 'listen',
    listen: 'clip',
    seconds: 15
  });
  assert.equal(clip.ok, true);
  assert.equal(clip.authorized, true);
  assert.equal(clip.listen, 'clip');
});

test('restricted pages are NEED_PAGE; gesture errors are NEED_CAPTURE_GRANT', async () => {
  fixture({ url: 'chrome://settings' });
  const blocked = await handleWorkspacePageAction({
    tabId: 11, sessionId: 's', executionId: 'e', op: 'listen', listen: 'start'
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'NEED_PAGE');

  const state = fixture({ grantError: 'Extension has not been invoked for the current page (see activeTab permission).' });
  const grant = await handleWorkspacePageAction({
    tabId: 11, sessionId: 's', executionId: 'e', op: 'listen', listen: 'start'
  });
  assert.equal(grant.ok, false);
  assert.equal(grant.code, 'NEED_CAPTURE_GRANT');
  assert.equal(state.getCalls, 1);
});

test('TAB_LEASED applies to listen the same as other action', async () => {
  fixture();
  const first = await handleWorkspacePageAction({
    tabId: 11, sessionId: 's1', executionId: 'e1', op: 'listen', listen: 'start'
  });
  assert.equal(first.ok, true);
  const second = await handleWorkspacePageAction({
    tabId: 11, sessionId: 's2', executionId: 'e2', op: 'listen', listen: 'start'
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'TAB_LEASED');
});

test('clip receipt writes /scratch and does not auto-transcribe', async () => {
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's', { sessionId: 's', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 's', executionId: 'e' });
  let transcribed = 0;
  const runtime = createTabListenRuntime({
    getUserMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [] }),
    MediaRecorder: class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
        this.ondataavailable = null;
      }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; }
    },
    getFs: () => fs,
    loadStt: async () => ({ sttKey: 'gsk_x', sttBaseURL: 'https://api.groq.com/openai/v1', sttModel: 'whisper-large-v3' }),
    transcribeFile: async () => {
      transcribed++;
      return { ok: true, text: 'should not run' };
    },
    now: () => 50_000
  });
  const started = await runtime.start({ streamId: 'sid', tabId: 11, sessionId: 's', executionId: 'e' });
  assert.equal(started.ok, true);
  runtime.pushChunk(new Uint8Array([1, 2, 3, 4]), 0.08, 49_500);
  const clip = await runtime.clip({ seconds: 15 });
  assert.equal(clip.ok, true);
  assert.match(clip.path, /^\/scratch\/listen-.+\.webm$/);
  assert.equal(clip.durationMs, 15000);
  assert.equal(clip.hadSound, true);
  assert.ok(clip.rms >= 0.08);
  assert.equal(clip.text, undefined);
  assert.equal(transcribed, 0);
  assert.equal(fs.readFileBytes(clip.path).byteLength, 4);

  const withText = await runtime.clip({ seconds: 15, transcribe: true });
  assert.equal(withText.ok, true);
  assert.equal(withText.text, 'should not run');
  assert.equal(transcribed, 1);

  const facts = actionResultToModelFacts(clip);
  assert.equal(facts.path, clip.path);
  assert.equal(facts.hadSound, true);
  assert.equal(facts.listen, 'clip');
});

test('resolveListenStreamId uses the sidepanel grant stream id', async () => {
  let prepares = 0;
  const out = await resolveListenStreamId(
    async () => {
      prepares++;
      return { ok: false, code: 'NEED_CAPTURE_GRANT', tabId: 11, title: 'Talk' };
    },
    async () => ({ ok: true, streamId: 'from-click' })
  );
  assert.equal(out.ok, true);
  assert.equal(out.streamId, 'from-click');
  assert.equal(prepares, 1);
});

test('approval waiter passes streamId', async () => {
  const pending = waitForApproval({ approvalId: 'ap_listen', sessionId: 's', executionId: 'e' });
  const ack = answerApprovalWaiter({
    approvalId: 'ap_listen',
    sessionId: 's',
    decision: 'approve',
    streamId: 'sid-from-ui'
  });
  assert.equal(ack.ok, true);
  const answer = await pending;
  assert.equal(answer.decision, 'approve');
  assert.equal(answer.streamId, 'sid-from-ui');
});

test('listen helpers clamp and parse', () => {
  assert.equal(parseListenOp('CLIP'), 'clip');
  assert.equal(parseListenOp('nope'), '');
  assert.equal(clampListenSeconds(90), 60);
  assert.equal(clampListenSeconds(), 15);
  const slice = sliceRingChunks([{ at: 1, bytes: new Uint8Array([1]) }, { at: 20_000, bytes: new Uint8Array([2]) }], 5, 21_000);
  assert.equal(slice.length, 1);
  assert.equal(energyFromRms(0.02).hadSound, true);
  assert.equal(energyFromRms(0.001).hadSound, false);
});
