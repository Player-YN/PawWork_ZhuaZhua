/**
 * Current-tab world injection + @ page focus. Hits shipped sendMessage / world / mentions.
 */
import assert from 'node:assert/strict';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/store.js';
import { createSession } from '../../src/agent/vnext/sessionWorkspace/sessionApi.js';
import { sendMessage } from '../../src/agent/vnext/sessionWorkspace/sendMessage.js';
import { buildSessionAgentInstructions, buildWorldStateBlock } from '../../src/agent/vnext/sessionWorkspace/prompt.js';
import {
  normalizePageRef,
  isInjectableTabUrl,
  resolveFocusPage,
  rememberVisitedPage,
  listVisitedPages,
  pageRefId,
  classifyWorkTab,
  isPawWorkTabUrl,
  workTabListenLabel
} from '../../src/agent/vnext/sessionWorkspace/pageContext.js';
import { I18N } from '../../src/sidepanel/i18n.js';
import {
  buildMentionCandidates,
  nestMentionCandidates,
  normalizeComposerMentions
} from '../../src/sidepanel/composerMentions.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(isInjectableTabUrl('https://ideashell.ai/'), true);
assert.equal(isInjectableTabUrl('chrome://extensions'), false);
assert.equal(isInjectableTabUrl('chrome-extension://abc/src/sidepanel.html'), false);
assert.equal(classifyWorkTab('chrome-extension://abc/src/preview/design.html?shell=slides'), 'slides');
assert.equal(classifyWorkTab('chrome-extension://abc/src/preview/design.html'), 'design');
assert.equal(classifyWorkTab('chrome-extension://abc/src/preview/site.html?sessionId=s'), 'site');
assert.equal(isPawWorkTabUrl('https://example.com/'), false);
assert.equal(workTabListenLabel('slides', 'zh'), '幻灯');
assert.equal(workTabListenLabel('site', 'zh'), '网页');
assert.equal(workTabListenLabel('preview', 'zh'), '预览');
assert.equal(workTabListenLabel('sheet', 'zh'), '表格');
assert.equal(workTabListenLabel('preview', 'en'), 'Preview');
assert.equal(normalizePageRef({ url: 'https://ideashell.ai/', title: '闪念贝壳' }).host, 'ideashell.ai');
assert.equal(normalizePageRef({ url: 'chrome://flags' }), null);
assert.equal(normalizePageRef(null), null);
assert.equal(resolveFocusPage({ activeTab: null, mentions: [] }).focusPage, null);

const tab = { url: 'https://ideashell.ai/', title: '闪念贝壳' };
const def = resolveFocusPage({ activeTab: tab, mentions: [] });
assert.equal(def.focusPage.url, 'https://ideashell.ai/');
assert.equal(def.overridden, false);

const other = resolveFocusPage({
  activeTab: tab,
  mentions: [
    {
      kind: 'page',
      id: pageRefId({ url: 'https://example.com/pricing' }),
      url: 'https://example.com/pricing',
      label: 'example.com'
    }
  ]
});
assert.equal(other.overridden, true);
assert.equal(other.focusPage.host, 'example.com');
assert.equal(other.activeTab.host, 'ideashell.ai');

const store = new SessionWorkspaceStore();
createSession(store, { sessionId: 's-page' });
rememberVisitedPage(store, 's-page', tab);
rememberVisitedPage(store, 's-page', { url: 'https://example.com/a' });
rememberVisitedPage(store, 's-page', tab);
const visited = listVisitedPages(store, 's-page');
assert.equal(visited[0].url, 'https://ideashell.ai/');
assert.equal(visited.length, 2);

const world = buildWorldStateBlock({
  boundGroups: [],
  artifactCount: 0,
  activeTab: def.activeTab,
  focusPage: def.focusPage
});
assert.match(world, /activeTab=/);
assert.match(world, /focusPage=/);
assert.match(world, /ideashell\.ai/);
assert.match(world, /not a SelectionGroup/);

const system = buildSessionAgentInstructions({ sessionId: 's-page' });
assert.match(system, /focusPage/);
assert.match(system, /Do not invent page copy/);
assert.doesNotMatch(system, /acquire fetch that URL/);

