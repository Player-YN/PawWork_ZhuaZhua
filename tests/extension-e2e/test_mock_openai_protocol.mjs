/**
 * Node-only: mock protocol + e2e outline compile (no browser).
 */
import assert from 'node:assert/strict';
import { createOpenAICompatible } from '../../src/agent/vnext/adapters/vendor/ai-sdk-loader.mjs';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/runSession.product.js';
import { slide4ReplaceSlots } from '../session-workspace/harness/semanticDeckFixture.mjs';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { gateCompiledScene } from '../../src/agent/vnext/sessionWorkspace/canvasQaGate.js';
import { listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import {
  createSceneToolArgs,
  decideMockResponse,
  MOCK_API_KEY,
  MOCK_MODEL,
  replacePlateToolArgs,
  startMockOpenAiServer
} from './mockOpenAiServer.mjs';

const createArgs = createSceneToolArgs();
assert.equal(createArgs.op, 'createScene');
assert.equal(createArgs.themeId, 'ink-rose');
assert.ok(createArgs.frames.every((f) => f.layoutId && f.slots && !f.nodes));
assert.equal(createArgs.frames[0].slots.visual.kind, 'icon');
assert.equal(createArgs.frames[4].slots.visual.kind, 'motif');
assert.equal(createArgs.frames[5].slots.visual.kind, 'chart');

const built = createScene(createArgs);
assert.equal(built.ok, true, built.error);
const gated = gateCompiledScene(built, { op: 'createScene', kind: 'deck', source: built.source });
assert.equal(gated.ok, true, JSON.stringify(gated.qa || gated));
assert.ok(gated.qa.score >= 90, `e2e outline QA ${gated.qa.score}`);
const frames = listEngineNodes(built.canvas).filter((n) => n.type === 'frame');
assert.equal(frames.length, 7);
assert.ok(listEngineNodes(built.canvas).some((n) => n.type === 'image'));
assert.ok(listEngineNodes(built.canvas).some((n) => n.type === 'geo' || n.type === 'text'));

const agentTools = [
  { type: 'function', function: { name: 'run' } },
  { type: 'function', function: { name: 'deck' } }
];

const titleOnly = decideMockResponse({
  messages: [{ role: 'user', content: '做一份 Paw Work 介绍幻灯' }]
});
assert.equal(titleOnly.kind, 'text');

const first = decideMockResponse({
  messages: [{ role: 'user', content: '做一份 Paw Work 介绍幻灯' }],
  tools: agentTools
});
assert.equal(first.kind, 'tool');
assert.equal(first.toolName, 'run');
assert.equal(first.args.themeId, 'ink-rose');

const afterCreate = decideMockResponse({
  messages: [
    { role: 'user', content: '做一份 Paw Work 介绍幻灯' },
    { role: 'assistant', tool_calls: [{ id: 'call_e2e_create' }] },
    { role: 'tool', tool_call_id: 'call_e2e_create', content: '{"ok":true}' }
  ],
  tools: agentTools
});
assert.equal(afterCreate.kind, 'text');

const replace = decideMockResponse({
  messages: [
    { role: 'user', content: '做一份 Paw Work 介绍幻灯' },
    { role: 'tool', content: '{"ok":true}' },
    { role: 'assistant', content: '已编译' },
    { role: 'user', content: '把第4页换成一句引言' }
  ],
  tools: agentTools
});
assert.equal(replace.kind, 'tool');
assert.equal(replace.toolName, 'deck');
assert.equal(replace.args.commands[0].op, 'replacePlate');
assert.equal(replace.args.commands[0].plateId, 'slide-4');
assert.deepEqual(replace.args.commands[0].slots, slide4ReplaceSlots());

const afterPreview = decideMockResponse({
  messages: [
    { role: 'user', content: '做一份 Paw Work 介绍幻灯' },
    { role: 'assistant', tool_calls: [{ id: 'call_e2e_create' }] },
    { role: 'tool', tool_call_id: 'call_e2e_create', content: '{"ok":true}' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Frame preview: Cover' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xx' } }
      ]
    }
  ],
  tools: agentTools
});
assert.equal(afterPreview.kind, 'text');

const mock = await startMockOpenAiServer();
try {
  const provider = createOpenAICompatible({
    name: 'e2e-mock',
    apiKey: MOCK_API_KEY,
    baseURL: mock.baseURL,
    includeUsage: true
  });
  const rt = createSessionWorkspaceRuntime(new SessionWorkspaceStore());
  const session = rt.createSession();
  let timer;
  const result = await Promise.race([
    rt.sendMessage({
      sessionId: session.sessionId,
      content: '用当前空白幻灯做一份七页的爪爪 Paw Work 中文介绍',
      model: provider(MOCK_MODEL)
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Node AI SDK mock loop timed out')), 45000);
    })
  ]);
  if (timer) clearTimeout(timer);
  assert.ok(result?.finalText || result?.ok !== false, JSON.stringify({ text: result?.finalText, calls: mock.calls }));
  assert.ok(
    mock.calls.some((c) => c.kind === 'tool' && c.toolName === 'run'),
    `expected createScene tool call, got ${JSON.stringify(mock.calls)}`
  );
  assert.ok(
    mock.calls.filter((c) => c.kind === 'tool').length <= 4,
    `mock re-emitted tools: ${JSON.stringify(mock.calls)}`
  );
  const arts = rt.listArtifacts(session.sessionId) || [];
  assert.ok(
    arts.some((a) => /slides\.json$/i.test(a.name || a.primaryPath || '')),
    `expected slides.json after Node loop: ${arts.map((a) => a.name)}`
  );
} finally {
  await mock.close();
}

console.log('test_mock_openai_protocol: ok');
