/**
 * Unified production path: sendMessage → AI SDK 7 ToolLoopAgent (toolChoice=auto).
 * No Task object, no chat/run mode split, no handwritten tool loop.
 */

import { createMessageId } from './ids.js';
import { createSessionGuestFs } from './fs.js';
import { beginExecution, settleExecution } from './execution.js';
import { getBoundGroupsCompact } from './groups.js';
import { listBoundItemIndex } from './itemLabel.js';
import { getArtifactIndexCompact, listArtifacts } from './artifacts.js';
import { compactShelfSnapshot } from './artifactShelf.js';
import { compactCanvasOverview, isPawCanvasDoc } from './engineCanvas.js';
import { buildSessionAgentInstructions, buildWorldStateBlock } from './prompt.js';
import { userRequestedPlan } from './planContract.js';
import { createSessionTools } from './tools.js';
import { inventoryFromSession } from './canvasInventory.js';
import { makeOfficePrepareStep, scheduleActiveToolNames } from './toolSchedule.js';
import { formatSkillsForSystemPrompt, listPackagedSkillCatalog } from '../skills/registry.js';
import { getDurableSkillStore, mergeSkillCatalog } from './skillStore.js';
import { formatRpcError } from '../host/rpcError.js';
import { isAbortLike, toAbortError, USER_STOP } from '../host/userStop.js';
import {
  buildWireFromTurn,
  replayWireMessages,
  attachWorldToLastUser,
  projectJsonForWire
} from './wireTranscript.js';
import {
  runSessionToolLoopAgent,
  createCallModelLanguageModel
} from './sessionAgent.js';
import { generateTaskTitle, isPlaceholderTaskTitle } from './taskTitle.js';
import {
  mergeBehaviorPath,
  recordBehaviorEvent,
  compactTurnContext,
  pickRoutedModelId,
  splitTurnTiming
} from './behaviorPath.js';
import {
  COMPACT_RATIO,
  shouldCompact,
  findCompactCutIndex,
  messagesAfterCompact,
  compactPrefixMessages,
  generateCompactText,
  estimateMessagesTokens,
  estimateTextTokens,
  harvestModelUsage,
  contextUsageRatio
} from './contextCompact.js';
import { resolveContextWindow } from '../../modelCatalog.js';
import { loadWebAcquireSettings } from '../../webAcquireSettings.js';
import { resolveFocusPage, rememberVisitedPage } from './pageContext.js';

/**
 * @param {import('./store.js').SessionWorkspaceStore} store
 * @param {{
 *   sessionId: string,
 *   content: string,
 *   mentions?: Array<{kind?:string,id?:string,groupId?:string,label?:string,handle?:string,url?:string}>,
 *   activeTab?: { url?: string, title?: string, origin?: string }|null,
 *   role?: string,
 *   callModel?: Function,
 *   model?: any,
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 *   onEvent?: (ev: object) => void
 * }} input
 */
