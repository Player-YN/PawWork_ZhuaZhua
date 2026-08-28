/**
 * Wave 5 — multimodal inspect + real acquire (not silent stub success).
 */
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution, settleExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { ensureItemPixels } from '../../../src/agent/vnext/sessionWorkspace/itemPixels.js';
import { addWebItem } from '../../../src/agent/vnext/sessionWorkspace/groups.js';

let failed = 0;
function record(name, ok, detail) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

// Tiny PNG as data URL
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);
const dataUrl = 'data:image/png;base64,' + Buffer.from(PNG).toString('base64');

// Attachments bind + multimodal inspect
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  await svc.sendMessage({
    sessionId: 's1',
    content: 'look at image',
    role: 'user',
    attachments: [{ name: 'a.png', isImage: true, dataUrl, type: 'image/png' }],
    callModel: async () => ({ text: 'seen', toolCalls: [] })
  });
  const state = await svc.getWorkspaceState({ sessionId: 's1' });
  const bound = (state.boundGroupIds || []).length > 0;
  record('attachment-auto-bind', bound, `bound=${JSON.stringify(state.boundGroupIds)}`);

  // Find image item
  let itemId = null;
  for (const gid of state.boundGroupIds || []) {
    const members = svc.runtime.store.get('groupMembers', gid) || [];
    for (const mid of members) {
      const it = svc.runtime.store.get('items', mid);
      if (it?.kindHint === 'image') itemId = mid;
    }
  }
  const ex = beginExecution(svc.runtime.store, 's1');
  const fs = createSessionGuestFs(svc.runtime.store, { sessionId: 's1', executionId: ex.executionId });
  const tools = createSessionTools({
    store: svc.runtime.store,
    execution: ex,
    fs,
    sessionId: 's1'
  });
  const out = await tools.inspect.execute({ view: 'item', itemId });
  settleExecution(svc.runtime.store, ex, 'settled');
  const hasPixels =
    out.ok &&
    ((out.item?.imageBase64 && out.item.imageBase64.length > 20) ||
      (out.modelParts || []).some((p) => p.type === 'image' && p.image?.byteLength > 0));
  record(
    'multimodal-inspect-pixels',
    hasPixels,
    `ok=${out.ok} base64len=${out.item?.imageBase64?.length || 0} parts=${(out.modelParts || []).length}`
  );
  const modelOut = tools.inspect.toModelOutput({ output: out });
  const modelJson = JSON.stringify(modelOut);
  record(
    'inspect-toModelOutput-uses-file-not-file-data',
    modelOut?.type === 'content' &&
      (modelOut.value || []).some(
        (p) => p.type === 'file' && p.data?.type === 'data' && p.data?.data && p.mediaType
      ) &&
      !modelJson.includes('"file-data"'),
    `type=${modelOut?.type}`
  );
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('paste1');
  await svc.sendMessage({
    sessionId: 'paste1',
    content: 'look at paste',
    role: 'user',
    attachments: [
      {
        name: '截图1',
        isImage: true,
        dataUrl,
        type: 'image/png',
        source: 'paste',
        labelKind: 'screenshot',
        labelN: 1
      }
    ],
    callModel: async () => ({ text: 'seen', toolCalls: [] })
  });
  const pasteState = await svc.getWorkspaceState({ sessionId: 'paste1' });
  record(
    'paste-attachment-no-artifact',
    (pasteState.artifacts || []).length === 0 && (pasteState.artifactCount || 0) === 0,
    `artifacts=${(pasteState.artifacts || []).length}`
  );
  let pasteItem = null;
  for (const g of pasteState.groups || []) {
    for (const it of g.items || []) {
      if (it.labelKind === 'screenshot') pasteItem = it;
    }
  }
  record(
    'paste-attachment-screenshot-chip',
    !!pasteItem && pasteItem.handle === 'screenshot1',
    `handle=${pasteItem?.handle || ''}`
  );
  const pasteEx = beginExecution(svc.runtime.store, 'paste1');
  const pasteFs = createSessionGuestFs(svc.runtime.store, {
    sessionId: 'paste1',
    executionId: pasteEx.executionId
  });
  const pasteTools = createSessionTools({
    store: svc.runtime.store,
    execution: pasteEx,
    fs: pasteFs,
    sessionId: 'paste1'
  });
  const pasteOut = await pasteTools.inspect.execute({
    view: 'item',
    itemId: pasteItem?.webItemId,
    includeMedia: true
  });
  settleExecution(svc.runtime.store, pasteEx, 'settled');
  record(
    'paste-message-wire-has-image-part',
    !!(
      pasteOut.ok &&
      ((pasteOut.item?.imageBase64 && pasteOut.item.imageBase64.length > 20) ||
        (pasteOut.modelParts || []).some((p) => p.type === 'image'))
    ),
    `ok=${pasteOut.ok} parts=${(pasteOut.modelParts || []).length}`
  );
  await svc.clearClipboard({ sessionId: 'paste1' });
  const cleared = await svc.getWorkspaceState({ sessionId: 'paste1' });
  const clip = cleared.groups.find((g) => g.kind === 'clipboard');
  record(
    'paste-clipboard-clear-no-artifact',
    (cleared.artifacts || []).length === 0 && (clip?.itemCount || 0) === 0,
    `artifacts=${(cleared.artifacts || []).length} clip=${clip?.itemCount}`
  );
}

