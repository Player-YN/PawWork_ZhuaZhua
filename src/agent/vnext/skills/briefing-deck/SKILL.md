---
name: Briefing Deck
description: User wants this page or selected product/help copy turned into 3–7 click-editable pitch slides. Do NOT trigger for a new original deck with no page/selection evidence (slides) or a flatten screenshot remake (visual-compile).
---

# Evidence → live slides

Outcome is **Paw Work Slides** (`kind=deck`), one live artifact — not markdown and not HTML.

1. Gather evidence only. 「这页」with `focusPage`: `acquire fetch` that URL. Selected fragments: `inspect` those only. Login wall or empty HTML: stop. Do not invent 16:9 copy.
2. From the evidence, write an **internal factual outline** (audience, one thesis, 3–7 slide roles). Model judges the final count from content density — default 3–7 frames. Do not ask the user to approve the outline unless genuinely ambiguous.
3. Load skill `slides`.
4. Cite provenance in frame `notes` — one short source line per slide. Do not spam tiny footer citations on every page.
5. Flatten screenshot only (no DOM): load `visual-compile` then `fromRaster` `kind=deck` onto the same artifact. That is remake, not the normal semantic path.
6. After the canvas exists, field edits use the `deck` tool on the selected frame.

## Visuals (same policy as slides)

User selection / workspace asset first when it is the evidence. Then packaged icon, then native motif, then native chart, then generated image.

- Charts only with real numerical data from the inspected page or selection. Never invent statistics.
- Unknown icon name: `deck act=read catalog="icons" query="…" limit=8`. Do not dump the pack.
- Motif / chart ids: `catalog="motifs"` / `catalog="charts"`. Do not paste SVG into the prompt.
- Generated photo only when it materially helps: `deck act=read catalog="image-brief"` (`layoutId`, `themeId`, `subject`) → `acquire action=image` with the returned prompt / aspect → attach the durable `/artifacts` path on the **same** `createScene`. Compile does not generate images.
- One dominant visual per slide. Visual acquisition may precede compile.
