/**
 * Host-side client for the manifest sandboxed code runtime.
 *
 * Generated source is executed only in the sandboxed extension page, which has
 * no extension APIs. Filesystem calls are relayed to the current task FS held
 * by the offscreen host. The sandbox never receives chrome.*, DOM handles, or
 * a reference to Workspace storage.
 */
const CHANNEL = 'pawwork-code-sandbox-v1';

export function createSandboxCodeClient(iframe) {
  if (!iframe) throw new Error('sandbox iframe required');
  const runs = new Map();
  let readyResolved = false;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const readyTimer = setTimeout(() => {
    if (readyResolved) return;
    console.warn('[sandbox] guest did not become ready within 15s — code run will fail until handshake');
    readyReject(new Error('code sandbox did not become ready'));
  }, 15000);

  function guestWindow() {
    return iframe.contentWindow || null;
  }

  async function onMessage(event) {
    if (event.source !== guestWindow()) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL) return;

    if (msg.type === 'ready') {
      try {
        event.source?.postMessage({ channel: CHANNEL, type: 'ready-ack' }, '*');
      } catch (_) {}
      if (!readyResolved) {
        readyResolved = true;
        clearTimeout(readyTimer);
        readyResolve(true);
      }
      return;
    }

    if (msg.type === 'fs-request') {
      const run = runs.get(msg.runId);
      if (!run) return;
      const target = guestWindow();
      if (!target) return;
      try {
        const method = normalizeFsMethod(msg.method);
        const fn = run.fs?.[method];
        if (typeof fn !== 'function') throw new Error(`fs.${method} unavailable`);
        const value = await fn.apply(run.fs, Array.isArray(msg.args) ? msg.args : []);
        target.postMessage({ channel: CHANNEL, type: 'fs-response', runId: msg.runId, requestId: msg.requestId, ok: true, value }, '*');
      } catch (error) {
        target.postMessage({
          channel: CHANNEL,
          type: 'fs-response',
          runId: msg.runId,
          requestId: msg.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }, '*');
      }
      return;
    }

    if (msg.type === 'run-result') {
      const run = runs.get(msg.runId);
      if (!run) return;
      cleanupRun(msg.runId, run);
      if (msg.ok) run.resolve(msg.result);
      else run.reject(new Error(msg.error || 'sandbox run failed'));
    }
  }

  function cleanupRun(runId, run) {
    runs.delete(runId);
    if (run.timer) clearTimeout(run.timer);
    if (run.signal && run.onAbort) run.signal.removeEventListener('abort', run.onAbort);
  }

  window.addEventListener('message', onMessage);

  return {
    ready,
    async run(opts = {}) {
      await ready;
      const target = guestWindow();
      if (!target) throw new Error('code sandbox frame missing');
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const runId = crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return new Promise((resolve, reject) => {
        const timeoutMs = Math.max(1, Math.min(Number(opts.timeoutMs) || 15000, 120000));
        const onAbort = () => {
          target.postMessage({ channel: CHANNEL, type: 'abort', runId }, '*');
        };
        const timer = setTimeout(() => {
          const run = runs.get(runId);
          if (!run) return;
          target.postMessage({ channel: CHANNEL, type: 'abort', runId }, '*');
          cleanupRun(runId, run);
          reject(new Error(`sandbox host timeout after ${timeoutMs + 2000}ms`));
        }, timeoutMs + 2000);
        runs.set(runId, { resolve, reject, fs: opts.fs, signal: opts.signal, onAbort, timer });
        opts.signal?.addEventListener('abort', onAbort, { once: true });
        target.postMessage({
          channel: CHANNEL,
          type: 'run',
          runId,
          payload: {
            code: String(opts.code || ''),
            entry: opts.entry == null ? null : String(opts.entry),
            entryFile: opts.entryFile == null ? null : String(opts.entryFile),
            files: opts.files && typeof opts.files === 'object' ? opts.files : null,
            timeoutMs,
            memoryLimitBytes: opts.memoryLimitBytes
          }
        }, '*');
      });
    },
    dispose() {
      window.removeEventListener('message', onMessage);
      clearTimeout(readyTimer);
      for (const [runId, run] of runs) {
        cleanupRun(runId, run);
        run.reject(new Error('sandbox client disposed'));
      }
    }
  };
}

function normalizeFsMethod(name) {
  const value = String(name || '');
  if (value === 'rm') return 'remove';
  const allowed = new Set(['readFile', 'writeFile', 'readdir', 'mkdir', 'stat', 'exists', 'remove']);
  if (!allowed.has(value)) throw new Error(`unsupported fs method: ${value}`);
  return value;
}
