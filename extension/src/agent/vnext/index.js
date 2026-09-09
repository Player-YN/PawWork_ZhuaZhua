/**
 * Paw Work Runtime — public API barrel.
 *
 * Product path: Session Workspace Runtime (runSession.product.js).
 * See ../AGENTS.md (runtime) and ../../AGENTS.md (product map).
 */

export {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore,
  DurableSessionWorkspaceStore,
  createDurableSessionWorkspaceStore,
  sendMessage as sessionSendMessage,
  createSession as createSessionWorkspaceSession,
  ensureSession,
  deleteSession as deleteSessionWorkspace,
  bindGroupsToSession,
  getBoundGroupsCompact,
  createGroup,
  addWebItem,
  buildSessionAgentInstructions,
  PRODUCT_RUNTIME,
  PRODUCT_ENTRY,
  PRODUCT_STORE
} from './runSession.product.js';

export * from './sessionWorkspace/index.js';
export * from './primitives/index.js';
export * from './adapters/index.js';
export {
  listSkills,
  listSkillCatalog,
  getSkill,
  registerSkill,
  clearSkills,
  loadSkillInstructions,
  loadSkillResource,
  resolveSkillId,
  SKILL_ID_ALIASES,
  formatSkillsForSystemPrompt
} from './skills/registry.js';
export * from './host/index.js';
export { SessionWorkspaceService } from './service/sessionWorkspaceService.js';
