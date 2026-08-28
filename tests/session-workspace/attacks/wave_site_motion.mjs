/**
 * Guest scripts never execute in site srcdoc; packaged motion stays host-owned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSiteHtml } from '../../../src/agent/vnext/sessionWorkspace/siteSanitize.js';
import { annotateSiteMotionBlueprint } from '../../../src/agent/vnext/sessionWorkspace/siteMotionBlueprint.js';
import { SITE_MOTION_CAPABILITY } from '../../../src/agent/vnext/sessionWorkspace/siteMotionSchema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'BREACH'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const siteJs = fs.readFileSync(path.join(root, 'src/preview/site.js'), 'utf8');
const motionJs = fs.readFileSync(path.join(root, 'src/preview/siteMotion.js'), 'utf8');
const fixture = fs.readFileSync(path.join(root, 'tests/session-workspace/fixtures/idea-shell-motion.html'), 'utf8');

record('srcdoc-uses-sanitize', /sanitizeSiteHtml/.test(siteJs));
record('motion-after-srcdoc', /mountSiteMotion/.test(siteJs) && /srcdoc/.test(siteJs));
record('no-eval', !/\beval\s*\(|new\s+Function\b/.test(motionJs));
record('no-chrome-in-motion', !/\bchrome\./.test(motionJs));
record('no-network-in-motion', !/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(motionJs));
record('capability-denies-guest-js', SITE_MOTION_CAPABILITY.guestScripts === false && SITE_MOTION_CAPABILITY.eval === false);

const mapped = annotateSiteMotionBlueprint(fixture);
const safe = sanitizeSiteHtml(mapped.html);
record('scripts-stripped', !/<script\b/i.test(safe) && !/\sonclick=/i.test(safe) && !/javascript:/i.test(safe));
record('css-keyframes-kept', /@keyframes drift/.test(safe));
record('hero-mapped', /data-paw-carousel/.test(mapped.html));
record('unsupported-js-warned', mapped.warnings.some((w) => w.code === 'UNSUPPORTED_GUEST_JS'));
record('webgl-not-claimed', SITE_MOTION_CAPABILITY.unsupported.includes('webgl'));

if (failed) {
  console.error(`WAVE FAILED: wave_site_motion breaches=${failed}`);
  process.exit(1);
}
console.log('wave_site_motion: PASS');