// On-demand putBlob: data: src with no prior blob, then https src via fetchImpl
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('pix');
  const g = svc.runtime.createGroup({ name: 'DOM photos' });
  svc.runtime.bindGroups('pix', [g.groupId]);
  const dataItem = svc.runtime.addWebItem(g.groupId, { src: dataUrl, kindHint: 'image' });
  const httpItem = svc.runtime.addWebItem(g.groupId, {
    src: 'https://cdn.example.test/shot.png',
    kindHint: 'image'
  });
  const before = svc.runtime.store.getBlob(`blob:${dataItem.webItemId}`);
  const ex = beginExecution(svc.runtime.store, 'pix');
  const fsG = createSessionGuestFs(svc.runtime.store, { sessionId: 'pix', executionId: ex.executionId });
  const tools = createSessionTools({
    store: svc.runtime.store,
    execution: ex,
    fs: fsG,
    sessionId: 'pix',
    fetchImpl: async (url) => {
      if (String(url).includes('cdn.example.test')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'image/png' },
          arrayBuffer: async () => PNG.buffer
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    }
  });
  const fromData = await tools.inspect.execute({ view: 'item', itemId: dataItem.webItemId });
  const fromHttp = await tools.inspect.execute({ view: 'item', itemId: httpItem.webItemId });
  settleExecution(svc.runtime.store, ex, 'settled');
  const dataBlob = svc.runtime.store.getBlob(`blob:${dataItem.webItemId}`);
  const httpBlob = svc.runtime.store.getBlob(`blob:${httpItem.webItemId}`);
  record(
    'inspect-putblob-from-data-src',
    !before && fromData.ok && dataBlob?.bytes?.byteLength > 20 && fromData.item?.imageBase64,
    `hadBlob=${!!before} bytes=${dataBlob?.bytes?.byteLength || 0}`
  );
  record(
    'inspect-putblob-from-http-src',
    fromHttp.ok && httpBlob?.bytes?.byteLength > 20 && fromHttp.item?.imageBase64,
    `bytes=${httpBlob?.bytes?.byteLength || 0} err=${fromHttp.item?.mediaError || ''}`
  );
}

{
  const store = new SessionWorkspaceStore();
  const svc = new SessionWorkspaceService({ store });
  svc.ensureSession('srcfirst');
  const g = svc.runtime.createGroup({ name: 'src-first' });
  const fetchBytes = new Uint8Array(PNG);
  fetchBytes[16] = 2;
  const pageBytes = new Uint8Array(PNG);
  pageBytes[16] = 9;
  const item = addWebItem(store, g.groupId, {
    src: 'https://cdn.example.test/woman.jpg',
    kindHint: 'image',
    locator: { css: 'img.masonry-wrong' },
    preview: { src: 'https://cdn.example.test/woman.jpg', tagName: 'img' }
  });
  const r = await ensureItemPixels(store, item, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => fetchBytes.buffer
    }),
    captureFromPage: async () => ({
      dataUrl: 'data:image/png;base64,' + Buffer.from(pageBytes).toString('base64')
    })
  });
  record(
    'pixels-prefer-bound-src-over-page-css',
    r.ok && r.source === 'fetch' && r.bytes?.[16] === 2,
    `source=${r.source} b16=${r.bytes?.[16]}`
  );
}

