# Paw Work Design / Slides — Engine Canvas A

**Status:** landed (this tip). tldraw Design/Slides + site HTML. Wave map below is historical — do not reopen HTML artboard as Design. Konva overlay and HTML-scene mutate (`sceneApply`) are removed.  
**Goal:** Live visual canvases run an open-source infinite-canvas engine (tldraw). The Agent drives selected nodes. HTML artboard as Design/Slides source of truth is abandoned.

**Real entry:** Reload unpacked extension → user asks for a poster or slides → a Design or Slides tab opens on the engine canvas (grey cloth, pan/zoom) → click a text/image/frame → sidepanel chip → NL edits that node → export PNG/PDF/HTML/PPTX from the engine document.

**Done if:**
- Design = infinite canvas (engine camera, not document scroll)
- Slides = same engine, 16:9 frames + filmstrip + notes; default camera pins the current frame
- Click node → chip → NL changes only that node; no click + field write → `NEED_SELECTION`
- `/artifacts` stores the engine snapshot; exports are compiled from it
- Univer sheet / Univer document unchanged

**Not done if:**
- Poster/deck still edits live HTML plates as the editor
- First slot/node is invented
- Canvas does not pan (page scrollbar)
- Agent cannot address the clicked node

**Not in this program:** Auto Layout engine, Figma components/variables, Prototype, comments, plugins, Penpot as runtime, Univer Slides.

---

## Frozen architecture

```text
Sidepanel NL
  → workspaceRpc
  → deck/canvas tool (nodeId = engine shape id)
  → persist snapshot JSON in /artifacts
Preview tab
  → bundled tldraw + React (vendor/design-runtime.js)
  → infinite camera + frames + text/image/geo
  → selection events → html_tab_state (kind, nodeIds)
Export
  → engine document → PNG / SVG / PDF / HTML / PPTX
```

| Decision | Value |
|----------|--------|
| Engine | **tldraw** (embeddable SDK). Not Penpot. Not OpenPencil as default. |
| SoT | JSON `{ pawCanvas: 1, shell: "design"\|"slides", tldraw: snapshot }` in `/artifacts` |
| Preview | `src/preview/design.html` (query `shell=design\|slides`) |
| Agent tool | Keep name `deck` for inventory; commands become engine ops (`updateText`, `setFill`, `setBox`, `createFrame`, …) |
| Selection | `activeHtml.selections[]` → `{ artifactId, nodeId, type }` (no fake A1, no first slot) |
| React | Bundled into vendor; preview page only. Sidepanel stays vanilla. |
| Old HTML artboard | Abandoned as live Design/Slides editor. `createScene` / `fromPage` **compile into engine shapes**, not `data-paw-slot` HTML. |
| License | Official tldraw 5.3.2 `<Tldraw licenseKey>`. Build inject `PAW_TLDRAW_LICENSE_KEY` (optional alias `TLDRAW_LICENSE_KEY`) or runtime `pagewand_tldraw_license` / `mountDesignCanvas({ licenseKey })`. Missing key keeps the official watermark and `tldrawLicenseStatus().productionReady === false` — a release blocker, not a crash. Never hide the watermark via CSS/DOM. Do not commit a secrets file. |

**Classify:** `pawCanvas` + `shell=slides` → inventory `deck`; `shell=design` → `poster`. Preview entry: `design.html`.

**Pack:** `scripts/build-design.mjs` → `src/preview/vendor/design-runtime.js` + `design-runtime.css` (gitignored like other vendor). `npm run pack:extension` already copies `src/`.

---

## Wave map (all listed; parallel after W0)

```text
W0 scaffold ─────────────────────┐
                                 ├─ W1 live canvas (camera, frames, persist)
                                 ├─ W2 click → chip → Agent write
                                 ├─ W3 import (createScene / fromPage / fromSelection)
                                 ├─ W4 export (png/svg/pdf/html/pptx)
                                 └─ W5 Design/Slides chrome (pages, filmstrip, notes)
                                              │
                                              ▼
                                 W6 delete dead HTML artboard path
```

W1–W5 can overlap after W0: **exclusive files**. W6 last.

| Wave | Owns (writable) | Must not touch |
|------|-----------------|----------------|
| W0 | `package.json`, `scripts/build-design.mjs`, `src/preview/vendor/` (generated), `src/preview/design.html` stub | office tools, sidepanel |
| W1 | `src/preview/design.js`, persist RPC in `artifactPreview` open path / `background.js` tab URL, `openClassify.js` | `officeTools.js` command semantics |
| W2 | `officeTools.js` (deck execute), `sidepanel.js` chip, `design.js` selection reporter, `prompt.js` | Univer |
| W3 | `sceneCompile.js` → emit tldraw snapshot; `htmlApply` createScene; skills SKILL.md | preview chrome
| W4 | `src/preview/designExport.js` + `artifactExport.js` hooks | sheet/docs |
| W5 | `design.html` chrome CSS/DOM around `<Tldraw />` | engine store schema |
| W6 | delete/stop using artboard HTML editor for poster/deck | sheet.html, docs.html |

Univer sheet/doc, kernel inspect/acquire/run, guest FS — unchanged.

---

## W0 — Scaffold (serial, blocker)

