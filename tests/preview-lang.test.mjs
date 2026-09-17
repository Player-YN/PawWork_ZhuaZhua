import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolvePreviewLang } from '../src/preview/previewLang.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('preview lang: query wins; hardcoded zh-CN is ignored; en is reachable', () => {
  assert.equal(
    resolvePreviewLang({ query: 'en', documentLang: 'zh-CN', navigatorLang: 'zh-CN' }),
    'en'
  );
  assert.equal(
    resolvePreviewLang({ query: 'zh', documentLang: 'en', navigatorLang: 'en-US' }),
    'zh'
  );
  assert.equal(
    resolvePreviewLang({ query: '', documentLang: 'zh-CN', navigatorLang: 'en-US' }),
    'en'
  );
  assert.equal(
    resolvePreviewLang({ query: '', documentLang: 'zh-CN', navigatorLang: '' }),
    'en'
  );
  const src = readFileSync(join(root, 'src/preview/artifactPreview.js'), 'utf8');
  assert.match(src, /resolvePreviewLang/);
  assert.equal(/document\.documentElement\.lang \|\| navigator/.test(src), false);
  const bg = readFileSync(join(root, 'src/background.js'), 'utf8');
  assert.match(bg, /q\.set\('lang'/);
});
