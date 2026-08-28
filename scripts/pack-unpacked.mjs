/**
 * pack:extension — export a clean Chrome unpacked root for load/test.
 * Source of truth remains the git repo. Output: artifacts/unpacked/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outRoot = path.join(root, 'artifacts', 'unpacked');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else if (ent.isFile()) copyFile(s, d);
  }
}

function main() {
  console.log('[pack:extension] build:agent…');
  execSync('npm run build:agent', { cwd: root, stdio: 'inherit' });

  const manifest = path.join(root, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    console.error('[pack:extension] missing manifest.json at repo root');
    process.exit(1);
  }
  const srcDir = path.join(root, 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('[pack:extension] missing src/');
    process.exit(1);
  }

  rmrf(outRoot);
  fs.mkdirSync(outRoot, { recursive: true });
  copyFile(manifest, path.join(outRoot, 'manifest.json'));
  copyDir(srcDir, path.join(outRoot, 'src'));

  for (const extra of ['icons', 'assets']) {
    const p = path.join(root, extra);
    if (fs.existsSync(p)) copyDir(p, path.join(outRoot, extra));
  }

  let n = 0;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else n += 1;
    }
  }
  walk(outRoot);

  // Audit M-7: clean release — never ship node_modules, .git, plan extracts
  const forbidden = ['node_modules', '.git', '_plan_extract'];
  function assertClean(dir, rel = '') {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = ent.name;
      const childRel = rel ? `${rel}/${name}` : name;
      if (forbidden.some((f) => name === f || name.startsWith(f))) {
        console.error(`[pack:extension] FORBIDDEN path in pack: ${childRel}`);
        process.exit(1);
      }
      if (ent.isDirectory()) assertClean(path.join(dir, name), childRel);
    }
  }
  assertClean(outRoot);

  // Must not contain package-lock as runtime dependency of extension
  if (fs.existsSync(path.join(outRoot, 'package.json'))) {
    console.warn('[pack:extension] warning: package.json in unpacked root (unusual)');
  }

  console.log(`[pack:extension] wrote ${n} files → artifacts/unpacked/ (clean gate ok)`);
  console.log(`[pack:extension] Load in Chrome: ${outRoot}`);
}

main();