// Acquire fetch must not silently stub "fetched:url"
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const fakeFetch = async (url) => {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      arrayBuffer: async () => new TextEncoder().encode('REAL_BODY_FROM_FETCH').buffer,
      text: async () => 'REAL_BODY_FROM_FETCH'
    };
  };
  let step = 0;
  const res = await svc.sendMessage({
    sessionId: 's1',
    content: 'fetch example',
    fetchImpl: fakeFetch,
    callModel: async () => {
      step += 1;
      if (step === 1) {
        return {
          text: null,
          toolCalls: [
            {
              toolName: 'acquire',
              args: { action: 'fetch', url: 'https://example.com/data.txt' },
              toolCallId: 'a1'
            }
          ]
        };
      }
      return { text: 'got it', toolCalls: [] };
    }
  });
  const acq = res.toolCalls.find((t) => t.toolName === 'acquire');
  const result = acq?.result || {};
  const stubShaped =
    typeof result.path === 'string' &&
    // old stub wrote "fetched:url" as sole content without real body
    false;
  // Read scratch source if present
  let body = '';
  if (result.path && result.ok) {
    // Need execution gone — content in store under /tmp may be cleared after settle
    // Check result.preview or bytes instead
    body = String(result.preview || '');
  }
  const real =
    result.ok === true &&
    result.action === 'fetch' &&
    (String(result.preview || '').includes('REAL_BODY_FROM_FETCH') ||
      Number(result.bytes) > 0) &&
    !String(result.preview || '').startsWith('fetched:');
  record(
    'acquire-fetch-real-not-stub',
    real && !stubShaped,
    JSON.stringify(result).slice(0, 240)
  );
}

// Acquire search without network: honest failure if fetch fails (not silent ok stub)
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  const boom = async () => {
    throw new Error('network down');
  };
  let step = 0;
  const res = await svc.sendMessage({
    sessionId: 's1',
    content: 'search',
    fetchImpl: boom,
    callModel: async () => {
      step += 1;
      if (step === 1) {
        return {
          text: null,
          toolCalls: [
            { toolName: 'acquire', args: { action: 'search', query: 'test' }, toolCallId: 's1' }
          ]
        };
      }
      return { text: 'fail handled', toolCalls: [] };
    }
  });
  const acq = res.toolCalls.find((t) => t.toolName === 'acquire');
  const result = acq?.result || {};
  // Must not claim ok with empty placeholder query-only JSON as "search success"
  const honestFail = result.ok === false || (result.ok === true && Array.isArray(result.results));
  // Silent stub was ok:true with only query written — reject that shape without results/error
  const silentStub =
    result.ok === true && !result.results && !result.path?.includes('search') === false && !result.query;
  // Old stub: ok true, action search, path to json with query only
  const oldStub =
    result.ok === true &&
    result.action === 'search' &&
    !result.results &&
    result.path &&
    !result.error;
  // After our change, search uses real backend — with boom it should fail
  const good = result.ok === false && result.error;
  record('acquire-search-honest-error', good, JSON.stringify(result).slice(0, 200));
}

// Image compose: no Settings → honest NO_IMAGE_CONFIG (do not fake pixels)
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('img');
  const ex = beginExecution(svc.runtime.store, 'img');
  const fsG = createSessionGuestFs(svc.runtime.store, { sessionId: 'img', executionId: ex.executionId });
  const tools = createSessionTools({
    store: svc.runtime.store,
    execution: ex,
    fs: fsG,
    sessionId: 'img'
  });
  const out = await tools.acquire.execute({
    action: 'image',
    prompt: 'compose selected photos into one poster'
  });
  settleExecution(svc.runtime.store, ex, 'settled');
  record(
    'acquire-image-requires-config',
    out.ok === false && out.code === 'NO_IMAGE_CONFIG',
    JSON.stringify(out).slice(0, 200)
  );
}

