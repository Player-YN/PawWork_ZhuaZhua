/**
 * Combined adversarial gate — all waves. Exit non-zero if any wave breaches.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const waves = [
  'wave_sdk_loop.mjs',
  'wave_selection_immutable.mjs',
  'wave1_auth.mjs',
  'wave2_artifact_truth.mjs',
  'wave3_coding_run.mjs',
  'wave4_lifecycle.mjs',
  'wave5_media_acquire.mjs',
  'wave6_sot.mjs',
  'wave7_remaining_audit.mjs',
  'wave8_artifact_rail.mjs',
  'wave9_clarify.mjs',
  'wave10_web_acquire.mjs',
  'wave_canvas_playbook.mjs',
  'wave_site_multiselect.mjs',
  'wave_site_motion.mjs'
];

let failed = 0;
for (const w of waves) {
  const file = path.join(__dirname, w);
  console.log(`\n======== RUN ${w} ========`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    failed += 1;
    console.error(`WAVE FAILED: ${w} exit=${r.status}`);
  }
}

console.log(`\n======== ALL WAVES: failed=${failed}/${waves.length} ========`);
if (failed > 0) process.exit(1);
console.log('ALL ADVERSARIAL WAVES PASS');
