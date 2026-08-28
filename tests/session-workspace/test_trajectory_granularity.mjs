/**
 * Agent-run trajectory granularity: turn context + office host events.
 * User canvas edits must not appear on the path.
 */
import assert from 'node:assert/strict';
import {
  recordBehaviorEvent,
  serializeBehaviorTrajectory,
  mergeBehaviorPath,
  compactTurnContext,
  BEHAVIOR_TRAJECTORY_SCHEMA,
  MAX_TURN_THOUGHT_CHARS
} from '../../src/agent/vnext/sessionWorkspace/behaviorPath.js';
import { trajectoryToDownloadJson, redactSecrets } from '../../src/agent/trajectory.js';
import { speakOfficeApplyResult } from '../../src/agent/vnext/sessionWorkspace/officeTools.js';
import { USER_STOP } from '../../src/agent/vnext/host/userStop.js';

const pathLog = [];
recordBehaviorEvent(pathLog, {
  type: 'turn-context',
  tools: ['inspect', 'acquire', 'run', 'clarify', 'sheet', 'deck'],
  canvases: { sheet: ['art_sheet'], deck: ['art_deck'] },
  artifactCount: 2,
  boundGroups: [{ id: 'g1' }],
  boundItemCount: 3,
  mentions: [{ kind: 'skill', id: 'poster', label: 'Poster' }],
  focusPage: { url: 'https://example.com/p', title: 'P' },
  skills: [{ id: 'poster', origin: 'packaged' }],
  activeWorkbook: { artifactId: 'art_sheet', overview: { selections: [{ sheet: 'Sheet1', a1: 'A1' }] } }
});
recordBehaviorEvent(pathLog, { type: 'model-start', modelId: 'm1' });
recordBehaviorEvent(pathLog, {
  type: 'tool-call',
  name: 'sheet',
  toolCallId: 'c1',
  args: {
    act: 'write',
    artifactId: 'art_sheet',
    commands: [{ op: 'setCell', a1: 'B2', sheet: 'Sheet1', value: 'hello' }]
  }
});
recordBehaviorEvent(pathLog, {
  type: 'tool-result',
  name: 'sheet',
  toolCallId: 'c1',
  result: {
    ok: true,
    artifactId: 'art_sheet',
    dirty: 'B2',
    readback: { a1: 'B2', sheet: 'Sheet1', value: 'hello' },
    applied: [{ op: 'setCell', a1: 'B2' }],
    data: { sheets: { huge: 'x'.repeat(8000) } },
    workbook: { id: 'wb', cells: [1, 2, 3] }
  }
});
recordBehaviorEvent(pathLog, { type: 'html_canvas_updated', artifactId: 'art_deck' });
recordBehaviorEvent(pathLog, {
  type: 'artifact_preview',
  artifactId: 'art_deck',
  kind: 'design',
  shell: 'slides',
  name: 'deck.json'
});
recordBehaviorEvent(pathLog, {
  type: 'tool-call',
  name: 'inspect',
  toolCallId: 'c2',
  args: { view: 'skill', skillId: 'poster' }
});
recordBehaviorEvent(pathLog, {
  type: 'tool-result',
  name: 'inspect',
  toolCallId: 'c2',
  result: {
    ok: true,
    view: 'skill',
    skillId: 'poster',
    playbook: '# long playbook\n'.repeat(200),
    resources: []
  }
});
recordBehaviorEvent(pathLog, { type: 'context-usage', promptTokens: 1200, contextWindow: 8000, ratio: 0.15 });
recordBehaviorEvent(pathLog, { type: 'session-title', title: '报价表' });
recordBehaviorEvent(pathLog, { type: 'user_canvas_edit', artifactId: 'art_deck', source: 'preview' });
recordBehaviorEvent(pathLog, { type: 'model-end', modelId: 'm1', finishReason: 'stop' });

