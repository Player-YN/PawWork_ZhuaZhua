---
name: Slides
description: User wants PowerPoint, Google Slides, 幻灯片, a pitch deck, weekly update slides, training slides, QBR, launch slides, or any slide show they will click-edit in Paw Work Slides. Do NOT trigger for a tall article/document (doc), a single 海报 (poster), a real clickable 官网 (html-site), or a spreadsheet (sheet-nl).
---

# Slides playbook

Outcome: **Paw Work Slides** (tldraw `pawCanvas`, `kind=deck`) — one live artifact, many
1920×1080 frames. HTML is never the SoT. You decide slide count and story; the host owns
geometry and never paginates for you.

## Compile

One `run` `createScene` `kind=deck` with root `themeId` and
`frames: [{id, layoutId, slots, variant?, notes?}]`. No `x/y/w/h`, no `nodes` on this path.
An open Slides canvas (`activeHtml` / `canvases.deck`) is reused by the host automatically.

- Themes (pick one per deck): `hanbai` `ink-rose` `midnight-cyan` `forest` `studio-amber`
  `editorial` `cobalt` `mono`. Copy ids exactly.
- Variants (per frame, same theme): `paper`(default) `surface` `accent` `dark`.
  Cover / section / closing default dark or accent; use 1–2 dark/accent anchors in a short deck.
- Slide layouts: `title` `title-visual` `section` `agenda` `points` `points-icons` `two-col`
  `compare` `stat-row` `quote` `image-caption` `timeline` `process` `matrix` `case-study`
  `closing`. Vary with purpose; avoid 3+ consecutive identical layouts or variants.
- Host slot limits: title ~64 chars, kicker ~32, subtitle ~120. Frame `notes` is accepted and
  holds provenance — one short source line per slide.

## Visual slots

`slots.visual` takes `{kind: icon|motif|chart|image}`. Priority: user selection / workspace
asset (`path|item|handle|artifactId`) → packaged icon (`{kind:"icon", name|query}`) → native
motif → native chart (`bar|line|donut`; data must be copied from evidence) → generated image.
One dominant visual per slide.

- Icon name unknown: `deck act=read catalog="icons" query="…" limit=8`. Never dump the pack.
- Motif / chart ids: `catalog="motifs"` / `catalog="charts"`.
- Generated image: `deck act=read catalog="image-brief"` (`layoutId`, `themeId`, `subject`,
  no lettering) → `acquire action=image` with the returned prompt/aspect_ratio → put the
  returned `/artifacts` path in `slots.visual` on the same deck. Compile never generates images.

## Design red lines

- No bullet-dump walls; one key message per slide.
- Never fabricate chart data; empty evidence means no chart.
- No decorative outline boxes stacked as "design"; no AI-slop accent bars under every title.
- A designed slide is filled paper: background, hierarchy, one dominant visual anchor.

## QA and mutate

`CANVAS_QA_FAILED` lists per-frame issues — fix slots/layout/theme and resubmit the same
`artifactId`. One-frame rework: `replacePlate {plateId|frameId, layoutId, themeId?, slots}`
keeps frame identity. Clicked-node edits: `deck` `setSlotText`/`setSlotSrc`, omit nodeId (host
pins the selection). Slide motion is host-owned: default `stagger-fade`; set
`animation:{preset:"none"}` on dense slides only. Deliver after QA passes; report the single artifact.

Routing: live-page evidence intake → skill **briefing-deck** (`fromPage`/`fromSelection`);
flatten remake → **visual-compile** (`fromRaster`); one fused PNG → **compose-image**;
clickable site → **html-site**.

## Example

```json
{
  "op": "createScene", "kind": "deck", "themeId": "ink-rose",
  "frames": [
    { "id": "s1", "layoutId": "title-visual", "variant": "dark",
      "slots": { "kicker": "Chrome 扩展", "title": "在选区上直接交付",
                 "visual": { "kind": "icon", "name": "paw-print" } } },
    { "id": "s2", "layoutId": "stat-row",
      "slots": { "title": "本季完成率",
                 "visual": { "kind": "chart", "type": "bar", "data": [12, 19, 7],
                             "labels": ["Q1", "Q2", "Q3"] } },
      "notes": "Q1–Q3 来自 表格1" }
  ]
}
```

```json
{
  "op": "replacePlate",
  "plateId": "s2",
  "layoutId": "quote",
  "themeId": "forest",
  "slots": { "quote": "版式由宿主编译。", "attribution": "Paw Work" }
}
```
