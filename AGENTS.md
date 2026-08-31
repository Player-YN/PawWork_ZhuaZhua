# 爪爪 · Paw Work — Agent spine (Session Workspace Runtime)

**Product:** Chrome MV3 **Selection-first Web Agent**.  
Paw Mode select on Live Web + describe outcome → verified deliverable.  
Brand: quiet, precise, results-first.

**Install:** extension only. Storage keys remain `pagewand_*`.  
**Contract:** [docs/SESSION_WORKSPACE_RUNTIME.md](docs/SESSION_WORKSPACE_RUNTIME.md) · [docs/WORKSPACE_RUNTIME_AUTHORITY.md](docs/WORKSPACE_RUNTIME_AUTHORITY.md) · [docs/RUNTIME_STACK.md](docs/RUNTIME_STACK.md) · [docs/CWS_CODE_RUNTIME.md](docs/CWS_CODE_RUNTIME.md)  
**Entry:** `src/agent/vnext/runSession.product.js` · offscreen `SessionWorkspaceService` · `npm run test:session-workspace`  
**Narrative / design:** [`product/`](product/) · [`design-system/`](design-system/) · [`src/sidepanel/css/tokens.css`](src/sidepanel/css/tokens.css)

This file is the auto-loaded spine. Keep it short.

---

## Baseline

| Fact | Detail |
|------|--------|
| **Product** | Session Workspace Runtime |
| **Stable** | **`main`** · `C:\Users\yyy\Desktop\PawWork` |
| **Dev** | **`runtime-vnext`** · `C:\Users\yyy\Desktop\PawWork-vnext` |
| **Remote** | https://github.com/Player-YN/PawWork-vnext (private) · default **`main`** |
| **Public** | https://github.com/Player-YN/PawWork_ZhuaZhua · `Desktop\PawWork_ZhuaZhua` · **tree sync**, never push private history |
| **Release** | Merge **`runtime-vnext` → `main`** in `Desktop\PawWork` (never checkout `main` here); `git push origin main`; `npm run sync:public -- --commit --push`. CWS zip = `pack:extension`. Keep developing on `runtime-vnext`. |

---

## North star

```text
SELECT + DESCRIBE OUTCOME → DELIVER
```

```text
Sidepanel
  → workspaceRpc (background)
  → Offscreen SessionWorkspaceService
  → every user message: sendMessage
  → AI SDK 7 ToolLoopAgent (toolChoice=auto)
  → tools always on: inspect / acquire / run / clarify / sheet / deck / doc / web (inventory aims targets, does not hide tools)
  → /artifacts (durable) + /scratch (per-execution, settled away)
  → SelectionGroups = ambient bound index; inspect on demand
  → packaged QuickJS + esbuild-wasm + AI SDK loader
  → 制表: Univer live grid (Facade/Command; full IWorkbookData persist)
  → 制图: tldraw Design/Slides (`pawCanvas`); HTML is a website or document, not a layout engine
  → 文字: Univer Docs and/or `data-paw-kind=document` HTML preview
  → capabilities may register from host plugins or external MCP (catalog + invoke; not 200 model tools)
```

Session is the workspace. Model decides answer vs deliverable. Tools are capabilities, not obligations. Capture ≠ full truth. Host enforces isolation, auth, and GC. Model cannot mutate SelectionGroups. Live canvases (sheet / design / site / docs) are first-class work surfaces, not optional renderers. Sidepanel may run **one agent per Session in parallel**; switching Task does not abort the other. Capture Groups + items are ambient (same picker across tasks). Bind, artifacts, clipboard, and live office tabs stay session-scoped (empty sessionId never paints the foreground).

---

## Repo map

```text
PawWork-vnext/
├── AGENTS.md
├── docs/                 # Session constitution + stack + CWS
├── product/
├── scripts/              # build-agent, build-sheet, build-design, pack-unpacked
├── src/
│   ├── sidepanel.*       # UI + workspaceRpc
│   ├── background.js     # sheet_host RPC + tab registry + session tab groups
│   ├── preview/sheet.*   # Univer live grid (OSS-full vendor, gitignored)
│   ├── preview/docs.*    # Univer Docs OSS tab
│   ├── preview/design.*    # tldraw Design/Slides
│   ├── preview/site.*      # website page (HTML SoT)
│   ├── preview/workLock.* / officeShortcuts.* / officeHelp.*  # in-flight lock + keys
│   ├── preview/artifactPreview.* # generic HTML/PDF view — not a layout editor
│   ├── offscreen/        # SessionWorkspaceService host
│   ├── sandbox/          # QuickJS guest page
│   ├── content_script.js # selection + user export/screenshot
│   └── agent/
│       ├── llm.js / provider
│       └── vnext/
│           ├── runSession.product.js
│           ├── sessionWorkspace/
│           ├── service/sessionWorkspaceService.js
│           ├── skills/<id>/
│           ├── primitives/
│           └── adapters/
├── tests/session-workspace/
├── tests/workspace/
└── artifacts/unpacked/   # pack output (gitignored)
```

