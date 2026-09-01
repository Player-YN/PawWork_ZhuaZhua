/**
 * Skill registry — loads **folder packages** (industry layout).
 *
 * Each skill is a directory:
 *   skills/<id>/
 *     SKILL.md          # name + description (semantic when-to-use) + playbook
 *     skillSource.js    # bundled SKILL.md text for Chrome (no .md import)
 *     index.js          # package entry → { skill }
 *     templates/        # reusable assets
 *     scripts/          # reusable helpers / hints
 *
 * Skills are playbooks, NOT tools. Model surface stays inspect / acquire / run.
 * Host never keyword-matches user text; description is for model semantic routing.
 */

import { skill as htmlPreview } from './html-preview/index.js';
import { skill as slides } from './slides/index.js';
import { skill as poster } from './poster/index.js';
import { skill as htmlSite } from './html-site/index.js';
import { skill as composeImage } from './compose-image/index.js';
import { skill as visualCompile } from './visual-compile/index.js';
import { skill as sheetNl } from './sheet-nl/index.js';
import { skill as listingSheet } from './listing-sheet/index.js';
import { skill as briefingDeck } from './briefing-deck/index.js';
import { skill as remakePoster } from './remake-poster/index.js';

/** Permanent id aliases so inspect / skillStore overlays keyed by old ids still resolve. */
export const SKILL_ID_ALIASES = Object.freeze({
  'html-deck': 'slides',
  'html-poster': 'poster'
});

/** @type {Map<string, SkillDef>} */
const SKILLS = new Map();

/**
 * @param {string} id
 * @returns {string}
 */
export function resolveSkillId(id) {
  const raw = String(id || '');
  return SKILL_ID_ALIASES[raw] || raw;
}

/**
 * Alias ids that point at a canonical packaged skill.
 * @param {string} canonicalId
 * @returns {string[]}
 */
export function skillIdAliases(canonicalId) {
  const want = String(canonicalId || '');
  return Object.entries(SKILL_ID_ALIASES)
    .filter(([, canonical]) => canonical === want)
    .map(([alias]) => alias);
}

/**
 * @typedef {object} SkillDef
 * @property {string} id
 * @property {string} [name]
 * @property {string} description
 * @property {string|((ctx?: object) => string)} instructions
 * @property {Record<string, string>} [templates]
 * @property {Record<string, string>} [resources]
 * @property {string[]} [libraries]
 * @property {string} [root] package folder id
 */

/**
 * @param {SkillDef} def
 */
export function registerSkill(def) {
  if (!def || !def.id) throw new Error('registerSkill: id required');
  if (def.instructions == null) throw new Error('registerSkill: instructions required');
  const description = String(def.description || '').trim();
  if (!description) {
    throw new Error(`registerSkill: description required for semantic routing (${def.id})`);
  }
  SKILLS.set(String(def.id), {
    id: String(def.id),
    name: def.name || def.id,
    description,
    instructions: def.instructions,
    templates: def.templates && typeof def.templates === 'object' ? { ...def.templates } : {},
    resources: def.resources && typeof def.resources === 'object' ? { ...def.resources } : {},
    libraries: Array.isArray(def.libraries) ? def.libraries.slice() : [],
    root: def.root || def.id
  });
  return SKILLS.get(String(def.id));
}

/**
 * @param {string} id
 * @returns {SkillDef|null}
 */
export function getSkill(id) {
  return SKILLS.get(resolveSkillId(id)) || null;
}

/**
 * @returns {string[]}
 */
export function listSkills() {
  return [...SKILLS.keys()];
}

/**
 * Catalog for model-facing semantic routing.
 * @returns {Array<{id:string,name:string,description:string,resourcePaths:string[]}>}
 */
export function listPackagedSkillCatalog() {
  return [...SKILLS.values()].map((s) => ({
    id: s.id,
    name: s.name || s.id,
    description: s.description,
    resourcePaths: Object.keys(s.resources || {}),
    origin: 'packaged'
  }));
}

export function listSkillCatalog() {
  return listPackagedSkillCatalog();
}

/**
 * @param {string} id
 * @param {object} [ctx]
 * @returns {string}
 */
export function loadSkillInstructions(id, ctx = {}) {
  const skill = getSkill(id);
  if (!skill) return '';
  if (typeof skill.instructions === 'function') {
    return String(skill.instructions(ctx) || '');
  }
  return String(skill.instructions || '');
}

/**
 * @param {string} skillId
 * @param {string} resourcePath logical path e.g. templates/report.html
 * @returns {string|null}
 */
export function loadSkillResource(skillId, resourcePath) {
  const skill = getSkill(skillId);
  if (!skill?.resources) return null;
  const v = skill.resources[resourcePath];
  return v == null ? null : String(v);
}

/**
 * Industry progressive disclosure: system gets catalog only (id/name/description).
 * Playbooks and resources load later via inspect view=skill.
 *
 * @param {object} [_ctx]
 * @returns {string}
 */
export function formatSkillsForSystemPrompt(_ctx = {}) {
  const catalog = (Array.isArray(_ctx.catalog) ? _ctx.catalog : listSkillCatalog())
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!catalog.length) return '';

  return [
    'Skills are optional folder packages (playbooks + templates/scripts), not tools and not modes.',
    'Match the user intent to a skill description using semantic understanding — never by host keyword lists.',
    'If no skill description fits, do not load any skill. Use inspect / acquire / run only.',
    'If a description fits, load that playbook with inspect view=skill and that skillId before following it.',
    'If the loaded playbook lists a resource path, load it with inspect view=skill, the same skillId, and path.',
    'Create, import, or delete a skill only when the user explicitly asked to. Never invent a skill unprompted.',
    '',
    '### Skill catalog',
    ...catalog.map((s) => `- id: ${s.id}\n  name: ${s.name}\n  description: ${s.description}`)
  ].join('\n');
}

export function clearSkills() {
  SKILLS.clear();
}

// ── Register built-in folder packages ───────────────────────────────────────
for (const pack of [
  htmlPreview,
  slides,
  poster,
  htmlSite,
  composeImage,
  visualCompile,
  sheetNl,
  listingSheet,
  briefingDeck,
  remakePoster
]) {
  registerSkill({ ...pack, root: pack.id });
}
