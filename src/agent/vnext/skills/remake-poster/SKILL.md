---
name: Remake Poster
description: User wants @截图 / @图片 of a competitor poster, ad, or UI shot remade as a click-editable Design board (real text + cropped photo). Do NOT trigger for a new original 海报 with no flatten (poster) or one fused PNG (compose-image).
---

# Flatten shot → live Design

Outcome is **Paw Work Design** (tldraw), not HTML, not `compose-image`, not a slide deck. A new original 海报 with no flatten uses skill **poster** (semantic layout/theme and native `icon` / `motif` / `chart` / `image` slots). A vertical stack of black text on white paper is a failed remake.

1. `inspect view=item` on `截图1` / `图片1`. Look. Inspect **copy / text** you will make independent (headlines, CTA, captions) with `box` in **source pixels**. Paper `size` = the flatten's pixel size. Do **not** hand-fill every color-block box.
2. Load skill `visual-compile` (compile) and follow `poster` for mutate.
3. **Graphic poster / 画板报** and **photo / UI flatten**: `run` `fromRaster` `scan: "auto"` `kind=poster` plus the text nodes from inspect. Host scan cuts color planes and photo regions; you supply the words. Never a single full-bleed image of the whole flatten. Do not omit text boxes (host will auto-stack and look like a document).
4. If compile `warnings` say text-only, add the missing planes with `deck createShape` before you tell the user it is done. Prefer a frame preview vs the flatten.
5. Click title/CTA → `deck` `setSlotText`. Replace a photo with `setSlotSrc` + `图片N`.
6. If they asked to *redraw* one fused picture, that is `compose-image` — not this skill's deliverable.
