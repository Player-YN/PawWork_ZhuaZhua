/**
 * Token-window compact for the model wire (not the UI transcript).
 *
 * Mature shape (Claude Code / Cursor / Codex class):
 * - Trigger on occupancy of THIS model's context window (default 80%), not turn count.
 * - Never rewrite the stable system prefix or tool schemas.
 * - Fold older turns into one frozen snapshot; keep the last few user turns verbatim.
 * - Do not re-summarize every turn — the snapshot stays put until occupancy hits
 *   the threshold again (then replace it once).
 */

import { DEFAULT_CONTEXT_WINDOW } from '../../modelCatalog.js';

export const COMPACT_RATIO = 0.8;
export const COMPACT_KEEP_USER_TURNS = 2;

export function contextUsageRatio(promptTokens, contextWindow) {
  const w = Math.max(2048, Number(contextWindow) || DEFAULT_CONTEXT_WINDOW);
  const p = Math.max(0, Number(promptTokens) || 0);
  return p / w;
}

export function estimateTextTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c > 0x2e80) cjk += 1;
    else other += 1;
  }
  return Math.ceil(cjk / 1.5 + other / 4);
}

export function estimateMessagesTokens(messages) {
  let n = 0;
  for (const m of messages || []) {
    n += 8;
    n += estimateTextTokens(m?.content);
    if (m?.thought) n += estimateTextTokens(m.thought);
    if (m?.wire) n += estimateTextTokens(JSON.stringify(m.wire).slice(0, 8000));
    else if (m?.toolCalls) n += estimateTextTokens(JSON.stringify(m.toolCalls).slice(0, 4000));
  }
  return n;
}

/**
 * Index of the first message that must stay verbatim (start of last N user turns).
 * Compact region is messages[0..cut).
 * @returns {number} cut index, or -1 if nothing to fold
 */
export function findCompactCutIndex(messages, keepUserTurns = COMPACT_KEEP_USER_TURNS) {
  const arr = Array.isArray(messages) ? messages : [];
  const userAt = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]?.role === 'user') userAt.push(i);
  }
  const keep = Math.max(1, Number(keepUserTurns) || COMPACT_KEEP_USER_TURNS);
  if (userAt.length <= keep) return -1;
  return userAt[userAt.length - keep];
}

export function messagesAfterCompact(messages, compact) {
  const arr = Array.isArray(messages) ? messages : [];
  const through = compact?.throughMessageId;
  if (!through) return arr.slice();
  const idx = arr.findIndex((m) => m && m.messageId === through);
  if (idx < 0) return arr.slice();
  return arr.slice(idx + 1);
}

export function compactPrefixMessages(compact) {
  const text = String(compact?.text || '').trim();
  if (!text) return [];
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `[Session compact — frozen snapshot, not a user message]\n${text}`
        }
      ]
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Continuing from the compact. Inspect artifacts or groups if details are needed.'
        }
      ]
    }
  ];
}

export function shouldCompact(opts = {}) {
  const ratio = contextUsageRatio(opts.promptTokens, opts.contextWindow);
  if (ratio < COMPACT_RATIO) return false;
  const messages = opts.messages || [];
  const cut = findCompactCutIndex(messages);
  if (cut < 1) return false;
  const through = messages[cut - 1]?.messageId;
  if (through && opts.compact?.throughMessageId === through) return false;
  return true;
}

export function extractiveCompactText(messages, prevText = '') {
  const lines = [];
  if (prevText) {
    lines.push('Previous compact:', String(prevText).slice(0, 1200), '');
  }
  lines.push('Folded turns:');
  let users = 0;
  let assistants = 0;
  /** @type {string[]} */
  const tools = [];
  for (const m of messages || []) {
    const role = m?.role;
    const text = String(m?.content || '')
      .replace(/boundGroups=\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);
    if (role === 'user') {
      users += 1;
      if (text) lines.push(`- user: ${text}`);
    } else if (role === 'assistant') {
      assistants += 1;
      if (text) lines.push(`- assistant: ${text}`);
      for (const tc of m?.toolCalls || []) {
        const name = tc?.toolName || tc?.name;
        if (name) tools.push(String(name));
      }
    }
  }
  if (tools.length) {
    const uniq = [...new Set(tools)];
    lines.push(`Tools used: ${uniq.join(', ')}`);
  }
  lines.push(`Counts: ${users} user / ${assistants} assistant`);
  return lines.join('\n').slice(0, 4000);
}

/**
 * Prefer a one-shot title-style generate. Tests / callModel stubs stay extractive.
 */
export async function generateCompactText(opts = {}) {
  const fallback = extractiveCompactText(opts.messages, opts.prevText);
  if (typeof opts.callModel === 'function' || opts.model?.modelId === 'callModel-adapter') {
    return fallback;
  }
  const model = opts.model;
  if (!model || typeof model.doGenerate !== 'function') return fallback;
  const sys =
    'You compact a browser-office agent session. Reply with ONLY a structured snapshot: Goal, Decisions, Artifacts (names only), Sources/provenance (artifact names only), Open questions. No quotes. No raw bytes or long paths. Max 400 words.';
  const body = extractiveCompactText(opts.messages, opts.prevText).slice(0, 6000);
  try {
    const out = await model.doGenerate({
      prompt: [
        { role: 'system', content: [{ type: 'text', text: sys }] },
        { role: 'user', content: [{ type: 'text', text: body }] }
      ],
      maxOutputTokens: 500
    });
    const parts = Array.isArray(out?.content) ? out.content : [];
    const joined = parts.map((p) => (p?.type === 'text' ? p.text : '')).join('').trim();
    const text = joined || String(out?.text || '').trim();
    if (!text || text.length < 20) return fallback;
    return text.slice(0, 4000);
  } catch {
    return fallback;
  }
}

export function harvestModelUsage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { source: 'none', promptTokens: 0, completionTokens: 0 };
  }
  const hasPrompt =
    raw.inputTokens != null || raw.promptTokens != null || raw.prompt_tokens != null;
  const hasCompletion =
    raw.outputTokens != null || raw.completionTokens != null || raw.completion_tokens != null;
  const prompt = Number(
    raw.inputTokens ?? raw.promptTokens ?? raw.prompt_tokens ?? raw.input ?? 0
  );
  const completion = Number(
    raw.outputTokens ?? raw.completionTokens ?? raw.completion_tokens ?? raw.output ?? 0
  );
  let source = 'none';
  if (raw.source === 'estimate' || raw.source === 'api' || raw.source === 'none') {
    source = raw.source;
  } else if (hasPrompt || hasCompletion) {
    source = 'api';
  }
  return {
    source,
    promptTokens: Number.isFinite(prompt) ? prompt : 0,
    completionTokens: Number.isFinite(completion) ? completion : 0
  };
}
