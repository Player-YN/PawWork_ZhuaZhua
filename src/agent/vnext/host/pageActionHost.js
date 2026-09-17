/** Live-page action transport: explicit tab, serialized calls, document-bound snapshots. */
import { preparePersistentPageActionTarget, assertTabLeaseOwnerActive } from './tabLease.js';
import { createPageSnapshotRegistry, readDocumentTarget, targetError } from './documentTarget.js';

const snapshots = createPageSnapshotRegistry();
const actionQueues = new Map();
export function invalidatePageActionTarget(tabId) { snapshots.invalidate(tabId); }
const MUTATIONS = new Set(['click', 'fill', 'fill_form', 'select', 'press', 'scroll']);

function isRestrictedPageActionUrl(url) {
  const raw = String(url || '');
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('devtools://') ||
    lower.startsWith('view-source:')
  ) {
    return true;
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'chromewebstore.google.com') return true;
    if (host === 'chrome.google.com' && /\/webstore\b/.test(parsed.pathname)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function resolvePageActionTab(request) {
  const tabId = Number(request?.tabId ?? request?.defaultTabId);
  if (!Number.isInteger(tabId) || tabId <= 0) return { tabId: NaN, url: '', title: '' };
  const tab = await chrome.tabs.get(tabId);
  if (tab.pendingUrl && tab.pendingUrl !== tab.url) throw targetError('TARGET_CHANGED', 'Page navigation is in progress.');
  return { tabId, url: tab.url || '', title: String(tab.title || '') };
}

async function decorateTabLeaseDenied(denied) {
  if (!denied || denied.code !== 'TAB_LEASED') return denied;
  let title = denied.title || '';
  if (!title && denied.tabId) {
    try {
      title = String((await chrome.tabs.get(denied.tabId))?.title || '');
    } catch {
      /* holder tab may already be gone */
    }
  }
  return title ? { ...denied, title } : denied;
}

function withPageActionTab(result, tabId, title) {
  if (!result || typeof result !== 'object') return result;
  const id = Number(tabId);
  if (!Number.isFinite(id) || id <= 0 || result.tabId != null) return result;
  return title ? { ...result, tabId: id, title } : { ...result, tabId: id };
}


function parseActionRef(ref) {
  const s = String(ref || '').trim();
  if (!s) return null;
  const framed = s.match(/^f(\d+)\.(a\d+)$/i);
  if (framed) return { frameId: Number(framed[1]), local: framed[2].toLowerCase() };
  const local = s.match(/^(a\d+)$/i);
  if (local) return { frameId: null, local: local[1].toLowerCase() };
  return null;
}

async function listPageActionFrames(tabId) {
  if (chrome.webNavigation && typeof chrome.webNavigation.getAllFrames === 'function') {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      return (frames || []).filter((f) => {
        if (!f || !Number.isFinite(f.frameId)) return false;
        const lower = String(f.url || '').toLowerCase();
        if (
          lower.startsWith('chrome://') ||
          lower.startsWith('chrome-extension://') ||
          lower.startsWith('edge://') ||
          lower.startsWith('devtools://') ||
          lower.startsWith('view-source:')
        ) {
          return false;
        }
        return true;
      });
    } catch {
      /* permission or tab gone */
    }
  }
  return [{ frameId: 0 }];
}

async function sendPageActionToFrame(tabId, frameId, payload, expected = null) {
  const mutation = MUTATIONS.has(payload.op);
  if (mutation && !expected?.documentId) throw targetError('STALE_REF', 'Target frame was not in the snapshot.');
  const target = await readDocumentTarget(chrome, tabId, frameId, expected || {});
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'workspace_page_action', ...payload },
      { frameId, documentId: target.documentId });
  } catch (error) {
    if (mutation) throw Object.assign(targetError('ACTION_OUTCOME_UNKNOWN',
      'Page action response was lost. Inspect the page before deciding whether to retry.'), { outcome: 'unknown' });
    throw error;
  }
}

