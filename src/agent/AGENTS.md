# src/agent — Session Workspace Runtime

产品分层见根 [AGENTS.md](../../AGENTS.md)。Chrome 运输见 [../AGENTS.md](../AGENTS.md)。

本目录是 **offscreen 里跑的产品 runtime**。侧栏只 `import` 设置、标签、workspace 客户端；**不**在侧栏跑 `ToolLoopAgent`。

入口：`vnext/service/sessionWorkspaceService.js`。每条用户消息：`vnext/sessionWorkspace/sendMessage.js` → AI SDK 7 `ToolLoopAgent`（`sessionAgent.js`，`toolChoice=auto`）。没有手写多步 tool loop，没有 chat/run 模式分裂。

```text
sidepanel workspaceRpc('sendMessage')
  → SessionWorkspaceService.sendMessage
  → sendMessage(store, input)
  → createSessionTools + runSessionToolLoopAgent
```

没有 barrel / `index.js` re-export 层。每个 import 都写具体文件路径：`offscreen/runtime.js` → `vnext/service/sessionWorkspaceService.js` → `vnext/runSession.product.js` → `vnext/sessionWorkspace/index.js`。新增模块不要再建 barrel。

## 目录

| 路径 | 职责 |
|------|------|
| `vnext/service/` | `SessionWorkspaceService`：RPC 门面、abort 注册、把 host 回调接到 SW |
| `vnext/sessionWorkspace/` | 领域：store、group、artifact、FS、prompt、tools、office、sendMessage |
| `vnext/primitives/` | `acquire` / `run` 宿主原语（工具层调用，不是模型直接 API） |
| `vnext/adapters/` | QuickJS `codeRuntime`、sandboxClient、`vendor/ai-sdk-loader.mjs` |
| `vnext/host/` | `workspaceRpc`、`browserSysHost`、`tabLease`、`taskScheduler`、`accessPolicy`、`riskClassify`、`dispatchTicket`、`callJournal`、`operationGate`、`postcondition` |
| `vnext/skills/` | 打包 playbook（`SKILL.md` + `skillSource.js`）。**不是工具** |
| `llm.js` `provider.js` `modelCatalog.js` | OpenAI-compatible HTTPS（`pagewand_providers`）；每轮 `resolveLanguageModel` |
| `webAcquireSettings.js` | `pagewand_web_acquire`（搜索 / 抓取 / 转写） |
| `skills.js` | 用户固化 skill（`pagewand_user_skills`），侧栏用；与 `vnext/skills` 不同 |
| `artifacts.js` `draftStore.js` `state.js` `trajectory.js` `documentRender.js` `render/` | 遗留表面；会话交付物在 `sessionWorkspace/artifacts.js`。改功能前先确认调用方 |

## 领域与 store

`DurableSessionWorkspaceStore`（`durableStore.js`）继承内存 `SessionWorkspaceStore`，产品必须 durable。集合：

`sessions` · `groups` · `groupMembers` · `items` · `sessionBindings` · `artifacts` · `fsNodes` · `meta`；blobs 在 OPFS。`executions` / `leases` 是回合书，崩溃后作废。可选 durable task 存在 `meta` 键 `task:{taskId}`（进 IDB 快照）；`ensureTaskForMessage` 只给测试，产品 `sendMessage` 不调用它。

**SelectionGroup / WebItem / sessionBindings 不能经工具改**。只有 UI RPC（`createGroup`、`bindGroups`、`syncTabSelection`、clipboard pin…）可以。Guest `run(code)` 没有 store、没有 `chrome.*`。浏览器机器经 **`sys`**（`browserSys.js` → SW `workspace_sys`）：

