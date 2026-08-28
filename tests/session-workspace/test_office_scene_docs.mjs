import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyUniverDocCommands,
  toUniverDoc,
  fromUniverDoc
} from '../../src/agent/vnext/sessionWorkspace/docsModel.js';
import { emptyDocSnapshot } from '../../src/agent/vnext/sessionWorkspace/docsApply.js';
import { listCapabilities, invoke } from '../../src/agent/vnext/sessionWorkspace/capabilityCatalog.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { scheduleActiveToolNames } from '../../src/agent/vnext/sessionWorkspace/toolSchedule.js';
import { emptyInventory } from '../../src/agent/vnext/sessionWorkspace/canvasInventory.js';

async function run() {
  const doc = applyUniverDocCommands(emptyDocSnapshot('Note'), [
    { op: 'createDocument', title: 'Note' },
    { op: 'setText', text: 'Hello body' },
    { op: 'insertList', list: 'ul', text: 'Item A' },
    { op: 'insertImage', src: 'https://example.com/a.png' }
  ]);
  assert.equal(doc.ok, true, doc.error);
  const univer = toUniverDoc(doc.snapshot);
  assert.doesNotMatch(univer.body.dataStream, /!\[image\]\(/);
  assert.ok(Object.keys(univer.drawings || {}).length >= 1);
  assert.ok((univer.body.customBlocks || []).length >= 1);
  assert.ok((univer.body.paragraphs || []).some((p) => p.bullet));
  const back = fromUniverDoc(univer);
  assert.ok(back.blocks.some((b) => b.type === 'img' && /a\.png/.test(b.src)));
  assert.ok(back.blocks.some((b) => b.type === 'li'));

  assert.deepEqual(listCapabilities(), []);
  const inv = await invoke({ id: 'canva.generate-design' });
  assert.equal(inv.ok, false);
  const tools = createSessionTools({
    store: { get() { return null; }, has() { return false; }, put() {} },
    execution: { executionId: 'e' },
    fs: { readFileBytes() { return new Uint8Array(); } },
    sessionId: 's'
  });
  const names = scheduleActiveToolNames(emptyInventory());
  assert.equal(names.includes('canva.generate-design'), false);
  assert.equal(Object.keys(tools).includes('generate-design'), false);

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const scan = (dir) => {
    const names = fs.readdirSync(dir, { withFileTypes: true });
    for (const n of names) {
      if (n.name === 'node_modules' || n.name === 'artifacts' || n.name === 'vendor') continue;
      const p = path.join(dir, n.name);
      if (n.isDirectory()) scan(p);
      else if (/\.(js|mjs|md|json)$/.test(n.name) && !n.name.includes('OFFICE_AGENT')) {
        const txt = fs.readFileSync(p, 'utf8');
        assert.doesNotMatch(txt, /@univerjs\/slides/, p);
        assert.doesNotMatch(txt, /@univerjs-pro/, p);
      }
    }
  };
  scan(path.join(root, 'src'));

  console.log('test_office_scene_docs: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
