/**
 * Product offscreen runtime — Session Workspace Service (unified sendMessage).
 */
import './silenceSdkWarnings.js';
import { SessionWorkspaceService } from '../agent/vnext/service/sessionWorkspaceService.js';
import { createSandboxCodeClient } from '../agent/vnext/adapters/sandboxClient.js';
import { formatRpcError } from '../agent/vnext/host/rpcError.js';
import { isAbortLike } from '../agent/vnext/host/userStop.js';

const sandboxFrame = document.getElementById('pawwork-code-sandbox');
const sandboxClient = createSandboxCodeClient(sandboxFrame);
globalThis.__PAWWORK_CODE_SANDBOX_RUN__ = (opts) => sandboxClient.run(opts);

// Workspace store/RPC must not wait on the code sandbox. getWorkspaceState /
// syncTabSelection only need IDB. Gating boot on sandbox.ready made a missed
// handshake take down selection chrome for 15s+ forever.
let servicePromise = SessionWorkspaceService.create();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'pawwork-offscreen' || message?.action !== 'workspace_rpc_execute') return false;
  void (async () => {
    try {
      const service = await servicePromise;
      const method = String(message.method || '');
      if (!method || typeof service[method] !== 'function' || method.startsWith('_')) {
        throw new Error(`unknown workspace method: ${method}`);
      }
      const result = await service[method](message.params || {});
      sendResponse({ ok: true, result });
    } catch (error) {
      try {
        sendResponse({ ok: false, error: formatRpcError(error) });
      } catch {
        /* port already closed */
      }
      if (!isAbortLike(error)) throw error;
    }
  })().catch((error) => {
    if (isAbortLike(error)) return;
    console.error('[offscreen] workspace rpc', error);
  });
  return true;
});
