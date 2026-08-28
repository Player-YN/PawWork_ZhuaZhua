import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'visual-compile';

export const skill = {
  id: skillId,
  name: meta.name || 'Visual Compile',
  description:
    meta.description ||
    'Compile a flatten image into an editable Design/Slides board (independent text + cropped images).',
  instructions: body
};

export default skill;
