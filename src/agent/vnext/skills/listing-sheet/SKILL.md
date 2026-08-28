---
name: Listing Sheet
description: User wants selected product cards, catalog rows, or an admin list turned into a live comparison workbook (image, title, price, link). Do NOT trigger for a general spreadsheet edit (sheet-nl) or a 海报 (poster).
---

# Listing → live sheet

Outcome is an **open spreadsheet**, not CSV-as-done and not a poster.

1. `inspect` the bound cards/rows. Do not expand past the selection unless they said 本页全部.
2. Logged-in / SPA lists: **do not** `acquire fetch` instead of inspect. Public pages may fetch only to fill gaps.
3. Load skill `sheet-nl`. `run` `createWorkbook` with columns 主图 | 标题 | 价格 | 来源 | 链接. Empty cells stay empty — do not invent stock or commission.
4. `sheet insertCellImage` with omitted src or `图片N` / `截图N` (a `wi_` web-item id also resolves). If ok:false, the picture is not in the cell.
5. Price column `numberFormat`. Compare with `setFormula`, not mental math.
6. Fine-tune with the `sheet` tool on the open book.
