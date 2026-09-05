# 爪爪 · 完全解放版

Chrome MV3 unpacked 扩展。加载根就是本文件夹（有 `manifest.json`）。

## 加载

1. Chrome → `chrome://extensions`
2. 打开 **开发者模式**
3. **加载已解压的扩展程序**
4. 选本文件夹

侧栏打开扩展 → 填模型 Key（`pagewand_providers`）→ 在普通网页上用工具 `action`（先 `snapshot`，再用同代 `ref`+`rev` 点/填）。浏览器机器还可通过 `run` 里的 guest `sys`（不是单独工具；目录：`inspect view=sys`）。Chrome 135+ 扩展卡片需允许用户脚本。

## 改代码

直接改 `src/`，然后在 `chrome://extensions` 点本扩展的 **重新加载**。无 `package.json`。

技术分层见 [AGENTS.md](AGENTS.md)。加载/Git 见 [HANDOFF.md](HANDOFF.md)。
