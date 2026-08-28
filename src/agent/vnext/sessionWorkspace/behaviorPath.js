/**
 * Session trajectory: causal audit of the **agent run** (chat + model + tools + host).
 * Events are occurrence order. tool-result is never written back onto tool-call.
 * User edits in live office canvases (preview `updateArtifact`) never enter this log.
 */

import { projectJsonForWire } from './wireTranscript.js';
import { harvestModelUsage } from './contextCompact.js';

export const BEHAVIOR_TRAJECTORY_SCHEMA = 'pagewand.trajectory/v3';

const OFFICE_TOOLS = new Set(['sheet', 'deck', 'doc']);
const COMMAND_KEEP = [
  'op',
  'act',
  'a1',
  'sheet',
  'nodeId',
  'plateId',
  'slotId',
  'artifactId',
  'skillId',
  'id',
  'name',
  'path'
];
const RESULT_KEEP = [
  'ok',
  'artifactId',
  'act',
  'op',
  'view',
  'skillId',
  'origin',
  'dirty',
  'code',
  'error',
  'hint',
  'path',
  'name',
  'guestRoot',
  'kind',
  'shell'
];

const MAX_BUBBLE_CHARS = 12000;
const MAX_THOUGHT_CHARS = 8000;
const MAX_COMPACT_PREVIEW = 2000;

function slim(value) {
  return projectJsonForWire(value);
}