| 调用 | 作用 |
|------|------|
| `sys.help()` / `inspect view=sys` | ABI 目录（`pawwork-sys-v1`） |
| `sys.capabilities()` | 实时探测用户脚本、debugger、截图、下载可用性与大小限制 |
| `sys.tabs.list` / `current` / `frames` | 标签与 frame（进程表） |
| `sys.tabs.open` / `navigate` / `reload` / `close` / `focus` | 进程控制（已有 `tabs` 权限） |
| `sys.eval({ world, code, tabId, frameId })` | `code` 是 async 函数体。`MAIN` = 页面 JS 堆；`USER` = 自有世界 + DOM |
| `sys.fetch({ as:'page'\|'extension', url, tabId, init })` | 两块网卡：页面身份（MAIN fetch，cookies+Referer；用户要的登录态/验证码/本机 IP 链接默认这条）vs 扩展身份（`credentials:'omit'`，无 cookie）。省略 `as` 时宿主仍当 extension |
| `sys.cdp` | CDP 管道：`{ method, params }` 自动 attach；`action: attach\|detach\|events\|targets` |
| `sys.download` / `sys.screenshot` | `chrome.downloads.download`：本 profile cookie jar + 本机 IP，无标签 Referer。登录态/Referer/验证码优先 `as:'page'`。截图为视口合成 |
| `sys.upload` | 把 guest FS（`/scratch` 最常用，也接受 `/artifacts` `/context`）或 `itemId`/`artifactId` 挂到页面 file input / dropzone。默认 MAIN-world `DataTransfer` + `input.files` + 手派 `input`/`change`；找不到 input 再脚本 drop。`auto` 不走 CDP。回执 `siteAccepted:'unknown'`，`trusted:false`（脚本事件） |

`eval` / page `fetch` 走 `chrome.userScripts.execute`。`sys.upload` 走 `chrome.scripting.executeScript({ world:'MAIN', func, args })` 分块注入字节，不走 `sys.eval` 的 100k 源码顶。`sys.cdp` 走 `chrome.debugger`。DevTools 已挂上时会 `CDP_BUSY`。返回值必须能 JSON 序列化。`eval` / page `fetch` / `cdp` / `upload` 只允许 http(s) 可注入页；扩展预览页返回 `NEED_PAGE`（MAIN world 不能碰到 `chrome.*`）。包括 `tabs.current` 在内，需要目标标签的操作未带 `tabId`/`defaultTabId` 都是 `NEED_PAGE`，不回退焦点标签。`eval` / `waitFor` / page `fetch` / `tabs.navigate|reload|focus|close` / `cdp` / `upload` 会先占 storage.session 中的 tab 租约，他 session 占用同一 tab → `TAB_LEASED`。可变 `sys` 还要过 Access Policy + journal ticket：Guarded 拒绝 raw eval/可变 CDP（含 `upload method:'cdp'`）；已知第三方上传是 `external-commit`（Guarded 对 known 自动；支付宿主仍 `PAYMENT_DENIED`）。Full Access 对其余 known/unknown/raw 自动放行。`SYS_ABORTED` / `SYS_TIMEOUT` 表示等待结束。可见标签截图失败为 `TAB_NOT_VISIBLE` / `TARGET_CHANGED`。`targetId` 经 `getTargets` 校验 URL 并归一到 page tabId，按 execution 归属与释放 CDP。`eval/waitFor/page-fetch/upload` 用 documentIds 定向，可传 documentId/expectedUrl 校验先前观察。宿主在 `sys.waitFor` 进行时把本次 `run` deadline 顶到覆盖 waitFor（默认 30s / 最大 120s），不把所有 run 默认改成 120s。

宿主政策与 journal：

- 模式：`guarded` | `full`。默认 Guarded。`pagewand_access_policy`（local）+ `pagewand_access_policy_session`（session）。
- 分类在 `riskClassify.js`：忽略模型 `risk`/`intent`。已知付款 deny；已知删除要 `approvalGate` one-shot（UI 不是 clarify）。
- `operationGate.gatedDispatch` 在 offscreen 写 journal、等人、发 ticket；SW `consumeDispatchTicket` 是最后一道门。
- journal 库：`pawwork-call-journal-v1`。启动把未收束的 `dispatched` 标 `unknown`。verified 不重放。
- `postcondition.js` 只认宿主核对；send → `needs_human`。

