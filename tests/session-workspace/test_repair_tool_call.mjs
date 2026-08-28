/**
 * ToolLoopAgent repairToolCall: invalid input is re-asked once, then the valid call runs.
 */
import assert from 'node:assert/strict';
import { makeRuntime } from './cases/_fixture.mjs';

const rt = makeRuntime();
const s = rt.createSession();
let step = 0;
const r = await rt.sendMessage({
  sessionId: s.sessionId,
  content: 'write a tiny note',
  callModel: async () => {
    step += 1;
    if (step === 1) {
      return {
        text: 'repairing',
        toolCalls: [
          {
            toolName: 'run',
            args: { op: 'not-a-real-op', name: 'note.md' },
            toolCallId: 'repair-1'
          }
        ]
      };
    }
    if (step === 2) {
      return {
        text: null,
        toolCalls: [
          {
            toolName: 'run',
            args: { op: 'write_artifact', name: 'note.md', content: 'ok' },
            toolCallId: 'repair-1'
          }
        ]
      };
    }
    return { text: 'wrote note.md', toolCalls: [] };
  }
});

assert.equal(r.finalText, 'wrote note.md');
assert.ok(
  r.toolCalls.some((t) => t.toolName === 'run' && t.args?.op === 'write_artifact'),
  'repaired hop must execute the valid run call'
);
assert.equal(rt.listArtifacts(s.sessionId).length, 1, 'valid repaired write lands an artifact');
assert.ok(step >= 2, `model must be re-asked at least once, got ${step} calls`);

console.log('test_repair_tool_call: ok');
