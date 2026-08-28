/** Manifest-sandboxed guest host. No chrome.* APIs are available here. */
import { runCode } from '../agent/vnext/adapters/codeRuntime.js';

const CHANNEL = 'pawwork-code-sandbox-v1';
const fsPending = new Map();
const controllers = new Map();
let requestSeq = 0;

function callHostFs(runId, method, args) {
  const requestId = `${runId}:${++requestSeq}`;
  return new Promise((resolve, reject) => {
    fsPending.set(requestId, { resolve, reject });
    parent.postMessage({ channel: CHANNEL, type: 'fs-request', runId, requestId, method, args }, '*');
  });
}

function createFs(runId) {
  return {
    readFile: (...args) => callHostFs(runId, 'readFile', args),
    writeFile: (...args) => callHostFs(runId, 'writeFile', args),
    readdir: (...args) => callHostFs(runId, 'readdir', args),
    mkdir: (...args) => callHostFs(runId, 'mkdir', args),
    stat: (...args) => callHostFs(runId, 'stat', args),
    exists: (...args) => callHostFs(runId, 'exists', args),
    remove: (...args) => callHostFs(runId, 'remove', args),
    rm: (...args) => callHostFs(runId, 'remove', args)
  };
}

window.addEventListener('message', async (event) => {
  if (event.source !== parent) return;
  const msg = event.data;
  if (!msg || msg.channel !== CHANNEL) return;

  if (msg.type === 'fs-response') {
    const pending = fsPending.get(msg.requestId);
    if (!pending) return;
    fsPending.delete(msg.requestId);
    if (msg.ok) pending.resolve(msg.value);
    else pending.reject(new Error(msg.error || 'filesystem request failed'));
    return;
  }

  if (msg.type === 'abort') {
    controllers.get(msg.runId)?.abort();
    return;
  }

  if (msg.type !== 'run') return;
  const controller = new AbortController();
  controllers.set(msg.runId, controller);
  try {
    const result = await runCode({
      code: msg.payload?.code || '',
      entry: msg.payload?.entry || undefined,
      entryFile: msg.payload?.entryFile || undefined,
      files: msg.payload?.files || undefined,
      timeoutMs: msg.payload?.timeoutMs,
      memoryLimitBytes: msg.payload?.memoryLimitBytes,
      signal: controller.signal,
      fs: createFs(msg.runId),
      runtime: 'local-quickjs'
    });
    parent.postMessage({ channel: CHANNEL, type: 'run-result', runId: msg.runId, ok: true, result }, '*');
  } catch (error) {
    parent.postMessage({
      channel: CHANNEL,
      type: 'run-result',
      runId: msg.runId,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, '*');
  } finally {
    controllers.delete(msg.runId);
  }
});

function announceReady() {
  try {
    parent.postMessage({ channel: CHANNEL, type: 'ready' }, '*');
  } catch (_) {}
}
announceReady();
const readyPulse = setInterval(announceReady, 250);
window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  const msg = event.data;
  if (msg && msg.channel === CHANNEL && msg.type === 'ready-ack') {
    clearInterval(readyPulse);
  }
});