async function ensurePageActionScripts(tabId) {
  const frames = await listPageActionFrames(tabId);
  const missing = [];
  for (const fr of frames) {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { action: 'ping' }, { frameId: fr.frameId });
      if (pong && pong.status === 'pong') continue;
    } catch {
      /* not injected */
    }
    missing.push(fr.frameId);
  }
  if (!missing.length) return;
  const candidates = ['src/content_script.js', 'content_script.js'];
  for (const frameId of missing) {
    let injected = false;
    for (const file of candidates) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          files: [file]
        });
        injected = true;
        break;
      } catch {
        /* try next path */
      }
    }
    if (!injected) {
      for (const file of candidates) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            files: [file]
          });
          break;
        } catch {
          /* last resort */
        }
      }
    }
  }
}

function prefixFrameRefs(controls, frameId) {
  return (Array.isArray(controls) ? controls : []).map((c) => {
    if (!c || typeof c !== 'object') return c;
    const local = String(c.ref || '').replace(/^f\d+\./i, '');
    return { ...c, ref: 'f' + frameId + '.' + local };
  });
}

async function snapshotAllPageActionFrames(tabId) {
  const root = await readDocumentTarget(chrome, tabId, 0);
  await ensurePageActionScripts(tabId);
  const frames = await listPageActionFrames(tabId);
  const controls = [];
  const framesOut = [];
  for (const fr of frames) {
    try {
      const target = await readDocumentTarget(chrome, tabId, fr.frameId, fr);
      const raw = await sendPageActionToFrame(tabId, fr.frameId, { op: 'snapshot' }, target);
      if (!raw || raw.ok === false) continue;
      const list = prefixFrameRefs(raw.controls, fr.frameId);
      controls.push(...list);
      framesOut.push({ ...target, title: raw.title || '', count: list.length });
    } catch (error) {
      if (error?.code === 'TARGET_CHANGED') throw error;
      // Unreachable subframes are omitted, never assigned usable references.
    }
  }
  await readDocumentTarget(chrome, tabId, 0, root);
  for (const frame of framesOut) await readDocumentTarget(chrome, tabId, frame.frameId, frame);
  if (!framesOut.some(frame => frame.frameId === 0)) throw targetError('NEED_PAGE', 'No top-frame snapshot was returned.');
  const { rev } = snapshots.capture(tabId, framesOut);
  const capped = controls.slice(0, 80);
  return { ok: true, op: 'snapshot', rev, documentId: root.documentId,
    count: capped.length, controls: capped, frames: framesOut,
    after: { url: root.url, documentId: root.documentId, count: capped.length } };
}

async function observeAfterAction(tabId) {
  try { return await snapshotAllPageActionFrames(tabId); }
  catch (error) {
    snapshots.invalidate(tabId);
    return { observationError: { code: error?.code || 'NEED_PAGE', error: error?.message || String(error) } };
  }
}

function attachFreshSnapshot(result, snap) {
  if (!result || typeof result !== 'object' || !snap) return result;
  if (snap.observationError) return { ...result, observationError: snap.observationError };
  return {
    ...result,
    documentId: snap.documentId,
    rev: snap.rev,
    controls: snap.controls,
    count: snap.count,
    frames: snap.frames
  };
}

async function resolveNameAcrossFrames(tabId, name, snapshot) {
  const frames = snapshot?.frames || await listPageActionFrames(tabId);
  const hits = [];
  for (const fr of frames) {
    try {
      const raw = await sendPageActionToFrame(tabId, fr.frameId, { op: 'resolve_name', name }, fr);
      const matches = raw && Array.isArray(raw.matches) ? raw.matches : [];
      for (const m of matches) {
        if (!m || !m.ref) continue;
        hits.push({
          frameId: fr.frameId,
          local: String(m.ref).replace(/^f\d+\./i, ''),
          name: m.name || name,
          ref: 'f' + fr.frameId + '.' + String(m.ref).replace(/^f\d+\./i, '')
        });
      }
    } catch (error) {
      if (error?.code === 'TARGET_CHANGED') throw error;
    }
  }
  if (!hits.length) {
    return { ok: false, error: 'no control matches name', code: 'NO_TARGET' };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      error: 'name matches multiple controls',
      code: 'AMBIGUOUS',
      matches: hits.map((h) => ({ ref: h.ref, name: h.name }))
    };
  }
  return hits[0];
}

