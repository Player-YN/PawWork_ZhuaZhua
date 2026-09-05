/**
 * Guest ABI for the browser-as-computer.
 *
 * chrome.* never enters the QuickJS heap. Guest calls sys.* → host → SW.
 * This is the programmable surface, not a product feature list.
 */

export const SYS_EVAL_JSON_MAX = 1_000_000;
export const SYS_FETCH_BYTES_MAX = 8 * 1024 * 1024;
export const SYS_EVAL_SOURCE_MAX = 100_000;

export const SYS_OPS = Object.freeze([
  'help',
  'tabs.list',
  'tabs.current',
  'tabs.frames',
  'tabs.open',
  'tabs.navigate',
  'tabs.reload',
  'tabs.close',
  'tabs.focus',
  'eval',
  'fetch',
  'cdp',
  'download',
  'screenshot'
]);

export const SYS_HELP = Object.freeze({
  abi: 'pawwork-sys-v1',
  note:
    'Program the browser machine from run(). chrome / window / document are absent on purpose. Return values must JSON-serialize. Worlds: MAIN = page JS heap + page cookies; USER = own world + DOM, no page JS. sys.cdp is the Chrome DevTools Protocol pipe — not a product feature.',
  ops: {
    'sys.help': 'This catalog (sync).',
    'sys.tabs.list': 'Open tabs: id, url, title, active, audible, groupId, injectable.',
    'sys.tabs.current': 'Focus tab for this turn (or the Chrome active tab).',
    'sys.tabs.frames': '{ tabId? } → frames in that tab (webNavigation).',
    'sys.tabs.open': '{ url, active? } — http(s) or about:blank.',
    'sys.tabs.navigate': '{ url, tabId? }',
    'sys.tabs.reload': '{ tabId? }',
    'sys.tabs.close': '{ tabId? }',
    'sys.tabs.focus': '{ tabId? }',
    'sys.eval':
      '{ code, world?: "MAIN"|"USER", tabId?, frameId? }. code is an async function body; return a JSON value.',
    'sys.fetch':
      '{ as: "page"|"extension", url, tabId?, init? }. page = that tab MAIN-world fetch (cookies). extension = SW fetch, no page cookies.',
    'sys.cdp':
      'CDP pipe. Send: { method, params?, tabId?, targetId? } (auto-attach). Session: { action: "attach"|"detach"|"events"|"targets", tabId?, targetId?, clear? }. Bodies of already-fired requests need attach + Network.enable first, then action:"events" + Network.getResponseBody.',
    'sys.download': '{ url } or { base64, filename, mimeType? }. Existing downloads permission — not a downloader product.',
    'sys.screenshot': '{ tabId?, format?: "png"|"jpeg" } — visible tab composite (captureVisibleTab).'
  },
  walls: [
    'chrome:// and other-extension pages are not injectable',
    'Widevine frames are not readable',
    'eval/fetch/cdp results larger than the cap are TOO_LARGE',
    'DOM nodes / functions are NOT_CLONEABLE',
    'sys.cdp fails if DevTools (or another debugger) is already attached',
    'Chrome shows a debugging banner while CDP is attached'
  ]
});

/** Model-facing guest ISA. Goes on the run tool schema — not a separate tool. */
export const SYS_MODEL_HINT = [
  'Guest globals: await fs.readFile/writeFile/readdir/... and sys (no chrome/window/document).',
  'sys.help() or inspect view=sys → full catalog (pawwork-sys-v1).',
  'sys.tabs.list|current|frames({tabId?})',
  'sys.tabs.open({url,active?}) sys.tabs.navigate({url,tabId?}) sys.tabs.reload({tabId?}) sys.tabs.close({tabId?}) sys.tabs.focus({tabId?})',
  'sys.eval({world:"MAIN"|"USER", code, tabId?, frameId?}) — code is an async function body; return JSON.',
  'sys.fetch({as:"page"|"extension", url, tabId?, init?})',
  'sys.cdp({method, params?, tabId?, targetId?}) auto-attach send. sys.cdp({action:"attach"|"detach"|"events"|"targets", tabId?, targetId?, clear?})',
  'Already-fired HTTP bodies: cdp attach + Network.enable, then action:"events", then Network.getResponseBody({requestId}).',
  'sys.download({url}) or sys.download({base64, filename, mimeType?})',
  'sys.screenshot({tabId?, format?})'
].join(' ');

/**
 * Host-facing guest object. `hostSys(op, params)` must return
 * `{ ok, result?, error?, code? }` or throw.
 * @param {{ hostSys?: Function, defaultTabId?: number|null }} [opts]
 */
export function createGuestSys(opts = {}) {
  const host = opts.hostSys;
  const defaultTabId = opts.defaultTabId != null ? Number(opts.defaultTabId) : null;

  async function call(op, params = {}) {
    const name = String(op || '');
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
    const res = await host(name, payload);
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
    return res.result !== undefined ? res.result : res;
  }

  return wrapSysFromCall(call);
}

/**
 * @param {(op: string, params?: object) => Promise<unknown>} call
 */
export function wrapSysFromCall(call) {
  return {
    call,
    help: () => SYS_HELP,
    eval: (params) => call('eval', params && typeof params === 'object' ? params : {}),
    fetch: (params) => call('fetch', params && typeof params === 'object' ? params : {}),
    cdp: (params) => call('cdp', params && typeof params === 'object' ? params : {}),
    download: (params) => call('download', params && typeof params === 'object' ? params : {}),
    screenshot: (params) => call('screenshot', params && typeof params === 'object' ? params : {}),
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
