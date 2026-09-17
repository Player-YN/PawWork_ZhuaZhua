# src/preview — 画布与预览标签

扩展页，由 SW 打开（`chrome.runtime.getURL('src/preview/…')`）。**不是** content script，也不是 agent 循环。读写经 `sheet_host` / artifact RPC 回到 SW → offscreen store。`canvas_host` 对已删除的 Design/Slides 返回 `NO_CANVAS`。

分类器：`agent/vnext/sessionWorkspace/openClassify.js` 的 `previewEntryForKind` / `previewEntryForItem`。

## 页面

| 页 | 引擎 | 打开时机 |
|----|------|----------|
| `sheet.html` | Univer Sheets（`vendor/sheet-runtime.*`） | csv / tsv / xlsx / json-workbook |
| `docs.html` | Univer Docs（`vendor/docs-runtime.*`） | docx / json-document / html-document |
| `site.html` | 自有 HTML 运行时 | `data-paw-kind=site` |
| `artifactPreview.html` | 通用查看 | 图片 / PDF 只读重建 / 其它二进制卡片 / 普通 HTML |
| `print.html` | 系统打印 | PDF 交付：`delivery: browser_print` → Save as PDF |
| `preview.html` | 旧草稿预览 | 遗留 `open_draft_preview` |

共享：`workLock.js`（**同一 session** 在预览画布上的执行中 UI 锁，`execution-start/end` →「编排中」；**不是** SW 里跨 session 的 live-page tab 租约 / `TAB_LEASED`）、`officeHelp*` / `officeShortcuts` / `officeSelBubble`、`durableImage.js`、`host-bar.css`。表编解码：`sheetCodec.js` / `sheetModel.js`（agent office 工具也会 import）。

## Vendor

`vendor/sheet-runtime.*` · `docs-runtime.*` · `fflate.js` **已跟踪**，unpacked 加载需要。不要在扩展页直接 `import` `@univerjs/*`。不要引入 `@univerjs-pro/*`。历史打包命令记在 `vendor/README.md`；本仓库日常无 `package.json`。

## 宿主约定

- Query：`sessionId`、`artifactId`。页 load 后发 `sheet_tab_ready` / `html_tab_ready` / `docs_tab_ready`。
- 同一 session+artifact 复用标签（SW 里 `sheetTabByKey` / `htmlTabByKey`）。
- `artifactPreview` 对 PDF/raster：显示可以重建，**写回/下载保持原始 bytes**。