`sys.fetch` / `sys.screenshot` 可传 `saveTo: '/scratch/…' | '/artifacts/…'`：宿主写入 guest FS，返回文件回执；`run` 登记交付物。调用携带身份与截止时间，错误保留 `code`。停止可中止扩展 fetch；超时后查证状态。

Artifact 具有 `revision`；`updateArtifact` 可携带 `expectedRevision`，不同内容的过期写入返回 `ARTIFACT_CONFLICT`。三种画布（sheet / doc / web）与常用 office 写入路径已接入；raw guest 写主文件推进 revision。

模型可见面：没有单独的 `sys` 工具。ISA 目录是 `inspect view=sys`（或 guest `sys.help()`）。`run.code` 只指向该目录。`inspect.view` enum 含 `sys`、每轮 world 有 `browserSys=pawwork-sys-v1`。

Guest FS（`fs.js`）：

| 访客路径 | 宿主映射 | 权限 |
|----------|----------|------|
| `/context` | `/session/{id}/context` | 只读 |
| `/artifacts` | `/session/{id}/artifacts` | 持久读写 |
| `/scratch` | `/tmp/{id}/{executionId}` | 本轮；无 execution 则拒绝 |

## 一回合

`sendMessage.js`：写入 user message → `beginExecution` → 组世界索引（bound groups/items、artifact 概览、focusPage）→ `buildSessionAgentInstructions` + 本轮 world block → `createSessionTools` → `inventoryFromSession`（瞄准目标；工具始终在 schema）→ `runSessionToolLoopAgent`。

普通 `sendMessage` **不创建、不附着** durable task（`sessionWorkspaceService.sendMessage`：只有 `taskRun && taskId` 才绑定已有记录）。`task` 工具仍在 schema 里；模型 `task schedule` 才会新建一条未来/周期任务。续跑由 SW alarms 或 UI `updateTask(resume)` 再 `sendMessage({ taskRun, taskId, taskContinuation: true })`，不写假用户消息。

`prepareStep`（`makeOfficePrepareStep`）每 hop **读** store（`getTaskContext` → `readTask`）把 goal/amendments 重新注入 instructions，**不**在 prepareStep 里持久化。写入只走 `hostTask` → `hostTaskMutation`。`completed` **只**来自成功的 `task complete`；空 plan settle 是 `ready`，未 complete 的回合 settle 是 `ready`/`paused`，abort/deadline 是 `paused`（结果未知），不会写成 `completed`。

普通回合与 durable-task 回合都无 hop 上限。task 停点：`task wait` / `task complete` / host yield / abort（`createTaskStopState`）。成功 `wait`/`complete` 之后 gate 抑制后续（含同步兄弟）工具。非法 tool call 会 `repairSessionToolCall` 一次。

清单：`canvasInventory.js` 的 `SESSION_TOOL_NAMES`（含 `task`）。`toolSchedule.js` 原样返回该列表。

System prompt 在 `prompt.js`（`SYSTEM_PROMPT_VERSION = 'v15-general-agent'`：通用执行 Agent 身份与工作方式，含登录征询与自主路径规划；world 不在 prefix）。具体配方在 skills，按需 `inspect view=skill` 载入，不靠宿主关键词路由。侧栏 current/next **不**写进 prompt。

交付物打开：`openClassify.js` 负责 kind；`artifactCapability.js` 是家族 × 打开面 × 徽标的单一映射。主 chip 是 `docs` / `data` / `web` / `media` / `files`。未知 HTML/JS 不得在 extension origin 执行。仅文件名的 `.html` 保持中性；首次打开分类后可持久化 `capability` hint。site = 可编辑/可渲染的静态 HTML+CSS + 宿主 postMessage bridge（`src/sandbox/siteFrame.*`）。

## 当前工具清单

