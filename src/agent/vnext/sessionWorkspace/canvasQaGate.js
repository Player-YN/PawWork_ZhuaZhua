/**
 * Runtime canvas QA gate — policy + compact result. Assessment is assessCanvasScene.
 * Strict reject happens at persist/apply, never inside the pure QA module.
 */

import { assessCanvasScene, CANVAS_QA_VERSION } from './canvasQa.js';
import { getTheme, themeTokenBag } from './themeCatalog.js';

export const CANVAS_QA_FAILED = 'CANVAS_QA_FAILED';

const DECK_KINDS = new Set(['deck', 'slides']);

export function isDeckKind(kind) {
  return DECK_KINDS.has(String(kind || '').trim().toLowerCase());
}

function resolvedKind(ctx = {}) {
  if (isDeckKind(ctx.kind) || isDeckKind(ctx.shell) || isDeckKind(ctx.targetKind)) return 'deck';
  return String(ctx.kind || ctx.shell || ctx.targetKind || '').trim();
}

export function sceneHasLayoutId(compiled = {}, input = {}) {
  if (String(compiled.source || '') === 'layout') return true;
  if (String(input.layoutId || compiled.layoutId || '').trim()) return true;
  const frames = Array.isArray(compiled.frames) ? compiled.frames : Array.isArray(input.frames) ? input.frames : [];
  return frames.some((f) => f && (f.layoutId || f.meta?.pawLayout));
}

/**
 * @param {{ kind?: string, source?: string, op?: string, hasLayoutId?: boolean }} ctx
 * @returns {'strict'|'advisory'}
 */
export function qaGateMode(ctx = {}) {
  const op = String(ctx.op || '').trim();
  const source = String(ctx.source || '').trim();
  // Deck / Slides target always wins over entry-op advisory defaults.
  if (isDeckKind(resolvedKind(ctx))) return 'strict';
  if (ctx.hasLayoutId || source === 'layout' || op === 'replacePlate') return 'strict';
  return 'advisory';
}

/**
 * Map compiled createScene / layout frames onto assessCanvasScene input once.
 * Preserves pawRole / pawLayout / pawTheme / pawSlot on nodes.
 */
export function compiledSceneToQaInput(compiled = {}, opts = {}) {
  const kind = compiled.kind || opts.kind || '';
  const framesIn =
    Array.isArray(compiled.frames) && compiled.frames.length
      ? compiled.frames
      : compiled.nodes
        ? [
            {
              id: compiled.title || 'frame-1',
              nodes: compiled.nodes,
              size: compiled.size,
              layoutId: compiled.layoutId,
              themeId: compiled.themeId,
              w: compiled.size?.w,
              h: compiled.size?.h
            }
          ]
        : [];
  const themeIds = new Set();
  if (compiled.themeId) themeIds.add(String(compiled.themeId));
  if (opts.themeId) themeIds.add(String(opts.themeId));
  const frames = framesIn.filter(Boolean).map((f, i) => {
    const size = f.size && typeof f.size === 'object' ? f.size : {};
    const w = Number(opts.targetSize?.w || f.w || size.w || compiled.size?.w) || undefined;
    const h = Number(opts.targetSize?.h || f.h || size.h || compiled.size?.h) || undefined;
    const layoutId = String(f.layoutId || f.meta?.pawLayout || compiled.layoutId || '').trim();
    const themeId = String(f.themeId || f.meta?.pawTheme || compiled.themeId || '').trim();
    if (themeId) themeIds.add(themeId);
    for (const n of f.nodes || []) {
      const tid = n?.meta?.pawTheme || n?.themeId;
      if (tid) themeIds.add(String(tid));
    }
    const variant = String(f.variant || f.meta?.pawVariant || '').trim();
    return {
      id: String(f.id || f.name || `frame-${i + 1}`),
      w,
      h,
      size: w && h ? { w, h } : f.size,
      layout: layoutId,
      layoutId,
      themeId,
      variant,
      meta: {
        ...(f.meta && typeof f.meta === 'object' ? f.meta : {}),
        ...(layoutId ? { pawLayout: layoutId } : {}),
        ...(themeId ? { pawTheme: themeId } : {}),
        ...(variant ? { pawVariant: variant } : {})
      },
      nodes: Array.isArray(f.nodes) ? f.nodes : []
    };
  });
  const themes = [...themeIds]
    .map((id) => {
      const t = getTheme(id);
      if (!t) return null;
      return {
        id: t.id,
        tokens: themeTokenBag(id) || { paper: t.paper, ink: t.ink, muted: t.muted, accent: t.accent }
      };
    })
    .filter(Boolean);
  return {
    shell: isDeckKind(kind) ? 'slides' : 'design',
    themes,
    frames
  };
}

