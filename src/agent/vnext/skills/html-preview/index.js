/**
 * Skill package: html-preview
 * Folder layout (industry):
 *   SKILL.md              — name/description frontmatter + playbook body
 *   templates/            — reusable assets
 *   scripts/              — reusable helpers
 *   index.js              — package entry for registry
 */

import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';
import { REPORT_HTML } from './templates/reportHtml.js';
import { fillTemplateSource } from './scripts/fillTemplateSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'html-preview';

export const skill = {
  id: skillId,
  name: meta.name || 'HTML Preview',
  description:
    meta.description ||
    'User wants a crafted HTML page under /artifacts that should open for visual preview.',
  instructions: body,
  libraries: (meta.libraries || '')
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean),
  /** Logical paths → text content (for model + future run virtual files) */
  resources: {
    'templates/report.html': REPORT_HTML,
    'scripts/fillTemplate.js': fillTemplateSource
  },
  templates: {
    report: REPORT_HTML
  }
};

export default skill;