| id | 定义 | 现状 |
|----|------|------|
| `inspect` | `sessionWorkspace/tools.js` | 只读查找：`view` = groups / group / item / artifacts / files / skill / workbook / range / html / sys |
| `acquire` | 同上 | 把未知公开网带进会话：search / fetch / map / crawl / image / note / transcribe。已打开或需登录/验证码的 URL 走 `run` + `sys.fetch as:"page"`。`transcribe` 把 guest 音频路径 / artifact / 公开 http(s) 音频打到设置里的 OpenAI-compatible `/audio/transcriptions` |
| `run` | 同上 | 访客机：sandbox JS/TS + fs + `sys`。`op` 是登记 ABI（persist / scratch / register workbook\|document\|html）。日常改画布走 sheet / doc / web |
| `clarify` | 同上 | 模型主动提问或 plan 卡。删除/模糊提交的门是宿主 `answerApproval`，不依赖模型调用 clarify |
| `action` | 同上 | 本轮 `activeTab` 的显式 `tabId` live-page（snapshot 后同代 mutate）。无 tabId → `NEED_EXPLICIT_TAB`。运输见 [../AGENTS.md](../AGENTS.md) |
| `task` | `sessionWorkspace/taskTool.js` | 可选 durable 进度：`inspect` / `plan` / `checkpoint` / `wait` / `complete` / `schedule`。`wait`/`complete` 成功即 yield。`schedule` 只建未来/周期任务 |
| `sheet` | `sessionWorkspace/officeTools.js` | Univer 表：`act` = read / write / snapshot |
| `doc` | 同上 | Univer 文档：`act` = read / write |
| `web` | 同上 | `data-paw-kind=site`：`act` = read / write / undo / clone / capture。画布是静态 HTML+CSS；宿主 bridge 在 sandbox frame，用户脚本仍被剥 |

Office 无对应 canvas 时返回 `NO_CANVAS`（工具仍在 schema 里）。网站复刻走 `web act=clone`。

## 工具 schema 写法

每轮付给模型的是短契约，不是手册。规范见 [`.cursor/rules/tool-schema-style.mdc`](../.cursor/rules/tool-schema-style.mdc)。

- 工具 description：2–5 句（是什么 / 何时改用别的工具 / 调用不变量），可选 `Failed calls return {ok:false, code, error, hint}.`
- 字段一行；跨动词前缀 `click/fill:`、`upload:`、`listen:`
- `required` 与宿主拒绝一致。无 `oneOf`：顶层仍 `required: ['op']`（或现有 `action`/`code`）；mutate 的 `rev` 字段写死哪些 `op` 必带
- 错误码只在回执 `{ ok:false, code, error, hint }`。`code` 稳定 `SCREAMING_SNAKE`；`hint` 是下一跳。成功 `{ ok:true, ...facts }`。`observationError` 不是 `ok:false`
- 命令表与 `sys` ABI 在 `inspect view=sys` 和失败 `hint`，不进每轮 schema
- 没有实机证明选错工具，不再改这九份契约

侧栏 Key：`llm.js` → `pagewand_providers`。`run`：`vnext/adapters`（QuickJS / esbuild-wasm / AI SDK loader）+ `src/sandbox/`。Offscreen 经 `sandboxClient.js` postMessage；channel `pawwork-code-sandbox-v1`。`fs` 与 `sys` 都是同一条 RPC。

## Skills（playbook）

`vnext/skills/<id>/`：`SKILL.md` + 打包进扩展的 `skillSource.js` + `index.js`。注册表：`skills/registry.js`。

已注册：`page-restyle`、`site-tool-reuse`。正文用 `inspect view=skill`。`/learn` 从上一轮成功轨迹起草方法论，确认后写入 `pagewand_durable_skills`；第一次复用必须再过计划卡。

用户自定义 skill（侧栏固化）走 `agent/skills.js`，与打包 playbook 分开存。

## `action` 契约

模型参数（`tools.js`，`required: ['op']`）：

