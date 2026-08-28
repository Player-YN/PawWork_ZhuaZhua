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
  BEHAVIOR_TRAJECTORY_SCHEMA
} from '../../src/agent/vnext/sessionWorkspace/behaviorPath.js';

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

console.log('test_trajectory_granularity: ok');
