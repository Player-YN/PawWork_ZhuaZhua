# 爪爪 · 完全解放版 — 交接

给下一场 **新 Cursor 工作区** 用的主文档。本仓库只服务这个文件夹。

---

## 这是什么 / 不是什么

**是：** 野生工作簿。unpacked Chrome MV3，**仅开发者模式**。Git 在本地。以后可以可选地上 GitHub，但**不出售、不上架 CWS**。能力取向：把**已登录的浏览器**当成可编程层（CDP/debugger、可生成并可钉住的 userscript、网络收割、下载装配、可选 native host）。先前对话把它叫作 **「智能油猴」祖先**——那是方向，不是 Paw Work 产品法。

**不是：**

- 不是 爪爪 · Paw Work 官方产品
- 不是 CWS / 公开发布通道
- **不继承** Paw Work 北极星 `SELECT + DESCRIBE OUTCOME → DELIVER`
- **不继承** 8 工具宪法、Selection-first 产品规则、CWS 约束，或 `PawWork-vnext` 的 `AGENTS.md` 脊骨
- 不是给路人 `git clone` 公开 `unpacked` 用的发行树

文件夹名 `PawWork完全解放版` **保持不动**（Chrome 已从该路径加载）。身份改的是 manifest / 侧栏文案 / 文档，不是桌面路径。

---

## 和 `PawWork-vnext` 的关系

| | 官方开发树 | 本仓库 |
|---|---|---|
| 路径 | `C:\Users\yyy\Desktop\PawWork-vnext` | `C:\Users\yyy\Desktop\PawWork完全解放版` |
| 角色 | 产品 runtime（`runtime-vnext`） | 已分叉的野生实验 |
| 加载 | `npm run pack:dev` → `artifacts/unpacked` | **本文件夹就是加载根** |

