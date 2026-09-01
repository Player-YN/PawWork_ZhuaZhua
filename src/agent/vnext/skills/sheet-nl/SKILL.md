---
name: Sheet NL
description: User wants to create, edit, fill, format, sort, export CSV, or ask about a live spreadsheet (Excel/csv/xlsx) from selection or chat — like Gemini in Google Sheets. Do NOT trigger for a product-card comparison table (listing-sheet) or a 海报/slides visual (poster / slides).
---

# Sheet NL playbook

The open workbook is fully granted. Cell selection is a **hint**, not a lock. Do not refuse because nothing is selected. CSV-only still uses this playbook (`createWorkbook` or UTF-8 CSV under `/artifacts`).

Ops, snapshot, and `src` aliases (`wi_`, `图片N`) live on the `sheet` tool description — do not restate them.

## When to snapshot → run → write

1. Read `activeWorkbook` in the world snapshot first. Trust `overview.sheets[].rowCount`.
2. If that is enough, skip inspect. More cells: `inspect` `view=workbook` or `view=range` — the range is a **sample**, not the whole table.
3. Bulk over the inspect window (counts, filters, derived columns): `sheet` `act=snapshot` → `run` reads the `/scratch` CSV → `sheet` write onto the live book. `run` stdout is **not** a completed sheet. After run writes JSON, call `sheet` `act=write` `setValues2d` with that path — do not retype cells.

## Selection and honesty

When they say 这里/这块/添加到这里, set `a1` to `overview.selection` (or `selections[0]`). Do not append a new row past the table unless they asked. Empty cells stay empty — do not invent values.

## Verify

Do not claim success unless the tool returned `ok` and `readback`. Quote the **readback A1**. Compare and compute with `setFormula`, not mental math. Web SelectionGroups are a different channel.
