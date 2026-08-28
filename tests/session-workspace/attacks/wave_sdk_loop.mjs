/**
 * Structural + behavioral: product sendMessage MUST use AI SDK ToolLoopAgent,
 * MUST NOT contain handwritten runToolLoop.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  runSessionToolLoopAgent,
  createCallModelLanguageModel,
  serializeAgentError,
  asStreamText
} from '../../../src/agent/vnext/sessionWorkspace/sessionAgent.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sm = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/sendMessage.js'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/sessionAgent.js'), 'utf8');
const svc = fs.readFileSync(path.join(root, 'src/agent/vnext/service/sessionWorkspaceService.js'), 'utf8');

record(
  'sendMessage-no-handwritten-runToolLoop',
  !/async function runToolLoop/.test(sm) && !/function runToolLoop/.test(sm),
  ''
);
record(
  'sendMessage-imports-ToolLoopAgent-runner',
  /runSessionToolLoopAgent/.test(sm) && /sessionAgent\.js/.test(sm),
  ''
);
record(
  'sessionAgent-uses-vendor-ToolLoopAgent',
  /ToolLoopAgent/.test(agent) && /ai-sdk-loader/.test(agent),
  ''
);
record(
  'sessionAgent-no-step-count-cap',
  /neverStopOnStepCount/.test(agent) &&
    /stopWhen:\s*neverStopOnStepCount/.test(agent) &&
    !/stepCountIs\(/.test(agent),
  ''
);
record(
  'sessionAgent-streams-not-generate-only',
  /agent\.stream\(/.test(agent) && /onEvent/.test(agent),
  ''
);
{
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
  const railStart = side.indexOf('function renderSessionRailList');
  const railFn = railStart >= 0 ? side.slice(railStart, side.indexOf('function restoreFocusOutside')) : '';
  record(
    'sidepanel-session-rail-rename-pencil',
    /session-rail-item-rename-btn/.test(side) &&
      /function beginSessionRailRename/.test(side) &&
      /workspaceRpc\(\s*['"]renameSession['"]/.test(side) &&
      /ICONS\.pencil/.test(railFn) &&
      !/addEventListener\(\s*['"]dblclick['"]/.test(railFn) &&
      /\.session-rail-item-rename-btn/.test(css) &&
      /\.session-rail-item-rename\b/.test(css),
    ''
  );
  record(
    'sidepanel-listens-for-stream-events',
    /session_workspace_event/.test(side) && /beginLiveTurnUi/.test(side),
    ''
  );
  record(
    'sidepanel-live-progress-from-tools',
    /applyLiveProgress/.test(side) &&
      /ingestLiveProgressEvent/.test(side) &&
      /live-progress/.test(side) &&
      /ev\.type === 'tool-call'/.test(side) &&
      /ev\.type === 'model-end'/.test(side) &&
      /answerFlush/.test(side),
    ''
  );
  record(
    'beginLiveTurn-does-not-stringify-opts-object',
    /finishLiveTurnUi\(''/.test(side) && !/finishLiveTurnUi\(\{\s*discardEmpty/.test(side),
    ''
  );
  record(
    'sidepanel-execution-end-settles-live-ui',
    /ev\.type === 'assistant-final' \|\| ev\.type === 'execution-end'/.test(side) &&
      /function settleLiveTurnFromTerminalEvent/.test(side) &&
      /function finishLiveThinkBlocks/.test(side) &&
      /liveTurnSealed &&/.test(side) &&
      /type !== 'execution-end'/.test(side),
    ''
  );
  record(
    'composer-has-no-image-gen-chip',
    !/imageGenChipBtn/.test(html) && !/composer-bubble-image/.test(html),
    ''
  );
  record(
    'composer-at-mention-always-triggers',
    /function getAtQueryContext/.test(side) &&
      /@\(\[\^\\s@\/\]\*\)\$/.test(side) &&
      !/\(\^\\|\[\\s\\u00a0\]\)\(\[@\/\]\)/.test(side) &&
      /mentionComposing/.test(side),
    ''
  );
  record(
    'composer-typewriter-restored',
    /id="composerTypewriter"/.test(html) &&
      /function restartComposerTypewriter/.test(side) &&
      /I18N\[currentLang\]\?\.composerTypeLines/.test(side) &&
      /\.composer-typewriter/.test(css) &&
      !/#input\.is-empty::before/.test(css) &&
      !/id="worldStrip"/.test(html),
    ''
  );
}
{
  const css = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
  record('css-has-live-progress', /\.live-progress\b/.test(css) && /\.live-progress-orb/.test(css), '');
  const liveThreadDisabled =
    /^\.session-thread\s*\{[^}]*pointer-events:\s*none/m.test(css) &&
    !/\.session-thread\.is-history-view \.think-toggle/.test(css);
  record(
    'live-session-thread-clickable',
    !liveThreadDisabled &&
      /\.session-thread\.is-history-view \.think-toggle/.test(css) &&
      /pointer-events:\s*auto/.test(css),
    ''
  );
}
record(
  'asStreamText-drops-objects',
  asStreamText({ foo: 1 }) === '' &&
    asStreamText('[object Object]') === '' &&
    asStreamText({ text: 'ok' }) === 'ok' &&
    asStreamText('hello') === 'hello',
  ''
);
record(
  'service-uses-createPageWandLanguageModel',
  /createPageWandLanguageModel/.test(svc) && !/chatCompletion/.test(svc),
  ''
);

// Behavioral: agentMode must be ToolLoopAgent when callModel provided
{
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  service.ensureSession('s');
  let steps = 0;
  const res = await service.sendMessage({
    sessionId: 's',
    content: 'ping',
    callModel: async () => {
      steps += 1;
      return { text: 'hello-sdk-path', toolCalls: [] };
    }
  });
  record(
    'product-sendMessage-agentMode-ToolLoopAgent',
    res.agentMode === 'ToolLoopAgent' && res.finalText.includes('hello-sdk'),
    `mode=${res.agentMode} text=${res.finalText}`
  );
  record('callModel-invoked-via-adapter', steps >= 1, `steps=${steps}`);
}

// Stream events must reach host onEvent (Sidepanel live thinking/tokens)
{
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  service.ensureSession('stream');
  const events = [];
  const res = await service.sendMessage({
    sessionId: 'stream',
    content: 'ping',
    callModel: async () => ({ text: 'streamed-hello', toolCalls: [] }),
    onEvent: (ev) => events.push(ev)
  });
  const textChunks = events.filter((e) => e?.type === 'text').map((e) => e.chunk).join('');
  record(
    'sendMessage-onEvent-text-deltas',
    res.finalText.includes('streamed-hello') && /streamed-hello/.test(textChunks),
    `events=${events.map((e) => e.type).join(',')} text=${textChunks}`
  );
}

// Behavioral: multi-step tool via ToolLoopAgent
{
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  service.ensureSession('s2');
  let n = 0;
  const res = await service.sendMessage({
    sessionId: 's2',
    content: 'write',
    callModel: async () => {
      n += 1;
      if (n === 1) {
        return {
          text: null,
          toolCalls: [
            {
              toolName: 'run',
              args: { op: 'write_artifact', name: 'sdk.md', content: 'via-sdk' },
              toolCallId: 'c1'
            }
          ]
        };
      }
      return { text: 'created', toolCalls: [] };
    }
  });
  const arts = await service.listArtifacts({ sessionId: 's2' });
  record(
    'ToolLoopAgent-executes-session-tools',
    res.agentMode === 'ToolLoopAgent' && arts.length === 1 && n >= 2,
    `arts=${arts.length} n=${n} mode=${res.agentMode}`
  );
}

// Product: no stepCount cap (old default 12 / clamp 40). Loop until model stops tools.
{
  const service = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  service.ensureSession('s-uncapped');
  const PAST_OLD_CAP = 45;
  let n = 0;
  const res = await service.sendMessage({
    sessionId: 's-uncapped',
    content: 'keep going',
    callModel: async () => {
      n += 1;
      if (n <= PAST_OLD_CAP) {
        return {
          text: null,
          toolCalls: [
            {
              toolName: 'inspect',
              args: { view: 'groups' },
              toolCallId: `c${n}`
            }
          ]
        };
      }
      return { text: 'done-uncapped', toolCalls: [] };
    }
  });
  record(
    'ToolLoopAgent-no-step-cap-beyond-40',
    res.agentMode === 'ToolLoopAgent' && n === PAST_OLD_CAP + 1 && /done-uncapped/.test(res.finalText || ''),
    `n=${n} text=${res.finalText}`
  );
}

record(
  'runSessionToolLoopAgent-exported',
  typeof runSessionToolLoopAgent === 'function',
  ''
);

record(
  'sessionAgent-onError-serializes',
  /onError:\s*\(\{\s*error\s*\}\)/.test(agent) && /serializeAgentError/.test(agent),
  ''
);

{
  const events = [];
  const rawLogs = [];
  const origError = console.error;
  console.error = (...args) => {
    rawLogs.push(args.map((a) => (typeof a === 'string' ? a : String(a))));
  };
  const thrown = { name: 'APICallError', message: 'provider 429', code: 'rate_limit', statusCode: 429 };
  try {
    await runSessionToolLoopAgent({
      model: createCallModelLanguageModel(async () => {
        throw thrown;
      }),
      tools: {},
      messages: [{ role: 'user', content: 'hi' }],
      onEvent: (ev) => events.push(ev)
    });
  } catch {
    /* expected */
  } finally {
    console.error = origError;
  }
  const errEv = events.find((e) => e && e.type === 'error');
  const serialized = serializeAgentError(thrown);
  record(
    'stream-error-serialized-event',
    errEv &&
      errEv.name === 'APICallError' &&
      errEv.message === 'provider 429' &&
      errEv.code === 'rate_limit' &&
      Number(errEv.statusCode) === 429 &&
      serialized.message === 'provider 429',
    errEv ? `${errEv.name}:${errEv.message}` : 'no error event'
  );
  record(
    'stream-error-no-object-object-log',
    !rawLogs.some((line) => line.some((s) => s === '[object Object]')),
    rawLogs.flat().join(' | ').slice(0, 120)
  );
}

console.log(`\nsdk-loop summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('SDK LOOP PASS: product path is ToolLoopAgent only');