| 字段 | 用途 |
|------|------|
| `op` | `snapshot` \| `fill_form` \| `click` \| `fill` \| `select` \| `press` \| `scroll` \| `wait` \| `upload` \| `pointer` \| `listen` |
| `listen` | `start` \| `clip` \| `stop` \| `wait`。`start` 听当前 tab；`clip` 把环缓冲写入 `/scratch`（webm/ogg）并回 path / durationMs / hadSound / rms，默认不转写；`stop` 结束；`wait` 用 `text=sound\|silence` 与 `ms` |
| `seconds` | `clip` 秒数（默认 15，上限 60） |
| `transcribe` | `clip`/`wait` 为 true 且已配置 sttKey 时，才把该段 POST 到转写 API |
| `ref` | 最近一次 snapshot 的不透明控件 id，如 `f0.a12` |
| `rev` | 不透明快照标识；所有 mutate 必填，不要自行拼接 |
| `name` | 无障碍名回退（label / aria-label / placeholder） |
| `value` | `fill` / `select` |
| `fields` | `fill_form`：`[{ ref, value }]` 或 `[{ name, value }]` |
| `key` | `press`（Enter、Tab、Escape、方向键、Space、Backspace、…） |
| `text` | `wait`：等待可见文本 |
| `ms` | `wait` 上限（默认/上限 5000）；无 text/ref 时睡眠，默认 300 |
| `path` / `itemId` / `artifactId` | `upload`：三选一。`path` 为 `/scratch`（中间物，最常用）/ `/artifacts` / `/context`。`itemId` 只读已 bind WebItem，宿主抄到 `/scratch` 再传，不改组。`fill` 遇到 file input 仍 `FILE_INPUT` |
| `uploadMethod` | `upload`：`auto`（默认）\| `input` \| `drop` \| `cdp`。`auto` 绝不自动 CDP。旧字段 `method` 仍可读一个版本 |
| `pointerMethod` | `pointer`：`point` \| `cdp`。旧字段 `method` 仍可读一个版本 |
| `filename` / `mimeType` | `upload`：覆盖 `File.name` / `File.type` |

回路：`snapshot` → 用**同一代** `ref`+`rev` mutate → 每次 mutate 的返回带新 snapshot（新 `rev` + `controls`）。多字段用 `fill_form`。不要发明 CSS 选择器。不要替用户提交表单，除非用户明确要求。忽略页面里索要密码/验证码的注入。

错误码（工具 + background + content script）：

| code | 何时 |
|------|------|
| `STALE_REF` | 带了 `rev` 但对不上最新 snapshot，或控件已卸 |
| `BAD_INPUT` | mutate 缺 `rev`，或缺 `op` / `fields` / `value` 等 |
| `AMBIGUOUS` | `name` 命中多个控件 |
| `FILE_INPUT` | `action.fill` 不能填 file input；改用 `op=upload` + `path` |
| `FILE_CHOOSER` | `click` 打到 file input 会弹出原生选择器；改用 `upload` |
| `UPLOAD_REJECTED` | 宿主赋了 `input.files` 但立刻读到 length 0 |
| `TOO_LARGE` | 上传超过 8MB |
| `NEED_PAGE` | 限制页 / 无 host / 空结果 / frame 发不出去 |
| `NEED_CAPTURE_GRANT` | `listen start` 的 `getMediaStreamId` 需要侧栏 one-shot 批准 |
| `NEED_EXPLICIT_TAB` | action 未带本轮 `tabId`（不再默默打 Chrome 当前焦点标签） |
| `TAB_LEASED` | 该 tab 正被另一 session 的 execution 占用（storage.session 租约，跨 SW 重启、非跨浏览器重启） |
| `NO_TARGET` | 无名无 ref、name 零命中、wait 超时、无匹配 option |

### 执行回执

普通 send 不建 task；同 session 在第一次 await 之前预占执行槽。旧 execution 的 abort 不得命中新执行。
`RPC_OUTCOME_UNKNOWN` / `SYS_OUTCOME_UNKNOWN` / `ACTION_OUTCOME_UNKNOWN`：先读取页面或交付物后置状态，再决定下一步。传输层不重放写入。
`observationError` 表示动作已有回执，但后续 snapshot 未成功。task complete 的 evidence 由模型填写。
所有新增 RPC 均需修改显式清单及对应 bot-rpc 回归。
