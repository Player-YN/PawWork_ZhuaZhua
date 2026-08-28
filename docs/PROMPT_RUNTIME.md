# Prompt vs Runtime — matched duties

**Audience:** agents.  
**Status:** current contract (this tip).  
**Pair with:** [SESSION_WORKSPACE_RUNTIME.md](./SESSION_WORKSPACE_RUNTIME.md)

Frontier models are expected to **judge**. Runtime is expected to **bind**. Do not dump host law into the prompt, and do not ask the prompt to enforce isolation.

## Runtime (host, fail-closed)

These are true even if the model is brilliant, lazy, or skips skills:

- Session isolation, artifact ownership, GC, abort
- Unmarked visual HTML cannot land as a design file (`htmlWritePolicy` → `USE_CANVAS`)
- Open routing: `pawCanvas` JSON → `design.html`; `data-paw-kind=site` → `site.html`; generic HTML/PDF view → `artifactPreview.html`; sheet/docs stay Univer
- Tab open, session tab group, raster `fromRaster` `scan: "auto"`, and in-flight work-tab lock are host binds — not skill text
- Slides default pins the current 16:9 frame in the viewport; overview mode can roam. Slides stay frames, not tldraw Pages
- Site work tab: 伸爪 off = browse (links work); 伸爪 on = pin. Composer sends while a turn is running enqueue FIFO for that session; Stop clears the queue
- Playbook-shaped `run` ops (`createScene` / `fromPage` / `fromRaster` / `fromSelection`, with image `path`/`src`/`item`/`handle`) must compile — do not require `op=html`. If a matching Design/Slides canvas is already open (`activeHtml` or explicit `artifactId`), compile writes that file — not a second `slides.json`. Empty `createScene` is rejected.
- Semantic deck/poster compile input is `themeId` + `frames[{id,layoutId,slots}]`; host owns x/y/w/h. `replacePlate` accepts the same semantic payload and keeps frame identity. QA failure is `CANVAS_QA_FAILED` with issues — same artifact, not a new file.
- After a site exists, `web` / `write_artifact` patches that file; guest `/artifacts` images are rewritten for `srcdoc`
- Guest `path`/`from` on sheet/deck/doc/web writes (and `createScene` frames) loads `/scratch` or `/artifacts` JSON/HTML; missing file `ENOENT`; invalid/empty payload `BAD_INPUT`. Prompt cannot enforce “don’t retype”
- Tools `inspect` / `acquire` / `run` / `clarify` / `sheet` / `deck` / `doc` / `web` are always in `tools[]`. Inventory lists targets (including fat json-canvas); empty canvas → `NO_CANVAS`, not a hidden tool
- Field writes without a pinned node → `NEED_SELECTION`; PNG/SVG/PDF export without the live Design tab → `NEED_TAB`
- Model cannot mutate SelectionGroups (no group-write APIs)
- Artifact bytes must match claimed format (magic/container)

## Responsibility split

| Layer | Chooses / carries | Must not |
|-------|-------------------|----------|
| **Skill** | Outcome type, story, art direction, `themeId`, `layoutId`, slot copy, when to clarify; small edit → office tool direct; compute helps → snapshot → `run` → official write+`path` | Author x/y/w/h, dump catalogs into the system prefix, invent a second file to dodge QA, tell the model to `chrome.*` or paint tldraw from guest code |
| **Prompt** | Compact invariants: open canvas is the target; one task = one artifact unless the user asks otherwise; deck/poster normal path is semantic theme/layout/slots; QA failure must be repaired on that file | Layout catalogs, lengthy recipes, host isolation law, a taxonomy of structural ops or a third plan gate |
| **Runtime** | Bind the live `artifactId`, load guest `path`/`from`, validate JSON, apply through the official command, compile geometry, gate writes, fail-closed (`ENOENT` / `BAD_INPUT`) | Ask the prompt to enforce isolation, pagination, or “don’t retype 100 rows” |

## Prompt + skills (model judgment)

These are **not** keyword tables in the host. A capable model should do them:

- Answer vs durable deliverable; smallest sufficient action
- When the work is complex, present a plan through `clarify` (`plan`) — do not ask whether to enter plan mode. Each step is a short title plus optional detail for the approval panel. `/plan` forces a card this turn. Panel: Approve / Decline / 需要修改 (Required to change). Approve pins `execution.frozenPlan`; `prepareStep` re-injects the contract (not a chat bubble). Decline is a complete stop. Revise sends notes and does not pin; the model re-yields a new plan card this turn (old card + notes stay). Host does not classify “structural” ops.
- Which skill **description** fits; load the playbook with `inspect view=skill` when it does
- Clarify **once** when poster vs website vs long document is actually unclear — then stop
- Material classification (plate / reference / evidence)
- Story, `themeId`, and `layoutId` for deck/poster; runtime compiles geometry and runs QA
- How to compose the page (HTML site) or the sheet
- After a canvas exists: call `deck` / `web` / `sheet` / `doc` instead of describing the edit in chat. Small outcome → those tools directly. Bulk compute → snapshot → `run` → official write with `path`/`from` — never retype a computed grid/slots/blocks/HTML payload
- On `CANVAS_QA_FAILED`: repair slots/layout/theme on the same artifact — never bypass, never a new file
- Skip skills when none fit

Skills are playbooks, not modes and not extra kernel tools. Catalog descriptions live in the system prefix; bodies load on demand.

## Outcome → artifact (not “pick an editor”)

The user never chooses an editor. The file type opens the surface.

| Outcome | Artifact | Surface |
|---------|----------|---------|
| Click-edit visual (海报 / comic-as-visual / slides) | `pawCanvas` JSON via semantic `createScene` (`themeId` + `layoutId` + `slots`); `fromPage` / `fromRaster` when remaking evidence | tldraw `design.html` |
| Real website / landing | HTML with `data-paw-kind=site` | open the page (`site.html`); not a layout engine |
| Spreadsheet | workbook | `sheet.html` |
| Long document | Univer doc or `data-paw-kind=document` HTML | `docs.html` / generic preview |

`fromPage` extracts content into engine nodes. It is not CSS-faithful HTML. Pretty HTML is not a Design intermediate.

## Leftover (not live editors)

`htmlApply` parse/serialize still feeds `createScene` and PDF reconstruct. It is not a Design editor. Do not route new visual work through marked-HTML mutate.
