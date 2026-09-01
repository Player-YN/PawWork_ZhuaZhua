/** Product client for the offscreen Web Workspace Runtime. */
import { formatRpcError } from './rpcError.js';

export async function workspaceRpc(method, params = {}) {
  const response = await chrome.runtime.sendMessage({
    target: 'pawwork-background',
    action: 'workspace_rpc',
    method,
    params
  });
  if (!response?.ok) {
    const detail =
      formatRpcError(response?.error) ||
      (response == null ? 'no response (offscreen not ready)' : 'unknown');
    throw new Error(`workspace RPC failed: ${method}: ${detail}`);
  }
  return response.result;
}
