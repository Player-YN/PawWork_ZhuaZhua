# Office Agent 架构 — 冻结计划

**Status:** superseded (historical). Kernel + inventory office tools still hold. Visual SoT is tldraw `pawCanvas`, not `sceneModel` + HTML plates. Websites are HTML (`data-paw-kind=site`) opened as a page. Current: [SESSION_WORKSPACE_RUNTIME.md](./SESSION_WORKSPACE_RUNTIME.md) · [PROMPT_RUNTIME.md](./PROMPT_RUNTIME.md) · [ENGINE_CANVAS_A.md](./ENGINE_CANVAS_A.md).

**Goal:** 网页 Agent 在长会话里保持三件内核工具；办公交付物一旦进入会话，才露出对应画布短工具；表/文走 Univer 快照，视觉走自研场景模型。模型循环是 World → Act → Verify。

**Architecture:** `inspect` / `acquire` / `run` 常驻。`run` 负责沙箱计算和 **第一次落地** 办公文件。`canvasInventory` 从 `/artifacts` 识别 `sheet` / `deck` / `poster` / `doc`。`prepareStep` 按库存注册 `sheet` / `deck` / `doc` 短工具。工具跟会话库存走，不跟 Chrome 标签焦点走。视觉 SoT 是 `sceneModel`（HTML 是视图）；Univer Slides 不当引擎。MCP 只留目录空壳，不进模型 tool 列表。

**Real entry:** Chrome 加载 `artifacts/unpacked/` → 开侧栏同一 Session → 先只做网页选区任务，再「做成表/幻灯/文档」→ 交付物出现后同一轮或下一轮能点选微调。

**Done if:**

1. 无办公交付物时，模型 `tools[]` 只有 `inspect` / `acquire` / `run` / `clarify`；system 不教 A1 / slot 写入。
2. `run` 写出 xlsx 或带 `data-paw-kind` 的 HTML 后，**同一次** ToolLoop 后续步骤出现对应办公工具。
3. 切到别的网页标签，办公工具仍在；删掉该交付物后对应工具消失。
4. `sheet.write` / `deck.write` 可省略 target（用 focus）；返回 dirty + 读回；错误带 `available`。
5. 视觉编辑改 scene 快照，不靠 `replacePlate` 当常规；Univer Docs Agent 协议不再是 p/h1/img 积木。
6. `npm run test:session-workspace:all` 绿；`npm run pack:extension` 可加载。

**Not done if:**

- 第一回合就塞 `sheet`/`deck`/`doc`。
- 按当前预览 tab 是否在前台增删工具。
- 办公 mutate 仍走 `run.op`。
- 引入 `@univerjs/slides` 或 `@univerjs-pro` 当协议。
- 把 MCP/Canva 原子工具登记进 ToolLoopAgent。
- 弹「是否使用 Office 工具」。

**Not this wave:** Canva waitlist 真接、公式 headless、PPTX 场景映射大改、表→幻灯图表、HITL 每格审批。

---

## 冻结决策

1. **内核 vs 画布：** 网页三件常驻。办公三件（`sheet` / `deck` / `doc`）在 **该类交付物出现于 session 库存** 后才注册；创建走 `run`。
2. **授权粒度：** session 库存，不是 tab 焦点。焦点只更新 A1 / plate+slot 提示。
3. **对人无感：** 不问是否用 Office。第一次连外部账号（未来 MCP）才授权。
4. **文字双轨：** 版式报告/PDF 复刻 = HTML plates；长文 Word = Univer Docs 真快照。不收敛成一条。
5. **视觉：** 自研 `sceneModel` + HTML 视图。不借用 Univer Slides 当引擎；将来最多当渲染后端。
6. **Agent 契约：** 短动词、target 可省、写完回读、错误带可选菜单；同一能力一个入口（禁止 QuickJS 改表/改槽）。
7. **MCP：** 目录空壳本波预留；Client 网关 + Canva 具名集成是下一波。模型永不看见对方 30 个原子名。

---

## 模块：加 / 改 / 留 / 禁

### 增加