const pal = buildMentionCandidates([], [], '', 'zh', [], [
  { ...tab, current: true },
  { url: 'https://example.com/a', title: 'Example' }
]);
assert.ok(pal.some((c) => c.kind === 'pages'));
assert.ok(pal.some((c) => c.kind === 'page' && c.url === 'https://ideashell.ai/'));
const nested = nestMentionCandidates(pal);
assert.ok(nested.some((s) => s.group?.kind === 'pages' && s.items.some((it) => it.kind === 'page')));

const mentions = normalizeComposerMentions([
  { kind: 'page', id: pageRefId(tab), label: 'ideashell.ai', url: tab.url, groupId: '__pages__' }
]);
assert.equal(mentions[0].kind, 'page');
assert.equal(mentions[0].url, tab.url);

assert.equal(I18N.zh.composerTypeLines.length, I18N.en.composerTypeLines.length);
assert.ok(I18N.zh.composerTypeLines.length >= 10 && I18N.zh.composerTypeLines.length <= 14);
assert.ok(I18N.zh.composerTypeLines.includes('选中，说要什么'));
assert.ok(I18N.en.composerTypeLines.includes('Select it. Say the outcome.'));
assert.ok(I18N.zh.composerTypeLines.some((s) => /粘贴截图/.test(s)));
assert.ok(I18N.en.composerTypeLines.some((s) => /Paste a screenshot/.test(s)));

let captured = '';
const rt = new SessionWorkspaceStore();
createSession(rt, { sessionId: 's-send' });
const sent = await sendMessage(rt, {
  sessionId: 's-send',
  content: '把这页网站做成竖版海报，五个字段各成可点区域',
  activeTab: tab,
  callModel: async ({ messages }) => {
    captured = JSON.stringify(messages);
    return { text: 'ok', toolCalls: [] };
  }
});
assert.equal(sent.ok !== false, true, sent.error);
assert.match(captured, /ideashell\.ai/);
assert.match(captured, /focusPage=/);
assert.match(captured, /activeTab=/);
const remembered = listVisitedPages(rt, 's-send');
assert.ok(remembered.some((p) => p.host === 'ideashell.ai'));

let capturedOverride = '';
await sendMessage(rt, {
  sessionId: 's-send',
  content: '用另一页',
  activeTab: tab,
  mentions: [
    {
      kind: 'page',
      id: pageRefId({ url: 'https://example.com/pricing' }),
      url: 'https://example.com/pricing',
      label: 'example.com'
    }
  ],
  callModel: async ({ messages }) => {
    capturedOverride = JSON.stringify(messages);
    return { text: 'ok', toolCalls: [] };
  }
});
assert.match(capturedOverride, /example\.com\/pricing/);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
assert.match(side, /activeTab:\s*lastActivePage/);
assert.doesNotMatch(side, /formatWorldStrip/);
assert.doesNotMatch(side, /renderWorldStrip/);
assert.doesNotMatch(html, /id="worldStrip"/);
assert.doesNotMatch(css, /\.world-strip/);
assert.match(html, /id="composerTypewriter"/);
assert.match(html, /data-i18n-aria="inputPlaceholder"/);
assert.match(side, /function restartComposerTypewriter/);
assert.match(side, /I18N\[currentLang\]\?\.composerTypeLines/);
assert.match(side, /mentionComposing/);
assert.match(css, /\.composer-typewriter/);
assert.doesNotMatch(css, /#input\.is-empty::before/);
assert.match(side, /mentionPageCandidates/);
assert.match(side, /setPageListenState\('ok', domain\)/);
assert.match(side, /setPageListenState\('editor'/);
assert.match(side, /isPawWorkTabUrl/);
assert.match(side, /promptQueue/);
assert.match(side, /flushPromptQueue/);
assert.match(html, /id="promptQueueHint"/);

const skill = fs.readFileSync(path.join(root, 'src/agent/vnext/skills/poster/skillSource.js'), 'utf8');
assert.match(skill, /focusPage/);
assert.match(skill, /acquire fetch/);
assert.match(skill, /fromPage/);
assert.doesNotMatch(skill, /campus-recruitment/);

console.log('test_page_context: ok');
