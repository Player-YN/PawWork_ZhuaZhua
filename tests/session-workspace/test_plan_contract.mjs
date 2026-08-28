/**
 * Frozen-plan contract: model judges, host pins, prepareStep re-injects.
 * No host taxonomy of "structural" ops.
 */
import assert from 'node:assert/strict';
import {
  SessionWorkspaceStore,
  createSessionWorkspaceRuntime,
  buildSessionAgentInstructions,
  buildWorldStateBlock,
  createSessionTools,
  makeOfficePrepareStep,
  normalizePlan,
  isPlanApproved,
  classifyPlanDecision,
  userRequestedPlan,
  formatFrozenPlanInstructions,
  pinFrozenPlan,
  unpinFrozenPlan,
  answerClarify,
  recordBehaviorEvent,
  serializeBehaviorTrajectory
} from '../../src/agent/vnext/sessionWorkspace/index.js';
import { beginExecution, settleExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';

const system = buildSessionAgentInstructions({ sessionId: 's-plan' });
assert.match(system, /Judge complexity before you move/);
assert.match(system, /plan is the contract/i);
assert.match(system, /Do not ask whether to enter plan mode/);
assert.match(system, /If the user invoked \/plan/);
assert.match(system, /Do not plan to look diligent/);
assert.match(system, /required changes/i);
assert.doesNotMatch(system, /structural op/i);
assert.doesNotMatch(system, /setValues2d.*plan/i);
assert.doesNotMatch(system, /createWorkbook requires plan/i);

assert.equal(normalizePlan({ title: 'Tidy the sheet', steps: ['Snapshot', 'Transform', 'Write'] })?.steps.length, 3);
assert.equal(normalizePlan({ title: 'Tidy the sheet', steps: ['Snapshot'] })?.steps[0].title, 'Snapshot');
assert.equal(
  normalizePlan({
    title: 'Tidy',
    steps: [{ title: 'Snapshot', detail: 'Read via run, do not retype' }]
  })?.steps[0].detail,
  'Read via run, do not retype'
);
assert.equal(normalizePlan({ title: '', steps: ['A'] }), null);
assert.equal(normalizePlan({ title: 'X', steps: [] }), null);

assert.equal(isPlanApproved({ approved: true }), true);
assert.equal(isPlanApproved({ approved: false }), false);
assert.equal(isPlanApproved({ decision: 'decline' }), false);
assert.equal(isPlanApproved({ decision: 'revise', notes: 'Keep CJK' }), false);
assert.equal(isPlanApproved({ '整理这张表': '批准并开始' }), true);
assert.equal(isPlanApproved({ '整理这张表': '不批准' }), false);
assert.equal(classifyPlanDecision({ approved: true }).kind, 'approved');
assert.equal(classifyPlanDecision({ decision: 'decline' }).kind, 'declined');
assert.equal(classifyPlanDecision({ decision: 'revise', notes: 'Keep CJK' }).kind, 'revise');
assert.equal(classifyPlanDecision({ decision: 'revise', notes: '  ' }).notes, '');
assert.equal(classifyPlanDecision({ decision: 'required_to_change', notes: 'Shorter title' }).kind, 'revise');

assert.equal(userRequestedPlan({ content: '/plan 整理这张表' }), true);
assert.equal(userRequestedPlan({ content: '整理这张表', mentions: [{ kind: 'command', id: 'plan' }] }), true);
assert.equal(userRequestedPlan({ content: '整理这张表' }), false);

const world = buildWorldStateBlock({
  userRequestedPlan: true,
  boundGroups: [],
  boundItems: []
});
assert.match(world, /userRequestedPlan=true/);
assert.match(world, /Present the plan itself/);

const pinned = formatFrozenPlanInstructions({
  title: 'Normalize YAICHI',
  summary: 'Do not retype CJK',
  steps: ['Snapshot via run', 'Transform', 'Write once']
});
assert.match(pinned, /Pinned plan/);
assert.match(pinned, /Do not retype CJK/);
assert.match(pinned, /1\. Snapshot via run/);

const pinnedDetail = formatFrozenPlanInstructions({
  title: 'Normalize YAICHI',
  steps: [{ title: 'Snapshot via run', detail: 'Do not retype CJK into setValues2d' }]
});
assert.match(pinnedDetail, /1\. Snapshot via run/);
assert.match(pinnedDetail, /Do not retype CJK into setValues2d/);

const store = new SessionWorkspaceStore();
const rt = createSessionWorkspaceRuntime(store);
const sess = rt.createSession({ sessionId: 's-plan-pin' });
const ex = beginExecution(store, sess.sessionId);
const fs = createSessionGuestFs(store, { sessionId: sess.sessionId, executionId: ex.executionId });
const tools = createSessionTools({
  store,
  execution: ex,
  fs,
  sessionId: sess.sessionId,
  onEvent: () => {}
});

const plan = { title: 'Normalize YAICHI', summary: 'Code path', steps: ['Snapshot', 'Write'] };
let ev = null;
const pinEvents = [];
const wrapped = createSessionTools({
  store,
  execution: ex,
  fs,
  sessionId: sess.sessionId,
  onEvent: (e) => {
    if (e.type === 'clarify') ev = e;
    if (e.type === 'plan-pinned') pinEvents.push(e);
  }
});
const pending = wrapped.clarify.execute({ plan });
assert.equal(ev?.kind, 'plan');
assert.equal(ev?.plan?.title, 'Normalize YAICHI');
answerClarify({ clarifyId: ev.clarifyId, answers: { approved: true } });
const out = await pending;
assert.equal(out.ok, true);
assert.equal(out.approved, true);
assert.equal(ex.frozenPlan?.title, 'Normalize YAICHI');
assert.equal(pinEvents.length, 1, 'plan approve records plan-pinned');
assert.equal(pinEvents[0].plan?.title, 'Normalize YAICHI');

const prepare = makeOfficePrepareStep({
  execution: ex,
  instructions: 'You are Paw Work.'
});
const step = await prepare();
assert.ok(Array.isArray(step.activeTools) && step.activeTools.includes('clarify'));
assert.match(String(step.instructions || ''), /Pinned plan/);
assert.match(String(step.instructions || ''), /You are Paw Work/);
assert.match(String(step.instructions || ''), /Normalize YAICHI/);

const empty = await makeOfficePrepareStep({ instructions: 'You are Paw Work.' })();
assert.equal(empty.instructions, undefined);

const ex2 = beginExecution(store, sess.sessionId);
const pendingNo = createSessionTools({
  store,
  execution: ex2,
  fs,
  sessionId: sess.sessionId,
  onEvent: (e) => {
    if (e.type === 'clarify') ev = e;
  }
}).clarify.execute({ plan });
answerClarify({ clarifyId: ev.clarifyId, answers: { approved: false } });
const declined = await pendingNo;
assert.equal(declined.approved, false);
assert.equal(ex2.frozenPlan, undefined);

assert.equal(pinFrozenPlan(ex2, plan)?.title, 'Normalize YAICHI');
assert.equal(ex2.frozenPlan.title, 'Normalize YAICHI');
assert.equal(unpinFrozenPlan(ex2)?.title, 'Normalize YAICHI');
assert.equal(ex2.frozenPlan, undefined);

const exEmpty = beginExecution(store, sess.sessionId);
let evEmpty = null;
const emptyPins = [];
const pendingEmpty = createSessionTools({
  store,
  execution: exEmpty,
  fs,
  sessionId: sess.sessionId,
  onEvent: (e) => {
    if (e.type === 'clarify') evEmpty = e;
    if (e.type === 'plan-pinned') emptyPins.push(e);
  }
}).clarify.execute({ plan });
answerClarify({ clarifyId: evEmpty.clarifyId, answers: { decision: 'revise', notes: '   ' } });
const emptyRevise = await pendingEmpty;
assert.equal(emptyRevise.ok, false);
assert.equal(emptyRevise.code, 'BAD_INPUT');
assert.equal(exEmpty.frozenPlan, undefined);
assert.equal(emptyPins.length, 0, 'empty revise notes do not pin');

const revPath = [];
const exRev = beginExecution(store, sess.sessionId);
let evRev = null;
const revPins = [];
const pendingRev = createSessionTools({
  store,
  execution: exRev,
  fs,
  sessionId: sess.sessionId,
  onEvent: (e) => {
    recordBehaviorEvent(revPath, e);
    if (e.type === 'clarify') evRev = e;
    if (e.type === 'plan-pinned') revPins.push(e);
  }
}).clarify.execute({ plan });
answerClarify({
  clarifyId: evRev.clarifyId,
  answers: { decision: 'revise', notes: 'Keep the YAICHI column' }
});
const revised = await pendingRev;
assert.equal(revised.ok, true);
assert.equal(revised.approved, false);
assert.equal(revised.decision, 'revise');
assert.equal(revised.notes, 'Keep the YAICHI column');
assert.equal(exRev.frozenPlan, undefined);
assert.equal(revPins.length, 0, 'revise does not emit plan-pinned');
assert.equal(revPath.filter((e) => e.type === 'plan-pinned').length, 0);
assert.equal(
  revPath.some((e) => e.type === 'clarify-done' && e.decision === 'revise' && /YAICHI/.test(e.notes || '')),
  true
);
const revPrep = await makeOfficePrepareStep({ execution: exRev, instructions: 'You are Paw Work.' })();
assert.equal(revPrep.instructions, undefined, 'revise must not inject a pinned contract');

const pinPath = [];
const exPin = beginExecution(store, sess.sessionId);
let evPin = null;
const pendingPin = createSessionTools({
  store,
  execution: exPin,
  fs,
  sessionId: sess.sessionId,
  onEvent: (e) => {
    recordBehaviorEvent(pinPath, e);
    if (e.type === 'clarify') evPin = e;
  }
}).clarify.execute({ plan });
answerClarify({ clarifyId: evPin.clarifyId, answers: { approved: true } });
const pinnedOut = await pendingPin;
assert.equal(pinnedOut.approved, true);
assert.equal(exPin.frozenPlan?.title, 'Normalize YAICHI');
assert.equal(pinPath.filter((e) => e.type === 'plan-pinned').length, 1);
assert.equal(pinPath.find((e) => e.type === 'plan-pinned')?.plan?.title, 'Normalize YAICHI');

const exportDoc = serializeBehaviorTrajectory({
  session: {
    sessionId: 's-plan-export',
    title: 'plan',
    messages: [
      { role: 'user', content: 'tidy', messageId: 'u-plan', createdAt: 1 },
      {
        role: 'assistant',
        content: '',
        messageId: 'a-plan',
        createdAt: 2,
        path: [...revPath, ...pinPath]
      }
    ]
  }
});
const exportEvs = exportDoc.turns[0].events || [];
assert.equal(
  exportEvs.filter((e) => e.type === 'plan-pinned').length,
  1,
  'export keeps exactly one plan-pinned'
);
assert.equal(exportEvs.find((e) => e.type === 'plan-pinned')?.plan?.title, 'Normalize YAICHI');
assert.ok(
  exportEvs.some((e) => e.type === 'clarify-done' && e.decision === 'revise' && /YAICHI/.test(e.notes || '')),
  'export keeps revise notes'
);

settleExecution(store, ex, 'settled');
settleExecution(store, ex2, 'settled');
settleExecution(store, exEmpty, 'settled');
settleExecution(store, exRev, 'settled');
settleExecution(store, exPin, 'settled');
void tools;

console.log('test_plan_contract PASS');
