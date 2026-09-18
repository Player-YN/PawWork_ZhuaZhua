# 爪爪 · Chrome BOT 架构优化与交付说明

日期：2026-09-17  
版本：`1.2.0`  
基线：用户上传的 `PawWork_ZhuaZhua.zip` 工作区，包含尚未提交的 Durable Task / tab lease 改动。

## 1. 架构判断：保留执行器，补可靠执行

当前项目已经有浏览器 BOT 的主要骨架：offscreen 中的 Agent、当前登录浏览器中的 action/sys、任务进度对象、alarms 唤醒与用户可干预的侧栏。没有必要为“BOT”再创建第二套执行框架。

这次优化的重点是：同一任务实际在什么页面、由哪次执行、以什么权限操作；失去回执时不误判成功或失败；执行结束后能否正确交还资源。工具数量、面板大小、目录深度不是这轮最主要的瓶颈。

三块职责：

| 部分 | 负责什么 |
|---|---|
| Task：任务进度 | goal、plan、evidence、dueAt、暂停/继续/完成 |
| Execution：本次执行 | 单 session 执行槽、取消、工具循环、资源归属 |
| 浏览器宿主 | 校验调用者、占用 tab、核验文档、派发 action/sys、返回事实或未知 |

普通 send 不自动建 task；同 session 不并发 turn；不增加 hop 上限；不隐藏工具；不改 `pagewand_*` 存储键。

## 2. 优化后的主要执行路径

```text
侧栏 / 预览页
    │ 共享 workspaceClient：保留冲突信息，写入丢回执 = unknown
    ▼
Service Worker
    │ 原生 sender 身份 + RPC 方法清单 + 调用角色
    ▼
offscreen：SessionWorkspaceService
    │ 同 session 在首个 await 前预占执行槽
    │ Task 仍可选；Agent 仍只有一套
    ▼
Service Worker 浏览器宿主
    │ 首次派发前：恢复 storage.session 租约，与 offscreen 活动执行对账
    │ 页面操作前：核验 execution、占用 tab、检查目标文档
    ├─ action：snapshot → documentId + rev → 派发 → 后续观察
    └─ sys：documentIds 定向执行；CDP 归属本次 execution
    ▼
回执：已知结果 / 明确拒绝 / 结果未知
    │
执行结束：撤销后续派发资格 → 取消可取消调用 / detach CDP → 释放 tab
```

现有 Chrome 进程划分不变；进程之间的合同更明确。

## 3. 已落地的修改

### 3.1 RPC：从“公开方法都能调”改为显式清单

原审查文档指出 offscreen 通过公开 async 方法反射分发。现在新增 `workspaceRpcContract.js`：方法名、内部/界面调用范围、可否安全重试均明确登记，增加 service 方法不会自动暴露。

SW 根据 Chrome 原生 sender.id、sender.url、sender.tab 判断角色，不信消息中的自报角色。侧栏不能调用内部 scheduler；预览页仅保留交付物读写需要的方法；offscreen 拒绝界面绕过 SW 直接调用 service。这个清单验证外层参数必须为对象；具体语义仍由原方法验证。

新增 `workspaceRpcTransport.js`：SW→offscreen 的只读方法才允许有限重试。任何写调用在已调用 sendMessage 后丢失回执，都返回 `RPC_OUTCOME_UNKNOWN`，不再自动重投。

侧栏及 sheet/docs/site/artifactPreview 四种预览统一使用 `workspaceClient.js`，处理界面→SW 丢失回执，并保留 `ARTIFACT_CONFLICT` / actualRevision。原本预览页重复的 RPC 包装已删除。

关键路径：
`workspaceRpcContract.js`、`workspaceRpcTransport.js`、`workspaceClient.js`、`src/offscreen/runtime.js`、`src/background.js`、`src/preview/{sheet,docs,site,artifactPreview}.js`。

### 3.2 tab 租约：跨 SW 重启保留，恢复失败不冒险派发

`tabLease.js` 接入 `chrome.storage.session`，键为 `pawwork_browser_leases_v1`。记录 sessionId + executionId + tabId + kinds；操作串行更新，先成功登记再放行。恢复数据损坏、读写失败时拒绝执行，不把“读不到”当成“没人占用”。

SW 第一次处理浏览器调用/调度时，通过 offscreen 内部 `getBrowserRuntimeState` 对账。确认已不存在的执行才清理；无法取得可信运行状态则保留锁并报错。

