/**
 * Service-worker side of pawwork-sys-v1.
 * Guest never sees chrome.*. This file is the syscall implementation.
 */

import { isInjectableTabUrl, isPawWorkTabUrl } from '../sessionWorkspace/pageContext.js';
import { SYS_EVAL_JSON_MAX, SYS_EVAL_SOURCE_MAX, SYS_FETCH_BYTES_MAX, SYS_HELP } from '../sessionWorkspace/browserSys.js';

const SYS_TIMEOUT_MS = 20000;
const SYS_CDP_TIMEOUT_MS = 60000;
const SYS_CDP_RESULT_MAX = 6_000_000;
const SYS_CDP_EVENT_CAP = 300;
const SYS_CDP_EVENT_JSON_MAX = 8000;
const CDP_PROTOCOL = '1.3';

/** @type {Set<string>} */
const cdpAttached = new Set();
/** @type {Map<string, Array<{ method: string, params: unknown, ts: number }>>} */
const cdpEventBuf = new Map();

installCdpHooks();

export async function handleWorkspaceSys(request = {}) {
  const op = String(request.op || '');
  const params = request.params && typeof request.params === 'object' ? request.params : {};
  try {
    if (op === 'help') return { ok: true, result: SYS_HELP };
    if (op === 'tabs.list') return { ok: true, result: await sysTabsList() };
    if (op === 'tabs.current') return { ok: true, result: await sysTabsCurrent(params) };
    if (op === 'tabs.frames') return { ok: true, result: await sysTabsFrames(params) };
    if (op === 'eval') return await sysEval(params);
    if (op === 'fetch') return await sysFetch(params);
    if (op === 'cdp') return await sysCdp(params);
    if (op === 'download') return await sysDownload(params);
    if (op === 'screenshot') return await sysScreenshot(params);
    if (op === 'tabs.open') return await sysTabsOpen(params);
    if (op === 'tabs.navigate') return await sysTabsNavigate(params);
    if (op === 'tabs.reload') return await sysTabsReload(params);
    if (op === 'tabs.close') return await sysTabsClose(params);
    if (op === 'tabs.focus') return await sysTabsFocus(params);
    return { ok: false, code: 'BAD_INPUT', error: `unknown sys op: ${op}` };
  } catch (error) {
    return {
      ok: false,
      code: error?.code || 'SYS_FAILED',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function sysTabsList() {
  const tabs = await chrome.tabs.query({});
  return tabs.map((tab) => publicTab(tab));
}

async function sysTabsCurrent(params) {
  const tab = await resolveTab(params);
  return publicTab(tab);
}

async function sysTabsFrames(params) {
  const tab = await resolveTab(params);
  if (typeof chrome.webNavigation?.getAllFrames !== 'function') {
    return [{ frameId: 0, parentFrameId: -1, url: tab.url || '' }];
  }
  const frames = (await chrome.webNavigation.getAllFrames({ tabId: tab.id })) || [];
  return frames.map((f) => ({
    frameId: f.frameId,
    parentFrameId: f.parentFrameId,
    url: f.url || '',
    injectable: isSysInjectableUrl(f.url)
  }));
}

async function sysTabsOpen(params) {
  const url = String(params.url || 'about:blank').trim();
  if (!isNavigableUrl(url)) {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.tabs.open only allows http(s) or about:blank' };
  }
  const tab = await chrome.tabs.create({
    url,
    active: params.active !== false
  });
  return { ok: true, result: publicTab(tab) };
}

async function sysTabsNavigate(params) {
  const url = String(params.url || '').trim();
  if (!isNavigableUrl(url)) {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.tabs.navigate only allows http(s) or about:blank' };
  }
  const tab = await resolveTab(params);
  const updated = await chrome.tabs.update(tab.id, { url });
  return { ok: true, result: publicTab(updated || tab) };
}

async function sysTabsReload(params) {
  const tab = await resolveTab(params);
  await chrome.tabs.reload(tab.id, { bypassCache: params.bypassCache === true });
  return { ok: true, result: publicTab(await chrome.tabs.get(tab.id)) };
}

async function sysTabsClose(params) {
  const tab = await resolveTab(params);
  await chrome.tabs.remove(tab.id);
  return { ok: true, result: { closed: tab.id } };
}

async function sysTabsFocus(params) {
  const tab = await resolveTab(params);
  if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
  const updated = await chrome.tabs.update(tab.id, { active: true });
  return { ok: true, result: publicTab(updated || tab) };
}

async function sysDownload(params) {
  let url = String(params.url || '').trim();
  if (params.base64 != null && String(params.base64)) {
    const mime = String(params.mimeType || 'application/octet-stream').replace(/[^\w.+/-]/g, '') || 'application/octet-stream';
    url = `data:${mime};base64,${String(params.base64).replace(/\s+/g, '')}`;
  }
  if (!url) return { ok: false, code: 'BAD_INPUT', error: 'sys.download requires url or base64' };
  if (!/^https?:/i.test(url) && !url.startsWith('data:')) {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.download only allows http(s) or data: url' };
  }
  const filename = sanitizeDownloadName(params.filename);
  const downloadId = await chrome.downloads.download({
    url,
    filename: filename || undefined,
    saveAs: params.saveAs === true,
    conflictAction: 'uniquify'
  });
  return { ok: true, result: { downloadId, filename: filename || null } };
}

async function sysScreenshot(params) {
  const tab = await resolveTab(params);
  const format = String(params.format || 'png').toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format,
    quality: format === 'jpeg' ? 90 : undefined
  });
  const parsed = splitDataUrl(dataUrl);
  if (!parsed) return { ok: false, code: 'SYS_FAILED', error: 'screenshot produced no image' };
  if (parsed.base64.length > SYS_CDP_RESULT_MAX) {
    return { ok: false, code: 'TOO_LARGE', error: 'screenshot exceeds cap', bytes: parsed.base64.length };
  }
  return {
    ok: true,
    result: {
      tabId: tab.id,
      format,
      contentType: parsed.contentType,
      base64: parsed.base64
    }
  };
}

async function sysCdp(params) {
  if (!chrome.debugger?.attach) {
    return { ok: false, code: 'SYS_DENIED', error: 'chrome.debugger unavailable (need debugger permission)' };
  }
  const action = String(params.action || (params.method ? 'send' : '')).toLowerCase();
  if (action === 'targets') {
    const targets = await chrome.debugger.getTargets();
    return {
      ok: true,
      result: (targets || []).map((t) => ({
        attached: t.attached === true,
        type: t.type || '',
        title: t.title || '',
        url: t.url || '',
        tabId: t.tabId ?? null,
        targetId: t.id || null
      }))
    };
  }

  const debuggee = await resolveDebuggee(params);
  if (action === 'attach') {
    await ensureCdpAttached(debuggee);
    return { ok: true, result: { attached: true, ...publicDebuggee(debuggee) } };
  }
  if (action === 'detach') {
    await detachCdp(debuggee);
    return { ok: true, result: { attached: false, ...publicDebuggee(debuggee) } };
  }
  if (action === 'events') {
    const key = debuggeeKey(debuggee);
    const list = cdpEventBuf.get(key) || [];
    if (params.clear === true) cdpEventBuf.set(key, []);
    return { ok: true, result: { ...publicDebuggee(debuggee), events: list, count: list.length } };
  }
  if (action !== 'send' && !params.method) {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.cdp needs method or action attach|detach|events|targets' };
  }

  const method = String(params.method || '');
  if (!method || method.startsWith('_')) {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.cdp method required' };
  }
  await ensureCdpAttached(debuggee);
  const cdpParams = params.params && typeof params.params === 'object' ? params.params : {};
  let raw;
  try {
    const cmd =
      Object.keys(cdpParams).length > 0
        ? chrome.debugger.sendCommand(debuggee, method, cdpParams)
        : chrome.debugger.sendCommand(debuggee, method);
    raw = await withTimeout(cmd, SYS_CDP_TIMEOUT_MS, `sys.cdp ${method} timed out`);
  } catch (error) {
    return {
      ok: false,
      code: 'CDP_FAILED',
      error: error instanceof Error ? error.message : String(error),
      method,
      ...publicDebuggee(debuggee)
    };
  }
  const clipped = clipCdpResult(raw);
  if (clipped.tooLarge) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      error: `sys.cdp ${method} result exceeds ${SYS_CDP_RESULT_MAX} chars`,
      bytes: clipped.bytes
    };
  }
  return { ok: true, result: { method, ...publicDebuggee(debuggee), result: clipped.value } };
}

