import test from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_TOOL_NAMES } from '../src/agent/vnext/sessionWorkspace/canvasInventory.js';
import { makeOfficePrepareStep } from '../src/agent/vnext/sessionWorkspace/toolSchedule.js';
import {
  createCallModelLanguageModel,
  createTaskStopState,
  runSessionToolLoopAgent
} from '../src/agent/vnext/sessionWorkspace/sessionAgent.js';
import {
  createTaskTool,
  guardTaskToolExecutions
} from '../src/agent/vnext/sessionWorkspace/taskTool.js';

function task(overrides = {}) {
  return {
    taskId: 'task_1',
    originalGoal: 'Keep the immutable original goal, including constraint ALPHA.',
    amendments: [],
    plan: { steps: [{ title: 'Open page', status: 'in_progress' }] },
    summary: 'Started',
    evidence: ['Initial page was inspected'],
    nextAction: 'Continue the page check',
    status: 'running',
    ownership: { executionId: 'exec_1', revision: 1 },
    ...overrides
  };
}

function pingTool(executions) {
  return {
    name: 'ping',
    description: 'test ping',
    parameters: { type: 'object', properties: {} },
    async execute() {
      executions.push('ping');
      return { ok: true };
    }
  };
}

test('prepareStep re-injects the full original goal and fresh amendments with the current tool list', async () => {
  const longConstraint = 'x'.repeat(6000);
  let current = task({ originalGoal: `Goal:${longConstraint}` });
  const prepare = makeOfficePrepareStep({
    instructions: 'base instructions',
    taskContext: current,
    getTaskContext: () => current
  });
  const first = await prepare();
  assert.match(first.instructions, /Goal:x{6000}/);
  assert.deepEqual(first.activeTools, SESSION_TOOL_NAMES);
  assert.ok(first.activeTools.includes('task'));

  current = task({
    originalGoal: `Goal:${longConstraint}`,
    amendments: [{ content: 'Constraint BETA must also remain.', at: 2 }],
    summary: 'Fresh checkpoint'
  });
  const second = await prepare();
  assert.match(second.instructions, /Goal:x{6000}/);
  assert.match(second.instructions, /Constraint BETA must also remain/);
  assert.match(second.instructions, /Fresh checkpoint/);
});

test('task-bound tools run FIFO and successful wait suppresses every later sibling', async () => {
  const calls = [];
  let yielded = false;
  const taskTool = createTaskTool({
    taskContext: task(),
    getTaskContext: () => task(),
    taskShouldYield: () => yielded,
    async hostTask(input) {
      calls.push(`task:${input.op}`);
      if (input.op === 'wait') yielded = true;
      return { ok: true, task: task({ status: 'waiting' }), yield: input.op === 'wait' };
    }
  });
  const { tools } = guardTaskToolExecutions(
    {
      action: {
        async execute(input) {
          calls.push(`action:${input.id}`);
          return { ok: true };
        }
      },
      task: taskTool
    },
    {
      taskContext: task(),
      getTaskContext: () => task(),
      taskShouldYield: () => yielded,
      hostTask: async () => ({ ok: true })
    }
  );

  const before = tools.action.execute({ id: 'before' });
  const wait = tools.task.execute({
    op: 'wait',
    summary: 'Saved state',
    nextAction: 'Resume check',
    wakeAt: '2030-01-01T00:00:00.000Z'
  });
  const after = tools.action.execute({ id: 'after' });
  const [beforeResult, waitResult, afterResult] = await Promise.all([before, wait, after]);

  assert.equal(beforeResult.ok, true);
  assert.equal(waitResult.ok, true);
  assert.equal(afterResult.code, 'TASK_YIELDED');
  assert.deepEqual(calls, ['action:before', 'task:wait']);
});

test('task completion requires reported concrete evidence before persistence', async () => {
  let hostCalls = 0;
  const tool = createTaskTool({
    async hostTask() {
      hostCalls++;
      return { ok: true, yield: true };
    }
  });
  const invalid = await tool.execute({ op: 'complete', summary: 'Done', evidence: [] });
  assert.equal(invalid.code, 'BAD_INPUT');
  assert.equal(hostCalls, 0);
  const valid = await tool.execute({
    op: 'complete',
    summary: 'Done',
    evidence: ['Readback showed the requested value']
  });
  assert.equal(valid.ok, true);
  assert.equal(hostCalls, 1);
});

test('ordinary ToolLoopAgent turns are hop-unlimited', async () => {
  let modelCalls = 0;
  const executions = [];
  const model = createCallModelLanguageModel(async () => {
    modelCalls++;
    if (modelCalls <= 3) return { toolCalls: [{ name: 'ping', args: {} }] };
    return { text: 'finished normally' };
  });
  const result = await runSessionToolLoopAgent({
    model,
    system: 'test',
    messages: [{ role: 'user', content: 'hello' }],
    tools: { ping: pingTool(executions) },
    taskContext: null
  });
  assert.equal(modelCalls, 4);
  assert.equal(executions.length, 3);
  assert.equal(result.finalText, 'finished normally');
  assert.equal(result.taskStepLimitReached, false);
  assert.equal(result.taskStepCount, 4);
});

test('running durable tasks do not stop on hop count', async () => {
  let modelCalls = 0;
  const executions = [];
  const model = createCallModelLanguageModel(async () => {
    modelCalls++;
    if (modelCalls <= 3) return { toolCalls: [{ name: 'ping', args: {} }] };
    return { text: 'still going' };
  });
  const result = await runSessionToolLoopAgent({
    model,
    system: 'test',
    messages: [{ role: 'user', content: 'continue' }],
    tools: { ping: pingTool(executions) },
    taskContext: task(),
    taskRun: true
  });
  assert.equal(modelCalls, 4);
  assert.equal(executions.length, 3);
  assert.equal(result.taskStepLimitReached, false);
  assert.equal(result.taskYielded, false);
  assert.equal(result.finalText, 'still going');
});

test('task turns stop on successful wait, not hop count', async () => {
  let yielded = false;
  const model = createCallModelLanguageModel(async () => ({
    toolCalls: [{
      name: 'task',
      args: {
        op: 'wait',
        summary: 'Saved',
        nextAction: 'Resume',
        wakeAt: '2030-01-01T00:00:00.000Z'
      }
    }]
  }));
  const result = await runSessionToolLoopAgent({
    model,
    system: 'test',
    messages: [{ role: 'user', content: 'continue' }],
    tools: {
      task: createTaskTool({
        taskContext: task(),
        getTaskContext: () => task({ status: yielded ? 'waiting' : 'running' }),
        taskShouldYield: () => yielded,
        async hostTask() {
          yielded = true;
          return { ok: true, task: task({ status: 'waiting' }), yield: true };
        }
      })
    },
    taskContext: task(),
    taskShouldYield: () => yielded
  });
  assert.equal(result.taskYielded, true);
  assert.equal(result.taskStepLimitReached, false);
});

test('createTaskStopState ignores hop count even with leftover taskContext', () => {
  const idle = createTaskStopState({ taskContext: null });
  assert.equal(idle.stopWhen({ steps: new Array(40) }), false);
  const leftover = createTaskStopState({ taskContext: { originalGoal: 'chat' } });
  assert.equal(leftover.stopWhen({ steps: new Array(40) }), false);
  const running = createTaskStopState({
    taskContext: task(),
    taskRun: true
  });
  assert.equal(running.stopWhen({ steps: new Array(40) }), false);
  const yielded = createTaskStopState({ taskShouldYield: () => true });
  assert.equal(yielded.stopWhen({ steps: [] }), true);
  assert.equal(yielded.taskYielded, true);
});

