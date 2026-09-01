import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'listing-sheet';

export const skill = {
  id: skillId,
  name: meta.name || 'Listing Sheet',
  description: meta.description,
  instructions: body
};

export default skill;