- Add `react`, `react-dom`, `tldraw` (npm, via local proxy).
- `scripts/build-design.mjs`: esbuild bundle ESM for chrome120 → `src/preview/vendor/design-runtime.js`.
- `src/preview/design.html`: full viewport, mount node `#engine`.
- `src/preview/design.js`: `createRoot` + `<Tldraw />`, `shell` from query.
- `npm run build:agent` includes `build-design`.
- Test: vendor file exists, html has `#engine`, no `overflow:auto` on the canvas host.

**Done if:** unpacked load opens `design.html`, grey/white infinite board, pan with trackpad.

---

## W1 — Live canvas + persist

- Camera: tldraw default (no-mod pan / pinch / ctrl-wheel zoom).
- Document: at least Frame, Text, Geo/rect, Image.
- Load snapshot from artifact bytes if `pawCanvas`; else empty page + one Frame.
- Save: `editor.store.listen` debounce → `updateArtifact` snapshot JSON.
- `previewEntryForKind` + `background.js` open Design/Slides → `design.html` not `artifactPreview.html`.
- `classifyCanvasKind` recognizes `pawCanvas`.

**Done if:** create/open a board, pan, add a frame, reload tab, frame still there.

---

## W2 — Point / say / change

- `design.js` on selection change: `html_tab_state` `{ kind: poster\|deck, artifactId, selections: [{ nodeId, type, text }] }`. Empty selection = `[]`. Never invent a node.
- Sidepanel chip: Paw Work Design / Slides, show type + snippet (already have canvas chip path).
- `deck.write`: if `nodeId` or `activeHtml.selections[0].nodeId` — apply to that shape (`updateText` / `setFill` / `setBox`). Field write without node → `{ ok:false, code:'NEED_SELECTION' }`.
- Host may patch the **open tab** (message `canvas_apply`) so the user sees the change without full reload; persist snapshot.

**Done if:** click a title, chip appears, “改成 Hello” only that title changes. No click → need selection, HTML/snapshot unchanged.

---

## W3 — Import (web → engine nodes)

Replace HTML `createScene` output with a tldraw snapshot:

- `fromPage` / `fromSelection` / `createScene`: produce frames + text + image shapes (not `data-paw-slot` HTML as editor SoT).
- A Design file is never a single cover PNG.
- Images: existing acquire → durable src on image shapes.
- Skills `html-poster` / `html-deck`: playbook says compile engine scene, mutate with `deck` on `nodeId`.

**Done if:** “做一张海报介绍这个页” opens Design with at least one Frame and editable text nodes (not one locked screenshot-only board unless no text existed).

---

## W4 — Export

From the engine document (not from live HTML plates):

| Format | Behavior |
|--------|----------|
| PNG / SVG | tldraw export of selected frames or page |
| PDF | print/export frames |
| HTML | compiled visual (positioned text/images), not the SoT |
| PPTX | each 16:9 frame = one slide |
| JSON | the snapshot itself |

**Done if:** Download PNG and PDF from a Design tab; Slides PPTX has one slide per frame.

---

## W5 — Shell chrome (Figma-like, our UI)

Around the engine. **Do not cap `maxPages` or null `PageMenu` / `NavigationPanel` — that hid SDK pages.** Hide only collab / debug / loading flash.

- Design: official Page menu + Layers tree on the current page; official toolbar / style / asset / frame tools.
- Slides: filmstrip of 16:9 frames (`+` / 复制 / 删除 / 总览 / drag reorder), speaker notes, camera pinned to the current frame (`contain` + `fit-max`). Overview drops constraints. F5 is a minimal present. Filmstrip reorder uses host `reorderSlides` + `slidesLayout` reflow (one tldraw history step via `editor.run`); keyboard is Alt+Shift+Left/Right while the filmstrip is focused so canvas arrows still nudge.
- Host strip: save / insert workspace image / download. Selection blue from engine.

**Done if:** humans can add a tldraw Page and a blank 16:9 slide without the agent; Slides default view pins one frame; Design left rail is Layers only (no dead “Page 1”).

---

## W6 — Abandon old artboard editor

Stop opening poster/deck in `artifactPreview.html` as the live editor. Remove or gate:

- `artifactPreview` artboard stage / Konva overlay as Design/Slides editor
- `data-paw-slot` as the mutation API for deck
- Skills/prompts that tell the model to write artboard HTML

Keep `artifactPreview` only if still needed for **image gallery / PDF reconstruct not on a board**. Prefer importing PDF pages as engine frames (W3) instead.

**Done if:** no poster/deck tab is the old scrolling HTML plate editor.

---

## Tests (every wave)

- `tests/session-workspace/test_engine_canvas_a.mjs` — contracts: `pawCanvas`, `design.html`, `NEED_SELECTION` on missing nodeId, classify kind, no first-node invention.
- Keep `test:session-workspace:all` green; replace HTML-artboard assertions that required `data-paw-slot` editor chrome for poster/deck.

---

## Orchestration

1. Main runs **W0** (install + bundle + stub page).
2. Parallel: W1 persist/open path ‖ W2 protocol (after W0 files exist).
3. Parallel: W3 import ‖ W4 export (need W1 snapshot shape).
4. W5 chrome (needs W1 mount).
5. W6 delete dead path last.
6. Main integrates and owns Real entry verify.

**Claim MET only after Chrome: pan grey cloth, click node, NL edits it, export one PNG.**
