---
name: Poster
description: User wants a 海报, flyer, campaign visual, event one-pager, hiring poster, webinar poster, comic-as-visual, or a single designed poster they will click-edit in Paw Work Design (tldraw). Do NOT trigger for a multi-slide PPT/deck (slides) or a clickable 官网 (html-site).
---

# Design poster playbook

Outcome is a **Paw Work Design** canvas (tldraw `pawCanvas`), not HTML, not a blog, not a deck of slides, not one fused PNG. Never write a `.html` poster (`USE_CANVAS`).

Classify each selection as **plate** (成片 — attach as-is), **reference** (style cue; `acquire image` only for that one no-text plate), or **evidence** (facts — do not paste as decoration). Clarify once if a reference is ambiguous.

## Semantic compile

One poster `layoutId` + one `themeId` → one `run` `createScene` (`kind=poster`) with `frames: [{id, layoutId, slots}]`. No raw `box` / `nodes` on the normal path. Runtime owns geometry. One dominant hierarchy and one visual anchor. If content will not fit, cut copy or pick another layout.

Themes: `hanbai`, `ink-rose`, `midnight-cyan`, `forest`, `studio-amber`, `editorial`, `cobalt`, `mono`.

Poster layouts: `poster-hero`, `poster-split`, `poster-event`, `poster-quote`, `poster-product`, `poster-editorial`, `poster-data`, `comic-panel`.

Visuals, in this order: selected / user asset first → packaged icon → native motif → native chart (real numerical data only; never invent statistics) → `acquire action=image` no-text. After `acquire action=image`, the **next** canvas write must attach the returned `path` as the `visual` slot. Never bake lettering into a generated image.

Unknown icon: `deck act=read catalog="icons" query="…" limit=8`. Motifs / charts: `catalog="motifs"` / `catalog="charts"`. Generated plate: `deck act=read catalog="image-brief"` with `layoutId`, `themeId`, `subject` → `acquire` with the returned prompt / aspect → attach `path`. Compile does not generate images.

Comic / 自我介绍长图: one panel story per Frame (`comic-panel`). Paper count and size are your judgment. Raw `nodes` / `box` only as last-resort polish after a semantic plate exists.

## Other routes

- Live page / 这页 / this site with `focusPage`: `acquire fetch` then **fromPage**.
- Selection fragments: **fromSelection**
- Flatten screenshot remake: **visual-compile** (and **remake-poster** when they asked 变成可编辑海报). Photo/UI flattens use **fromRaster** `scan: "auto"`.
- A clickable 官网 is skill **html-site**. A fused PNG is **compose-image**.

`fromPage` extracts content into engine nodes — it is not CSS-faithful HTML.

## QA and mutate

On `CANVAS_QA_FAILED`, repair slots / change layout / split content and resubmit to the **same** artifact. Never a second poster file.

After the poster exists, drive the canvas with the `deck` tool (`act=read|write|export`). Omit nodeId — host pins selection. After `run` writes slots JSON, `deck` write with that `path` — do not retype.

- `setSlotText` / `setSlotSrc` — clicked node
- Semantic `replacePlate` `{plateId|frameId, layoutId, themeId?, slots}` — rewrite one frame, keep identity

Export PNG / SVG / PDF from the Design tab (current Frame), not by screenshotting chrome.
