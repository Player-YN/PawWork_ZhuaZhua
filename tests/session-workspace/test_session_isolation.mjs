import assert from 'node:assert/strict';
import {
  shouldApplySessionBroadcast,
  sessionThreadShouldHide,
  sheetTabMatches,
  htmlTabMatches,
  mergeSessionTranscriptMessages,
  pendingThreadMessages
} from '../../src/sidepanel/sessionIsolation.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  ensureClipboardGroup,
  isClipboardGroup
} from '../../src/agent/vnext/sessionWorkspace/groups.js';

function run() {
  assert.deepEqual(
    mergeSessionTranscriptMessages(
      [{ role: 'user', content: 'u' }],
      [
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'done', thought: 'why' }
      ]
    ),
    [
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'done', thought: 'why' }
    ]
  );
  assert.deepEqual(
    mergeSessionTranscriptMessages(
      [
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'host', path: [{ type: 'tool' }] }
      ],
      [{ role: 'user', content: 'u' }]
    ),
    [
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'host', path: [{ type: 'tool' }] }
    ]
  );
  assert.deepEqual(
    pendingThreadMessages(
      [
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'a', thought: 't' }
      ],
      { user: 1, assistant: 0 }
    ),
    [{ role: 'assistant', content: 'a', thought: 't' }]
  );

  assert.equal(shouldApplySessionBroadcast('', 'session-a'), false);
  assert.equal(shouldApplySessionBroadcast('session-a', ''), false);
  assert.equal(shouldApplySessionBroadcast('session-a', 'session-b'), false);
  assert.equal(shouldApplySessionBroadcast('session-a', 'session-a'), true);

  const urlA = 'chrome-extension://x/src/preview/sheet.html?sessionId=session-a&artifactId=art1';
  const urlB = 'chrome-extension://x/src/preview/sheet.html?sessionId=session-b&artifactId=art1';
  assert.equal(sheetTabMatches(urlA, 'session-a', 'art1'), true);
  assert.equal(sheetTabMatches(urlB, 'session-a', 'art1'), false);
  assert.equal(sheetTabMatches(urlA, 'session-a', 'art2'), false);
  assert.equal(sheetTabMatches('https://youtube.com/', 'session-a', 'art1'), false);

  const htmlA = 'chrome-extension://x/src/preview/artifactPreview.html?sessionId=session-a&ids=html1&artifactId=html1';
  const htmlB = 'chrome-extension://x/src/preview/artifactPreview.html?sessionId=session-b&ids=html1&artifactId=html1';
  assert.equal(htmlTabMatches(htmlA, 'session-a', 'html1'), true);
  assert.equal(htmlTabMatches(htmlB, 'session-a', 'html1'), false);
  assert.equal(htmlTabMatches(htmlA, 'session-a', 'html2'), false);
  assert.equal(htmlTabMatches('', 'session-a', 'html1'), false);
  const siteA = 'chrome-extension://x/src/preview/site.html?sessionId=session-a&artifactId=html1';
  const siteB = 'chrome-extension://x/src/preview/site.html?sessionId=session-b&artifactId=html1';
  assert.equal(htmlTabMatches(siteA, 'session-a', 'html1'), true);
  assert.equal(htmlTabMatches(siteB, 'session-a', 'html1'), false);

  assert.equal(sessionThreadShouldHide('session-a', 'session-b'), true);
  assert.equal(sessionThreadShouldHide('session-a', 'session-a'), false);
  assert.equal(sessionThreadShouldHide('', 'session-a'), true);
  assert.equal(sessionThreadShouldHide('session-a', ''), true);

  const sidePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/sidepanel.js');
  const side = fs.readFileSync(sidePath, 'utf8');
  const showFn = side.slice(side.indexOf('function showWelcome'), side.indexOf('function getGuideOnlyHints'));
  assert.equal(
    /session-thread, \.task-card, \.viewing-banner[\s\S]{0,80}\.remove\(\)/.test(showFn),
    false,
    'showWelcome must not wipe other session threads'
  );
  assert.match(showFn, /hideForeignSessionThreads/);
  assert.match(side, /mountSessionThreadEl/);
  assert.match(side, /getWorkspaceSessionId\(\) !== sid/);
  assert.match(side, /appendPendingThreadMessages/);
  assert.match(side, /liveTurnSealed/);
  assert.match(side, /withSessionLive\(runSessionId, \(\) => beginLiveTurnUi\(\)\)/);

  return Promise.resolve()
    .then(async () => {
      const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
      svc.ensureSession('sa');
      svc.ensureSession('sb');
      await svc.pinClipboard({ sessionId: 'sa', items: [{ text: 'only-a' }] });
      await svc.pinClipboard({ sessionId: 'sb', items: [{ text: 'only-b' }] });
      const a = await svc.getWorkspaceState({ sessionId: 'sa' });
      const b = await svc.getWorkspaceState({ sessionId: 'sb' });
      const clipA = a.groups.find((g) => g.kind === 'clipboard');
      const clipB = b.groups.find((g) => g.kind === 'clipboard');
      assert.ok(clipA && clipB);
      assert.notEqual(clipA.groupId, clipB.groupId);
      assert.ok(clipA.items?.some((i) => String(i.text).includes('only-a')));
      assert.equal(clipA.items?.some((i) => String(i.text).includes('only-b')), false);
      assert.ok(clipB.items?.some((i) => String(i.text).includes('only-b')));
      const ga = await svc.createGroup({ name: '组A', sessionId: 'sa' });
      const gb = await svc.createGroup({ name: '组B', sessionId: 'sb' });
      const a2 = await svc.getWorkspaceState({ sessionId: 'sa' });
      const b2 = await svc.getWorkspaceState({ sessionId: 'sb' });
      assert.ok(a2.groups.some((g) => g.name === '组A'));
      assert.ok(a2.groups.some((g) => g.name === '组B'));
      assert.ok(b2.groups.some((g) => g.name === '组B'));
      assert.ok(b2.groups.some((g) => g.name === '组A'));
      assert.equal(a2.activeGroupId, gb.activeGroupId);
      assert.equal(b2.activeGroupId, gb.activeGroupId);
      void ga;
      void gb;

      await svc.createGroup({ name: 'Attachments', sessionId: 'sa' });
      let attachDup = null;
      try {
        await svc.createGroup({ name: 'Attachments', sessionId: 'sb' });
      } catch (err) {
        attachDup = err;
      }
      assert.equal(String(attachDup?.code || attachDup?.message || '').includes('DUPLICATE_GROUP_NAME'), true);
      await svc.createGroup({ name: 'Group 1', sessionId: 'sa' });
      const a3 = await svc.getWorkspaceState({ sessionId: 'sa' });
      const b3 = await svc.getWorkspaceState({ sessionId: 'sb' });
      assert.equal(a3.groups.filter((g) => g.name === 'Attachments').length, 1);
      assert.equal(b3.groups.filter((g) => g.name === 'Attachments').length, 1);
      assert.equal(
        a3.groups.find((g) => g.name === 'Attachments').groupId,
        b3.groups.find((g) => g.name === 'Attachments').groupId
      );
      assert.ok(a3.groups.some((g) => g.name === 'Group 1'));
      assert.ok(b3.groups.some((g) => g.name === 'Group 1'));

      await svc.syncTabSelection({
        sessionId: 'sa',
        tabId: 11,
        url: 'https://example.com/page',
        elements: [{ src: 'https://example.com/page-a.png', kind: 'image', tag: 'IMG', selector: '#a' }]
      });
      await svc.syncTabSelection({
        sessionId: 'sb',
        tabId: 11,
        url: 'https://example.com/page',
        elements: [{ src: 'https://example.com/page-b.png', kind: 'image', tag: 'IMG', selector: '#b' }]
      });
      const a4 = await svc.getWorkspaceState({ sessionId: 'sa' });
      const b4 = await svc.getWorkspaceState({ sessionId: 'sb' });
      const itemsA = a4.groups.flatMap((g) => g.items || []);
      const itemsB = b4.groups.flatMap((g) => g.items || []);
      assert.ok(itemsA.some((i) => String(i.src).includes('page-b.png')));
      assert.ok(itemsB.some((i) => String(i.src).includes('page-b.png')));
      assert.equal(itemsA.some((i) => String(i.src).includes('page-a.png')), false);

      const acA = new AbortController();
      const acB = new AbortController();
      svc._activeBySession.set('sa', { controller: acA, executionId: 'ea', sessionId: 'sa' });
      svc._activeBySession.set('sb', { controller: acB, executionId: 'eb', sessionId: 'sb' });
      await svc.abortTask({ sessionId: 'sa' });
      assert.equal(acA.signal.aborted, true);
      assert.equal(acB.signal.aborted, false);

      const store = new SessionWorkspaceStore();
      const c1 = ensureClipboardGroup(store, 's1');
      const c2 = ensureClipboardGroup(store, 's2');
      assert.ok(isClipboardGroup(c1) && isClipboardGroup(c2));
      assert.notEqual(c1.groupId, c2.groupId);
      console.log('test_session_isolation: ok');
    });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
