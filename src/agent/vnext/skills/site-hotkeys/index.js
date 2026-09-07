import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'site-hotkeys';

export const skill = {
  id: skillId,
  name: meta.name || 'Site Hotkeys',
  description: meta.description,
  instructions: body,
  libraries: [],
  resources: {},
  templates: {}
};

export default skill;
