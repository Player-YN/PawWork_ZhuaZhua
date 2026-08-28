import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPawWorkPageUrl,
  isPawLockableWorkPageUrl,
  pawWorkPageFile,
  sessionIdFromPawWorkUrl,
  shouldFocusPawWorkTab,
  shouldJoinSessionGroup,
  shouldLockWorkTab,
  tabCreateProps,
  shouldFocusChromeWindow,
  sessionGroupTitle,
  sessionGroupUpdate,
  sessionGroupColor
} from '../../src/agent/vnext/host/pawTabGroups.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ext = (file, q = 'sessionId=s1&artifactId=a1') =>
  `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/src/preview/${file}?${q}`;

function run() {
  assert.equal(pawWorkPageFile(ext('design.html', 'sessionId=s1&shell=slides')), 'design.html');
  assert.equal(isPawWorkPageUrl(ext('design.html', 'sessionId=s1&shell=slides')), true);
  assert.equal(isPawWorkPageUrl(ext('sheet.html')), true);
  assert.equal(isPawWorkPageUrl(ext('docs.html')), true);
  assert.equal(isPawWorkPageUrl(ext('site.html')), true);
  assert.equal(isPawWorkPageUrl(ext('artifactPreview.html')), true);
  assert.equal(isPawWorkPageUrl(ext('preview.html', 'draftId=d1&sessionId=s1')), true);
  assert.equal(isPawWorkPageUrl('https://example.com/sheet.html'), false);
  assert.equal(isPawWorkPageUrl('https://news.example/article'), false);
  assert.equal(isPawWorkPageUrl('chrome-extension://x/src/sidepanel.html'), false);
  assert.equal(isPawWorkPageUrl('chrome-extension://x/src/preview/print.html'), false);
  assert.equal(isPawWorkPageUrl(''), false);

  assert.equal(sessionIdFromPawWorkUrl(ext('design.html', 'sessionId=task-9&artifactId=a')), 'task-9');
  assert.equal(sessionIdFromPawWorkUrl('https://example.com/'), '');

  assert.equal(sessionGroupTitle({ title: '海报改版' }), '海报改版');
  assert.equal(sessionGroupTitle({ name: '💬 周报' }), '周报');
  assert.equal(sessionGroupTitle({ sessionId: 'session-3' }), '任务 3');
  assert.equal(sessionGroupTitle({ sessionId: 'session-3', lang: 'en' }), 'Task 3');
  assert.equal(sessionGroupTitle({ title: 'session-3', sessionId: 'session-3' }), '任务 3');
  assert.equal(sessionGroupTitle({ index: 2 }), '任务 2');
  assert.equal(sessionGroupTitle({}), '任务 1');
  assert.ok(sessionGroupTitle({ title: 'x'.repeat(80) }).length <= 50);

  assert.equal(shouldFocusPawWorkTab({ reason: 'agent' }), false);
  assert.equal(shouldFocusPawWorkTab({ reason: 'preview' }), false);
  assert.equal(shouldFocusPawWorkTab({ reason: 'canvas' }), false);
  assert.equal(shouldFocusPawWorkTab({ reason: 'user' }), true);
  assert.equal(shouldFocusPawWorkTab({ reason: 'reveal' }), true);
  assert.equal(shouldFocusPawWorkTab({}), false);
  assert.equal(shouldFocusPawWorkTab({ focus: true, reason: 'agent' }), true);
  assert.equal(shouldFocusPawWorkTab({ focus: false, reason: 'user' }), false);
  assert.deepEqual(tabCreateProps({ url: 'u', focus: false }), { url: 'u', active: false });
  assert.deepEqual(tabCreateProps({ url: 'u', focus: true }), { url: 'u', active: true });
  assert.equal(shouldFocusChromeWindow(true), false);
  assert.equal(shouldFocusChromeWindow(false), false);

  for (const file of ['design.html', 'sheet.html', 'docs.html', 'site.html']) {
    assert.equal(isPawLockableWorkPageUrl(ext(file)), true);
    assert.equal(shouldLockWorkTab({ url: ext(file), lockedSessionId: 's1' }), true);
  }
  assert.equal(isPawLockableWorkPageUrl(ext('artifactPreview.html')), false);
  assert.equal(isPawLockableWorkPageUrl(ext('preview.html', 'draftId=d1&sessionId=s1')), false);
  assert.equal(shouldLockWorkTab({ url: ext('design.html'), lockedSessionId: '' }), false);
  assert.equal(shouldLockWorkTab({ url: ext('design.html', 'sessionId=s2'), lockedSessionId: 's1' }), false);
  assert.equal(shouldLockWorkTab({ url: 'https://huaban.com/pins/1', lockedSessionId: 's1' }), false);
  assert.equal(shouldLockWorkTab({ url: 'https://news.example/article', lockedSessionId: 's1' }), false);
  assert.equal(shouldLockWorkTab({ url: ext('artifactPreview.html'), lockedSessionId: 's1' }), false);
  assert.equal(shouldLockWorkTab({ url: 'chrome-extension://x/src/sidepanel.html', lockedSessionId: 's1' }), false);

  const design = ext('design.html');
  assert.equal(shouldJoinSessionGroup({ url: design, sessionId: 's1', reason: 'agent' }), true);
  assert.equal(shouldJoinSessionGroup({ url: design, sessionId: 's1', reason: 'user' }), true);
  assert.equal(shouldJoinSessionGroup({ url: design, sessionId: 's1', reason: 'reveal' }), false);
  assert.equal(shouldJoinSessionGroup({ url: 'https://news.example/x', sessionId: 's1' }), false);
  assert.equal(shouldJoinSessionGroup({ url: ext('preview.html', 'draftId=d1'), sessionId: '' }), false);
  assert.equal(shouldJoinSessionGroup({ sessionId: '' }), false);
  assert.equal(shouldJoinSessionGroup({ sessionId: 's1', reason: 'canvas' }), true);

  const upd = sessionGroupUpdate({ title: '任务 1', sessionId: 's1' });
  assert.equal(upd.title, '任务 1');
  assert.equal(upd.collapsed, true);
  assert.equal(typeof upd.color, 'string');
  assert.equal(sessionGroupColor('s1'), sessionGroupColor('s1'));
  assert.notEqual(sessionGroupColor('s1'), sessionGroupColor('s2'));

  const bg = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');
  assert.match(manifest, /"tabGroups"/);
  assert.match(bg, /openPawWorkTab/);
  assert.match(bg, /attachTabToSessionGroup/);
  assert.doesNotMatch(bg, /windows\.update\([^;]*focused:\s*true/);
  assert.match(bg, /waitHtmlReady/);
  assert.match(bg, /waitSheetReady/);
  assert.match(bg, /setSessionWorkLock/);
  assert.match(bg, /paw_work_lock/);
  assert.match(bg, /execution-start/);
  assert.match(bg, /execution-end/);

  for (const file of ['design.html', 'sheet.html', 'docs.html', 'site.html']) {
    const html = fs.readFileSync(path.join(root, 'src/preview', file), 'utf8');
    assert.match(html, /workLock\.css/);
    assert.match(html, /workLock\.js/);
  }
  const previewOnly = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
  assert.doesNotMatch(previewOnly, /workLock/);
  const cs = fs.readFileSync(path.join(root, 'src/content_script.js'), 'utf8');
  assert.doesNotMatch(cs, /paw-work-lock|paw_work_lock|workLock/);

  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  assert.match(side, /function revealCapturedElement/);
  assert.doesNotMatch(
    side.slice(side.indexOf('async function revealCapturedElement'), side.indexOf('async function revealCapturedElement') + 1800),
    /attachTabToSessionGroup|openPawWorkTab|tabs\.group/
  );

  console.log('test_paw_tab_groups: ok');
}

run();