// Image compose: OpenRouter /images mock + two bound refs → real PNG artifact
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('compose');
  const g = svc.runtime.createGroup({ name: 'Photos' });
  svc.runtime.bindGroups('compose', [g.groupId]);
  const a = svc.runtime.addWebItem(g.groupId, { src: dataUrl, kindHint: 'image' });
  const b = svc.runtime.addWebItem(g.groupId, { src: dataUrl, kindHint: 'image' });
  svc.runtime.store.putBlob(`blob:${a.webItemId}`, PNG, { mimeType: 'image/png' });
  svc.runtime.store.putBlob(`blob:${b.webItemId}`, PNG, { mimeType: 'image/png' });

  const events = [];
  const fakeImageFetch = async (url, init = {}) => {
    if (String(url).includes('/images') && String(init.method || 'POST').toUpperCase() === 'POST') {
      const body = JSON.parse(String(init.body || '{}'));
      const hasRefs = Array.isArray(body.input_references) && body.input_references.length >= 2;
      if (!hasRefs) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: 'expected input_references' } })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ b64_json: Buffer.from(PNG).toString('base64'), media_type: 'image/png' }]
          })
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const ex = beginExecution(svc.runtime.store, 'compose');
  const fsG = createSessionGuestFs(svc.runtime.store, {
    sessionId: 'compose',
    executionId: ex.executionId
  });
  fsG.mkdirp('/artifacts');
  const tools = createSessionTools({
    store: svc.runtime.store,
    execution: ex,
    fs: fsG,
    sessionId: 'compose',
    fetchImpl: fakeImageFetch,
    onEvent: (ev) => events.push(ev),
    settings: {
      apiKey: 'sk-or-test',
      apiBase: 'https://openrouter.ai/api/v1',
      image: {
        enabled: true,
        protocol: 'openrouter-image',
        path: '/images',
        model: 'google/gemini-2.5-flash-image'
      }
    }
  });
  const out = await tools.acquire.execute({
    action: 'image',
    prompt: 'Combine the two photos into one cohesive picture',
    itemIds: [a.webItemId, b.webItemId]
  });
  const arts = await svc.listArtifacts({ sessionId: 'compose' });
  let pngOk = false;
  if (arts[0]) {
    const read = await svc.readArtifact({ sessionId: 'compose', artifactId: arts[0].artifactId });
    const raw = Buffer.from(String(read.base64 || ''), 'base64');
    pngOk = raw[0] === 0x89 && raw[1] === 0x50;
  }
  settleExecution(svc.runtime.store, ex, 'settled');
  record(
    'acquire-image-openrouter-compose-png',
    out.ok === true &&
      out.mode === 'i2i' &&
      out.sourceCount === 2 &&
      arts.length === 1 &&
      pngOk &&
      events.some((e) => e.type === 'image_generated' && e.dataUrl),
    `ok=${out.ok} mode=${out.mode} src=${out.sourceCount} arts=${arts.length} png=${pngOk} ev=${events.map((e) => e.type).join(',')}`
  );
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('imgerr');
  const errEvents = [];
  const boomFetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { message: 'expected input_references' } })
  });
  const ex = beginExecution(svc.runtime.store, 'imgerr');
  const fsG = createSessionGuestFs(svc.runtime.store, {
    sessionId: 'imgerr',
    executionId: ex.executionId
  });
  fsG.mkdirp('/artifacts');
  const tools = createSessionTools({
    store: svc.runtime.store,
    execution: ex,
    fs: fsG,
    sessionId: 'imgerr',
    fetchImpl: boomFetch,
    onEvent: (ev) => errEvents.push(ev),
    settings: {
      apiKey: 'sk-or-test',
      apiBase: 'https://openrouter.ai/api/v1',
      image: {
        enabled: true,
        protocol: 'openrouter-image',
        path: '/images',
        model: 'google/gemini-2.5-flash-image'
      }
    }
  });
  const out = await tools.acquire.execute({
    action: 'image',
    prompt: 'draw a cat'
  });
  settleExecution(svc.runtime.store, ex, 'settled');
  record(
    'acquire-image-http-error-emits-image_error',
    out.ok === false &&
      out.code === 'IMAGE_HTTP' &&
      errEvents.some((e) => e.type === 'image_request') &&
      errEvents.some((e) => e.type === 'image_error' && e.status === 400),
    `ok=${out.ok} code=${out.code} ev=${errEvents.map((e) => e.type).join(',')}`
  );
}