async function waitTextAnyFrame(tabId, request) {
  const frames = await listPageActionFrames(tabId);
  const started = Date.now();
  if (!frames.length) {
    return { ok: false, error: 'no frames', code: 'NEED_PAGE' };
  }
  const pending = frames.map((fr) =>
    sendPageActionToFrame(tabId, fr.frameId, {
      op: 'wait',
      text: request.text,
      ms: request.ms
    }).catch(() => null)
  );
  const hit = await new Promise((resolve) => {
    let left = pending.length;
    for (const p of pending) {
      p.then((r) => {
        if (r && r.ok) resolve(r);
        else if (--left === 0) resolve(null);
      });
    }
  });
  const snap = await observeAfterAction(tabId);
  if (hit) return attachFreshSnapshot({ ...hit, waited: hit.waited ?? Date.now() - started }, snap);
  return attachFreshSnapshot(
    { ok: false, error: 'wait timed out', code: 'NO_TARGET', waited: Date.now() - started },
    snap
  );
}

export function handleWorkspacePageAction(request) {
  const key = Number(request?.tabId ?? request?.defaultTabId);
  const previous = actionQueues.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => runWorkspacePageAction(request));
  actionQueues.set(key, pending);
  void pending.finally(() => { if (actionQueues.get(key) === pending) actionQueues.delete(key); }).catch(() => {});
  return pending;
}

async function runWorkspacePageAction(request) {
  let result;
  try { result = await executeWorkspacePageAction(request); }
  catch (error) { result = { ok: false, code: error?.code || 'NEED_PAGE', error: error?.message || String(error),
    ...(error?.outcome ? { outcome: error.outcome } : {}) }; }
  const tabId = Number(request?.tabId ?? request?.defaultTabId ?? result?.tabId);
  let title = result?.title;
  if ((!title || result?.tabId == null) && Number.isFinite(tabId) && tabId > 0) {
    try {
      title = title || String((await chrome.tabs.get(tabId))?.title || '');
    } catch {
      /* receipt title is optional */
    }
  }
  return withPageActionTab(result, tabId, title);
}

