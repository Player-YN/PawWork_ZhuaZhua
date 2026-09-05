# src/preview — 画布与预览标签

扩展页，由 SW 打开（`chrome.runtime.getURL('src/preview/…')`）。**不是** content script，也不是 agent 循环。读写经 `sheet_host` / `canvas_host` / artifact RPC 回到 SW → offscreen store。

分类器：`agent/vnext/sessionWorkspace/openClassify.js` 的 `previewEntryForKind` / `previewEntryForItem`。

## 页面

| 页 | 引擎 | 打开时机 |
|----|------|----------|
| `sheet.html` | Univer Sheets（`vendor/sheet-runtime.*`） | csv / tsv / xlsx / json-workbook |
| `design.html` | tldraw（`vendor/design-runtime.*`） | Paw Canvas JSON；`shell=design` 或 `slides` |
| `docs.html` | Univer Docs（`vendor/docs-runtime.*`） | docx / json-document / html-document |
| `site.html` | 自有 HTML 运行时 | `data-paw-kind=site` |
| `artifactPreview.html` | 通用查看 | 图片 / PDF 只读重建 / 其它二进制卡片 / 普通 HTML |
| `print.html` | 系统打印 | PDF 交付：`delivery: browser_print` → Save as PDF |
| `preview.html` | 旧草稿预览 | 遗留 `open_draft_preview` |

共享：`workLock.js`（会话工作锁）、`officeHelp*` / `officeShortcuts` / `officeSelBubble`、`durableImage.js`、`host-bar.css`。表编解码：`sheetCodec.js` / `sheetModel.js`（agent office 工具也会 import）。

## Vendor

`vendor/sheet-runtime.*` · `docs-runtime.*` · `design-runtime.*` · `fflate.js` **已跟踪**，unpacked 加载需要。不要在扩展页直接 `import` `@univerjs/*` 或 `tldraw`。不要引入 `@univerjs-pro/*`。历史打包命令记在 `vendor/README.md`；本仓库日常无 `package.json`。

tldraw 无生产 license 时保留官方水印（`tldrawLicense.js`）。

## 宿主约定

- Query：`sessionId`、`artifactId`（site/design 可能多个 id）。页 load 后发 `sheet_tab_ready` / `html_tab_ready` / `docs_tab_ready`。
- 同一 session+artifact 复用标签（SW 里 `sheetTabByKey` / `htmlTabByKey`）。
- Design/Slides 共用 `design.html`，用 `shell` 区分，不要再开第二套视觉引擎。
- `artifactPreview` 对 PDF/raster：显示可以重建，**写回/下载保持原始 bytes**。
