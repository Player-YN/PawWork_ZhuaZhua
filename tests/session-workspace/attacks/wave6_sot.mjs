/**
 * Wave 6 — Session single source of truth + prune cascade (no durable orphans).
 */
import {
  SessionWorkspaceStore,
  createDurableSessionWorkspaceStore,
  __resetDurableMemoryBackends
} from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import {
  createArtifact,
  applyHtmlExtensionIfNeeded
} from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';

let failed = 0;
function record(name, ok, detail) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

// Runtime owns messages after sendMessage
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  await svc.sendMessage({
    sessionId: 's1',
    content: 'hello runtime',
    callModel: async () => ({ text: 'reply-1', toolCalls: [] })
  });
  const sess = await svc.getSession({ sessionId: 's1' });
  const hasUser = sess.messages.some((m) => m.role === 'user' && String(m.content).includes('hello runtime'));
  const hasAsst = sess.messages.some((m) => m.role === 'assistant' && String(m.content).includes('reply-1'));
  record('runtime-owns-messages', hasUser && hasAsst, `count=${sess.messages.length}`);
}

// renameSession on runtime
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s1');
  await svc.renameSession({ sessionId: 's1', title: 'My Title' });
  const sess = await svc.getSession({ sessionId: 's1' });
  record('runtime-title', sess.title === 'My Title' && sess.titleLocked === true, sess.title);

  let emptyOk = false;
  try {
    await svc.renameSession({ sessionId: 's1', title: '   ' });
  } catch (e) {
    emptyOk = /empty title/.test(String(e?.message || e));
  }
  const still = await svc.getSession({ sessionId: 's1' });
  record('rename-empty-rejected', emptyOk && still.title === 'My Title', still.title);

  let foreignOk = false;
  try {
    await svc.renameSession({ sessionId: 'no-such-session', title: 'Nope' });
  } catch (e) {
    foreignOk = /unknown session/.test(String(e?.message || e));
  }
  record(
    'rename-foreign-rejected',
    foreignOk && !svc.runtime.store.has('sessions', 'no-such-session'),
    ''
  );
}

{
  __resetDurableMemoryBackends();
  const dbName = `persist-rename-${Date.now()}`;
  const store1 = await createDurableSessionWorkspaceStore({ dbName });
  const svc1 = new SessionWorkspaceService({ store: store1 });
  svc1.ensureSession('keep');
  await svc1.renameSession({ sessionId: 'keep', title: '持久名称' });
  await store1.flush();
  const store2 = await createDurableSessionWorkspaceStore({ dbName });
  const svc2 = new SessionWorkspaceService({ store: store2 });
  const sess = await svc2.getSession({ sessionId: 'keep' });
  record(
    'rename-survives-reopen',
    sess.title === '持久名称' && sess.titleLocked === true,
    sess.title
  );
}

// pruneSessions cascade — dropped sessions leave no artifacts
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  for (const id of ['old1', 'old2', 'keep']) {
    svc.ensureSession(id);
    const fs = createSessionGuestFs(svc.runtime.store, { sessionId: id, executionId: null });
    fs.mkdirp('/artifacts');
    createArtifact(svc.runtime.store, fs, { sessionId: id, name: `${id}.md`, content: `body-${id}` });
  }
  const pruned = await svc.pruneSessions({ keepSessionIds: ['keep'] });
  const leftoverArts = svc.runtime.store
    .keys('artifacts')
    .map((id) => svc.runtime.store.get('artifacts', id))
    .filter((a) => a && a.sessionId !== 'keep');
  const leftoverSess = ['old1', 'old2'].filter((id) => svc.runtime.store.has('sessions', id));
  record(
    'prune-no-durable-orphans',
    pruned.deleted.includes('old1') &&
      pruned.deleted.includes('old2') &&
      leftoverArts.length === 0 &&
      leftoverSess.length === 0 &&
      svc.runtime.store.has('sessions', 'keep'),
    `deleted=${pruned.deleted.join(',')} leftoverArts=${leftoverArts.length}`
  );
}

// listSessions reflects runtime store only
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('a');
  svc.ensureSession('b');
  const list = await svc.listSessions();
  record('listSessions', list.length === 2, `n=${list.length}`);
}

