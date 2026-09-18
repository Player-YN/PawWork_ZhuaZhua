<div align="center">

# 爪爪 · PawWork

[![license](https://img.shields.io/github/license/Player-YN/PawWork_ZhuaZhua)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![unpacked](https://img.shields.io/badge/load-unpacked-111111)](#load-it)

Treat the already-logged-in Chrome as a programmable computer. 爪爪 is the agent on that machine.

</div>

**爪爪 · 完全解放版** (`PawWork_ZhuaZhua`) is a Chrome MV3 **unpacked** extension. It runs a side-panel agent that can drive the current tab (`action`), execute guest JS against the browser (`sys` inside `run`), and keep sheet / Univer doc / site HTML artifacts in the session.

## Load it

Have a coding agent paste: **按 skills/install-zhuazhua 把爪爪装进 Chrome** — it follows [skills/install-zhuazhua/SKILL.md](skills/install-zhuazhua/SKILL.md).

Without an agent: clone or a [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases) → `chrome://extensions` → Developer mode → **Load unpacked** → the folder with `manifest.json` at its root. Open the side panel → ⚙️ → paste an OpenAI-compatible API key → send on a normal `http(s)` page.

After you edit `src/`, click **重新加载**. No `package.json`. No build step.

Chrome 135+. Extension details → **Allow User Scripts** for `sys.eval` / page-identity fetch. Close DevTools on the target tab before `sys.cdp`. Restricted pages (`chrome://`, Web Store) return `NEED_PAGE`.

侧栏顶栏始终显示 **Guarded / Full Access** chip。默认 Guarded：已知普通操作自动做，已知付款拒绝，已知删除先问你，页面脚本关闭。Full Access：其余已知/未知操作自动做，并允许页面脚本；已知付款仍拒绝，已知删除仍先问你。

## Tests

```text
node --test tests/*.test.mjs                      # policy/journal + 既有回归
node --test tests/runtime-regression.test.mjs      # 子集
node tests/browser-smoke.cjs <path-to-playwright>  # loads the real extension
```

## Architecture

Side panel → service worker → offscreen `SessionWorkspaceService` → AI SDK `ToolLoopAgent`. Process layering, domain objects, and tool contracts are documented in [AGENTS.md](AGENTS.md) and the nested `AGENTS.md` files under `src/`.

Release packaging: `python scripts/pack_extension.py --zip dist/pawwork.zip`.

## License

[MIT](LICENSE). Third-party components: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Chrome BOT 接线

源码版本 **1.2.0**。文档级页面目标、可跨 SW 重启的 tab 租约、执行归属/CDP 释放、RPC 方法清单与未知结果处理见 [docs/CHROME_BOT_OPTIMIZATION.md](docs/CHROME_BOT_OPTIMIZATION.md)。

```sh
node --test tests/*.test.mjs
python3 scripts/pack_extension.py --zip dist/PawWork_ChromeBOT_1.2.0_extension.zip
python3 scripts/verify_extension.py extension --source .
```

源码包无需 `.git` 即可打包；运行包根目录直接包含 manifest.json。不改存储键、不迁移 IDB 数据；更新前先停止任务并保留原目录，采用原路径替换/补丁的方式更新，避免误删原扩展数据。
