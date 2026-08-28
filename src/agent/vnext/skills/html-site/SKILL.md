---
name: HTML Site
description: User wants a real website, 官网, landing page, marketing site, or clickable HTML page they will edit as a browser page — or to 复刻/clone the current page as a self-contained site. Do not use for 海报, comics-as-visuals, PPT/slides, a spreadsheet, or a long document.
---

# Website playbook

Outcome is **the HTML page itself** under `/artifacts` (`data-paw-kind="site"`). Open it as a browser page. There is no website layout engine and no Figma-like editor. The page is the deliverable.

Wrong: `createScene` / Design canvas / pretty CSS comic as a poster.
Right: write the HTML (`write_artifact`) once, or `web act=clone` when they asked to 复刻 this site. After that, field edits and image swaps use the `web` tool on the same file.

## Clone

When they ask to 复刻 / clone this site / copy the current page as a website, call `web act=clone` (`source=active` for the live tab, or `source=url`). Never manually rewrite fetched source into a new HTML file. The host captures complete DOM + CSS + assets and writes **one** self-contained site artifact. Do not rewrite the page from truncated `inspect` snippets. Do not `fromPage` / `createScene`. Do not invent Node/`require` or live DOM access in QuickJS.

After clone, inspect `report.partial` and `report.issues`. Repair the **same** artifact (`artifactId` / in-place `web write`). Do not create a second site. Never claim WebGL, auth walls, or arbitrary app JavaScript that the packaged runtime does not run. CSS and allowlisted `data-paw-*` motion only.

Model-authored HTML is for **new** original sites only.

## Create

`run` `write_artifact` **one** HTML file. The `<html>` tag MUST include `data-paw-kind="site"`. The host stamps `data-paw-node` on headings, paragraphs, links, buttons, and images.

You may start from `templates/site.html` and fill title/lead/cta. Prefer semantic HTML the user could publish. Scripts in the preview do not run; CSS and images do.

Do not omit the site marker — unmarked pretty HTML is rejected (`USE_CANVAS`) and belongs on Design, not here.

If they asked for 海报 / 漫画 as a visual / 幻灯片, load html-poster or html-deck instead.

## Mutate

After the page exists, **web write only**. Never `write_artifact` a second site for a typo, image swap, or field edit — the host patches the same HTML. `acquire action=image` returns `/artifacts/….png`; set that path on the pinned `img` (`src` / `setSrc`). The preview resolves guest paths. `web act=undo` reverts the last in-place save.

The user points; you drive it with the `web` tool (`act=read|write`). `read` lists nodes. Then `write` with `text` / `href` / `src` or `commands[]` (`setText` / `setHref` / `setSrc`). Omit nodeId — the host pins the clicked node. Text/src/href edits need exactly one pinned node. If nothing is clicked, ask. Do not guess the first heading. A chat sentence is not an edit.

## Motion

New website motion must use CSS `@keyframes` or the allowlisted `data-paw-*` DSL. Host clone keeps CSS motion and applies the host motion blueprint — never paste source JavaScript or claim unsupported WebGL/auth/app behavior. After `web act=clone`, read `report.partial` / `report.issues` and the compact blueprint; repair in place. Honor `prefers-reduced-motion`. Details: skill resource `motion.json` and `web` act=read `.motion`.

## Must not

- Do not compile this page onto the Design canvas (`fromPage` / `createScene`) unless they asked for a poster of the site.
- Do not drive this page with deck.
- Do not tell the user to pick an editor.
