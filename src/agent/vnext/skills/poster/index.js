import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'poster';

export const skill = {
  id: skillId,
  name: meta.name || 'Poster',
  description:
    meta.description ||
    'User wants a 海报 / flyer / campaign one-pager with independently clickable slots.',
  instructions: body,
  libraries: (meta.libraries || '')
    .split(/[, ]+/)
    .map((s) => s.trim())
    .filter(Boolean),
  resources: {},
  templates: {}
};

export default skill;
