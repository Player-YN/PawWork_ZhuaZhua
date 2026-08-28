import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = fs.readFileSync(path.join(root, 'scripts/sheet-runtime-entry.mjs'), 'utf8');
const vendor = path.join(root, 'src/preview/vendor/sheet-runtime.js');

function run() {
  const need = [
    'preset-sheets-core',
    'preset-sheets-filter',
    'preset-sheets-sort',
    'preset-sheets-conditional-formatting',
    'preset-sheets-data-validation',
    'preset-sheets-hyper-link',
    'preset-sheets-find-replace',
    'preset-sheets-note',
    'preset-sheets-table',
    'preset-sheets-thread-comment',
    'preset-sheets-drawing'
  ];
  for (const id of need) {
    assert.match(entry, new RegExp(id.replace(/-/g, '\\-')), `entry imports ${id}`);
  }
  assert.equal(/from ['"]@univerjs-pro/.test(entry), false);
  assert.ok(fs.existsSync(vendor), 'sheet-runtime.js built');
  const js = fs.readFileSync(vendor, 'utf8');
  assert.ok(js.length > 1_000_000, 'OSS-full bundle is substantial');
  assert.equal(/from ['"]@univerjs-pro|@univerjs-pro\//.test(js), false);
  assert.match(js, /sheets-filter|SheetsFilter/);
  assert.match(js, /sheets-drawing|SheetsDrawing/);
  const docsVendor = path.join(root, 'src/preview/vendor/docs-runtime.js');
  assert.ok(fs.existsSync(docsVendor), 'docs-runtime.js built');
  const docsJs = fs.readFileSync(docsVendor, 'utf8');
  assert.equal(/from ['"]@univerjs-pro|@univerjs-pro\//.test(docsJs), false);
  assert.ok(docsJs.length > 100_000, 'docs OSS bundle present');
  console.log('test_sheet_oss_bundle: ok');
}

run();