| 模块 | 职责 |
|------|------|
| `sessionWorkspace/canvasInventory.js` | 从 artifacts 判定 `{ sheet, deck, poster, doc }` 及 id 列表 |
| `sessionWorkspace/officeTools.js` | `sheet` / `deck` / `doc` schema + execute；无库存 → `NO_CANVAS` |
| `sessionWorkspace/toolSchedule.js` | `prepareStep`：base + 库存并上的办公刀 |
| `sessionWorkspace/sceneModel.js` | 视觉 SoT：pages / boxes / slots；hydrate ↔ 标记 HTML |
| `sessionWorkspace/sceneApply.js` | `read` / `write` / `layout` / `theme` / `setBox`；`replacePlate` 逃生舱 |
| `sessionWorkspace/docsModel.js` | Docs Agent 协议对齐 `getSnapshot()` / Facade |
| `sessionWorkspace/capabilityCatalog.js` | 空壳：`list` / `invoke` 形状；本波不接真实 MCP |

### 修改

`tools.js`（`run` 去掉日常 mutate）· `sessionAgent.js`（prepareStep）· `sendMessage.js`（世界卡片带 inventory）· `prompt.js`（政策按库存插）· `htmlPreviewMarker.js` / `artifacts.js`（`canvasKind`）· `htmlApply.js`（槽留下，layout/theme 迁出）· `docsApply.js` + `docs.js` · `sheetApply.js`（mutate 入口改 officeTools）· `artifactPreview.js`（框跟 scene）· `sessionWorkspaceService.js`（库存派生，切 tab 不 clear）· skills 四份 · 调度测试

### 保持

内核三件 + clarify · SelectionGroups 只读 · QuickJS 沙箱 · Durable store / guest FS · `sheetModel.js` `fromAgent` · Univer Sheets 宿主 + `paw/workbook.json` · Univer Docs **引擎** · `data-paw-slot` 点选 · `printHtml.js` · 提问级 undo · 技能当 playbook · BYOK / 扩展-only

### 禁止

`@univerjs/slides` 宿主 · `@univerjs-pro` · Office 启用 UI · tab 焦点闸工具 · `tools.js` 继续堆 `op=` · 手写第二套 agent loop · MCP 原子进 tools[]

---

## Wave 0 — 宪法对齐（文档，短）

- [x] `AGENTS.md`：办公工具 = **库存出现后注册**，不是「live tab 打开时」。删掉和「必须草稿直到 Accept」残留矛盾。
- [x] `docs/SESSION_WORKSPACE_RUNTIME.md`：补 canvas inventory、`run` 只创建、办公 mutate 短工具、World/Act/Verify。
- [x] 本文件保持为执行清单；实现时只改这里的 checkbox，不另起一套北星。

---

## Wave 1 — 库存与换刀（第一刀，必须先做）

没有这一层，后面场景/Docs 都会接错工具。

- [x] **`canvasInventory.js`**
  - 输入：session artifacts + 文件头/ mime。
  - 输出：`{ sheet: ArtifactId[], deck: [], poster: [], doc: [] }`。
  - 算画布：xlsx/csv/tsv；HTML `data-paw-kind=deck|poster|document` 或 `data-pawwork-preview=blocks`；Docs 快照。
  - 不算：普通 `.md`、未标记 HTML。
- [x] **`toolSchedule.js` + `sessionAgent.js` `prepareStep`**
  - 每步：`inspect+acquire+run+clarify` ∪ 库存对应的 `sheet`/`deck`/`doc`（poster 并进 `deck` 工具，kind 在参数/世界卡片里区分）。
  - 同轮：`run.write_artifact` 返回后下一步必须能看见新刀。
- [x] **从 `run` 拆 mutate**
  - `run` 保留：code、write/update_artifact、read、write_package_file、`createWorkbook`、`ingestPdf`。
  - `op=sheet|html|doc` 的日常 write/reshape 迁到 `officeTools.js`。
- [x] **`prompt.js` / `sendMessage.js`**
  - World 卡片：`bound` + `canvases` + `focus` + 本轮 `tools` 含义。
  - 无 `canvases.sheet` 则 system **不出现** A1 教程；无 deck 不出现 slot 教程。
- [x] **宿主拒绝**
  - 无库存调用办公工具 → `{ ok:false, code:'NO_CANVAS', hint:'page tables → inspect; create → run write_artifact' }`。
  - 错误尽量带 `available`（槽名 / 表名）。
- [x] **测试（真实 `createSessionTools` + 调度，禁止假工具表）**
  - 无画布：tools 键只有四件内核。
  - 写出 deck HTML 后同轮出现 `deck`。
  - 写出 xlsx 后出现 `sheet`，不出现 `deck`。
  - 删交付物后刀消失。
  - 不依赖 tab 焦点。
- [x] Skills：无画布用 `run` 创建；有画布后用 `sheet`/`deck`/`doc`，删除「常规走 `run op=html`」表述。

