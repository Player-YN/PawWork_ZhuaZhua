/**
 * Host-side simulation of messy office sheet jobs.
 * Does not encode any one vendor's column names as product rules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as XLSX from 'xlsx';
import {
  applyCommandsToWorkbookData,
  sheetsToWorkbookData
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';
import { createLiveTabHost } from './liveTabHost.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'office');

function loadFirstSheet(file) {
  const buf = fs.readFileSync(file);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const name = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
  return { name, rows };
}

function runJob(file, cmd) {
  const { name, rows } = loadFirstSheet(file);
  const before = String((rows[1] || [])[cmd.column === 'D' ? 3 : 2] || rows[1]);
  const applied = applyCommandsToWorkbookData(sheetsToWorkbookData([{ name, rows }], path.basename(file), { id: 'sim' }), [
    { op: 'reshapeSplit', sheet: name, ...cmd }
  ]);
  assert.equal(applied.ok, true, applied.error);
  const orig = applied.sheets.find((s) => s.name === name);
  const draft = applied.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  assert.ok(orig && draft, 'draft pair');
  assert.ok(draft.rows.length > orig.rows.length || cmd.mode === 'wrap');
  assert.equal(JSON.stringify(orig.rows[1]), JSON.stringify(rows[1]));
  return { orig, draft, before, applied };
}

function run() {
  execFileSync(process.execPath, [path.join(dir, 'build_office_xlsx.mjs')], { stdio: 'pipe' });

  const hr = runJob(path.join(dir, 'hr-onboarding.xlsx'), {
    column: 'C',
    itemDelim: '；',
    fieldDelim: '/',
    headers: ['姓名', '部门', '工号'],
    mode: 'expand'
  });
  assert.ok(hr.draft.rows.length >= 6);
  assert.equal(String(hr.draft.rows[1][2]).includes('/'), false);
  assert.equal(String(hr.draft.rows[1][2]).trim(), String(hr.draft.rows[1][2]));
  assert.equal(hr.draft.rows[1][2], '陈一');

  const fin = runJob(path.join(dir, 'finance-expense.xlsx'), {
    column: 'D',
    itemDelim: ';',
    fieldDelim: '|',
    headers: ['项目', '金额说明'],
    mode: 'expand'
  });
  assert.ok(fin.draft.rows.length >= 5);

  const wh = runJob(path.join(dir, 'warehouse-outbound.xlsx'), {
    column: 'C',
    itemDelim: '；',
    fieldDelim: '|',
    headers: ['SKU', '名称', '数量'],
    mode: 'expand'
  });
  assert.equal(wh.draft.rows[1][2], 'SKU-11');
  assert.ok(wh.orig.rows[1][2].includes('；'));

  const cs = runJob(path.join(dir, 'cs-tickets.xlsx'), {
    column: 'C',
    itemDelim: ',',
    headers: ['标签'],
    mode: 'expand'
  });
  assert.ok(cs.draft.rows.length >= 5);

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
  const writeA = host.apply([
    { op: 'setValues2d', sheet: '分类A', a1: 'A1', values: [['A'], ['a1']] }
  ]);
  const writeB = host.apply([
    { op: 'setValues2d', sheet: '分类B', a1: 'A1', values: [['B'], ['b1']] }
  ]);
  const writeC = host.apply([
    { op: 'setValues2d', sheet: '分类C', a1: 'A1', values: [['C'], ['c1']] }
  ]);
  assert.equal(writeA.ok && writeB.ok && writeC.ok, true, writeA.error || writeB.error || writeC.error);
  const unitNames = host.unitSheets().map((s) => s.name);
  const persistNames = host.persistSheets().map((s) => s.name);
  const readNames = host.read().map((s) => s.name);
  assert.deepEqual(unitNames, ['原始', '分类A', '分类B', '分类C']);
  assert.deepEqual(persistNames, unitNames);
  assert.deepEqual(readNames, unitNames);
  const orig = host.unitSheets().find((s) => s.name === '原始');
  assert.equal(JSON.stringify(orig.rows), originalJson);
  assert.equal(host.persistSheets().find((s) => s.name === '分类A').rows[1][0], 'a1');
  assert.equal(host.persistSheets().find((s) => s.name === '分类B').rows[1][0], 'b1');
  assert.equal(host.persistSheets().find((s) => s.name === '分类C').rows[1][0], 'c1');
  const unknown = host.apply([
    { op: 'setValues2d', sheet: '幽灵', a1: 'A2', values: [['wipe']] }
  ]);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'NO_SUCH_SHEET');
  assert.equal(JSON.stringify(host.unitSheets().find((s) => s.name === '原始').rows), originalJson);

  console.log('test_sheet_office_sim: ok');
}

run();
