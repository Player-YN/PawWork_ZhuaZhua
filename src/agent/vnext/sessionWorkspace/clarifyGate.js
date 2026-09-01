/**
 * Control-plane clarify yield — pause the tool loop until the user answers.
 * Not a world capability (inspect/acquire/run). Host renders the card.
 */

/** @type {Map<string, { resolve: Function, reject: Function, sessionId: string, cleanup: Function }>} */
const pending = new Map();

export function newClarifyId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize model input to 1–4 questions. Host always adds Other in UI.
 * @param {object} input
 * @returns {Array<{question:string,header:string,multiSelect:boolean,options:Array<{label:string,description:string}>}>}
 */
export function normalizeClarifyQuestions(input = {}) {
  let raw = Array.isArray(input.questions) ? input.questions : null;
  if (!raw || !raw.length) {
    const q = String(input.question || input.text || '').trim();
    if (!q) return [];
    raw = [
      {
        question: q,
        header: input.header,
        options: input.options,
        multiSelect: input.multiSelect
      }
    ];
  }
  const out = [];
  for (const item of raw.slice(0, 4)) {
    if (!item) continue;
    const question = String(item.question || item.text || '').trim();
    if (!question) continue;
    const opts = [];
    const list = Array.isArray(item.options) ? item.options : [];
    for (const o of list.slice(0, 4)) {
      if (typeof o === 'string') {
        const label = o.trim();
        if (label) opts.push({ label, description: '' });
        continue;
      }
      const label = String(o?.label || o?.text || '').trim();
      if (!label) continue;
      opts.push({ label, description: String(o?.description || '').trim() });
    }
    out.push({
      question,
      header: String(item.header || '').trim().slice(0, 12),
      multiSelect: item.multiSelect === true,
      options: opts
    });
  }
  return out;
}

function abortError() {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * @param {{ clarifyId: string, sessionId?: string, signal?: AbortSignal }} args
 */
export function waitForClarifyAnswer({ clarifyId, sessionId, signal } = {}) {
  const id = String(clarifyId || '').trim();
  if (!id) return Promise.reject(new Error('clarifyId required'));
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const rec = pending.get(id);
      pending.delete(id);
      rec?.cleanup?.();
      reject(abortError());
    };
    const rec = {
      sessionId: String(sessionId || ''),
      resolve: (v) => {
        pending.delete(id);
        rec.cleanup();
        resolve(v);
      },
      reject: (e) => {
        pending.delete(id);
        rec.cleanup();
        reject(e);
      },
      cleanup: () => {
        try {
          signal?.removeEventListener('abort', onAbort);
        } catch {
          /* ignore */
        }
      }
    };
    pending.set(id, rec);
    try {
      signal?.addEventListener('abort', onAbort, { once: true });
    } catch {
      /* ignore */
    }
  });
}

/**
 * @param {{ clarifyId: string, answers: object }} args
 */
export function answerClarify(args = {}) {
  const id = String(args.clarifyId || '').trim();
  const rec = pending.get(id);
  if (!rec) return { ok: false, error: 'no pending clarify', code: 'NOT_PENDING' };
  rec.resolve(args.answers && typeof args.answers === 'object' ? args.answers : {});
  return { ok: true };
}

/** @param {string} [sessionId] omit to abort all */
export function abortSessionClarifies(sessionId) {
  const sid = sessionId != null ? String(sessionId) : null;
  for (const [id, rec] of [...pending.entries()]) {
    if (sid && rec.sessionId && rec.sessionId !== sid) continue;
    pending.delete(id);
    rec.cleanup?.();
    rec.reject(abortError());
  }
}

export function pendingClarifyCount() {
  return pending.size;
}
