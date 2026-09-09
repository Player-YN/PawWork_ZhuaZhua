/** Session Workspace id helpers */

export function createSessionId(prefix = 'sess') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createExecutionId() {
  return `exec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createArtifactId() {
  return `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createGroupId() {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createWebItemId() {
  return `wi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
