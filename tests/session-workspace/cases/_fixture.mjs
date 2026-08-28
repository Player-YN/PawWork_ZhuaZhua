/**
 * Shared fixture for Session Workspace acceptance cases.
 * Always imports shipped product runtime — not a reimplementation.
 */

import {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore
} from '../../../src/agent/vnext/runSession.product.js';

export function makeRuntime() {
  return createSessionWorkspaceRuntime(new SessionWorkspaceStore());
}

/**
 * callModel that never uses tools — pure text.
 */
export function callModelTextOnly() {
  return async ({ messages }) => {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return { text: `Answer: ${String(last?.content || '').slice(0, 200)}`, toolCalls: [] };
  };
}

/**
 * callModel that inspects groups once then answers (no artifact).
 */
export function callModelInspectThenAnswer() {
  let step = 0;
  return async () => {
    step += 1;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [{ toolName: 'inspect', args: { view: 'groups' }, toolCallId: 'c1' }]
      };
    }
    return { text: 'Based on ambient groups, here is the answer.', toolCalls: [] };
  };
}

/**
 * callModel that writes an artifact via run.
 */
export function callModelWriteArtifact(name = 'report.md', content = '# Report\nhello') {
  let step = 0;
  return async () => {
    step += 1;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [
          {
            toolName: 'run',
            args: { op: 'write_artifact', name, content },
            toolCallId: 'c1'
          }
        ]
      };
    }
    return { text: `Created artifact ${name}`, toolCalls: [] };
  };
}

/**
 * callModel that updates an existing artifact.
 */
export function callModelUpdateArtifact(artifactId, content) {
  let step = 0;
  return async () => {
    step += 1;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [
          {
            toolName: 'run',
            args: { op: 'update_artifact', artifactId, content },
            toolCallId: 'c1'
          }
        ]
      };
    }
    return { text: 'Updated artifact', toolCalls: [] };
  };
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
