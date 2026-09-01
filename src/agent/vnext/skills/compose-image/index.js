import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'compose-image';

export const skill = {
  id: skillId,
  name: meta.name || 'Compose Image',
  description:
    meta.description ||
    'User wants selected or attached images composed into one durable picture under /artifacts.',
  instructions: body,
  libraries: [],
  resources: {},
  templates: {}
};

export default skill;
