# 爪爪 · 完全解放版

Chrome MV3 unpacked 扩展。加载根就是本文件夹（有 `manifest.json`）。

## 加载

1. Chrome → `chrome://extensions`
2. 打开 **开发者模式**
3. **加载已解压的扩展程序**
4. 选本文件夹

侧栏打开扩展 → 填模型 Key（`pagewand_providers`）→ 在普通网页上用工具 `action`（先 `snapshot`，再用同代 `ref`+`rev` 点/填）。浏览器机器还可通过 `run` 里的 guest `sys`（不是单独工具；目录：`inspect view=sys`）。最低 Chrome 135；Chrome 138+ 在扩展详情允许用户脚本，较早版本使用开发者模式。`await sys.capabilities()` 可探测实际可用能力。

## 改代码

直接改 `src/`，然后在 `chrome://extensions` 点本扩展的 **重新加载**。无 `package.json`。

技术分层见 [AGENTS.md](AGENTS.md)。本轮实现与后续方向见 [BROWSER_COMPUTER.md](BROWSER_COMPUTER.md)。本地 Git 无 remote，不执行 push。

## 回归验证

无需安装 npm 依赖的逻辑测试：`node --test tests/runtime-regression.test.mjs`（使用支持 ES modules 自动识别的现代 Node）。

实机验证：`node tests/browser-smoke.cjs <playwright包路径>`。需要已有 Playwright 与 Chromium；使用独立测试 profile。证据写入 `output/playwright/browser-evidence.json`。
