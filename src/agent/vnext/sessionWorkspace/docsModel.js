/**
 * Univer-shaped document snapshot for Agent apply.
 * Images live in drawings/customBlocks — never as `![image](src)` paragraphs.
 */

import {
  applyDocCommands as applyBlockCommands,
  cloneDocSnapshot,
  parseDocSnapshot,
  serializeDocHtml,
  snapshotToUniverData,
  univerDataToSnapshot
} from './docsApply.js';

/**
 * @param {object} snapshot blocks-or-univer
 * @returns {object} IDocumentData-shaped
 */
export function toUniverDoc(snapshot, opts = {}) {
  if (snapshot?.body && snapshot.body.dataStream != null) {
    return cloneUniver(snapshot);
  }
  return snapshotToUniverData(snapshot, opts);
}

export function fromUniverDoc(data, extra = {}) {
  return univerDataToSnapshot(data, extra);
}

/**
 * Apply Agent doc commands; persist Univer snapshot (drawings, lists).
 */
export function applyUniverDocCommands(snapshot, commands) {
  const blocksIn = snapshot?.body?.dataStream != null ? fromUniverDoc(snapshot) : cloneDocSnapshot(snapshot);
  const mapped = (Array.isArray(commands) ? commands : []).map((cmd) => {
    if (!cmd || typeof cmd !== 'object') return cmd;
    if (cmd.act === 'write' || cmd.op === 'write') {
      return { op: 'setText', text: cmd.text != null ? cmd.text : cmd.value, id: cmd.id || cmd.target };
    }
    if ((cmd.op === 'insertParagraph' || cmd.act === 'insertParagraph') && (cmd.list || cmd.blockType === 'li')) {
      return { ...cmd, op: 'insertList', list: cmd.list || 'ul' };
    }
    return cmd;
  });
  const applied = applyBlockCommands(blocksIn, mapped);
  if (applied.ok === false) return applied;
  const blocks = applied.snapshot;
  const univer = toUniverDoc(blocks, { id: snapshot?.id });
  return {
    ok: true,
    snapshot: blocks,
    univer,
    html: serializeDocHtml(blocks),
    applied: applied.applied,
    dirty: applied.applied?.map((a) => a.id || a.op).filter(Boolean).join(',') || ''
  };
}

export function parseUniverDoc(raw, extra = {}) {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj?.body?.dataStream != null) return obj;
    } catch {
      /* fall through */
    }
  }
  return toUniverDoc(parseDocSnapshot(raw, extra));
}

export function serializeUniverDoc(data) {
  return JSON.stringify(toUniverDoc(data));
}

function cloneUniver(data) {
  return JSON.parse(JSON.stringify(data));
}
