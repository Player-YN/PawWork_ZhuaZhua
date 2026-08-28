/**
 * sync-public — copy a git *tree* into the public clone.
 *
 * PawWork-vnext is private. PawWork_ZhuaZhua is a separate public history
 * (init squash + homepage). Never `git push` private commits there.
 * CWS zip is `npm run pack:extension`, not this script.
 *
 * Default: archive `main` → ../PawWork_ZhuaZhua (tracked files only).
 *
 *   npm run sync:public
 *   npm run sync:public -- --commit --push
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const wantCommit = args.has('--commit');
const wantPush = args.has('--push');
const ref = readFlag('--ref') || 'main';
const dest = path.resolve(readFlag('--dest') || process.env.PAW_PUBLIC_ROOT || path.join(root, '..', 'PawWork_ZhuaZhua'));

function readFlag(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return '';
  return String(process.argv[i + 1] || '').trim();
}

function git(repo, argv, opts = {}) {
  return execFileSync('git', argv, {
    cwd: repo,
    encoding: 'utf8',
    stdio: opts.stdio || ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function die(msg) {
  console.error(`[sync:public] ${msg}`);
  process.exit(1);
}

function walkFiles(dir, rel = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full, childRel));
    else if (ent.isFile() || ent.isSymbolicLink()) out.push(childRel);
  }
  return out;
}

function copyFile(src, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.copyFileSync(src, destFile);
}

if (!fs.existsSync(path.join(dest, '.git'))) {
  die(`public clone not found: ${dest}`);
}

let srcCommon;
let destCommon;
try {
  srcCommon = path.resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  destCommon = path.resolve(dest, git(dest, ['rev-parse', '--git-common-dir']));
} catch (err) {
  die(`git rev-parse failed: ${err?.message || err}`);
}
if (srcCommon === destCommon) {
  die('refusing to sync into the same git repo (would not stay a public-only history)');
}

const destOrigin = git(dest, ['remote', 'get-url', 'origin']);
if (!/PawWork_ZhuaZhua/i.test(destOrigin)) {
  die(`public origin is not PawWork_ZhuaZhua: ${destOrigin}`);
}

const destDirty = git(dest, ['status', '--porcelain']);
if (destDirty) {
  die(`public clone is dirty; commit or stash first:\n${destDirty}`);
}

try {
  git(root, ['rev-parse', '--verify', ref]);
} catch {
  die(`missing ref: ${ref} (merge runtime-vnext → main in Desktop\\PawWork first)`);
}

const sha = git(root, ['rev-parse', '--short', ref]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paw-sync-public-'));
const tarPath = path.join(tmp, 'tree.tar');
const extract = path.join(tmp, 'tree');
fs.mkdirSync(extract);

try {
  execFileSync('git', ['archive', '--format=tar', '-o', tarPath, ref], { cwd: root, stdio: 'inherit' });
  execFileSync('tar', ['-xf', tarPath, '-C', extract], { stdio: 'inherit' });
} catch (err) {
  die(`archive/extract failed: ${err?.message || err}`);
}

const archived = walkFiles(extract);
if (archived.length < 20) {
  die(`archive looked empty (${archived.length} files)`);
}

for (const rel of archived) {
  copyFile(path.join(extract, ...rel.split('/')), path.join(dest, ...rel.split('/')));
}

const destTracked = git(dest, ['ls-files']).split(/\r?\n/).filter(Boolean);
const archivedSet = new Set(archived);
let removed = 0;
for (const rel of destTracked) {
  if (archivedSet.has(rel)) continue;
  const full = path.join(dest, ...rel.split('/'));
  if (fs.existsSync(full)) fs.rmSync(full);
  removed += 1;
}

git(dest, ['add', '-A']);
const after = git(dest, ['status', '--porcelain']);
console.log(`[sync:public] ${ref} ${sha} → ${dest}`);
console.log(`[sync:public] copied ${archived.length} files; pruned ${removed} stale public paths`);

if (!after) {
  console.log('[sync:public] public tree already matches; nothing to commit');
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
}

if (!wantCommit) {
  console.log('[sync:public] working tree updated (no commit). Review, then:');
  console.log(`  git -C "${dest}" commit -m "release: sync ${ref} ${sha}"`);
  console.log(`  git -C "${dest}" push origin HEAD`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
}

const msg = `release: sync ${ref} ${sha}`;
execFileSync('git', ['commit', '-m', msg], {
  cwd: dest,
  stdio: 'inherit',
  env: { ...process.env, SKIP_AUTO_PUSH: '1' },
});

if (wantPush) {
  execFileSync('git', ['push', 'origin', 'HEAD'], { cwd: dest, stdio: 'inherit' });
  console.log('[sync:public] pushed public origin');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`[sync:public] committed ${msg}`);