---

## Product rules

1. Extension-only install.  
2. Paw OFF = normal browsing; Paw ON = selection channel.  
3. Capture ≠ interpretation; late-bind after prompt.  
4. Every user message → **sendMessage**.  
5. No silent expansion outside selection without intent.  
6. Model-generated code: sandbox + QuickJS only (no raw `chrome.*` / live DOM).  
7. Deliverables = real `/artifacts` bytes; claimed formats must match magic/container.  
8. Abort cancels in-flight model/tools/code.  
9. Durable: **IDB metadata + OPFS blobs** via `DurableSessionWorkspaceStore`.  
10. BYOK OpenAI-compatible HTTPS (`createPageWandLanguageModel`).  
11. Model cannot mutate SelectionGroups (host: no group write APIs on tools).  
12. Runtime **binds** (isolation, write policy, open routing, tool inventory). Prompt + skills **judge** (outcome type, clarify, compose). Frontier models are trusted to judge; host still fail-closes. See [docs/PROMPT_RUNTIME.md](docs/PROMPT_RUNTIME.md).  
13. Suite green is progress, not product MET by itself.  
14. Office canvases (sheet / design-slides / website / document) are product surfaces: squeeze engines for user value (compute, structure, precise apply, readback). Do not ban Facade, formula, MCP, or extra model tools from this file.

---

## Runtime surface

| Surface | Role |
|---------|------|
| `vnext/sessionWorkspace/**` | Store, guest FS, tools, sendMessage, ToolLoopAgent, `sheetApply.js` |
| `vnext/service/sessionWorkspaceService.js` | Offscreen durable RPC host |
| `vnext/host/workspaceClient.js` | Sidepanel RPC client |
| `vnext/skills/<id>/` | SKILL.md + resources; description = when-to-use |
| `vnext/primitives/**` | `run` + `acquire` (host webSearch/webFetch; actions search\|fetch\|map\|crawl\|image\|note; no vendor names) |
| `vnext/adapters/**` | QuickJS / esbuild / AI SDK / sandbox / stdlib |
| `llm.js` + `provider.js` | BYOK inference + image (`pagewand_providers`; optional per-provider `image` key / baseUrl; picker switches both; output-modality detection) |
| `webAcquireSettings.js` | BYOK web acquire (`pagewand_web_acquire`) |
| draft/artifacts/trajectory (agent root) | UI support; not workspace truth |

