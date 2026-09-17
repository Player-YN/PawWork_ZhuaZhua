/** Durable task tool and execution gate. The service owns persistence. */

const OPS = ['inspect', 'plan', 'checkpoint', 'wait', 'complete', 'schedule'];
const TERMINAL_OPS = new Set(['wait', 'complete']);
const TERMINAL_STATUSES = new Set(['waiting', 'completed', 'complete']);

function terminalTask(task) {
  return !!(task && TERMINAL_STATUSES.has(String(task.status || '').toLowerCase()));
}

function currentTask(env) {
  try {
    if (typeof env.getTaskContext === 'function') return env.getTaskContext() || null;
  } catch {
    return env.taskContext || null;
  }
  return env.taskContext || null;
}

function taskUnavailable() {
  return {
    ok: false,
    code: 'TASK_UNAVAILABLE',
    error: 'durable task host is unavailable for this execution'
  };
}

function yieldedResult() {
  return {
    ok: false,
    code: 'TASK_YIELDED',
    error: 'task execution already yielded; no more tools may run'
  };
}

/**
 * Gate tool executions for a task-backed turn. FIFO order lets an earlier
 * side effect settle before wait/complete persists; once it does, later calls
 * (including siblings from the same model step) are suppressed.
 */
export function createTaskExecutionGate(env = {}) {
  let yielded = false;
  let draining = false;
  let scheduled = false;
  /** @type {Array<{name:string,input:any,run:Function,resolve:Function,reject:Function,terminal:boolean}>} */
  const queue = [];

  const shouldYield = () => {
    if (yielded) return true;
    try {
      if (typeof env.taskShouldYield === 'function' && env.taskShouldYield()) return true;
    } catch {
      /* host read failure should not invent a terminal state */
    }
    return terminalTask(currentTask(env));
  };

  async function drain() {
    if (draining) return;
    draining = true;
    scheduled = false;
    try {
      while (queue.length) {
        if (shouldYield()) {
          yielded = true;
          while (queue.length) queue.shift().resolve(yieldedResult());
          break;
        }
        const item = queue.shift();
        try {
          const output = await item.run();
          if (item.terminal && output?.ok === true && output?.yield !== false) yielded = true;
          item.resolve(output);
        } catch (error) {
          item.reject(error);
        }
        if (yielded || shouldYield()) {
          yielded = true;
          while (queue.length) queue.shift().resolve(yieldedResult());
          break;
        }
      }
    } finally {
      draining = false;
      if (queue.length && !scheduled) {
        scheduled = true;
        queueMicrotask(drain);
      }
    }
  }

  return {
    shouldYield,
    didYield: () => yielded || shouldYield(),
    execute(name, input, run) {
      if (shouldYield()) return Promise.resolve(yieldedResult());
      return new Promise((resolve, reject) => {
        queue.push({
          name,
          input,
          run,
          resolve,
          reject,
          terminal: name === 'task' && TERMINAL_OPS.has(String(input?.op || ''))
        });
        if (!scheduled) {
          scheduled = true;
          queueMicrotask(drain);
        }
      });
    }
  };
}

/** @param {object} env */
export function createTaskTool(env = {}) {
  return {
    name: 'task',
    description:
      'Inspect and persist durable task state. plan/checkpoint update the current task; wait/complete persist and yield immediately. schedule is only for future or recurring work explicitly requested by the user.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: OPS },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'done'] }
            },
            required: ['title', 'status']
          }
        },
        summary: { type: 'string' },
        evidence: { type: 'array', items: { type: 'string' } },
        nextAction: { type: 'string' },
        wakeAt: { type: 'string', description: 'ISO-8601 timestamp for wait or schedule' },
        goal: { type: 'string', description: 'Goal for a separately scheduled future task' },
        intervalMinutes: { type: 'number', description: 'Positive recurrence interval for schedule' }
      },
      required: ['op']
    },
    async execute(input = {}) {
      const op = String(input.op || '');
      if (!OPS.includes(op)) {
        return { ok: false, code: 'BAD_INPUT', error: `unknown task op ${op || '(empty)'}` };
      }
      if (typeof env.hostTask !== 'function') return taskUnavailable();
      if (op === 'schedule') {
        const goal = String(input.goal || '').trim();
        const intervalMinutes = Number(input.intervalMinutes);
        const wakeAt = String(input.wakeAt || '').trim();
        if (!goal || (!wakeAt && !(intervalMinutes > 0))) {
          return {
            ok: false,
            code: 'BAD_INPUT',
            error: 'schedule requires goal and wakeAt or a positive intervalMinutes'
          };
        }
      }
      if (op === 'wait' && !String(input.wakeAt || '').trim()) {
        return { ok: false, code: 'BAD_INPUT', error: 'wait requires wakeAt' };
      }
      if (op === 'wait' && (!String(input.summary || '').trim() || !String(input.nextAction || '').trim())) {
        return {
          ok: false,
          code: 'BAD_INPUT',
          error: 'wait requires summary and nextAction so a later execution can resume safely'
        };
      }
      if (
        op === 'complete' &&
        (!String(input.summary || '').trim() ||
          !Array.isArray(input.evidence) ||
          !input.evidence.some((item) => String(item || '').trim()))
      ) {
        return {
          ok: false,
          code: 'BAD_INPUT',
          error: 'complete requires summary and at least one concrete evidence entry'
        };
      }
      const payload = { op };
      for (const key of ['steps', 'summary', 'evidence', 'nextAction', 'wakeAt', 'goal', 'intervalMinutes']) {
        if (input[key] !== undefined) payload[key] = input[key];
      }
      try {
        return await env.hostTask(payload);
      } catch (error) {
        return {
          ok: false,
          code: String(error?.code || 'TASK_FAILED'),
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

/**
 * @param {Record<string, any>} tools
 * @param {object} env
 */
export function guardTaskToolExecutions(tools, env = {}) {
  if (typeof env.hostTask !== 'function' && !env.taskContext && typeof env.getTaskContext !== 'function') {
    return { tools, gate: null };
  }
  const gate = createTaskExecutionGate(env);
  const guarded = {};
  for (const [name, value] of Object.entries(tools || {})) {
    if (!value || typeof value.execute !== 'function') {
      guarded[name] = value;
      continue;
    }
    guarded[name] = {
      ...value,
      execute(input, opts) {
        return gate.execute(name, input, () => value.execute(input, opts));
      }
    };
  }
  return { tools: guarded, gate };
}
