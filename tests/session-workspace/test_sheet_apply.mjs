import assert from 'node:assert/strict';
import {
  applyCommandsToWorkbookData,
  capRangeRead,
  colToIndex,
  discardDraftSheet,
  dropSelection,
  fillMissingWriteTargets,
  normalizeA1,
  normalizeSelections,
  overviewFromSheets,
  replaceSheetSelections,
  retargetAppendWrites,
  retargetDrawingCommands,
  selectionKey,
  unionSelections,
  dirtyRangesFromApplied,
  draftNameFor,
  ensureDraftSheet,
  indexToCol,
  mergeDraftIntoOriginal,
  mergeSheetsForRead,
  overviewFromWorkbookData,
  parseA1,
  readRangeFromSheets,
  rewriteCommandsToDraft,
  sheetsToWorkbookData,
  normalizeCommands,
  classifySheetImageSrc,
  inspectSheetSelection,
  interceptThenApply,
  snapshotSheetRange,
  compactSheetList
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';
import {
  appendCommandLog,
  beforeCommandShouldCancel,
  evaluateBeforeCommand,
  pastePayloadAllowed,
  sheetCommandGuardContext,
  shouldReinsertXlsxImages
} from '../../src/preview/sheetModel.js';

function run() {
  assert.equal(indexToCol(0), 'A');
  assert.equal(indexToCol(25), 'Z');
  assert.equal(indexToCol(26), 'AA');
  assert.equal(colToIndex('B'), 1);
  assert.equal(colToIndex('AA'), 26);

  const col = parseA1('Sheet1!B:B');
  assert.equal(col.wholeCol, true);
  assert.equal(col.sc, 1);
  assert.equal(col.sheet, 'Sheet1');

  const a = sheetsToWorkbookData([{ name: 'S', rows: [['x']] }], 'Book');
  const b = sheetsToWorkbookData([{ name: 'S', rows: [['x']] }], 'Book');
  assert.notEqual(a.id, 'paw-workbook');
  assert.notEqual(b.id, 'paw-workbook');
  assert.notEqual(a.id, b.id);
  const reused = sheetsToWorkbookData([{ name: 'S', rows: [['x']] }], 'Book', { id: a.id });
  assert.equal(reused.id, a.id);

  const data0 = sheetsToWorkbookData(
    [
      {
        name: 'S',
        rows: [
          ['sku', 'price', 'qty'],
          ['A', 10, 2],
          ['B', 20, 1]
        ]
      }
    ],
    'Book',
    { id: 'unit-s' }
  );
  const ov = overviewFromWorkbookData(data0);
  assert.equal(ov.sheets[0].headers[0], 'sku');
  assert.equal(ov.sheets[0].columnCount, 3);

  const filled = applyCommandsToWorkbookData(
    data0,
    [{ op: 'setRange', a1: 'B:B', value: 0.15 }],
    { agentWrite: false }
  );
  assert.equal(filled.sheets[0].rows[0][1], 'price');
  assert.equal(filled.sheets[0].rows[1][1], 0.15);
  assert.equal(filled.sheets[0].rows[2][1], 0.15);
  assert.equal(filled.sheets[0].rows[1][0], 'A');
  assert.ok(filled.readback.values.length >= 1);
  assert.equal(filled.data.id, 'unit-s');

  const created = applyCommandsToWorkbookData(
    sheetsToWorkbookData([{ name: 'Sheet1', rows: [] }], 'Book', { id: 'unit-new' }),
    [
      {
        op: 'createWorkbook',
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
    ],
    { agentWrite: false }
  );
  assert.equal(created.sheets[0].name, '预算');
  assert.equal(created.sheets[0].rows[1][3], '=B2-C2');

  const sorted = applyCommandsToWorkbookData(data0, [{ op: 'sort', a1: 'A1', column: 1, hasHeader: true }], {
    agentWrite: false
  });
  assert.equal(sorted.sheets[0].rows[1][0], 'A');
  assert.equal(sorted.sheets[0].rows[2][1], 20);

  const inserted = applyCommandsToWorkbookData(data0, [{ op: 'insertCol', index: 1, count: 1 }], {
    agentWrite: false
  });
  assert.equal(inserted.sheets[0].rows[0][2], 'price');

  const range = readRangeFromSheets(filled.sheets, 'A2:A3', 'S');
  assert.deepEqual(range.values, [['A'], ['B']]);

  const createdSheet = applyCommandsToWorkbookData(data0, [{ op: 'createSheet', name: 'Extra' }], {
    agentWrite: false
  });
  assert.equal(createdSheet.readback.sheet, 'Extra');

  const durable = {
    name: 'S',
    rows: Array.from({ length: 101 }, (_, i) => [i === 0 ? 'h' : `r${i}`])
  };
  const liveShort = {
    name: 'S',
    rows: Array.from({ length: 51 }, (_, i) => [i === 0 ? 'h' : i === 1 ? 'edited' : `r${i}`])
  };
  const mergedRead = mergeSheetsForRead([durable], [liveShort]);
  assert.equal(mergedRead[0].rows.length, 101);
  assert.equal(mergedRead[0].rows[1][0], 'edited');
  assert.equal(mergedRead[0].rows[100][0], 'r100');

  const many = {
    name: 'S',
    rows: Array.from({ length: 101 }, (_, i) => (i === 0 ? ['h1', 'h2', 'h3', 'h4'] : [i, 'x', 'y', 'z'.repeat(200)]))
  };
  const capped = capRangeRead([many], 'A1:D101', 'S');
  assert.equal(capped.values.length, 30);
  assert.equal(capped.truncated, true);
  assert.ok(capped.next);
  assert.ok(String(capped.values[1][3]).endsWith('…'));

  const dataMany = sheetsToWorkbookData([many], 'Book');
  const ins = inspectSheetSelection(dataMany, 'A1:D101', 'S');
  assert.equal(ins.truncated, true);
  assert.ok(ins.next);
  assert.equal(ins.sheetRowCount, 101);
  assert.equal(ins.values.length, 30);
  assert.equal(ins.requested, 'A1:D101');
  assert.notEqual(ins.a1, ins.requested);
  assert.match(String(ins.note || ''), /snapshot/);

  const snapOk = snapshotSheetRange(dataMany, '', 'S');
  assert.equal(snapOk.ok, true, snapOk.error);
  assert.equal(snapOk.rowCount, 101);
  assert.equal(snapOk.sheetRowCount, 101);
  assert.equal(snapOk.values.length, 101);
  assert.equal(snapOk.headers[0], 'h1');

  const tooBig = snapshotSheetRange(dataMany, 'A1:D101', 'S', { maxRows: 50 });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.code, 'SNAPSHOT_TOO_LARGE');
  assert.equal(tooBig.rowCount, 101);
  assert.equal(tooBig.values, undefined);

  const compact = compactSheetList(overviewFromWorkbookData(dataMany));
  assert.deepEqual(compact, [{ name: 'S', rowCount: 101 }]);

  const src = {
    name: 'S',
    rows: [
      ['dir', 'topic', 'body', 'pack'],
      ['g1', 't1', 'c1', 'S1|H1|N1']
    ]
  };
  const dataS = sheetsToWorkbookData([src], 'Book', { id: 'unit-draft' });
  const ensured2 = ensureDraftSheet([src], 'S');
  assert.equal(draftNameFor('S'), 'S（草稿）');
  assert.equal(ensured2.draftName, 'S（草稿）');
  assert.equal(ensured2.sheets.length, 2);
  assert.deepEqual(ensured2.sheets[1].rows[1][3], 'S1|H1|N1');

  const rewritten = rewriteCommandsToDraft(
    [{ op: 'setValues2d', sheet: 'S', a1: 'D2', values: [['x']] }],
    ensured2.draftName
  );
  assert.equal(rewritten[0].sheet, 'S（草稿）');

  const applied = applyCommandsToWorkbookData(dataS, rewritten);
  const orig = applied.sheets.find((s) => s.name === 'S');
  const draft = applied.sheets.find((s) => s.name === 'S（草稿）');
  assert.equal(orig.rows[1][3], 'S1|H1|N1');
  assert.equal(draft.rows[1][3], 'x');
  assert.equal(applied.readback.sheet, 'S（草稿）');

  const invented = applyCommandsToWorkbookData(dataS, [
    { op: 'createSheet', name: 'S_明细' },
    { op: 'setValues2d', sheet: 'S_明细', a1: 'D2', values: [['z']] }
  ]);
  assert.equal(invented.sheets.filter((s) => s.name === 'S' || s.name === 'S（草稿）').length, 2);
  assert.equal(invented.sheets.some((s) => s.name.includes('明细')), false);
  assert.equal(invented.sheets.find((s) => s.name === 'S').rows[1][3], 'S1|H1|N1');
  assert.equal(invented.sheets.find((s) => s.name === 'S（草稿）').rows[1][3], 'z');

  const viaOriginalName = applyCommandsToWorkbookData(dataS, [
    { op: 'setValues2d', sheet: 'S', a1: 'D2', values: [['y']] }
  ]);
  const secondTouch = applyCommandsToWorkbookData(viaOriginalName.data, [
    { op: 'setValues2d', sheet: 'S', a1: 'D2', values: [['z']] }
  ]);
  const dirtySmall = dirtyRangesFromApplied(secondTouch.applied, 'S（草稿）');
  assert.equal(dirtySmall.mode, 'ranges');
  assert.equal(dirtySmall.marks[0].a1, 'D2');
  assert.equal(secondTouch.sheets.find((s) => s.name === 'S').rows[1][3], 'S1|H1|N1');
  const dirtySplit = dirtyRangesFromApplied(
    [{ op: 'reshapeSplit', sheet: 'S（草稿）', a1: 'A1:F8' }],
    'S（草稿）'
  );
  assert.equal(dirtySplit.mode, 'full');
  assert.equal(viaOriginalName.sheets.find((s) => s.name === 'S').rows[1][3], 'S1|H1|N1');
  assert.equal(viaOriginalName.sheets.find((s) => s.name === 'S（草稿）').rows[1][3], 'y');

  const merged = mergeDraftIntoOriginal(viaOriginalName.sheets, 'S');
  assert.equal(merged.sheets.length, 1);
  assert.equal(merged.sheets[0].rows[1][3], 'y');

  const discarded = discardDraftSheet(ensured2.sheets, 'S');
  assert.equal(discarded.sheets.length, 1);
  assert.equal(discarded.sheets[0].rows[1][3], 'S1|H1|N1');

  const splitSrc = sheetsToWorkbookData(
    [
      {
        name: 'S',
        rows: [
          ['cat', 'title', 'blob', 'pack'],
          ['g1', 't1', 'c1', 'a1|h1|n1;a2|h2|n2'],
          ['g2', 't2', 'c2', 'b1|n-only'],
          ['g3', 't3', 'c3', '']
        ]
      }
    ],
    'Book',
    { id: 'unit-split' }
  );
  const missing = applyCommandsToWorkbookData(splitSrc, [{ op: 'reshapeSplit', column: 'D' }]);
  assert.equal(missing.ok, false);
  assert.match(String(missing.error), /itemDelim/);

  const split = applyCommandsToWorkbookData(splitSrc, [
    {
      op: 'reshapeSplit',
      sheet: 'S',
      column: 'D',
      itemDelim: ';',
      fieldDelim: '|',
      headers: ['id', 'mid', 'name'],
      mode: 'expand'
    }
  ]);
  const splitDraft = split.sheets.find((s) => s.name === 'S（草稿）');
  const splitOrig = split.sheets.find((s) => s.name === 'S');
  assert.deepEqual(splitDraft.rows[0].slice(0, 6), ['cat', 'title', 'blob', 'id', 'mid', 'name']);
  assert.equal(splitDraft.rows.length, 1 + 2 + 1 + 1);
  assert.equal(splitDraft.rows[1][3], 'a1');
  assert.equal(splitDraft.rows[2][5], 'n2');
  assert.equal(splitDraft.rows[3][4], '');
  assert.equal(splitDraft.rows[3][5], 'n-only');
  assert.equal(String(splitDraft.rows[1][3]).includes('\n'), false);
  assert.equal(String(splitOrig.rows[1][3]).includes(';'), true);

  const grid = applyCommandsToWorkbookData(dataS, [
    { op: 'applyGrid', sheet: 'S', a1: 'A2', values: [['g', 't', 'c', 'z']] }
  ]);
  assert.equal(grid.sheets.find((s) => s.name === 'S').rows[1][0], 'g1');
  assert.equal(grid.sheets.find((s) => s.name === 'S（草稿）').rows[1][3], 'z');

  assert.equal(normalizeA1('B2:A1'), 'A1:B2');
  assert.equal(selectionKey({ sheet: 'S', a1: 'A1:A1' }), 'S!A1');
  const multi = normalizeSelections([
    { sheet: 'A', a1: 'B2' },
    { sheet: 'A', a1: 'B2' },
    { sheet: 'B', a1: 'C:C' }
  ]);
  assert.equal(multi.length, 2);
  assert.equal(multi[1].a1, 'C:C');
  const kept = replaceSheetSelections(
    [{ sheet: 'A', a1: 'A1' }, { sheet: 'B', a1: 'B1' }],
    [{ sheet: 'B', a1: 'D1:D4' }],
    'B'
  );
  assert.equal(kept.length, 2);
  assert.ok(kept.some((s) => s.sheet === 'A' && s.a1 === 'A1'));
  assert.ok(kept.some((s) => s.sheet === 'B' && s.a1 === 'D1:D4'));
  const uni = unionSelections([{ sheet: 'A', a1: 'A1' }], [{ sheet: 'C', a1: 'C1' }]);
  assert.equal(uni.length, 2);
  const dropped = dropSelection(uni, { sheet: 'A', a1: 'A1' });
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].sheet, 'C');
  const ovSel = overviewFromSheets([{ name: 'A', rows: [['h']] }], {
    selections: [{ sheet: 'A', a1: 'A1' }, { sheet: 'B', a1: 'B2' }]
  });
  assert.equal(ovSel.selections.length, 2);
  assert.equal(ovSel.selection.sheet, 'A');

  const tall = {
    name: '好物内容生产表',
    rows: Array.from({ length: 101 }, (_, i) =>
      i === 0
        ? ['方向', '主題', '內容', '包装', 'E', 'F', 'G', 'H']
        : i === 57
          ? ['會員・TOMO・App', 't58', 'c58', 'p58', 'e58', 'f58', 'g58', 'h58']
          : [`r${i}`, '', '', '', '', '', '', '']
    )
  };
  const mid = capRangeRead([tall], 'A58:E58', tall.name);
  assert.equal(mid.a1, 'A58:E58');
  assert.equal(mid.requested, 'A58:E58');
  assert.equal(mid.values.length, 1);
  assert.equal(mid.values[0][0], '會員・TOMO・App');
  assert.notEqual(mid.a1, 'A1');

  const filledHere = fillMissingWriteTargets(
    [{ op: 'setRange', value: 'ABCD' }],
    [{ sheet: tall.name, a1: 'G60' }]
  );
  assert.equal(filledHere[0].a1, 'G60');
  assert.equal(filledHere[0].sheet, tall.name);

  const retargeted = retargetAppendWrites(
    [{ op: 'setValues2d', a1: 'A102:D102', values: [['x', 'y', 'z', 'w']] }],
    [tall],
    [{ sheet: tall.name, a1: 'H58' }]
  );
  assert.equal(retargeted[0].a1, 'H58');
  assert.equal(retargeted[0].sheet, tall.name);
  assert.ok(retargeted[0].retargetedFrom);

  const keepMid = retargetAppendWrites(
    [{ op: 'setRange', a1: 'C58', value: 'desc' }],
    [tall],
    [{ sheet: tall.name, a1: 'F58' }]
  );
  assert.equal(keepMid[0].a1, 'C58');

  const dataTall = sheetsToWorkbookData([tall], 'Book', { id: 'unit-here' });
  const hereWrite = applyCommandsToWorkbookData(
    dataTall,
    [{ op: 'setRange', a1: 'A102', value: 'HERE' }],
    { selections: [{ sheet: tall.name, a1: 'H58' }] }
  );
  const hereDraft = hereWrite.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  const hereOrig = hereWrite.sheets.find((s) => s.name === tall.name);
  assert.equal(hereOrig.rows[57][7], 'h58');
  assert.equal(hereDraft.rows[57][7], 'HERE');
  assert.notEqual(hereDraft.rows[101]?.[0], 'HERE');
  assert.equal(hereWrite.readback.a1, 'H58');

  const imgWrite = applyCommandsToWorkbookData(dataTall, [
    { op: 'insertCellImage', a1: 'H58', src: 'https://example.com/cover.jpg' }
  ]);
  const imgDraft = imgWrite.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  assert.match(String(imgDraft.rows[57][7]), /🖼|image:/);
  assert.equal(imgWrite.applied.some((a) => a.drawing === 'cell'), true);
  assert.match(String(imgWrite.applied.find((a) => a.drawing)?.warning || ''), /xlsx/);
  const liveDraw = retargetDrawingCommands(
    [{ op: 'insertCellImage', sheet: tall.name, a1: 'H58', src: 'https://example.com/cover.jpg' }],
    imgWrite.draft.sheet
  );
  assert.equal(liveDraw[0].sheet, imgWrite.draft.sheet);
  assert.equal(liveDraw[0].sheet, draftNameFor(tall.name));
  assert.notEqual(liveDraw[0].sheet, tall.name);

  const aliased = normalizeCommands([
    { command: 'insertCellImage', a1: 'T30', src: 'wi_mt78h1iz_04vyzjtb', sheet: '好物内容生产表' }
  ]);
  assert.equal(aliased.length, 1);
  assert.equal(aliased[0].op, 'insertCellImage');
  assert.equal(classifySheetImageSrc('wi_mt78h1iz_04vyzjtb').kind, 'webItem');
  assert.equal(classifySheetImageSrc('图片2').kind, 'handle');
  assert.equal(classifySheetImageSrc('data:image/png;base64,QQ==').kind, 'dataUrl');
  const aliasWrite = applyCommandsToWorkbookData(dataTall, [
    { command: 'insertCellImage', a1: 'T30', src: 'data:image/png;base64,QQ==' }
  ]);
  assert.equal(aliasWrite.ok, true);
  assert.ok(aliasWrite.applied.some((a) => a.op === 'insertCellImage' && a.a1 === 'T30'));
  const aliasDraft = aliasWrite.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  assert.equal(aliasDraft.rows[29][19], '🖼');

  const liveWrite = applyCommandsToWorkbookData(
    dataTall,
    [{ op: 'setRange', a1: 'H58', value: 'HERE' }],
    { inPlace: true }
  );
  assert.equal(liveWrite.draft?.inPlace, true);
  assert.equal(liveWrite.draft?.sheet, tall.name);
  assert.equal(
    liveWrite.sheets.some((s) => String(s.name).endsWith('（草稿）')),
    false
  );
  const liveOrig = liveWrite.sheets.find((s) => s.name === tall.name);
  assert.equal(liveOrig.rows[57][7], 'HERE');

  const missingA1 = applyCommandsToWorkbookData(
    dataTall,
    [{ op: 'setRange', value: 'ABCD' }],
    { selections: [{ sheet: tall.name, a1: 'G60' }] }
  );
  const gDraft = missingA1.sheets.find((s) => String(s.name).endsWith('（草稿）'));
  assert.equal(gDraft.rows[59][6], 'ABCD');
  assert.equal(missingA1.readback.a1, 'G60');

  data0.sheets['sheet-0'].mergeData = [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 }];
  data0.sheets['sheet-0'].freeze = { ySplit: 1 };
  data0.sheets['sheet-0'].dataValidation = [
    { ranges: [{ startRow: 1, startColumn: 1, endRow: 1, endColumn: 1 }], type: 'whole', formula1: '1' }
  ];
  data0.sheets['sheet-0'].cellData[1][1].s = { n: '0%' };
  const keptModel = applyCommandsToWorkbookData(data0, [{ op: 'setRange', a1: 'C2', value: 99 }], {
    agentWrite: false
  });
  assert.deepEqual(keptModel.data.sheets['sheet-0'].mergeData, data0.sheets['sheet-0'].mergeData);
  assert.equal(keptModel.data.sheets['sheet-0'].freeze.ySplit, 1);
  assert.equal(keptModel.data.sheets['sheet-0'].dataValidation[0].type, 'whole');
  const sel = inspectSheetSelection(keptModel.data, 'B2', 'S');
  assert.equal(sel.sheet, 'S');
  assert.equal(sel.cells[0].validation.type, 'whole');
  assert.equal(sel.cells[0].numfmt, '0%');
  const headerOnly = inspectSheetSelection(dataTall, 'A1:H1', tall.name);
  assert.equal(headerOnly.values.length, 1);
  assert.equal(JSON.stringify(headerOnly).includes('HERE'), false);
  assert.equal(JSON.stringify(headerOnly).includes('t58'), false);

  assert.equal(beforeCommandShouldCancel({ id: 'sheet.command.set-range-values' }, { readOnly: true }).cancel, true);
  assert.equal(beforeCommandShouldCancel({ id: 'scroll' }, { readOnly: true }).cancel, false);
  assert.equal(
    beforeCommandShouldCancel({ id: 'sheet.command.set-range-values' }, { applying: true, userOrigin: true }).cancel,
    true
  );
  const logged = appendCommandLog([], { id: 'sheet.command.set-range-values', params: { a1: 'A1' } });
  assert.equal(logged.length, 1);
  assert.equal(appendCommandLog(logged, { id: 'scroll' }).length, 1);
  assert.equal(pastePayloadAllowed('<script>alert(1)</script>'), false);
  assert.equal(pastePayloadAllowed('plain 12'), true);

  const realEv = { id: 'sheet.command.set-range-values', type: 2, params: {}, options: {} };
  const hostCtx = sheetCommandGuardContext(realEv, { applying: true });
  assert.equal(hostCtx.applying, true);
  assert.equal(hostCtx.userOrigin, true);
  assert.equal(beforeCommandShouldCancel(realEv, hostCtx).cancel, true);
  const gated = interceptThenApply(
    data0,
    [{ op: 'setRange', a1: 'A2', value: 'MUTATED' }],
    realEv,
    { applying: true },
    { agentWrite: false }
  );
  assert.equal(gated.cancelled, true);
  assert.equal(gated.sheets[0].rows[1][0], 'A');
  const agentEv = {
    id: 'sheet.command.set-range-values',
    type: 2,
    params: {},
    options: { fromAgent: true }
  };
  const agentCtx = sheetCommandGuardContext(agentEv, { applying: true });
  assert.equal(agentCtx.userOrigin, false);
  assert.equal(beforeCommandShouldCancel(agentEv, agentCtx).cancel, false);
  const allowed = interceptThenApply(
    data0,
    [{ op: 'setRange', a1: 'A2', value: 'OK' }],
    agentEv,
    { applying: true },
    { agentWrite: false }
  );
  assert.equal(allowed.cancelled, false);
  assert.equal(allowed.sheets[0].rows[1][0], 'OK');
  const idleEv = { id: 'sheet.command.set-range-values', type: 2, params: {}, options: {} };
  assert.equal(evaluateBeforeCommand(idleEv, { applying: false }).cancel, false);
  const idle = interceptThenApply(
    data0,
    [{ op: 'setRange', a1: 'A2', value: 'USER' }],
    idleEv,
    { applying: false },
    { agentWrite: false }
  );
  assert.equal(idle.cancelled, false);
  assert.equal(idle.sheets[0].rows[1][0], 'USER');
  assert.equal(shouldReinsertXlsxImages({ sheets: { a: {} } }), true);
  assert.equal(shouldReinsertXlsxImages(null), true);
  assert.equal(
    shouldReinsertXlsxImages({
      sheets: {
        a: { cellData: { 0: { 0: { p: { drawings: { d: { source: 'data:image/png;base64,QQ==' } } } } } } }
      }
    }),
    false
  );
  assert.equal(
    shouldReinsertXlsxImages({
      sheets: {
        a: { cellData: { 0: { 0: { p: { drawings: { d: { source: 'blob:http://x/1' } } } } } } }
      }
    }),
    true
  );

  const missingNamed = applyCommandsToWorkbookData(
    data0,
    [{ op: 'setValues2d', sheet: 'NoSuch', a1: 'A1', values: [['x']] }],
    { agentWrite: true, inPlace: true }
  );
  assert.equal(missingNamed.ok, false);
  assert.equal(missingNamed.code, 'NO_SUCH_SHEET');
  assert.ok(Array.isArray(missingNamed.available) && missingNamed.available.includes('S'));
  assert.match(String(missingNamed.hint || ''), /createSheet/);
  assert.equal(missingNamed.sheets.find((s) => s.name === 'S').rows[1][0], 'A');

  const emptyGrid = applyCommandsToWorkbookData(
    data0,
    [{ op: 'setValues2d', sheet: 'S', a1: 'A1', values: [] }],
    { agentWrite: true, inPlace: true }
  );
  assert.equal(emptyGrid.ok, false);
  assert.equal(emptyGrid.code, 'BAD_INPUT');
  assert.match(String(emptyGrid.hint || emptyGrid.error || ''), /values/);

  const emptyApplyGrid = applyCommandsToWorkbookData(
    data0,
    [{ op: 'applyGrid', a1: 'A1' }],
    { agentWrite: true, inPlace: true }
  );
  assert.equal(emptyApplyGrid.ok, false);
  assert.equal(emptyApplyGrid.code, 'BAD_INPUT');

  const unnamedKeepsActive = applyCommandsToWorkbookData(
    data0,
    [{ op: 'setValues2d', a1: 'A1', values: [['kept']] }],
    { agentWrite: true, inPlace: true }
  );
  assert.equal(unnamedKeepsActive.ok, true);
  assert.equal(unnamedKeepsActive.sheets[0].rows[0][0], 'kept');

  console.log('test_sheet_apply: ok');
}

run();
