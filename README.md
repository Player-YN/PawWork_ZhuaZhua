# 爪爪 · Paw Work

**Select on the live page. Describe the outcome. Take away a real file.**

English · [中文](README.zh-CN.md)

> [!IMPORTANT]
> **Just want to use Paw Work?** Do **not** clone this whole repository. You do not need the developer files. Clone **only** branch [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) (~44 MB). That folder *is* the Chrome extension (`manifest.json` at the root).
>
> 1. In a terminal:
>    ```bash
>    git clone --depth 1 --single-branch --branch unpacked https://github.com/Player-YN/PawWork_ZhuaZhua.git paw-work
>    ```
> 2. Open Chrome. In the address bar, go to `chrome://extensions`
> 3. Turn on **Developer mode** (top-right)
> 4. Click **Load unpacked**. Select the `paw-work` folder — the one that contains `manifest.json`
>
> No git? On this GitHub page: **Code → switch the branch to `unpacked` → Download ZIP**. Unzip, then do steps 2–4 (select the unzipped folder that contains `manifest.json`).
>
> Optional, same bytes: the [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest) (`paw-work-unpacked.zip`). Unzip and Load unpacked the inner `paw-work` folder.

[![CI](https://github.com/Player-YN/PawWork_ZhuaZhua/actions/workflows/ci.yml/badge.svg)](https://github.com/Player-YN/PawWork_ZhuaZhua/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Player-YN/PawWork_ZhuaZhua)](LICENSE)
![Chrome MV3](https://img.shields.io/badge/chrome-manifest%20v3-4285F4?logo=googlechrome&logoColor=white)

```text
SELECT + DESCRIBE OUTCOME → DELIVER
```

[What you can do](#what-you-can-do) · [See it](#see-it) · [How it works](#how-it-works) · [Install](#install) · [Trust](#trust--privacy) · [Limitations](#limitations)

---

## What it is

Paw Work is a **Chrome MV3 extension**. Turn Paw Mode on, point at images, tables, text, blocks, or links on the page you already have open, then say what you want in the sidepanel. It returns **editable office files** on live canvases — not a chat essay about the page.

It is not an unattended Operator that roams the web for you, and not a terminal coding agent. It sits beside the browser world you are already logged into: you set the scope, it returns something you can check.

## Who it is for

| For | Not a first choice for |
|-----|------------------------|
| People who already work in the browser — compare, extract, export, turn a page into a sheet, deck, poster, site, or long doc | Unattended RPA (cross-site checkout, submit, pay) |
| Work that starts on a page you are already looking at (shop, SaaS, docs, article) | A coding-agent home: Docker, local shell, million-file repos |

No account. No server. You bring your own model keys.

## What you can do

| On the page | You ask for | You take away |
|-------------|-------------|----------------|
| Product photos, tables, copy, blocks, links | “Make a comparison sheet” | A live spreadsheet ([Univer](https://univer.ai)) you can keep editing |
| The same selection, or a blank workspace | “Make an 8-page deck / one poster” | Design/Slides on a [tldraw](https://tldraw.dev) canvas; decks export to PPTX |
| The current page | “Make an editable site, with entrance motion” | Real HTML. Tweaks stay on that file. Site QA gates quality |
| Long notes or a transcript | “Turn this into a document” | A document canvas |
| Need a picture or a lookup | “Generate in this style / search, then put it in the sheet” | Images in the workspace; search uses **your** web-acquire key |

You can run more than one task in the same session. `@` mentions a capture. Empty templates for sheet / slides / docs / site sit at the foot of the workspace rail.

**Try asking:**

- Turn these product cards into a comparison sheet.
- Make a poster from the selected images.
- Rebuild this page as an editable site.
- Turn these notes into an 8-page deck.
- This is messy — show a plan first and wait for my approval.

Complex work can yield a **plan card** before it writes: Approve, Decline, or Required to change (you leave notes; it revises the plan; the old card stays). It does not silently expand outside what you selected.

## See it

Selecting product photos on a live Apple page. The sidepanel holds the capture; the next line is the outcome.

![Selecting iPhone product photos on apple.com.cn with Paw Work sidepanel chips](docs/images/select-on-page.png)

A live spreadsheet beside the sidepanel. The agent is splitting a SKU column on the **open** workbook — not dropping a second file into chat.

![Live Univer sheet with Paw Work sidepanel editing the open workbook](docs/images/sheet-edit.jpg)

## How it works

1. Turn **Paw Mode** on (off = normal browsing).
2. Click what matters on the page.
3. In the sidepanel, describe the outcome.
4. Open the file from the workspace rail. Click a node, say the change, only that node changes.

```text
Live page (Paw on) → select → sidepanel → live canvas / file
```

Not listed on the Chrome Web Store yet. **Passersby:** clone only branch [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) (see the box at the top) — do not clone this source tree. Then: Paw on → paste a model key → select something → say one sentence.

## Trust & privacy

- No account, no Paw Work server, no hosted model quota.
- Keys live in Chrome extension storage on **your** machine and are sent only to the HTTPS endpoints **you** set.
- Model-generated code compiles with packaged esbuild-wasm and runs in a QuickJS VM. It never sees `chrome.*`, the live page DOM, or another session’s files. No executable code is loaded from a CDN.
- Capture is what you pointed at, not the whole site. The agent inspects on demand. You can stop a run; it must not keep working in the background.

## Install

**If you just want to use it** — do not clone this whole repository. Clone **only** branch `unpacked`.

1. `git clone --depth 1 --single-branch --branch unpacked https://github.com/Player-YN/PawWork_ZhuaZhua.git paw-work`
2. Open Chrome → `chrome://extensions`
3. Turn on **Developer mode**
4. **Load unpacked** → select the `paw-work` folder (it contains `manifest.json`)

No git? **Code → branch `unpacked` → Download ZIP**, unzip, then steps 2–4. Same pack is also on the [Release page](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest) as `paw-work-unpacked.zip`.

No Node, no `npm install`. Do not load the source-repo root.

### Build from source (contributors)

Prerequisites: Node.js 20+, npm, Chrome 120+.

```bash
git clone https://github.com/Player-YN/PawWork_ZhuaZhua.git
cd PawWork_ZhuaZhua
npm install
npm run build:agent
npm run pack:extension
```

Then Load unpacked → `artifacts/unpacked/`. After `npm install` the folder is hundreds of megabytes (`node_modules`). **Do not load the repository root.** Rebuild (`npm run build:agent`) and reload after pulling.

How to build and test: [CONTRIBUTING.md](CONTRIBUTING.md).

## Bring your own keys

Nothing runs without them. Configure in the sidepanel settings.

- **Chat** — any OpenAI-compatible HTTPS endpoint (base URL + key + model).
- **Image** (optional) — its own base URL / key / model; empty fields inherit chat. OpenRouter’s image origin is filled by the template.
- **Web search / fetch** (optional) — your search or crawl keys. Without them, fetch can still do an anonymous GET.
- **tldraw license** (optional) — removes the Design/Slides watermark; see Limitations.

## Stack

Chrome MV3 extension. Sidepanel talks to an in-extension workspace (no Paw Work cloud). Spreadsheets and documents: Univer. Posters and slides: tldraw. Sites: real HTML. Generated JS runs in a local WASM sandbox. Files persist in the browser (IndexedDB + OPFS). MIT code in this repo; third-party engines in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Runtime contracts (isolation, writes, tools) live in [`docs/SESSION_WORKSPACE_RUNTIME.md`](docs/SESSION_WORKSPACE_RUNTIME.md) and [`docs/PROMPT_RUNTIME.md`](docs/PROMPT_RUNTIME.md). Host path: [constitution § Host path](docs/SESSION_WORKSPACE_RUNTIME.md#host-path).

## Limitations

- **Not on the Chrome Web Store yet.** Clone branch [`unpacked`](https://github.com/Player-YN/PawWork_ZhuaZhua/tree/unpacked) (or the same-bytes [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest)). GitHub sideload is a stopgap; CWS is the later front door.
- **Extension only.** Chromium MV3. No hosted service, no account.
- **BYOK required.** Chat, image, and web-acquire each need your keys.
- **tldraw watermark.** Without a production license from tldraw, Design/Slides shows the official watermark. Hiding it with CSS/DOM is not supported and not acceptable.
- **Capture is not full truth.** Selection is intent; the agent inspects on demand and may ask once when the outcome type is genuinely unclear.
- **Not a full Excel / PowerPoint / browser-RPA replacement.** Live canvases are the work surface. It will not roam, pay, or submit for you unattended.

## License

MIT for the code in this repository — [LICENSE](LICENSE). The source tree does not ship Univer/tldraw runtime bundles (you build those locally). The **`unpacked` branch** and the **Release zip** include those builds, plus a verbatim [tldraw license](notices/tldraw-LICENSE.md).
