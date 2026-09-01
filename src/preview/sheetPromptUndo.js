/**
 * Prompt-level undo stack for the live sheet tab.
 * One checkpoint per user sendMessage (prompt), not per Agent tool write.
 */

export const PROMPT_UNDO_MAX = 30;

/**
 * @param {Array<{ promptId: string, sheets: unknown }>} stack
 * @param {string} promptId
 * @param {unknown} sheets
 * @param {{ max?: number }} [opts]
 */
export function pushPromptCheckpoint(stack, promptId, sheets, opts = {}) {
  const max = Number(opts.max) > 0 ? Number(opts.max) : PROMPT_UNDO_MAX;
  const prev = Array.isArray(stack) ? stack : [];
  const id = String(promptId || '').trim();
  const last = prev.length ? prev[prev.length - 1] : null;
  if (id && last && last.promptId === id) return prev;
  const next = [...prev, { promptId: id || `apply-${prev.length + 1}`, sheets, snapshot: opts.snapshot || null }];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * @param {Array<{ promptId: string, sheets: unknown }>} stack
 */
export function popPromptCheckpoint(stack) {
  const prev = Array.isArray(stack) ? stack : [];
  if (!prev.length) return { stack: [], popped: null };
  return { stack: prev.slice(0, -1), popped: prev[prev.length - 1] };
}

/**
 * Undo one prompt: restore popped.sheets; current live sheets go onto redo.
 * @param {Array} undoStack
 * @param {Array} redoStack
 * @param {unknown} currentSheets live sheets before restore
 */
export function undoPrompt(undoStack, redoStack, currentSheets, opts = {}) {
  const max = Number(opts.max) > 0 ? Number(opts.max) : PROMPT_UNDO_MAX;
  const { stack, popped } = popPromptCheckpoint(undoStack);
  if (!popped) return { undoStack: stack, redoStack: Array.isArray(redoStack) ? redoStack : [], restore: null };
  const redo = [
    ...(Array.isArray(redoStack) ? redoStack : []),
    { promptId: popped.promptId, sheets: currentSheets, snapshot: opts.snapshot || null }
  ];
  return {
    undoStack: stack,
    redoStack: redo.length > max ? redo.slice(redo.length - max) : redo,
    restore: popped
  };
}

/**
 * Redo one prompt: restore popped.sheets; current live sheets go back onto undo.
 */
export function redoPrompt(undoStack, redoStack, currentSheets, opts = {}) {
  const max = Number(opts.max) > 0 ? Number(opts.max) : PROMPT_UNDO_MAX;
  const { stack, popped } = popPromptCheckpoint(redoStack);
  if (!popped) return { undoStack: Array.isArray(undoStack) ? undoStack : [], redoStack: stack, restore: null };
  const undo = [
    ...(Array.isArray(undoStack) ? undoStack : []),
    { promptId: popped.promptId, sheets: currentSheets, snapshot: opts.snapshot || null }
  ];
  return {
    undoStack: undo.length > max ? undo.slice(undo.length - max) : undo,
    redoStack: stack,
    restore: popped
  };
}
