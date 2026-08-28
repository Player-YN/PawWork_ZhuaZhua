import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { workbookFromXlsxBytes } from '../../src/preview/xlsxIngest.js';

const wb0 = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['招聘总人数', 20],
  ['序号', '部门']
]);
ws['A1'].s = { patternType: 'solid', fgColor: { rgb: '6065D6' } };
ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
ws['!cols'] = [{ wpx: 80 }, { wpx: 120 }];
XLSX.utils.book_append_sheet(wb0, ws, '内容页');
const bytes = new Uint8Array(XLSX.write(wb0, { type: 'array', bookType: 'xlsx', cellStyles: true }));

const data = workbookFromXlsxBytes(XLSX, bytes, { id: 'imp-1', name: '招聘' });
assert.equal(data.sheets['sheet-0'].name, '内容页');
assert.equal(data.sheets['sheet-0'].cellData[0][0].v, '招聘总人数');
assert.ok(data.sheets['sheet-0'].mergeData.some((m) => m.startRow === 0 && m.endColumn === 1));

const live = 'C:/Users/yyy/Desktop/公司招聘计划统计表1.xlsx';
if (fs.existsSync(live)) {
  const real = workbookFromXlsxBytes(XLSX, fs.readFileSync(live), { id: 'live' });
  const sh = real.sheets['sheet-0'];
  assert.equal(sh.name, '内容页');
  assert.equal(sh.cellData[4][2].v, '招聘总人数');
  assert.ok(String(sh.cellData[5][2].f || '').includes('SUM'));
  assert.ok(sh.mergeData.length >= 3);
  assert.equal(sh.cellData[8][2].s.bg.rgb, '#6065D6');
  assert.ok(real.sheetOrder.length >= 1);
}

console.log('test_xlsx_ingest: ok');
