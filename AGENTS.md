# 爪爪 · 完全解放版

Chrome MV3 unpacked 扩展。加载根 = **本文件夹**（根上有 `manifest.json`）。`manifest.name` / `action.default_title`：`爪爪 · 完全解放版`。

加载与 Git 的人读说明：[HANDOFF.md](HANDOFF.md)。

## 功能现状（脊骨）

| | |
|---|---|
| 加载 | `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 本文件夹 |
| 改代码 | 直接改 `src/`，扩展卡片点 **重新加载**。无 `package.json`，日常不跑 npm |
| Git | 本地分支 `main`，当前无 remote |
| 宿主面 | [src/AGENTS.md](src/AGENTS.md) |
| 工具与 `action` 契约 | [src/agent/AGENTS.md](src/agent/AGENTS.md) |

树（加载根）：

```text
manifest.json
icons/                 # icon-16|32|48|128.png
src/background.js
src/content_script.js
src/offscreen/         # SessionWorkspaceService
src/sidepanel.html + src/sidepanel.js
src/sandbox/           # QuickJS guest（run）
src/preview/           # sheet / design / docs / site / artifactPreview
src/agent/             # 模型循环、工具、skills
```
