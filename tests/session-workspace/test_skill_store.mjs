import assert from 'node:assert/strict';
import {
  createMemorySkillStore,
  setDurableSkillStore,
  mergeSkillCatalog,
  skillRecordFromMarkdown,
  githubSkillUrls,
  normalizeDurableSkill,
  importSkillFromUrl,
  writeSkillPackToGuest
} from '../../src/agent/vnext/sessionWorkspace/skillStore.js';
import {
  listPackagedSkillCatalog,
  formatSkillsForSystemPrompt,
  loadSkillInstructions,
  getSkill,
  resolveSkillId
} from '../../src/agent/vnext/skills/registry.js';
import { createSessionTools, hydrateSkillScriptsIntoGuest } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { buildSkillCandidates } from '../../src/sidepanel/composerSkills.js';
import { normalizeComposerMentions } from '../../src/sidepanel/composerMentions.js';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSession } from '../../src/agent/vnext/sessionWorkspace/sessionApi.js';
import { stripWorkspaceUiEvent } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import nodeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const store = createMemorySkillStore();
setDurableSkillStore(store);

const rec = skillRecordFromMarkdown('my-demo', `---
name: My Demo
description: User wants a tiny demo playbook for tests. Do not use for posters.
---

# Hello
Use inspect then run.
`);
await store.upsert(rec);
const listed = await store.list();
assert.equal(listed.length, 1);
assert.equal(listed[0].id, 'my-demo');
assert.match(listed[0].instructions, /Hello/);

assert.equal(resolveSkillId('html-deck'), 'slides');
assert.equal(resolveSkillId('html-poster'), 'poster');
assert.equal(getSkill('html-deck')?.id, 'slides');
assert.equal(getSkill('html-poster')?.id, 'poster');
assert.equal(loadSkillInstructions('html-deck'), loadSkillInstructions('slides'));
assert.equal(loadSkillInstructions('html-poster'), loadSkillInstructions('poster'));

const packed = listPackagedSkillCatalog();
const merged = mergeSkillCatalog(packed, listed);
assert.ok(merged.some((s) => s.id === 'my-demo'));
assert.ok(merged.some((s) => s.id === 'poster'));
const prompt = formatSkillsForSystemPrompt({ catalog: merged });
assert.match(prompt, /id: my-demo/);
assert.match(prompt, /tiny demo playbook/);
assert.doesNotMatch(prompt, /# Hello/);
assert.match(prompt, /explicitly asked/);

const overlay = normalizeDurableSkill({
  id: 'html-poster',
  name: 'HTML Poster',
  description: 'Overlay description for poster skill used only in this test.',
  instructions: '# overlay body',
  origin: 'overlay'
});
await store.upsert(overlay);
const merged2 = mergeSkillCatalog(packed, await store.list());
const poster = merged2.find((s) => s.id === 'poster');
assert.equal(poster.origin, 'overlay');
assert.match(poster.description, /Overlay description/);
assert.equal(merged2.some((s) => s.id === 'html-poster'), false, 'alias overlay merges onto canonical poster');

const gh = githubSkillUrls('https://github.com/acme/demo-skill');
assert.equal(gh.ok, true);
assert.match(gh.rawSkillMd, /raw\.githubusercontent\.com\/acme\/demo-skill\/HEAD\/SKILL\.md/);
const bad = githubSkillUrls('http://127.0.0.1/SKILL.md');
assert.equal(bad.ok, false);

const sw = new SessionWorkspaceStore();
createSession(sw, { sessionId: 's-skill' });
const execution = beginExecution(sw, 's-skill', {});
const fs = createSessionGuestFs(sw, { sessionId: 's-skill', executionId: execution.executionId });
fs.mkdirp('/artifacts');
const tools = createSessionTools({ store: sw, execution, fs, sessionId: 's-skill' });
const up = await tools.run.execute({
  op: 'skill',
  act: 'upsert',
  id: 'from-run',
  name: 'From Run',
  description: 'Created via run op=skill upsert for tests. Not a poster.',
  instructions: 'Call inspect.'
});
assert.equal(up.ok, true, up.error);
assert.equal(up.skill.id, 'from-run');
const looked = await tools.inspect.execute({ view: 'skill', skillId: 'from-run' });
assert.equal(looked.ok, true);
assert.match(looked.playbook, /Call inspect/);
const cat = await tools.inspect.execute({ view: 'skill' });
assert.ok(cat.catalog.some((s) => s.id === 'from-run'));

const denied = await tools.run.execute({
  op: 'skill',
  act: 'import',
  url: 'http://localhost/secret/SKILL.md'
});
assert.equal(denied.ok, false);

const cands = buildSkillCandidates(merged, 'demo');
assert.ok(cands.some((c) => c.id === 'my-demo' && c.kind === 'skill'));
assert.equal(cands.some((c) => c.id === 'plan'), false);
assert.equal(buildSkillCandidates(merged, 'zzzz-nope-skill').length, 0);
const slash = buildSkillCandidates(merged, 'plan');
assert.ok(slash.some((c) => c.kind === 'command' && c.id === 'plan'));
assert.equal(buildSkillCandidates(merged, 'a').some((c) => c.id === 'plan'), false);
const mentionNorm = normalizeComposerMentions([
  { kind: 'skill', id: 'my-demo', label: 'My Demo', handle: 'my-demo', groupId: '__skills__' },
  { kind: 'command', id: 'plan', label: 'plan', handle: 'plan', groupId: '__commands__' }
]);
assert.equal(mentionNorm[0].kind, 'skill');
assert.equal(mentionNorm[0].id, 'my-demo');
assert.equal(mentionNorm[1].kind, 'command');
assert.equal(mentionNorm[1].id, 'plan');

const tree = githubSkillUrls('https://github.com/acme/demo-skill/tree/main/skills/foo');
assert.equal(tree.ok, true);
assert.match(tree.rawSkillMd, /\/main\/skills\/foo\/SKILL\.md$/);
const rawGh = githubSkillUrls('https://raw.githubusercontent.com/acme/demo-skill/main/SKILL.md');
assert.equal(rawGh.ok, true);
assert.equal(rawGh.user, 'acme');
assert.equal(rawGh.repo, 'demo-skill');

const GH_MD = `---
name: Demo Skill
description: User wants a fetched github skill for tests. Do not use for posters.
---

# GH body
Use the sandbox script.
`;
const GH_SCRIPT = 'export function ping() { return 1 }\n';

function jsonRes(data) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
    json: async () => data
  };
}
function textRes(text) {
  return {
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => ({})
  };
}