export function compactQa(result) {
  const metrics = result?.metrics && typeof result.metrics === 'object' ? { ...result.metrics } : {};
  delete metrics.frames;
  return {
    version: CANVAS_QA_VERSION,
    score: Number.isFinite(result?.score) ? result.score : 0,
    ok: result?.ok !== false,
    issues: (result?.issues || []).map((i) => ({
      code: i.code,
      severity: i.severity,
      frameId: i.frameId,
      metrics: i.metrics || {},
      message: i.message || ''
    })),
    metrics
  };
}

export function repairGuidance(assessed) {
  const issues = assessed?.issues || [];
  const hard = issues.filter((i) => i.severity === 'hard');
  const lines = (hard.length ? hard : issues).slice(0, 6).map((i) => {
    const where = i.frameId ? `${i.frameId}: ` : '';
    return `${where}${i.code} — ${i.message}`;
  });
  const score = Number.isFinite(assessed?.score) ? assessed.score : '?';
  return lines.length
    ? `CANVAS_QA_FAILED (score ${score}). Repair and resubmit the same target. ${lines.join(' ')}`
    : `CANVAS_QA_FAILED (score ${score}). Repair composition and resubmit the same target.`;
}

/**
 * @param {object} compiled createScene / compileLayoutFrame result
 * @param {{ op?: string, kind?: string, source?: string, mode?: string, targetSize?: {w:number,h:number}, themeId?: string }} [ctx]
 */
export function gateCompiledScene(compiled, ctx = {}) {
  if (!compiled || compiled.ok === false) {
    return { ok: true, mode: 'advisory', qa: compactQa({ ok: true, score: 100, issues: [], metrics: {} }) };
  }
  const kind = compiled.kind || ctx.kind || compiled.shell || compiled.canvas?.shell || ctx.shell || '';
  const source = compiled.source || ctx.source || '';
  const op = ctx.op || source || 'createScene';
  const hasLayoutId = sceneHasLayoutId(compiled, ctx);
  const mode = ctx.mode || qaGateMode({
    kind,
    source,
    op,
    hasLayoutId,
    shell: compiled.shell || compiled.canvas?.shell || ctx.shell
  });
  const input = compiledSceneToQaInput(compiled, { kind, targetSize: ctx.targetSize, themeId: ctx.themeId });
  const assessed = assessCanvasScene(input);
  const qa = compactQa(assessed);
  if (mode === 'strict' && assessed.ok === false) {
    return {
      ok: false,
      mode,
      qa,
      code: CANVAS_QA_FAILED,
      error: repairGuidance(assessed),
      score: assessed.score,
      issues: qa.issues
    };
  }
  return { ok: true, mode, qa };
}

/**
 * Semantic replacePlate: assess the compiled plate in the target frame box.
 */
export function gateReplacePlate(compiledFrame, opts = {}) {
  const size = opts.targetSize || compiledFrame?.size || {};
  const kind =
    opts.kind ||
    (Number(size.w) === 1920 && Number(size.h) === 1080 ? 'deck' : compiledFrame?.kind || 'poster');
  return gateCompiledScene(
    {
      ok: true,
      kind,
      source: 'layout',
      layoutId: compiledFrame?.layoutId,
      themeId: compiledFrame?.themeId || opts.themeId,
      frames: [compiledFrame],
      nodes: compiledFrame?.nodes,
      size: compiledFrame?.size
    },
    { op: 'replacePlate', mode: 'strict', kind, targetSize: opts.targetSize, themeId: compiledFrame?.themeId || opts.themeId }
  );
}

export function qaFailurePayload(gated, extra = {}) {
  return {
    ok: false,
    code: CANVAS_QA_FAILED,
    error: gated.error || 'CANVAS_QA_FAILED',
    score: gated.score,
    issues: gated.issues || gated.qa?.issues || [],
    qa: gated.qa,
    ...extra
  };
}
