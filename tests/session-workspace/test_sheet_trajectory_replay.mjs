/**
 * Replay sheet commands from a real session trajectory against the current host.
 * Locks the runtime gaps that run produced (unit id, original mutation, lying readback, inspect dump).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCommandsToWorkbookData,
  capRangeRead,
  sheetsToWorkbookData
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'trajectory-replay',
  'session-1-sheet.json'
);

function packedD(rows) {
  return String((rows[1] || [])[3] || '');
}

function run() {
  const rec = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const srcName = rec.inspect.sheet;
  const srcRows = rec.inspect.values;
  const packed = packedD(srcRows);
  assert.ok(packed.includes('；') || packed.includes('|') || packed.includes('｜'));

  const cap = capRangeRead([{ name: srcName, rows: srcRows }], rec.inspect.a1 || 'A1:D101', srcName);
  assert.equal(cap.truncated, true);
  assert.ok(cap.values.length <= 30);
  assert.ok(cap.next);
  assert.ok(cap.sheetRowCount >= cap.values.length);

  let data = sheetsToWorkbookData([{ name: srcName, rows: srcRows }], 'replay.xlsx', { id: 'paw-art_replay' });

  const snapshots = [];
  for (const write of rec.writes) {
    const applied = applyCommandsToWorkbookData(data, write.commands);
    snapshots.push(applied);
    assert.notEqual(applied.error, '[UniverInstanceService]: cannot create a unit with the same unit id: paw-workbook.');
    assert.equal(applied.ok, true, applied.error);
    data = applied.data;
    const orig = applied.sheets.find((s) => s.name === srcName);
    const draft = applied.sheets.find((s) => String(s.name).endsWith('（草稿）'));
    assert.ok(orig, 'original sheet remains');
    assert.ok(draft, 'writes land on draft');
    assert.equal(draft.name, `${srcName}（草稿）`);
    assert.equal(applied.sheets.filter((s) => String(s.name).endsWith('（草稿）')).length, 1);
    assert.equal(packedD(orig.rows), packed, 'original packed cell unchanged');
    assert.equal(String(packedD(orig.rows)).includes('\n'), false);
    assert.equal(applied.readback.sheet, draft.name);
    assert.ok((applied.readback.values || []).length <= 8, 'apply readback must not echo the full grid');
    assert.equal(applied.draft?.sheet, draft.name);
    assert.equal(applied.draft?.source, srcName);
  }

  const last = snapshots.at(-1);
  const fallback = rec.writes.at(-1).commands[0];
  assert.equal(fallback.a1, 'D2:F26');
  assert.ok(JSON.stringify(fallback.values[0]).includes('\\n') || String(fallback.values[0][0]).includes('\n'));
  const orig = last.sheets.find((s) => s.name === srcName);
  const draft = last.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  assert.equal(packedD(orig.rows), packed);
  assert.ok(String((draft.rows[1] || [])[3] || '').includes('\n') || (draft.rows[1] || [])[3] !== packed);

  const second = rec.writes.find((w) => w.commands[0]?.a1 === 'A51:F105');
  assert.ok(second);
  assert.equal(second.ok, false, 'historical trajectory failed this batch');

  console.log('test_sheet_trajectory_replay: ok');
}

run();
