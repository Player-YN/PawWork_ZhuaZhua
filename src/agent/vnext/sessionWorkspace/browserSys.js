/**
 * Guest ABI for the browser-as-computer.
 *
 * chrome.* never enters the QuickJS heap. Guest calls sys.* → host → SW.
 */

import { extendDeadlineForWaitFor } from './runDeadline.js';
import { screenshotToModelParts } from './actionObserve.js';

export const SYS_EVAL_JSON_MAX = 1_000_000;
export const SYS_FETCH_BYTES_MAX = 8 * 1024 * 1024;
export const SYS_EVAL_SOURCE_MAX = 100_000;
export const SYS_UPLOAD_BYTES_MAX = 8 * 1024 * 1024;
export const SYS_WAIT_TIMEOUT_MS = 120_000;
export const SYS_WAIT_DEFAULT_MS = 30_000;

export function clampWaitTimeout(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return SYS_WAIT_DEFAULT_MS;
  return Math.max(1000, Math.min(n, SYS_WAIT_TIMEOUT_MS));
}

export const SYS_OPS = Object.freeze([
  'help',
  'capabilities',
  'tabs.list',
  'tabs.current',
  'tabs.frames',
  'tabs.open',
  'tabs.navigate',
  'tabs.reload',
  'tabs.close',
  'tabs.focus',
  'eval',
  'waitFor',
  'fetch',
  'cdp',
  'download',
  'screenshot',
  'upload'
]);

export const SYS_HELP = Object.freeze({
  abi: 'pawwork-sys-v1',
  note:
    'Program the browser machine from run(). chrome / window / document are absent on purpose. Return values must JSON-serialize. Worlds: MAIN = page JS heap + page cookies; USER = own world + DOM, no page JS. sys.cdp is the Chrome DevTools Protocol pipe. User-asked URLs that need login, cookies, Referer, this-machine IP, or might show captcha: sys.fetch as:"page" on their tab. Never acquire/cloud/provider-fetch those. Page and extension fetch from this Chrome share the user public IP; captcha/login still need cookies+origin+Referer (page only).',
  ops: {
    'sys.help': 'This catalog (sync).',
    'sys.capabilities': 'Live browser capability probe: userScripts availability/reason, debugger, capture, downloads and transfer limits. Check this before choosing an execution route.',
    'sys.tabs.list': 'Open tabs: id, url, title, active, audible, groupId, injectable.',
    'sys.tabs.current': 'Explicit tab for this turn (tabId/defaultTabId); no fallback to the Chrome active tab. Use tabs.list to select a target.',
    'sys.tabs.frames': '{ tabId? } → frames including documentId/documentLifecycle. tabId may only be omitted when this turn supplies defaultTabId.',
    'sys.tabs.open': '{ url, active? } — http(s) or about:blank.',
    'sys.tabs.navigate': '{ url, tabId? }',
    'sys.tabs.reload': '{ tabId? }',
    'sys.tabs.close': '{ tabId? }',
    'sys.tabs.focus': '{ tabId? }',
    'sys.eval':
      '{ code, world?: "MAIN"|"USER", tabId?, frameId?, documentId?, expectedUrl? }. code is an async function body; return a JSON value.',
    'sys.waitFor':
      '{ code?|selector?|text?, world?, tabId?, frameId?, documentId?, expectedUrl?, timeoutMs?, pollMs?, stableMs? }. Polls inside the page until the predicate is met, then returns its JSON value. code = async function body returning the value to wait for (truthy = done). selector = wait until document.querySelector matches. text = wait until document.body text contains it. No ~20s single-eval cap (timeoutMs up to 120000); pollMs is the interval; stableMs > 0 waits until the value stops changing for that long (use it for a streaming answer to settle). Prefer this over hand-rolled eval poll loops.',
    'sys.fetch':
      '{ as: "page"|"extension", url, tabId?, frameId?, documentId?, expectedUrl?, init?, saveTo? }. Default for user-asked open/save/read: as:"page" on their tab (MAIN-world fetch — cookies + origin + Referer; same public IP as this Chrome). as:"extension" is credentials:omit (no cookies) — only when they need the extension network or the page cannot fetch (CORS). Omit as and the host currently treats it as extension — always pass as. saveTo writes /scratch or /artifacts and returns a file receipt. Never acquire/cloud those URLs.',
    'sys.cdp':
      'CDP pipe. Send: { method, params?, tabId?, targetId? } (auto-attach). Session: { action: "attach"|"detach"|"events"|"targets", tabId?, targetId?, clear? }. Already-fired request URLs: attach + Network.enable, then action:"events". Do not dump media via Network.getResponseBody (cap ~6MB TOO_LARGE); hand URLs to sys.fetch as:"page".',
    'sys.download':
      '{ url, filename? } or { base64, filename, mimeType? }. Host calls chrome.downloads.download: this profile cookie jar + this-machine IP, no tab Referer. Not extension fetch (that is credentials:omit). Prefer sys.fetch as:"page" when login/Referer/captcha matter; download is the large-file shelf when the URL still works without document Referer.',
    'sys.screenshot': '{ tabId?, format?: "png"|"jpeg", saveTo? } — target must be visible; otherwise TAB_NOT_VISIBLE. saveTo writes to guest FS.',
    'sys.upload':
      '{ tabId?, path | itemId | artifactId, ref?, selector?, method?: "auto"|"input"|"drop"|"cdp", filename?, mimeType? }. Attach a guest-FS file to the page file input or dropzone. path may be /scratch (usual), /artifacts, or /context. Default auto uses MAIN-world input.files + change, then script drop. Never eval, never action.fill, never CDP unless method:"cdp". Receipt includes siteAccepted (unknown) and trusted (false). Cap 8MB.'
  },
  walls: [
    'chrome://, extension pages (including preview editors), and other-extension pages are not injectable',
    'Widevine frames are not readable',
    'eval/fetch/cdp results larger than the cap are TOO_LARGE',
    'DOM nodes / functions are NOT_CLONEABLE',
    'sys.cdp fails if DevTools (or another debugger) is already attached',
    'Chrome shows a debugging banner while CDP is attached'
  ]
});

