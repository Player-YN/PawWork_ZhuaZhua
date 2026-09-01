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

  copyFile(path.join(root, 'LICENSE'), path.join(outRoot, 'LICENSE'));
  copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(outRoot, 'THIRD_PARTY_NOTICES.md'));
  const tldrawLicense = path.join(root, 'notices', 'tldraw-LICENSE.md');
  if (!fs.existsSync(tldrawLicense)) {
    console.error('[pack:extension] missing notices/tldraw-LICENSE.md (verbatim tldraw license)');
    process.exit(1);
  }
  copyFile(tldrawLicense, path.join(outRoot, 'licenses', 'tldraw-LICENSE.md'));

  fs.writeFileSync(
    path.join(outRoot, 'README.md'),
    [
      '# Paw Work — this folder is the Chrome extension',
      '',
      '**Where is this folder?** This README lives inside the folder Chrome must load. Git clone creates `paw-work` under the directory where you ran the command — it is not a fixed Desktop path. If you cloned from your user home, that is `C:\\Users\\yyy\\paw-work`.',
      '',
      'Print the absolute path (run this *inside* this folder):',
      '',
      '```powershell',
      '(Get-Item .).FullName',
      '```',
      '',
      'macOS / Linux: `pwd` or `realpath .`',
      '',
      'Load **this folder** in Chrome. Do not look for a separate `src` tree or run `npm install`.',
      '',
      '1. Open Chrome and go to `chrome://extensions`',
      '2. Turn on **Developer mode** (top-right)',
      '3. Click **Load unpacked**',
      '4. Select **this folder** — the path printed above (it contains `manifest.json`)',
      '',
      'Then turn Paw Mode on, paste a model key, select something on a page, and describe the outcome.',
      '',
      'Updates: clone branch `unpacked` again, or download the [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest).',
      '',
      '---',
      '',
      '# 爪爪 · 这个文件夹就是 Chrome 扩展',
      '',
      '**你现在在哪个文件夹？** 这份 README 就在 Chrome 要加载的文件夹里。克隆会在**你运行命令时的当前目录**下新建 `paw-work`，不是固定到桌面。若在用户主目录跑，就是 `C:\\Users\\yyy\\paw-work`。',
      '',
      '在本文件夹里打开 PowerShell，打印绝对路径：',
      '',
      '```powershell',
      '(Get-Item .).FullName',
      '```',
      '',
      'macOS / Linux：`pwd` 或 `realpath .`',
      '',
      '在 Chrome 里加载 **本文件夹**。不要找开发用的 `src`，也不要 `npm install`。',
      '',
      '1. 打开 Chrome，地址栏进入 `chrome://extensions`',
      '2. 打开右上角 **开发者模式**',
      '3. 点 **加载已解压的扩展程序**',
      '4. 选 **本文件夹** — 上面打印出来的路径（里面有 `manifest.json`）',
      '',
      '然后打开伸爪、填模型密钥、在网页上选一块、说出结果。',
      '',
    ].join('\n'),
    'utf8'
  );

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
