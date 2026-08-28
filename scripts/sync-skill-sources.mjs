/**
 * Regenerate skills/<id>/skillSource.js from that folder's SKILL.md so the
 * bundled copy never drifts from the markdown source of truth.
 *
 *   node scripts/sync-skill-sources.mjs html-poster html-deck compose-image
 *   node scripts/sync-skill-sources.mjs            # every skill that has both files
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(root, 'src', 'agent', 'vnext', 'skills');

const requested = process.argv.slice(2);
const ids = requested.length
  ? requested
  : fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

let wrote = 0;
for (const id of ids) {
  const dir = path.join(skillsRoot, id);
  const mdPath = path.join(dir, 'SKILL.md');
  const outPath = path.join(dir, 'skillSource.js');
  if (!fs.existsSync(mdPath) || !fs.existsSync(outPath)) {
    if (requested.length) console.warn(`[skip] ${id}: SKILL.md or skillSource.js missing`);
    continue;
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const body = `// Generated from SKILL.md by scripts/sync-skill-sources.mjs — do not edit by hand.\nexport const SKILL_MD = ${JSON.stringify(md)};\n`;
  fs.writeFileSync(outPath, body);
  wrote += 1;
  console.log(`[sync] ${id}/skillSource.js <- SKILL.md (${md.length} chars)`);
}
console.log(`sync-skill-sources: ${wrote} file(s) written`);