// Sidepanel must call prune/delete for cap (structural)
{
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const sidepanel = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  const hasPrune =
    /workspaceRpc\(\s*['"]pruneSessions['"]/.test(sidepanel) ||
    /workspaceRpc\(\s*['"]deleteSession['"]/.test(sidepanel);
  // Cap may exist but must cascade
  const capCascades =
    /pruneSessions|deleteSession/.test(sidepanel.slice(sidepanel.indexOf('function savePersistentSessions')));
  record('ui-cap-cascades-runtime', hasPrune && capCascades, `hasPrune=${hasPrune}`);

  // Sidepanel selection mirror must request non-compact items (or rely on default false)
  const refreshFn = sidepanel.slice(
    sidepanel.indexOf('async function refreshWorkspaceGroupState'),
    sidepanel.indexOf('async function refreshWorkspaceGroupState') + 900
  );
  const asksItems =
    /getWorkspaceState/.test(refreshFn) &&
    (!/compact:\s*true/.test(refreshFn) || /compact:\s*false/.test(refreshFn));
  const mapsItems = /active\.items/.test(refreshFn) || /selectedElementsSummary/.test(refreshFn);
  record('sidepanel-refresh-requests-items', asksItems && mapsItems, '');

  const createFn = sidepanel.slice(
    sidepanel.indexOf('async function createCaptureGroup'),
    sidepanel.indexOf('async function createCaptureGroup') + 1400
  );
  const selectFn = sidepanel.slice(
    sidepanel.indexOf('async function selectActiveGroup'),
    sidepanel.indexOf('async function selectActiveGroup') + 700
  );
  const loadFn = sidepanel.slice(
    sidepanel.indexOf('async function loadActiveGroupOntoPage'),
    sidepanel.indexOf('async function loadActiveGroupOntoPage') + 1200
  );
  record(
    'create-or-switch-group-replaces-page-selection',
    /loadActiveGroupOntoPage\(\)/.test(createFn) &&
      /loadActiveGroupOntoPage\(\)/.test(selectFn) &&
      /restore_selection/.test(loadFn) &&
      /replace:\s*true/.test(loadFn) &&
      /silent:\s*true/.test(loadFn),
    ''
  );
  const cs = fs.readFileSync(path.join(root, 'src/content_script.js'), 'utf8');
  record(
    'content-restore-selection-can-replace',
    /request\.action === 'restore_selection'/.test(cs) &&
      /request\.replace !== false/.test(cs) &&
      /request\.silent === true/.test(cs),
    ''
  );
}

/**
 * Adversarial: product getWorkspaceState as Sidepanel calls it (no compact:true)
 * must return items with text/src so selection chips are not wiped.
 * Attack succeeds (BREACH) if itemCount>0 but items empty after default RPC.
 */
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('sel');
  await svc.createGroup({ name: 'Selection', sessionId: 'sel', bind: true });
  // createGroup sets activeGroupId
  await svc.syncTabSelection({
    sessionId: 'sel',
    tabId: 1,
    url: 'https://example.com/page',
    origin: 'https://example.com',
    pageTitle: 'Example',
    elements: [
      { text: 'CHIP_TEXT_SECRET', tag: 'P', selector: 'p.main' },
      { text: 'img alt', src: 'https://example.com/a.png', tag: 'IMG', kind: 'image' }
    ]
  });

  // Exactly like Sidepanel refreshWorkspaceGroupState — only sessionId (+ compact:false)
  const stateDefault = await svc.getWorkspaceState({ sessionId: 'sel' });
  const stateExplicit = await svc.getWorkspaceState({ sessionId: 'sel', compact: false });

  function sidepanelWouldClearSelection(state) {
    const active = state.groups?.find((g) => g.groupId === state.activeGroupId);
    if (!state.activeGroupId || !active) return true;
    const itemCount = Number(active.itemCount) || 0;
    const itemsLen = Array.isArray(active.items) ? active.items.length : 0;
    if (itemCount > 0 && itemsLen === 0) return true; // chips wiped while store has items
    if (itemsLen === 0) return true;
    const hasText = active.items.some(
      (it) => String(it.text || '').includes('CHIP_TEXT_SECRET') || String(it.src || '').includes('a.png')
    );
    return !hasText;
  }

  const clearDefault = sidepanelWouldClearSelection(stateDefault);
  const clearExplicit = sidepanelWouldClearSelection(stateExplicit);
  const active = stateDefault.groups?.find((g) => g.groupId === stateDefault.activeGroupId);
  record(
    'getWorkspaceState-sidepanel-selection-mirror',
    !clearDefault && !clearExplicit && (active?.items?.length || 0) >= 2,
    `itemCount=${active?.itemCount} itemsLen=${active?.items?.length} clearDefault=${clearDefault}`
  );

  // compact:true is allowed to omit items (index-only) — must not be the product default
  const compactState = await svc.getWorkspaceState({ sessionId: 'sel', compact: true });
  const compactActive = compactState.groups?.find((g) => g.groupId === compactState.activeGroupId);
  const compactOmits =
    (compactActive?.itemCount || 0) >= 1 &&
    (!Array.isArray(compactActive?.items) || compactActive.items.length === 0);
  record(
    'compact-true-omits-items-intentionally',
    compactOmits && stateDefault.compact !== true,
    `compactFlag=${stateDefault.compact} compactItems=${compactActive?.items?.length}`
  );
}

// H-8: stable WebItem identity on identical re-sync
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('sel');
  const el = [{ text: 'stable-text', tag: 'P', selector: 'p.main' }];
  await svc.syncTabSelection({ sessionId: 'sel', tabId: 7, elements: el });
  const s1 = await svc.getWorkspaceState({ sessionId: 'sel' });
  const active1 = s1.groups.find((g) => g.groupId === s1.activeGroupId);
  const id1 = active1?.items?.[0]?.webItemId;
  await svc.syncTabSelection({ sessionId: 'sel', tabId: 7, elements: el });
  const s2 = await svc.getWorkspaceState({ sessionId: 'sel' });
  const active2 = s2.groups.find((g) => g.groupId === s2.activeGroupId);
  const id2 = active2?.items?.[0]?.webItemId;
  const itemCount = svc.runtime.store.keys('items').length;
  record(
    'stable-selection-identity-resync',
    id1 && id1 === id2 && active2?.items?.length === 1 && itemCount === 1,
    `id1=${id1} id2=${id2} items=${itemCount}`
  );
  await svc.syncTabSelection({ sessionId: 'sel', tabId: 7, elements: [] });
  const afterEmpty = await svc.getWorkspaceState({ sessionId: 'sel' });
  const still = afterEmpty.groups.find((g) => g.groupId === afterEmpty.activeGroupId);
  record(
    'empty-resync-without-cleared-keeps-items',
    still?.items?.length === 1 && still.items[0].webItemId === id1,
    `n=${still?.items?.length}`
  );
  await svc.syncTabSelection({ sessionId: 'sel', tabId: 7, elements: [], cleared: true });
  const afterClear = await svc.getWorkspaceState({ sessionId: 'sel' });
  const gone = afterClear.groups.find((g) => g.groupId === afterClear.activeGroupId);
  record(
    'cleared-resync-drops-tab-items',
    !gone?.items?.length,
    `n=${gone?.items?.length || 0}`
  );
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('wipe');
  await svc.createGroup({ name: 'Sel', sessionId: 'wipe', bind: true });
  await svc.syncTabSelection({
    sessionId: 'wipe',
    tabId: 3,
    url: 'https://a.example/',
    elements: [{ selector: 'img.a', tag: 'img', src: 'https://a.example/x.png' }]
  });
  await svc.syncTabSelection({
    sessionId: 'wipe',
    tabId: 9,
    url: 'https://b.example/',
    elements: [{ selector: 'p.b', tag: 'p', text: 'hello' }]
  });
  const before = await svc.getWorkspaceState({ sessionId: 'wipe' });
  const gBefore = before.groups.find((g) => g.groupId === before.activeGroupId);
  await svc.clearCaptureSelection({ sessionId: 'wipe' });
  const after = await svc.getWorkspaceState({ sessionId: 'wipe' });
  const gAfter = after.groups.find((g) => g.groupId === after.activeGroupId);
  record(
    'clear-capture-drops-all-page-items',
    (gBefore?.items?.length || 0) >= 2 && !(gAfter?.items?.length),
    `before=${gBefore?.items?.length || 0} after=${gAfter?.items?.length || 0}`
  );
}

// New capture group must not inherit the previous group's members
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('iso');
  const g1 = await svc.createGroup({ name: 'Group 1', sessionId: 'iso' });
  await svc.syncTabSelection({
    sessionId: 'iso',
    tabId: 3,
    elements: [
      { text: 'a', tag: 'P', selector: 'p.a' },
      { text: 'b', tag: 'P', selector: 'p.b' },
      { text: 'c', tag: 'P', selector: 'p.c' },
      { text: 'd', tag: 'P', selector: 'p.d' },
      { text: 'e', tag: 'P', selector: 'p.e' }
    ]
  });
  const g2 = await svc.createGroup({ name: 'Group 2', sessionId: 'iso' });
  await svc.syncTabSelection({
    sessionId: 'iso',
    tabId: 3,
    elements: [{ text: 'only-g2', tag: 'P', selector: 'p.g2' }]
  });
  const state = await svc.getWorkspaceState({ sessionId: 'iso' });
  const one = state.groups.find((g) => g.groupId === g1.activeGroupId);
  const two = state.groups.find((g) => g.groupId === g2.activeGroupId);
  record(
    'new-group-sync-does-not-copy-previous-group',
    (one?.items?.length || 0) === 5 &&
      (two?.items?.length || 0) === 1 &&
      two.items[0].text === 'only-g2',
    `g1=${one?.items?.length} g2=${two?.items?.length}`
  );
}

// New capture group starts 图片1 — must not continue the previous group's counter
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('labels');
  await svc.createGroup({ name: 'Group 1', sessionId: 'labels' });
  await svc.syncTabSelection({
    sessionId: 'labels',
    tabId: 4,
    url: 'https://example.com/imgs',
    elements: [1, 2, 3, 4].map((n) => ({
      src: `https://cdn.example/g1-${n}.png`,
      kind: 'image',
      tag: 'IMG',
      selector: `img.g1-${n}`
    }))
  });
  await svc.createGroup({ name: 'Group 2', sessionId: 'labels' });
  const labeled = await svc.syncTabSelection({
    sessionId: 'labels',
    tabId: 4,
    url: 'https://example.com/imgs',
    elements: [
      { src: 'https://cdn.example/g2-1.png', kind: 'image', tag: 'IMG', selector: 'img.g2-1' }
    ]
  });
  const g1 = labeled.groups.find((g) => g.name === 'Group 1');
  const g2 = labeled.groups.find((g) => g.name === 'Group 2');
  record(
    'new-group-image-label-starts-at-1',
    g1?.items?.map((it) => it.labelN).join(',') === '1,2,3,4' &&
      g2?.items?.[0]?.labelN === 1 &&
      g2?.items?.[0]?.handle === 'image1',
    `g1=${g1?.items?.map((it) => it.labelN)} g2n=${g2?.items?.[0]?.labelN}`
  );
}

