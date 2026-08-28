/**
 * Install local git hooks (auto-push after commit). Works with git worktrees.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const uninstall = process.argv.includes('--uninstall');

function gitDir() {
  const out = execSync('git rev-parse --git-dir', { cwd: root, encoding: 'utf8' }).trim();
  return path.isAbsolute(out) ? out : path.resolve(root, out);
}

const hooksDir = path.join(gitDir(), 'hooks');
const src = path.join(root, 'scripts', 'git-hooks', 'post-commit');
const dest = path.join(hooksDir, 'post-commit');

fs.mkdirSync(hooksDir, { recursive: true });

if (uninstall) {
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  console.log('[hooks] removed post-commit');
  process.exit(0);
}

if (!fs.existsSync(src)) {
  console.error('[hooks] missing', src);
  process.exit(1);
}

let body = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
fs.writeFileSync(dest, body, 'utf8');
try {
  fs.chmodSync(dest, 0o755);
} catch {
  /* Windows */
}

console.log('[hooks] installed post-commit → auto-push to origin after each commit');
console.log('[hooks] skip once: SKIP_AUTO_PUSH=1 git commit ...');