`storage.session` 可跨 SW 生命周期；浏览器重启、扩展禁用/重载/更新会清空。[1] 任务进度仍在 IDB。

同一执行允许重入；不同执行不能抢同一 tab；`grant` 不再覆盖已有持有者。关闭 tab 也要占锁；CDP 的 targetId 必须解析到页面 tabId。

这是同 tab 的执行互斥。预览 workLock 独立。

### 3.3 页面身份：不再只相信 tabId、frameId 和 URL

新增 `documentTarget.js`，把 action 快照绑定到各 frame 的 documentId 和 URL；rev 改为不透明随机值，避免 SW 重启后再次生成相同 t1，误接收旧引用。

新增 `pageActionHost.js`，从 background 抽出页面操作运输。当前所有 mutate，包括按 name 点击和不带目标的 press，都必须带最新 rev。真正发送时使用 `tabs.sendMessage(..., { frameId, documentId })` 定向；取不到文档身份直接拒绝。[2][3]

注册 `onBeforeNavigate`、`onCommitted`、`onHistoryStateUpdated`、`onReferenceFragmentUpdated`，以及 tab 关闭/替换的失效处理。同 URL 的新文档、SPA 路由变化，都不能直接沿用旧快照。

`sys.eval`、`sys.waitFor`、`sys.fetch(as:"page")` 改为 `userScripts.execute` 的 `documentIds` 目标；可传 `documentId`、`expectedUrl` 检查上一次观察。Chrome 135 的该接口已有 documentIds，不需要提高项目最低版本。[4] `sys.tabs.current` 只使用显式 tabId 或本轮 defaultTabId，缺省不再偷偷切到焦点标签。

documentId 保护的是文档身份。`sys.eval/waitFor/page-fetch` 可带先前观察的 documentId/expectedUrl。CDP 按 session + execution 归属并在结束时 detach。

### 3.4 执行结束：统一取消、CDP 清理与放锁

新增 `browserExecution.js`，结束流程精确对应 sessionId + executionId，而不是按 session 宽泛释放。先登记本执行已结束，阻止后到的浏览器调用；再取消 SW 中可取消的 sys 调用、释放所属 debugger attachment，最后交还 tab。

CDP attachment 增加执行归属；结束时主动 detach。SW 内存失效后的 CDP 清理可利用恢复出的租约 kinds 定位页面管道。[5]

同 session 的槽位现在在首个异步准备动作之前登记。旧 executionId 的 abort 不能停止同 session 已开始的新 execution。

结束登记最多保存 2048 个执行身份，用于拦截迟到消息。

### 3.5 结果表达：不把没收到结果写成成功

`sysClient.js` 及共享 RPC 客户端将通信丢失明确返回为 unknown。userScripts 空结果、缺失包装回执、返回文档不匹配，不再冒充 `{ok:true}`。

单个页面写入丢失回执为 `ACTION_OUTCOME_UNKNOWN`；多 frame fill_form 在首次失败/未知处停止继续派发，保留已知部分结果并把 unknown 传播到顶层。

动作已经有成功回执、但随后 snapshot 因卸载等原因失败时，结果保留动作回执并单列 `observationError`。

prompt 版本更新为 `v11-browser-execution`，action schema、SYS 帮助与 AGENTS 同步这些规则。task complete 的 evidence 由模型填写。

### 3.6 发布路径：测试的代码必须真的进入扩展包

原 `pack_extension.py` 仅用 `git ls-files`，会漏掉上传工作区里尚未跟踪的 Task 模块，也会漏掉本次新增模块。现在按当前工作区的 manifest/LICENSE/src/icons 运行目录打包，不依赖 `.git`。

显式过滤隐藏文件、开发文档、常见凭据文件与非运行扩展名，拒绝运行目录中的符号链接；不把 dist/output/整个仓库递归塞进扩展。

新增 `verify_extension.py`，检查 manifest 路径、HTML/CSS 资源、字面量本地 JS import 及运行源码与打包文件逐字节一致；CI 加入验证。

## 4. 本轮保持不变的接线

Alarm 只唤醒 due task；Task store 保持权威。[6] 同一套 ToolLoopAgent。workLock 与 tab lease 分开。sidepanel 的大型 UI 文件、三套 skill、快照式持久化仍保留。

## 5. 验证记录

