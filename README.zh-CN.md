# 爪爪 · Paw Work

**在真实网页上选出你要的东西，说清想要什么结果，把工作成果拿走。**

[English](README.md) · 中文

> [!IMPORTANT]
> **只想用产品？** 不要 clone 整个仓库，也不需要开发侧文件。只要克隆 [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) 分支（约 44 MB）。那个文件夹本身就是 Chrome 扩展（根目录有 `manifest.json`）。
>
> 克隆会在**你运行命令时的当前目录**下新建 `paw-work`，不是固定到桌面。若在用户主目录跑，就是 `C:\Users\yyy\paw-work`。Git 不会在 clone 结束后自动报路径——下面最后一行会打印绝对路径。Chrome 加载时选打印出来的那个文件夹。
>
> **Windows（PowerShell）** — 整段粘贴：
>
> ```powershell
> git clone --depth 1 --single-branch --branch unpacked https://github.com/Player-YN/PawWork_ZhuaZhua.git paw-work
> (Get-Item .\paw-work).FullName
> ```
>
> **macOS / Linux：**
>
> ```bash
> git clone --depth 1 --single-branch --branch unpacked https://github.com/Player-YN/PawWork_ZhuaZhua.git paw-work
> realpath paw-work
> ```
>
> 然后：Chrome → `chrome://extensions` → **开发者模式** → **加载已解压的扩展程序** → 选刚刚打印出来的文件夹。
>
> 没有 git？在本 GitHub 页面：**Code → 把分支切到 `unpacked` → Download ZIP**。解压后加载里面有 `manifest.json` 的那个文件夹。
>
> 同一份包也可从 [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest) 下载（`paw-work-unpacked.zip`），解压后加载里面的 `paw-work` 文件夹。

