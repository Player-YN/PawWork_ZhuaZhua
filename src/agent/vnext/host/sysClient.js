/** One browser call, with an identity independent of the message port. */
export async function callBrowserSys({ op, params, sessionId, executionId, signal, deadline }) {
  signal?.throwIfAborted();
  const callId = crypto.randomUUID();
  const envelope = { target: 'pawwork-background', action: 'workspace_sys', sessionId, executionId, callId };
  const cancel = () => {
    void chrome.runtime.sendMessage({ ...envelope, op: 'cancel' }).catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await chrome.runtime.sendMessage({ ...envelope, op, params, deadline });
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