const fetchRoot = async (url) => {
  const u = String(url);
  if (u.includes('raw.githubusercontent.com/acme/demo-skill/HEAD/SKILL.md')) return textRes(GH_MD);
  if (u.includes('raw.githubusercontent.com/acme/demo-skill/HEAD/scripts/ping.js')) return textRes(GH_SCRIPT);
  if (u.includes('api.github.com/repos/acme/demo-skill/contents/scripts')) {
    return jsonRes([
      {
        type: 'file',
        name: 'ping.js',
        path: 'scripts/ping.js',
        download_url: 'https://raw.githubusercontent.com/acme/demo-skill/HEAD/scripts/ping.js',
        size: GH_SCRIPT.length
      }
    ]);
  }
  if (u.includes('api.github.com/repos/acme/demo-skill/contents')) {
    return jsonRes([
      {
        type: 'file',
        name: 'SKILL.md',
        path: 'SKILL.md',
        download_url: 'https://raw.githubusercontent.com/acme/demo-skill/HEAD/SKILL.md',
        size: GH_MD.length
      },
      { type: 'dir', name: 'scripts', path: 'scripts' }
    ]);
  }
  return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
};

const imported = await importSkillFromUrl('https://github.com/acme/demo-skill', { fetchImpl: fetchRoot });
assert.equal(imported.ok, true, imported.error);
assert.equal(imported.skill.id, 'demo-skill');
assert.equal(imported.skill.origin, 'github');
assert.match(imported.skill.instructions, /GH body/);
assert.equal(imported.skill.resources['scripts/ping.js'], GH_SCRIPT);

