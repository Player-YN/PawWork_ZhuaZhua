/**
 * Host adapters — product RPC surface only.
 * Sidepanel imports workspaceClient directly; this barrel is for public re-exports.
 * browserSysHost is the SW side of guest sys (workspace_sys), not a model tool.
 */

export { workspaceRpc } from './workspaceClient.js';
export { handleWorkspaceSys } from './browserSysHost.js';