const slimmed = mergeBehaviorPath({ path: pathLog });
assert.equal(slimmed[0].type, 'turn-context');
assert.ok(slimmed[0].tools.includes('sheet'));
assert.equal(slimmed[0].canvases.sheet[0], 'art_sheet');
assert.equal(slimmed[0].focusedMentions[0].kind, 'skill');
assert.ok(slimmed.some((e) => e.type === 'host' && e.name === 'canvas_updated' && e.artifactId === 'art_deck' && e.source === 'agent'));
assert.ok(slimmed.some((e) => e.type === 'host' && e.name === 'preview' && e.shell === 'slides'));
assert.ok(slimmed.some((e) => e.type === 'host' && e.name === 'context-usage' && e.promptTokens === 1200));
assert.ok(slimmed.some((e) => e.type === 'host' && e.name === 'session-title' && e.title === '报价表'));
assert.equal(
  slimmed.some((e) => e.type === 'user_canvas_edit' || e.source === 'preview'),
  false,
  'user canvas edits must not enter the agent path'
);

const sheetCall = slimmed.find((e) => e.type === 'tool-call' && e.tool === 'sheet');
assert.equal(sheetCall.surface, 'sheet');
assert.equal(sheetCall.artifactId, 'art_sheet');
assert.equal(sheetCall.act, 'write');
assert.equal(sheetCall.args.commands[0].op, 'setCell');

const sheetRes = slimmed.find((e) => e.type === 'tool-result' && e.tool === 'sheet');
assert.equal(sheetRes.surface, 'sheet');
assert.equal(sheetRes.result.dirty, 'B2');
assert.equal(sheetRes.result.readback.a1, 'B2');
assert.equal(sheetRes.result.data, undefined);
assert.equal(sheetRes.result.workbook, undefined);
const sheetJson = JSON.stringify(sheetRes);
assert.doesNotMatch(sheetJson, /xxxxx/);

const skillRes = slimmed.find((e) => e.type === 'tool-result' && e.tool === 'inspect');
assert.equal(skillRes.surface, 'skill');
assert.equal(skillRes.skillId, 'poster');
assert.equal(skillRes.result.playbook, undefined);
assert.ok(skillRes.result.playbookChars > 100);
assert.ok(Array.isArray(skillRes.result.resources));

const doc = serializeBehaviorTrajectory({
  session: {
    sessionId: 's-traj',
    title: '报价表',
    messages: [
      { role: 'user', content: '改 B2', messageId: 'u1', createdAt: 1 },
      {
        role: 'assistant',
        content: '已改',
        messageId: 'a1',
        createdAt: 2,
        path: pathLog,
        status: 'completed'
      }
    ]
  }
});
assert.equal(doc.schema, BEHAVIOR_TRAJECTORY_SCHEMA);
assert.match(doc.schema, /v3$/);
assert.equal(doc.turns.length, 1);
assert.ok(doc.turns[0].context);
assert.ok(doc.turns[0].context.tools.includes('deck'));
assert.equal(doc.turns[0].context.focusedMentions[0].id, 'poster');
assert.equal(doc.turns[0].context.activeWorkbook.artifactId, 'art_sheet');
assert.equal(
  JSON.stringify(doc).includes('user_canvas_edit'),
  false,
  'export must not contain user canvas edits'
);

const ctx = compactTurnContext({
  tools: ['inspect', 'run'],
  canvases: { sheet: [], deck: [] },
  artifactCount: 0
});
assert.deepEqual(ctx.tools, ['inspect', 'run']);
assert.equal(ctx.canvases, undefined);

