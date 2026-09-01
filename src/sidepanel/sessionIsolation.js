/**
 * Session-scoped UI / tab matching. Empty sessionId never applies to the foreground task.
 */

export function shouldApplySessionBroadcast(payloadSessionId, activeSessionId) {
  const sid = String(payloadSessionId || '').trim();
  const active = String(activeSessionId || '').trim();
  if (!sid || !active) return false;
  return sid === active;
}

/** Thread with another sessionId (or none) must not paint on the foreground task. */
export function sessionThreadShouldHide(elSessionId, activeSessionId) {
  const sid = String(elSessionId || '').trim();
  const active = String(activeSessionId || '').trim();
  if (!active) return true;
  if (!sid) return true;
  return sid !== active;
}

export function sheetTabMatches(tabUrl, sessionId, artifactId) {
  const u = String(tabUrl || '');
  if (!u.includes('sheet.html')) return false;
  const sid = String(sessionId || '').trim();
  const aid = String(artifactId || '').trim();
  if (!sid || !aid) return false;
  try {
    const url = new URL(u);
    return url.searchParams.get('sessionId') === sid && url.searchParams.get('artifactId') === aid;
  } catch {
    return u.includes(`sessionId=${encodeURIComponent(sid)}`) && u.includes(`artifactId=${encodeURIComponent(aid)}`);
  }
}

/**
 * Workspace getSession wins when it already has an assistant (path / tools / text).
 * Otherwise keep local chrome.storage turns so a background finish is not exported as empty.
 */
export function mergeSessionTranscriptMessages(workspaceMsgs, localMsgs) {
  const workspace = Array.isArray(workspaceMsgs) ? workspaceMsgs.filter((m) => m && typeof m === 'object') : [];
  const local = Array.isArray(localMsgs) ? localMsgs.filter((m) => m && typeof m === 'object') : [];
  const workspaceHasAssistant = workspace.some(
    (m) =>
      m.role === 'assistant' &&
      (m.path || m.toolCalls || m.traces || String(m.content || '').trim())
  );
  if (workspaceHasAssistant) return workspace;
  const localHasAssistant = local.some((m) => m.role === 'assistant' && String(m.content || m.thought || '').trim());
  if (localHasAssistant) {
    if (!workspace.length) return local;
    const out = workspace.slice();
    const localAsst = local.filter((m) => m.role === 'assistant');
    const haveAsst = out.filter((m) => m.role === 'assistant').length;
    for (let i = haveAsst; i < localAsst.length; i++) out.push(localAsst[i]);
    return out;
  }
  return workspace.length ? workspace : local;
}

/**
 * Messages not yet represented in the parked thread (by role counts).
 * @param {object[]} messages
 * @param {{ user?: number, assistant?: number }} rendered
 */
export function pendingThreadMessages(messages, rendered = {}) {
  const haveUser = Number(rendered.user) || 0;
  const haveAsst = Number(rendered.assistant) || 0;
  const out = [];
  let seenUser = 0;
  let seenAsst = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'user') {
      seenUser += 1;
      if (seenUser > haveUser) out.push(m);
    } else if (m.role === 'assistant') {
      seenAsst += 1;
      if (seenAsst > haveAsst) out.push(m);
    }
  }
  return out;
}

export function htmlTabMatches(tabUrl, sessionId, artifactId) {
  const u = String(tabUrl || '');
  if (
    !u.includes('artifactPreview.html') &&
    !u.includes('docs.html') &&
    !u.includes('site.html') &&
    !u.includes('design.html')
  ) {
    return false;
  }
  const sid = String(sessionId || '').trim();
  const aid = String(artifactId || '').trim();
  if (!sid || !aid) return false;
  try {
    const url = new URL(u);
    return url.searchParams.get('sessionId') === sid && (url.searchParams.get('artifactId') === aid || (url.searchParams.get('ids') || '').split(',').includes(aid));
  } catch {
    return (
      u.includes(`sessionId=${encodeURIComponent(sid)}`) &&
      (u.includes(`artifactId=${encodeURIComponent(aid)}`) ||
        u.includes(aid))
    );
  }
}
