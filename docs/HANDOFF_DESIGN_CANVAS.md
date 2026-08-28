# 交接：工作区图片预览 + Design 画板构图

**给下一任 Agent。先读完再改代码。用户上一轮明确：先把需求想明白；本文件是那次讨论的冻结稿。未标「已拍板」的分叉不要擅自发明。**

| | |
|--|--|
| **日期** | 2026-08-27 |
| **产品** | 爪爪 · Paw Work（Chrome MV3，Session Workspace Runtime） |
| **开发树** | `C:\Users\yyy\Desktop\PawWork-vnext` · 分支 `runtime-vnext` |
| **稳定树** | `C:\Users\yyy\Desktop\PawWork` · 分支 `main` |
| **远程** | https://github.com/Player-YN/PawWork-vnext |
| **本交接对应 HEAD** | `893bbe2` `chore: delete disconnected Konva overlay and HTML-scene mutate`（`main` 与 `runtime-vnext` 当时都在此 tip，且已 push） |
| **北星** | `SELECT + DESCRIBE OUTCOME → DELIVER` |
| **合同** | `AGENTS.md` · `docs/SESSION_WORKSPACE_RUNTIME.md` · `docs/PROMPT_RUNTIME.md` · `docs/WORKSPACE_RUNTIME_AUTHORITY.md` |
| **修订** | 2026-08-27 补：特意为之清单、测试绿基线、脆弱模块、HEAD 外未合入改动；同日续：Q1–Q3 用户已逐条拍板（见「已拍板」节，Q1 以用户原话为准） |