[![CI](https://github.com/Player-YN/PawWork_ZhuaZhua/actions/workflows/ci.yml/badge.svg)](https://github.com/Player-YN/PawWork_ZhuaZhua/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Player-YN/PawWork_ZhuaZhua)](LICENSE)
![Chrome MV3](https://img.shields.io/badge/chrome-manifest%20v3-4285F4?logo=googlechrome&logoColor=white)

```text
选中 + 说出结果 → 交付
```

[能做什么](#能做什么) · [演示](#演示) · [怎么用](#怎么用) · [安装](#安装) · [信任](#信任与隐私) · [限制](#已知限制)

---

## 它是什么

爪爪 · Paw Work 是一个 **Chrome MV3 扩展**。打开伸爪，在已经打开、已经登录的网页上点选图片、表格、文字、区块或链接，然后在侧栏里说出你要的结果。交回的是活画布上 **可编辑的办公文件**，不是一段关于这个页面的作文。

它不是替你全网乱点的 Operator，也不是写代码的终端 Agent。它坐在你已经打开的浏览器世界旁边：你指范围，它交付可核对的结果。

## 给谁 / 不是谁

| 适合 | 不是第一选择 |
|------|----------------|
| 已经在浏览器里做整理、对比、导出、把一页收成表 / 幻灯 / 海报 / 站点 / 长文的人 | 无人值守 RPA（跨站提交、支付） |
| 工作从你正在看的那一页开始（店铺、SaaS、文档、文章） | 编程主战场：Docker、本机 Shell、百万文件仓库 |

没有账号，没有服务器。模型密钥你自己带。

## 能做什么

| 你在网页上 | 你说要的结果 | 你拿走 |
|------------|--------------|--------|
| 点选商品图 / 表格 / 文案 / 区块 / 链接 | 「做成一张比价表」 | 活表格（[Univer](https://univer.ai)），可在原簿上继续改 |
| 同上，或空白工作区 | 「做成 8 页汇报 / 一张海报」 | Design/Slides（[tldraw](https://tldraw.dev)）；幻灯可导出 PPTX |
| 当前页 | 「做成可改的网站，带入场动效」 | 真 HTML。改动落在同一份文件上，有站点质检 |
| 长文 / 纪要 | 「整理成文档」 | 文档画布 |
| 需要配图或补搜 | 「按这个风格生图 / 搜一下再写进表」 | 图进工作区；检索用 **你自己的** 搜索密钥 |

同一会话里可以并行不止一个任务。`@` 可以点名一条捕获。工作区轨底部有表 / 幻灯 / 文档 / 站点的空白模板。

**可以这样说：**

- 把这些商品卡做成一张比价表。
- 用选中的图做一张海报。
- 把当前页收成可编辑的站点。
- 把这些纪要收成 8 页幻灯。
- 先出计划，等我批准再干。

复杂任务可以先出一张 **计划卡**：批准、不批准，或需要修改（你写下意见，它改计划，旧卡留着）。默认不会默默扩到你没选的范围。

## 演示

在已经打开的苹果官网点选商品图。捕获落在侧栏，下一句就是要的结果。

![在 apple.com.cn 点选 iPhone 商品图，侧栏列出选中的图片](docs/images/select-on-page.png)

活表格开在旁边。智能体在改 **当前这一本** 工作簿（拆 SKU 列），不是在聊天里另交一份文件。

![Univer 活表格与侧栏：正在原地改打开的工作簿](docs/images/sheet-edit.jpg)

## 怎么用

1. 打开 **伸爪**（关掉就是正常上网）。
2. 在页面上点选你要的东西。
3. 在侧栏说出结果。
4. 从工作区轨打开文件。点中节点、说出修改，只有那个节点会变。

```text
活网页（伸爪开）→ 点选 → 侧栏 → 活画布 / 文件
```

尚未上架 Chrome 网上应用店。**路人：** 只克隆 [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) 分支（见文首提示框），不要 clone 这份源码。然后：开伸爪 → 填模型密钥 → 选一块 → 说一句。

## 信任与隐私

- 没有账号、没有爪爪服务器、没有托管模型额度。
- 密钥只存在你这台机器的 Chrome 扩展存储里，只发往 **你填写的** HTTPS 端点。
- 模型生成的代码用打包的 esbuild-wasm 编译，在 QuickJS 里运行；看不到 `chrome.*`、活页面 DOM、别的会话的文件，也不会从 CDN 加载可执行代码。
- 捕获是你指过的东西，不是整站。智能体按需检查。运行中可以停，停了后台不得假活。

## 安装

**只想用产品，不要 clone 整个仓库。** 不需要开发侧文件，只克隆 `unpacked` 分支。

1. 粘贴文首的 PowerShell（或 macOS/Linux）整段。最后一行会打印 `paw-work` 的绝对路径。
2. 打开 Chrome → 地址栏进入 `chrome://extensions`
3. 打开 **开发者模式**
4. **加载已解压的扩展程序** → 选打印出来的那个文件夹（根目录有 `manifest.json`）

没有 git？**Code → 分支切到 `unpacked` → Download ZIP**，解压后做第 2–4 步。同一份包也在 [Release 页](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest) 的 `paw-work-unpacked.zip` 里。

不需要 Node，也不要 `npm install`。不要加载源码仓根目录。

### 从源码构建（给改代码的人）

前置：Node.js 20+、npm、Chrome 120+。

```bash
git clone https://github.com/Player-YN/PawWork_ZhuaZhua.git
cd PawWork_ZhuaZhua
npm install
npm run build:agent
npm run pack:extension
```

然后加载 `artifacts/unpacked/`。`npm install` 之后整个目录会到几百兆（`node_modules`）。**不要加载仓库根目录。** 拉取更新后执行 `npm run build:agent` 并重新加载扩展。

构建和测试见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 自带密钥

没有密钥什么都跑不起来。在侧栏设置里配置。

- **对话** — 任意 OpenAI 兼容的 HTTPS 端点（Base URL + 密钥 + 模型）。
- **生图**（可选）— 可以有自己的 Base URL / 密钥 / 模型；留空则沿用对话。OpenRouter 生图 origin 写在模板里。
- **网页搜索 / 抓取**（可选）— 你自己的搜索或抓取密钥。没有密钥时，抓取仍可走匿名 GET。
- **tldraw 许可**（可选）— 去掉 Design/Slides 水印，见「已知限制」。

## 技术栈

Chrome MV3 扩展。侧栏连的是扩展内的工作区，没有爪爪云。表格和文档用 Univer；海报和幻灯用 tldraw；站点是真 HTML。生成的 JS 在本地 WASM 沙箱里跑。文件持久化在浏览器里（IndexedDB + OPFS）。本仓库代码 MIT；第三方引擎见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

运行时合约（隔离、写入、能力）在 [`docs/SESSION_WORKSPACE_RUNTIME.md`](docs/SESSION_WORKSPACE_RUNTIME.md) 和 [`docs/PROMPT_RUNTIME.md`](docs/PROMPT_RUNTIME.md)。宿主路径：[constitution § Host path](docs/SESSION_WORKSPACE_RUNTIME.md#host-path)。构建和测试：[CONTRIBUTING.md](CONTRIBUTING.md)。

## 已知限制

- **尚未上架 Chrome 网上应用店。** 克隆 [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) 分支（或同一份 [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest)）。GitHub 加载 unpacked 是现在的旁路；以后商店才是正门。
- **仅扩展。** 只支持 Chromium MV3。没有托管服务、没有账号。
- **必须自带密钥。** 对话、生图、检索各自需要你的密钥。
- **tldraw 水印。** 没有 tldraw 官方生产许可时，Design/Slides 会显示官方水印。用 CSS/DOM 藏水印不被支持，也不可接受。
- **捕获不等于全部真相。** 选中是意图；智能体按需检查，结果类型确实不清时会问一次。
- **不是完整的 Excel / PowerPoint / 全自动 RPA。** 活画布是工作面。它不会替你无人值守地漫游、付款、提交。

## 许可

本仓库代码使用 MIT 许可（见 [LICENSE](LICENSE)）。源码树不分发 Univer/tldraw 运行时包（需本地构建）。**`unpacked` 分支** 和 **Release zip** 会带上这些构建产物，以及 tldraw 许可原文（[notices/tldraw-LICENSE.md](notices/tldraw-LICENSE.md)）。
