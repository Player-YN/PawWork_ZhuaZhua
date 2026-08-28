---
name: Visual Compile
description: User wants a click-editable Paw Work Design or Slides board compiled from a flatten image — a screenshot, 图片, generated mockup, or poster PNG — as independent text and cropped image nodes, not one cover bitmap. Do NOT trigger for a new original deck or 海报 with no flatten (slides / poster).
---

# Visual compile playbook

Host capability: **raster compile**. Not a tool. The model never calls "decompose". Understanding a picture and compiling a canvas are different jobs.

This skill remakes a **flatten image** into editable tldraw nodes. It is not how you author a new deck or poster. Original slides → skill **slides**. Original 海报 → skill **poster**. Both use semantic `themeId` + `layoutId` + `slots` and native visual kinds (`icon` / `motif` / `chart` / `image`). Do not compile a flatten into HTML. Do not `compose-image` a flatten into one PNG and call that a board.

## When not to compile

- They asked what is in the picture, to copy numbers into a sheet, to write copy from it, or to generate a *new* fused image → `inspect` / `sheet` / `acquire image` only. Do **not** `fromRaster`.
- `@截图1` / `@图片1` alone is not compile intent. The outcome after the mention decides.
- Live page / 这页 / this site with `focusPage` → `acquire fetch` then `fromPage`. DOM beats pixels.
- New pitch slides or a new 海报 with no flatten to remake → **slides** / **poster**, not this skill.

## When to compile

They want a **click-editable** poster or slides that looks like the flatten (还原、可改图层、Design 画板、独立文字和主图). Then:

1. `inspect view=item` on the handle (`screenshot1` / `截图1` / `图片1`) with media on — **look**, do not compile yet.
2. Inspect **copy / text** you will make independent: headlines, body, CTA, captions. Write those as text nodes with the exact string. Do **not** hand-fill every color-block box — the host cuts color planes and photo regions.
3. `run` html `fromRaster` with `scan: "auto"` plus the text nodes from inspect:

```json
{
  "op": "fromRaster",
  "scan": "auto",
  "kind": "poster",
  "item": "screenshot1",
  "title": "短名",
  "size": { "w": "<image width>", "h": "<image height>" },
  "nodes": [
    { "id": "headline", "type": "headline", "text": "inspect 原文", "box": { "x": 40, "y": 24, "w": 640, "h": 72 } }
  ]
}
```

Host `scan: "auto"` invents color-block / geo / cropped image regions. Merge your text nodes with that scan. Image `src` comes from `item`. Text nodes are real text, not pixels.

You may still pass a tight `box` on a photo or a must-edit word. Do not enumerate every slab.

## Must

- Several nodes. Never a single full-bleed image of the whole flatten as the poster.
- Words the user should edit → `type: text` / `headline` with the exact string from inspect. Do not leave those words only inside a cropped photo.
- `kind=deck` only for multi-page slides; one 海报 is `kind=poster`.
- After the canvas exists, field edits use the `deck` tool on `nodeId`.

## Must not

- Do not `acquire image` / compose-image to "redraw" the screenshot as one PNG.
- Do not `fromPage` a screenshot (there is no page HTML).
- Do not pass `crop: false` on image regions unless the whole bound file is already just that photo.
- Do not compile because a bound image exists. Compile because they asked for an editable board.
- Do not hand-fill every color-block box. `scan: "auto"` does that cut.

## Fine-tune

Click a node, then `deck` `setSlotText` / `setSlotSrc` / `setBox`. To replace a photo with another crop, pass `sourceBox` on `setSlotSrc`; a new image node with `fromRaster` is create-only — prefer editing the existing image node.
