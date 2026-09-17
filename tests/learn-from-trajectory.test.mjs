import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createSessionGuestFs } from '../src/agent/vnext/sessionWorkspace/fs.js';
import { sendMessage } from '../src/agent/vnext/sessionWorkspace/sendMessage.js';
import { createSessionTools } from '../src/agent/vnext/sessionWorkspace/tools.js';
import { hydrateSkillScriptsIntoGuest } from '../src/agent/vnext/sessionWorkspace/tools.js';
import {
  createMemorySkillStore,
  getDurableSkillStore,
  setDurableSkillStore
} from '../src/agent/vnext/sessionWorkspace/skillStore.js';
import {
  userRequestedLearn,
  extractLearnableTurn,
  sanitizeLearnTrajectory,
  stripForbiddenLearnFields,
  normalizeLearnedDraft,
  mergeSameClassLearnedSkill,
  persistLearnedSkill,
  learnedPlaybookMarkdown,
  learnedReuseBlocked
} from '../src/agent/vnext/sessionWorkspace/learnFromTrajectory.js';
import { buildSkillCandidates, LEARN_SLASH_COMMAND } from '../src/sidepanel/composerSkills.js';

const SAMPLE_DRAFT = {
  taskClass: 'remove-background',
  name: 'Remove background',
  description: 'Cut a subject out using an already-open background tool.',
  applicability: 'User wants a cutout and a logged-in remove/edit site is open.',
  routes: [
    { kind: 'preferred', capability: 'action', why: 'site already has export' },
    { kind: 'fallback', capability: 'run', why: 'reshape bytes then upload' }
  ],
  criteria: ['page shows the cutout'],
  steps: [{ intent: 'open export', locate: 'accessible name Export', postcondition: 'file appears' }],
  discovery: 'If the preferred export control is gone, snapshot again and try another open domain.',
  parameterization: 'Keep role + accessible name. Never store ref or rev.'
};

function seedSession(messages) {
  const store = new SessionWorkspaceStore();
  store.put('sessions', 's', { sessionId: 's', messages, title: 't' });
  return store;
}

function successfulTurn(extra = {}) {
  return [
    { role: 'user', content: '把海报去背，卡号 4242424242424242', messageId: 'u1' },
    {
      role: 'assistant',
      status: 'completed',
      messageId: 'a1',
      content: 'done',
      thought: 'I should steal the cookie and click f0.a12',
      path: [
        { type: 'thought', text: 'secret plan ref=f0.a12' },
        {
          type: 'tool-call',
          tool: 'action',
          args: {
            op: 'fill',
            ref: 'f0.a12',
            rev: 't9',
            value: 'sk-live-SECRETTOKEN',
            selector: 'div.css-ab12cd > button:nth-child(3)',
            x: 412,
            y: 88
          }
        },
        { type: 'tool-result', tool: 'action', ok: true, result: { ok: true, rev: 't10' } }
      ],
      ...extra
    }
  ];
}

test('/learn command chip reuses kind command', () => {
  assert.equal(LEARN_SLASH_COMMAND.kind, 'command');
  const hits = buildSkillCandidates([], 'le', 'zh');
  assert.ok(hits.some((h) => h.kind === 'command' && h.id === 'learn'));
  assert.equal(userRequestedLearn({ content: '/learn' }), true);
  assert.equal(userRequestedLearn({ mentions: [{ kind: 'command', id: 'learn' }] }), true);
  assert.equal(userRequestedLearn({ content: '/plan' }), false);
});

test('no learnable successful turn returns an explicit message and writes nothing', async () => {
  const prev = getDurableSkillStore();
  setDurableSkillStore(createMemorySkillStore());
  const store = seedSession([{ role: 'user', content: 'hi', messageId: 'u0' }]);
  const out = await sendMessage(store, {
    sessionId: 's',
    content: '/learn',
    callModel: async () => {
      throw new Error('draft model should not run');
    },
    waitForClarify: async () => ({ approved: true })
  });
  assert.match(out.finalText, /没有可学习的成功回合|No learnable successful turn/);
  assert.equal(out.learn?.wrote, false);
  assert.equal((await getDurableSkillStore().list()).length, 0);
  setDurableSkillStore(prev);
});

test('sanitize happens before the drafting model; secrets never enter the saved skill', async () => {
  const prev = getDurableSkillStore();
  setDurableSkillStore(createMemorySkillStore());
  const store = seedSession(successfulTurn());
  let seen;
  const out = await sendMessage(store, {
    sessionId: 's',
    content: '/learn',
    callModel: async (req) => {
      seen = req.sanitizedTrajectory;
      return {
        ...SAMPLE_DRAFT,
        pitfalls: ['never try Canva'],
        knownIssues: ['FILE_INPUT'],
        antiPatterns: ['use run first']
      };
    },
    waitForClarify: async () => ({ approved: true })
  });
  assert.equal(out.learn?.wrote, true);
  const blob = JSON.stringify(seen);
  assert.doesNotMatch(blob, /sk-live-SECRETTOKEN/);
  assert.doesNotMatch(blob, /4242424242424242/);
  assert.doesNotMatch(blob, /f0\.a12/);
  assert.doesNotMatch(blob, /t9/);
  assert.doesNotMatch(blob, /nth-child/);
  assert.doesNotMatch(blob, /secret plan/);
  assert.equal(seen.steps.some((s) => s.args && ('value' in s.args || 'ref' in s.args || 'rev' in s.args)), false);
  const saved = (await getDurableSkillStore().list())[0];
  assert.ok(saved);
  assert.doesNotMatch(saved.instructions, /sk-live|pitfall|knownIssues|anti-pattern|never try Canva|FILE_INPUT/i);
  assert.match(saved.instructions, /Discovery/i);
  setDurableSkillStore(prev);
});