function installCdpHooks() {
  if (!chrome.debugger?.onEvent) return;
  chrome.debugger.onEvent.addListener((source, method, eventParams) => {
    const key = debuggeeKey(source);
    if (!key) return;
    const list = cdpEventBuf.get(key) || [];
    list.push({
      method: String(method || ''),
      params: clipCdpEventParams(eventParams),
      ts: Date.now()
    });
    if (list.length > SYS_CDP_EVENT_CAP) list.splice(0, list.length - SYS_CDP_EVENT_CAP);
    cdpEventBuf.set(key, list);
  });
  chrome.debugger.onDetach.addListener((source) => {
    const key = debuggeeKey(source);
    if (key) cdpAttached.delete(key);
  });
}

async function resolveDebuggee(params) {
  if (params.targetId) return { targetId: String(params.targetId) };
  const tab = await resolveTab(params);
  if (!isCdpAttachableUrl(tab.url)) {
    const err = new Error(`tab is not attachable: ${tab.url || '(no url)'}`);
    err.code = 'NEED_PAGE';
    throw err;
  }
  return { tabId: tab.id };
}

async function ensureCdpAttached(debuggee) {
  const key = debuggeeKey(debuggee);
  if (cdpAttached.has(key)) return;
  try {
    await chrome.debugger.attach(debuggee, CDP_PROTOCOL);
    cdpAttached.add(key);
    if (!cdpEventBuf.has(key)) cdpEventBuf.set(key, []);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/already attached/i.test(msg)) {
      cdpAttached.add(key);
      return;
    }
    const err = new Error(msg);
    err.code = /Another debugger|already attached|attached/i.test(msg) ? 'CDP_BUSY' : 'SYS_DENIED';
    throw err;
  }
}

