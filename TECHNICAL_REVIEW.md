# 产品技术审查 · 2026-09-05

审查基线：`cfe218c`；sys 增量：`6cd4176..cfe218c`。开始审查时工作树干净。未修改产品代码。

## 判断

“已登录浏览器 + 通用 agent + 可编辑交付物”在技术上可实现。现有进程分层可以保留；目前不足以称为可靠的长期工作环境。主要阻碍是保存、失败传播、执行生命周期和目标身份，而不是缺少更多工具。

本次是跨模块的架构与代码审查，不是全仓每行穷尽审计。详细检查了 sys 宿主、guest 运输、执行入口、存储以及 docs/design 保存路径；阅读了 agent 循环、上下文压缩接入、artifact 更新与预览路由。没有对每个 office 命令、第三方压缩包及完整侧栏做穷尽检查。

验证：Node 导入实际模块，使用模拟 IDB/Chrome API；另提取 docs/design 的实际保存函数，在 VM 中替换 UI/RPC 依赖进行故障注入。没有运行真实 Chrome 扩展、真实模型或 Office 文件互操作测试。模拟验证证明应用逻辑问题，不证明浏览器端到端行为。

## 可定位的问题（按影响排序）

### 1. [P1] 一次写盘失败后，整个持久化队列无法恢复

位置：`src/agent/vnext/sessionWorkspace/durableStore.js:200`。

`_flushPromise = _flushPromise.then(...)` 没有恢复拒绝状态。IDB/OPFS 任一次失败后，后续 flush 继续链到同一个 rejected Promise，回调不再执行。与此同时，dirty 集合在真正提交前已被 takeSet 清空。用户继续编辑不能让保存恢复。

故障注入输出：首次 flush 报 injected disk failure；模拟存储恢复后的下一次 flush 仍报相同错误；恢复后新增写入尝试为 0。

建议：队列恢复与单次提交错误分开处理；失败保留或归还 dirty 集合；只有实际落盘成功才确认保存。不要仅 catch 后忽略异常。

### 2. [P1] OPFS 不可用时，IDB 备用路径不保存文件字节

位置：`durableStore.js:232`，以及 `loadIdbWorkspace`。

openOpfs 失败会降级为 null。flush 的该分支清空 blobManifest，随后只写 COLLECTION_NAMES 和 META_KEY；这些集合不包含 blobs。snapshot.blobs 没有写入 IDB，加载 format 2 时也固定以空 blobs 开始。元数据能保存成功，重启后文件内容却无法恢复。

模拟 IDB + `_opfs=null`，写入名为 proof 的三字节 blob 并 flush 成功：所有 IDB 记录中均无 proof 或对应文件字节。这不是 Node 自带的内存后端测试，测试明确走了 `_db` 分支。

建议：为 IDB 后端实现二进制记录及恢复；或明确拒绝在无可用文件后端时确认交付物保存成功。

### 3. [P1] 文档保存错误被吞掉，office RPC 仍可返回成功

位置：`src/preview/docs.js:178`、`:284`。

saveNow 捕获 updateArtifact 失败后只改 UI 状态，不抛出或返回失败。executeDocsRpc('apply') await saveNow 后无条件返回 ok:true。模型看到“已应用”，但持久化实际上失败。

提取实际 saveNow，令 workspaceRpc 抛出 disk failure：调用方未收到 rejection。结合 apply 分支，存在明确的假成功链路。

建议：保存返回结构化结果或抛出错误；RPC 必须区分“编辑器内存已改”和“持久化已提交”。

### 4. [P1] 文档保存期间的新编辑可被错误标成已保存

位置：`src/preview/docs.js:179`、`:194`、`:221`。

保存进行中，另一次 saveNow 直接 return。如果用户又编辑，900ms 自动保存计时器在前次保存结束前触发，就会被丢掉；前次保存结束又无条件 dirty=false。最新编辑没有落盘，也没有剩余保存任务。

实际函数模拟结果：持久化内容仍为 version1；后续编辑发生后，dirty 最终为 false。

建议：记录 editRevision/savedRevision；保存串行化并合并后续请求，落盘期间出现新 revision 必须继续保存。

### 5. [P1] 画布保存失败后，重试可能把旧版本重新载入

位置：`src/preview/design.js:245`，与 `:224` 的冲突判断。

persistNow 在 updateArtifact 成功前更新 lastJson。失败后存储仍为旧内容，下一次保存发现 rawStore != lastJson，将其判断为远端修改并 applyPatchFromStore，放弃本次本地保存。

实际函数模拟：第一次写入失败，第二次重试没有发起新 update，反而调用了一次 applyPatchFromStore。

建议：仅在提交成功后推进已保存基线；存储版本与本地待保存版本分开；对真正的并发更新使用 expectedRevision，不能依赖两次 read 后再 write。

### 6. [P1] 指定标签截图可能返回另一标签的画面

位置：`src/agent/vnext/host/browserSysHost.js:136`。

