import { makeRuntime, callModelWriteArtifact, assert } from './_fixture.mjs';
import {
  SessionWorkspaceStore,
  createDurableSessionWorkspaceStore,
  __resetDurableMemoryBackends,
  buildSessionAgentInstructions,
  buildWorldStateBlock,
  buildWireFromTurn,
  replayWireMessages,
  attachWorldToLastUser,
  isPlaceholderTaskTitle,
  nextTaskTitle,
  shrinkPromptTitle,
  generateTaskTitle,
  normalizeSessionTitle,
  SESSION_TITLE_MAX,
  nextGroupName,
  COMPACT_RATIO,
  shouldCompact,
  findCompactCutIndex,
  contextUsageRatio,
  serializeBehaviorTrajectory,
  classifyArtifactSelection,
  seedPlatesFromArtifacts,
  platesToPptxBytes,
  exportPlates,
  createLiveProgressState,
  applyLiveProgress
} from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { validateArtifactBytes } from '../../../src/agent/vnext/sessionWorkspace/artifactValidate.js';
import { parseOfficeMarkdown } from '../../../src/markdown/officeMarkdown.js';
import {
  allocateLabelN,
  ensureItemLabel,
  formatItemLabel,
  itemHandle,
  listBoundItemIndex,
  normalizeItemHandle,
  resolveBoundItemRef
} from '../../../src/agent/vnext/sessionWorkspace/itemLabel.js';
import {
  recordBehaviorEvent,
  splitTurnTiming
} from '../../../src/agent/vnext/sessionWorkspace/behaviorPath.js';
import {
  sanitizeOpenAiMessage,
  stripUnsupportedFieldsFromRequestInit,
  liftOpenRouterReasoningPayload,
  liftToolResultImages
} from '../../../src/agent/provider.js';
import {
  effortLevelsForReasoning,
  parseContextWindow,
  resolveContextWindow,
  guessContextWindow,
  isVisionCapableModel,
  classifyChatVisionCapability,
  isKnownTextOnlyChatModel
} from '../../../src/agent/modelCatalog.js';
import { formatSkillsForSystemPrompt } from '../../../src/agent/vnext/skills/registry.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution, settleExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import {
  PAGE_ITEM_CAP,
  addPageItems,
  parseHttpUrls,
  normalizePageUrl,
  resolvePageUrlAlias,
  formatPageAddSummary
} from '../../../src/agent/vnext/sessionWorkspace/pageItems.js';