function clipStr(value, max = 200) {
  const s = value == null ? '' : String(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[+${s.length - max} chars]`;
}

function compactPage(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const url = String(raw.url || '').trim().slice(0, 2000);
  if (!url) return undefined;
  const out = { url };
  if (raw.title) out.title = String(raw.title).slice(0, 120);
  if (raw.origin) out.origin = String(raw.origin).slice(0, 200);
  return out;
}

function compactMentions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && m.id)
    .slice(0, 32)
    .map((m) => ({
      kind: String(m.kind || 'group').slice(0, 24),
      id: String(m.id).slice(0, 96),
      ...(m.label ? { label: String(m.label).slice(0, 80) } : {}),
      ...(m.handle ? { handle: String(m.handle).slice(0, 40) } : {}),
      ...(m.url ? { url: String(m.url).slice(0, 2000) } : {})
    }));
}

function compactCanvases(canvases) {
  if (!canvases || typeof canvases !== 'object') return undefined;
  const out = {};
  for (const key of ['sheet', 'deck', 'poster', 'doc']) {
    const ids = Array.isArray(canvases[key]) ? canvases[key].map(String).slice(0, 20) : [];
    if (ids.length) out[key] = ids;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * What the model saw this turn — not the live canvas bytes, not user edits.
 * @param {object} [input]
 */
export function compactTurnContext(input = {}) {
  const tools = Array.isArray(input.tools) ? input.tools.map(String).slice(0, 16) : [];
  const skills = Array.isArray(input.skills)
    ? input.skills.slice(0, 40).map((s) => ({
        id: String(s.id || ''),
        ...(s.origin ? { origin: String(s.origin) } : {})
      }))
    : [];
  const mentions = compactMentions(input.mentions || input.focusedMentions);
  const ctx = {
    tools,
    canvases: compactCanvases(input.canvases),
    artifactCount: Number(input.artifactCount) || 0,
    boundGroupCount: Array.isArray(input.boundGroups)
      ? input.boundGroups.length
      : Number(input.boundGroupCount) || 0,
    boundItemCount: Number(input.boundItemCount) || 0
  };
  const focusPage = compactPage(input.focusPage);
  const activeTab = compactPage(input.activeTab);
  if (focusPage) ctx.focusPage = focusPage;
  if (activeTab) ctx.activeTab = activeTab;
  if (mentions.length) ctx.focusedMentions = mentions;
  if (skills.length) ctx.skills = skills;
  const html = input.activeHtml;
  if (html && html.artifactId) {
    ctx.activeHtml = {
      artifactId: String(html.artifactId),
      selections: (html.selections || html.overview?.selections || []).slice(0, 8).map((s) => ({
        ...(s.nodeId || s.id ? { nodeId: String(s.nodeId || s.id) } : {}),
        ...(s.plateId ? { plateId: String(s.plateId) } : {})
      }))
    };
  }
  const wb = input.activeWorkbook;
  if (wb && wb.artifactId) {
    const sels = wb.overview?.selections || (wb.overview?.selection ? [wb.overview.selection] : []);
    ctx.activeWorkbook = {
      artifactId: String(wb.artifactId),
      selections: sels.slice(0, 8).map((s) => ({
        ...(s.sheet ? { sheet: String(s.sheet) } : {}),
        ...(s.a1 ? { a1: String(s.a1) } : {})
      }))
    };
  }
  return ctx;
}

function compactCommands(commands) {
  if (!Array.isArray(commands)) return undefined;
  return commands.slice(0, 40).map((c) => {
    if (!c || typeof c !== 'object') return { op: String(c) };
    const out = {};
    for (const k of COMMAND_KEEP) {
      if (c[k] != null && c[k] !== '') out[k] = clipStr(c[k], 80);
    }
    if (!out.op && c.type) out.op = clipStr(c.type, 80);
    if (c.text != null) out.text = clipStr(c.text, 200);
    if (c.value != null && (typeof c.value === 'string' || typeof c.value === 'number')) {
      out.value = clipStr(c.value, 200);
    } else if (c.value != null) {
      out.value = '[omitted]';
    }
    if (c.src) out.src = clipStr(c.src, 80);
    return out;
  });
}

function officeSurface(tool, args, result) {
  const name = String(tool || '');
  if (OFFICE_TOOLS.has(name)) return name === 'deck' ? 'canvas' : name;
  const op = String(args?.op || result?.op || '');
  if (name === 'run') {
    if (op === 'skill') return 'skill';
    if (op === 'sheet' || op === 'doc') return op;
    if (op === 'html' || op === 'ingestPdf') return 'canvas';
    if (op === 'write_artifact' || op === 'update_artifact') return 'artifact';
  }
  if (name === 'inspect') {
    const view = String(args?.view || result?.view || '');
    if (view === 'skill' || view === 'skills') return 'skill';
    if (view === 'workbook' || view === 'range') return 'sheet';
  }
  return undefined;
}

function slimToolArgs(tool, raw) {
  const parsed = asArgsRaw(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return slim(parsed);
  const out = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v == null) continue;
    if (k === 'commands') {
      out.commands = compactCommands(v);
      continue;
    }
    if (k === 'code' || k === 'content' || k === 'instructions' || k === 'markdown' || k === 'html') {
      out[k] = clipStr(v, 400);
      continue;
    }
    if (k === 'files' && v && typeof v === 'object') {
      out.files = Object.keys(v).slice(0, 20);
      continue;
    }
    out[k] = slim(v);
  }
  return out;
}

function slimToolResult(tool, raw) {
  const value = unwrapToolResultRaw(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return slim(value);
  const surface = officeSurface(tool, {}, value);
  const officeLike =
    OFFICE_TOOLS.has(String(tool || '')) ||
    surface === 'skill' ||
    surface === 'canvas' ||
    surface === 'sheet' ||
    surface === 'doc' ||
    surface === 'artifact';
  if (!officeLike) return slim(value);
  const out = {};
  if (value.ok === false) out.ok = false;
  else if (value.ok === true) out.ok = true;
  for (const k of RESULT_KEEP) {
    if (value[k] != null && value[k] !== '') {
      out[k] = typeof value[k] === 'string' ? clipStr(value[k], 400) : slim(value[k]);
    }
  }
  if (value.readback && typeof value.readback === 'object') {
    const rb = {};
    for (const [k, v] of Object.entries(value.readback)) {
      if (v == null) continue;
      if (k === 'src' || k === 'html' || k === 'values' || k === 'rows') {
        rb[k] = typeof v === 'string' ? clipStr(v, 200) : slim(v);
      } else {
        rb[k] = slim(v);
      }
    }
    out.readback = rb;
  }
  if (Array.isArray(value.applied)) out.applied = compactCommands(value.applied);
  else if (value.applied != null && typeof value.applied === 'object') out.applied = compactCommands([value.applied]);
  else if (typeof value.applied === 'number') out.applied = value.applied;
  if (Array.isArray(value.available)) {
    out.available = value.available.slice(0, 40).map((x) =>
      typeof x === 'string' ? x : String(x?.id || x?.nodeId || x?.path || '')
    );
  }
  if (Array.isArray(value.resources)) {
    out.resources = value.resources.slice(0, 40).map((r) => (typeof r === 'string' ? r : r?.path)).filter(Boolean);
  }
  if (value.playbook != null) out.playbookChars = String(value.playbook).length;
  else if (value.playbookChars != null) out.playbookChars = Number(value.playbookChars) || 0;
  if (Array.isArray(value.catalog)) {
    out.catalog = value.catalog.slice(0, 40).map((s) => ({
      id: String(s.id || ''),
      ...(s.name ? { name: String(s.name).slice(0, 80) } : {})
    }));
  }
  if (Array.isArray(value.sheets)) {
    out.sheets = value.sheets.slice(0, 20).map((s) =>
      typeof s === 'string' ? s : String(s?.name || '')
    );
  }
  if (value.skill && typeof value.skill === 'object') {
    out.skill = {
      id: String(value.skill.id || ''),
      ...(value.skill.origin ? { origin: String(value.skill.origin) } : {})
    };
  }
  if (out.ok == null && Object.keys(out).length === 0) return slim(value);
  return out;
}

function decorateOfficeStep(out, tool, args, result) {
  const surface = officeSurface(tool, args, result);
  if (surface) out.surface = surface;
  const artifactId = args?.artifactId || result?.artifactId;
  if (artifactId) out.artifactId = String(artifactId);
  const act = args?.act || args?.op || result?.act || result?.op;
  if (act) out.act = clipStr(act, 40);
  const skillId = args?.skillId || args?.id || result?.skillId || result?.skill?.id;
  if (surface === 'skill' && skillId) out.skillId = String(skillId);
  return out;
}

function asArgsRaw(raw) {
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        /* keep string */
      }
    }
    return raw;
  }
  return raw ?? {};
}

function unwrapToolResultRaw(raw) {
  if (raw && typeof raw === 'object' && raw.type === 'json' && 'value' in raw) {
    return raw.value;
  }
  return raw ?? null;
}

export function isoTime(ms) {
  if (typeof ms === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(ms)) return ms;
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n).toISOString();
  } catch {
    return null;
  }
}

export function intMs(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.round(v);
}

export function finishReasonOf(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    if (value === '[object Object]') return undefined;
    return value.slice(0, 80);
  }
  if (typeof value === 'object') {
    const u = value.unified ?? value.reason ?? value.type;
    if (typeof u === 'string' && u) return u.slice(0, 80);
  }
  return undefined;
}

function nowTs(ev) {
  const n = Number(ev?.ts);
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}

function asArgs(raw) {
  return slim(asArgsRaw(raw));
}

function unwrapToolResult(raw) {
  return slim(unwrapToolResultRaw(raw));
}

function resultOk(result, ev) {
  if (ev && ev.ok === false) return false;
  if (result && typeof result === 'object' && result.ok === false) return false;
  return ev?.ok !== false;
}

function copyTiming(out, step) {
  if (!out || !step) return out;
  const ts = isoTime(step.ts ?? step.startedAt ?? step.endedAt);
  if (ts) out.ts = ts;
  const started = isoTime(step.startedAt);
  const ended = isoTime(step.endedAt);
  if (started) out.startedAt = started;
  if (ended) out.endedAt = ended;
  const lat = intMs(step.latencyMs);
  if (lat != null) out.latencyMs = lat;
  const inf = intMs(step.inferenceMs);
  if (inf != null) out.inferenceMs = inf;
  if (step.usage && typeof step.usage === 'object') out.usage = harvestModelUsage(step.usage);
  if (step.model) out.model = String(step.model);
  if (step.provider) out.provider = String(step.provider);
  if (step.synthetic === true) out.synthetic = true;
  return out;
}

function sumToolMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;
  let n = 0;
  for (const v of Object.values(map)) n += Number(v) || 0;
  return n;
}

/**
 * Three clocks for a turn: agent inference, tool/host execute, wall total.
 * `model.latencyMs` is inference-only on new recordings. Legacy rows stored
 * SDK stepTimeMs (inference+tools); those are split by subtracting following tools.
 * @param {Array<object>|undefined} events
 * @param {number|undefined} totalFallback wall-clock ms
 */
export function splitTurnTiming(events, totalFallback) {
  let inferenceMs = 0;
  let toolMs = 0;
  const list = Array.isArray(events) ? events : [];
  let i = 0;
  while (i < list.length) {
    const e = list[i];
    if (e?.type === 'model') {
      let followingTool = 0;
      let j = i + 1;
      while (j < list.length && list[j]?.type !== 'model') {
        if (list[j]?.type === 'tool-result') followingTool += intMs(list[j].latencyMs) || 0;
        j += 1;
      }
      const storedInf = intMs(e.inferenceMs);
      const lat = intMs(e.latencyMs);
      if (storedInf != null) inferenceMs += storedInf;
      else if (lat != null && followingTool > 0 && lat >= followingTool) {
        inferenceMs += lat - followingTool;
      } else if (lat != null) {
        inferenceMs += lat;
      }
      toolMs += followingTool;
      i = j;
      continue;
    }
    if (e?.type === 'tool-result') toolMs += intMs(e.latencyMs) || 0;
    i += 1;
  }
  const totalMs = intMs(totalFallback);
  return {
    inferenceMs,
    toolMs,
    totalMs: totalMs != null ? totalMs : inferenceMs + toolMs
  };
}

function inferenceMsFromModelEnd(ev, step) {
  const perf = ev?.performance && typeof ev.performance === 'object' ? ev.performance : {};
  const responseMs = intMs(perf.responseTimeMs);
  if (responseMs != null) return responseMs;
  const stepMs = intMs(perf.stepTimeMs);
  const toolSum = sumToolMap(perf.toolExecutionMs);
  if (stepMs != null && toolSum > 0) return Math.max(0, stepMs - toolSum);
  if (step?.generatedAt != null && step?.startedAt != null) {
    const wall = Number(step.generatedAt) - Number(step.startedAt);
    if (Number.isFinite(wall) && wall >= 0) return Math.round(wall);
  }
  if (toolSum === 0) {
    const given = intMs(ev.latencyMs);
    if (given != null) return given;
    if (stepMs != null) return stepMs;
  }
  if (step?.startedAt != null) {
    const ts = nowTs(ev);
    return Math.max(0, ts - Number(step.startedAt));
  }
  return intMs(ev.latencyMs) ?? 0;
}

function slimEvent(step) {
  if (!step || typeof step !== 'object') return step;
  const type = String(step.type || '');
  if (type === 'turn-context') {
    const ctx = compactTurnContext(step);
    const ts = isoTime(step.ts);
    return ts ? { type: 'turn-context', ...ctx, ts } : { type: 'turn-context', ...ctx };
  }
  if (type === 'tool-call' || type === 'tool') {
    const tool = String(step.tool || step.name || 'tool');
    const args = slimToolArgs(tool, step.args ?? step.input ?? {});
    const resultHint = unwrapToolResultRaw(step.result);
    return copyTiming(
      decorateOfficeStep(
        {
          type: 'tool-call',
          tool,
          toolCallId: step.toolCallId ? String(step.toolCallId) : '',
          args
        },
        tool,
        args,
        resultHint
      ),
      step
    );
  }
  if (type === 'tool-result') {
    const tool = String(step.tool || step.name || 'tool');
    const args = slimToolArgs(tool, step.args ?? step.input ?? {});
    const result = slimToolResult(tool, step.result);
    return copyTiming(
      decorateOfficeStep(
        {
          type: 'tool-result',
          tool,
          toolCallId: step.toolCallId ? String(step.toolCallId) : '',
          ok: step.ok !== false,
          result
        },
        tool,
        args,
        result
      ),
      step
    );
  }
  if (type === 'model') {
    const out = copyTiming(
      {
        type: 'model',
        name: 'llm',
        index: step.index != null ? Number(step.index) : undefined
      },
      step
    );
    const fr = finishReasonOf(step.finishReason);
    if (fr) out.finishReason = fr;
    const thought = String(step.thought || '').trim();
    if (thought) out.thought = clipBubble(thought, MAX_THOUGHT_CHARS);
    return out;
  }
  if (type === 'host') {
    const out = { type: 'host', name: String(step.name || 'host') };
    for (const [k, v] of Object.entries(step)) {
      if (
        k === 'type' ||
        k === 'name' ||
        k === 'dataUrl' ||
        k === 'bytes' ||
        k === 'imageBase64' ||
        k === 'usage' ||
        k === 'thought'
      ) {
        continue;
      }
      out[k] = slim(v);
    }
    return copyTiming(out, step);
  }
  if (type === 'error') {
    return {
      type: 'error',
      name: step.name ? String(step.name) : 'Error',
      message: step.message ? String(step.message).slice(0, 400) : '',
      code: step.code != null && step.code !== '' ? String(step.code) : undefined,
      statusCode: step.statusCode != null ? Number(step.statusCode) : undefined,
      ok: false,
      ts: isoTime(step.ts) || undefined
    };
  }
  if (type === 'assistant-final') {
    return {
      type: 'assistant-final',
      content: clipBubble(step.content || ''),
      ts: isoTime(step.ts) || undefined
    };
  }
  return slim(step);
}

function findOpenCall(pathLog, name, id) {
  for (let i = pathLog.length - 1; i >= 0; i--) {
    const p = pathLog[i];
    if (p.type !== 'tool-call' && p.type !== 'tool') continue;
    if (id && p.toolCallId && String(p.toolCallId) === String(id)) return p;
    if ((p.tool || p.name) === name) return p;
  }
  return null;
}

function findOpenModel(pathLog) {
  for (let i = pathLog.length - 1; i >= 0; i--) {
    if (pathLog[i].type === 'model' && pathLog[i].endedAt == null) return pathLog[i];
  }
  return null;
}

/**
 * Reconstruct tool-call then tool-result from stored toolCalls (old sessions).
 * @param {Array<object>} [toolCalls]
 */
export function pathFromToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || !toolCalls.length) return [];
  const out = [];
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const tool = String(tc.toolName || tc.name || 'tool');
    const toolCallId = String(tc.toolCallId || tc.id || `call_${i}`);
    out.push({
      type: 'tool-call',
      tool,
      toolCallId,
      args: asArgs(tc.args ?? tc.input ?? tc.arguments ?? {})
    });
    const result = unwrapToolResult(tc.result ?? tc.output ?? null);
    out.push({
      type: 'tool-result',
      tool,
      toolCallId,
      ok: resultOk(result, tc),
      result
    });
  }
  return out;
}

/**
 * Reconstruct occurrence-order tool events from stored wire.
 * @param {Array<object>} [wire]
 */
export function pathFromWire(wire) {
  if (!Array.isArray(wire) || !wire.length) return [];
  const path = [];
  for (const msg of wire) {
    if (!msg || typeof msg !== 'object') continue;
    const content = msg.content;
    const parts = Array.isArray(content)
      ? content
      : typeof content === 'string' && content
        ? [{ type: 'text', text: content }]
        : [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'tool-call') {
        path.push({
          type: 'tool-call',
          tool: String(part.toolName || part.name || 'tool'),
          toolCallId: String(part.toolCallId || ''),
          args: asArgs(part.input ?? part.args ?? {})
        });
        continue;
      }
      if (part.type === 'tool-result') {
        const output = part.output ?? part.result ?? null;
        const value =
          output && typeof output === 'object' && output.type === 'json' && 'value' in output
            ? output.value
            : output;
        path.push({
          type: 'tool-result',
          tool: String(part.toolName || part.name || 'tool'),
          toolCallId: String(part.toolCallId || ''),
          ok: resultOk(value, part),
          result: slim(value)
        });
      }
    }
  }
  return path;
}

/**
 * Live event log wins (already occurrence order). Else derive call/result pairs.
 * @param {{ path?: Array<object>, toolCalls?: Array<object>, traces?: Array<object>, wire?: Array<object> }} [input]
 */
export function mergeBehaviorPath(input = {}) {
  const live = Array.isArray(input.path) ? input.path.filter(Boolean) : [];
  if (live.length) return live.map(slimEvent);
  // Wire is paired by toolCallId. toolCalls may have been stored with a
  // same-name fallback (two inspects → first result duplicated).
  const fromWire = pathFromWire(input.wire).map(slimEvent);
  if (fromWire.length) return fromWire;
  return pathFromToolCalls(input.toolCalls || input.traces).map(slimEvent);
}

/**
 * Record a live onEvent into a path buffer (sendMessage).
 * @param {Array<object>} pathLog
 * @param {object} ev
 */
export function recordBehaviorEvent(pathLog, ev) {
  if (!Array.isArray(pathLog) || !ev || typeof ev !== 'object') return;
  const type = String(ev.type || '');
  const ts = nowTs(ev);

  if (type === 'thought') {
    const piece = ev.text != null ? ev.text : ev.chunk;
    if (typeof piece !== 'string' || !piece || piece === '[object Object]') return;
    const model = findOpenModel(pathLog);
    if (model) model.thought = `${model.thought || ''}${piece}`;
    return;
  }

  if (type === 'clarify') {
    pathLog.push({
      type: 'clarify',
      clarifyId: String(ev.clarifyId || ''),
      questions: Array.isArray(ev.questions) ? slim(ev.questions) : [],
      ts,
      startedAt: ts
    });
    return;
  }

  if (type === 'clarify-done') {
    const id = String(ev.clarifyId || '');
    let open = null;
    for (let i = pathLog.length - 1; i >= 0; i--) {
      if (pathLog[i].type === 'clarify' && (!id || String(pathLog[i].clarifyId) === id)) {
        open = pathLog[i];
        break;
      }
    }
    const latencyMs = open?.startedAt ? Math.max(0, ts - Number(open.startedAt)) : undefined;
    pathLog.push({
      type: 'clarify-done',
      clarifyId: id || open?.clarifyId || '',
      answers: ev.aborted ? undefined : slim(ev.answers || {}),
      aborted: ev.aborted === true,
      ts,
      endedAt: ts,
      latencyMs
    });
    return;
  }

  if (type === 'tool-call') {
    const model = findOpenModel(pathLog);
    if (model && model.generatedAt == null) model.generatedAt = ts;
    pathLog.push({
      type: 'tool-call',
      tool: String(ev.name || ev.toolName || ev.tool || 'tool'),
      toolCallId: String(ev.toolCallId || ev.id || ''),
      args: asArgs(ev.args ?? ev.input ?? {}),
      ts,
      startedAt: ts
    });
    return;
  }

  if (type === 'tool-result') {
    const tool = String(ev.name || ev.toolName || ev.tool || 'tool');
    const id = String(ev.toolCallId || ev.id || '');
    const result = unwrapToolResult(ev.result ?? ev.output ?? null);
    const call = findOpenCall(pathLog, tool, id);
    const given = Number(ev.latencyMs ?? ev.toolExecutionMs);
    const latencyMs =
      Number.isFinite(given) && given >= 0
        ? given
        : call?.startedAt
          ? Math.max(0, ts - Number(call.startedAt))
          : undefined;
    pathLog.push({
      type: 'tool-result',
      tool,
      toolCallId: id || call?.toolCallId || '',
      ok: resultOk(result, ev),
      result,
      ts,
      endedAt: ts,
      latencyMs
    });
    return;
  }

  if (type === 'tool-execution-end') {
    const id = String(ev.toolCallId || ev.id || '');
    const latencyMs = intMs(ev.latencyMs ?? ev.toolExecutionMs);
    if (latencyMs == null) return;
    for (let i = pathLog.length - 1; i >= 0; i--) {
      const p = pathLog[i];
      if (p.type === 'tool-result' && String(p.toolCallId) === id) {
        p.latencyMs = latencyMs;
        return;
      }
    }
    return;
  }

  if (type === 'model-start' || type === 'step') {
    pathLog.push({
      type: 'model',
      name: 'llm',
      index: ev.index != null ? Number(ev.index) : pathLog.filter((p) => p.type === 'model').length,
      model: ev.modelId || ev.model || '',
      thought: '',
      ts,
      startedAt: ts
    });
    return;
  }

  if (type === 'model-end' || type === 'finish-step') {
    const step = findOpenModel(pathLog);
    const usage = harvestModelUsage(ev.usage);
    const perf = ev.performance && typeof ev.performance === 'object' ? ev.performance : {};
    const modelId = ev.modelId || ev.response?.modelId || ev.model || '';
    const fr = finishReasonOf(ev.finishReason);
    const inferenceMs = inferenceMsFromModelEnd(ev, step);
    if (step) {
      if (usage && usage.source !== 'none') step.usage = usage;
      if (modelId) step.model = String(modelId);
      if (fr) step.finishReason = fr;
      step.inferenceMs = inferenceMs;
      step.latencyMs = inferenceMs;
      if (step.generatedAt != null) step.endedAt = Number(step.generatedAt);
      else if (step.startedAt != null) step.endedAt = Number(step.startedAt) + inferenceMs;
      else step.endedAt = ts;
      const toolMs = perf.toolExecutionMs;
      if (toolMs && typeof toolMs === 'object') {
        for (const [id, ms] of Object.entries(toolMs)) {
          const row = [...pathLog]
            .reverse()
            .find((p) => p.type === 'tool-result' && String(p.toolCallId) === String(id));
          if (row) row.latencyMs = intMs(ms);
        }
      }
    } else {
      pathLog.push({
        type: 'model',
        name: 'llm',
        model: modelId,
        usage,
        ts,
        endedAt: ts,
        inferenceMs,
        latencyMs: inferenceMs,
        finishReason: fr
      });
    }
    return;
  }

  if (type === 'model-meta') {
    const step = findOpenModel(pathLog);
    if (step && (ev.modelId || ev.model)) step.model = String(ev.modelId || ev.model);
    return;
  }

  if (type === 'pixels') {
    pathLog.push({
      type: 'host',
      name: 'pixels',
      itemId: ev.itemId || '',
      ok: ev.ok !== false,
      source: ev.source || '',
      byteLength: Number(ev.byteLength) || 0,
      code: ev.code || undefined,
      error: ev.error ? String(ev.error).slice(0, 240) : undefined,
      ts,
      latencyMs: intMs(ev.latencyMs)
    });
    return;
  }

  if (type === 'image_request') {
    pathLog.push({
      type: 'host',
      name: 'image_request',
      model: ev.model || '',
      protocol: ev.protocol || '',
      host: ev.host || '',
      path: ev.path || '',
      mode: ev.mode || '',
      refCount: Number(ev.refCount) || 0,
      ts,
      startedAt: ts
    });
    return;
  }

  if (type === 'image_generated') {
    const req = [...pathLog].reverse().find((p) => p.type === 'host' && p.name === 'image_request');
    const latencyMs = intMs(ev.latencyMs) ?? (req?.startedAt ? Math.max(0, ts - Number(req.startedAt)) : undefined);
    pathLog.push({
      type: 'host',
      name: 'image',
      model: ev.model || '',
      mode: ev.mode || '',
      artifactId: ev.artifactId || '',
      path: ev.path || '',
      downloadName: ev.downloadName || ev.name || '',
      mimeType: ev.mimeType || '',
      byteLength: Number(ev.byteLength) || 0,
      ok: true,
      ts,
      endedAt: ts,
      latencyMs
    });
    if (req && req.latencyMs == null && req.startedAt) {
      req.endedAt = ts;
      req.latencyMs = latencyMs;
    }
    return;
  }

  if (type === 'image_error') {
    const req = [...pathLog].reverse().find((p) => p.type === 'host' && p.name === 'image_request');
    const latencyMs = intMs(ev.latencyMs) ?? (req?.startedAt ? Math.max(0, ts - Number(req.startedAt)) : undefined);
    pathLog.push({
      type: 'host',
      name: 'image_error',
      model: ev.model || '',
      host: ev.host || '',
      path: ev.path || '',
      status: ev.status != null ? Number(ev.status) : undefined,
      code: ev.code || 'IMAGE_HTTP',
      error: ev.error ? String(ev.error).slice(0, 400) : '',
      ok: false,
      ts,
      endedAt: ts,
      latencyMs
    });
    if (req && req.latencyMs == null && req.startedAt) {
      req.endedAt = ts;
      req.latencyMs = latencyMs;
    }
    return;
  }

  if (type === 'compacting' || type === 'compact-done') {
    pathLog.push({
      type: 'host',
      name: 'compact',
      promptTokens: Number(ev.promptTokens) || 0,
      contextWindow: Number(ev.contextWindow) || 0,
      throughMessageId: ev.throughMessageId || undefined,
      text: ev.text ? String(ev.text).slice(0, MAX_COMPACT_PREVIEW) : undefined,
      ts
    });
    return;
  }

  if (type === 'turn-context') {
    pathLog.push({
      type: 'turn-context',
      ...compactTurnContext(ev),
      ts
    });
    return;
  }

  if (type === 'html_canvas_updated') {
    pathLog.push({
      type: 'host',
      name: 'canvas_updated',
      artifactId: String(ev.artifactId || ''),
      source: 'agent',
      ts
    });
    return;
  }

  if (type === 'artifact_preview') {
    pathLog.push({
      type: 'host',
      name: 'preview',
      artifactId: String(ev.artifactId || ''),
      kind: ev.kind || ev.shell || '',
      shell: ev.shell || '',
      fileName: ev.name ? String(ev.name).slice(0, 120) : '',
      path: ev.path ? String(ev.path).slice(0, 200) : '',
      source: 'agent',
      ts
    });
    return;
  }

  if (type === 'context-usage') {
    pathLog.push({
      type: 'host',
      name: 'context-usage',
      promptTokens: Number(ev.promptTokens) || 0,
      completionTokens: Number(ev.completionTokens) || 0,
      contextWindow: Number(ev.contextWindow) || 0,
      ratio: Number(ev.ratio) || 0,
      compacting: ev.compacting === true,
      ts
    });
    return;
  }

  if (type === 'session-title') {
    pathLog.push({
      type: 'host',
      name: 'session-title',
      title: String(ev.title || '').slice(0, 120),
      ts
    });
    return;
  }

  if (type === 'error') {
    pathLog.push({
      type: 'error',
      name: ev.name ? String(ev.name) : 'Error',
      message: ev.message ? String(ev.message).slice(0, 400) : '',
      code: ev.code != null && ev.code !== '' ? String(ev.code) : undefined,
      statusCode: ev.statusCode != null ? Number(ev.statusCode) : undefined,
      ok: false,
      ts
    });
    return;
  }

  if (type === 'assistant-final') {
    pathLog.push({
      type: 'assistant-final',
      content: clipBubble(ev.content || ''),
      ts
    });
    return;
  }

  if (type === 'execution-start' || type === 'execution-end') {
    pathLog.push({
      type,
      executionId: String(ev.executionId || ''),
      status: ev.status ? String(ev.status) : type === 'execution-start' ? 'running' : 'completed',
      ts
    });
  }
}

function clipBubble(text, max = MAX_BUBBLE_CHARS) {
  const s = text == null ? '' : String(text);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[+${s.length - max} chars]`;
}

/** Catalog nicknames (`~google/gemini-flash-latest`) are not the routed model. */
export function isCatalogAliasId(id) {
  return String(id || '').trim().startsWith('~');
}

function storedModelId(stored) {
  if (typeof stored === 'string') return stored.trim();
  if (stored && typeof stored === 'object') {
    return String(stored.id || stored.model || '').trim();
  }
  return '';
}

/**
 * Audit files keep the model the API actually served, not the picker alias.
 * @param {Array<object>|undefined} events
 * @param {string|{id?: string, model?: string}|undefined} stored
 * @returns {string}
 */
export function pickRoutedModelId(events, stored) {
  const fromEvents = [];
  for (const e of events || []) {
    if (e?.type !== 'model') continue;
    const id = String(e.model || '').trim();
    if (id) fromEvents.push(id);
  }
  const routed = fromEvents.find((id) => !isCatalogAliasId(id));
  if (routed) return routed;
  const fallback = storedModelId(stored);
  if (fallback && !isCatalogAliasId(fallback)) return fallback;
  return '';
}

function exportModelRef(events, stored) {
  const id = pickRoutedModelId(events, stored);
  return id ? { id } : undefined;
}

function exportBubble(m, events) {
  if (!m || typeof m !== 'object') return null;
  const role = m.role || 'unknown';
  /** @type {Record<string, unknown>} */
  const out = {
    role,
    content: clipBubble(m.content ?? m.text ?? ''),
    ts: isoTime(m.createdAt || m.ts) || isoTime(Date.now())
  };
  if (m.messageId) out.messageId = String(m.messageId);
  if (role === 'assistant') {
    const thought = String(m.thought || '').trim();
    if (thought) out.thought = clipBubble(thought, MAX_THOUGHT_CHARS);
    const model = exportModelRef(events || m.path, m.model);
    if (model) out.model = model;
    if (m.usage) out.usage = harvestModelUsage(m.usage);
    const timing = splitTurnTiming(events || m.path, m.latencyMs);
    out.timing = timing;
    out.latencyMs = timing.totalMs;
    const started = isoTime(m.startedAt);
    const ended = isoTime(m.endedAt);
    if (started) out.startedAt = started;
    if (ended) out.endedAt = ended;
    if (m.status && m.status !== 'completed') out.status = String(m.status);
  }
  return out;
}

function exportTurn(index, userMsg, assistant) {
  const events = mergeBehaviorPath({
    path: assistant?.path,
    toolCalls: assistant?.toolCalls || assistant?.traces,
    traces: assistant?.traces,
    wire: assistant?.wire
  });
  const finalText = String(assistant?.content ?? assistant?.finalText ?? '').trim();
  if (finalText && !events.some((e) => e.type === 'assistant-final')) {
    events.push({
      type: 'assistant-final',
      content: clipBubble(finalText),
      ts: isoTime(assistant?.createdAt || assistant?.endedAt) || undefined
    });
  }
  /** @type {Record<string, unknown>} */
  const turn = {
    index,
    status: String(assistant?.status || (assistant ? 'completed' : 'pending')),
    messageIds: {
      user: userMsg?.messageId ? String(userMsg.messageId) : '',
      assistant: assistant?.messageId ? String(assistant.messageId) : ''
    },
    events
  };
  const model = exportModelRef(events, assistant?.model);
  if (model) turn.model = model;
  if (assistant?.usage) turn.usage = harvestModelUsage(assistant.usage);
  const timing = splitTurnTiming(events, assistant?.latencyMs);
  turn.timing = timing;
  turn.latencyMs = timing.totalMs;
  const started = isoTime(assistant?.startedAt || userMsg?.createdAt);
  const ended = isoTime(assistant?.endedAt || assistant?.createdAt);
  if (started) turn.startedAt = started;
  if (ended) turn.endedAt = ended;
  if (Array.isArray(assistant?.wire) && assistant.wire.length) {
    turn.wire = slim(assistant.wire);
  }
  const ctxEv = events.find((e) => e?.type === 'turn-context');
  if (ctxEv) {
    const { type: _t, ts: _ts, ...rest } = ctxEv;
    turn.context = rest;
  }
  if (assistant?.error) {
    turn.error =
      typeof assistant.error === 'object'
        ? {
            code: String(assistant.error.code || ''),
            message: String(assistant.error.message || assistant.error).slice(0, 500)
          }
        : { message: String(assistant.error).slice(0, 500) };
  }
  return turn;
}

function countEvents(turns) {
  const byTool = {};
  const byHost = {};
  const byModel = {};
  let toolCount = 0;
  let hostCount = 0;
  let modelCount = 0;
  let latencyMs = 0;
  let inferenceMs = 0;
  let toolMs = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let usageSource = 'none';
  for (const turn of turns) {
    latencyMs += Number(turn.timing?.totalMs ?? turn.latencyMs) || 0;
    inferenceMs += Number(turn.timing?.inferenceMs) || 0;
    toolMs += Number(turn.timing?.toolMs) || 0;
    if (turn.usage) {
      promptTokens += Number(turn.usage.promptTokens) || 0;
      completionTokens += Number(turn.usage.completionTokens) || 0;
      if (turn.usage.source === 'api') usageSource = 'api';
      else if (usageSource === 'none' && turn.usage.source === 'estimate') usageSource = 'estimate';
    }
    for (const step of turn.events || []) {
      if (step?.type === 'tool-call') {
        toolCount += 1;
        const n = step.tool || 'tool';
        byTool[n] = (byTool[n] || 0) + 1;
      } else if (step?.type === 'host' || step?.type === 'turn-context') {
        hostCount += 1;
        const n = step.type === 'turn-context' ? 'turn-context' : step.name || 'host';
        byHost[n] = (byHost[n] || 0) + 1;
      } else if (step?.type === 'model') {
        modelCount += 1;
        const n = step.model || step.name || 'llm';
        byModel[n] = (byModel[n] || 0) + 1;
      }
    }
  }
  return {
    tools: toolCount,
    host: hostCount,
    modelCalls: modelCount,
    latencyMs,
    timing: { inferenceMs, toolMs, totalMs: latencyMs },
    usage: { source: usageSource, promptTokens, completionTokens },
    byTool,
    byHost,
    byModel
  };
}

/**
 * Full audit export: one bubble copy + causal events + wire appendix.
 * @param {object} [opts]
 */
export function serializeBehaviorTrajectory(opts = {}) {
  const session = opts.session || {};
  const rawMessages = Array.isArray(opts.messages) ? opts.messages : session.messages || [];
  const turns = [];
  const bubbles = [];
  let pendingUser = null;
  let turnIndex = 0;

  function flushOrphanUser() {
    if (!pendingUser) return;
    const bubble = exportBubble(pendingUser);
    if (bubble) bubbles.push(bubble);
    turns.push(exportTurn(turnIndex, pendingUser, null));
    turnIndex += 1;
    pendingUser = null;
  }

  for (const m of rawMessages) {
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'user') {
      flushOrphanUser();
      pendingUser = m;
      continue;
    }
    if (m.role !== 'assistant') continue;
    const userBubble = pendingUser ? exportBubble(pendingUser) : null;
    if (userBubble) bubbles.push(userBubble);
    const turn = exportTurn(turnIndex, pendingUser, m);
    const asstBubble = exportBubble(m, turn.events);
    if (asstBubble) bubbles.push(asstBubble);
    turns.push(turn);
    turnIndex += 1;
    pendingUser = null;
  }
  flushOrphanUser();

  const counts = countEvents(turns);
  const statuses = turns.map((t) => t.status).filter((s) => s && s !== 'completed' && s !== 'pending');
  const convStatus = statuses.includes('aborted')
    ? 'aborted'
    : statuses.includes('failed')
      ? 'failed'
      : opts.humanStatus && opts.humanStatus !== 'unknown'
        ? opts.humanStatus
        : 'completed';

  return {
    schema: BEHAVIOR_TRAJECTORY_SCHEMA,
    kind: 'audit',
    exportedAt: new Date().toISOString(),
    conversation: {
      sessionId: String(session.sessionId || session.id || opts.sessionId || ''),
      title: String(session.title || session.name || opts.title || ''),
      status: convStatus,
      humanStatus: opts.humanStatus || 'unknown',
      humanStatusNote: opts.humanStatusNote || '',
      humanStatusSetAt: opts.humanStatusSetAt || null
    },
    summary: {
      turns: turns.length,
      messages: bubbles.length,
      ...counts
    },
    messages: bubbles,
    turns
  };
}