// Product: createGroup does NOT bind unless bind:true (user must bind manually)
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('manual');
  const created = await svc.createGroup({ name: 'Unbound', sessionId: 'manual' });
  record(
    'createGroup-default-does-not-bind',
    created.activeGroupId &&
      Array.isArray(created.boundGroupIds) &&
      !created.boundGroupIds.includes(created.activeGroupId),
    `active=${created.activeGroupId} bound=${JSON.stringify(created.boundGroupIds)}`
  );
}

// Capture Groups are ambient: picker + active target survive session switch
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  const a = await svc.createGroup({ name: 'A-group', sessionId: 'sess-a' });
  const aId = a.activeGroupId;
  const b = await svc.getWorkspaceState({ sessionId: 'sess-b' });
  const aAgain = await svc.getWorkspaceState({ sessionId: 'sess-a' });
  record(
    'capture-group-survives-session-switch',
    Boolean(aId) &&
      b.activeGroupId === aId &&
      b.groups.some((g) => g.groupId === aId && g.name === 'A-group') &&
      aAgain.activeGroupId === aId,
    `a=${aId} b=${b.activeGroupId} aAgain=${aAgain.activeGroupId}`
  );
}

// Switching UI must rehydrate from Runtime getSession (not wipe to welcome)
{
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  record(
    'switchSession-rehydrates-from-runtime',
    /async function hydrateActiveSessionThread/.test(side) &&
      /switchSession[\s\S]{0,400}hydrateActiveSessionThread/.test(side) &&
      /function renderActiveSessionMessages[\s\S]{0,80}hydrateActiveSessionThread/.test(side) &&
      /appendPendingThreadMessages/.test(side) &&
      /withSessionLive\(runSessionId, \(\) => beginLiveTurnUi\(\)\)/.test(side),
    ''
  );
}