// SSRF: model-directed acquire fetch must never reach localhost / private /
// link-local / metadata / non-http targets — host guard, no fetch dispatched.
{
  const { assertPublicHttpUrl } = await import('../../../src/agent/vnext/primitives/netGuard.js');
  const mustDeny = [
    'http://localhost/admin',
    'http://sub.localhost/x',
    'http://127.0.0.1:8080/keys',
    'http://0.0.0.0/',
    'http://10.1.2.3/internal',
    'http://172.16.0.9/',
    'http://192.168.1.1/router',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/cgnat',
    'http://[::1]/v6-loopback',
    'http://[fe80::1]/v6-linklocal',
    'http://[fd00::2]/v6-ula',
    'http://[::ffff:192.168.0.1]/v6-mapped',
    'http://printer.local/jobs',
    'http://vault.internal/secrets',
    'file:///etc/passwd',
    'chrome-extension://abc/page.html'
  ];
  const mustAllow = ['https://example.com/data.txt', 'http://93.184.216.34/x'];
  const denyOk = mustDeny.every((u) => assertPublicHttpUrl(u).ok === false);
  const allowOk = mustAllow.every((u) => assertPublicHttpUrl(u).ok === true);
  record(
    'netguard-blocks-private-targets',
    denyOk && allowOk,
    mustDeny.filter((u) => assertPublicHttpUrl(u).ok).join(',') || 'all denied'
  );

  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('ssrf');
  let fetchCalls = 0;
  const spyFetch = async () => {
    fetchCalls += 1;
    throw new Error('must not be called');
  };
  let step = 0;
  const res = await svc.sendMessage({
    sessionId: 'ssrf',
    content: 'grab my router config',
    fetchImpl: spyFetch,
    callModel: async () => {
      step += 1;
      if (step === 1) {
        return {
          text: null,
          toolCalls: [
            {
              toolName: 'acquire',
              args: { action: 'fetch', url: 'http://192.168.1.1/config' },
              toolCallId: 'ssrf1'
            }
          ]
        };
      }
      return { text: 'blocked as expected', toolCalls: [] };
    }
  });
  const acq = res.toolCalls.find((t) => t.toolName === 'acquire');
  const out = acq?.result || {};
  record(
    'acquire-fetch-denies-private-network',
    out.ok === false && out.code === 'NET_DENIED' && fetchCalls === 0,
    `ok=${out.ok} code=${out.code} fetchCalls=${fetchCalls}`
  );

  // itemPixels fetch path is guarded too (image src pointing at intranet).
  const { ensureItemPixels } = await import('../../../src/agent/vnext/sessionWorkspace/itemPixels.js');
  const store2 = new SessionWorkspaceStore();
  let pixelFetches = 0;
  const px = await ensureItemPixels(
    store2,
    {
      webItemId: 'wi_ssrf',
      kindHint: 'image',
      capture: { src: 'http://169.254.169.254/latest/meta-data/', source: {}, locator: {} }
    },
    {
      fetchImpl: async () => {
        pixelFetches += 1;
        throw new Error('must not be called');
      },
      captureFromPage: async () => null
    }
  );
  record(
    'item-pixels-fetch-denies-private-network',
    px.ok === false && px.code === 'NET_DENIED' && pixelFetches === 0,
    `ok=${px.ok} code=${px.code} fetches=${pixelFetches}`
  );
}

console.log(`\nwave5 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE5 PASS: media/acquire attacks defeated');