/** S-Q many artifacts not injected into initial model context */
export async function runCase() {
  const rt = makeRuntime();
  const sess = rt.createSession();
  const fs = rt.guestFs(sess.sessionId, null);
  for (let i = 0; i < 50; i++) {
    rt.createArtifact(fs, {
      sessionId: sess.sessionId,
      name: `file-${i}.md`,
      content: `body-${i}-UNIQUE-${i}`
    });
  }
  const compact = rt.getArtifactIndexCompact(sess.sessionId);
  assert(compact.artifactCount === 50, 'count is 50');
  const system = buildSessionAgentInstructions({
    sessionId: sess.sessionId
  });
  assert(!system.includes('artifactCount='), 'count stays out of stable system prefix');
  assert(!system.includes('boundGroups='), 'bindings stay out of stable system prefix');
  assert(/ask once/i.test(system), 'unclear intent yields once then stops');
  assert(system.includes('do not guess'), 'unclear intent must not be guessed');
  assert(!system.includes('```popcard'), 'popcard fence stays out of system prefix');
  assert(system.includes('clarify yield'), 'clarify is a control yield, not a skill playbook');
  assert(/1–2 short sentences/.test(system), 'tool preamble is 1–2 sentences, not a plan essay');
  assert(/Bound page context outranks/i.test(system), 'bound page outranks public search');
  assert(!/map to list a site/.test(system), 'acquire action verbs stay in tool schema');
  assert(/image1/.test(system) && /screenshot1/.test(system), 'system maps sticky material handles');
  assert(/video1/.test(system) && /link1/.test(system), 'system maps video/link harvest handles');
  assert(!/Tavily|Brave|Firecrawl|DuckDuckGo/i.test(system), 'vendor search names stay out of system');
  assert(system.includes('not the final answer'), 'preamble is not the terminal reply');
  assert(!system.includes('UNIQUE-49'), 'must not dump all artifact bodies');
  assert(!system.includes('body-25'), 'must not list artifact contents');
  const world = buildWorldStateBlock({
    boundGroups: [{ id: 'g1', name: 'Bound', itemCount: 3 }],
    artifactCount: compact.artifactCount
  });
  assert(world.includes('artifactCount=50'), 'count in replaceable world suffix');
  assert(world.includes('"id":"g1"'), 'world suffix lists bound group ids');
  assert(world.includes('boundItems='), 'world suffix lists sticky bound item handles');
  assert(!world.includes('UNIQUE-49'), 'world suffix is an index, not bodies');
  const worldFocus = buildWorldStateBlock({
    boundGroups: [{ id: 'g1', name: 'Bound', itemCount: 3 }],
    focusedMentions: [{ kind: 'item', id: 'it1', handle: 'image1', label: '图片1' }]
  });
  assert(worldFocus.includes('focusedMentions='), 'world records composer @ tokens');
  assert(worldFocus.includes('it1'), 'focused mention keeps item id');
  assert(worldFocus.includes('not an inspect order'), '@ does not force inspect');

  const { buildMentionCandidates, nestMentionCandidates } = await import(
    '../../../src/sidepanel/composerMentions.js'
  );
  const pal = buildMentionCandidates(
    [
      {
        groupId: 'g1',
        name: '订单表',
        items: [{ webItemId: 'it1', labelKind: 'image', labelN: 1, handle: 'image1' }]
      }
    ],
    ['g1'],
    '图片',
    'zh'
  );
  assert(pal.some((c) => c.kind === 'item' && c.id === 'it1'), '@ palette can match sticky 图片1');
  assert(pal.some((c) => c.kind === 'group' && c.id === 'g1'), '@ filter keeps parent group for nested list');
  assert(pal.every((c) => c.id), '@ palette rows have stable ids');
  const nested = nestMentionCandidates(pal);
  assert(nested.length === 1 && nested[0].items.length === 1, '@ palette nests items under group');

  const palFiles = buildMentionCandidates(
    [],
    [],
    'xlsx',
    'zh',
    [{ artifactId: 'art1', name: '预算.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]
  );
  assert(
    palFiles.some((c) => c.kind === 'artifact' && c.id === 'art1'),
    '@ palette lists workspace xlsx'
  );
  assert(
    palFiles.some((c) => c.kind === 'workspace'),
    '@ palette has a workspace section'
  );
  const nestedFiles = nestMentionCandidates(palFiles);
  assert(
    nestedFiles.some((s) => s.group?.kind === 'workspace' && s.items.some((it) => it.id === 'art1')),
    '@ palette nests artifacts under workspace'
  );
  const worldArt = buildWorldStateBlock({
    boundGroups: [],
    focusedMentions: [{ kind: 'artifact', id: 'art1', label: '预算.xlsx' }]
  });
  assert(worldArt.includes('kind":"artifact"'), 'world records @ artifact tokens');
  assert(worldArt.includes('art1'), 'focused artifact keeps artifactId');

  const palPages = buildMentionCandidates(
    [],
    [],
    'ideashell',
    'zh',
    [],
    [{ url: 'https://ideashell.ai/', title: '闪念贝壳', current: true }]
  );
  assert(
    palPages.some((c) => c.kind === 'page' && /ideashell/.test(c.url || '')),
    '@ palette lists current page'
  );
  const worldPage = buildWorldStateBlock({
    boundGroups: [],
    activeTab: { url: 'https://ideashell.ai/', title: '闪念贝壳', origin: 'https://ideashell.ai' },
    focusPage: { url: 'https://ideashell.ai/', title: '闪念贝壳', origin: 'https://ideashell.ai' }
  });
  assert(worldPage.includes('activeTab='), 'world injects live tab');
  assert(worldPage.includes('focusPage='), 'world injects page focus');
  assert(/focusPage/.test(system), 'system names focusPage as 这页 referent');

  const skillBlock = formatSkillsForSystemPrompt({ sessionId: sess.sessionId });
  assert(skillBlock.includes('id: html-preview'), 'catalog lists skill id');
  assert(skillBlock.includes('id: slides'), 'catalog lists slides for PPT/slides');
  assert(skillBlock.includes('id: poster'), 'catalog lists poster for 海报');
  assert(skillBlock.includes('description:'), 'catalog lists descriptions');
  assert(!skillBlock.includes('### Skill playbooks'), 'playbooks stay out of system');
  assert(!skillBlock.includes('data-pawwork-preview'), 'skill bodies stay out of system');
  assert(skillBlock.includes('view=skill'), 'catalog tells model how to load a playbook');

  const ex = beginExecution(rt.store, sess.sessionId);
  const skillFs = createSessionGuestFs(rt.store, { sessionId: sess.sessionId, executionId: ex.executionId });
  const tools = createSessionTools({
    store: rt.store,
    execution: ex,
    fs: skillFs,
    sessionId: sess.sessionId
  });
  const catalogView = await tools.inspect.execute({ view: 'skill' });
  assert(catalogView.ok && Array.isArray(catalogView.catalog), 'inspect skill without id lists catalog');
  const playbook = await tools.inspect.execute({ view: 'skill', skillId: 'html-preview' });
  assert(playbook.ok && String(playbook.playbook || '').includes('data-paw-kind="document"'), 'inspect loads playbook on demand');
  const resource = await tools.inspect.execute({
    view: 'skill',
    skillId: 'html-preview',
    path: 'templates/report.html'
  });
  assert(resource.ok && String(resource.content || '').includes('data-paw-kind="document"'), 'inspect loads skill resource on demand');
  settleExecution(rt.store, ex, 'settled');

  const apiMsgs = attachWorldToLastUser(
    [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' }
    ],
    world
  );
  assert(apiMsgs[0].content === 'first', 'older user turns stay clean');
  assert(apiMsgs[1].content === 'ok', 'assistant not used as world carrier');
  assert(String(apiMsgs[2].content).includes('artifactCount=50'), 'world spliced onto latest user');

  const wire = buildWireFromTurn({
    thought: 'plan inspect',
    toolCalls: [
      { toolName: 'inspect', args: { view: 'groups' }, toolCallId: 'c1', result: { ok: true } }
    ],
    finalText: 'done'
  });
  assert(
    wire.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'tool-call')),
    'wire keeps tool-call'
  );
  assert(
    wire.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'tool-result')),
    'wire keeps tool-result'
  );
  assert(
    wire.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'reasoning')),
    'wire keeps reasoning for OpenRouter replay'
  );
  const replayed = replayWireMessages([
    { role: 'user', content: 'look' },
    { role: 'assistant', content: 'done', thought: 'plan inspect', wire }
  ]);
  assert(replayed[0].role === 'user' && replayed[0].content === 'look', 'replay user is projection-clean');
  assert(replayed.some((m) => m.role === 'tool'), 'replay emits tool results to the API');

  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'write report',
    callModel: callModelWriteArtifact('note.md', 'v1')
  });
  let secondSystem = '';
  let secondLastUser = '';
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'what next',
    callModel: async ({ system: sys, messages }) => {
      secondSystem = String(sys || '');
      const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
      secondLastUser = String(lastUser?.content || '');
      return { text: 'next is fine', toolCalls: [] };
    }
  });
  assert(!secondSystem.includes('artifactCount='), 'live system prefix still has no world');
  assert(secondLastUser.includes('artifactCount='), 'live API last user carries world suffix');
  assert(secondLastUser.includes('what next'), 'live API last user still has the real prompt');

  const stored = rt.getSession(sess.sessionId);
  const storedUsers = (stored.messages || []).filter((m) => m.role === 'user');
  assert(
    storedUsers.every((m) => !String(m.content || '').includes('[Session world')),
    'world suffix is not persisted as chat'
  );
  const firstAssistant = (stored.messages || []).find((m) => m.role === 'assistant');
  assert(Array.isArray(firstAssistant?.wire) && firstAssistant.wire.length, 'assistant persists wire');
  assert(typeof firstAssistant.content === 'string', 'UI content is final text');
  assert(
    !JSON.stringify(firstAssistant.content).includes('type":"tool-call"'),
    'UI content is not the tool wire'
  );
  assert(
    !String(firstAssistant.thought || '').includes('→ '),
    'UI thought is model reasoning, not tool chrome'
  );
  assert(
    JSON.stringify(firstAssistant.wire).includes('tool-call'),
    'wire still carries tool-call for the API'
  );

  const mixed = {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'hidden chain' },
      { type: 'text', text: 'hello' }
    ],
    reasoning: 'hidden chain',
    reasoning_details: [{ type: 'reasoning.text', text: 'hidden chain' }]
  };
  const stripped = sanitizeOpenAiMessage(mixed, { keepReasoning: false });
  assert(stripped.reasoning == null, 'non-OpenRouter host strips reasoning field');
  assert(stripped.reasoning_details == null, 'non-OpenRouter host strips reasoning_details');
  assert(
    Array.isArray(stripped.content) && stripped.content.every((p) => p.type !== 'reasoning'),
    'non-OpenRouter host strips reasoning parts'
  );
  const kept = sanitizeOpenAiMessage(mixed, { keepReasoning: true });
  assert(kept.reasoning === 'hidden chain', 'OpenRouter keeps reasoning string');
  assert(Array.isArray(kept.reasoning_details), 'OpenRouter keeps reasoning_details');
  assert(
    Array.isArray(kept.content) && kept.content.some((p) => p.type === 'reasoning'),
    'OpenRouter keeps reasoning content parts'
  );

  const orInit = stripUnsupportedFieldsFromRequestInit(
    { body: JSON.stringify({ model: 'x', messages: [mixed] }) },
    { enabled: true, effort: 'low' },
    { keepReasoning: true }
  );
  const orBody = JSON.parse(orInit.body);
  assert(orBody.reasoning?.effort === 'low', 'OpenRouter request injects reasoning.effort');
  assert(orBody.messages[0].reasoning === 'hidden chain', 'OpenRouter outbound keeps reasoning');

  const groqInit = stripUnsupportedFieldsFromRequestInit(
    { body: JSON.stringify({ model: 'x', messages: [mixed] }) },
    { enabled: true, effort: 'low' },
    { keepReasoning: false }
  );
  const groqBody = JSON.parse(groqInit.body);
  assert(groqBody.messages[0].reasoning == null, 'non-OpenRouter outbound drops reasoning');

  const inspectPngB64 = Buffer.alloc(48, 0x41).toString('base64');
  const toolWithFile = {
    role: 'tool',
    tool_call_id: 'call_img',
    content: JSON.stringify([
      { type: 'text', text: 'Image item wi_1 (image/png, 4 bytes)' },
      {
        type: 'file',
        data: { type: 'data', data: inspectPngB64 },
        mediaType: 'image/png'
      }
    ])
  };
  const liftedImgs = liftToolResultImages([
    { role: 'user', content: '这几张图都是什么' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call_img' }] },
    toolWithFile
  ]);
  const visionUser = liftedImgs.find(
    (m) => m.role === 'user' && Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url')
  );
  const slimTool = liftedImgs.find((m) => m.role === 'tool');
  assert(visionUser, 'inspect file parts become user image_url (not tool-text)');
  assert(
    String(slimTool?.content || '').includes('Image item wi_1') &&
      !String(slimTool?.content || '').includes(inspectPngB64),
    'tool content keeps caption and drops base64'
  );
  const visionInit = stripUnsupportedFieldsFromRequestInit({
    body: JSON.stringify({
      model: 'x',
      messages: [{ role: 'user', content: 'see' }, toolWithFile]
    })
  });
  const visionBody = JSON.parse(visionInit.body);
  assert(
    visionBody.messages.some(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.some((p) => p.type === 'image_url' && String(p.image_url?.url || '').startsWith('data:image/png'))
    ),
    'HTTPS body lifts inspect pixels to image_url'
  );

  const lifted = liftOpenRouterReasoningPayload({
    choices: [
      {
        delta: {
          reasoning_details: [{ type: 'reasoning.text', text: 'step one' }]
        }
      }
    ]
  });
  assert(lifted.choices[0].delta.reasoning === 'step one', 'OpenRouter details lift into reasoning');
  const mandatoryGears = effortLevelsForReasoning({
    supported: true,
    efforts: ['high', 'medium', 'low'],
    mandatory: true
  });
  assert(!mandatoryGears.includes('none'), 'mandatory Gemini has no 无思考 stop');
  assert(mandatoryGears.includes('low') && mandatoryGears.includes('high'), 'mandatory keeps real efforts');

  assert(isPlaceholderTaskTitle('任务 1') && isPlaceholderTaskTitle('Task 2'), 'default task names are placeholders');
  assert(isPlaceholderTaskTitle('Session') && !isPlaceholderTaskTitle('融五张海报'), 'custom names are kept');
  assert(nextTaskTitle(['任务 1', '任务 3'], 'zh') === '任务 4', 'next zh task ordinal skips gaps');
  assert(nextTaskTitle([], 'en') === 'Task 1', 'first en task is Task 1');
  assert(shrinkPromptTitle('把这五张图融成一张海报') === '把这五张图融成一张海报', 'short prompt is the title');
  const modelNamed = await generateTaskTitle({
    text: '把这五张图融成一张海报，风格偏扁平',
    model: {
      async doGenerate() {
        return { content: [{ type: 'text', text: '五图融合成海报' }] };
      }
    }
  });
  assert(modelNamed === '五图融合成海报', 'product model titles from first user prompt');
  assert(normalizeSessionTitle('  季度报告  ') === '季度报告', 'rename trims whitespace');
  assert(normalizeSessionTitle('x'.repeat(80)).length === SESSION_TITLE_MAX, 'rename caps length');

  {
    const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
    svc.ensureSession('ren-1');
    const named = await svc.renameSession({ sessionId: 'ren-1', title: '  季度报告  ' });
    assert(named.title === '季度报告' && named.titleLocked === true, 'rename persists and locks');

    let emptyErr = null;
    try {
      await svc.renameSession({ sessionId: 'ren-1', title: '   ' });
    } catch (e) {
      emptyErr = e;
    }
    assert(!!emptyErr && /empty title/.test(String(emptyErr.message || emptyErr)), 'empty rename rejected');
    const still = await svc.getSession({ sessionId: 'ren-1' });
    assert(still.title === '季度报告', 'empty rename does not clear title');

    let foreignErr = null;
    try {
      await svc.renameSession({ sessionId: 'no-such-session', title: 'Nope' });
    } catch (e) {
      foreignErr = e;
    }
    assert(
      !!foreignErr && /unknown session/.test(String(foreignErr.message || foreignErr)),
      'foreign sessionId rejected'
    );
    assert(!svc.runtime.store.has('sessions', 'no-such-session'), 'foreign rename does not create session');

    await svc.sendMessage({
      sessionId: 'ren-1',
      content: 'this would have become a generated title',
      callModel: async () => ({ text: 'ok', toolCalls: [] })
    });
    const afterSend = await svc.getSession({ sessionId: 'ren-1' });
    assert(afterSend.title === '季度报告', 'locked custom name wins over auto-title');

    const synced = await svc.renameSession({
      sessionId: 'ren-1',
      title: 'should-not-win',
      lockTitle: false
    });
    assert(
      synced.title === '季度报告' && synced.titleLocked === true,
      'unlocked write-through does not clobber a locked name'
    );

    __resetDurableMemoryBackends();
    const dbName = `rename-reopen-${Date.now()}`;
    const store1 = await createDurableSessionWorkspaceStore({ dbName });
    const svc1 = new SessionWorkspaceService({ store: store1 });
    svc1.ensureSession('ren-d');
    await svc1.renameSession({ sessionId: 'ren-d', title: '持久名称' });
    await store1.flush();
    const store2 = await createDurableSessionWorkspaceStore({ dbName });
    const svc2 = new SessionWorkspaceService({ store: store2 });
    const reopened = await svc2.getSession({ sessionId: 'ren-d' });
    assert(reopened.title === '持久名称' && reopened.titleLocked === true, 'rename survives store reopen');
    __resetDurableMemoryBackends();
  }

  assert(nextGroupName([]) === 'Group 1', 'first default group is Group 1');
  assert(nextGroupName(['Group 1', '海报']) === 'Group 2', 'default group skips taken ordinals');
  assert(nextGroupName(['Group 1', 'Group 3']) === 'Group 2', 'default group fills ordinal gaps');
  const g1 = rt.createGroup({ name: 'Group 1' });
  let dup = null;
  try {
    rt.createGroup({ name: 'group 1' });
  } catch (e) {
    dup = e;
  }
  assert(!!dup && /DUPLICATE_GROUP_NAME/.test(String(dup.message || dup)), 'host rejects duplicate group names');
  const gAuto = rt.createGroup({});
  assert(gAuto.name === 'Group 2', 'unnamed create uses next free Group N');
  let renamedDup = null;
  try {
    rt.renameGroup(gAuto.groupId, 'Group 1');
  } catch (e) {
    renamedDup = e;
  }
  assert(
    !!renamedDup && /DUPLICATE_GROUP_NAME/.test(String(renamedDup.message || renamedDup)),
    'host rejects rename onto an existing group name'
  );
  const same = rt.renameGroup(g1.groupId, 'group 1');
  assert(same.name === 'group 1', 'same group may change only letter case');

  assert(parseContextWindow({ context_length: 1_000_000 }) === 1_000_000, 'OpenRouter context_length is the window');
  assert(
    parseContextWindow({ top_provider: { context_length: 200_000 } }) === 200_000,
    'OpenRouter top_provider.context_length is the window'
  );
  assert(guessContextWindow('google/gemini-2.5-flash') === 1_000_000, 'Gemini fallback is 1M');
  assert(resolveContextWindow('x', { contextWindow: 500_000 }) === 500_000, 'catalog window wins over guess');
  assert(isVisionCapableModel('x-ai/grok-4.6') === true, 'Grok 4.6 (OpenRouter id) is multimodal');
  assert(isVisionCapableModel('x-ai/grok-4.6-fast') === true, 'Grok 4.6-fast is multimodal');
  assert(isVisionCapableModel('grok-4.6') === true, 'bare grok-4.6 is multimodal');
  assert(classifyChatVisionCapability('vendor-unknown-model') === 'unknown', 'unknown id is unknown');
  assert(isVisionCapableModel('vendor-unknown-model') === true, 'unknown id is permissive');
  assert(isKnownTextOnlyChatModel('deepseek-v4-flash') === true, 'deepseek-v4-flash is known text-only');
  assert(isVisionCapableModel('deepseek-v4-flash') === false, 'known text-only stays denied');
  assert(COMPACT_RATIO === 0.8, 'compact threshold is 80% of the model window');
  assert(contextUsageRatio(400_000, 500_000) === 0.8, '500k window compact at 400k');
  assert(contextUsageRatio(800_000, 1_000_000) === 0.8, '1M window compact at 800k');
  assert(
    shouldCompact({
      promptTokens: 4000,
      contextWindow: 4096,
      messages: [
        { role: 'user', messageId: 'u1' },
        { role: 'assistant', messageId: 'a1' },
        { role: 'user', messageId: 'u2' },
        { role: 'assistant', messageId: 'a2' },
        { role: 'user', messageId: 'u3' }
      ]
    }),
    '80% occupancy with foldable history triggers compact'
  );
  assert(
    !shouldCompact({
      promptTokens: 4000,
      contextWindow: 4096,
      messages: [
        { role: 'user', messageId: 'u1' },
        { role: 'assistant', messageId: 'a1' },
        { role: 'user', messageId: 'u2' }
      ],
      compact: { throughMessageId: 'a1' }
    }),
    'frozen compact is not rewritten until the cut moves'
  );
  assert(findCompactCutIndex([
    { role: 'user' },
    { role: 'assistant' },
    { role: 'user' },
    { role: 'assistant' },
    { role: 'user' }
  ]) === 2, 'compact keeps the last two user turns');

  const compactRt = makeRuntime();
  const compactSess = compactRt.createSession();
  const pad = '目标交付海报与表格。'.repeat(80);
  const seed = [];
  for (let i = 0; i < 5; i++) {
    seed.push({
      messageId: `cu${i}`,
      role: 'user',
      content: `${pad} turn ${i}`,
      createdAt: Date.now()
    });
    seed.push({
      messageId: `ca${i}`,
      role: 'assistant',
      content: `ack ${i} ${pad}`,
      createdAt: Date.now()
    });
  }
  compactRt.store.put('sessions', compactSess.sessionId, {
    ...compactRt.getSession(compactSess.sessionId),
    messages: seed,
    contextUsage: { promptTokens: 3800, contextWindow: 4096 }
  });
  const compactEvents = [];
  await compactRt.sendMessage({
    sessionId: compactSess.sessionId,
    content: 'continue',
    contextWindow: 4096,
    callModel: async () => ({ text: 'ok after compact' }),
    onEvent: (ev) => compactEvents.push(ev?.type)
  });
  const compacted = compactRt.getSession(compactSess.sessionId);
  assert(!!compacted.compact?.text, 'over-threshold session writes a frozen compact snapshot');
  assert(!/boundGroups=/.test(compacted.compact.text), 'compact must not emit group ids');
  assert(!/Groups \(id/.test(compacted.compact.text), 'compact must not demand Groups (id/name)');
  assert(!!compacted.compact?.throughMessageId, 'compact records the last folded message');
  assert(compactEvents.includes('compacting'), 'UI receives compacting');
  const frozen = compacted.compact.throughMessageId;
  await compactRt.sendMessage({
    sessionId: compactSess.sessionId,
    content: 'still going',
    contextWindow: 1_000_000,
    callModel: async () => ({ text: 'ok still' })
  });
  const still = compactRt.getSession(compactSess.sessionId);
  assert(
    still.compact.throughMessageId === frozen,
    'compact snapshot stays frozen while the cut has not advanced past keep-turns'
  );

  const namedSess = rt.getSession(sess.sessionId);
  assert(
    String(namedSess.title || namedSess.name || '').includes('write report'),
    'first user prompt becomes the task title when model naming is stubbed'
  );

  // Wire projection: an image inspect turn must not persist raw pixels into
  // the transcript, and the following turn must replay a valid ModelMessage[].
  const pngBytes = new Uint8Array(64 * 1024);
  pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < pngBytes.length; i++) pngBytes[i] = i % 251;
  const pngB64 = Buffer.from(pngBytes).toString('base64');
  const imgGroup = rt.createGroup({ name: 'wire-images' });
  const imgItem = rt.addWebItem(imgGroup.groupId, {
    src: `data:image/png;base64,${pngB64}`,
    kindHint: 'image',
    preview: { tagName: 'img' }
  });
  rt.bindGroups(sess.sessionId, [imgGroup.groupId]);
  let inspectStep = 0;
  await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'describe the selected image',
    callModel: async () => {
      inspectStep++;
      if (inspectStep === 1) {
        return {
          toolCalls: [
            {
              id: 'wire-c1',
              function: {
                name: 'inspect',
                arguments: JSON.stringify({ view: 'item', itemId: imgItem.webItemId })
              }
            }
          ]
        };
      }
      return { text: 'a small png' };
    }
  });
  const wireSess = rt.getSession(sess.sessionId);
  const imgAssistant = [...(wireSess.messages || [])]
    .reverse()
    .find((m) => m.role === 'assistant');
  const wireJson = JSON.stringify(imgAssistant?.wire || []);
  const storedToolCallsJson = JSON.stringify(imgAssistant?.toolCalls || []);
  assert(wireJson.includes('tool-result'), 'image turn wire still records tool-result');
  const imgPath = imgAssistant?.path || [];
  assert(
    imgPath.some((p) => p?.type === 'tool-call' && (p.tool === 'inspect' || p.name === 'inspect')),
    'assistant.path records inspect as tool-call'
  );
  const imgTraj = serializeBehaviorTrajectory({ session: wireSess });
  assert(imgTraj.kind === 'audit', 'export kind is audit');
  assert(Array.isArray(imgTraj.messages) && imgTraj.messages.length >= 2, 'export includes chat bubbles');
  assert(
    imgTraj.messages.some((m) => m.role === 'user' && /describe the selected image/.test(String(m.content || ''))),
    'export keeps the user bubble'
  );
  assert(
    imgTraj.messages.some((m) => m.role === 'assistant' && /small png/.test(String(m.content || ''))),
    'export keeps the assistant reply bubble'
  );
  const inspectTurn = (imgTraj.turns || []).find((t) =>
    (t.events || []).some((p) => p?.type === 'tool-call' && p.tool === 'inspect')
  );
  assert(!!inspectTurn, 'audit export includes the inspect tool-call');
  assert(inspectTurn.user == null && inspectTurn.final == null, 'turns do not clone bubble strings');
  assert(Array.isArray(inspectTurn.events), 'turn.events is the causal log');
  const ev = inspectTurn.events;
  const callAt = ev.findIndex((p) => p.type === 'tool-call' && p.tool === 'inspect');
  const resultAt = ev.findIndex((p) => p.type === 'tool-result' && p.tool === 'inspect');
  assert(callAt >= 0 && resultAt > callAt, 'tool-result occurs after tool-call');
  const hostBetween = ev.slice(callAt + 1, resultAt).some((p) => p.type === 'host' && p.name === 'pixels');
  if (ev.some((p) => p.type === 'host' && p.name === 'pixels')) {
    assert(hostBetween, 'pixels host work sits between inspect call and result');
  }
  assert(
    !JSON.stringify(ev.map((p) => p.finishReason).filter(Boolean)).includes('[object Object]'),
    'finishReason is not String(object)'
  );
  assert(
    inspectTurn.model?.id === 'callModel-adapter' ||
      ev.some((p) => p?.type === 'model' && p.model === 'callModel-adapter'),
    'export records which model was called'
  );
  assert(inspectTurn.latencyMs != null, 'turn records latency');
  assert(inspectTurn.usage && typeof inspectTurn.usage === 'object', 'turn records usage');
  assert(inspectTurn.usage.source, 'usage names api|estimate|none');
  assert(
    ev.some((p) => p.type === 'tool-call' && p.tool === 'inspect' && p.args?.view === 'item'),
    'exported inspect keeps view=item args'
  );
  assert(Array.isArray(inspectTurn.wire) && inspectTurn.wire.length, 'turn has projected wire appendix');
  const fromWireOnly = serializeBehaviorTrajectory({
    session: {
      ...wireSess,
      messages: (wireSess.messages || []).map((m) => {
        if (!m || m.role !== 'assistant') return m;
        const copy = { ...m };
        delete copy.path;
        delete copy.toolCalls;
        return copy;
      })
    }
  });
  assert(
    (fromWireOnly.turns || []).some((t) =>
      (t.events || []).some((p) => p?.type === 'tool-call' && p.tool === 'inspect')
    ),
    'export reconstructs inspect from stored wire when path is missing'
  );
  const mispaired = serializeBehaviorTrajectory({
    session: {
      sessionId: 'pair',
      messages: [
        { role: 'user', content: 'compose', messageId: 'u1', createdAt: Date.now() },
        {
          role: 'assistant',
          content: 'done',
          messageId: 'a1',
          createdAt: Date.now(),
          toolCalls: [
            {
              toolName: 'inspect',
              toolCallId: 'call_skill',
              args: { view: 'skill' },
              result: { ok: true, view: 'skill' }
            },
            {
              toolName: 'inspect',
              toolCallId: 'call_group',
              args: { view: 'group', groupId: 'g1' },
              result: { ok: true, view: 'skill' }
            }
          ],
          wire: [
            {
              role: 'assistant',
              content: [
                { type: 'tool-call', toolCallId: 'call_skill', toolName: 'inspect', input: { view: 'skill' } },
                { type: 'tool-call', toolCallId: 'call_group', toolName: 'inspect', input: { view: 'group', groupId: 'g1' } }
              ]
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_skill',
                  toolName: 'inspect',
                  output: { type: 'json', value: { ok: true, view: 'skill' } }
                }
              ]
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_group',
                  toolName: 'inspect',
                  output: { type: 'json', value: { ok: true, view: 'group', total: 3 } }
                }
              ]
            }
          ]
        }
      ]
    }
  });
  const groupResult = (mispaired.turns[0].events || []).find(
    (p) => p.type === 'tool-result' && p.toolCallId === 'call_group'
  );
  assert(groupResult?.result?.view === 'group', 'export prefers wire pairing over same-name toolCalls');
  assert(groupResult?.result?.total === 3, 'group inspect result is not the skill playbook');
  assert(wireJson.length < 40000, `persisted wire is bounded (got ${wireJson.length})`);
  assert(
    storedToolCallsJson.length < 40000,
    `persisted toolCalls are bounded (got ${storedToolCallsJson.length})`
  );
  assert(!wireJson.includes(pngB64.slice(0, 80)), 'raw base64 pixels never persist in wire');
  let followUpMessages = null;
  const followUp = await rt.sendMessage({
    sessionId: sess.sessionId,
    content: 'now summarize it in one line',
    callModel: async ({ messages }) => {
      followUpMessages = messages;
      return { text: 'one line' };
    }
  });
  assert(followUp.finalText === 'one line', 'turn after image inspect replays without schema failure');
  const followUpJson = JSON.stringify(followUpMessages || []);
  assert(followUpJson.length < 60000, `replayed context is bounded (got ${followUpJson.length})`);
  assert(!followUpJson.includes(pngB64.slice(0, 80)), 'replay does not re-send raw pixels');

  // Legacy sessions persisted with raw outputs must self-heal on replay.
  const legacyWire = [
    {
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'legacy1', toolName: 'inspect', input: { view: 'item' } }
      ]
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'legacy1',
          toolName: 'inspect',
          output: {
            type: 'json',
            value: {
              ok: true,
              imageBase64: pngB64,
              modelParts: [{ type: 'image', image: pngBytes, mediaType: 'image/png' }]
            }
          }
        }
      ]
    }
  ];
  const healed = replayWireMessages([
    { role: 'user', content: 'legacy' },
    { role: 'assistant', content: 'done', wire: legacyWire }
  ]);
  const healedJson = JSON.stringify(healed);
  assert(!healedJson.includes(pngB64.slice(0, 80)), 'legacy raw wire is re-projected on replay');
  assert(healedJson.length < 20000, `legacy replay bounded (got ${healedJson.length})`);

  let boom = null;
  try {
    await rt.sendMessage({
      sessionId: sess.sessionId,
      content: 'this should fail for audit',
      callModel: async () => {
        throw new Error('boom-audit');
      }
    });
  } catch (e) {
    boom = e;
  }
  assert(boom && /boom-audit/.test(String(boom.message || boom)), 'sendMessage still throws');
  const afterFail = rt.getSession(sess.sessionId);
  const failDoc = serializeBehaviorTrajectory({ session: afterFail });
  const failedTurn = (failDoc.turns || []).find((t) => t.status === 'failed');
  assert(!!failedTurn, 'failed turn is persisted in the audit export');
  assert(
    /boom-audit/.test(String(failedTurn.error?.message || '')),
    'failed turn carries the error message'
  );

  const aliasDoc = serializeBehaviorTrajectory({
    session: {
      sessionId: 'alias',
      messages: [
        { role: 'user', content: 'hi', messageId: 'u-alias', createdAt: Date.now() },
        {
          role: 'assistant',
          content: 'ok',
          messageId: 'a-alias',
          createdAt: Date.now(),
          model: { id: '~google/gemini-flash-latest', provider: 'OpenRouter.chat' },
          path: [
            {
              type: 'model',
              name: 'llm',
              model: 'google/gemini-3.7-flash',
              finishReason: 'stop'
            }
          ]
        }
      ]
    }
  });
  const aliasJson = JSON.stringify(aliasDoc);
  assert(!aliasJson.includes('~google/gemini-flash-latest'), 'export drops the picker alias');
  assert(!aliasJson.includes('OpenRouter.chat'), 'export drops the SDK provider nickname');
  assert(aliasDoc.turns[0].model?.id === 'google/gemini-3.7-flash', 'turn.model is the routed id');
  const aliasBubble = (aliasDoc.messages || []).find((m) => m.role === 'assistant');
  assert(aliasBubble?.model?.id === 'google/gemini-3.7-flash', 'bubble model is the routed id');
  assert(aliasBubble?.model?.provider == null, 'bubble model has no provider field');

  const timedPath = [];
  recordBehaviorEvent(timedPath, { type: 'model-start', ts: 1_000, modelId: 'm' });
  recordBehaviorEvent(timedPath, {
    type: 'tool-call',
    ts: 4_000,
    name: 'inspect',
    toolCallId: 'c1',
    args: { view: 'group' }
  });
  recordBehaviorEvent(timedPath, {
    type: 'tool-result',
    ts: 9_000,
    name: 'inspect',
    toolCallId: 'c1',
    result: { ok: true, view: 'group' }
  });
  recordBehaviorEvent(timedPath, {
    type: 'model-end',
    ts: 9_000,
    finishReason: 'tool-calls',
    performance: { stepTimeMs: 8_000, responseTimeMs: 3_000, toolExecutionMs: { c1: 5_000 } },
    usage: { promptTokens: 10, completionTokens: 4 }
  });
  const modelRow = timedPath.find((p) => p.type === 'model');
  assert(modelRow?.inferenceMs === 3_000, 'model clock is SDK responseTimeMs (inference only)');
  assert(modelRow?.latencyMs === 3_000, 'model.latencyMs is not the full step');
  assert(modelRow?.endedAt === 4_000, 'model endedAt is when it emitted the tool-call');
  const toolRow = timedPath.find((p) => p.type === 'tool-result');
  assert(toolRow?.latencyMs === 5_000, 'tool clock is toolExecutionMs');
  recordBehaviorEvent(timedPath, { type: 'model-start', ts: 9_000, modelId: 'm' });
  recordBehaviorEvent(timedPath, {
    type: 'model-end',
    ts: 11_000,
    finishReason: 'stop',
    performance: { stepTimeMs: 2_000, responseTimeMs: 2_000 },
    usage: { promptTokens: 12, completionTokens: 6 }
  });
  const split = splitTurnTiming(timedPath, 10_000);
  assert(split.inferenceMs === 5_000, `inferenceMs=${split.inferenceMs}`);
  assert(split.toolMs === 5_000, `toolMs=${split.toolMs}`);
  assert(split.totalMs === 10_000, `totalMs=${split.totalMs}`);
  const timedDoc = serializeBehaviorTrajectory({
    session: {
      sessionId: 'timed',
      messages: [
        { role: 'user', content: 'go', messageId: 'u-t', createdAt: 1_000 },
        {
          role: 'assistant',
          content: 'done',
          messageId: 'a-t',
          createdAt: 11_000,
          latencyMs: 10_000,
          path: timedPath
        }
      ]
    }
  });
  assert(timedDoc.turns[0].timing.inferenceMs === 5_000, 'turn.timing.inferenceMs');
  assert(timedDoc.turns[0].timing.toolMs === 5_000, 'turn.timing.toolMs');
  assert(timedDoc.turns[0].timing.totalMs === 10_000, 'turn.timing.totalMs');
  assert(timedDoc.summary.timing.inferenceMs === 5_000, 'summary.timing.inferenceMs');
  const legacyStep = splitTurnTiming(
    [
      { type: 'model', latencyMs: 19_224 },
      { type: 'tool-call', tool: 'acquire' },
      { type: 'tool-result', tool: 'acquire', latencyMs: 15_678 }
    ],
    28_646
  );
  assert(legacyStep.inferenceMs === 19_224 - 15_678, 'legacy stepTimeMs is split by subtracting tools');
  assert(legacyStep.toolMs === 15_678, 'legacy toolMs from tool-result');
  assert(legacyStep.totalMs === 28_646, 'legacy total stays the wall clock');

  let progress = createLiveProgressState();
  progress = applyLiveProgress(progress, {
    type: 'tool-call',
    name: 'inspect',
    args: { view: 'group', groupId: 'g1' }
  });
  assert(progress.visible && progress.label.includes('已绑定'), 'group inspect is user-facing');
  progress = applyLiveProgress(progress, {
    type: 'tool-result',
    name: 'inspect',
    result: { view: 'group', total: 4 }
  });
  assert(progress.itemTotal === 4, 'group total is remembered');
  progress = applyLiveProgress(progress, {
    type: 'tool-call',
    name: 'inspect',
    args: { view: 'item', itemId: 'wi_1' }
  });
  progress = applyLiveProgress(progress, { type: 'pixels', itemId: 'wi_1' });
  assert(/1\/4/.test(progress.label), `item progress is 1/4, got ${progress.label}`);
  progress = applyLiveProgress(progress, {
    type: 'tool-call',
    name: 'inspect',
    args: { view: 'item', itemId: 'wi_2' }
  });
  assert(/2\/4/.test(progress.label), `second item is 2/4, got ${progress.label}`);
  progress = applyLiveProgress(progress, {
    type: 'text',
    chunk: '先看绑定的两张图，再按货架构图合成。'
  });
  assert(progress.visible && progress.phase === 'commentary', 'preamble during tools stays commentary');
  assert(progress.label.includes('绑定'), `commentary labels the row, got ${progress.label}`);
  assert(!progress.answerChunk && !progress.answerFlush, 'commentary is not the final bubble');
  progress = applyLiveProgress(progress, { type: 'model-end', finishReason: 'tool-calls' });
  assert(progress.visible && progress.phase === 'commentary', 'tool-calls finish keeps commentary');
  progress = applyLiveProgress(progress, {
    type: 'tool-result',
    name: 'inspect',
    result: { ok: true, view: 'item' }
  });
  progress = applyLiveProgress(progress, {
    type: 'tool-result',
    name: 'inspect',
    result: { ok: true, view: 'item' }
  });
  progress = applyLiveProgress(progress, { type: 'model-start' });
  progress = applyLiveProgress(progress, { type: 'text', chunk: '已经按货架合成好了。' });
  progress = applyLiveProgress(progress, { type: 'model-end', finishReason: 'stop' });
  assert(progress.visible === false && progress.phase === 'final', 'stop with no pending tools is final');
  assert(String(progress.answerFlush || '').includes('合成'), 'final step text is the answer, not the preamble');

  let pre = createLiveProgressState();
  pre = applyLiveProgress(pre, { type: 'text', chunk: '我先查看已绑定的图片。' });
  assert(pre.visible && pre.phase === 'unknown', 'short text before tools is speculative progress');
  pre = applyLiveProgress(pre, {
    type: 'tool-call',
    name: 'inspect',
    args: { view: 'item', itemId: 'wi_x' }
  });
  assert(pre.phase === 'commentary' && pre.label.includes('绑定'), 'text then tool-call is commentary, not a bubble');
  assert(!pre.answerFlush, 'preamble must not open the final bubble');

  let fin = createLiveProgressState();
  fin = applyLiveProgress(fin, { type: 'model-start' });
  fin = applyLiveProgress(fin, { type: 'text', chunk: '可以直接回答：爪爪能选中网页再交付。' });
  fin = applyLiveProgress(fin, { type: 'model-end', finishReason: 'stop' });
  assert(fin.phase === 'final' && fin.visible === false, 'stop without tools is the final answer');
  assert(String(fin.answerFlush || '').includes('爪爪'), 'final text is flushed on stop');

  const acq = applyLiveProgress(createLiveProgressState(), {
    type: 'tool-call',
    name: 'acquire',
    args: { action: 'image' }
  });
  assert(acq.visible && acq.label.includes('生成'), 'acquire image is generating');

  let fetchLamp = applyLiveProgress(createLiveProgressState(), {
    type: 'tool-call',
    name: 'acquire',
    args: { action: 'fetch', url: 'https://example.com/' }
  });
  assert(fetchLamp.visible && fetchLamp.label.includes('获取文件'), 'acquire fetch is 正在获取文件');
  fetchLamp = applyLiveProgress(fetchLamp, {
    type: 'tool-result',
    name: 'acquire',
    result: { ok: true, action: 'fetch', preview: '<html>'.repeat(2000) }
  });
  assert(fetchLamp.visible === false, 'acquire fetch lamp clears when the tool returns');

  let stuckFetch = applyLiveProgress(createLiveProgressState(), {
    type: 'tool-call',
    name: 'acquire',
    args: { action: 'fetch' }
  });
  assert(stuckFetch.visible && stuckFetch.label.includes('获取文件'), 'missed fetch result leaves 正在获取文件');
  stuckFetch = applyLiveProgress(stuckFetch, { type: 'execution-end', status: 'completed' });
  assert(
    stuckFetch.visible === false && stuckFetch.pendingTools === 0 && !stuckFetch.label,
    'execution-end clears a stuck 正在获取文件 lamp even if tool-result was lost'
  );

  const tinyPng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  const stageImg = { artifactId: 'i1', name: 'a.png', mimeType: 'image/png', bytes: tinyPng };
  assert(classifyArtifactSelection([stageImg, { ...stageImg, artifactId: 'i2' }]).mode === 'gallery');
  const mixedSeed = seedPlatesFromArtifacts([
    stageImg,
    {
      artifactId: 'csv1',
      name: 't.csv',
      mimeType: 'text/csv',
      text: 'a,b\n1,2',
      bytes: new TextEncoder().encode('a,b\n1,2')
    },
    {
      artifactId: 'html1',
      name: 'x.html',
      mimeType: 'text/html',
      text: '<html><body><p>plain</p></body></html>'
    }
  ]);
  assert(mixedSeed.mode === 'plates', 'mixed selection seeds plates');
  assert(mixedSeed.plates.some((p) => p.kind === 'image'));
  assert(mixedSeed.plates.some((p) => p.kind === 'table'));
  assert(mixedSeed.plates.some((p) => p.kind === 'html'));
  const mdOffice = parseOfficeMarkdown(
    [
      '## 周报',
      '',
      '1. 第一步',
      '2. 第二步',
      '',
      '- [ ] 待办',
      '- [x] 已做',
      '',
      '~~旧文案~~ **新文案**',
      '',
      '> 风险：预算超支',
      '',
      '| 项 | 金额 |',
      '| --- | ---: |',
      '| A | 12 |',
      '',
      '![cover](https://example.com/a.png)'
    ].join('\n')
  );
  assert(/<ol>/.test(mdOffice) && /第一步/.test(mdOffice), 'office md ordered list');
  assert(/md-task/.test(mdOffice) && /is-checked/.test(mdOffice), 'office md task list');
  assert(/<del>/.test(mdOffice), 'office md strikethrough');
  assert(/<blockquote>/.test(mdOffice), 'office md quote');
  assert(/md-table/.test(mdOffice) && /text-align:right/.test(mdOffice), 'office md table align');
  assert(/class="md-img"/.test(mdOffice), 'office md image');
  assert(!/javascript:/i.test(parseOfficeMarkdown('[x](javascript:alert(1))')), 'office md drops javascript href');

  const tsvSeed = seedPlatesFromArtifacts([
    {
      artifactId: 'tsv1',
      name: 'grid.tsv',
      mimeType: 'text/tab-separated-values',
      text: 'a\tb\n1\t2\n'
    }
  ]);
  assert(
    tsvSeed.plates[0]?.kind === 'table' && tsvSeed.plates[0].table?.[1]?.[1] === '2',
    'tsv seeds a real table'
  );

  const quotedCsv = seedPlatesFromArtifacts([
    {
      artifactId: 'q1',
      name: 'product_specifications.csv',
      mimeType: 'text/csv',
      text:
        '\uFEFF序号,产品名称,规格\n1,"Hello Pumpkin Fall Kitchen Mats (Autumn Holiday Rugs)","2 Pcs (Set of 2)"\n'
    }
  ]);
  const qTable = quotedCsv.plates.find((p) => p.kind === 'table');
  assert(qTable?.table?.[0]?.join(',') === '序号,产品名称,规格', 'csv header stays three columns');
  assert(
    qTable?.table?.[1]?.[1] === 'Hello Pumpkin Fall Kitchen Mats (Autumn Holiday Rugs)',
    'quoted comma stays inside one cell'
  );
  assert(
    /pw-table/.test(qTable.html || '') && !/\uFEFF/.test(qTable.html || ''),
    'csv preview emits a real table and drops BOM'
  );
  const pptxBytes = platesToPptxBytes(
    [
      { kind: 'html', title: 'T', html: '<h1>T</h1><p>B</p>', text: 'B' },
      { kind: 'image', title: 'P', imageBytes: tinyPng, imageMime: 'image/png' },
      { kind: 'table', title: 'C', table: [['a', 'b'], ['1', '2']] }
    ],
    { title: 'S-Q' }
  );
  const pptxCheck = validateArtifactBytes('out.pptx', pptxBytes);
  assert(pptxCheck.valid, pptxCheck.error || 'pptx bytes must be an office container');
  const mixPlates = [
    { kind: 'html', title: 'T', html: '<h1>T</h1><p>B</p>', text: 'B' },
    { kind: 'image', title: 'P', imageBytes: tinyPng, imageMime: 'image/png' },
    { kind: 'table', title: 'C', table: [['a', 'b'], ['1', '2']] }
  ];
  for (const fmt of ['html', 'markdown', 'csv', 'pptx', 'docx']) {
    const out = exportPlates(mixPlates, fmt, { title: 'S-Q' });
    assert(out.bytes?.byteLength > 10, `${fmt} export produced bytes`);
    if (fmt === 'docx') {
      const v = validateArtifactBytes('x.docx', out.bytes);
      assert(v.valid, v.error || 'docx must pass office check');
    }
  }

  assert(normalizeItemHandle('图片 1') === 'image1', '图片 1 → image1');
  assert(normalizeItemHandle('Image-1') === 'image1', 'Image-1 → image1');
  assert(normalizeItemHandle('screenshot1') === 'screenshot1', 'screenshot1 stays');
  assert(normalizeItemHandle('截图 2') === 'screenshot2', '截图 2 → screenshot2');
  assert(formatItemLabel('image', 1, 'zh') === '图片1', 'zh image label');
  assert(formatItemLabel('screenshot', 2, 'en') === 'Screenshot 2', 'en screenshot label');
  assert(itemHandle('image', 1) === 'image1', 'canonical handle');

  const labelRt = makeRuntime();
  const labelSess = labelRt.createSession();
  const labelG = labelRt.createGroup({ name: 'sticky-labels' });
  const imgA = labelRt.addWebItem(labelG.groupId, {
    src: 'https://cdn.example/a8f3c2d1.webp',
    kindHint: 'image'
  });
  const imgB = labelRt.addWebItem(labelG.groupId, {
    src: 'https://cdn.example/zzzz.png',
    kindHint: 'image'
  });
  const shot = labelRt.addWebItem(labelG.groupId, {
    src: 'data:image/png;base64,aa',
    kindHint: 'screenshot'
  });
  const txt = labelRt.addWebItem(labelG.groupId, { text: 'hello world', kindHint: 'text' });
  ensureItemLabel(labelRt.store, imgA);
  ensureItemLabel(labelRt.store, imgB);
  ensureItemLabel(labelRt.store, shot);
  ensureItemLabel(labelRt.store, txt);
  const aN = labelRt.store.get('items', imgA.webItemId).labelN;
  const bN = labelRt.store.get('items', imgB.webItemId).labelN;
  assert(aN === 1 && bN === 2, 'images get sticky 1 then 2');
  assert(labelRt.store.get('items', shot.webItemId).labelKind === 'screenshot', 'screenshot kind stays separate');
  assert(labelRt.store.get('items', shot.webItemId).labelN === 1, 'first screenshot is 1');
  labelRt.removeWebItem(labelG.groupId, imgA.webItemId);
  const imgC = labelRt.addWebItem(labelG.groupId, {
    src: 'https://cdn.example/new.png',
    kindHint: 'image'
  });
  ensureItemLabel(labelRt.store, imgC);
  assert(labelRt.store.get('items', imgC.webItemId).labelN === 3, 'deleted image 1 does not reuse 1');
  labelRt.bindGroups(labelSess.sessionId, [labelG.groupId]);
  const idx = listBoundItemIndex(labelRt.store, labelSess.sessionId);
  assert(idx.some((it) => it.handle === 'image2'), 'world index has image2');
  assert(idx.some((it) => it.handle === 'screenshot1'), 'world index has screenshot1');
  assert(
    resolveBoundItemRef(labelRt.store, labelSess.sessionId, 'image2') === imgB.webItemId,
    'image2 resolves to the original second image'
  );
  assert(
    resolveBoundItemRef(labelRt.store, labelSess.sessionId, '截图1') === shot.webItemId,
    '截图1 resolves to the screenshot'
  );
  const labelEx = beginExecution(labelRt.store, labelSess.sessionId);
  const labelTools = createSessionTools({
    store: labelRt.store,
    execution: labelEx,
    fs: createSessionGuestFs(labelRt.store, {
      sessionId: labelSess.sessionId,
      executionId: labelEx.executionId
    }),
    sessionId: labelSess.sessionId
  });
  const byHandle = await labelTools.inspect.execute({ view: 'item', itemId: 'image2' });
  assert(byHandle.ok && byHandle.item?.webItemId === imgB.webItemId, 'inspect accepts image2 handle');
  assert(byHandle.item?.handle === 'image2', 'inspect item echoes handle');
  settleExecution(labelRt.store, labelEx, 'settled');
  const imgD = labelRt.addWebItem(labelG.groupId, { src: 'https://cdn.example/d.png', kindHint: 'image' });
  ensureItemLabel(labelRt.store, imgD);
  assert(labelRt.store.get('items', imgD.webItemId).labelN === 4, 'next image is 4 while 2 and 3 remain');
  labelRt.removeWebItem(labelG.groupId, imgB.webItemId);
  labelRt.removeWebItem(labelG.groupId, imgC.webItemId);
  labelRt.removeWebItem(labelG.groupId, imgD.webItemId);
  const imgE = labelRt.addWebItem(labelG.groupId, { src: 'https://cdn.example/e.png', kindHint: 'image' });
  ensureItemLabel(labelRt.store, imgE);
  assert(labelRt.store.get('items', imgE.webItemId).labelN === 1, 'all images gone → next is 图片1');
  assert(allocateLabelN(labelRt.store, 'screenshot', labelG.groupId) === 2, 'screenshot 1 still live, next is 2');
  labelRt.removeWebItem(labelG.groupId, shot.webItemId);
  assert(allocateLabelN(labelRt.store, 'screenshot', labelG.groupId) === 1, 'all screenshots gone → next is 截图1');

  const labelSessB = labelRt.createSession();
  const labelG2 = labelRt.createGroup({ name: 'sticky-labels-2' });
  for (let i = 0; i < 4; i += 1) {
    const it = labelRt.addWebItem(labelG.groupId, {
      src: `https://cdn.example/g1-${i}.png`,
      kindHint: 'image'
    });
    ensureItemLabel(labelRt.store, it, { groupId: labelG.groupId });
  }
  const stickyImgE = labelRt.store.get('items', imgE.webItemId);
  assert(stickyImgE.labelN === 1, 'existing 图片1 stays sticky after later adds');
  const g1Max = allocateLabelN(labelRt.store, 'image', labelG.groupId);
  assert(g1Max === 6, `group 1 next image is 6 after 图片1+4 more, got ${g1Max}`);

  const freshImg = labelRt.addWebItem(labelG2.groupId, {
    src: 'https://cdn.example/g2-fresh.png',
    kindHint: 'image'
  });
  ensureItemLabel(labelRt.store, freshImg, { groupId: labelG2.groupId });
  assert(labelRt.store.get('items', freshImg.webItemId).labelN === 1, 'new group starts at 图片1');
  const freshShot = labelRt.addWebItem(labelG2.groupId, {
    src: 'data:image/png;base64,bb',
    kindHint: 'screenshot'
  });
  ensureItemLabel(labelRt.store, freshShot, { groupId: labelG2.groupId });
  assert(labelRt.store.get('items', freshShot.webItemId).labelN === 1, 'new group screenshot starts at 截图1');
  const g2Img2 = labelRt.addWebItem(labelG2.groupId, {
    src: 'https://cdn.example/g2-b.png',
    kindHint: 'image'
  });
  ensureItemLabel(labelRt.store, g2Img2, { groupId: labelG2.groupId });
  assert(labelRt.store.get('items', g2Img2.webItemId).labelN === 2, 'second image in new group is 图片2');
  assert(
    labelRt.store.get('items', imgE.webItemId).labelN === 1,
    'group 1 图片1 unchanged while group 2 counts on its own'
  );
  assert(allocateLabelN(labelRt.store, 'image', labelG.groupId) === 6, 'group 1 counter ignores group 2');
  assert(allocateLabelN(labelRt.store, 'image', labelG2.groupId) === 3, 'group 2 counter ignores group 1');

  labelRt.bindGroups(labelSess.sessionId, [labelG.groupId]);
  labelRt.bindGroups(labelSessB.sessionId, [labelG2.groupId]);
  const idxA = listBoundItemIndex(labelRt.store, labelSess.sessionId);
  const idxB = listBoundItemIndex(labelRt.store, labelSessB.sessionId);
  assert(idxA.some((it) => it.handle === 'image1' && it.id === imgE.webItemId), 'session A still sees group 1 图片1');
  assert(idxB.some((it) => it.handle === 'image1' && it.id === freshImg.webItemId), 'session B sees group 2 图片1');
  assert(
    allocateLabelN(labelRt.store, 'image', labelG.groupId) === 6,
    'binding / session switch does not advance the other group'
  );

  const clipA = labelRt.ensureClipboardGroup(labelSess.sessionId);
  const clipB = labelRt.ensureClipboardGroup(labelSessB.sessionId);
  const pinA = labelRt.addWebItem(clipA.groupId, { text: 'clip-a', kindHint: 'text' });
  ensureItemLabel(labelRt.store, pinA, { groupId: clipA.groupId });
  const pinB = labelRt.addWebItem(clipB.groupId, { text: 'clip-b', kindHint: 'text' });
  ensureItemLabel(labelRt.store, pinB, { groupId: clipB.groupId });
  assert(labelRt.store.get('items', pinA.webItemId).labelN === 1, 'clipboard A starts at 文字1');
  assert(labelRt.store.get('items', pinB.webItemId).labelN === 1, 'clipboard B starts at 文字1 independently');

  const svcLabels = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svcLabels.ensureSession('s1');
  await svcLabels.createGroup({ name: 'Old picks', sessionId: 's1' });
  await svcLabels.syncTabSelection({
    sessionId: 's1',
    tabId: 9,
    url: 'https://example.com/picks',
    elements: [1, 2, 3, 4].map((n) => ({
      src: `https://cdn.example/old-${n}.png`,
      kind: 'image',
      tag: 'IMG',
      selector: `img.old-${n}`
    }))
  });
  await svcLabels.createGroup({ name: 'New picks', sessionId: 's1' });
  const afterNew = await svcLabels.syncTabSelection({
    sessionId: 's1',
    tabId: 9,
    url: 'https://example.com/picks',
    elements: [
      { src: 'https://cdn.example/new-1.png', kind: 'image', tag: 'IMG', selector: 'img.new-1' }
    ]
  });
  const oldGroup = afterNew.groups.find((g) => g.name === 'Old picks');
  const newGroup = afterNew.groups.find((g) => g.name === 'New picks');
  assert(oldGroup?.items?.every((it) => it.labelKind === 'image'), 'old group items stay images');
  assert(
    oldGroup?.items?.map((it) => it.labelN).join(',') === '1,2,3,4',
    `old group sticky 图片1–4, got ${oldGroup?.items?.map((it) => it.labelN)}`
  );
  assert(newGroup?.items?.[0]?.labelN === 1, 'product path: new group first image is 图片1');
  assert(newGroup?.items?.[0]?.handle === 'image1', 'product path: new group handle is image1');

  const allocOld = await svcLabels.allocateLabel({
    sessionId: 's1',
    kind: 'image',
    groupId: oldGroup.groupId
  });
  const allocNew = await svcLabels.allocateLabel({ sessionId: 's1', kind: 'image' });
  assert(allocOld.n === 5, `allocateLabel on old group is 5, got ${allocOld.n}`);
  assert(allocNew.n === 2, `allocateLabel on active new group is 2, got ${allocNew.n}`);

  await svcLabels.clearCaptureSelection({ sessionId: 's1' });
  const afterClear = await svcLabels.syncTabSelection({
    sessionId: 's1',
    tabId: 9,
    url: 'https://example.com/picks',
    elements: [
      { src: 'https://cdn.example/after-clear.png', kind: 'image', tag: 'IMG', selector: 'img.after-clear' }
    ]
  });
  const clearedGroup = afterClear.groups.find((g) => g.name === 'New picks');
  const stillOld = afterClear.groups.find((g) => g.name === 'Old picks');
  assert(clearedGroup?.items?.[0]?.labelN === 1, '清空选中 resets that group so next image is 图片1');
  assert(
    stillOld?.items?.map((it) => it.labelN).join(',') === '1,2,3,4',
    '清空选中 does not renumber or reset another group'
  );

  svcLabels.ensureSession('s2');
  const s2State = await svcLabels.getWorkspaceState({ sessionId: 's2' });
  assert(s2State.activeGroupId === clearedGroup.groupId, 'session switch keeps ambient active group');
  const allocAfterSwitch = await svcLabels.allocateLabel({ sessionId: 's2', kind: 'image' });
  assert(allocAfterSwitch.n === 2, 'session switch does not invent a new counter');
  const s1Again = await svcLabels.allocateLabel({
    sessionId: 's1',
    kind: 'image',
    groupId: stillOld.groupId
  });
  assert(s1Again.n === 5, 'other session allocate against old group stays at 5');

  const pastePng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  const pasteDataUrl = 'data:image/png;base64,' + Buffer.from(pastePng).toString('base64');
  const pasteSvc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  pasteSvc.ensureSession('paste-s');
  await pasteSvc.sendMessage({
    sessionId: 'paste-s',
    content: 'look at paste',
    role: 'user',
    attachments: [
      {
        name: '截图1',
        isImage: true,
        dataUrl: pasteDataUrl,
        type: 'image/png',
        source: 'paste',
        labelKind: 'screenshot',
        labelN: 1
      }
    ],
    callModel: async () => ({ text: 'seen', toolCalls: [] })
  });
  const pasteState = await pasteSvc.getWorkspaceState({ sessionId: 'paste-s' });
  assert((pasteState.artifacts || []).length === 0, 'pasted image is not a shelf artifact');
  assert((pasteState.artifactCount || 0) === 0, 'artifactCount stays 0 after paste attach');
  let pasteItem = null;
  for (const g of pasteState.groups || []) {
    for (const it of g.items || []) {
      if (it.labelKind === 'screenshot' && it.labelN === 1) pasteItem = it;
    }
  }
  assert(!!pasteItem, 'pasted image becomes a 截图1 capture-chip item');
  assert(pasteItem.handle === 'screenshot1', 'paste handle is screenshot1');
  const pasteResolved = resolveBoundItemRef(pasteSvc.runtime.store, 'paste-s', '截图1');
  assert(pasteResolved === pasteItem.webItemId, '截图1 stays resolvable during the session');
  const pasteEx = beginExecution(pasteSvc.runtime.store, 'paste-s');
  const pasteFs = createSessionGuestFs(pasteSvc.runtime.store, {
    sessionId: 'paste-s',
    executionId: pasteEx.executionId
  });
  const pasteTools = createSessionTools({
    store: pasteSvc.runtime.store,
    execution: pasteEx,
    fs: pasteFs,
    sessionId: 'paste-s'
  });
  const pasteInspect = await pasteTools.inspect.execute({
    view: 'item',
    itemId: pasteItem.webItemId,
    includeMedia: true
  });
  settleExecution(pasteSvc.runtime.store, pasteEx, 'settled');
  assert(
    pasteInspect.ok &&
      ((pasteInspect.item?.imageBase64 && pasteInspect.item.imageBase64.length > 20) ||
        (pasteInspect.modelParts || []).some((p) => p.type === 'image')),
    'message wire / inspect contains the pasted image part'
  );
  await pasteSvc.clearClipboard({ sessionId: 'paste-s' });
  const afterPasteClear = await pasteSvc.getWorkspaceState({ sessionId: 'paste-s' });
  const pasteClip = afterPasteClear.groups.find((g) => g.kind === 'clipboard');
  assert((pasteClip?.itemCount || 0) === 0, 'clipboard clear empties the clipboard group');
  assert((afterPasteClear.artifacts || []).length === 0, 'clipboard clear does not invent artifacts');

  assert(formatItemLabel('page', 1, 'zh') === '页面1', 'zh page label');
  assert(formatItemLabel('page', 2, 'en') === 'Page 2', 'en page label');
  assert(itemHandle('page', 1) === 'page1', 'page handle');
  assert(normalizeItemHandle('页面 2') === 'page2', '页面 2 → page2');
  assert(normalizeItemHandle('page1') === 'page1', 'page1 stays');
  assert(parseHttpUrls('see https://a.example/x and http://b.example/y, plus https://a.example/x').length === 2, 'parse unique http(s)');
  assert(normalizePageUrl('https://A.Example/foo/') === 'https://a.example/foo', 'normalize host+slash');

  const pageRt = makeRuntime();
  const pageSess = pageRt.createSession();
  const pageG = pageRt.createGroup({ name: 'pages' });
  const imgKeep = pageRt.addWebItem(pageG.groupId, { src: 'https://cdn.example/p.png', kindHint: 'image' });
  ensureItemLabel(pageRt.store, imgKeep, { groupId: pageG.groupId });
  const firstPages = addPageItems(pageRt.store, pageG.groupId, 'https://news.example/a https://news.example/b', {
    addedBy: 'paste'
  });
  assert(firstPages.addedCount === 2, 'paste adds two page items');
  assert(pageRt.store.get('items', firstPages.added[0].webItemId).labelN === 1, 'first page is 页面1');
  assert(pageRt.store.get('items', firstPages.added[1].webItemId).labelN === 2, 'second page is 页面2');
  assert(pageRt.store.get('items', imgKeep.webItemId).labelN === 1, '页面 counts independent of 图片');
  const pageDup = addPageItems(pageRt.store, pageG.groupId, 'https://news.example/a', { addedBy: 'paste' });
  assert(pageDup.addedCount === 0 && pageDup.duplicates === 1, 'identical URL dedupes');
  assert(pageDup.focusedId === firstPages.added[0].webItemId, 'dedupe focuses existing chip');
  pageRt.removeWebItem(pageG.groupId, firstPages.added[1].webItemId);
  const third = addPageItems(pageRt.store, pageG.groupId, { url: 'https://news.example/c', title: 'C', addedBy: 'page-click' });
  assert(pageRt.store.get('items', firstPages.added[0].webItemId).labelN === 1, 'existing 页面1 stays sticky after delete');
  assert(pageRt.store.get('items', third.added[0].webItemId).labelN === 2, 'gap after 页面2 delete → next is 页面2');
  pageRt.removeWebItem(pageG.groupId, firstPages.added[0].webItemId);
  pageRt.removeWebItem(pageG.groupId, third.added[0].webItemId);
  const resetPage = addPageItems(pageRt.store, pageG.groupId, 'https://news.example/fresh');
  assert(pageRt.store.get('items', resetPage.added[0].webItemId).labelN === 1, 'all pages gone → next is 页面1');

  const pageSvc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  pageSvc.ensureSession('ps-a');
  await pageSvc.createGroup({ name: 'URL pack', sessionId: 'ps-a' });
  const pasted = await pageSvc.addPageItems({
    sessionId: 'ps-a',
    text: 'go https://one.example/1 https://two.example/2 https://one.example/1',
    addedBy: 'paste'
  });
  assert(pasted.pageAdd.addedCount === 2 && pasted.pageAdd.duplicates === 1, 'RPC paste parse + dedupe');
  assert(/已添加 2/.test(formatPageAddSummary(pasted.pageAdd)), 'summary reports added count');
  const many = Array.from({ length: PAGE_ITEM_CAP + 5 }, (_, i) => `https://cap.example/${i}`);
  const capped = await pageSvc.addPageItems({ sessionId: 'ps-a', pages: many.map((url) => ({ url })), addedBy: 'paste' });
  assert(capped.pageAdd.pageCount === PAGE_ITEM_CAP, 'cap ~30 URL items');
  assert(capped.pageAdd.capped > 0 && capped.pageAdd.notice, 'quiet cap notice');
  const gid = capped.activeGroupId;
  const keepId = (capped.groups.find((g) => g.groupId === gid)?.items || []).find((it) => it.labelKind === 'page')
    ?.webItemId;
  await pageSvc.removeGroupItem({ sessionId: 'ps-a', groupId: gid, webItemId: keepId });
  const afterRm = await pageSvc.getWorkspaceState({ sessionId: 'ps-a' });
  assert(
    !(afterRm.groups.find((g) => g.groupId === gid)?.items || []).some((it) => it.webItemId === keepId),
    'remove page item'
  );
  pageSvc.ensureSession('ps-b');
  await pageSvc.createGroup({ name: 'B pages', sessionId: 'ps-b' });
  const other = await pageSvc.addPageItems({
    sessionId: 'ps-b',
    text: 'https://other-session.example/',
    addedBy: 'paste'
  });
  assert(other.activeGroupId && other.activeGroupId !== gid, 'session B writes a different capture group');
  const aAgain = await pageSvc.getWorkspaceState({ sessionId: 'ps-a' });
  assert(
    !(aAgain.groups.find((g) => g.groupId === gid)?.items || []).some((it) =>
      String(it.url || '').includes('other-session')
    ),
    'session isolation: B urls stay off A group'
  );
  assert(
    (other.groups.find((g) => g.groupId === other.activeGroupId)?.items || []).some((it) =>
      String(it.url || '').includes('other-session')
    ),
    'session B group received its URL'
  );
  await pageSvc.setActiveGroup({ sessionId: 'ps-a', groupId: gid });
  await pageSvc.clearCaptureSelection({ sessionId: 'ps-a' });
  const clearedPages = await pageSvc.getWorkspaceState({ sessionId: 'ps-a' });
  assert(
    (clearedPages.groups.find((g) => g.groupId === gid)?.items || []).filter((it) => it.labelKind === 'page')
      .length === 0,
    '清空选中 drops page items'
  );

  const aliasRt = makeRuntime();
  const aliasSess = aliasRt.createSession();
  const aliasG = aliasRt.createGroup({ name: 'alias-pages' });
  const addedAlias = addPageItems(aliasRt.store, aliasG.groupId, {
    url: 'https://spa.example/dash?x=1',
    title: 'Dash'
  });
  aliasRt.bindGroups(aliasSess.sessionId, [aliasG.groupId]);
  const pageItem = addedAlias.added[0];
  assert(
    resolveBoundItemRef(aliasRt.store, aliasSess.sessionId, '页面1') === pageItem.webItemId,
    '页面1 resolves'
  );
  assert(resolvePageUrlAlias(aliasRt.store, aliasSess.sessionId, '页面1').url.includes('spa.example'), 'alias → URL');
  assert(resolvePageUrlAlias(aliasRt.store, aliasSess.sessionId, pageItem.webItemId).url.includes('spa.example'), 'wi_ → URL');

  const aliasEx = beginExecution(aliasRt.store, aliasSess.sessionId);
  const aliasFs = createSessionGuestFs(aliasRt.store, {
    sessionId: aliasSess.sessionId,
    executionId: aliasEx.executionId
  });
  const tabTools = createSessionTools({
    store: aliasRt.store,
    execution: aliasEx,
    fs: aliasFs,
    sessionId: aliasSess.sessionId,
    fetchImpl: async () => {
      throw new Error('fetch should not run on tab-first');
    },
    hostFindTab: async (url) =>
      String(url).includes('spa.example') ? { ok: true, tabId: 44, url: 'https://spa.example/dash?x=1' } : { ok: false },
    hostPageCapture: async () => ({
      ok: true,
      url: 'https://spa.example/dash?x=1',
      title: 'Dash',
      html: '<html><body>logged-in SPA truth</body></html>'
    })
  });
  const tabHit = await tabTools.acquire.execute({ action: 'fetch', url: '页面1' });
  assert(tabHit.ok && tabHit.pathUsed === 'content-script', 'tab-first uses content-script path');
  assert(String(tabHit.preview || '').includes('logged-in SPA truth'), 'tab capture has page text');
  const fetchTools = createSessionTools({
    store: aliasRt.store,
    execution: aliasEx,
    fs: aliasFs,
    sessionId: aliasSess.sessionId,
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      headers: { get: (n) => (n === 'content-type' ? 'text/plain' : null) },
      arrayBuffer: async () => new TextEncoder().encode(`fetched:${url}`)
    }),
    hostFindTab: async () => ({ ok: false }),
    hostPageCapture: async () => ({ ok: false })
  });
  const fetchHit = await fetchTools.acquire.execute({ action: 'fetch', url: 'page1' });
  assert(fetchHit.ok && fetchHit.pathUsed === 'fetch', 'no matching tab → acquire fetch fallback');
  assert(String(tabTools.acquire.description || '').includes('页面N'), 'one acquire clause for aliases');
  settleExecution(aliasRt.store, aliasEx, 'settled');

  const longUrl = `https://very-long.example/${'p'.repeat(80)}`;
  const worldItems = [
    { id: 'wi_page', handle: 'page1', kind: 'page', label: '页面1', url: `${longUrl.slice(0, 47)}…` },
    { id: 'wi_img', handle: 'image1', kind: 'image', label: '图片1' }
  ];
  const worldPages = buildWorldStateBlock({
    boundGroups: [{ id: 'g', name: 'G', itemCount: 2 }],
    boundItems: worldItems,
    artifactCount: 0
  });
  assert(worldPages.includes('页面1'), 'world block lists 页面1');
  assert(worldPages.includes('page1'), 'world block lists page handle');
  assert(!worldPages.includes(longUrl), 'full long URL stays out of the world block');
  assert(worldPages.includes('…'), 'truncated URL marker');
  const fatItems = Array.from({ length: 80 }, (_, i) => ({
    id: `wi_${i}`,
    handle: `page${i + 1}`,
    kind: 'page',
    label: `页面${i + 1}`,
    url: `https://bulk.example/${'u'.repeat(40)}/${i}`
  }));
  const fatWorld = buildWorldStateBlock({
    boundGroups: [{ id: 'g', name: 'G', itemCount: 80 }],
    boundItems: fatItems,
    artifactCount: 0,
    shelf: [{ id: 'f', label: 'x'.repeat(200) }]
  });
  assert(fatWorld.length <= 4000, `world block budget respected, got ${fatWorld.length}`);
}