async function executeWorkspacePageAction(request) {
  const gated = await preparePersistentPageActionTarget(request);
  if (!gated.ok) return decorateTabLeaseDenied(gated);
  const resolved = await resolvePageActionTab(request);
  const tabId = resolved.tabId;
  if (!Number.isFinite(tabId) || tabId <= 0) {
    return { ok: false, error: 'page action requires an explicit tabId', code: 'NEED_EXPLICIT_TAB' };
  }
  if (isRestrictedPageActionUrl(resolved.url)) {
    return {
      ok: false,
      error: 'cannot act on chrome://, Web Store, or extension pages',
      code: 'NEED_PAGE'
    };
  }
  const op = String(request?.op || '').trim().toLowerCase();
  try {
    await ensurePageActionScripts(tabId);
  } catch (error) {
    return { ok: false, error: error?.message || String(error), code: error?.code || 'NEED_PAGE', ...(error?.outcome ? { outcome: error.outcome } : {}) };
  }

  if (op === 'snapshot') {
    return snapshotAllPageActionFrames(tabId);
  }

  const usesRef = !!request.ref || (Array.isArray(request.fields) && request.fields.some(f => f?.ref));
  const snapshot = MUTATIONS.has(op) || usesRef ? snapshots.require(tabId, request.rev) : null;
  if (snapshot) {
    for (const frame of snapshot.frames) await readDocumentTarget(chrome, tabId, frame.frameId, frame);
  }
  await assertTabLeaseOwnerActive(request.sessionId, request.executionId);

  if (op === 'wait' && request?.text && !request?.ref) {
    return waitTextAnyFrame(tabId, request);
  }

  if (op === 'fill_form') {
    const fields = Array.isArray(request.fields) ? request.fields : [];
    if (!fields.length) {
      return { ok: false, error: 'fields is required', code: 'BAD_INPUT' };
    }
    const byFrame = new Map();
    for (const field of fields) {
      if (!field || typeof field !== 'object') {
        return { ok: false, error: 'invalid field', code: 'BAD_INPUT' };
      }
      const parsed = parseActionRef(field.ref);
      if (parsed && parsed.frameId != null) {
        const list = byFrame.get(parsed.frameId) || [];
        list.push({ ...field, ref: parsed.local });
        byFrame.set(parsed.frameId, list);
        continue;
      }
      const name = field.name || field.label;
      if (name) {
        const hit = await resolveNameAcrossFrames(tabId, name, snapshot);
        if (hit.code) return hit;
        const list = byFrame.get(hit.frameId) || [];
        list.push({ ...field, ref: hit.local });
        byFrame.set(hit.frameId, list);
        continue;
      }
      return { ok: false, error: 'each field needs ref or name', code: 'BAD_INPUT' };
    }
    const results = [];
    let allOk = true;
    for (const [frameId, frameFields] of byFrame) {
      let raw;
      try {
        await assertTabLeaseOwnerActive(request.sessionId, request.executionId);
        raw = await sendPageActionToFrame(tabId, frameId, { op: 'fill_form', fields: frameFields }, snapshot?.frames.find(f => f.frameId === frameId));
      } catch (error) {
        allOk = false;
        results.push({
          ok: false,
          error: error?.message || String(error),
          code: error?.code || 'NEED_PAGE',
          outcome: error?.outcome
        });
        break;
      }
      if (!raw || typeof raw !== 'object' || typeof raw.ok !== 'boolean') {
        allOk = false;
        results.push({ ok: false, code: 'ACTION_OUTCOME_UNKNOWN', outcome: 'unknown',
          error: 'Missing form receipt. Some fields may have changed; inspect before retrying.' });
        break;
      }
      const rows = Array.isArray(raw.results) ? raw.results : [];
      if (!raw || raw.ok === false) allOk = false;
      for (const row of rows) {
        const local = row && row.ref ? String(row.ref).replace(/^f\d+\./i, '') : '';
        results.push({
          ...row,
          ref: local ? 'f' + frameId + '.' + local : row?.ref
        });
      }
      if (!rows.length && raw.ok === false) {
        results.push({ ok: false, error: raw.error, code: raw.code || 'NEED_PAGE' });
      }
      if (raw.ok === false || rows.some(row => row?.ok === false)) { allOk = false; break; }
    }
    const snap = await observeAfterAction(tabId);
    const failure = results.find(row => row?.ok === false);
    return attachFreshSnapshot({ ok: allOk, op: 'fill_form', results,
      ...(!allOk ? { partial: true, code: failure?.code || 'FORM_PARTIAL',
        ...(failure?.outcome ? { outcome: failure.outcome } : {}) } : {}) }, snap);
  }

  let frameId = null;
  let localRef = '';
  const parsed = parseActionRef(request?.ref);
  if (parsed) {
    frameId = parsed.frameId != null ? parsed.frameId : 0;
    localRef = parsed.local;
  } else if (request?.name || request?.label) {
    const hit = await resolveNameAcrossFrames(tabId, request.name || request.label, snapshot);
    if (hit.code) return hit;
    frameId = hit.frameId;
    localRef = hit.local;
  } else if (op === 'press' || (op === 'wait' && request?.ms != null && !request?.text && !request?.ref)) {
    frameId = 0;
  } else {
    return { ok: false, error: 'need ref or name', code: 'NO_TARGET' };
  }

  const payload = {
    op,
    ref: localRef || undefined,
    name: request?.name || request?.label,
    value: request?.value,
    key: request?.key,
    text: request?.text,
    ms: request?.ms
  };
  let raw;
  try {
    await assertTabLeaseOwnerActive(request.sessionId, request.executionId);
    raw = await sendPageActionToFrame(tabId, frameId, payload, snapshot?.frames.find(f => f.frameId === frameId));
  } catch (error) {
    return { ok: false, error: error?.message || String(error), code: error?.code || 'NEED_PAGE', ...(error?.outcome ? { outcome: error.outcome } : {}) };
  }
  if (!raw || typeof raw !== 'object' || typeof raw.ok !== 'boolean') {
    return { ok: false, error: 'Empty page action result; inspect before retrying.', code: 'ACTION_OUTCOME_UNKNOWN', outcome: 'unknown' };
  }
  if (raw.after && raw.after.ref) {
    raw.after = {
      ...raw.after,
      ref: 'f' + frameId + '.' + String(raw.after.ref).replace(/^f\d+\./i, '')
    };
  }
  const snap = await observeAfterAction(tabId);
  return attachFreshSnapshot(raw, snap);
}