sysScreenshot 解析 tabId 后只把 windowId 交给 captureVisibleTab，结果却标注 tabId 为请求标签。如果请求标签在后台，API 实际截图的是该窗口前台标签。agent 可能据此做出错误的页面判断。

模拟 inactive tab 99：仍返回 ok:true 和 tabId:99，期间没有激活或检查当前活动标签。

Chrome 官方明确说明该 API 捕获指定窗口的当前活动标签：[tabs.captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)。

建议：明确只允许当前可见标签并验证身份；或使用按目标绑定的 CDP 截图。若选择切换标签，还需处理用户切换与截图之间的竞态。

### 7. [P1] 停止 guest 不等于停止浏览器操作

位置：`src/agent/vnext/service/sessionWorkspaceService.js:792`；`src/agent/vnext/adapters/sandboxClient.js:125` 附近；`browserSysHost.js:666`。

AbortSignal 到达 guest，但 workspace_sys 没有 executionId、取消消息和宿主取消登记。withTimeout 只停止等待，不撤销已发出的页面代码、fetch 或 CDP 命令。默认 run 为 15 秒，eval/page fetch 宿主等待 20 秒，CDP 等待 60 秒，存在 guest 已超时而宿主仍执行的时间段。

因此“停止之后任务不会再对页面产生影响”不成立。这里由完整调用链静态确认；未执行真实页面延迟副作用实验。已经发出的外部请求也不能简单承诺可以撤销。

建议：调用携带 executionId/callId/deadline；撤销后拒绝新调用；对可取消的 fetch 传递 AbortController；追踪已发出操作的最终结果。不可取消的操作标记为结果未知，重试前核查后置状态。CDP 附着应具有明确的 owner 和释放策略。

### 8. [P2] fetch 的大小限制不是下载过程中的限制，正文也未完整受超时约束

位置：`browserSysHost.js:441`、`:464`、`:607`。

扩展 fetch 的 withTimeout 仅包围收到 Response 前的阶段；arrayBuffer 在其外等待。两种 fetch 都先完整读取正文，之后才检查 8 MiB 上限。大文件或持续响应能在 TOO_LARGE 返回前消耗大量内存；扩展正文读取也可以超过声明的超时。

建议：流式累计字节，超过上限立即取消读取；deadline 覆盖 headers 和 body；二进制直接进入 artifact/blob 存储，模型结果只携带引用及摘要。

### 9. [P2] sys 错误码跨 sandbox 后丢失

位置：`src/agent/vnext/adapters/sandboxClient.js:87` 附近；`src/sandbox/runtime.js:69` 附近；`codeRuntime.js:559`。

createGuestSys 将 SYS_DENIED、CDP_BUSY 等写入 Error.code；sandboxClient 只传 error 字符串，sandbox runtime 和 QuickJS 又创建新的 Error，不保留 code。guest 无法稳定通过 e.code 决定恢复路径。

建议：统一可序列化错误 envelope，保留 code/message/details/retryable；在 QuickJS 错误对象上恢复字段。

## 架构上的重要缺口

### 存储提交不是原子的

durableStore 对每个集合分别调用 idbPut，每次独立事务；OPFS 文件覆盖又发生在 IDB 元数据提交前。中途失败或进程终止可能留下不同代的文件与元数据。修好 Promise 队列仍不能解决这一点。

建议先写不可变 blob，再用一次 IDB 事务发布关联元数据与 blob 指针；成功后回收旧 blob。仅把现有代码包进一个库不够，提交协议本身需要明确。

### 执行缺少幂等身份与会话串行入口

background.forwardWorkspaceRpc 会重试未获得响应的调用，没有 requestId 去重。服务 sendMessage 直接覆盖 `_activeBySession`，并发入口没有排队/拒绝；前一个调用 finally 还可能删除后一个调用的 session slot。响应丢失不代表操作没有发生，盲目重发可能重复创建消息或执行任务。

建议 durable requestId/executionId，加会话级串行入口；“已接收”和“已完成”分开返回。崩溃恢复时保留操作回执，对结果未知的外部写入先查证，不能直接重放。

### 当前隔离主要是 JS 运行环境隔离，不是完整能力边界

guest 没有直接接收 chrome/store；postMessage 两端有 source 检查，这些设计有价值。但 workspace_sys 路由没有校验 sender，也不验证 execution/session 所有权。targetId 路径不经过 tab URL 检查，CDP 状态与事件按 target 全局共享。

这不等于普通网页可以直接调用 runtime 消息，也不是已经验证的任意网页漏洞。当前可确认的是内部权限代理缺少来源与任务约束。若产品有意允许全浏览器操作，应保留这个能力，同时保证可信入口、任务归属和可追溯性。

### 长任务需要本轮上下文管理

已有轮次开始时的历史压缩；ToolLoopAgent 的 stopWhen 始终 false。prepareStep 当前主要处理工具列表与计划指令，没有对本轮不断增长的工具结果做压缩/外置或检测重复失败。