// First-class thought + mid-loop text must survive export (not folded away / 8k-smeared).
const narrativePath = [];
recordBehaviorEvent(narrativePath, { type: 'model-start', modelId: 'grok', ts: 10 });
recordBehaviorEvent(narrativePath, { type: 'thought-open', ts: 11 });
recordBehaviorEvent(narrativePath, { type: 'thought', text: 'Parse column D. ', ts: 12 });
recordBehaviorEvent(narrativePath, { type: 'thought', text: 'Need a backup column.', ts: 13 });
recordBehaviorEvent(narrativePath, {
  type: 'text',
  chunk: '我建议把「原始商品串」放在D列之后。',
  ts: 14
});
recordBehaviorEvent(narrativePath, { type: 'text', chunk: '先备份再写回。', ts: 15 });
const longThought = `STEP2 ${'汉'.repeat(12_000)}`;
recordBehaviorEvent(narrativePath, { type: 'thought', text: longThought, ts: 16 });
recordBehaviorEvent(narrativePath, {
  type: 'tool-call',
  name: 'sheet',
  toolCallId: 'write1',
  ts: 17,
  args: {
    act: 'write',
    artifactId: 'art_sheet',
    commands: [
      {
        op: 'setValues2d',
        a1: 'D2',
        sheet: '主表',
        values: Array.from({ length: 80 }, (_, i) => [`row-${i}`, 'x'.repeat(400)])
      }
    ]
  }
});
recordBehaviorEvent(narrativePath, {
  type: 'tool-result',
  name: 'sheet',
  toolCallId: 'write1',
  ts: 18,
  result: { ok: true, artifactId: 'art_sheet', applied: 1 }
});
recordBehaviorEvent(narrativePath, { type: 'model-end', modelId: 'grok', finishReason: 'tool-calls', ts: 19 });

const narrativeTypes = narrativePath.map((e) => e.type);
assert.deepEqual(
  narrativeTypes.filter((t) => t === 'thought' || t === 'text' || t === 'thought-open'),
  ['thought', 'text', 'thought'],
  'consecutive thought/text deltas coalesce; thought-open is ignored'
);
assert.equal(
  narrativePath.find((e) => e.type === 'thought').text,
  'Parse column D. Need a backup column.'
);
assert.equal(
  narrativePath.find((e) => e.type === 'text').text,
  '我建议把「原始商品串」放在D列之后。先备份再写回。'
);
assert.ok(
  narrativePath.some((e) => e.type === 'thought' && e.text === longThought),
  'long thought is stored in full on the path'
);

const narrativeDoc = serializeBehaviorTrajectory({
  session: {
    sessionId: 's-thought',
    title: '整理表格D列',
    messages: [
      { role: 'user', content: '@plan 整理 D 列', messageId: 'u-n', createdAt: 1 },
      {
        role: 'assistant',
        content: '',
        thought: `${'x'.repeat(9_000)}`,
        messageId: 'a-n',
        createdAt: 2,
        path: narrativePath,
        status: 'aborted'
      }
    ]
  }
});
const evs = narrativeDoc.turns[0].events;
const thoughtEvents = evs.filter((e) => e.type === 'thought');
const textEvents = evs.filter((e) => e.type === 'text');
assert.ok(thoughtEvents.length >= 2, 'export keeps first-class thought events');
assert.equal(thoughtEvents[0].text, 'Parse column D. Need a backup column.');
assert.equal(thoughtEvents[1].text, longThought);
assert.ok(!thoughtEvents[1].text.includes('…[+'), 'per-step thought is not clipped at 8k');
assert.equal(textEvents.length, 1, 'export keeps first-class mid-loop text');
assert.equal(textEvents[0].text, '我建议把「原始商品串」放在D列之后。先备份再写回。');
assert.ok(
  evs.some((e) => e.type === 'tool-call' && e.tool === 'sheet'),
  'tool-call stays on the path'
);
const writeCall = evs.find((e) => e.type === 'tool-call' && e.tool === 'sheet');
assert.equal(writeCall.args.commands[0].op, 'setValues2d');
assert.equal(writeCall.args.commands[0].source, 'inline');
assert.equal(writeCall.args.commands[0].values, '[stripped]', 'debugger can tell stripped vs omitted vs path-hydrate');
assert.equal(writeCall.args.commands[0].valuesRows, 80);
assert.equal(writeCall.args.commands[0].valuesCols, 2);
assert.ok(Array.isArray(writeCall.args.commands[0].valuesPreview));
assert.ok(writeCall.args.commands[0].valuesPreview.length <= 12);
assert.equal(
  JSON.stringify(writeCall.args.commands[0]).includes('row-40'),
  false,
  'full setValues2d grid is not persisted'
);
assert.ok(narrativeDoc.summary.thoughts >= 2, 'summary counts thought events');
assert.ok(narrativeDoc.summary.replies >= 1, 'summary counts visible text replies');
const asstBubble = narrativeDoc.messages.find((m) => m.role === 'assistant') || {};
assert.equal(asstBubble.thought, undefined, 'export does not smear CoT onto messages[].thought');
const modelEv = evs.find((e) => e.type === 'model');
assert.equal(modelEv?.thought, undefined, 'export does not copy CoT onto model.thought');

