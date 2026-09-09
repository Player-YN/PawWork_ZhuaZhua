<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="爪爪 · 完全解放版: the already-logged-in Chrome is a programmable computer. 爪爪 is the agent on that machine.">
</p>

Treat the Chrome you already live in as a computer. **爪爪 · 完全解放版** (`PawWork_ZhuaZhua`) is the agent that sits on it — not a selection widget, not a Chrome Web Store app.

## What you get

An unpacked MV3 side-panel agent that can operate the current tab, run guest JS against the browser (`sys` inside `run`), and keep **sheet / Univer doc / site HTML** in the session.

<p align="center">
  <img src="./assets/readme/intro.gif" width="100%" alt="Logged-in Chrome shop tab as the machine. The 爪爪 side panel docks onto it after you load this folder unpacked.">
</p>

Anything a Tampermonkey userscript could do is in scope. There is no userscript store. One packaged playbook ships: `page-restyle`.

## Proof — the mechanism

<p align="center">
  <img src="./assets/readme/features.gif" width="100%" alt="Live-page action snapshot with ref chips, run plus sys.fetch as page writing a CSV, and sheet, doc, and site canvases. Plan card is session-only.">
</p>

Side panel → service worker → offscreen `SessionWorkspaceService` → AI SDK `ToolLoopAgent`.

| You call | It does |
|---|---|
| `action` | Live tab. `snapshot`, then mutate with that generation’s `ref` + `rev` |
| `run` | Sandbox JS. Guest `sys`: tabs, eval, fetch, cdp, download, screenshot |
| `sheet` / `doc` / `web` | Univer table, Univer document, `data-paw-kind=site` |
| `inspect` / `acquire` / `clarify` | Read the session, bring public web in, pause for a question or plan |

`sys` is **not** a model tool. Login / cookies / captcha: `sys.fetch({ as: "page" })` inside `run`.

## Load it

This folder **is** the load root (`manifest.json`).

1. Chrome → `chrome://extensions` → Developer mode
2. **Load unpacked** → this folder
3. Open the side panel → paste a BYOK key (`pagewand_providers`)
4. On a normal `http(s)` page, send a task

Chrome 135+. Chrome 138+: extension details → **Allow User Scripts** if you need `sys.eval` / page fetch. Close F12 on the target tab before CDP (`CDP_BUSY`).

```text
node --test tests/runtime-regression.test.mjs
```

No daily `npm`. After you edit `src/`, hit **重新加载** on the extension card.

## Use cases (userscript-class)

Tried and plausible — not a benchmark list, not a store.

<p align="center">
  <img src="./assets/readme/usecases.gif" width="100%" alt="Six jobs: restyle versus clutter, logged-in scrape into a grid, form fill with action refs, page-identity download, tab batch and SPA navigate, reading-aid overlay.">
</p>

- Restyle a page / hide clutter (`page-restyle`, or `run` + `sys.eval`)
- Scrape a logged-in view (`sys.fetch` as page → sheet)
- Auto-fill forms (`action` snapshot / `fill_form`)
- Download with page identity (`sys.download` or page fetch)
- Batch tabs / sit on an SPA after `navigate`
- Inject a reading aid on the same tab

Design / Slides / tldraw are **removed**. Do not look for a pitch-deck canvas.

## Limits

| If you wanted | What exists |
|---|---|
| CWS install | No. Unpacked only. |
| Hosted model | No. BYOK. |
| Design / Slides | Gone. |
| A Tampermonkey catalog | No. Skill: `page-restyle`. |
| `chrome://` / Web Store pages | `NEED_PAGE`. |

## Next

Architecture and tool contracts: [AGENTS.md](AGENTS.md). GitHub: [Player-YN/PawWork_ZhuaZhua](https://github.com/Player-YN/PawWork_ZhuaZhua).
