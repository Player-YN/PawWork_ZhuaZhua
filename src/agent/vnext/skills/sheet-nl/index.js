import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'sheet-nl';

export const skill = {
  id: skillId,
  name: meta.name || 'Sheet NL',
  description:
    meta.description ||
    'Natural-language create/edit of the live spreadsheet, with or without a cell selection.',
  instructions: body,
  libraries: [],
  resources: {},
  templates: {}
};

export default skill;