async function detachCdp(debuggee) {
  const key = debuggeeKey(debuggee);
  try {
    await chrome.debugger.detach(debuggee);
  } catch {
    /* already detached */
  }
  cdpAttached.delete(key);
}

function debuggeeKey(debuggee) {
  if (!debuggee || typeof debuggee !== 'object') return '';
  if (debuggee.targetId) return `target:${debuggee.targetId}`;
  if (debuggee.tabId != null) return `tab:${debuggee.tabId}`;
  return '';
}

function publicDebuggee(debuggee) {
  return {
    tabId: debuggee.tabId ?? null,
    targetId: debuggee.targetId ?? null
  };
}

function clipCdpResult(value) {
  if (value == null) return { value: null, tooLarge: false, bytes: 0 };
  let json;
  try {
    json = JSON.stringify(value);
  } catch {
    return { value: { note: 'NOT_CLONEABLE' }, tooLarge: false, bytes: 0 };
  }
  if (json.length > SYS_CDP_RESULT_MAX) return { value: null, tooLarge: true, bytes: json.length };
  return { value, tooLarge: false, bytes: json.length };
}

function clipCdpEventParams(params) {
  try {
    const json = JSON.stringify(params);
    if (!json) return params ?? null;
    if (json.length <= SYS_CDP_EVENT_JSON_MAX) return params;
    return { truncated: true, preview: json.slice(0, SYS_CDP_EVENT_JSON_MAX) };
  } catch {
    return { note: 'NOT_CLONEABLE' };
  }
}

