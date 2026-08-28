/**
 * Selection suggestion chips: parse + one-shot generateText (not sendMessage).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSelectionSuggestChips,
  selectionSuggestSystem,
  runSelectionSuggest
} from '../../src/agent/vnext/sessionWorkspace/selectionSuggest.js';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';

assert.deepEqual(
  parseSelectionSuggestChips(
    'here\n{"chips":[{"label":"做成对照表","prompt":"把选中的商品卡做成对照表"},{"label":"","prompt":"x"}]}\n'
  ),
  [{ label: '做成对照表', prompt: '把选中的商品卡做成对照表' }]
);
assert.equal(parseSelectionSuggestChips('not json').length, 0);
assert.match(selectionSuggestSystem('zh'), /Chinese/);
assert.match(selectionSuggestSystem('en'), /English/);

const generated = await runSelectionSuggest({
  model: { stub: true },
  selection: { lang: 'zh', counts: { images: 4 } },
  generate: async () => ({
    text: JSON.stringify({
      chips: [
        { label: '对照表', prompt: '把四张商品图做成对照表' },
        { label: '海报', prompt: '做成一张活动海报' }
      ]
    })
  })
});
assert.equal(generated.length, 2);
assert.equal(generated[0].label, '对照表');

const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
assert.equal(typeof svc.suggestSelectionActions, 'function');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serviceSrc = fs.readFileSync(
  path.join(root, 'src/agent/vnext/service/sessionWorkspaceService.js'),
  'utf8'
);
assert.match(serviceSrc, /async suggestSelectionActions/);
assert.doesNotMatch(serviceSrc, /suggestSelectionActions[\s\S]{0,400}sendMessage\(/);

const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
assert.match(side, /workspaceRpc\(\s*['"]suggestSelectionActions['"]/);
assert.match(side, /function inferSelectionHintChips/);
assert.match(side, /function summarizeSelectionForSuggest/);

console.log('selection-suggest: pass');