**下一任先读这四节，少走弯路：** [特意为之清单](#特意为之清单) · [测试与绿基线](#测试命令与绿基线) · [已知脆弱先别动](#已知脆弱但先别动) · [未合入工作区](#runtime-vnext-head-之外未合入的工作区)

---

## 你要接的工作（一句话）

用户要的不是「生图模型画一张成品海报」，而是 **可点改的排版软件**：纸张/格子由 Frame 承担，形状和图标走组件库，文案是真文字节点，**只有自定义插画才走生图，且图上不许带字**。同时，工作区里的 PNG/JPEG 点「预览」必须能看见图——这是回归，先修。

---

## Real entry / Done if / Not done if

**Real entry：** Chrome 加载 **pack 后的** `artifacts/unpacked/`（或桌面上的上架解压包），不要加载仓库根（仓库根含 `node_modules`，扩展会显示 ~384MB）。Paw ON → 工作区有图和 Design JSON → 侧栏点「预览」→ 画板里做海报/条漫。

**Done if（本交接范围内）：**

1. 工作区任意 PNG/JPEG/GIF/WebP 点「预览」打开能看见图像，下载是原图不是 `.html`。`pawCanvas` JSON 仍进 `design.html`，网站 HTML 仍进 `site.html`。
2. 原创海报/漫画的默认构图是：**Frame + 组件/图标 + 真字 +（可选）无字插画**。生图 prompt 默认无字、无台词、无 UI chrome。`compose-image` 只在用户明确要「一张融合成品图」时使用。
3. 内容多了不会全部塞进一张固定 A4。条漫/介绍长图按纸张策略分页或加长（见未决 Q1；用户未口头确认前按本文「建议默认」做，并在 PR/提交说明里写明）。
4. 画板报常用的形状/图标/对话框不再默认去生图（见未决 Q2；建议默认做 MIT 图标 + 对话框/格子/标题条）。
5. `npm run test:session-workspace:all` 绿。Chrome 里用一张 PNG 和一个条漫/海报 prompt 走通预览与构图，而不是只靠套件。

**Not done if：**

- 只改了 skill 文案，工作区点图仍空白。
- 又做回 HTML 版式编辑器 / Konva / Univer Slides。
- 把网上爬的图打进扩展当「素材库」。
- 生图整格带字，格子下面再叠一层真字（截图里的失败态原样还在）。
- 加载仓库根当「已修好」，或把 `node_modules` 打进上架包。
- 声称 MET 但没在真实扩展里点过工作区「预览」和画板改字。

---

## 用户原话（需求来源，勿改写丢意）

1. **预览：**「现在预览图像的功能没有了，工作区内所有的 image 都没有办法预览。」
2. **纸张：**「页面布局与内容承载，大模型生成的图片经常不能很好地嵌入无限画板。无限画板中的 A4 页面不能伸长，大模型不应该把不管多少内容都堆在一个页面当中。」
3. **组件：**「内置素材库与预设组件是不是缺了关键东西？真正做画板报时，很多形状或绘画图鉴完全不需要单独用生图（单独生成效果也不好）。能不能网上搜素材内置？或 SDK 是否已有形状/素材/艺术字组件库？」
4. **文字确定性：**「海报里填文字，不要让生图模型代劳。先生成一张图，文字则是真正打字，加上艺术字并调整大小。随机生图只留给自定义部分；能用组件和写字完成的，交给确定性代码。」

用户当时说先讨论、先不动代码。讨论结论在本文。**Q1–Q3 用户还没逐条回复**；下面给了建议默认，交接 Agent 若找不到用户，按建议默认做并写进提交说明。

证据截图：Design 里一张「PawWork自我介绍漫画」。左栏是 Page 1 上多组 heading+image+text；中间是竖条多格猫图，**图内烤着乱码中文**，格下又有真字「我会看！」等。这就是失败态。

---

## 项目现状（到 `893bbe2` + 工作区未提交）

### Git / 双 worktree

| 表面 | 路径 | 分支 | 当时远程 tip |
|------|------|------|----------------|
| 开发 | `C:\Users\yyy\Desktop\PawWork-vnext` | `runtime-vnext` | `893bbe2`（已 push） |
| 稳定 | `C:\Users\yyy\Desktop\PawWork` | `main` | `893bbe2`（已 push，fast-forward 自 `de8b650`） |

**继续开发只在 `runtime-vnext`。** 不要在 vnext worktree 里 checkout `main`。测完再 merge 回 `main`。

工作区 **相对 `893bbe2` 不干净**。明细见 [未合入工作区](#runtime-vnext-head-之外未合入的工作区)。另有旧 worktree `C:\Users\yyy\.grok\worktrees\desktop-pawwork\2026-08-23-3e3f8dc7` @ `485b650`（`grok/sheet-workspace-2026-08-24`），是更早的 sheet 实验，**不要从那里 cherry-pick 或当真相**。

大版本快照：`de8b650` `feat(canvas): tldraw Design/Slides and site HTML as product surfaces`。其后 `893bbe2` 删了无连接的 Konva / `sceneApply` / `sceneModel` 等。

### 产品主线（已落地，不要推翻）

```text
活网页上选中 + 说出结果
  → Session 工作区留下可打开、可点改的真文件
```

人从不选编辑器。**文件类型开门。**

| 结果 | 产物 | 表面 |
|------|------|------|
| 可点改画面（海报 / 条漫当画面 / 幻灯） | `pawCanvas` JSON（`{pawCanvas:1, shell:'design'\|'slides', tldraw:{document}}`） | `src/preview/design.html` tldraw 5.3.2 |
| 真网站 / landing | HTML `data-paw-kind="site"` | `src/preview/site.html`（就是网页，不是版式编辑器） |
| 表 | workbook | `src/preview/sheet.html` Univer |
| 长文 | Univer doc 或 `data-paw-kind="document"` HTML | `docs.html` / 通用预览 |

职责匹配（`docs/PROMPT_RUNTIME.md`）：

- **Prompt + skills 判断：** 答还是交付、哪张食谱、海报/网站/长文不清时问一次、怎么构图。
- **Runtime 绑定：** 隔离、`USE_CANVAS`（未标记的漂亮 HTML 不能当 Design）、打开路由、办公工具库存、`NEED_SELECTION` / `NEED_TAB`。

内核工具永远是 `inspect` / `acquire` / `run`。`sheet` / `deck` / `doc` / `web` **只在会话 `/artifacts` 里已有对应画布时出现**。视觉 mutate 走 `deck`（即使 shell 是 design）。

### 打开路由（现状）

`src/agent/vnext/sessionWorkspace/openClassify.js` → `previewEntryForKind`：

| kind | 入口 |
|------|------|
| `json-canvas` | `design.html` |
| `html-site` | `site.html` |
| sheet 类 | `sheet.html` |
| docs 类 | `docs.html` |
| **其它一切**（含 `png` / `jpeg` / `gif` / `webp` / 普通 HTML / PDF） | `artifactPreview.html` |

侧栏「预览」：`src/sidepanel.js` `previewSessionArtifact` → `open_artifact_preview` → `src/background.js` `openArtifactPreviewTab`。

### 已知回归：工作区图片预览是空的

`src/preview/artifactPreview.js` 在上一轮被收成「只当 HTML/PDF 网页看」。PNG 仍路由到这个文件，但 boot 对非 PDF 一律：

```js
renderHtml(item.text || '');
```

图没有文本，iframe `srcdoc` 空白。下载还按 `.html`。

**画板里已经嵌进去的图是好的**（tldraw image + asset，`hydratePawCanvasImages`）。坏的是 **工作区货架上的独立图像文件**。

侧栏另有 `imageGenPreviewOverlay`，只在生图刚成功时弹，不是货架预览。

**该怎么加回去（已对齐，可直接做）：**

- `classifyOpenArtifact` 得到 `png|jpeg|gif|webp` 时，在 `artifactPreview` 用 blob URL / `<img>`（或 `<object>`）渲染 `base64` 字节，不要 `renderHtml`。
- 隐藏「保存」（没有 HTML 可写回去），「下载」用真实 `mimeType` + 原文件名。
- 不要把图重定向进 `design.html`（图不是 `pawCanvas`）。
- 可选加分：货架缩略图。不是本交接的 Done if。
- 加测试：打开分类仍是 `artifactPreview.html`；viewer 对二进制图走图像分支（可抽纯函数测，避免无头 Chrome）。

### 画板编译现状（构图问题的根）

| 事实 | 细节 |
|------|------|
| 无限画布 | tldraw **page** 无限 |
| 纸 | tldraw **frame**。**不会因为子节点多了自动长高**，溢出裁切。人手可拉边；编译默认不拉、不加页 |
| Design 空画布默认 | `engineCanvas.emptyPawCanvas`：`960×1440`（竖，接近但不是毫米 A4） |
| `createScene` poster 默认 | `sceneCompile.POSTER_SIZE`：`720×1080`（两套默认不一致） |
| Slides 默认 | `1920×1080` 或 compile 侧 `960×540` |
| 模型习惯 | 8 格漫画全塞进 Page 1 一张纸 |
| 节点类型 | `createScene` 主要落成 `image` + `text`（headline 也是 text）。几何 `geo` 很少被模型用 |
| tldraw 已有 | `GEO_TYPES`：矩形/圆/三角/星/心/云/六边/箭头/勾叉等；`SHAPE_TYPES`：geo/text/frame/image/note/arrow/line/highlight |
| tldraw **没有** | 插画图鉴、贴纸、对话框组件、花字引擎、图标包。字体仅 `draw/sans/serif/mono`，CJK 的 `draw` 很差 |
| 生图 | `acquire action:image` → PNG 进 `/artifacts`；`compose-image` skill = 一张融合成品 |
| 拆图合同 | `visual-compile` / `fromRaster`：**字做成 text，图只裁照片**。原创海报/漫画 **没有同等硬约束** |
| 弱保护 | `ensureNotCoverOnly`：整板只有一张图、零个字节点时才会补标题。挡不住「每格一张带字插画」 |

`deck` 已能：`createFrame` / `createShape` / `setSlotText` / `setSlotSrc` / 对齐分布等。缺的是 **策略 + 库 + 生图禁字**，不是再做一个编辑器。

### 上一轮已删（不要救活）

无预览页、无工具调用、无 skill resource 的：

- `src/preview/htmlCanvasPatch.js`、`artboardHistory.js`、`vendor/konva.js`、`scripts/build-konva.mjs`、npm `konva`
- `sceneApply.js` / `sceneModel.js`
- `html-preview` 的 poster/slide 模板（resources 本来就没挂）
- 对应单测 `test_artboard_history.mjs`、`test_html_canvas_patch.mjs`

未注册、工作区可能已删未提交：`skills/csv-table/`、`skills/markdown-report/`，以及 `html-deck` / `html-poster` 的 HTML 版式模板 + `fillTemplate`。

### 还连着、不要当「无连接」乱删

| 块 | 还接谁 |
|----|--------|
| `htmlApply.js` parse/serialize/`inspectHtml` | `createScene`、PDF 复刻、`inspect view=html` |
| `applyHtmlCommands`（同文件大块 mutate） | 生产路径已不调用；和 parse 缠在一起 |
| `htmlArtboard.js` | `write_artifact` 的 `resolveHtmlUpsertTarget` |
| `artifactStage.js` / `printHtml.js` / `artifactExport.js` | PDF 复刻、导出 |
| `html-preview` 的 `report.html` | 长文档 skill |
| agent 根 `src/agent/{draftStore,artifacts,...}.js` | 侧栏草稿轨，不是 workspace 真相 |

`docs/OFFICE_AGENT_PLAN.md` 已标 superseded（视觉 SoT 不再是 HTML plates）。

### 上架体积（旁路事实）

- 加载 **仓库根** → Chrome 显示约 **384MB**（`node_modules`）。那不是上架包。
- `npm run pack:extension` → `artifacts/unpacked/`，无 `node_modules`。曾抽出桌面 zip 约 **10.5MB** / 解压约 **41MB**。
- 打素材库时盯 CWS 体积。CJK 展示字体、照片库存会炸包。图标 SVG 集合体积可接受。

---

## 讨论已经对齐的产品合同（可当已拍板）

### 构图栈（必须）

```text
用户要可点改的画面
  → 选纸：固定海报 | 多页 | 长卷
  → 骨架：Frame + 组件/图标 + 真字     ← 确定性
  → 插画：只给「自定义」的图，且无字   ← 随机
  → 打开 Design：点格改字、换图、拉页
```

一格正确结构：

```text
Frame「我会看」
  ├─ geo 底 / 描边 / 气泡     ← 组件
  ├─ image 猫看照片           ← 生图，no text / no letters / no captions
  └─ text「我会看！」          ← 真打字，可改字号颜色
```

错误结构（截图）：每格一张生图，台词写进生图 prompt，图上乱码中文，格下再叠真字。

### 纸张（原则已拍，具体默认见 Q1）

- 无限画板 ≠ 纸会跟着长。要长高或加页，必须 **改 frame 尺寸或 `createFrame`**。
- 招聘/活动一张印：锁死纸；装不下就减内容或换更大的纸，不偷偷长高。
- 条漫/自我介绍：长卷或一格一 Frame，禁止 8 格捏进一张 A4。
- 幻灯：多页 16:9。
- ~~宿主应执行分页/加长~~ **2026-08-27 用户拍板推翻：** 纸张数量/排版/尺寸全由模型判断；宿主只提供排版能力（多 Frame、自定尺寸、加页/改高 ops、一致的默认值），不做决策性强制。选纸/分页的判断指引写进 playbook。

### 素材库（原则已拍，范围见 Q2）

- tldraw SDK **不够**当画板报组件库。几何体和四种字体已有。
- **不要**爬网图打进扩展。许可证 + 体积 + CWS。
- 网上搜图走现有 `acquire`（用户点名要一张图时），不当默认库存。
- 花字：tldraw 只能字体族/字号 S–XL/颜色/对齐。**第一期不做变形花字引擎。** CJK 展示字体很大，不默认打包。先做好「真字可调」。

### 生图禁字（原则已拍，强度见 Q3）

- 文案只走文字节点（`createScene` text / `deck setSlotText`）。
- 图标、格子、色块、对话框不走生图。
- `compose-image` = 用户明确要一张融合成品 PNG 时才用，不是画板默认。
- 只改 skill 不够；宿主要能给 `acquire image` 追加 no-text（成品融合除外）。

### Prompt vs runtime（本需求上的配对）

| | Prompt 判断 | Runtime 绑定 |
|--|-------------|--------------|
| 要不要生图 | 角色/场景/风格才生 | 给图标库、geo、text；生图不是唯一出口 |
| 生图 prompt | 明确无字 | `acquire image` 默认追加 no-text |
| 文案落点 | 全部 text 节点 | 可收紧「每格整图、字很少」的编译 |
| 纸 | 选固定/多页/长卷 | 溢出则加页或加长，禁止单帧硬塞 |
| 改字 | 点中再改 | `NEED_SELECTION` 已存在 |

---

## 已拍板（2026-08-27 用户逐条回复；下方原「建议默认」表格保留供参考）

**用户拍板结果：**

- **Q1（用户原话，权威）：**「用多少纸张、如何排版、该用什么尺寸……全部都交给大模型的智能来决定。由大模型来排，排版能力由宿主提供，宿主本身不负责决策性内容。」→ 原 B/C 建议默认作废；宿主不做强制分页/选纸，只补齐能力（多 Frame、自定尺寸、`createFrame`/改高、对齐 `emptyPawCanvas` 与 `POSTER_SIZE` 默认值），选纸/分页判断写进 `html-poster` / `html-deck` playbook。
- **Q2：选 B** —— MIT 图标子集（Lucide 一类）+ 对话框/漫画格/标题条/色块 SVG 预设。
- **Q3：选 B+弱C** —— `acquire image` 默认追加 no-text（`compose-image` / 用户明确要融合成品时豁免）；编译发现「每格整图、几乎无字」仅警告不拒绝。

---

**Q1 纸张策略**

| | 何时 |
|--|------|
| **B 一格一 Frame，竖排无限画布** | 条漫 / 介绍长图（建议默认） |
| **C 固定纸，满了开第 2 页** | 可打印海报 / 幻灯 |
| A 长卷只加高 | 可作为 B 的变体，同一 Frame 加高 |
| D 宿主不管 | **禁止** |

**Q2 素材库第一刀**

- **建议 B：** MIT 图标（Lucide 一类）+ 对话框/格子/标题条/色块。体积小、许可清。
- 不建议第一刀只做 A（只用现有 geo）——解决不了「放大镜还去生图」。
- C 线稿插画包：等体积和许可，不进第一刀。

**Q3 生图禁字绑多死**

- **建议 B + 弱 C：** 宿主给 `acquire image` 追加 no-text（明确 `compose-image` / 融合成品除外）；画板编译若「每格整图、几乎无字」警告或要求拆，不必第一刀硬拒导致什么都交不出来。
- 禁止只做 A（只改 prompt）。

若用户之后改口，以用户为准，并改本文件。

---

## 建议实现顺序（可并行的已标）

1. **修工作区图像预览**（独立、应先做）。`artifactPreview.js/html` + 分类测试。Chrome 点货架 PNG 验收。
2. **纸张策略（Q1 默认）**  
   - `createScene` / `compileSceneToPawCanvas`：条漫/多格不要单帧 960×1440 硬塞。  
   - `html-poster` / `html-deck` playbook：写明选纸；一格一 Frame 或溢出 `createFrame`。  
   - 对齐 `emptyPawCanvas`（960×1440）与 `POSTER_SIZE`（720×1080），不要两套默默不一致。  
   - Frame 仍不「魔法自动长」；加长是改 `props.h` 或新 Frame。
3. **生图禁字（Q3 默认）**  
   - `acquire` image 路径追加 no-text（可配置豁免）。  
   - `html-poster` / `compose-image` 边界写清。  
   - 弱编译检查可选，不要误伤用户选中的照片。
4. **组件库第一包（Q2 默认）**  
   - 扩展内 SVG/geo 预设：对话框、格子、标题条、常用图标子集。  
   - 模型可 `createShape` 引用；用户可在 tldraw UI 插入。  
   - 不要为这个去 HTML 版式。
5. 回归：`npm run test:session-workspace:all`。真机：预览 PNG；用「做一张自我介绍条漫」看是否还把字烤进图、是否还单页硬塞。

---

## 关键文件

| 路径 | 角色 |
|------|------|
| `src/preview/artifactPreview.js` | **预览回归点**。现在只 `renderHtml` |
| `src/preview/artifactPreview.html` | 通用预览壳 |
| `src/sidepanel.js` | `previewSessionArtifact` / `openArtifactPreviewIds` |
| `src/background.js` | `openArtifactPreviewTab` / `resolvePreviewRoute` |
| `src/agent/vnext/sessionWorkspace/openClassify.js` | 打开路由 |
| `src/preview/design.js` | tldraw 宿主 |
| `src/agent/vnext/sessionWorkspace/engineCanvas.js` | pawCanvas SoT、编译、`ensureNotCoverOnly`、图片 hydrate |
| `src/agent/vnext/sessionWorkspace/canvasOps.js` | `deck` ops、`GEO_TYPES`、`createFrame`/`createShape` |
| `src/agent/vnext/sessionWorkspace/sceneCompile.js` | `createScene` / fromPage / fromRaster |
| `src/agent/vnext/primitives/acquire.js` | 含 `action:image` |
| `src/agent/vnext/skills/html-poster/` | 原创海报 playbook（需加构图/禁字/纸张） |
| `src/agent/vnext/skills/html-deck/` | 幻灯 |
| `src/agent/vnext/skills/visual-compile/` | 拆扁图 → 真字+裁图（合同已对，原创未对齐） |
| `src/agent/vnext/skills/compose-image/` | 一张融合 PNG，不是画板默认 |
| `src/agent/vnext/skills/html-site/` | 真网站，不要画进 Design |
| `docs/PROMPT_RUNTIME.md` | 判断 vs 绑定 |
| `docs/product-tree.html` | 产品思维导图（可拖节点、点开详情） |
| `docs/eli5-architecture.html` | ELI5 架构图 |

---

## 测试命令与绿基线

**没有 Harbor / 离线「完成率 %」评测。** 绿基线是结构门 + 场景模拟。套件绿 ≠ 产品 MET（AGENTS 规则 13）。真机预览和条漫构图必须另走。

| 命令 | 作用 | 本交接测量时 |
|------|------|----------------|
| `npm run test:session-workspace` | 只跑 S-A…S-R 验收门（`run_gate.mjs`） | 18/18 PASS，`pendingCount=0`，打印 `GATE PASS: all Session Workspace acceptance cases green (S-A…S-R).` |
| `npm run test:session-workspace:all` | 上门 + 办公/画布/打开路由等全部列在 `package.json` 里的脚本 | **PASS**（2026-08-27，在 **含未提交 skill/测试改动** 的工作区上跑通） |
| `npm run test:session-workspace:attacks` | 对抗波：sdk loop、selection 不可变、auth、artifact 真值、coding run、lifecycle、media、SoT、remaining audit、artifact rail、clarify、web acquire | 本交接修订时 **未重跑**。HEAD `893bbe2` 周期内曾作为发布门的一部分。改 `sessionAgent` / 选择组 / 产物字节后必须跑 |
| `npm run test:workspace` | MV3 QuickJS 加载 + 生产 import 门 | 未在本修订重跑；改打包/loader 才必须 |
| `npm run ci:local` | `npm ci` + build:agent + :all + attacks + workspace + pack | 全量本地 CI，慢 |
| `npm run pack:extension` | 写出 `artifacts/unpacked/`（无 node_modules） | 上架形态；不要加载仓库根 |

`:all` 在脏树上刚跑过时的预期噪声（**不是失败**）：

- 多条 `AI SDK Warning (pawwork-callModel / callModel-adapter): specificationVersion … v2 specification compatibility mode`
- S-Q 里会打 `Error: boom-audit` 栈（用例故意炸模型适配器，断言错误被接住）
- `test_scene_operator: ok` 可能印两次

S-A…S-R 含义（`tests/session-workspace/harness.mjs`）：

| ID | 名称 |
|----|------|
| S-A | 直接问题 → 只回文字 |
| S-B | 选中与问题无关 → 不 inspect |
| S-C | 问选中内容 → inspect + 回答，无产物 |
| S-D | 要交付物 → run + artifact |
| S-E | 后一轮改上一份产物 |
| S-F | 新会话工作区隔离 |
| S-G | 跨会话读 FS 拒绝 |
| S-H | 执行结束后 scratch 清掉 |
| S-I | 产物熬过 settle |
| S-J | 产物熬过 runtime 重启 |
| S-K | 删会话删其产物 |
| S-L | 删会话 **不** 删 SelectionGroup |
| S-M | group 变更对后续 inspect 可见 |
| S-N | 进行中的 execution lease 保护用过的 WebItem |
| S-O | 释放后不可达 WebItem 被 GC |
| S-P | 存储压力 **永不自动删** 产物 |
| S-Q | 许多产物 **不** 注入初始模型上下文 |
| S-R | 普通消息 **不** 创建 Task 对象 |

构图/预览相关单测（改这些文件时对上跑）：`test_open_classify.mjs`、`test_html_write_policy.mjs`、`test_engine_canvas_a.mjs`、`test_canvas_ops.mjs`、`test_visual_canvas_shells.mjs`、`test_design_slides_shell.mjs`、`test_raster_compile.mjs`、`test_site_apply.mjs`、`test_preview_host_bars.mjs`。`test_html_apply.mjs` 测的是 **遗留** `applyHtmlCommands`，不是 Design 活路径。

**脏树 vs 干净 HEAD：** 下面「未合入」里的测试改动是为了配合删除 deck/poster HTML 模板。干净 `893bbe2` 上 `:all` 也曾绿（模板文件还在）。**只删模板不改测试会红；只改测试不删模板，`loadSkillResource('html-poster','templates/poster.html')` 等断言会对不上。** 要动这块就 skill 删除 + 测试一起提交。

---

## 特意为之清单

看起来像 bug、其实是决策。修本交接需求时 **不要** 把这些「修回去」。真 bug 只有工作区栅格预览空白；用户要的构图/纸张/禁字是 **新功能**，不是把旧 HTML 版式加回来。

没有「加了上限后完成率下降 12%」这种 Harbor 数字。结论来自：**结构门断言**、**AI SDK 默认会截断办公室循环**、**用户可见的错误交付**。下面「测试结论」写的是实际挡住了什么。

### 运行时 / Agent 循环

1. **Tool 循环没有步数上限**  
   - **意图：** AI SDK `ToolLoopAgent` 默认 `stopWhen` ≈ 20 步。海报/条漫经常是 `inspect` + 多张 `acquire image` + `createScene` + `deck`，20 步会停在半成品。产品用 `neverStopOnStepCount`（恒 false）；结束条件是模型不再调工具，或 `abortSignal`。  
   - **测试结论：** `tests/session-workspace/attacks/wave_sdk_loop.mjs` 断言源码含 `stopWhen: neverStopOnStepCount` 且不含 `stepCountIs(`。不要改成 `isStepCount(20)` 去「防止跑飞」——那会让办公室任务在套件仍绿的情况下交付失败。跑飞靠用户 Abort，不是步数帽。  
   - **易混：** `wireTranscript.js` 的 `HISTORY_TURNS = 20` 是 **对话轮次裁剪**，不是 tool step cap。不要合成一个「20」。

2. **`toolChoice=auto`，没有手写 `runToolLoop`**  
   - **意图：** 模型自己决定答还是调工具。禁止再写一套内核循环。  
   - **测试结论：** 同 wave 断言 `sendMessage` 不存在 `function runToolLoop`，且走 `runSessionToolLoopAgent`。S-A 证明纯问答可以零工具。

3. **内核永远只有 inspect / acquire / run（外加 clarify 控制面）**  
   - **意图：** 不做 200 个模型工具；skill 是 playbook 不是 tool。`sheet`/`deck`/`doc`/`web` 是办公工具，按库存出现。没有 Act/decompose 内核。  
   - **测试结论：** `test_office_schedule.mjs`、S-R（不创建 Task）。`KERNEL_TOOL_NAMES` 含 `clarify` 是刻意的控制面，不是世界能力。

4. **办公工具按 `/artifacts` 库存授权，不看 Chrome 当前 tab**  
   - **意图：** 切到别的网页不该卸掉 `deck`。`toolSchedule.js` 对 `tabUnfocused` 是 `void`。  
   - **测试结论：** `test_office_schedule.mjs` / `test_office_write_contract.mjs`。不要改成「没开 design.html 就没有 deck」（导出 PNG 的 `NEED_TAB` 是另一件事）。

5. **`NEED_SELECTION`：没点中就不改字/图**  
   - **意图：** 禁止模型猜第一个节点。用户没点就问。  
   - **测试结论：** `test_canvas_ops.mjs`、`test_engine_canvas_a.mjs`、`test_design_slides_shell.mjs`、`test_site_apply.mjs` 盲写 → `NEED_SELECTION`。不要改成「默认改第一个 text」。

6. **`NEED_TAB`：PNG/SVG/PDF 导出要有活 Design 页**  
   - **意图：** 无头 store 不能像素级导出 tldraw。  
   - **测试结论：** 画布导出相关用例。不要为了 CI 在 Node 里伪造一张「假导出图」当成功。

7. **`USE_CANVAS`：未标记的漂亮 HTML 不能当 Design 产物**  
   - **意图：** 两套版式权威不能并存。漫画/海报必须 `createScene` → pawCanvas。`write_artifact` HTML 只允许 `data-paw-kind="site"|"document"`。  
   - **测试结论：** `test_html_write_policy.mjs`、`test_html_run.mjs`、`test_html_artboard.mjs`、`test_prompt_user_sim.mjs` 对漫画 HTML → `USE_CANVAS`。用户真机：HTML 进 Design 会乱码/错表面。不要为了「模型爱写 HTML」而放行。

8. **html-plates 不再授予 `deck`/`poster` 工具**  
   - **意图：** 旧 HTML 版式不是画布。`canvasInventory` 对 `html-plates` 返回 `null`。  
   - **测试结论：** 办公库存用例。不要看见「有海报 HTML」就把 `deck` 加回去。

9. **S-Q：产物正文不进系统前缀**  
   - **意图：** 50 个 md 的 body 灌进 system 会挤掉技能与指令。货架只给索引，模型 `inspect` 再读。  
   - **测试结论：** S-Q 建 50 个 artifact，断言 system 不含 `artifactCount=`、不含各文件 UNIQUE body。不要「好心」把货架全文塞进 prompt。

10. **Wire 上的 tool 输出是投影，不是原样 base64**  
    - **意图：** inspect 图字节进 wire 会炸下一轮 ModelMessage、撑爆 IDB、每轮重发数 MB。本轮模型经 ToolLoop 能看见完整输出；下一轮再 inspect。  
    - **测试结论：** `test_trajectory_granularity.mjs`；`WIRE_DROP_KEYS` 含 `imageBase64`/`dataUrl`/`bytes`。不要为「轨迹更真」把原图写进 IDB 轨迹。

11. **轨迹是 agent 侧，UI 只显示 thought + 终稿**  
    - **意图：** 用户不看 tool JSON。  
    - **测试结论：** trajectory 粒度测试。不要在侧栏把 raw tool 当产品 UI。

12. **删会话不删 SelectionGroup（S-L）；存储压力不自动删产物（S-P）**  
    - **意图：** 捕获组是用户的；产物比缓存珍贵。  
    - **测试结论：** S-L、S-P。不要做「磁盘满了 GC 掉 /artifacts」。

13. **模型不能写 SelectionGroups**  
    - **意图：** 捕获是用户动作。工具没有 group write API。  
    - **测试结论：** `attacks/wave_selection_immutable.mjs`。不要加 `updateGroup` 给模型。

14. **生成代码只进 QuickJS sandbox，没有 `chrome.*` / 活 DOM**  
    - **意图：** CWS + 隔离。  
    - **测试结论：** attacks coding run 波、`test:workspace`。

15. **Paw OFF = 普通浏览；空 `sessionId` 不画前景**  
    - **意图：** 扩展不是永远劫持。  
    - **测试结论：** session isolation / sidepanel session 相关。不要「没会话也显示上一任务的货架」。

16. **技能目录进 system，正文按需 `inspect view=skill`**  
    - **意图：** 前缀只放 when-to-use description。  
    - **测试结论：** `test_skill_store.mjs` 断言 prompt 有 description、**没有** playbook `# Hello`。不要把所有 SKILL.md 打进 system。

17. **Composer 没有独立「生图」chip**  
    - **意图：** 生图是 acquire，不是另一套入口。  
    - **测试结论：** wave_sdk_loop 断言 `sidepanel.html` 无 `imageGenChipBtn`。不要加回生图气泡按钮当「功能缺失」。

18. **Host 不用关键词表替模型选编辑器**  
    - **意图：** 前沿模型判断海报 vs 网站 vs 长文；不清就 **clarify 一次**。  
    - **测试结论：** S-Q 断言 system 含 `ask once` / `do not guess`。不要加 if/else「含海报→createScene」。

### 画板 / 打开表面（本交接最容易修错的）

19. **`artifactPreview.html` 不是版式编辑器**  
    - **意图：** 删掉 iframe 艺术板 / 图层 Figma UI。此页只看 HTML/PDF（以及 **本交接要补的栅格图**）。Design 只在 `design.html`。  
    - **测试结论：** `test_preview_host_bars.mjs` 断言 `htmlCanvasPatch.js` / `artboardHistory.js` **文件不存在**。`test_html_office_canvas` 不再要求 layers/toggleSelection 预览壳。  
    - **真回归：** 收成 HTML viewer 时 **误伤了 PNG**（`renderHtml(item.text)`）。修图像预览时 **不要** 把版式编辑器加回去。

20. **`fromPage` 抽叶子节点，不保真 CSS**  
    - **意图：** HTML→画板像素级还原已失败（用户把漂亮 HTML 漫画丢进 Design，导出乱码）。活网页要可点改，用 tldraw 节点重排，不是镜像 DOM。真网站走 `html-site`。  
    - **测试结论：** 产品合同 + 用户真机。不要做「HTML 保真编译进 tldraw」。

21. **`design.js` 不把 HTML 编进 tldraw；非 pawCanvas 重定向走**  
    - **意图：** 打开路由以魔术字节为准。  
    - **测试结论：** `test_open_classify.mjs`、design 壳测试。

22. **网站是 HTML 页，没有网站版式引擎**  
    - **意图：** `site.html` 是浏览器预览 + 可选 click-pin，不是 Figma。  
    - **测试结论：** `test_site_apply.mjs`。不要给 site 加无限画板。

23. **视觉 mutate 工具名叫 `deck`，Design 也用它**  
    - **意图：** 历史命名；`inventoryHasVisual` 为真就挂 `deck`。不要再加一个 `poster` 模型工具。  
    - **测试结论：** office schedule。skill 仍叫 `html-poster` 也是历史 id，playbook 已是 createScene。

24. **tldraw Frame 默认不随内容长高**  
    - **意图：** 引擎语义（固定纸 + 无限 page）。溢出裁切。  
    - **本交接要做的：** 编译/策略上 **加页或改 `h`**，不是给 tldraw 做 CSS `height:auto` 魔法。用户说「A4 不能伸长」是缺策略，不是 Frame 实现 bug。

25. **tldraw 没有插画图鉴 / 花字引擎**  
    - **意图：** SDK 范围就是 geo + 四字体 + image/frame。缺组件是产品缺口（Q2），不是「没打开某个 SDK flag」。  
    - **测试结论：** `GEO_TYPES` / `SHAPE_TYPES` 即全部。不要去 vendor bundle 里翻「隐藏素材库」。

26. **未授权 tldraw 约 5 秒卸载**  
    - **意图：** 官方许可证。Build `PAW_TLDRAW_LICENSE_KEY` 或 runtime `pagewand_tldraw_license` → `<Tldraw licenseKey>`。缺键保留官方水印，`tldrawLicenseStatus().productionReady === false` 是发版 blocker，不是崩溃。禁止 CSS/DOM 藏水印。

27. **`ensureNotCoverOnly` 很弱**  
    - **意图：** 只挡「整板一张图、零个字节点」。有意未挡「每格一张带字插画」。加强是 Q3，不是把现有弱检查当回归修掉（也不要误伤用户照片）。

28. **`emptyPawCanvas` 960×1440 vs `POSTER_SIZE` 720×1080**  
    - **这不是特意为之，是不一致。** 构图工作里应对齐，不要当「两种纸的深意」。

### 不要救活的删除

29. **Konva / `htmlCanvasPatch` / `artboardHistory` / `sceneApply` / `sceneModel` 已删**  
    - **意图：** 无活路径。  
    - **测试结论：** `test_preview_host_bars.mjs` `existsSync === false`。不要还原。

30. **`csv-table` / `markdown-report` 未注册**  
    - **意图：** 注册表没有它们。磁盘目录在未提交改动里删掉。  
    - **测试结论：** `test_html_office_canvas.mjs` `ids.includes('csv-table') === false`。不要重新注册。

31. **html-deck / html-poster 的 HTML 版式模板（未提交，见下节）**  
    - **意图：** playbook 禁止 `write_artifact` HTML 海报；模板会教模型走 `USE_CANVAS` 死路。  
    - **测试结论：** 脏树上 `loadSkillResource('html-poster','templates/poster.html') === null`。不要把 `templates/poster.html` 加回 resources。

---

## 已知脆弱但先别动

本交接（预览 + 构图策略 + 禁字 + 第一包组件）**不要**顺手重构这些。它们过时或缠在一起，但还接活路径；拆开是另一次任务。

| 模块 | 为什么脆 | 动了会怎样 |
|------|----------|------------|
| `htmlApply.js` | parse/serialize/`inspectHtml` 与已死的 `applyHtmlCommands` 缠在同一文件 | `createScene`、PDF 复刻、`inspect view=html`、`test_html_apply.mjs` 全绑在这。删 mutate 必须先拆文件并改大量单测 |
| `htmlArtboard.js` | `alignBoxes` 几乎只服务上述 mutate；`resolveHtmlUpsertTarget` 仍给 `write_artifact` | 误删会导致 HTML 文档 upsert 丢目标 |
| `sceneCompile.js` + `frameLayout.js` | 还带着 plate/slot/旧 poster 尺寸语言 | 构图分页应 **增量** 加 frame 策略，不要重写编译器 |
| `artifactStage.js` / `printHtml.js` / `artifactExport.js` | PDF 复刻、S-Q / wave8 `exportPlates` | 导出和 PDF 预览会挂 |
| `test_html_apply.mjs` / `test_internet_office_scenarios.mjs` | 仍用 plate HTML 当夹具测 parse/导出 | 删模板后夹具已内联；不要为「干净」再删 parse 测试 |
| `src/preview/vendor/design-runtime.js` | gitignore 的 tldraw 打包，极大 | 只经 `npm run build:design`。不要手改 bundle |
| Univer `sheet-runtime` / docs vendor | 同样 gitignore、体积大 | 本交接无关 |
| `durableStore.js` / OPFS+IDB | 会话持久化 | 预览/构图不需要动 |
| `sessionAgent.js` 流式 + callModel v2 兼容 | 警告多、和 AI SDK 7 绑定 | 不要为消 warning 改 specificationVersion 除非你在修推理 |
| `src/agent/{draftStore,artifacts,prompts,skills}.js` | 侧栏草稿轨，**不是** workspace 真相 | 不要接到 pawCanvas 写路径上 |
| `openClassify.js` 仍认识 `html-plates` | 旧文件分类还在，库存故意不授权画布 | 改分类表要同步库存和打开路由 |
| tldraw 许可卸载 | 无 key 会 5s 卸编辑器 | 本交接不要「修闪退」 |

**可以动（本交接范围）：** `artifactPreview.js/html`（图像分支）、`html-poster`/`html-deck` playbook、`acquire` image 追加 no-text、`engineCanvas.compileSceneToPawCanvas` / `createFrame` 策略、新图标 SVG 资源、对应新测试。

---

## runtime-vnext HEAD 之外未合入的工作区

`git status` 相对 **已 push 的** `893bbe2`。`main` worktree（`C:\Users\yyy\Desktop\PawWork`）干净，与 origin/main 同 tip。

**这些改动没有进 `origin/runtime-vnext`。** 下一任 `git stash` / `git checkout --` 会丢掉它们。脏树上 `:all` 已绿（见绿基线）。

### A. 该保留的 skill 瘦身（建议先单独 commit 再开预览分支）

未注册 skill 整目录删除：

- `src/agent/vnext/skills/csv-table/**`
- `src/agent/vnext/skills/markdown-report/**`

html-deck / html-poster 去掉版式模板和 `fillTemplate`（`resources`/`templates` 已空）：

- 删 `templates/deck.html`、`deckHtml.js`、`poster.html`、`posterHtml.js`、`scripts/fillTemplate.js`、`fillTemplateSource.js`
- 改 `html-deck`/`html-poster` 的 `index.js`、`skillSource.js`、`SKILL.md`

配套测试（否则红）：

- `tests/session-workspace/test_html_artboard.mjs` — 内联 POSTER_HTML 夹具，不再 import 已删模板
- `test_html_office_canvas.mjs` — `loadSkillResource(…poster.html) === null`；不再 assert 模板 CSS
- `test_internet_office_scenarios.mjs` — 内联 deck HTML 夹具
- `test_prompt_user_sim.mjs` — 内联 POSTER_HTML；去掉 DECK_HTML 匹配
- `test_skill_store.mjs` — 改为 assert `html-poster/SKILL.md` 存在（不再要 `scripts/fillTemplate.js`）
- `test_trajectory_granularity.mjs` — poster resources 改为空数组

**不要还原这些删除。** 它们是故意的。和预览/构图可以分成两个 commit。

### B. 文档 / 图（不是运行时；可另 commit 或不 commit）

| 路径 | 状态 |
|------|------|
| `docs/HANDOFF_DESIGN_CANVAS.md` | **未跟踪**（本文件） |
| `docs/product-tree.html` | **未跟踪** — 可拖拽思维导图（点节点出详情） |
| `docs/eli5-architecture.html` | 已改 — 18 张真架构 ELI5 |
| `docs/eli5/1.jpg`…`6.jpg` | **已删**（过时「理想态」图，会教错） |
| `docs/eli5/a01.jpg`…`a18.jpg` | **未跟踪** 新图 |
| `AGENTS.md` | +1 行指向本 HANDOFF |

桌面副本（不在 git）：`C:\Users\yyy\Desktop\爪爪-PawWork-画板预览与构图交接.md`。另有评审快照 `爪爪-PawWork-产品路径与上架包.md`、`PawWork-store-unpacked.zip`，不是本任务输入。

### C. 给下一任的落地顺序建议

1. `git status` 确认上述是否还在。  
2. 把 **A**（skill 删除 + 测试）先 commit，避免和预览修复缠在一起。  
3. **B** 可跟手或留给文档 commit。  
4. 再开预览修复（`artifactPreview` 图像分支）。  
5. 然后构图/禁字/组件库。

若你选择扔掉工作区：A 丢了会让模型再次看见海报 HTML 模板；B 丢了只少文档和 ELI5。HEAD 代码仍能跑，干净 `893bbe2` 的 `:all` 也绿。

---

## 硬禁止

1. 不要把 HTML plates / Konva / `sceneApply` 救回成 Design 编辑器。
2. 不要 `@univerjs/slides` / `@univerjs-pro`。
3. 不要让漂亮 HTML 当画板中间态（`USE_CANVAS`）。
4. 不要把仓库根当上架包；不要把 `node_modules` 打进 zip。
5. 不要为「艺术字」第一期做变形引擎或塞几个 20MB CJK 字体。
6. 不要网刮素材当内置库。
7. 不要在 `PawWork-vnext` worktree checkout `main`。
8. 不要把「套件绿」当成产品 MET。
9. 不要新增内核工具替代 `inspect/acquire/run`；组件通过 `createShape` / 资源 / 现有 `deck` 暴露。
10. 模型不能写 SelectionGroups。

---

## 给下一任的验收清单（请逐项留证据）

- [ ] 工作区 PNG 点预览可见；下载扩展名是 `.png`
- [ ] 工作区 JPEG/WebP 同样
- [ ] Design JSON 预览仍进 tldraw，不是图像查看器
- [ ] 网站 HTML 仍进 `site.html`
- [ ] 用「自我介绍条漫、六格、每格一个能力和一句台词」跑一轮：台词是可点选的 text，图上没有烤字（或明显无字）；不是一张 A4 里叠八张带字生图
- [ ] 改一句台词走 `deck` + 点选，不必重生八张图
- [ ] `npm run test:session-workspace:all` GATE PASS
- [ ] 开发仍在 `runtime-vnext`；要上稳定再 merge `main`

---

## 执行记录（2026-08-27，接手 Agent）

| Commit | 内容 |
|--------|------|
| `acbfce4` | A 组落地：删未注册 skill 与 deck/poster HTML 模板 + 配套测试 |
| `16471a0` | B 组文档 + Q1–Q3 拍板写回本文件 |
| `42bb8b6` | 预览回归修复：栅格图像分支、字节真实下载、保存仅限 HTML 视图、wave8 两条陈旧断言对齐 |
| `7f097cb` | Q1+Q3：纸张单一真相（canvasOps 常量）、布局随纸缩放、溢出/无字警告、生图 no-text 印章（allowText 豁免）、playbook 选纸判断 |
| `9ab7720` | Q2：组件预设库（气泡/漫画格/标题条/色块 + 52 个 Lucide 图标），deck preset 参数与目录 |
| (随后) | `[hidden]` 面板布局兜底（真机发现：#page id 规则压过 UA hidden，把图像挤出视口） |

**真机验证（Playwright 加载 artifacts/unpacked，真实 RPC 链）：** PNG 预览可见（blob 渲染、保存隐藏、状态条 `图像 · PNG`）✅；下载 `smoke.png` 字节真实（PNG 魔术）✅；pawCanvas JSON 仍进 `design.html` ✅；site HTML 仍进 `site.html` ✅。**未做（需 BYOK）：** 六格条漫全链路提示词走查、deck 点选改台词——需要配置了推理+生图 key 的会话，由用户或下一任在真机跑。测试基线：`:all` GATE PASS、attacks 12/12、`test:workspace`、`pack:extension` clean gate 全绿。

## 本交接不包含

- 修 tldraw 许可证（未授权 5 秒卸载；本地 trial key）。
- 删 `htmlApply` parse（还在用）。
- 重做 Univer / 网站编辑器 / MCP。
- 把 ELI5、产品树当功能交付。
- 桌面旧文件 `爪爪-PawWork-产品路径与上架包.md`、`PawWork-store-unpacked.zip` 是给另一套模型做评审的快照，不是本任务输入。

---

## 建议提交信息（做完后）

预览与构图可拆两个 commit：

```text
fix(preview): render workspace raster artifacts as images

feat(canvas): paginate frames, stamp no-text on image gen, ship icon/bubble presets
```

正文写明：按 `docs/HANDOFF_DESIGN_CANVAS.md`；Q1=B/C、Q2=B、Q3=B+弱C（若仍无用户改口）。
