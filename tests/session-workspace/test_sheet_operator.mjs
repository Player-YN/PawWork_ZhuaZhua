import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { buildSessionAgentInstructions } from '../../src/agent/vnext/sessionWorkspace/prompt.js';
import { loadSkillInstructions } from '../../src/agent/vnext/skills/registry.js';

function fixtureRows() {
  const rows = [['方向', '主題', '內容', '包装']];
  for (let i = 1; i <= 100; i++) rows.push([`d${i}`, `t${i}`, `c${i}`, `p${i}`]);
  return rows;
}

async function runOnce() {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-sheet-operator';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId });
  const rows = fixtureRows();

  const created = await tools.run.execute({
    op: 'sheet',
    commands: [
      {
        op: 'createWorkbook',
        name: 'yaichi.csv',
        sheets: [{ name: 'Sheet1', rows }]
      }
    ]
  });
  assert.equal(created.ok, true, created.error);
  const artifactId = created.artifact.artifactId;

  const range = await tools.inspect.execute({
    view: 'range',
    artifactId,
    a1: 'A1:D50',
    sheet: 'Sheet1'
  });
  assert.equal(range.ok, true, range.error);
  assert.equal(range.truncated, true);
  assert.ok(range.next, 'inspect sample must expose next');
  assert.equal(range.sheetRowCount, 101);
  assert.equal(range.rowCount, 50);
  assert.ok(range.values.length <= 30, `sample too large: ${range.values.length}`);
  assert.equal(range.requested, 'A1:D50');
  assert.notEqual(range.a1, range.requested);

  const modelOut = tools.inspect.toModelOutput({ output: range });
  assert.equal(modelOut.type, 'json');
  assert.equal(modelOut.value.truncated, true);
  assert.ok(modelOut.value.next);
  assert.equal(modelOut.value.requested, 'A1:D50');
  assert.notEqual(modelOut.value.a1, modelOut.value.requested);
  assert.match(String(modelOut.value.note || ''), /truncated|snapshot/i);

  const snap = await tools.sheet.execute({
    act: 'snapshot',
    artifactId,
    sheet: 'Sheet1'
  });
  assert.equal(snap.ok, true, snap.error);
  assert.equal(snap.act, 'snapshot');
  assert.equal(snap.rowCount, 101);
  assert.equal(snap.sheetRowCount, 101);
  assert.match(String(snap.path || ''), /^\/scratch\/snapshots\/.+\.csv$/);
  assert.equal(snap.values, undefined);
  assert.ok(
    Array.isArray(snap.sheets) && snap.sheets.some((s) => s.name === 'Sheet1' && s.rowCount === 101),
    JSON.stringify(snap.sheets)
  );

  const csv = fs.readFile(snap.path);
  const lines = String(csv).replace(/\r/g, '').split('\n').filter((l) => l.length);
  assert.equal(lines.length, 101, `scratch csv rows ${lines.length}`);
  assert.match(lines[0], /方向/);
  assert.match(lines[100], /d100/);

  const wrote = await tools.sheet.execute({
    act: 'write',
    artifactId,
    commands: [
      {
        op: 'setValues2d',
        sheet: 'Sheet1',
        a1: 'E1',
        values: [['len'], ...rows.slice(1).map((r) => [String(r[2]).length])]
      }
    ]
  });
  assert.equal(wrote.ok, true, wrote.error);
  assert.ok(
    Array.isArray(wrote.sheets) && wrote.sheets.some((s) => s.name === 'Sheet1' && s.rowCount === 101),
    JSON.stringify(wrote.sheets)
  );

  const split = await tools.sheet.execute({
    act: 'write',
    artifactId,
    commands: [
      { op: 'createSheet', name: '统计' },
      {
        op: 'setValues2d',
        sheet: '统计',
        a1: 'A1',
        values: [
          ['项', 'n'],
          ['rows', String(rows.length - 1)]
        ]
      }
    ]
  });
  assert.equal(split.ok, true, split.error);
  const orig = (split.sheets || []).find((s) => s.name === 'Sheet1');
  const neu = (split.sheets || []).find((s) => s.name === '统计');
  assert.ok(orig && neu, JSON.stringify(split.sheets));
  assert.equal(orig.rowCount, 101, JSON.stringify(split.sheets));
  assert.equal(neu.rowCount, 2, JSON.stringify(split.sheets));

  const policy = buildSessionAgentInstructions({
    sessionId,
    inventory: { sheet: [{ artifactId }] }
  });
  assert.doesNotMatch(policy, /act=snapshot/);
  assert.doesNotMatch(policy, /truncated sample/);
  const playbook = loadSkillInstructions('sheet-nl');
  assert.match(String(playbook), /act=snapshot/);
  assert.match(String(playbook), /stdout is \*\*not\*\* a completed sheet/);

  return {
    artifactId,
    inspect: {
      truncated: range.truncated,
      next: range.next,
      requested: range.requested,
      shown: range.a1,
      values: range.values.length,
      sheetRowCount: range.sheetRowCount
    },
    snapshot: {
      path: snap.path,
      rowCount: snap.rowCount,
      csvLines: lines.length,
      sheets: snap.sheets
    },
    write: { sheets: wrote.sheets, dirty: wrote.dirty },
    split: { sheets: split.sheets }
  };
}

async function run() {
  const first = await runOnce();
  const second = await runOnce();
  assert.equal(first.snapshot.rowCount, 101);
  assert.equal(second.snapshot.rowCount, 101);
  assert.equal(first.inspect.sheetRowCount, second.inspect.sheetRowCount);
  assert.equal(first.split.sheets.length, 2);
  assert.equal(second.split.sheets.length, 2);
  console.log('test_sheet_operator: ok');
  return { first, second };
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
