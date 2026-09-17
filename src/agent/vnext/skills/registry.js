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

import { skill as pageRestyle } from './page-restyle/index.js';
import { skill as siteToolReuse } from './site-tool-reuse/index.js';

/** Permanent id aliases so inspect / skillStore overlays keyed by old ids still resolve. */
export const SKILL_ID_ALIASES = Object.freeze({});

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
 * @property {string[]} [resourcePaths] inspect listing when files live on disk
 * @property {string} [packagePrefix] allow inspect of any safe path under this prefix
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
    resourcePaths: Array.isArray(def.resourcePaths) ? def.resourcePaths.slice() : [],
    packagePrefix: String(def.packagePrefix || ''),
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
    resourcePaths: skillResourcePaths(s),
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
 * @param {SkillDef} skill
 * @returns {string[]}
 */
export function skillResourcePaths(skill) {
  if (!skill) return [];
  if (Array.isArray(skill.resourcePaths) && skill.resourcePaths.length) {
    return skill.resourcePaths.slice();
  }
  return Object.keys(skill.resources || {});
}

/**
 * @param {string} raw
 * @returns {string}
 */
function safeSkillRelPath(raw) {
  const n = String(raw || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!n || n.includes('\0')) return '';
  const parts = n.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return '';
  return parts.join('/');
}

/**
 * @param {string} root skill folder id
 * @param {string} rel
 * @returns {Promise<string|null>}
 */
async function readPackagedSkillFile(root, rel) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
  const url = chrome.runtime.getURL(`src/agent/vnext/skills/${root}/${rel}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * @param {string} skillId
 * @param {string} resourcePath logical path e.g. templates/report.html
 * @returns {Promise<string|null>}
 */
export async function loadSkillResource(skillId, resourcePath) {
  const skill = getSkill(skillId);
  if (!skill) return null;
  const rel = safeSkillRelPath(resourcePath);
  if (!rel) return null;
  const packed = skill.resources?.[rel];
  if (packed != null && String(packed) !== '') return String(packed);
  const prefix = String(skill.packagePrefix || '');
  if (prefix && (rel === prefix.replace(/\/$/, '') || rel.startsWith(prefix))) {
    return await readPackagedSkillFile(skill.root || skill.id, rel);
  }
  return packed == null ? null : String(packed);
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
    'If no skill description fits, do not load any skill. Use the machine (inspect / run / action / acquire).',
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
for (const pack of [pageRestyle, siteToolReuse]) {
  registerSkill({ ...pack, root: pack.id });
}