**Wave 1 Done if:** 长会话前半段 tool schema 无办公；交付物一进 artifacts，同轮可改。

---

## Wave 2 — Agent 契约（省略 target + 回读）

- [x] 办公工具形状统一：`act: read|write|reshape|layout|theme` + 可选 target。
- [x] 省略 target 时钉 `activeWorkbook.overview.selection` / `activeHtml.selections[0]`（已有 `fillMissing*` 收拢到 officeTools）。
- [x] 每次 write 返回 `{ ok, dirty, readback }`；失败 `{ ok:false, error, available }`。
- [x] `inspect` 描述按库存裁剪：无 sheet 时 schema/文案不提 `view=workbook|range`。
- [x] 禁止重叠入口：沙箱 guest 无 workbook/DOM 写画布 API；办公只走 officeTools。
- [x] 测试：省略 a1/slot 的 write 打在 focus；readback 等于写入值；错误列出 available slots。

**Wave 2 Done if:** 「把这个改成 Q3」只需一次工具调用，不重填坐标系、不再 inspect 核对。

---

## Wave 3 — 视觉场景模型（第三件套压到极致）

- [x] **`sceneModel.js`：** `{ kind, pages[], boxes[] }`；从标记 HTML hydrate，serialize 回带 `data-paw-slot` / `data-box` 的 HTML。
- [x] **`sceneApply.js`：** write 槽、layout（换版式保留槽内容）、theme（换皮肤保留内容）、setBox；`replacePlate` 仅逃生。
- [x] **`artifactPreview.js`：** 拖的是页内框，不是只拖板块顺序；与 scene 一致。
- [x] **`htmlApply.js`：** 保留 parse/slot/propagateSlotSrc/draft；layout/theme 不再堆在这里。
- [x] 打印仍走 `printHtml.js`（无编辑条）。
- [x] 不新增 `slides.html`，不引入 `@univerjs/slides`。
- [x] 测试：改 title 槽不动 hero；theme 后槽文本仍在；scene roundtrip 标记 HTML。

**Wave 3 Done if:** 幻灯/海报的 SoT 是 scene，Agent 常规路径不再整页替换 HTML。

---

## Wave 4 — Univer Docs 协议抬升

- [x] **`docsModel.js`：** Agent read/write 对齐 `getSnapshot()`（段落、列表、图、批注），废弃 p/h1/img 作为 SoT。
- [x] `docs.js` 继续 Docs OSS 预设；提问级 undo 存 snapshot。
- [x] HTML document plates（`html-preview`）仍是版式文档路径；`doc` 工具只在 Docs 画布库存上出现。
- [x] 图片不再序列化成 `![image](src)` 假段落。
- [x] 测试：snapshot roundtrip；insert list/paragraph 后 getSnapshot 仍在；HTML 报告与 Docs 长文互不抢协议。

**Wave 4 Done if:** 长文路径吃饱 Univer Docs；版式报告仍走 plates/scene。

---

## Wave 5 — 目录空壳（不接 Canva）

- [x] `capabilityCatalog.js`：`listCapabilities()` / `invoke({ id, input })` 接口；空列表。
- [x] 不在 `createSessionTools` 里展开外部 tools。
- [x] `AGENTS.md` 写明：外部 MCP = 目录 + 用户 OAuth；Canva 要 waitlist + 导出落入 `/artifacts` 再 `deck.write`。
- [x] 本波 **不** 实现 HTTP MCP Client、不申请 Canva allowlist。

**Wave 5 Done if:** 扩展点在，模型 tool 列表零增长。

---

## 建议提交切片

1. `test(office): canvas inventory + prepareStep tool schedule`
2. `feat(office): split mutate tools from run; prompt gated on inventory`
3. `feat(office): omit-target write + readback contract`
4. `feat(scene): scene model + apply + preview boxes`
5. `feat(docs): snapshot protocol replacing p/h1/img`
6. `chore(office): capability catalog stub`

每片必须带驱动 **shipped** 函数的测试，禁止硬编码期望工具表而不走 `canvasInventory` / `prepareStep`。

---

## 验收命令

```text
npm run test:session-workspace:all
npm run pack:extension
```

人工：同一 Session 先网页问答（DevTools 看 tools 无 sheet/deck/doc）→ 「做成幻灯」→ 交付物出现 → 点标题改字 → 切到其它标签再说一句微调，仍打在那份幻灯上。
