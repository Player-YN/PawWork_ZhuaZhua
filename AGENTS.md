# 爪爪 · 完全解放版

Chrome MV3 **unpacked** 扩展：把已登录浏览器当成可编程层（live-page `action`，以及 `run` 里的 guest `sys`），并在侧栏里跑一个 **Session Workspace** 通用 agent（表 / 画布 / 文档 / 站点 / 代码沙箱）。

加载根 = **本文件夹**（根上有 `manifest.json`）。显示名：`manifest.name` / `action.default_title` = `爪爪 · 完全解放版`。不面向 CWS，日常改 `src/` 后在扩展卡片点 **重新加载**。无 `package.json`，不跑 npm。

产品入口与本地验证：[README.md](README.md)。实现进展与技术方向：[BROWSER_COMPUTER.md](BROWSER_COMPUTER.md)。

## 文档怎么读

| 文件 | 写什么 | 什么时候打开 |
|------|--------|----------------|
| 本文件 | 产品边界、进程分层、领域对象、目录地图 | 任何任务的第一站 |
| [src/AGENTS.md](src/AGENTS.md) | Chrome 宿主：SW / offscreen / 侧栏 / content script / 消息总线 / `action` 运输 | 改扩展壳、RPC、标签、选区 |
| [src/agent/AGENTS.md](src/agent/AGENTS.md) | Session Workspace：store、工具循环、工具契约、skills、guest FS、`sys` ABI | 改模型循环、工具、prompt、持久化领域 |
| [src/preview/AGENTS.md](src/preview/AGENTS.md) | 画布标签页（Univer / tldraw / site） | 改 sheet / design / docs / site 预览 |
| [src/sidepanel/README.md](src/sidepanel/README.md) | 侧栏 UI 模块与滚动契约 | 改对话面板布局 / i18n |

事实以仓库代码为准。历史名 **PageWand** 仍出现在 `chrome.storage.local` 键（`pagewand_*`）和部分注释里；消息 `target` 用 `pawwork-*`。

## 技术分层

扩展不是单页应用。Chrome 把代码拆进不同进程；agent 只住在 **offscreen** 里，侧栏只发 RPC。

```text
┌─ 用户网页（任意 http(s)）─────────────────────────────────┐
│  content_script.js  all_frames                             │
│  伸爪选区 · 每 frame 的 action snapshot/mutate               │
└──────────────────────────────▲─────────────────────────────┘
                               │ tabs.sendMessage {frameId}
┌─ Service Worker  src/background.js ────────────────────────┐
│  路由：workspace_rpc / workspace_page_action / workspace_sys │
│        sheet_host / canvas_host / 截图 / 下载 / 预览 / tabGroups │
│  SW 会被杀掉 → 不在这里持有会话 store 或跑模型循环           │
└──┬───────────────────────────┬─────────────────────────────┘
   │ workspace_rpc             │ 打开 chrome-extension:// 标签
   ▼                           ▼
┌─ Offscreen  src/offscreen/ ─┐  ┌─ Preview  src/preview/ ──┐
│ SessionWorkspaceService     │  │ sheet / design / docs /  │
│ IDB + OPFS 会话仓库         │  │ site / artifactPreview   │
│ AI SDK ToolLoopAgent        │  │ Univer / tldraw 运行时   │
│ iframe → sandbox QuickJS    │  └──────────────────────────┘
└──────────────▲──────────────┘
               │ workspaceRpc(method, params)
┌─ Side panel  src/sidepanel.html + sidepanel.js ────────────┐
│  对话 UI、选区、交付物。不跑 agent 循环。                    │
└────────────────────────────────────────────────────────────┘
```

| 层 | 职责 | 不该做 |
|----|------|--------|
| Side panel | 渲染会话、收集用户输入、调 `workspaceRpc` | 持有 Durable store、调模型 |
| Service worker | 权限面：标签、下载、跨 frame 扇出、打开预览页、`workspace_sys` | 长期状态、ToolLoopAgent |
| Offscreen | 产品 runtime：store + `sendMessage` + 工具 | 直接碰 DOM / `chrome.tabs`（经 SW 消息） |
| Content script | 页面选区与 `action` 本 frame 执行 | 会话语义、模型、`sys.eval`（那是 SW `userScripts`） |
| Sandbox | `run` 的访客 JS（无 `chrome.*`；经 `sys` RPC 调 SW） | 读扩展存储、改 SelectionGroup |
| Preview 标签 | 把 artifact 画成可编辑画布 | 模型循环 |

## 一次用户消息

