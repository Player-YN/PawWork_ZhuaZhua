/**
 * Explicit Chromium install for visual / extension E2E.
 * Does not run during npm ci, prepare, or baseline unit tests.
 *
 *   npm run playwright:install
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', 'playwright', 'cli.js');
if (!fs.existsSync(cli)) {
  console.error('install-playwright: add the playwright package with npm (devDependency), then retry.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '' }
});
process.exit(result.status || 0);