**Guest FS:** `/context` ro · `/artifacts` durable · `/scratch` execution-scoped.  
**UI:** artifact shelf = **工作区** (always-open rail; blank Design/Slides/Sheet/Docs/Site templates at the foot). Click a file to preview. Selection chips = user capture (sticky 图片N / 截图N / 容器N / 表格N / 文字N / 页面N; numbering is per-group, fresh groups start at 1). URL 页面 items enter by paste or in-page 链接入组. Pasted images are ephemeral composer chips, not artifacts. **清空选中** drops page-capture Group items; Clipboard Group has its own clear. Chrome labels are **任务 / Task**; sessions rename via the pencil. `@` opens the mention picker anywhere. Composer typewriter = bilingual product manual. Clarify is control-plane UI.  
**Office:** `sheet.html` · `design.html` · `site.html` · `docs.html` · `artifactPreview.html`. Agent-opened work tabs are silent (`active: false`) and join one Chrome tab group per session; user “打开” still focuses. In-flight writes lock that session’s work tab (stationary breathing rim + edge mist; no live-web lock). Preview host bar: `Ctrl±`/`0` viewport zoom + “?” shortcut list. Site: `Ctrl/Cmd` multi-pin; mutate the same `data-paw-kind=site` file (not a new HTML per tweak); site clone, declarative motion blueprint, and Site QA are landed. Slides PPTX export is triple-validated (OpenXML validator · LibreOffice · PowerPoint COM).  
**Tools:** always on: inspect / acquire / run / clarify / sheet / deck / doc / web. Clarify can yield questions or a plan; `/plan` (slash command, not a skill) forces a plan card this turn. Panel: Approve / Decline / 需要修改 (Required to change). Approve pins `execution.frozenPlan`; `prepareStep` re-injects the contract (not a chat bubble). Revise notes do not pin; model re-yields a new card (old card + notes stay). Playbook-shaped `run` (`createScene` / `fromPage` / `fromRaster` / `fromSelection`, with or without `op=html`) binds on the host. `fromRaster scan:"auto"` is host quantize+CCA (text still from inspect). Image `path`/`item`/`handle` aliases resolve on deck/web/fromRaster. Office writes that take a computed grid/slots/blocks/HTML payload accept guest `path`/`from` (host loads JSON, fail-closed); `run` computes, official tools apply — do not retype. No 9th tool. Inventory lists fat json-canvas. Missing canvas → `NO_CANVAS`. Unmarked pretty HTML is `USE_CANVAS`. Same-kind creates reuse fail-closed (`AMBIGUOUS_CANVAS` / `AMBIGUOUS_WORKBOOK` when two match and no target; `artifactMode:"new"` is the only second-book/visual path). Sheet interface contracts live in the sheet tool description. Skills: `slides` / `poster` (ex `html-deck` / `html-poster`; permanent id aliases).  
**Prompt:** system prefix carries the authorized-page-context boundary; no `sessionId` in the prefix; skill catalog only (playbooks load via `inspect view=skill`). Model judges when work is complex enough to present a plan; host does not classify “structural” ops.  
**Trajectory:** command skeleton (`[stripped]` / `[path-hydrate]` / `[omitted]`); empty official writes fail-speak (`BAD_INPUT`, never `ok` with `applied:0`); `user_stop` on the path; thought/text first-class; one-shot `plan-pinned` on approve (not every `prepareStep` hop).  
**acquire:** BYOK `pagewand_web_acquire`. Search default **Tavily** (Brave optional; Firecrawl search only if those keys are empty). `fetch` uses Firecrawl scrape when a key is set, else anonymous GET. `map`/`crawl` require Firecrawl. Not browser-use; no `userScripts`.

---

## Dev commands

```text
npm run build:agent          # icons + QuickJS + AI SDK + esbuild.wasm + sheet + docs + design
npm run build:icons          # lucide-static → tracked canvasIconPack.js + iconCatalogIndex.js (full set, 2,035 icons)
npm run check:icons          # generator determinism vs tracked modules
npm run build:sheet          # Univer+SheetJS → src/preview/vendor/ (gitignored)
npm run build:design         # tldraw → src/preview/vendor/design-runtime.* (gitignored)
npm run test:session-workspace
npm run test:session-workspace:all   # Node-only; no Playwright browser download
npm run test:session-workspace:attacks
npm run test:workspace
npm run playwright:install   # Chromium for visual / packed-extension E2E only
npm run test:visual-deck     # real tldraw harness pixels (requires playwright:install)
npm run test:extension-e2e   # packed MV3 + local mock model (requires pack + playwright:install)
npm run pack:extension       # artifacts/unpacked — no node_modules
npm run sync:public          # copy `main` tree → ../PawWork_ZhuaZhua (no history)
npm run ci:local
```

**Load `artifacts/unpacked/` for size.** Repo root includes `node_modules` (~360MB) — never load the repo root as the extension. Pack is ~44MB (`esbuild.wasm` + `sheet-runtime.js` + `design-runtime.js` + loaders). Reload after `build:agent` / `build:sheet` / `build:design`. Develop on **`runtime-vnext`** in `Desktop\PawWork-vnext`. Merge tested tips onto **`main`** (`Desktop\PawWork`); `npm run sync:public -- --commit --push` updates the public clone. Keep developing on `runtime-vnext`.

---

## Product docs

| File | Role |
|------|------|
| `docs/SESSION_WORKSPACE_RUNTIME.md` | Product constitution |
| `docs/PROMPT_RUNTIME.md` | Prompt judges; runtime binds |
| `docs/ENGINE_CANVAS_A.md` | Landed Design/Slides + site HTML (wave map historical) |
| `docs/WORKSPACE_RUNTIME_AUTHORITY.md` | Authority + branch policy |
| `docs/RUNTIME_STACK.md` | Stack / self-build boundary |
| `docs/CWS_CODE_RUNTIME.md` | Generated-code / CWS notes |
| `docs/HANDOFF_DESIGN_CANVAS.md` | Design-canvas handoff (executed 2026-08-27; historical record) |
| `product/POSITIONING.md` | What / for whom |
| `product/STRATEGY.md` | Stage bets |
| `product/EXPERIENCE.md` | Selection-first UX |
