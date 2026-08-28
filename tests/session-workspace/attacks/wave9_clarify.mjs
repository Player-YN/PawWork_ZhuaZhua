/**
 * Control-plane clarify yield: pause, answer, abort, no group mutation,
 * system prompt stays principle-only (no popcard fence).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore,
  buildSessionAgentInstructions,
  normalizeClarifyQuestions,
  answerClarify
} from '../../../src/agent/vnext/runSession.product.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution, settleExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { abortSessionClarifies, pendingClarifyCount } from '../../../src/agent/vnext/sessionWorkspace/clarifyGate.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

{
  const n = normalizeClarifyQuestions({
    question: 'Which layout?',
    options: ['A', { label: 'B', description: 'wide' }]
  });
  record(
    'normalize-shorthand-question',
    n.length === 1 && n[0].question === 'Which layout?' && n[0].options.length === 2,
    JSON.stringify(n)
  );
}

{
  const system = buildSessionAgentInstructions({ sessionId: 's' });
  record('system-has-ask-once-policy', /ask once/i.test(system) && /do not guess/i.test(system), '');
  record('system-has-no-popcard-fence', !system.includes('```popcard'), '');
}

{
  const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
  const sess = rt.createSession({ sessionId: 'cl1' });
  const g = rt.createGroup({ name: 'G' });
  rt.bindGroups(sess.sessionId, [g.groupId]);
  const before = JSON.stringify(rt.store.get('sessionBindings', sess.sessionId));
  const ex = beginExecution(rt.store, sess.sessionId);
  const guest = createSessionGuestFs(rt.store, { sessionId: sess.sessionId, executionId: ex.executionId });
  const tools = createSessionTools({
    store: rt.store,
    execution: ex,
    fs: guest,
    sessionId: sess.sessionId
  });
  let event = null;
  const orig = tools.clarify;
  const wrapped = createSessionTools({
    store: rt.store,
    execution: ex,
    fs: guest,
    sessionId: sess.sessionId,
    onEvent: (ev) => {
      if (ev.type === 'clarify') event = ev;
    }
  });
  const pending = wrapped.clarify.execute({
    question: 'Pick one',
    options: ['Yes', 'No']
  });
  record('clarify-emits-before-wait', !!event?.clarifyId && event.questions?.[0]?.question === 'Pick one', '');
  const ans = answerClarify({
    clarifyId: event.clarifyId,
    answers: { 'Pick one': 'Yes' }
  });
  const out = await pending;
  record('clarify-resolves-with-answers', ans.ok && out.ok && out.answers['Pick one'] === 'Yes', JSON.stringify(out));
  record(
    'clarify-does-not-mutate-groups',
    JSON.stringify(rt.store.get('sessionBindings', sess.sessionId)) === before,
    ''
  );
  settleExecution(rt.store, ex, 'settled');
  void orig;
}

{
  const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
  const sess = rt.createSession({ sessionId: 'cl-abort' });
  const ex = beginExecution(rt.store, sess.sessionId);
  const guest = createSessionGuestFs(rt.store, { sessionId: sess.sessionId, executionId: ex.executionId });
  const tools = createSessionTools({
    store: rt.store,
    execution: ex,
    fs: guest,
    sessionId: sess.sessionId,
    signal: ex.abortSignal
  });
  const pending = tools.clarify.execute({ question: 'Hang?', options: ['A', 'B'] });
  ex._controller.abort();
  let aborted = false;
  try {
    await pending;
  } catch (e) {
    aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || e));
  }
  record('clarify-abort-unblocks', aborted && pendingClarifyCount() === 0, `pending=${pendingClarifyCount()}`);
  abortSessionClarifies();
}

{
  const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
  const sess = rt.createSession({ sessionId: 'cl-loop' });
  let step = 0;
  const callModel = async () => {
    step += 1;
    if (step === 1) {
      return {
        toolCalls: [
          {
            toolName: 'clarify',
            args: { question: 'Which?', options: ['Red', 'Blue'] },
            toolCallId: 'c1'
          }
        ]
      };
    }
    return { text: 'Going with the chosen color.', toolCalls: [] };
  };
  let clarifyEv = null;
  const sendP = rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'Make it pretty',
    callModel,
    onEvent: (ev) => {
      if (ev.type === 'clarify') clarifyEv = ev;
    }
  });
  for (let i = 0; i < 40 && !clarifyEv; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  record('sendMessage-emits-clarify', !!clarifyEv?.clarifyId, '');
  if (clarifyEv?.clarifyId) {
    answerClarify({
      clarifyId: clarifyEv.clarifyId,
      answers: { 'Which?': 'Blue' }
    });
  }
  const res = await sendP;
  record(
    'sendMessage-resumes-after-answer',
    /chosen color/i.test(String(res.finalText || '')) &&
      (res.toolCalls || []).some((t) => t.toolName === 'clarify'),
    String(res.finalText || '')
  );
  const pathEvents = res.assistant?.path || [];
  record(
    'trajectory-records-clarify-yield',
    pathEvents.some((e) => e.type === 'clarify') &&
      pathEvents.some((e) => e.type === 'clarify-done' && e.aborted !== true),
    pathEvents.map((e) => e.type).join(',')
  );
}

{
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
  const i18n = fs.readFileSync(path.join(root, 'src/sidepanel/i18n.js'), 'utf8');
  record(
    'ui-card-vanishes-after-answer',
    /hideClarifyLive/.test(side) && /submitClarifyAnswers/.test(side) && !/pop-card-answered/.test(side.match(/function hideClarifyLive[\s\S]{0,400}/)?.[0] || 'pop-card-answered'),
    ''
  );
  record(
    'ui-always-other',
    /clarifyOther/.test(side) && /pop-card-custom-input/.test(side) && /clarifyOther/.test(i18n),
    ''
  );
  record(
    'ui-clarifying-motion',
    /is-clarifying/.test(side) && /clarifyThreadPulse/.test(css) && /clarify-live-orb/.test(css),
    ''
  );
}

if (failed > 0) {
  console.error(`wave9_clarify failed=${failed}`);
  process.exit(1);
}
console.log('wave9_clarify PASS');
