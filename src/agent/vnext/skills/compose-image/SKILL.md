---
name: Compose Image
description: User wants to compose, merge, collage, or restyle selected/attached images into one new picture, or generate a picture from a prompt. Use when the outcome is a single durable image under /artifacts. Do NOT trigger for editable slides or a 海报 (slides / poster).
---

# Compose Image playbook

This skill produces **one raster PNG** under `/artifacts`. It is not how you build editable slides or a 海报. Those are tldraw canvases — skill **slides** / **poster** (native `icon` / `motif` / `chart` / `image` slots). Do not flatten a deck into an image to "finish" it. Do not use this skill to fill a slide or poster visual slot; those skills derive `deck act=read catalog="image-brief"` then `acquire`, then attach the durable path.

- Bind the user's selected images to this session first (host/UI). Do not invent group writes.
- `inspect` bound image items only if you need to confirm which references exist.
- Call **acquire** with `action: "image"` and a concrete `prompt`.
- Pass `itemIds` of bound image WebItems for compose / image-to-image. Omit `itemIds` to use every bound session image.
- This is the **only** place where lettering inside the picture is legitimate: when the user explicitly wants text baked into the fused image, pass `allowText: true` to acquire. Everywhere else the host stamps image prompts no-text — captions belong in canvas text nodes.
- If Settings has not enabled image generation, tell the user to open ⋯ → 设置 and tap **OpenRouter 生图**. Do not fake pixels in `run`.
- The host writes a real PNG under `/artifacts` and validates bytes. Observation is short JSON (path, artifactId) — never paste base64 into chat.