// Durable store keeps messages across new service instances (not UI-only)
{
  __resetDurableMemoryBackends();
  const dbName = `persist-msg-${Date.now()}`;
  const store1 = await createDurableSessionWorkspaceStore({ dbName });
  const svc1 = new SessionWorkspaceService({ store: store1 });
  svc1.ensureSession('keep');
  await svc1.sendMessage({
    sessionId: 'keep',
    content: 'persist-me',
    callModel: async () => ({ text: 'still-here', toolCalls: [] })
  });
  await store1.flush();
  const store2 = await createDurableSessionWorkspaceStore({ dbName });
  const svc2 = new SessionWorkspaceService({ store: store2 });
  const sess = await svc2.getSession({ sessionId: 'keep' });
  const ok =
    (sess.messages || []).some((m) => m.role === 'user' && /persist-me/.test(m.content)) &&
    (sess.messages || []).some((m) => m.role === 'assistant' && /still-here/.test(m.content));
  record('durable-messages-survive-reopen', ok, `n=${sess.messages?.length}`);
}

// HTML document must not be stored as .md
{
  const html = '<!DOCTYPE html><html><body><h1>Report</h1></body></html>';
  record(
    'html-bytes-not-named-md',
    applyHtmlExtensionIfNeeded('result.md', new TextEncoder().encode(html)) === 'result.html',
    applyHtmlExtensionIfNeeded('result.md', new TextEncoder().encode(html))
  );
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's1', { sessionId: 's1', messages: [] });
  const fsG = createSessionGuestFs(store, { sessionId: 's1', executionId: null });
  fsG.mkdirp('/artifacts');
  const rec = createArtifact(store, fsG, {
    sessionId: 's1',
    name: 'result.md',
    content: html
  });
  record(
    'createArtifact-html-keeps-html-ext',
    /\.html$/i.test(rec.name) && /\.html$/i.test(rec.primaryPath) && rec.mimeType === 'text/html',
    `${rec.name} ${rec.primaryPath} ${rec.mimeType}`
  );
}

