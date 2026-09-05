# 浏览器作为计算环境：当前实现与下一步

## 本轮落地

本轮在现有架构上修复可靠性，没有迁移 agent 框架或引入新运行时依赖。继续使用原生 IndexedDB 事务、AbortController、ReadableStream 和已捆绑的 QuickJS；这些能力足够解决本轮问题。更换数据库库不能代替文件与元数据之间的提交协议。

- 文件替换采用新 OPFS 路径，元数据一次 IDB 事务提交成功后才回收旧文件；失败保留待保存修改，后续可重试。
- OPFS 不可用时，新的文件字节写入 IDB；恢复 OPFS 后可迁移。已有 OPFS 引用不会因暂时不可用而被清空。
- 文档与表格保存排队，保存期间的新编辑会接续落盘；失败返回 office RPC。画布与网站保存串行化，成功后才推进已保存基线。
- 四种编辑器的保存携带 expectedRevision，宿主同步校验后写入。常用 office 工具也携带其读取版本；raw guest 对已有交付物主文件的写入会推进版本。过期的不同内容被拒绝，相同内容的重试可安全确认。
- sandbox 仅在运行时监听器已安装后报告 ready，删除了过早宣告就绪的旧脚本。guest 错误码可跨运输层保留。
- 浏览器调用具有 callId、sessionId、executionId 和 deadline。停止/超时可取消扩展 fetch；对于已派发的页面代码/CDP，返回结果未知，不声称副作用已撤销。
- 网络正文流式累计字节，超过限额取消；截止时间涵盖扩展 fetch 正文读取。页面 fetch 也具有内部读取上限和超时。
- 截图在捕获前后检查当前活动标签，避免将其他标签截图标成目标；仍不是原子快照，不适合需要严格文档身份的视觉执行。此类需求应使用 CDP 目标及文档生命周期绑定。
- sys 入口只接受 offscreen runtime。并发 CDP 调用共用正在建立的 attachment；另一 debugger 占用返回 CDP_BUSY，不再误认已附着。
- 同一 session 的第二次执行明确返回 busy。RPC 响应丢失时，不自动重放可能已有副作用的请求；仅对未能建立接收端连接的错误重试。

## 从能力列表变为可组合的计算环境

浏览器已经提供进程式的标签、页面执行世界、网络、图形输出和持久存储。产品最有价值的部分是使它们共享可追踪的文件与任务身份。

现在 guest 可以直接把获取结果写入工作区：

```js
console.log(await sys.capabilities());

const receipt = await sys.fetch({
  as: 'page',
  tabId: 123,
  url: '/api/report.csv',
  saveTo: '/scratch/report.csv'
});
console.log(receipt.path, receipt.bytes, receipt.status);
const csv = await fs.readFile(receipt.path);
// 在这里转换数据，最后写入 /artifacts 作为交付物。
```

`saveTo` 同样支持 screenshot；写入 `/artifacts` 的文件会由 run 的原有机制验证并登记。失败 HTTP 响应不会通过 saveTo 被悄悄当作成功文件。该接口避免将 base64 放入 guest/model 上下文，但 SW→offscreen 当前仍使用 base64 RPC，仍受单次大小限额约束。

这比让模型搬运几百万字符更接近真正的计算环境：模型决定操作和解释结果，文件承担数据运输，代码处理内容。

## 下一步值得建设的核心

### 1. 可恢复的任务与操作记录

当前 callId 和取消登记在 SW 内存中；它们不是 durable journal，也没有跨崩溃 exactly-once 保证。

下一步应把 requestId、执行状态、输入引用、操作回执和检查点保存在 offscreen store。启动时区分尚未派发、确定成功、确定失败、结果未知。对于结果未知的网页写入，先读取后置状态，再决定是否重试。

这能支持真正的长任务、浏览器重启后的接续，以及对重复提交的解释。不要在恢复时直接重放所有工具调用。

### 2. 有版本的交付物

本轮已接入 revision/expectedRevision，旧记录以 revision 0 兼容；画布不再依靠“两次读取再写入”猜测冲突。回执返回提交版本，冲突保留本地修改。

这仍不是完整的协同编辑：旧调用方允许省略 expectedRevision，raw guest 写入会推进版本但本身不携带读版本，自动合并与冲突解决界面尚未实现。下一步应统一所有读改写路径的前置版本，并提供保存冲突副本及比较功能，不能声称已经实现全产品无丢失并发编辑。

### 3. 大数据经过文件，不经过消息

下一阶段可以增加分块写入、可续传读取、文件切片和有背压的 RPC 流。大数据转换放在 worker/WASM 中；模型只读取样本、schema 和统计结果。先用实测数据定位瓶颈，再评估数据库或分析引擎，避免为“超级计算机”的比喻堆积运行时。

当前持久化仍会导出内存快照；大工作区需要进一步改成记录/文件的增量提交。新文件发布前崩溃可能留下未被引用的 OPFS 文件，应补带宽限期的 orphan GC。暂不自动清理无法证明归属的文件。

### 4. 文档身份与浏览器事件

tabId 标识标签，不标识导航前后的同一文档。需要把 documentId、导航代次和 CDP session 纳入页面引用，对过期目标明确失败。

CDP attachment 还需要明确 session owner、跨 run 复用和释放策略；当前没有完成会话级资源管理。网络事件应支持游标、丢失计数和查询，不能让固定长度事件数组冒充完整日志。

### 5. 按结果验收长任务

保留持续执行能力，增加本轮上下文压缩、工具结果外置和重复失败检测。长程能力通过真实任务验证：操作是否完成、文件重开是否正确、是否重复提交、用户停止后还有哪些未决操作。

本轮没有实现自动跨崩溃恢复、原生操作系统控制，也没有验证高保真 Office 往返。若未来需要任意本地工具或浏览器外计算，再加入可选 native companion；浏览器侧的会话与权限边界仍应保留。

## 验证证据

- `tests/runtime-regression.test.mjs`：磁盘失败后的恢复与原子性、OPFS 替换失败、慢文档/表格保存、画布重试与冲突、截图目标、流读取限额、fetch 取消、saveTo、CDP 并发与权限探测。
- `tests/browser-smoke.cjs`：独立 Chromium 加载真实扩展；实际 IDB/OPFS 关闭重开；真实 QuickJS 和 sandbox 错误往返；run→文件→artifact 登记；非 offscreen sys 请求拒绝；真实 localhost fetch 与正文超时；offscreen RPC 版本冲突拒绝。
- 实机结果：`output/playwright/browser-evidence.json`。测试使用模拟下载内容验证 artifact 链路，并单独测试真实网络；没有调用付费模型。

`TECHNICAL_REVIEW.md` 保留为修复前审查记录。其缺陷列表不应直接当作当前状态；以上说明记录本轮已完成内容及仍未实现的边界。
