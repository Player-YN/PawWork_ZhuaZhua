/**
 * Live work-tab host simulation: createSheet must land in the Univer unit
 * and in persisted bytes. Named writes must not fall back to sheets[0].
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCommandsToWorkbookData,
  sheetsToWorkbookData
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';
import { createLiveTabHost } from '../session-workspace/liveTabHost.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const originalRows = Array.from({ length: 101 }, (_, i) =>
  i === 0 ? ['cat', 'sku', 'qty'] : [i <= 40 ? 'A' : i <= 70 ? 'B' : 'C', `s${i}`, i]
);
const originalJson = JSON.stringify(originalRows);
const host = createLiveTabHost([{ name: '原始', rows: originalRows }], 'split.xlsx');

const created = host.apply([
  { op: 'createSheet', name: '分类A' },
  { op: 'createSheet', name: '分类B' },
  { op: 'createSheet', name: '分类C' }
]);
assert.equal(created.ok, true, created.error);
assert.equal(host.paintCount(), 1);
assert.equal(host.autosaveCount(), 1);

const writeA = host.apply([{ op: 'setValues2d', sheet: '分类A', a1: 'A1', values: [['A'], ['a1']] }]);
const writeB = host.apply([{ op: 'setValues2d', sheet: '分类B', a1: 'A1', values: [['B'], ['b1']] }]);
const writeC = host.apply([{ op: 'setValues2d', sheet: '分类C', a1: 'A1', values: [['C'], ['c1']] }]);
assert.equal(writeA.ok && writeB.ok && writeC.ok, true, writeA.error || writeB.error || writeC.error);

const unit = host.unitSheets();
const persisted = host.persistSheets();
const read = host.read();
assert.equal(unit.length, 4);
assert.equal(persisted.length, 4);
assert.equal(read.length, 4);
assert.deepEqual(
  unit.map((s) => s.name),
  ['原始', '分类A', '分类B', '分类C']
);
assert.deepEqual(
  persisted.map((s) => s.name),
  unit.map((s) => s.name)
);
assert.equal(JSON.stringify(unit.find((s) => s.name === '原始').rows), originalJson);
assert.equal(JSON.stringify(persisted.find((s) => s.name === '原始').rows), originalJson);
assert.equal(persisted.find((s) => s.name === '分类A').rows[1][0], 'a1');
assert.equal(persisted.find((s) => s.name === '分类B').rows[1][0], 'b1');
assert.equal(persisted.find((s) => s.name === '分类C').rows[1][0], 'c1');
assert.equal(host.paintCount(), 4);
assert.equal(host.autosaveCount(), 4);

{
  const incremental = createLiveTabHost([{ name: 'S', rows: [['h'], [''], [''], ['']] }], 'live.csv');
  const one = incremental.apply([{ op: 'setRange', a1: 'A2', value: 'one' }]);
  assert.equal(one.ok, true, one.error);
  assert.equal(incremental.paintCount(), 1);
  assert.equal(incremental.autosaveCount(), 1);
  assert.equal(incremental.persistSheets()[0].rows[1][0], 'one');
  const two = incremental.apply([{ op: 'setRange', a1: 'A3', value: 'two' }]);
  assert.equal(two.ok, true, two.error);
  assert.equal(incremental.paintCount(), 2);
  assert.equal(incremental.autosaveCount(), 2);
  assert.equal(incremental.persistSheets()[0].rows[2][0], 'two');
  assert.equal(incremental.persistSheets()[0].rows[1][0], 'one');
  const three = incremental.apply([{ op: 'setRange', a1: 'A4', value: 'three' }]);
  assert.equal(three.ok, true, three.error);
  assert.equal(incremental.paintCount(), 3);
  assert.equal(incremental.autosaveCount(), 3);
  assert.equal(incremental.persistSheets()[0].rows[3][0], 'three');
}

const book = sheetsToWorkbookData([{ name: 'S', rows: [['h'], ['1']] }], 'Book', { id: 'h' });
const missing = applyCommandsToWorkbookData(
  book,
  [{ op: 'setValues2d', sheet: 'Ghost', a1: 'A1', values: [['x']] }],
  { agentWrite: true, inPlace: true }
);
assert.equal(missing.ok, false);
assert.equal(missing.code, 'NO_SUCH_SHEET');
assert.ok(missing.available.includes('S'));
assert.match(String(missing.hint || ''), /createSheet/);

const empty = applyCommandsToWorkbookData(book, [{ op: 'setValues2d', a1: 'A1', values: [] }], {
  agentWrite: true,
  inPlace: true
});
assert.equal(empty.ok, false);
assert.equal(empty.code, 'BAD_INPUT');
assert.match(String(empty.hint || empty.error || ''), /values/);

const sheetJs = fs.readFileSync(path.join(root, 'src/preview/sheet.js'), 'utf8');
assert.match(sheetJs, /function materializeAppliedSheets/);
assert.match(sheetJs, /mergeWorkbookSnapshot/);
assert.match(sheetJs, /persistSnapshot/);
assert.match(sheetJs, /code:\s*snap\.code/);

const applyJs = fs.readFileSync(
  path.join(root, 'src/agent/vnext/sessionWorkspace/sheetApply.js'),
  'utf8'
);
assert.match(applyJs, /NO_SUCH_SHEET/);
assert.match(applyJs, /emptyGridError/);
assert.doesNotMatch(
  applyJs,
  /function pickSheet[\s\S]{0,180}return sheets\[0\]/,
  'named pickSheet must not fall back to sheets[0]'
);

console.log('test_sheet_live_apply: ok');
