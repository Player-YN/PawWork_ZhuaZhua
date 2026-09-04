# src — 宿主面

本目录是扩展的可执行面。模型工具契约见 [agent/AGENTS.md](agent/AGENTS.md)。

## 布局

| 面 | 路径 | 现状 |
|----|------|------|
| Service worker | `background.js` | 标签 / 下载 / office 页 RPC / offscreen 转发 / **`workspace_page_action` 跨 frame 扇出** |
| Offscreen | `offscreen/runtime.html` + `runtime.js` | 创建 `SessionWorkspaceService`；收 `workspace_rpc_execute` |
| Content script | `content_script.js` | `manifest.content_scripts`：`matches: <all_urls>`，`run_at: document_idle`，**`all_frames: true`**。伸爪选区 + 每 frame 的 action snapshot/mutate |
| Sidepanel | `sidepanel.html` + `sidepanel.js` | 对话 UI；`workspaceRpc` → background |
| Sandbox | `sandbox/runtime.html` | QuickJS；`run` 的访客代码 |
| Preview | `preview/` | `sheet.html` · `design.html` · `docs.html` · `site.html` · `artifactPreview.html` |
| Vendor | `preview/vendor/` | 已跟踪的 Univer / tldraw 运行时（unpacked 需要，勿忽略） |

`icons/` 在仓库根，不在 `src/`。

## RPC

```text
sidepanel  workspaceRpc(method, params)
  → chrome.runtime.sendMessage { target: pawwork-background, action: workspace_rpc }
  → background.forwardWorkspaceRpc
  → chrome.offscreen  src/offscreen/runtime.html
  → { target: pawwork-offscreen, action: workspace_rpc_execute }
  → SessionWorkspaceService[method]
```

Offscreen URL：`src/offscreen/runtime.html`。SW 里 `ensurePawWorkOffscreen()`，转发最多重试 8 次。

## `action` 运输

```text
SessionWorkspaceService.hostPageAction
  → { target: pawwork-background, action: workspace_page_action }
  → handleWorkspacePageAction
  → chrome.tabs.sendMessage({ action: workspace_page_action, … }, { frameId })
  → content_script 本 frame 执行
```

Background 现状：

- `chrome.webNavigation.getAllFrames` 列 frame；跳过 `chrome://` / `chrome-extension://` / `edge://` / `devtools://` / `view-source:`。
- 缺脚本的 frame：`chrome.scripting.executeScript` 注入 `src/content_script.js`（回退 `content_script.js`）。
- 各 frame 本地 `aN` 编成不透明 `f{frameId}.aN`。
- `rev` 存在 SW 内存 `pageActionRevByTab`（`t1`, `t2`, …）。SW 重启后需重新 `snapshot`。
- 合并 snapshot 后 `controls` 再截到 80 条。
- `fill_form` 按 `frameId` 拆开发送。
- `wait` + `text`（无 `ref`）对所有 frame 并行等，任一命中即停。
- `name` 回退：内部 `op: resolve_name`（不在模型 schema 里）。
- 限制页（`chrome://`、`edge://`、`about:`、`devtools://`、`view-source:`、Web Store、扩展页）→ `NEED_PAGE`。

Content script 现状：

- 本 frame snapshot：可交互节点 cap **80**（`ACTION_SNAPSHOT_CAP`）；本地 ref 为 `a1`…。
- 公开 op：`snapshot` / `fill_form` / `click` / `fill` / `select` / `press` / `scroll` / `wait`，另有内部 `resolve_name`。
- `resolveActionTarget` 另有 `css` 路径；模型工具参数未暴露该字段。
- `wait`：无 `text`/`ref` 时睡 `ms`（默认 300，上限 5000）。

## 其它宿主事实

- 权限：`sidePanel` `activeTab` `tabs` `scripting` `storage` `downloads` `offscreen` `tabGroups` `webNavigation`；`host_permissions: <all_urls>`。
- 命令：`toggle-picker` = Alt+Shift+S；`capture-screenshot` = Alt+Shift+C。
- `chrome.storage.local` 键仍是 `pagewand_*`（如 `pagewand_providers`、`pagewand_web_acquire`、`pagewand_tldraw_license`）。
- 会话元数据：IndexedDB `pawwork-session-workspace-v1` + OPFS blobs（`DurableSessionWorkspaceStore`）。
- tldraw：`tldrawLicense.js` 解析 key；仓库无生产 license，缺 key 保留官方水印。