function isNavigableUrl(url) {
  const s = String(url || '');
  if (s === 'about:blank') return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isCdpAttachableUrl(url) {
  return isSysInjectableUrl(url);
}

function sanitizeDownloadName(name) {
  const raw = String(name || '').replace(/\\/g, '/').split('/').pop() || '';
  const cleaned = raw.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim();
  return cleaned.slice(0, 180);
}

function splitDataUrl(dataUrl) {
  const s = String(dataUrl || '');
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(s);
  if (!m) return null;
  return { contentType: m[1] || 'application/octet-stream', base64: m[3] || '' };
}

async function sysEval(params) {
  const source = String(params.code ?? params.source ?? '');
  if (!source.trim()) return { ok: false, code: 'BAD_INPUT', error: 'sys.eval requires code' };
  if (source.length > SYS_EVAL_SOURCE_MAX) {
    return { ok: false, code: 'TOO_LARGE', error: `sys.eval code exceeds ${SYS_EVAL_SOURCE_MAX} chars` };
  }
  const tab = await resolveTab(params);
  if (!isSysInjectableUrl(tab.url)) {
    return { ok: false, code: 'NEED_PAGE', error: `tab is not injectable: ${tab.url || '(no url)'}` };
  }
  const world = normalizeWorld(params.world);
  const denied = userScriptsDenied();
  if (denied) return denied;
  const frameId = params.frameId == null ? undefined : Number(params.frameId);
  const target = { tabId: tab.id };
  if (Number.isFinite(frameId)) target.frameIds = [frameId];
  const wrapped = wrapEvalSource(source);
  const results = await withTimeout(
    chrome.userScripts.execute({
      target,
      world,
      injectImmediately: true,
      js: [{ code: wrapped }]
    }),
    SYS_TIMEOUT_MS,
    'sys.eval timed out'
  );
  const first = Array.isArray(results) ? results[0] : null;
  if (first?.error) return { ok: false, code: 'EVAL_FAILED', error: String(first.error) };
  const payload = first && typeof first === 'object' && 'result' in first ? first.result : first;
  if (payload && typeof payload === 'object' && payload.ok === false) {
    return payload;
  }
  if (payload && typeof payload === 'object' && payload.ok === true) {
    return { ok: true, result: { world, tabId: tab.id, frameId: first?.frameId ?? frameId ?? 0, value: payload.value } };
  }
  return { ok: true, result: { world, tabId: tab.id, frameId: first?.frameId ?? frameId ?? 0, value: payload ?? null } };
}

async function sysFetch(params) {
  const as = String(params.as || 'extension').toLowerCase();
  if (as === 'page') return sysFetchAsPage(params);
  if (as === 'extension') return sysFetchAsExtension(params);
  return { ok: false, code: 'BAD_INPUT', error: 'sys.fetch as must be page or extension' };
}

async function sysFetchAsPage(params) {
  const tab = await resolveTab(params);
  if (!isSysInjectableUrl(tab.url)) {
    return { ok: false, code: 'NEED_PAGE', error: `tab is not injectable: ${tab.url || '(no url)'}` };
  }
  let url;
  try {
    url = new URL(String(params.url || ''), tab.url || undefined);
  } catch {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.fetch: invalid url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.fetch page only allows http(s)' };
  }
  const init = sanitizeFetchInit(params.init);
  const source = wrapPageFetchSource(url.href, init);
  const denied = userScriptsDenied();
  if (denied) return denied;
  const frameId = params.frameId == null ? undefined : Number(params.frameId);
  const target = { tabId: tab.id };
  if (Number.isFinite(frameId)) target.frameIds = [frameId];
  const results = await withTimeout(
    chrome.userScripts.execute({
      target,
      world: 'MAIN',
      injectImmediately: true,
      js: [{ code: source }]
    }),
    SYS_TIMEOUT_MS,
    'sys.fetch(page) timed out'
  );
  const first = Array.isArray(results) ? results[0] : null;
  if (first?.error) return { ok: false, code: 'FETCH_FAILED', error: String(first.error) };
  const payload = first?.result;
  if (payload && payload.ok === false) return payload;
  return { ok: true, result: { as: 'page', tabId: tab.id, ...(payload && payload.value ? payload.value : payload || {}) } };
}

async function sysFetchAsExtension(params) {
  let parsed;
  try {
    parsed = new URL(String(params.url || ''));
  } catch {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.fetch: invalid url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'BAD_INPUT', error: 'sys.fetch extension only allows http(s)' };
  }
  const init = sanitizeFetchInit(params.init);
  const method = String(init.method || 'GET').toUpperCase();
  const res = await withTimeout(
    fetch(parsed.href, {
      method,
      headers: init.headers,
      body: init.body,
      credentials: 'omit',
      redirect: 'follow'
    }),
    SYS_TIMEOUT_MS,
    'sys.fetch(extension) timed out'
  );
  const bytes = method === 'HEAD' ? new Uint8Array() : new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > SYS_FETCH_BYTES_MAX) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      error: `sys.fetch exceeds ${SYS_FETCH_BYTES_MAX} bytes`,
      status: res.status,
      bytes: bytes.byteLength
    };
  }
  return {
    ok: true,
    result: {
      as: 'extension',
      ok: res.ok,
      status: res.status,
      url: res.url,
      contentType: res.headers.get('content-type') || '',
      headers: pickHeaders(res.headers),
      base64: bytesToBase64(bytes),
      bytes: bytes.byteLength
    }
  };
}