/** Pointer for leftover callers. The ISA catalog is inspect view=sys / SYS_HELP. */
export const SYS_MODEL_HINT = 'ISA: inspect view=sys.';

/**
 * Host-facing guest object. `hostSys(op, params)` must return
 * `{ ok, result?, error?, code? }` or throw.
 * @param {{ hostSys?: Function, defaultTabId?: number|null, deadline?: object|number }} [opts]
 */
export function createGuestSys(opts = {}) {
  const host = opts.hostSys;
  const writtenFiles = new Set();
  const visionParts = [];
  const defaultTabId = opts.defaultTabId != null ? Number(opts.defaultTabId) : null;

  async function call(op, params = {}) {
    opts.signal?.throwIfAborted();
    const name = String(op || '');
    if (name === 'upload' && (params?.bytes != null || params?.base64 != null || params?.chunks != null)) {
      throw Object.assign(new Error('sys.upload accepts path/itemId/artifactId only — host reads the bytes'), { code: 'BAD_INPUT' });
    }
    if (name === 'waitFor') extendDeadlineForWaitFor(opts.deadline, params?.timeoutMs);
    const saveTo = params?.saveTo;
    if (saveTo != null && (!['fetch', 'screenshot'].includes(name) ||
      typeof saveTo !== 'string' || !/^\/(scratch|artifacts)\/.+/.test(saveTo) ||
      saveTo.split('/').includes('..') || saveTo.includes('\\') || typeof opts.fs?.writeFile !== 'function')) {
      throw Object.assign(new Error('saveTo requires a writable /scratch/ or /artifacts/ file path'), { code: 'BAD_INPUT' });
    }
    if (name === 'help') return SYS_HELP;
    if (typeof host !== 'function') {
      const err = new Error('SYS_DENIED: browser sys has no host in this runtime');
      err.code = 'SYS_DENIED';
      throw err;
    }
    const payload =
      params && typeof params === 'object'
        ? { ...params, defaultTabId: params.tabId != null ? params.tabId : defaultTabId }
        : { defaultTabId };
    if (name === 'upload') {
      delete payload.bytes;
      delete payload.base64;
      delete payload.chunks;
    }
    const deadlineAt = opts.deadline && typeof opts.deadline.expiresAt === 'number'
      ? opts.deadline.expiresAt
      : opts.deadline;
    const res = await host(name, payload, { signal: opts.signal, deadline: opts.deadline || deadlineAt });
    if (res == null) {
      const err = new Error('SYS_DENIED: no response from browser host');
      err.code = 'SYS_DENIED';
      throw err;
    }
    if (res.ok === false) {
      const err = new Error(res.error || `sys.${name} failed`);
      err.code = res.code || 'SYS_FAILED';
      throw err;
    }
    const value = res.result !== undefined ? res.result : res;
    if (name === 'screenshot' && value && typeof value.base64 === 'string' && value.base64) {
      visionParts.push(...screenshotToModelParts({
        base64: value.base64,
        mediaType: value.contentType || (value.format === 'jpeg' ? 'image/jpeg' : 'image/png'),
        label: 'Page screenshot'
      }));
    }
    if (saveTo != null) {
      opts.signal?.throwIfAborted();
      if (value.ok === false) throw Object.assign(new Error(`HTTP ${value.status}: response was not saved`), { code: 'HTTP_ERROR' });
      if (typeof value.base64 !== 'string') throw Object.assign(new Error('host returned no binary data'), { code: 'SYS_FAILED' });
      const binary = atob(value.base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      await opts.fs.writeFile(saveTo, bytes, { mimeType: value.contentType });
      writtenFiles.add(saveTo);
      const { base64, ...receipt } = value;
      return { ...receipt, path: saveTo, bytes: bytes.byteLength };
    }
    if (name === 'screenshot' && value && typeof value === 'object' && value.base64) {
      const { base64, ...receipt } = value;
      return { ...receipt, bytes: Math.ceil(String(base64).length * 0.75), vision: true };
    }
    return value;
  }

  return { ...wrapSysFromCall(call), writtenFiles, visionParts };
}

/**
 * @param {(op: string, params?: object) => Promise<unknown>} call
 */
export function wrapSysFromCall(call) {
  return {
    call,
    help: () => SYS_HELP,
    capabilities: () => call('capabilities', {}),
    eval: (params) => call('eval', params && typeof params === 'object' ? params : {}),
    waitFor: (params) => call('waitFor', params && typeof params === 'object' ? params : {}),
    fetch: (params) => call('fetch', params && typeof params === 'object' ? params : {}),
    cdp: (params) => call('cdp', params && typeof params === 'object' ? params : {}),
    download: (params) => call('download', params && typeof params === 'object' ? params : {}),
    screenshot: (params) => call('screenshot', params && typeof params === 'object' ? params : {}),
    upload: (params) => call('upload', params && typeof params === 'object' ? params : {}),
    tabs: {
      list: (params) => call('tabs.list', params && typeof params === 'object' ? params : {}),
      current: (params) => call('tabs.current', params && typeof params === 'object' ? params : {}),
      frames: (params) => call('tabs.frames', params && typeof params === 'object' ? params : {}),
      open: (params) => call('tabs.open', params && typeof params === 'object' ? params : {}),
      navigate: (params) => call('tabs.navigate', params && typeof params === 'object' ? params : {}),
      reload: (params) => call('tabs.reload', params && typeof params === 'object' ? params : {}),
      close: (params) => call('tabs.close', params && typeof params === 'object' ? params : {}),
      focus: (params) => call('tabs.focus', params && typeof params === 'object' ? params : {})
    }
  };
}
