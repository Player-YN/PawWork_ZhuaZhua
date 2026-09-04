# src/agent — 模型循环与工具

入口：`vnext/service/sessionWorkspaceService.js`（offscreen）。每条用户消息走 `vnext/sessionWorkspace/sendMessage.js` → AI SDK 7 `ToolLoopAgent`（`sessionAgent.js`，`toolChoice=auto`）。

```text
sidepanel workspaceRpc('sendMessage')
  → SessionWorkspaceService.sendMessage
  → sendMessage(store, input)
  → createSessionTools + runSessionToolLoopAgent
```

清单在 `vnext/sessionWorkspace/canvasInventory.js`：`SESSION_TOOL_NAMES`。`toolSchedule.js` 原样返回该列表（inventory 只瞄准目标，不藏工具）。

## 当前工具清单

| id | 定义 | 现状 |
|----|------|------|
| `inspect` | `sessionWorkspace/tools.js` | 读会话：`view` = groups / group / item / artifacts / files / skill / workbook / range / html |
| `acquire` | 同上 | `action` = search / fetch / map / crawl / image / note。设置键 `pagewand_web_acquire`（`webAcquireSettings.js`） |
| `run` | 同上 | sandbox JS/TS；guest FS `await fs.readFile`。`op` 含 write_artifact、createScene、fromPage、fromRaster、createWorkbook、createDocument、shelf 等 |
| `clarify` | 同上 | 暂停本轮：1–4 个问题，或 plan 卡（`title` / `summary` / steps） |
| `action` | 同上 | 当前标签 live-page。运输见 [../AGENTS.md](../AGENTS.md) |
| `sheet` | `sessionWorkspace/officeTools.js` | Univer 表：`act` = read / write / snapshot |
| `deck` | 同上 | tldraw Design/Slides：`act` = read / write / export |
| `doc` | 同上 | Univer 文档：`act` = read / write |
| `web` | 同上 | `data-paw-kind=site`：`act` = read / write / undo / clone / capture |

BYOK：`llm.js` → `pagewand_providers`（OpenAI-compatible HTTPS）。`run` 用 `vnext/adapters`（QuickJS / esbuild-wasm / AI SDK loader）+ `sandbox/`。

Guest FS（`sessionWorkspace/fs.js`）：`/context` 只读 · `/artifacts` 持久 · `/scratch` 本轮 execution。

Skills（playbook，不是工具）：`vnext/skills/<id>/`。已注册：`html-preview` `slides` `poster` `html-site` `compose-image` `visual-compile` `sheet-nl` `listing-sheet` `briefing-deck` `remake-poster`。别名：`html-deck` → `slides`，`html-poster` → `poster`。正文用 `inspect view=skill`。

## `action` 契约

模型参数（`tools.js`，`required: ['op']`）：

| 字段 | 用途 |
|------|------|
| `op` | `snapshot` \| `fill_form` \| `click` \| `fill` \| `select` \| `press` \| `scroll` \| `wait` |
| `ref` | 最近一次 snapshot 的不透明控件 id，如 `f0.a12` |
| `rev` | 同代快照世代，如 `t7` |
| `name` | 无障碍名回退（label / aria-label / placeholder） |
| `value` | `fill` / `select` |
| `fields` | `fill_form`：`[{ ref, value }]` 或 `[{ name, value }]` |
| `key` | `press`（Enter、Tab、Escape、方向键、Space、Backspace、…） |
| `text` | `wait`：等待可见文本 |
| `ms` | `wait` 上限（默认/上限 5000）；无 text/ref 时睡眠，默认 300 |

回路：`snapshot` → 用**同一代** `ref`+`rev` mutate → 每次 mutate 的返回带新 snapshot（新 `rev` + `controls`）。多字段用 `fill_form`。

错误码（工具 + background + content script）：

| code | 何时 |
|------|------|
| `STALE_REF` | 无 rev、rev 对不上、或控件已卸 |
| `AMBIGUOUS` | `name` 命中多个控件 |
| `FILE_INPUT` | `input[type=file]`，脚本填不了 |
| `NEED_PAGE` | 无活动标签 / 限制页 / 无 host / 空结果 / frame 发不出去 |
| `NO_TARGET` | 无名无 ref、name 零命中、wait 超时、无匹配 option |
| `BAD_INPUT` | 缺 `op` / 缺 `fields` / 缺 `value` 等 |

`press` 无目标时打到主 frame（`frameId` 0）的 `activeElement`。
