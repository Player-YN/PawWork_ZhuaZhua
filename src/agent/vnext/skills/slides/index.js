import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'slides';

export const skill = {
  id: skillId,
  name: meta.name || 'Slides',
  description:
    meta.description ||
    'User wants PowerPoint / Google Slides / 幻灯片 as a deck of slide-sized frames.',
  instructions: body,
  libraries: (meta.libraries || '')
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean),
  resources: {},
  templates: {}
};

export default skill;