**历史：** 本目录来自公开仓库 [PawWork_ZhuaZhua](https://github.com/Player-YN/PawWork_ZhuaZhua) 的 **`unpacked` 快照**（本机首次看到的 tip：`825cb2f` `release: unpacked 570482b`），再在本地加上 `action`、自定义图标、`all_frames`、background iframe 扇出。那是拷贝/克隆发行包 + 解放实验，**不是**从 vnext 工作树 checkout 出来的。

**现在：** 已分叉。产品规则 **永远不要** 回并到 `PawWork-vnext` / `PawWork` / `paw-work`。也不要在 vnext 里切分支来「同步」这里。

交接时已 **删掉 `origin`**（曾指向 `https://github.com/Player-YN/PawWork_ZhuaZhua.git`），避免手滑 `push` 到公开 `unpacked`。需要历史对照时自己再只读加 remote，**不要 push**。

---

## 怎么加载

1. Chrome 地址栏：`chrome://extensions`
2. 打开 **开发者模式**
3. **加载已解压的扩展程序**
4. 选：`C:\Users\yyy\Desktop\PawWork完全解放版`（含 `manifest.json`）

扩展显示名：**爪爪 · 完全解放版**。改 `src/` 后点扩展卡片上的 **重新加载**。没有 `package.json`，日常开发 **不必** `npm install`。

---

## 当前架构（已落地）

模型侧常驻工具（从发行快照继承，再 **多一个** `action`）：

`inspect` · `acquire` · `run` · `clarify` · **`action`** · `sheet` · `deck` · `doc` · `web`

这是历史形状，**不是**本项目必须遵守的「八工具 + 一」宪法。

### `action`（解放实验的核心）

结构派，不是 CSS 教学、不是截图坐标、不是 `eval`。

1. `op: snapshot` → 当前标签（含 iframe）可交互控件列表 + 不透明 `ref`（如 `f0.a12`）+ 代际 `rev`（如 `t7`）
2. 用 **同一代** 的 `ref` + `rev` 去 mutate
3. `op`：`fill_form` | `click` | `fill` | `select` | `press` | `scroll` | `wait`
4. 多字段优先 `fill_form`
5. `name`（无障碍名）是语义回退；两个控件同名 → **`AMBIGUOUS`**
6. 过期 `rev` / 控件已卸 → **`STALE_REF`**（再 snapshot）
7. `input[type=file]` → **`FILE_INPUT`**（脚本填不了）
8. `chrome://` / Web Store / 扩展页 → **`NEED_PAGE`**
9. 每次 mutate 后 background 会再扇出 snapshot（新 `rev` + controls）

**iframe：** `manifest` `all_frames: true` + `webNavigation.getAllFrames`。background 对缺脚本的 frame `scripting.executeScript`，把各 frame 的本地 `aN` 编成 `f{frameId}.aN`。`fill_form` 按 frame 拆分发送。

**路径：** 侧栏 / offscreen `hostPageAction` → background `workspace_page_action` → 各 frame 的 `content_script`。content script 里仍留着未暴露的 CSS resolver；**工具 schema 不教 CSS，不要当正式瞄准方式。**

### 解放实验里已经做了的

- 自定义图标 `icons/icon-16|32|48|128.png`
- manifest `name` / `action.default_title`：**爪爪 · 完全解放版**
- `content_scripts.all_frames: true`，权限加了 `webNavigation`
- background：跨 frame snapshot / 解析 / `fill_form` 扇出
- 工具清单把 `action` 列为 kernel（`canvasInventory.js`）
- 本轮只做身份：侧栏品牌、README/HANDOFF、本地 Git、`.gitignore`；**没有**新做 CDP / userscript 持久化

### 运行时地图

| 面 | 文件 | 角色 |
|----|------|------|
| Background SW | `src/background.js` | 标签 / 下载 / office 页 RPC / **`workspace_page_action` 扇出** |
| Offscreen | `src/offscreen/runtime.html` + `runtime.js` | `SessionWorkspaceService`、模型循环、工具 |
| Content script | `src/content_script.js` | 伸爪选区 + **每 frame 的 action snapshot/mutate** |
| Sidepanel | `src/sidepanel.html` + `sidepanel.js` | 对话 UI |
| Sandbox | `src/sandbox/runtime.html` | QuickJS；`run` 用的访客代码，不是页面 `eval` |
| Preview | `src/preview/*` | Sheet / Design / Docs / Site（历史工作区，仍在树上） |

存储键仍是历史 `pagewand_*`（发行快照遗留）。tldraw 走 `tldrawLicense.js` 解析；**仓库里没有生产 license key**，缺 key 就保留官方水印。

---

## 怎么开发

- **本文件夹 = 加载根**，不是 `artifacts/unpacked`
- 直接改 `src/`，扩展页点重新加载
- 不要在本目录跑官方 `pack:extension` / `sync:public` 流程
- 不要把这里当 vnext 的工作树

体积约 **55 MB** / ~254 个文件（不含 `.git`）。大头是已跟踪的 vendor：`src/preview/vendor/sheet-runtime.js`（~12 MB）、`docs-runtime.js`（~8.5 MB）、`design-runtime.js`（~2.9 MB）。它们是 unpacked 运行所需，**不要**写进 `.gitignore`。没有 `node_modules`、没有 `package.json`。

---

## 能力天花板（策略对话 → 分层）

取向：**智能油猴祖先**。层叠如下。标注 **已落地 / 未做**。

| 层 | 状态 | 说明 |
|----|------|------|
| 结构派 DOM `action` | **已落地** | snapshot → ref+rev → fill/click/…；iframe 扇出 |
| 历史工作区融合 | **代码仍在** | sheet/deck/doc/web、`/artifacts`、选区；是 fork 遗产，不是本项目北极星 |
| 页面 CDP / `chrome.debugger` | **未做** | Network 收割、比 content script 更深的钩子 |
| 登录即 API | **未做** | 已登录态下的请求/会话当可编程面（仍受站点 ToS） |
| Userscript 生成 + 可钉 | **未做** | 生成脚本、按站持久、开关 |
| 下载装配器 | **未做** | 比现有 `downloads` 触发更完整的拼包 |
| 钉到站点（pin-to-site） | **未做** | 某 origin 常驻脚本/钩子 |
| `nativeMessaging` | **未做（可选）** | 出浏览器沙箱；本机宿主，默认不要上 |

---

## 明确的非目标

- **不要**同步到公开 `PawWork_ZhuaZhua` 的 `unpacked`
- **不要**把 `action` 塞进官方产品，除非 Yiteng 以后亲口要
- **不要**改 `PawWork-vnext` / `PawWork` / `paw-work` 来「对齐」这里
- **不要**按 CWS / 路人安装来设计（无商店、无打包发行义务）
- **不要**把官方 AGENTS 脊骨复制进来当法律

---

## 已知风险

- **Debugger 探测：** 以后上 `chrome.debugger` 时，银行/反作弊/部分 SPA 会断会话或空白页
- **DRM：** 受保护媒体不是「收割」对象
- **ToS / DMCA：** 已登录自动化、绕过、批量抓取可能违反站点条款或版权；本实验是自己的本机工具，不是产品许诺
- **支付 / WebAuthn / 验证码：** 必须真人。`action` 故意不填密码/验证码（页面里这类字当注入忽略）；file input 失败闭合

---

## 下一场新对话的建议工作流（本轮不做）

按兴趣排，都是 backlog：

1. **持久 userscript** — 生成、按 origin 钉住、开关、重注入
2. **`chrome.debugger` Network 收割** — HAR 式请求/响应（先做探测与降级）
3. **下载装配器** — 多 URL / blob 拼成用户要的包
4. **pin-to-site** — 某站常驻钩子，不只是当前 tab 一轮 `action`
5. （可选）native host，仅当扩展 API 真不够

本轮身份交接 **没有**实现以上任何一项。

遗留（已知、先别大改）：`prompt.js` 后半仍有 Paw Work 工作区口吻；content script 有未暴露的 CSS 瞄准；存储键仍是 `pagewand_*`。

---

## 怎么继续

把 **这个文件夹** 当成 Cursor 工作区根打开（不要开 vnext）：

```text
打开文件夹 C:\Users\yyy\Desktop\PawWork完全解放版 作为 Cursor 工作区根。这是爪爪·完全解放版独立实验，不是 Paw Work。先读 HANDOFF.md。
```

Git：本地仓库，当前分支 `main`，**没有 remote**。不要 `git push`。不要改 `git config user.email/name`。
