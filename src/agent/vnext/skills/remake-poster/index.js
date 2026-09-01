import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'remake-poster';

export const skill = {
  id: skillId,
  name: meta.name || 'Remake Poster',
  description: meta.description,
  instructions: body
};

export default skill;