```text
侧栏 send
  → workspaceRpc('sendMessage')
  → SW forwardWorkspaceRpc
  → offscreen SessionWorkspaceService.sendMessage
  → sessionWorkspace/sendMessage.js
       beginExecution
       createSessionTools + inventoryFromSession（瞄准，不藏工具）
       AI SDK 7 ToolLoopAgent（sessionAgent.js，toolChoice=auto）
       工具：inspect / acquire / run / clarify / action / sheet / deck / doc / web
       （sys 不是工具；在 run 代码里调，目录：inspect view=sys）
       settleExecution
  → session_workspace_event 广播回侧栏
```

工具实现与契约：[src/agent/AGENTS.md](src/agent/AGENTS.md)。`action` 出 offscreen 后如何打到页面：[src/AGENTS.md](src/AGENTS.md)「`action` 运输」。

## 领域对象（产品语义）

都在 offscreen 的 `DurableSessionWorkspaceStore` 里（IndexedDB `pawwork-session-workspace-v1` + OPFS blobs）。纯内存 `SessionWorkspaceStore` 只给测试。

| 对象 | 是什么 | 谁改 |
|------|--------|------|
| **Session** | 一轮任务：messages、title、绑定的 group ids | UI RPC + `sendMessage` |
| **Group + WebItem** | 用户拥有的环境上下文（伸爪选区、剪贴板钉、页面条目） | **仅 UI RPC**。工具禁止 mutate SelectionGroup |
| **Artifact** | 会话交付物（表 / Paw Canvas / Univer 文档 / site HTML / 文件） | 工具 `run` / office 工具 / UI 创建 |
| **Execution** | 单次用户 turn 的租约与 `/scratch`；崩溃后作废 | `sendMessage` |
| **Guest FS** | 访客可见 `/context`（只读）· `/artifacts`（持久）· `/scratch`（本轮） | `run` 沙箱 |
| **sys** | 浏览器机器 ABI（tabs / eval / fetch / **cdp** / download / screenshot）。guest 无 `chrome.*` | `run` → SW `workspace_sys` |

画布种类（inventory 瞄准，工具始终在）：`sheet` · `deck`/`poster`（tldraw Paw Canvas）· `doc` · `web`（`data-paw-kind=site`）。

## 加载根树

```text
manifest.json              # MV3：SW / side_panel / content_scripts / sandbox / CSP
icons/                     # 16|32|48|128
BROWSER_COMPUTER.md        # 实现进展与后续技术方向
src/
  background.js            # Service worker（type: module）
  content_script.js        # <all_urls> all_frames；伸爪 + action
  sidepanel.html|js|css    # 侧栏壳；编排在 sidepanel.js
  sidepanel/               # 侧栏子模块（见该目录 README）
  offscreen/               # 创建 SessionWorkspaceService；嵌 sandbox iframe
  sandbox/                 # QuickJS guest（manifest.sandbox）
  preview/                 # 画布 / 通用预览标签页
  agent/                   # 模型循环与领域（offscreen 主进口）
    llm.js provider.js     # BYOK OpenAI-compatible
    vnext/service/         # SessionWorkspaceService RPC 门面
    vnext/sessionWorkspace/# store、sendMessage、tools、office
    vnext/primitives/      # acquire / run 宿主原语
    vnext/adapters/        # QuickJS、AI SDK vendor loader
    vnext/host/            # workspaceRpc 客户端、stop、rpcError、browserSysHost（workspace_sys）
    vnext/skills/          # playbook（不是工具）
```

`src/preview/vendor/{sheet,docs,design}-runtime.*` 是已跟踪的 Univer / tldraw 包，unpacked 加载需要，勿从 `.gitignore` 排除。

## 日常约定

- 改代码 → `chrome://extensions` 点本扩展 **重新加载**。offscreen / SW 会重建；`action` 的 `rev` 在 SW 内存，重载后需重新 `snapshot`。
- 权限见 `manifest.json`：`sidePanel` `activeTab` `tabs` `scripting` `storage` `downloads` `offscreen` `tabGroups` `webNavigation` `userScripts` `debugger`；`host_permissions: <all_urls>`。`userScripts` / `debugger` 只服务 guest `sys`（[src/AGENTS.md](src/AGENTS.md)）。
- 命令：`toggle-picker` = Alt+Shift+S；`capture-screenshot` = Alt+Shift+C。
- Git：本地 `main`，当前无 remote。不要 `git push`，不要改 `git config`。
- BYOK：侧栏填 Key → `pagewand_providers`。无 Key 时 offscreen 仍可启动，`sendMessage` 时再解析模型。