const NEST_MD = `---
name: Nested Demo
description: Nested skills/ folder github skill for tests.
---

# Nested
`;
const fetchNested = async (url) => {
  const u = String(url);
  if (u.includes('/HEAD/SKILL.md') && !u.includes('/skills/')) {
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
  }
  if (u.includes('api.github.com/repos/acme/pack-repo/contents/skills?')) {
    return jsonRes([{ type: 'dir', name: 'nested-demo', path: 'skills/nested-demo' }]);
  }
  if (u.includes('raw.githubusercontent.com/acme/pack-repo/HEAD/skills/nested-demo/SKILL.md')) {
    return textRes(NEST_MD);
  }
  if (u.includes('api.github.com/repos/acme/pack-repo/contents/skills/nested-demo')) {
    return jsonRes([
      {
        type: 'file',
        name: 'SKILL.md',
        path: 'skills/nested-demo/SKILL.md',
        download_url: 'https://raw.githubusercontent.com/acme/pack-repo/HEAD/skills/nested-demo/SKILL.md',
        size: NEST_MD.length
      }
    ]);
  }
  return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
};

const nested = await importSkillFromUrl('https://github.com/acme/pack-repo', { fetchImpl: fetchNested });
assert.equal(nested.ok, true, nested.error);
assert.equal(nested.skill.id, 'nested-demo');
assert.match(nested.skill.instructions, /Nested/);

const toolsGh = createSessionTools({
  store: sw,
  execution,
  fs,
  sessionId: 's-skill',
  fetchImpl: fetchRoot
});
const fetched = await toolsGh.run.execute({
  op: 'skill',
  act: 'import',
  url: 'https://github.com/acme/demo-skill'
});
assert.equal(fetched.ok, true, fetched.error);
assert.equal(fetched.skill.id, 'demo-skill');

writeSkillPackToGuest(fs, imported.skill);
assert.match(fs.readFile('/scratch/skills/demo-skill/SKILL.md'), /GH body/);
assert.equal(fs.readFile('/scratch/skills/demo-skill/scripts/ping.js'), GH_SCRIPT);

await hydrateSkillScriptsIntoGuest(fs);
assert.match(fs.readFile('/scratch/skills/from-run/SKILL.md'), /Call inspect/);
assert.ok(fs.exists('/scratch/skills/poster/SKILL.md'));
assert.ok(fs.exists('/scratch/skills/html-poster/SKILL.md'), 'alias guest path is hydrated');
const packagedPoster = loadSkillInstructions('poster') || '';
assert.match(packagedPoster, /plate/);
assert.match(packagedPoster, /reference/);
assert.match(packagedPoster, /Paw Work Design/);
assert.match(packagedPoster, /tldraw/);
assert.match(packagedPoster, /themeId/);
assert.match(packagedPoster, /layoutId/);
assert.match(packagedPoster, /CANVAS_QA_FAILED/);
assert.doesNotMatch(packagedPoster, /Four rounds|four rounds/);
assert.doesNotMatch(packagedPoster, /`run` html, \*\*one\*\* create command/);

const THEME_IDS = [
  'hanbai',
  'ink-rose',
  'midnight-cyan',
  'forest',
  'studio-amber',
  'editorial',
  'cobalt',
  'mono'
];
const SLIDE_LAYOUT_IDS = [
  'title',
  'title-visual',
  'section',
  'agenda',
  'points',
  'points-icons',
  'two-col',
  'compare',
  'stat-row',
  'quote',
  'image-caption',
  'timeline',
  'process',
  'matrix',
  'case-study',
  'closing'
];
const POSTER_LAYOUT_IDS = [
  'poster-hero',
  'poster-split',
  'poster-event',
  'poster-quote',
  'poster-product',
  'poster-editorial',
  'poster-data',
  'comic-panel'
];

function jsonExamplesFromSkill(text) {
  const blocks = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    blocks.push(JSON.parse(m[1]));
  }
  return blocks;
}

function assertNoModelBox(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoModelBox(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    assert.equal(Object.prototype.hasOwnProperty.call(value, 'box'), false, `${path}.box must not be model-authored`);
    for (const [k, v] of Object.entries(value)) {
      if (k === 'x' || k === 'y' || k === 'w' || k === 'h') {
        assert.fail(`${path}.${k} must not be model-authored`);
      }
      assertNoModelBox(v, `${path}.${k}`);
    }
  }
}

