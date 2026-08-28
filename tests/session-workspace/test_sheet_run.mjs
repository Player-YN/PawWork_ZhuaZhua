import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';

function run() {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-sheet-run';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId });
  const runTool = tools.run;
  const inspectTool = tools.inspect;
  assert.ok(runTool && inspectTool);

  return Promise.resolve()
    .then(() =>
      runTool.execute({
        op: 'sheet',
        commands: [
          {
            op: 'createWorkbook',
            name: 'budget.csv',
            sheets: [
              {
                name: '预算',
                rows: [
                  ['周', '收入', '支出', '结余'],
                  [1, 100, 40, '=B2-C2']
                ]
              }
            ]
          }
        ]
      })
    )
    .then((created) => {
      assert.equal(created.ok, true);
      const id = created.artifact.artifactId;
      return tools.sheet
        .execute({
          act: 'write',
          artifactId: id,
          commands: [{ op: 'setRange', a1: 'B:B', value: 0.15 }]
        })
        .then((edited) => {
          assert.equal(edited.ok, true, edited.error);
          assert.equal(String(edited.readback.values[0][0]), '0.15');
          return inspectTool.execute({ view: 'workbook', artifactId: id });
        })
        .then((ov) => {
          assert.equal(ov.ok, true);
          assert.ok(ov.overview.sheets.some((s) => String(s.headers).includes('周')));
          const orig = ov.overview.sheets.find((s) => !String(s.name).includes('草稿'));
          assert.ok(orig);
          return inspectTool.execute({ view: 'range', artifactId: id, a1: 'A1:Z80' });
        })
        .then((range) => {
          assert.equal(range.ok, true);
          assert.ok(range.values.length <= 30);
          return tools.sheet.execute({
            act: 'write',
            artifactId: id,
            commands: [{ op: 'setRange', a1: 'C2', value: 9 }]
          });
        })
        .then((mixed) => {
          assert.equal(mixed.ok, true, mixed.error);
          assert.equal(String(mixed.readback.values[0][0]), '9');
          return runTool.execute({
            code: 'x'.repeat(8001)
          });
        })
        .then((huge) => {
          assert.equal(huge.ok, false);
          assert.match(String(huge.error), /8000 chars/);
          console.log('test_sheet_run: ok');
        });
    });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