建议保留用户期望的持续工作能力，但按 token、时间和重复错误观测进展；大输出放文件，保留必要的近期调用与证据。工具始终可见不是本次发现的问题。

### 可编辑画布不等于 Office 高保真互操作

Univer、tldraw 与 artifact 层是成立的产品基础，但内嵌编辑器可用不能证明复杂 DOCX/XLSX/PPTX 的导入、编辑、导出能无损往返。此项本次未做样本验证，不能当成已确认缺陷，也不能据接口名宣称实现。

需要真实样本文档覆盖公式、样式、分页、图片、字体和导出后的重开。网页预览也需要区分静态 HTML 编辑、脚本交互和真正部署。

### vendor 缺少可复现构建材料

仓库跟踪打包后的运行时，但未发现跟踪的 package manifest/lockfile/构建脚本。vendor README 的 npm run build:* 在本仓库无法重建。日常无需 npm 可以保留，同时在独立构建目录维护版本锁、入口、生成命令和许可证清单。

## 技术愿景的边界

| 目标 | 判断 | 条件 |
|---|---|---|
| 利用已登录页面完成网页任务 | 可行 | 稳定目标身份、页面状态检查、失败恢复 |
| 在沙箱内编程组合浏览器能力 | 可行 | 保留 QuickJS；补宿主调用生命周期 |
| 会话内创建并编辑多种交付物 | 可行 | 修复持久化与编辑器保存，再验证格式质量 |
| 长任务、关闭侧栏后继续工作 | 架构支持，可靠性未闭合 | 执行记录、幂等请求、上下文预算和恢复 |
| 不受限制读取任意网页/受保护内容 | 不能承诺 | 浏览器 API、页面身份、CORS/CSP 与受保护内容仍有边界 |
| 完整控制操作系统、任意本地工具 | 当前纯扩展不是该能力 | 若确有需求，另设可选 native companion，不必现在迁移全部 runtime |

Chrome `userScripts.execute` 需要 135+；manifest 仍写 115，应提高要求或清晰暴露能力降级。MAIN 与 USER_SCRIPT 世界有不同约束，不能把 page fetch 理解为绕过所有站点限制。[官方 userScripts 文档](https://developer.chrome.com/docs/extensions/reference/api/userScripts)

Chrome 118 起活动 debugger 会话会保持 SW 存活。因此没有将“CDP 必然因正常空闲休眠失效”列为缺陷；应检查显式 detach、重载/崩溃、owner、事件丢失及并发 attach。[官方生命周期说明](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

## 改进顺序与现有方案

1. **先保证保存可信。** 修复问题 1–5；明确 metadata/blob 提交协议及 artifact revision。验收以磁盘失败、慢保存和重启后的真实内容为准。
2. **再保证操作可信。** 修复截图目标，贯通取消与错误码，限制流读取；增加调用身份、会话串行与重试去重。
3. **建立可重复验证。** 用 Playwright 的扩展 persistent context 加载本目录，在独立 profile 中测试真实浏览器边界。现有官方测试路径可复用，不需要自造浏览器测试框架。[Playwright 扩展测试](https://playwright.dev/docs/chrome-extensions)
4. **最后扩展产品深度。** 用真实任务评估长程成功率和交付物质量，再决定是否引入 native companion、更多格式引擎或远程执行。

存储可比较小型 IDB 包装层与 Dexie：现有原生实现改动最少，但事务/迁移维护由项目承担；Dexie 提供现成事务组合能力，引入与迁移成本更高，也不会自动解决 OPFS 与 IDB 的一致性。采用前应锁定版本并核对许可证、升级记录和体积。本次仅核对了 Dexie 的事务机制，未完成版本级选型。[Dexie transaction](https://dexie.org/docs/Dexie/Dexie.transaction())

不建议仅因这次缺陷替换 AI SDK、QuickJS、Univer 或 tldraw。优先修它们之间的协议。tldraw 的生产使用还需按具体捆绑版本与许可证核对，不能把“保留水印”当作生产授权结论；官方当前要求生产 license key。这不影响本次本地实验审查，也不是要求立即替换引擎。[tldraw license key](https://tldraw.dev/sdk-features/license-key)

## 尚未完成的实机证据

- Chrome 用户脚本开关关闭、限制页、DevTools 冲突与同目标并发 attach 的具体错误表现。
- 停止后延迟页面副作用是否仍发生；重试是否产生重复外部操作。
- IDB/OPFS 真实配额失败、中途关闭进程以及下一次启动恢复。
- 两个会话操作同一标签/交付物时的结果隔离。
- 原生 Office 格式导入导出往返、长任务上下文增长和实际模型成功率。

这些是下一阶段验收工作，不改变本次已定位的保存和截图缺陷。当前证据支持继续建设这一架构，但不支持宣称整个产品已达到可靠自动化与持久交付的完成状态。