{
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  record(
    'artifact-shelf-is-collapsed-by-default',
    /id="artifactShelfList"/.test(html) &&
      /id="sessionArtifactAdd"/.test(html) &&
      /id="artifactRail"/.test(html),
    ''
  );
  record(
    'image-generated-does-not-auto-download',
    /function handleImageGeneratedEvent/.test(side) &&
      /refreshArtifactShelf/.test(side) &&
      !/handleImageGeneratedEvent[\s\S]{0,800}downloadGeneratedImageFile\(ev\.dataUrl/.test(side),
    ''
  );
  record(
    'deliverable-button-stays-visible',
    /id="sessionArtifactAdd"/.test(html) &&
      !/id="sessionArtifactAdd" hidden/.test(html) &&
      /root\.hidden = false/.test(side),
    ''
  );
  record(
    'session-thread-has-dev-traj-button',
    /mountSessionTrajectoryButton/.test(side) && /session-traj-btn/.test(side),
    ''
  );
  const cs = fs.readFileSync(path.join(root, 'src/content_script.js'), 'utf8');
  record(
    'page-badge-uses-sticky-label-not-array-index',
    /apply_selection_labels/.test(cs) &&
      /applyWorkspaceLabels/.test(cs) &&
      !/#\$\{idx\s*\+\s*1\}/.test(cs) &&
      /pushSelectionLabelsToTab/.test(side),
    ''
  );
  record(
    'picker-pierces-to-context',
    /pierceAndSnap/.test(cs) && /pickContext\.js/.test(cs),
    ''
  );
  record(
    'link-opt-bubble-has-download-copy-and-into-group',
    /pagewand-link-opt-bubble/.test(cs) &&
      /mk\('下载图片'/.test(cs) &&
      /mk\('复制链接'/.test(cs) &&
      /mk\('链接入组'/.test(cs) &&
      cs.indexOf("mk('下载图片'") < cs.indexOf("mk('复制链接'") &&
      cs.indexOf("mk('复制链接'") < cs.indexOf("mk('链接入组'") &&
      /page_url_into_group/.test(cs),
    ''
  );
  record(
    'url-items-two-entries-paste-and-link-into-group',
    /id="groupSelectAddLinks"/.test(html) &&
      /id="groupAddLinks"/.test(html) &&
      /commitPastedGroupLinks/.test(side) &&
      /addUrlsToActiveGroup/.test(side) &&
      /addedBy:\s*'paste'/.test(side) &&
      /page_url_into_group/.test(cs) &&
      !/id="addCurrentPageBtn"/.test(html) &&
      !/function addActiveTabToGroup/.test(side) &&
      !/addedBy:\s*'current-tab'/.test(side),
    ''
  );
  record(
    'linked-image-keeps-download-and-copy-href',
    /hasPageHref\) links \+= 1/.test(side) &&
      !/if \(coverish\) covers \+= 1/.test(side) &&
      /selectedHarvestHrefs/.test(side),
    ''
  );
  record(
    'cover-export-embeds-poster-and-link',
    /exportSelectedCoverLinks/.test(cs) && /preferAvif/.test(cs) && /fetchCoverAsDataUrl/.test(cs),
    ''
  );
}

{
  const {
    classifyContextKind,
    srcLooksImage,
    isPierceSkipDescriptor,
    hrefLooksDownloadable,
    matrixToCsv,
    pickNodeAtPoint,
    pickPreferredMediaAtPoint,
    pickBestSrcsetUrl
  } = await import('../../../src/agent/vnext/sessionWorkspace/pickContext.js');
  record(
    'video-src-is-not-image',
    classifyContextKind({ tag: 'video', src: 'https://cdn.example.com/media/a.mp4' }) === 'video' &&
      classifyContextKind({ tag: 'div', src: 'https://cdn.example.com/media/a.mp4' }) === 'video' &&
      srcLooksImage('https://cdn.example.com/media/a.mp4') === false,
    ''
  );
  record(
    'media-path-alone-is-not-image',
    classifyContextKind({ tag: 'div', src: 'https://cdn.example.com/media/foo' }) === 'text',
    classifyContextKind({ tag: 'div', src: 'https://cdn.example.com/media/foo' })
  );
  record(
    'img-still-image-and-svg-is-vector',
    classifyContextKind({ tag: 'img', src: 'https://x.com/a.png' }) === 'image' &&
      classifyContextKind({ tag: 'svg' }) === 'vector',
    ''
  );
  record(
    'anchor-is-link-not-container',
    classifyContextKind({ tag: 'a', href: 'https://example.com/file.pdf', text: '' }) === 'link',
    ''
  );
  record(
    'twitter-cdn-src-is-image',
    srcLooksImage('https://pbs.twimg.com/media/Gxxxx?format=jpg&name=large') === true &&
      srcLooksImage('https://pbs.twimg.com/media/Gxxxx?format=png&name=small') === true &&
      srcLooksImage('https://pbs.twimg.com/profile_images/1/abc_400x400.jpg') === true &&
      srcLooksImage('https://cdn.example.com/media/foo') === false &&
      classifyContextKind({
        tag: 'img',
        src: 'https://pbs.twimg.com/media/Gxxxx?format=jpg&name=small'
      }) === 'image',
    ''
  );
  record(
    'href-pdf-is-downloadable-not-plain-link-only',
    hrefLooksDownloadable('https://x.com/a.pdf') === true &&
      hrefLooksDownloadable('https://x.com/page') === false &&
      matrixToCsv([['a', 'b,c'], ['1', '2']]) === 'a,"b,c"\n1,2',
    ''
  );
  record(
    'prefer-poster-img-over-recycled-video',
    (() => {
      const box = (id, tag, l, t, w, h) => ({
        id,
        tagName: tag,
        getBoundingClientRect: () => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h })
      });
      const video = box('vid', 'VIDEO', 0, 0, 640, 360);
      const poster = box('poster', 'IMG', 0, 0, 640, 360);
      const imgA = box('a', 'IMG', 0, 0, 320, 180);
      const imgB = box('b', 'IMG', 340, 0, 320, 180);
      const overlayVideo = box('shared', 'VIDEO', 0, 0, 900, 360);
      return (
        pickPreferredMediaAtPoint([poster, video], 80, 80)?.id === 'poster' &&
        pickPreferredMediaAtPoint([overlayVideo, imgA, imgB], 40, 40)?.id === 'a' &&
        pickPreferredMediaAtPoint([overlayVideo, imgA, imgB], 400, 40)?.id === 'b'
      );
    })(),
    ''
  );
  record(
    'srcset-prefers-jpeg-over-avif',
    pickBestSrcsetUrl('a.avif 800w, b.jpg 800w, c.avif 1200w') === 'b.jpg',
    String(pickBestSrcsetUrl('a.avif 800w, b.jpg 800w, c.avif 1200w'))
  );
  record(
    'srcset-cover-prefers-avif',
    pickBestSrcsetUrl('a.avif 800w, b.jpg 800w, c.avif 1200w', { preferAvif: true }) === 'c.avif',
    String(pickBestSrcsetUrl('a.avif 800w, b.jpg 800w, c.avif 1200w', { preferAvif: true }))
  );
  record(
    'pick-smallest-box-at-point-not-first-video',
    (() => {
      const box = (id, l, t, w, h) => ({
        id,
        getBoundingClientRect: () => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h })
      });
      const v1 = box('v1', 0, 0, 400, 300);
      const v2 = box('v2', 420, 0, 400, 300);
      const overlay = box('ov', 0, 0, 900, 400);
      return (
        pickNodeAtPoint([v1, v2], 500, 40)?.id === 'v2' &&
        pickNodeAtPoint([v1, v2], 20, 40)?.id === 'v1' &&
        pickNodeAtPoint([overlay, v1, v2], 500, 40)?.id === 'v2'
      );
    })(),
    ''
  );
  record(
    'overlay-class-is-skipped',
    isPierceSkipDescriptor({ className: 'ytp-pause-overlay', tag: 'div', ownTextLen: 0 }) === true &&
      isPierceSkipDescriptor({ tag: 'video', className: 'player' }) === false,
    ''
  );
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('vid');
  await svc.createGroup({ name: 'Media', sessionId: 'vid' });
  await svc.syncTabSelection({
    sessionId: 'vid',
    tabId: 9,
    elements: [{ tag: 'video', src: 'https://cdn.example.com/media/clip.mp4', kind: 'video', text: '' }]
  });
  const st = await svc.getWorkspaceState({ sessionId: 'vid' });
  const it = st.groups.find((g) => g.groupId === st.activeGroupId)?.items?.[0];
  record(
    'sync-video-keeps-video-kind',
    it && (it.labelKind === 'video' || it.kindHint === 'video') && it.labelKind !== 'image',
    `kindHint=${it?.kindHint} labelKind=${it?.labelKind}`
  );
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('clip');
  const st0 = await svc.getWorkspaceState({ sessionId: 'clip' });
  const clip = st0.groups.find((g) => g.kind === 'clipboard');
  record('clipboard-group-always-present', !!clip && clip.name === 'Clipboard', `n=${st0.groups.length}`);
  let delOk = false;
  try {
    await svc.deleteGroup({ groupId: clip.groupId, sessionId: 'clip' });
  } catch (e) {
    delOk = /CLIPBOARD_GROUP_PROTECTED/.test(String(e?.message || e));
  }
  record('clipboard-group-cannot-delete', delOk, '');
  let nameOk = false;
  try {
    await svc.createGroup({ name: '剪切板', sessionId: 'clip' });
  } catch (e) {
    nameOk = /CLIPBOARD_NAME_RESERVED|DUPLICATE_GROUP_NAME/.test(String(e?.message || e));
  }
  record('clipboard-name-reserved', nameOk, '');
  const pinned = await svc.pinClipboard({
    sessionId: 'clip',
    items: [{ text: '第一段钉住' }, { text: '第一段钉住' }, { text: '第二段' }]
  });
  const clip2 = pinned.groups.find((g) => g.kind === 'clipboard');
  record(
    'clipboard-pin-dedupes-text',
    clip2?.itemCount === 2 && clip2.items?.some((i) => i.text.includes('第二段')),
    `count=${clip2?.itemCount}`
  );
  const activeAfterPin = pinned.activeGroupId;
  record(
    'clipboard-is-not-capture-target',
    activeAfterPin !== clip2.groupId,
    `active=${activeAfterPin}`
  );
  await svc.bindGroups({ sessionId: 'clip', groupIds: [clip2.groupId] });
  const { getBoundGroupsCompact } = await import(
    '../../../src/agent/vnext/sessionWorkspace/groups.js'
  );
  const compact = getBoundGroupsCompact(svc.runtime.store, 'clip');
  record(
    'clipboard-bind-visible-to-inspect-index',
    compact.some((g) => g.kind === 'clipboard' && g.itemCount === 2),
    JSON.stringify(compact)
  );
}

console.log(`\nwave6 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE6 PASS: session SoT attacks defeated');
