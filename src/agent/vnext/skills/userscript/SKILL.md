---
name: Userscript
description: User wants to program the already-open http(s) tab with one-shot page JS — change live-page behavior that ordinary click/fill cannot. Load this playbook then run via sys.eval; not a persistent script manager. Do NOT trigger when the job is in-page restyle (page-restyle), extract article/list/table to a file (page-extract), drive a visible form (form-autopilot), bind page-local keys (site-hotkeys), walk next-page (auto-pager), or produce 海报/slides/官网/spreadsheet artifacts.
---

# Live-page userscript playbook

Use when the job is to **program the already-open http(s) tab** with one-shot JS (`run` + `sys.eval`), not to restyle, extract, fill a form, bind keys, or page a list (those have their own skills).

This is **not** a script manager, store, or persistent userscript product. There is no `userScripts.register`. `sys.eval` is one-shot `userScripts.execute`: the function runs, returns JSON, and any leftover DOM/`<style>`/listeners live only until the **document** goes away (navigate / reload / SPA full remount).

Outcome: guest `run` + `sys` programs the **already-open http(s) tab**. Never invent `chrome.*` in guest or in `code`.

## Load then run

1. `inspect view=sys` or `await sys.capabilities()` if userScripts may be off.
2. `inspect view=skill` `skillId=userscript` (this file). Special recipes: `page-restyle` / `page-extract` / `form-autopilot` / `site-hotkeys` / `auto-pager`.
3. `run` with `sys.eval`. Do not add a `sys` tool.

## World vs `action`

| Need | Use |
|------|-----|
| Click / fill / press a normal control | `action` first (`snapshot` → same `rev` `fill_form` / `click` / `press`) |
| Inject CSS, hide nodes, TOC, hotkeys, scrape DOM | `sys.eval` `world:"USER"` (own world + DOM; no page JS heap) |
| Read framework store / `__NEXT_DATA__` / player object | `sys.eval` `world:"MAIN"` |
| Same-origin fetch with page cookies | `sys.fetch({ as:"page", url })` |
| Extension identity (no cookies) | `sys.fetch({ as:"extension", url })` |

Default **USER**. MAIN only when USER cannot see the value. `action` for visible form widgets; eval when refs fail (see `form-autopilot`).

Guest `run` has `fs` + `sys` only. `code` is an **async function body** (host wraps it). Return a JSON value. DOM nodes / functions → `NOT_CLONEABLE`. Cap: source 100k chars; JSON 1MB; host timeout **20s**.

## Copy-paste `run`

```js
const cap = await sys.capabilities();
if (!cap.userScripts?.available) {
  return { ok: false, code: 'SYS_DENIED', reason: cap.userScripts?.reason || 'Allow User Scripts' };
}
const tab = await sys.tabs.current();
const out = await sys.eval({
  world: 'USER',
  tabId: tab.id,
  code: `
    const href = location.href;
    const title = document.title;
    return { href, title, ready: document.readyState };
  `
});
return { tab: { id: tab.id, url: tab.url }, eval: out };
```

SPA wait (stay under ~12s):

```js
const want = 'article, main, [role="main"]';
await sys.eval({
  world: 'USER',
  code: `
    const want = ${JSON.stringify(want)};
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if (document.querySelector(want)) return { ready: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ready: false };
  `
});
```

After `sys.tabs.navigate` / `reload` / a click that remounts the document, **re-eval**. Check `location.href` before claiming the script is still on.

## Failures

| code | Retry |
|------|--------|
| `SYS_DENIED` / userScripts unavailable | Tell user: extension card → **允许运行用户脚本** (Chrome 135+; older: Developer mode). Then retry. |
| `NEED_PAGE` | Focus an http(s) tab. Not `chrome://`, Web Store, or extension preview. |
| `STALE_REF` / `NO_TARGET` | `action` path: new `snapshot`, same-generation `rev`. |
| `EVAL_FAILED` | Fix the function body; do not switch to MAIN unless the error is missing page globals. |
| `NOT_CLONEABLE` | Return `{text, html, count, hrefs}` not nodes. |
| `TOO_LARGE` | Truncate; write `/scratch` via `run`/`fs` after a smaller eval. |
| `SYS_TIMEOUT` / `SYS_ABORTED` | Side effects may already exist — eval a status probe, do not blindly re-inject. |
| `CDP_BUSY` | Close F12 if you used `sys.cdp`. This skill does not need CDP. |

## Must not

- Do not build a script manager UI, `@match` installer, or claim scripts survive extension reload / new documents.
- Do not add `userScripts.register` or a new model tool.
- Do not write video downloaders, VIP unlock, paywall/DRM bypass, cookie stealers, or captcha-farm solvers.
- Do not hide ads as a product; hiding **user-named** clutter is `page-restyle`.
- Do not `web act=clone` / `write_artifact` a site unless they asked to 复刻 a deliverable page.