// Path-hydrate vs omitted vs stripped skeletons.
const skeletonPath = [];
recordBehaviorEvent(skeletonPath, {
  type: 'tool-call',
  name: 'sheet',
  toolCallId: 'path1',
  args: {
    act: 'write',
    commands: [{ op: 'setValues2d', a1: 'A1', path: '/scratch/grid.json' }]
  }
});
recordBehaviorEvent(skeletonPath, {
  type: 'tool-call',
  name: 'sheet',
  toolCallId: 'omit1',
  args: {
    act: 'write',
    commands: [{ op: 'setValues2d', a1: 'B1' }]
  }
});
recordBehaviorEvent(skeletonPath, {
  type: 'tool-call',
  name: 'deck',
  toolCallId: 'slots1',
  args: {
    act: 'write',
    commands: [
      {
        op: 'replacePlate',
        plateId: 'p1',
        slots: { title: 'Hello', body: 'x'.repeat(400) }
      }
    ]
  }
});
const skeleton = mergeBehaviorPath({ path: skeletonPath });
const pathCmd = skeleton.find((e) => e.toolCallId === 'path1').args.commands[0];
assert.equal(pathCmd.source, 'path');
assert.equal(pathCmd.path, '/scratch/grid.json');
assert.equal(pathCmd.values, '[path-hydrate]');
const omitCmd = skeleton.find((e) => e.toolCallId === 'omit1').args.commands[0];
assert.equal(omitCmd.values, '[omitted]');
const slotCmd = skeleton.find((e) => e.toolCallId === 'slots1').args.commands[0];
assert.equal(slotCmd.source, 'inline');
assert.equal(slotCmd.slots, '[stripped]');
assert.ok(slotCmd.slotsCount >= 2);

// Fail speak: applied:0 / BAD_INPUT carry hint + skipped (greppable).
const silentZero = speakOfficeApplyResult({ ok: true, applied: 0, artifactId: 'art_sheet' }, [
  { op: 'setValues2d', a1: 'A1' }
]);
assert.equal(silentZero.ok, false);
assert.equal(silentZero.applied, 0);
assert.ok(silentZero.hint);
assert.ok(silentZero.skipped.includes('empty-grid'));
const missingOpSpeak = speakOfficeApplyResult({ ok: true, applied: [] }, [{ a1: 'D2', values: [['x']] }]);
assert.equal(missingOpSpeak.ok, false);
assert.ok(missingOpSpeak.skipped.includes('missing-op'));
assert.match(String(missingOpSpeak.hint), /op/);
const noHydrateSpeak = speakOfficeApplyResult({ ok: true, applied: 0 }, [
  { op: 'setValues2d', a1: 'A1', path: '/scratch/grid.json' }
]);
assert.ok(noHydrateSpeak.skipped.includes('no-hydrate'));

const failSpeakPath = [];
recordBehaviorEvent(failSpeakPath, {
  type: 'tool-result',
  name: 'sheet',
  toolCallId: 'zero1',
  result: silentZero
});
recordBehaviorEvent(failSpeakPath, {
  type: 'tool-result',
  name: 'sheet',
  toolCallId: 'bad1',
  result: {
    ok: false,
    code: 'BAD_INPUT',
    error: 'sheet command is missing op',
    hint: 'each commands[] item needs op (setRange / setFormula / setValues2d / applyGrid / …)',
    applied: 0
  }
});
const failSlim = mergeBehaviorPath({ path: failSpeakPath });
const zeroRes = failSlim.find((e) => e.toolCallId === 'zero1');
assert.equal(zeroRes.result.ok, false);
assert.ok(zeroRes.result.hint);
assert.ok(Array.isArray(zeroRes.result.skipped) && zeroRes.result.skipped.includes('empty-grid'));
const badRes = failSlim.find((e) => e.toolCallId === 'bad1');
assert.equal(badRes.result.code, 'BAD_INPUT');
assert.ok(String(badRes.result.hint || '').includes('op'));