const packagedDeck = loadSkillInstructions('slides') || '';
assert.match(packagedDeck, /activeHtml|canvases\.deck/);
assert.match(packagedDeck, /replacePlate/);
assert.match(packagedDeck, /`deck` tool|deck` `setSlotText/);
assert.match(packagedDeck, /stagger-fade|animation/);
assert.match(packagedDeck, /\bpaper\b.*\bsurface\b.*\baccent\b.*\bdark\b|\bvariant\b/);
assert.match(packagedDeck, /1–2 dark\/accent|dark\/accent anchors/);
assert.match(packagedDeck, /3\+ consecutive|consecutive identical/);
for (const id of THEME_IDS) {
  assert.match(packagedDeck, new RegExp(`\\b${id}\\b`), `deck skill must name theme ${id}`);
  assert.match(packagedPoster, new RegExp(`\\b${id}\\b`), `poster skill must name theme ${id}`);
}
for (const id of SLIDE_LAYOUT_IDS) {
  assert.match(packagedDeck, new RegExp(`\\b${id}\\b`), `deck skill must name layout ${id}`);
}
for (const id of POSTER_LAYOUT_IDS) {
  assert.match(packagedPoster, new RegExp(`\\b${id}\\b`), `poster skill must name layout ${id}`);
}

function sectionAfter(text, heading) {
  const src = String(text || '');
  const i = src.indexOf(heading);
  if (i < 0) return '';
  const rest = src.slice(i);
  const next = rest.slice(heading.length).search(/\n## /);
  return next < 0 ? rest : rest.slice(0, heading.length + next);
}

function assertVisualPriority(text, label) {
  const src = String(text || '');
  assert.match(src, /User selection|selected \/ user asset first/i, `${label} must prefer selection/workspace assets`);
  assert.match(src, /packaged icon/i, `${label} must teach packaged icons`);
  assert.match(src, /native\s+motif/i, `${label} must teach native motifs`);
  assert.match(src, /native\s+chart/i, `${label} must teach native charts`);
  assert.match(src, /Never invent statistics|Never fabricate chart data/i, `${label} must lock chart honesty`);
  assert.match(src, /catalog="icons"|catalog": "icons"/, `${label} must teach icon query`);
  assert.match(src, /catalog="image-brief"|catalog": "image-brief"/, `${label} must teach image-brief`);
  assert.doesNotMatch(src, /buildGeneratedImageBrief/, `${label} must not name an internal JS helper`);
  const order = [
    src.search(/User selection|selected \/ user asset first/i),
    src.search(/packaged icon/i),
    src.search(/native\s+motif/i),
    src.search(/native\s+chart/i),
    src.search(/catalog="image-brief"|generated image/i)
  ];
  assert.ok(
    order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3] && order[3] < order[4],
    `${label} visual priority must be selection → icon → motif → chart → generated (${order.join(',')})`
  );
}

const deckExamples = jsonExamplesFromSkill(packagedDeck);
assert.ok(deckExamples.length >= 2, 'deck skill must ship createScene + replacePlate examples');
for (const ex of deckExamples) assertNoModelBox(ex);
const outline = deckExamples.find((ex) => ex.op === 'createScene');
const replace = deckExamples.find((ex) => ex.op === 'replacePlate');
assert.ok(outline, 'deck skill needs one createScene example');
assert.ok(replace, 'deck skill needs one replacePlate example');
const outlineFixture = JSON.parse(
  nodeFs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/visual/deck-skill-outline.json'),
    'utf8'
  )
);
assert.equal(outline.op, outlineFixture.op);
assert.equal(outline.kind, outlineFixture.kind);
assert.equal(outline.themeId, outlineFixture.themeId);
assert.equal(outlineFixture.artifact, 'one');
assert.ok(Array.isArray(outline.frames) && outline.frames.length >= outlineFixture.frames, 'one artifact / many frames');
assert.equal(outline.frames.some((fr) => Array.isArray(fr.nodes) && fr.nodes.length), false);
assert.equal(outline.frames.filter((fr) => fr.op === 'createScene').length, 0);
assert.ok(THEME_IDS.includes(outline.themeId));
assert.ok(outline.frames.every((fr) => SLIDE_LAYOUT_IDS.includes(fr.layoutId)));
assert.ok(replace.plateId || replace.frameId);
assert.ok(SLIDE_LAYOUT_IDS.includes(replace.layoutId));
assert.ok(replace.slots && typeof replace.slots === 'object');

const visualKinds = new Set();
for (const fr of outline.frames) {
  const vis = fr.slots?.visual;
  if (vis?.kind) visualKinds.add(vis.kind);
}
assert.ok(visualKinds.has('icon') && visualKinds.has('chart'));
const chartSlide = outline.frames.find((fr) => fr.slots?.visual?.kind === 'chart');
assert.ok(chartSlide, 'createScene example needs a factual chart slide');
assert.ok(Array.isArray(chartSlide.slots.visual.data));
assert.ok(chartSlide.slots.visual.data.every((n) => Number.isFinite(Number(n?.value ?? n))));
assert.match(String(chartSlide.notes || packagedDeck), /表格|evidence|source|所选/i);

assert.match(packagedDeck, /catalog="icons"/);
assert.match(packagedDeck, /catalog="image-brief"/);
assert.match(packagedDeck, /acquire action=image/);

const deckVisuals = sectionAfter(packagedDeck, '## Visual slots');
assertVisualPriority(packagedDeck, 'slides');
assert.match(packagedDeck, /same.*createScene|one live artifact/i);
assert.match(packagedDeck, /Do not browse|do not dump|Do not dump|Never dump/i);

assertVisualPriority(packagedPoster, 'poster');
assert.match(packagedPoster, /next.*canvas write must attach the returned `path`/i);

const briefing = loadSkillInstructions('briefing-deck') || '';
assert.match(briefing, /slides/);
assert.match(briefing, /3–7|3-7/);
assert.match(briefing, /notes/);
assert.match(briefing, /one live artifact/);
assertVisualPriority(briefing, 'briefing-deck');

const compose = loadSkillInstructions('compose-image') || '';
assert.match(compose, /raster PNG|one new picture|fused image/);
assert.match(compose, /slides|poster/);
assert.match(compose, /catalog="image-brief"|visual slot/);
assert.doesNotMatch(compose, /frames:\s*\[\{\s*id/);
assert.doesNotMatch(compose, /buildGeneratedImageBrief/);

const visual = loadSkillInstructions('visual-compile') || '';
assert.match(visual, /slides/);
assert.match(visual, /poster/);
assert.match(visual, /Do \*\*not\*\* `fromRaster`/);
assert.match(visual, /icon|motif|chart/);
assert.doesNotMatch(visual, /buildGeneratedImageBrief/);

const lookedPoster = await tools.inspect.execute({ view: 'skill', skillId: 'poster' });
assert.equal(lookedPoster.ok, true);
assert.equal(lookedPoster.guestRoot, '/scratch/skills/poster');
assert.ok(Array.isArray(lookedPoster.resources));
assert.doesNotMatch(String(lookedPoster.playbook || ''), /^\[object /);

const aliasPoster = await tools.inspect.execute({ view: 'skill', skillId: 'html-poster' });
assert.equal(aliasPoster.ok, true, 'html-poster alias must resolve');
assert.equal(aliasPoster.skillId, 'poster');
assert.equal(aliasPoster.guestRoot, '/scratch/skills/poster');
assert.match(String(aliasPoster.playbook || ''), /Design poster playbook|Paw Work Design|# overlay body/);

const aliasDeck = await tools.inspect.execute({ view: 'skill', skillId: 'html-deck' });
assert.equal(aliasDeck.ok, true, 'html-deck alias must resolve');
assert.equal(aliasDeck.skillId, 'slides');

const guestPlaybook = await tools.inspect.execute({
  view: 'skill',
  skillId: 'poster',
  path: '/scratch/skills/poster'
});
assert.equal(guestPlaybook.ok, true, guestPlaybook.error);
assert.ok(String(guestPlaybook.content || '').trim(), 'guest skill path should return playbook text');

const files = await tools.inspect.execute({ view: 'files', path: '/scratch/skills/poster' });
assert.equal(files.ok, true, files.error);
assert.ok(
  (files.listing || []).some((n) => /SKILL\.md/i.test(n.name || n || '')),
  JSON.stringify(files.listing)
);

const stripped = stripWorkspaceUiEvent({
  type: 'image_generated',
  artifactId: 'art_1',
  dataUrl: 'data:image/png;base64,AAAA',
  bytes: new Uint8Array([1, 2, 3])
});
assert.equal(stripped.artifactId, 'art_1');
assert.equal(stripped.dataUrl, undefined);
assert.equal(stripped.bytes, undefined);

console.log('test_skill_store: ok');