export async function sendMessage(store, input) {
  const sessionId = String(input.sessionId || '');
  if (!sessionId) throw new Error('sendMessage: sessionId required');
  if (!store.has('sessions', sessionId)) throw new Error(`sendMessage: unknown session ${sessionId}`);

  const content = String(input.content ?? '');
  const role = input.role || 'user';
  const session = store.get('sessions', sessionId);
  const isFirstUser =
    role === 'user' && !(session.messages || []).some((m) => m?.role === 'user');
  const shouldName =
    isFirstUser &&
    !session.titleLocked &&
    isPlaceholderTaskTitle(session.title || session.name);
  const message = {
    messageId: createMessageId(),
    role,
    content,
    createdAt: Date.now()
  };
  const messages = [...(session.messages || []), message];
  store.put('sessions', sessionId, {
    ...session,
    messages,
    updatedAt: Date.now()
  });

  // Non-user messages: only append
  if (role !== 'user') {
    return {
      message,
      executionId: null,
      finalText: null,
      toolCalls: [],
      steps: [],
      createdTask: false
    };
  }

  const execution = beginExecution(store, sessionId, { abortSignal: input.signal });
  if (typeof input.onExecutionBegin === 'function') {
    try {
      input.onExecutionBegin({
        executionId: execution.executionId,
        sessionId
      });
    } catch {
      /* host abort registry must not fail the turn */
    }
  }
  // Cold start: OPFS bytes may not be in memory yet (readArtifact hydrates; agent must too)
  if (typeof store.hydrateSessionBlobs === 'function') {
    try {
      await store.hydrateSessionBlobs(sessionId);
    } catch {
      /* continue; missing blobs surface as ENOENT to tools */
    }
  }
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  try {
    fs.mkdirp('/artifacts');
    fs.mkdirp('/scratch');
  } catch {
    /* ignore */
  }

  const boundGroups = getBoundGroupsCompact(store, sessionId);
  const artifactIndex = getArtifactIndexCompact(store, sessionId);
  const pages = resolveFocusPage({
    activeTab: input.activeTab,
    mentions: input.mentions
  });
  if (pages.focusPage) rememberVisitedPage(store, sessionId, pages.focusPage);
  if (pages.activeTab && pages.activeTab.url !== pages.focusPage?.url) {
    rememberVisitedPage(store, sessionId, pages.activeTab);
  }
  const sessionNow = store.get('sessions', sessionId) || session;
  let activeHtml = sessionNow.activeHtml || null;
  if (activeHtml?.artifactId && fs) {
    try {
      const rec = (listArtifacts(store, sessionId) || []).find((a) => a.artifactId === activeHtml.artifactId);
      const raw = rec?.primaryPath ? fs.readFile(rec.primaryPath) : '';
      if (isPawCanvasDoc(raw)) {
        const overview = compactCanvasOverview(raw, activeHtml.selections || activeHtml.overview?.selections);
        if (overview) activeHtml = { ...activeHtml, overview: { ...(activeHtml.overview || {}), ...overview } };
      }
    } catch {
      /* overview is a hint */
    }
  }
  // Skills: description-based semantic routing by the model (no host keyword match)
  const durableSkills = await getDurableSkillStore().list();
  const skillCatalog = mergeSkillCatalog(listPackagedSkillCatalog(), durableSkills);
  const skillText = formatSkillsForSystemPrompt({
    sessionId,
    catalog: skillCatalog
  });
  const canvasInv = inventoryFromSession(store, sessionId, fs);
  const boundItems = listBoundItemIndex(store, sessionId);
  const system = buildSessionAgentInstructions({
    skillInstructions: skillText
  });
  const worldBlock = buildWorldStateBlock({
    boundGroups,
    boundItems,
    artifactCount: artifactIndex.artifactCount,
    focusedMentions: Array.isArray(input.mentions) ? input.mentions : [],
    activeWorkbook: sessionNow.activeWorkbook || null,
    activeHtml,
    canvases: canvasInv,
    activeTab: pages.activeTab,
    focusPage: pages.focusPage,
    shelf: compactShelfSnapshot(listArtifacts(store, sessionId), sessionNow.shelf),
    userRequestedPlan: userRequestedPlan({ content, mentions: input.mentions })
  });

  let thoughtBuf = '';
  /** Live tool + host path for trajectory export (not the chat bubble). */
  const pathLog = [];
  const upstreamEvent = typeof input.onEvent === 'function' ? input.onEvent : null;
  const onEvent = (ev) => {
    if (ev && typeof ev === 'object' && ev.type === 'thought') {
      const piece = ev.text != null ? ev.text : ev.chunk;
      if (typeof piece === 'string' && piece && piece !== '[object Object]') thoughtBuf += piece;
    }
    try {
      recordBehaviorEvent(pathLog, ev);
    } catch {
      /* path recorder must not fail the turn */
    }
    if (upstreamEvent) {
      try {
        upstreamEvent(ev);
      } catch {
        /* UI listener must not fail the turn */
      }
    }
  };

  recordBehaviorEvent(pathLog, {
    type: 'turn-context',
    ...compactTurnContext({
      tools: scheduleActiveToolNames(canvasInv),
      canvases: canvasInv,
      artifactCount: artifactIndex.artifactCount,
      boundGroups,
      boundItemCount: boundItems.length,
      mentions: input.mentions,
      activeWorkbook: sessionNow.activeWorkbook || null,
      activeHtml,
      activeTab: pages.activeTab,
      focusPage: pages.focusPage,
      skills: skillCatalog
    })
  });

  const webAcquire =
    input.webAcquire && typeof input.webAcquire === 'object'
      ? input.webAcquire
      : await loadWebAcquireSettings();
  const tools = createSessionTools({
    store,
    execution,
    fs,
    sessionId,
    signal: execution.abortSignal,
    fetchImpl: input.fetchImpl || globalThis.fetch,
    onEvent,
    waitForClarify: input.waitForClarify,
    webAcquire,
    hostSheet: typeof input.hostSheet === 'function' ? input.hostSheet : null,
    hostCanvas: typeof input.hostCanvas === 'function' ? input.hostCanvas : null,
    hostPageCapture: typeof input.hostPageCapture === 'function' ? input.hostPageCapture : null,
    hostFindTab: typeof input.hostFindTab === 'function' ? input.hostFindTab : null,
    activeTab: input.activeTab || pages.activeTab,
    focusPage: pages.focusPage,
    promptId: message.messageId || execution.executionId
  });

  const contextWindow =
    Number(input.contextWindow) > 2048
      ? Math.round(Number(input.contextWindow))
      : resolveContextWindow(input.modelId || input.model?.modelId);
  const emitUsage = (extra = {}) => {
    const sessNow = store.get('sessions', sessionId) || session;
    const usage = sessNow.contextUsage || {};
    const promptTokens = Number(extra.promptTokens ?? usage.promptTokens) || 0;
    const ev = {
      type: 'context-usage',
      sessionId,
      promptTokens,
      completionTokens: Number(extra.completionTokens ?? usage.completionTokens) || 0,
      contextWindow,
      ratio: contextUsageRatio(promptTokens, contextWindow),
      threshold: COMPACT_RATIO,
      compacting: extra.compacting === true
    };
    try {
      onEvent(ev);
    } catch {
      /* UI listener must not fail the turn */
    }
    return ev;
  };

  async function maybeCompactHistory(allMessages) {
    const sessNow = store.get('sessions', sessionId);
    const compact = sessNow?.compact || null;
    const live = messagesAfterCompact(allMessages, compact);
    const estimated =
      Number(sessNow?.contextUsage?.promptTokens) ||
      estimateTextTokens(system) +
        estimateTextTokens(worldBlock) +
        estimateMessagesTokens(compactPrefixMessages(compact)) +
        estimateMessagesTokens(live);
    if (
      !shouldCompact({
        promptTokens: estimated,
        contextWindow,
        messages: allMessages,
        compact
      })
    ) {
      emitUsage({ promptTokens: estimated });
      return { compact, live };
    }
    const cut = findCompactCutIndex(allMessages);
    const folded = allMessages.slice(0, cut);
    const throughMessageId = folded[folded.length - 1]?.messageId || null;
    emitUsage({ promptTokens: estimated, compacting: true });
    try {
      onEvent({ type: 'compacting', sessionId, contextWindow, promptTokens: estimated });
    } catch {
      /* ignore */
    }
    let text = '';
    try {
      text = await generateCompactText({
        model: await resolveSessionModel(input),
        callModel: input.callModel,
        messages: folded,
        prevText: compact?.text
      });
    } catch {
      text = '';
    }
    const nextCompact = {
      text: text || compact?.text || '',
      throughMessageId,
      createdAt: Date.now(),
      contextWindow
    };
    store.put('sessions', sessionId, {
      ...store.get('sessions', sessionId),
      compact: nextCompact,
      updatedAt: Date.now()
    });
    try {
      onEvent({
        type: 'compact-done',
        sessionId,
        throughMessageId,
        contextWindow,
        promptTokens: estimated,
        text: nextCompact.text
      });
    } catch {
      /* ignore */
    }
    const liveAfter = messagesAfterCompact(allMessages, nextCompact);
    emitUsage({
      promptTokens:
        estimateTextTokens(nextCompact.text) + estimateMessagesTokens(liveAfter)
    });
    return { compact: nextCompact, live: liveAfter };
  }

  const packed = await maybeCompactHistory(messages);
  const history = attachWorldToLastUser(
    [...compactPrefixMessages(packed.compact), ...replayWireMessages(packed.live)],
    worldBlock
  );

  /** @type {Promise<string>|null} */
  let titlePromise = null;
  try {
    let finalText = '';
    /** @type {Array<object>} */
    let steps = [];
    /** @type {Array<object>} */
    let toolCallsLog = [];
    let mode = 'none';
    /** @type {Array<object>|null} */
    let resultWire = null;
    let resultReasoning = '';
    let resultUsage = { promptTokens: 0, completionTokens: 0 };

    const model = await resolveSessionModel(input);
    const modelMeta = {
      id: String(input.modelId || model?.modelId || ''),
      provider: String(model?.provider || '')
    };
    titlePromise = shouldName
      ? generateTaskTitle({
          model,
          callModel: input.callModel,
          text: content
        })
          .then((named) => {
            if (!named) return named;
            try {
              onEvent({ type: 'session-title', title: named, sessionId });
            } catch {
              /* UI listener must not fail naming */
            }
            return named;
          })
          .catch((e) => {
            if (isAbortLike(e, execution.abortSignal)) return '';
            throw e;
          })
      : null;
    if (model) {
      const result = await runSessionToolLoopAgent({
        model,
        system,
        messages: history,
        tools,
        prepareStep: makeOfficePrepareStep({
          store,
          sessionId,
          fs,
          tools,
          execution,
          instructions: system
        }),
        signal: execution.abortSignal,
        onEvent
      });
      finalText = result.finalText || '';
      steps = result.steps || [];
      toolCallsLog = result.toolCalls || [];
      mode = result.mode || 'ToolLoopAgent';
      resultWire = result.wire || null;
      resultReasoning = result.reasoning || '';
      resultUsage = harvestModelUsage(result.usage);
    } else if (input.allowOfflineDirect === true) {
      // Explicit test/offline only — never silent fallback after user configured API
      finalText = defaultDirectAnswer(content, boundGroups, artifactIndex);
      mode = 'offline-direct';
    } else {
      // Product path without LanguageModel: fail loudly (UI shows error)
      const err = new Error(
        'NO_MODEL: 未连接到语言模型。请在设置中配置 API Key 与模型后重试。'
      );
      err.code = 'NO_MODEL';
      throw err;
    }

    const thought = String(resultReasoning || thoughtBuf || '').trim();
    const wire =
      Array.isArray(resultWire) && resultWire.length
        ? resultWire
        : buildWireFromTurn({
            thought,
            toolCalls: toolCallsLog,
            finalText
          });
    const endedAt = Date.now();
    const startedAt = Number(message.createdAt) || endedAt;
    if (!pathLog.some((p) => p.type === 'model') && (modelMeta.id || resultUsage.promptTokens)) {
      const otherMs = pathLog.reduce((n, p) => n + (Number(p.latencyMs) || 0), 0);
      const totalMs = Math.max(0, endedAt - startedAt);
      pathLog.unshift({
        type: 'model',
        name: 'llm',
        model: modelMeta.id,
        provider: modelMeta.provider,
        usage: resultUsage,
        synthetic: true,
        ts: startedAt,
        startedAt,
        endedAt,
        inferenceMs: Math.max(0, totalMs - otherMs),
        latencyMs: Math.max(0, totalMs - otherMs)
      });
    }
    const path = mergeBehaviorPath({
      path: pathLog,
      toolCalls: toolCallsLog,
      wire
    });
    const routedId = pickRoutedModelId(path, modelMeta);
    if (routedId) modelMeta.id = routedId;
    const wallMs = Math.max(0, endedAt - startedAt);
    const timing = splitTurnTiming(path, wallMs);
    const assistant = {
      messageId: createMessageId(),
      role: 'assistant',
      content: finalText,
      thought,
      status: 'completed',
      // Storage gets the bounded projection; the RPC return keeps the live
      // toolCallsLog for the current turn's UI traces.
      toolCalls: projectJsonForWire(toolCallsLog),
      path,
      wire,
      model: modelMeta,
      usage: resultUsage,
      timing,
      latencyMs: timing.totalMs,
      startedAt,
      endedAt,
      createdAt: endedAt
    };
    const sess2 = store.get('sessions', sessionId);
    let sessionTitle = sess2?.title || sess2?.name || session.title || session.name || '';
    if (titlePromise && !sess2?.titleLocked) {
      try {
        sessionTitle = (await titlePromise) || sessionTitle;
      } catch {
        /* keep placeholder */
      }
    }
    const promptTokens =
      resultUsage.promptTokens ||
      estimateTextTokens(system) + estimateTextTokens(worldBlock) + estimateMessagesTokens(history);
    const contextUsage = {
      promptTokens,
      completionTokens: resultUsage.completionTokens || 0,
      contextWindow,
      ratio: contextUsageRatio(promptTokens, contextWindow),
      updatedAt: Date.now()
    };
    store.put('sessions', sessionId, {
      ...sess2,
      title: sessionTitle,
      name: sessionTitle,
      titleLocked: !!sess2?.titleLocked,
      messages: [...(sess2.messages || []), assistant],
      contextUsage,
      updatedAt: Date.now()
    });
    emitUsage({
      promptTokens: contextUsage.promptTokens,
      completionTokens: contextUsage.completionTokens
    });

    settleExecution(store, execution, 'settled');
    try {
      onEvent({
        type: 'assistant-final',
        sessionId,
        executionId: execution.executionId,
        content: finalText
      });
      onEvent({
        type: 'execution-end',
        sessionId,
        executionId: execution.executionId,
        status: 'completed'
      });
    } catch {
      /* UI listener must not fail the turn */
    }

    return {
      message,
      assistant,
      executionId: execution.executionId,
      finalText,
      thought: assistant.thought,
      toolCalls: toolCallsLog,
      steps,
      createdTask: false,
      sessionTitle,
      contextUsage,
      boundGroups,
      artifactCount: getArtifactIndexCompact(store, sessionId).artifactCount,
      systemPromptPreview: system.slice(0, 200),
      sessionMessages: (store.get('sessions', sessionId)?.messages || []).length,
      agentMode: mode
    };
  } catch (err) {
    if (titlePromise) void titlePromise.catch(() => {});
    const aborted = isAbortLike(err, execution.abortSignal);
    const endedAt = Date.now();
    const startedAt = Number(message.createdAt) || endedAt;
    try {
      recordBehaviorEvent(pathLog, {
        type: 'error',
        name: aborted ? 'AbortError' : err?.name ? String(err.name) : 'Error',
        message: formatRpcError(err).slice(0, 400),
        code: aborted ? USER_STOP : String(err?.code || 'ERROR')
      });
      recordBehaviorEvent(pathLog, {
        type: 'execution-end',
        sessionId,
        executionId: execution.executionId,
        status: aborted ? 'aborted' : 'failed'
      });
      const sessFail = store.get('sessions', sessionId);
      const path = mergeBehaviorPath({ path: pathLog });
      const failTiming = splitTurnTiming(path, Math.max(0, endedAt - startedAt));
      const failAssistant = {
        messageId: createMessageId(),
        role: 'assistant',
        content: '',
        thought: String(thoughtBuf || '').trim(),
        status: aborted ? 'aborted' : 'failed',
        error: {
          code: aborted ? USER_STOP : String(err?.code || 'ERROR'),
          message: formatRpcError(err).slice(0, 500)
        },
        toolCalls: [],
        path,
        wire: [],
        timing: failTiming,
        latencyMs: failTiming.totalMs,
        startedAt,
        endedAt,
        createdAt: endedAt
      };
      store.put('sessions', sessionId, {
        ...sessFail,
        messages: [...(sessFail.messages || []), failAssistant],
        updatedAt: Date.now()
      });
    } catch {
      /* audit persist must not hide the original error */
    }
    settleExecution(store, execution, aborted ? 'aborted' : 'failed');
    try {
      onEvent({
        type: 'execution-end',
        sessionId,
        executionId: execution.executionId,
        status: aborted ? 'aborted' : 'failed'
      });
    } catch {
      /* UI listener must not fail the turn */
    }
    if (aborted) {
      const e = toAbortError(err);
      e.executionId = execution.executionId;
      throw e;
    }
    const wrapped = err instanceof Error && err.message && err.message !== '[object Object]'
      ? err
      : new Error(formatRpcError(err));
    if (wrapped !== err && err?.code) wrapped.code = err.code;
    throw wrapped;
  }
}

/**
 * Resolve LanguageModel for ToolLoopAgent.
 * Priority: explicit model → callModel adapter (tests) → null (offline).
 * Product service injects real LanguageModel via createPageWandLanguageModel.
 *
 * @param {{ model?: any, callModel?: Function }} input
 */
async function resolveSessionModel(input) {
  if (input.model) return input.model;
  if (typeof input.callModel === 'function') {
    return createCallModelLanguageModel(input.callModel);
  }
  return null;
}

function defaultDirectAnswer(content, boundGroups, artifactIndex) {
  const q = String(content || '').trim();
  if (!q) return '';
  const ambient =
    boundGroups?.length > 0
      ? ` (${boundGroups.length} group(s) bound as ambient context; not auto-inspected)`
      : '';
  const arts =
    artifactIndex?.artifactCount > 0 ? ` Session has ${artifactIndex.artifactCount} artifact(s).` : '';
  return `Acknowledged.${ambient}${arts} ${q.length > 200 ? q.slice(0, 200) + '…' : q}`;
}