// Lifecycle: plan-pinned + abort appear as first-class path events.
const lifePath = [];
recordBehaviorEvent(lifePath, {
  type: 'clarify-done',
  kind: 'plan',
  approved: false,
  decision: 'revise',
  notes: 'Keep the YAICHI column',
  answers: { decision: 'revise', notes: 'Keep the YAICHI column' },
  ts: 49
});
recordBehaviorEvent(lifePath, {
  type: 'plan-pinned',
  plan: { title: 'Normalize YAICHI', summary: 'Code path', steps: [{ title: 'Snapshot' }, { title: 'Write' }] },
  ts: 50
});
recordBehaviorEvent(lifePath, {
  type: 'tool-call',
  name: 'run',
  toolCallId: 'r1',
  args: { op: 'sheet' },
  ts: 51
});
recordBehaviorEvent(lifePath, {
  type: 'error',
  name: 'AbortError',
  message: USER_STOP,
  code: USER_STOP,
  ts: 52
});
assert.equal(lifePath.some((e) => e.type === 'plan-pinned' && e.plan?.title === 'Normalize YAICHI'), true);
assert.equal(lifePath[lifePath.length - 1].type, 'error');
assert.equal(lifePath[lifePath.length - 1].code, 'user_stop');
const lifeDoc = serializeBehaviorTrajectory({
  session: {
    sessionId: 's-life',
    title: 'abort',
    messages: [
      { role: 'user', content: 'stop', messageId: 'u-l', createdAt: 1 },
      {
        role: 'assistant',
        content: '',
        messageId: 'a-l',
        createdAt: 2,
        path: lifePath,
        status: 'aborted'
      }
    ]
  }
});
const lifeEvs = lifeDoc.turns[0].events;
assert.ok(lifeEvs.some((e) => e.type === 'plan-pinned' && e.plan?.title === 'Normalize YAICHI'));
assert.ok(lifeEvs.some((e) => e.type === 'clarify-done' && e.decision === 'revise' && /YAICHI/.test(e.notes || '')));
assert.ok(lifeEvs.some((e) => e.type === 'error' && e.code === 'user_stop'));

// Download redact must not re-clip first-class thought/text (256k turn cap).
const downloaded = JSON.parse(trajectoryToDownloadJson(narrativeDoc));
const dlThoughts = (downloaded.turns[0].events || []).filter((e) => e.type === 'thought');
const dlTexts = (downloaded.turns[0].events || []).filter((e) => e.type === 'text');
assert.ok(dlThoughts.length >= 2, 'download keeps first-class thought events');
assert.equal(dlThoughts[1].text, longThought);
assert.ok(!String(dlThoughts[1].text).includes('…[+'), 'download does not re-clip thought at 48k');
assert.equal(dlTexts[0].text, '我建议把「原始商品串」放在D列之后。先备份再写回。');
assert.equal(
  downloaded.messages.find((m) => m.role === 'assistant')?.thought,
  undefined,
  'download has no triple CoT smear on messages[].thought'
);
assert.equal(
  (downloaded.turns[0].events || []).find((e) => e.type === 'model')?.thought,
  undefined,
  'download has no model.thought copy'
);
const redactedThought = redactSecrets(
  { type: 'thought', text: longThought },
  { maxString: 48 }
);
assert.equal(redactedThought.text, longThought, 'redactSecrets skips thought/text clip');
assert.ok(MAX_TURN_THOUGHT_CHARS >= 256_000);

console.log('test_trajectory_granularity: ok');