上传基线：`node --test tests/*.test.mjs` 为 **55/55**。  
优化后：同一命令为 **96/96**，新增 **41** 个测试；原有 55 项继续通过。  
新增回归覆盖显式 RPC、原生 sender 角色模拟、丢回执不重投、跨 SW 租约恢复模拟、存储失败拒绝、旧 abort 隔离、文档变化、action 排队、CDP 所有权与释放、无 Git 打包及漏包/源码漂移检测。

仅对原测试中受 documentId 接口/模块抽取影响的夹具和路径作相应调整。

静态完整性、语法检查与最终测试摘要见 `output/verification/verification.json`；命令日志一并保留。

## 6. 使用与本地验收

先停止运行中的任务并保留原源码目录。补丁以**本次上传的工作区**为基线。先检查再应用：

```sh
git apply --check /path/to/PawWork_ChromeBOT_1.2.0_changes.patch
git apply /path/to/PawWork_ChromeBOT_1.2.0_changes.patch
node --test tests/*.test.mjs
python3 scripts/pack_extension.py --zip dist/PawWork_ChromeBOT_1.2.0_extension.zip
python3 scripts/verify_extension.py extension --source .
```

有冲突时不要强行应用；用交付源码与当前工作区对比合并。源码包不带 `.git`、旧产物、原机器路径配置或浏览器 profile。

原扩展的加载根仍是仓库根。要保留原扩展身份和已有数据，优先在原路径更新文件后重新加载，不要先卸载原扩展。运行 ZIP 解压后的根目录有 manifest.json。

最低 Chrome 版本仍为 135，未新增权限。User Scripts 的开关按现有产品要求配置；Chrome 138+ 为扩展卡上的 Allow User Scripts。[4] CDP 仍显示浏览器原有调试提示，不隐藏横幅。

已有 Playwright 环境可运行：

```sh
PAW_LOAD_ROOT=extension node tests/browser-smoke.cjs /path/to/playwright
# 可按本地环境提供已有、允许加载扩展的浏览器路径；不修改组织策略：
PAW_CHROMIUM_EXECUTABLE=/path/to/chromium PAW_HEADLESS=false \
  PAW_LOAD_ROOT=extension node tests/browser-smoke.cjs /path/to/playwright
```

脚本使用临时独立 profile、不读取日常浏览数据。脚本覆盖存储、沙箱、artifact 冲突及部分 RPC 原生边界。

| 情境 | 预期 |
|---|---|
| 普通 send / 主动 schedule | 普通 send 不建任务；明确 schedule 才出现 task |
| A 占有 tab，B 点击/关闭同 tab | B 收到 TAB_LEASED，不应产生该页面副作用 |
| action snapshot 后刷新同 URL / SPA 切页 | 旧 rev 被拒绝，重新 snapshot 后才允许动作 |
| 运行中 SW 被浏览器终止后再触发调用 | 活动执行的锁保留；旧快照必须重取；不自动重放旧写入 |
| 旧 execution 的迟到 abort | 不停止新 execution |
| CDP 执行结束 | 只释放自身 attachment；确认未误伤新执行 |
| RPC 写操作丢回执 | unknown；先检查是否已发生，不直接重发 |
| 后台 Task 唤醒时 session 忙/目标冲突 | 保持原有跳过与后续唤醒语义，不并发启动同 session |

## 7. 依据与来源

项目事实来自上传源码和《爪爪 · 进度与架构审查》§1、§2、§4；以源码核对。

核对的 Chrome 官方资料：
[1] Storage：Session 的寿命与可见性。
[2] webNavigation：frameId 跨导航不变、documentId 标识文档、history/fragment 事件。
[3] tabs：sendMessage 的 documentId 定向。
[4] userScripts：documentIds / execute 的版本支持及 User Scripts 开关。
[5] debugger：target、attachment、detach。
[6] alarms：休眠、触发延迟与重建。
[7] Messaging：内容脚本消息的信任边界和 sender 检查。

```text
https://developer.chrome.com/docs/extensions/reference/api/storage
https://developer.chrome.com/docs/extensions/reference/api/webNavigation
https://developer.chrome.com/docs/extensions/reference/api/tabs
https://developer.chrome.com/docs/extensions/reference/api/userScripts
https://developer.chrome.com/docs/extensions/reference/api/debugger
https://developer.chrome.com/docs/extensions/reference/api/alarms
https://developer.chrome.com/docs/extensions/develop/concepts/messaging
```
