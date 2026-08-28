import assert from 'node:assert/strict';
import { pushPromptCheckpoint, popPromptCheckpoint, undoPrompt, redoPrompt } from '../../src/preview/sheetPromptUndo.js';

function snap(label) {
  return [{ name: 'Sheet1', rows: [[label]] }];
}

let stack = [];
stack = pushPromptCheckpoint(stack, 'p1', snap('before-1'));
stack = pushPromptCheckpoint(stack, 'p1', snap('should-not-replace'));
assert.equal(stack.length, 1);
assert.equal(stack[0].sheets[0].rows[0][0], 'before-1');

stack = pushPromptCheckpoint(stack, 'p2', snap('before-2'));
assert.equal(stack.length, 2);

stack = pushPromptCheckpoint(stack, 'p2', snap('still-p2'));
assert.equal(stack.length, 2);
assert.equal(stack[1].sheets[0].rows[0][0], 'before-2');

const first = popPromptCheckpoint(stack);
assert.equal(first.popped.promptId, 'p2');
assert.equal(first.stack.length, 1);
const second = popPromptCheckpoint(first.stack);
assert.equal(second.popped.promptId, 'p1');
assert.equal(second.stack.length, 0);
const empty = popPromptCheckpoint(second.stack);
assert.equal(empty.popped, null);

let capped = [];
for (let i = 0; i < 40; i++) capped = pushPromptCheckpoint(capped, `p${i}`, snap(String(i)), { max: 5 });
assert.equal(capped.length, 5);
assert.equal(capped[0].promptId, 'p35');

let undo = [];
let redo = [];
undo = pushPromptCheckpoint(undo, 'p1', snap('A'));
undo = pushPromptCheckpoint(undo, 'p2', snap('B'));
let step = undoPrompt(undo, redo, snap('C'));
assert.equal(step.restore.sheets[0].rows[0][0], 'B');
assert.equal(step.undoStack.length, 1);
assert.equal(step.redoStack.length, 1);
assert.equal(step.redoStack[0].sheets[0].rows[0][0], 'C');
step = redoPrompt(step.undoStack, step.redoStack, snap('B'));
assert.equal(step.restore.sheets[0].rows[0][0], 'C');
assert.equal(step.redoStack.length, 0);
assert.equal(step.undoStack.length, 2);
const afterNew = pushPromptCheckpoint(step.undoStack, 'p3', snap('C'));
assert.equal(afterNew.length, 3);

console.log('test_sheet_prompt_undo: ok');
