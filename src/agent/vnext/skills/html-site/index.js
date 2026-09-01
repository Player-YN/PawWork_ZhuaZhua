import { parseSkillMd } from '../parseSkillMd.js';
import { SKILL_MD } from './skillSource.js';
import { SITE_HTML } from './templates/siteHtml.js';
import { SITE_MOTION_CAPABILITY } from '../../sessionWorkspace/siteMotionSchema.js';

const { meta, body } = parseSkillMd(SKILL_MD);

export const skillId = 'html-site';

export const skill = {
  id: skillId,
  name: meta.name || 'HTML Site',
  description:
    meta.description ||
    'User wants a real website or landing page they will click-edit as a browser page.',
  instructions: body,
  libraries: [],
  resources: {
    'templates/site.html': SITE_HTML,
    'motion.json': JSON.stringify(SITE_MOTION_CAPABILITY, null, 2)
  },
  templates: {
    site: SITE_HTML
  }
};

export default skill;