async function resolveTab(params) {
  const id = Number(params.tabId ?? params.defaultTabId);
  if (Number.isFinite(id) && id > 0) {
    try {
      return await chrome.tabs.get(id);
    } catch {
      const err = new Error(`unknown tab ${id}`);
      err.code = 'NEED_PAGE';
      throw err;
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    const err = new Error('no active tab');
    err.code = 'NEED_PAGE';
    throw err;
  }
  return tab;
}

function publicTab(tab) {
  const url = tab?.url || '';
  return {
    id: tab?.id ?? null,
    windowId: tab?.windowId ?? null,
    groupId: tab?.groupId ?? -1,
    url,
    title: tab?.title || '',
    active: tab?.active === true,
    audible: tab?.audible === true,
    muted: tab?.mutedInfo?.muted === true,
    discarded: tab?.discarded === true,
    pinned: tab?.pinned === true,
    status: tab?.status || '',
    injectable: isSysInjectableUrl(url)
  };
}

export function isSysInjectableUrl(url) {
  const s = String(url || '');
  if (isInjectableTabUrl(s)) return true;
  if (!isPawWorkTabUrl(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'chrome-extension:' && u.hostname === chrome.runtime.id;
  } catch {
    return false;
  }
}

function userScriptsDenied() {
  try {
    if (typeof chrome.userScripts?.getScripts !== 'function') {
      return {
        ok: false,
        code: 'SYS_DENIED',
        error: 'chrome.userScripts unavailable (need userScripts permission and Chrome 120+; execute needs 135+)'
      };
    }
    chrome.userScripts.getScripts();
  } catch {
    return {
      ok: false,
      code: 'SYS_DENIED',
      error:
        'userScripts is off. Chrome 138+: extension details → Allow User Scripts. Older: chrome://extensions → Developer mode.'
    };
  }
  if (typeof chrome.userScripts.execute !== 'function') {
    return {
      ok: false,
      code: 'SYS_DENIED',
      error: 'chrome.userScripts.execute unavailable (need Chrome 135+)'
    };
  }
  return null;
}

function normalizeWorld(world) {
  const w = String(world || 'MAIN').toUpperCase();
  if (w === 'USER' || w === 'USER_SCRIPT' || w === 'ISOLATED') return 'USER_SCRIPT';
  return 'MAIN';
}

function wrapEvalSource(source) {
  return [
    '(async function() {',
    '  try {',
    '    const value = await (async function() {',
    String(source || ''),
    '    })();',
    '    if (value === undefined) return { ok: true, value: null };',
    '    var json;',
    '    try { json = JSON.stringify(value); }',
    '    catch (e) { return { ok: false, code: "NOT_CLONEABLE", error: String(e && e.message || e) }; }',
    `    if (json && json.length > ${SYS_EVAL_JSON_MAX}) return { ok: false, code: "TOO_LARGE", bytes: json.length };`,
    '    return { ok: true, value: JSON.parse(json) };',
    '  } catch (e) {',
    '    return { ok: false, code: "EVAL_FAILED", error: String(e && e.message || e) };',
    '  }',
    '})()'
  ].join('\n');
}

function wrapPageFetchSource(href, init) {
  const hrefJson = JSON.stringify(href);
  const initJson = JSON.stringify({
    method: init.method || 'GET',
    headers: init.headers || {},
    body: init.body == null ? undefined : init.body,
    credentials: 'include'
  });
  return [
    '(async function() {',
    '  try {',
    `    var url = ${hrefJson};`,
    `    var init = ${initJson};`,
    '    var res = await fetch(url, init);',
    '    var buf = await res.arrayBuffer();',
    `    if (buf.byteLength > ${SYS_FETCH_BYTES_MAX}) {`,
    '      return { ok: false, code: "TOO_LARGE", status: res.status, bytes: buf.byteLength };',
    '    }',
    '    var bytes = new Uint8Array(buf);',
    '    var binary = "";',
    '    var chunk = 0x8000;',
    '    for (var i = 0; i < bytes.length; i += chunk) {',
    '      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));',
    '    }',
    '    var headers = {};',
    '    res.headers.forEach(function(v, k) { headers[k] = v; });',
    '    return { ok: true, value: {',
    '      ok: res.ok, status: res.status, url: res.url,',
    '      contentType: res.headers.get("content-type") || "",',
    '      headers: headers, base64: btoa(binary), bytes: bytes.byteLength',
    '    }};',
    '  } catch (e) {',
    '    return { ok: false, code: "FETCH_FAILED", error: String(e && e.message || e) };',
    '  }',
    '})()'
  ].join('\n');
}

function sanitizeFetchInit(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const method = String(src.method || 'GET').toUpperCase();
  const allowed = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
  const headers = {};
  if (src.headers && typeof src.headers === 'object' && !Array.isArray(src.headers)) {
    for (const [k, v] of Object.entries(src.headers)) {
      headers[String(k)] = String(v);
    }
  }
  let body;
  if (src.body != null && method !== 'GET' && method !== 'HEAD') {
    body = typeof src.body === 'string' ? src.body : JSON.stringify(src.body);
  }
  return { method: allowed.has(method) ? method : 'GET', headers, body };
}

function pickHeaders(headers) {
  const out = {};
  for (const name of ['content-type', 'content-length', 'last-modified', 'etag', 'cache-control']) {
    const value = headers.get(name);
    if (value != null) out[name] = value;
  }
  return out;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(message);
      err.code = 'SYS_FAILED';
      reject(err);
    }, ms);
    Promise.resolve(promise)
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}
