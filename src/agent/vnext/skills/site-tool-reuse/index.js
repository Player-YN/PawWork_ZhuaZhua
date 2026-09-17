import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'site-tool-reuse';

export const skill = {
  id: skillId,
  name: meta.name || 'Site Tool Reuse',
  description: meta.description,
  instructions: body,
  libraries: [],
  resources: {},
  templates: {}
};

export default skill;
