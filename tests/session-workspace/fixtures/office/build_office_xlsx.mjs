/**
 * Build messy office-like xlsx fixtures (synthetic; no vendor/PII).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const dir = path.dirname(fileURLToPath(import.meta.url));

function writeBook(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name: sheetName, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  return file;
}

const hr = writeBook('hr-onboarding.xlsx', [
  {
    name: '入职名单',
    rows: [
      ['批次', '到岗日', '人员信息', '备注'],
      ['  2026-Q3 ', '8/3', '陈一 / HR / E1001； 李二/销售 /E1002', '  双人同批  '],
      ['2026-Q3', '08-03', '王三/仓储/E1003', ''],
      ['', '', '', ''],
      ['2026-Q3', '8/4', '赵四 / 财务 / E1004；钱五/财务/E1005；孙六 / 财务 / E1006', '实习生混编']
    ]
  }
]);

const finance = writeBook('finance-expense.xlsx', [
  {
    name: '报销明细',
    rows: [
      ['日期', '申请人', '科目', '明细'],
      ['2026/8/1', '  周七', '差旅', '高铁 ￥320.00 | 北京-上海 ; 出租车 ￥48 | 虹桥-客户'],
      ['2026-08-02', '吴八', '招待', '晚餐￥1,280.50|客户A'],
      ['8/2', '郑九  ', '办公', '硒鼓 ￥210 | HP ; 纸 ￥36 | A4']
    ]
  }
]);

const warehouse = writeBook('warehouse-outbound.xlsx', [
  {
    name: '出库单',
    rows: [
      ['单号', '仓', '商品包'],
      ['OB-1001', 'A1', 'SKU-11|耳机仓|2；SKU-12|充电线|3'],
      ['OB-1002', 'B2', 'SKU-21|支架'],
      ['OB-1003', 'A1', 'SKU-31|保护壳|1；SKU-32|贴膜|10；SKU-33|清洁套装|1']
    ]
  }
]);

const tickets = writeBook('cs-tickets.xlsx', [
  {
    name: '工单导出',
    rows: [
      ['id', '状态', '标签'],
      ['T-01', ' Open ', '登录, 卡顿,  iOS'],
      ['T-02', 'pending', '退款；发票'],
      ['T-03', 'CLOSED', '物流,破损']
    ]
  }
]);

console.log(
  JSON.stringify(
    {
      hr,
      finance,
      warehouse,
      tickets
    },
    null,
    2
  )
);