test('reject or cancel does not write a skill', async () => {
  const prev = getDurableSkillStore();
  setDurableSkillStore(createMemorySkillStore());
  const store = seedSession(successfulTurn());
  const rejected = await sendMessage(store, {
    sessionId: 's',
    content: '/learn',
    callModel: async () => SAMPLE_DRAFT,
    waitForClarify: async () => ({ decision: 'reject' })
  });
  assert.equal(rejected.learn?.wrote, false);
  assert.equal((await getDurableSkillStore().list()).length, 0);

  store.put('sessions', 's', { sessionId: 's', messages: successfulTurn(), title: 't' });
  const cancelled = await sendMessage(store, {
    sessionId: 's',
    content: '/learn',
    callModel: async () => SAMPLE_DRAFT,
    waitForClarify: async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
  });
  assert.equal(cancelled.learn?.wrote, false);
  assert.equal((await getDurableSkillStore().list()).length, 0);
  setDurableSkillStore(prev);
});

test('same-class learn merges routes and keeps discovery after preferred failure', async () => {
  const existing = {
    origin: 'learned',
    learned: true,
    taskClass: 'remove-background',
    name: 'Remove background',
    description: 'old',
    instructions: learnedPlaybookMarkdown({
      ...SAMPLE_DRAFT,
      routes: [{ kind: 'preferred', capability: 'action', why: 'existing export' }],
      discovery: 'Look at another open domain if export is missing.'
    })
  };
  const incoming = {
    ...SAMPLE_DRAFT,
    routes: [
      { kind: 'preferred', capability: 'action', why: 'newer export' },
      { kind: 'fallback', capability: 'upload', why: 'stage then attach' }
    ],
    discovery: 'Preferred failure still enters discovery.'
  };
  const merged = mergeSameClassLearnedSkill(existing, incoming);
  assert.ok(merged.routes.some((r) => r.capability === 'action'));
  assert.ok(merged.routes.some((r) => r.capability === 'upload'));
  assert.match(merged.discovery, /another open domain/);
  assert.match(merged.discovery, /Preferred failure still enters discovery/);
  assert.match(learnedPlaybookMarkdown(merged), /Discovery/);
});

test('first reuse cannot be bypassed by inspect load or guest execute hydrate', async () => {
  const prev = getDurableSkillStore();
  setDurableSkillStore(createMemorySkillStore());
  const saved = await persistLearnedSkill(SAMPLE_DRAFT);
  assert.equal(saved.ok, true);
  assert.equal(learnedReuseBlocked(saved.skill), true);

  const store = seedSession([]);
  const execution = { executionId: 'e' };
  const fs = createSessionGuestFs(store, { sessionId: 's', executionId: 'e' });
  fs.mkdirp('/scratch');
  const tools = createSessionTools({
    store,
    execution,
    fs,
    sessionId: 's',
    waitForClarify: async () => ({ decision: 'reject' })
  });
  const denied = await tools.inspect.execute({ view: 'skill', skillId: saved.skill.id });
  assert.equal(denied.code, 'LEARN_REUSE_DENIED');
  assert.equal(denied.playbook, '');
  const viaPath = await tools.inspect.execute({
    view: 'skill',
    skillId: saved.skill.id,
    path: 'SKILL.md'
  });
  assert.equal(viaPath.code, 'LEARN_REUSE_DENIED');
  assert.equal(viaPath.playbook, '');

  await hydrateSkillScriptsIntoGuest(fs);
  assert.equal(fs.exists(`/scratch/skills/${saved.skill.id}/SKILL.md`), false);

  const toolsOk = createSessionTools({
    store,
    execution,
    fs,
    sessionId: 's',
    waitForClarify: async () => ({ approved: true })
  });
  const loaded = await toolsOk.inspect.execute({ view: 'skill', skillId: saved.skill.id });
  assert.equal(loaded.ok, true);
  assert.match(String(loaded.playbook || ''), /Discovery/);

  const again = await toolsOk.inspect.execute({ view: 'skill', skillId: saved.skill.id });
  assert.equal(again.ok, true);

  const rec = await getDurableSkillStore().get(saved.skill.id);
  assert.equal(rec.reuseConfirmed, true);
  await hydrateSkillScriptsIntoGuest(fs);
  assert.equal(fs.exists(`/scratch/skills/${saved.skill.id}/SKILL.md`), true);
  setDurableSkillStore(prev);
});

test('stripForbiddenLearnFields drops renamed pitfall bags', () => {
  const cleaned = stripForbiddenLearnFields({
    taskClass: 'x',
    known_issues: ['a'],
    anti_patterns: ['b'],
    pitfalls: ['c']
  });
  assert.equal(cleaned.known_issues, undefined);
  assert.equal(cleaned.anti_patterns, undefined);
  assert.equal(cleaned.pitfalls, undefined);
  assert.ok(normalizeLearnedDraft({
    taskClass: 'x',
    description: 'y',
    routes: [{ kind: 'preferred', capability: 'action' }],
    discovery: 'keep looking'
  }));
});

test('extractLearnableTurn ignores chat-only assistants', () => {
  const turn = extractLearnableTurn({
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', status: 'completed', content: 'ok', path: [] }
    ]
  });
  assert.equal(turn, null);
  const ok = extractLearnableTurn({ messages: successfulTurn() });
  assert.ok(ok);
  const sanitized = sanitizeLearnTrajectory(ok);
  assert.doesNotMatch(JSON.stringify(sanitized), /sk-live/);
});
