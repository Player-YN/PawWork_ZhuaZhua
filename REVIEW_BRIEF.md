This file is a **closed 2026-09-05 snapshot** of one sys-ABI review wave, not durable product law. The wave is committed; tests now live under `tests/`; Design/Slides (tldraw) was later removed. Current facts: [AGENTS.md](AGENTS.md).

# REVIEW_BRIEF

Cold-review packet for an independent engineer. Paths, commands, and open questions only. Author comments live in the skippable section at the end; they are not review criteria.

## 1. Mission

Review **this working-tree change set** (guest `sys` on `run`: tabs / eval / fetch / cdp / download / screenshot; new `userScripts` + `debugger` permissions). Judge the code, permissions, transport, and failure modes against **your** standards. Do not treat nested `AGENTS.md` files, prompt copy, or this brief as correctness. Do not rewrite the product.

## 2. Repo facts

| Fact | Value |
|------|--------|
| Load root | This folder. Root file: `manifest.json`. |
| Display name | `manifest.name` / `action.default_title` |
| Package manager | None. No `package.json`. No daily npm. |
| After pull / edit | `chrome://extensions` → this unpacked card → **重新加载** |
| `userScripts.execute` | Chrome **135+** |
| User-scripts toggle | Chrome **138+**: extension details → **Allow User Scripts**. Older: Developer mode. |
| CDP while testing | Do **not** leave F12 / DevTools open on the target tab. Host code names this `CDP_BUSY`. |
| `minimum_chrome_version` in manifest | Still `"115"` (working tree). |
| Git | Local `main`. No remote. Do not `git push`. Do not change `git config`. |
| Tests | No repo test runner / `*test*` files found at write time. |

Load: Chrome → `chrome://extensions` → Developer mode → Load unpacked → this folder.

## 3. Change set (git)

**Source of this list (2026-09-05, this working tree):**

```text
git status --porcelain
git diff --name-only HEAD
git ls-files --others --exclude-standard
git log -3 --oneline
```

**The sys ABI work is uncommitted.** HEAD is `6cd4176` (`Rewrite agent spine as status-only nested context.`) — docs-only, not this ABI. Nothing is staged (`git diff --cached` empty).

Branch: `main`. Recent commits (context only; not this wave):

| SHA | Subject |
|-----|---------|
| `6cd4176` | Rewrite agent spine as status-only nested context. |
| `9a3821f` | Give 完全解放版 its own identity and local version control. |
| `825cb2f` | release: unpacked 570482b |

### Modified vs HEAD (`git diff --name-only HEAD`)

| Path | Role in this wave (descriptive, not a verdict) |
|------|-----------------------------------------------|
| `manifest.json` | Adds `userScripts`, `debugger`; description string |
| `src/background.js` | Imports `handleWorkspaceSys`; routes `workspace_sys` |
| `src/sandbox/runtime.js` | Guest `sys-request` / `sys-response` postMessage |
| `src/agent/vnext/adapters/codeRuntime.js` | `injectSys` guest wrapper |
| `src/agent/vnext/adapters/sandboxClient.js` | Relays `sys-request` to host `sys.call` |
| `src/agent/vnext/adapters/stdlib.js` | `export const sys = globalThis.sys` |
| `src/agent/vnext/host/index.js` | Re-exports `handleWorkspaceSys` |
| `src/agent/vnext/primitives/run.js` | Passes `sys`; `SYS_MODEL_HINT` on tool schema |
| `src/agent/vnext/service/sessionWorkspaceService.js` | `hostSys` → `workspace_sys` (injects `tabId` / `defaultTabId`) |
| `src/agent/vnext/sessionWorkspace/tools.js` | `inspect view=sys`; `createGuestSys` on `run` |
| `src/agent/vnext/sessionWorkspace/prompt.js` | System / world-block `sys` text |
| `src/agent/vnext/sessionWorkspace/sendMessage.js` | Forwards `hostSys` |
| `src/agent/vnext/sessionWorkspace/index.js` | Barrel export of `browserSys` symbols |
| `src/agent/vnext/sessionWorkspace/capabilityCatalog.js` | Comment only (2 lines) |
| `src/agent/vnext/primitives/acquire.js` | Comment + `/work`→`/scratch` description (not sys ABI) |
| `src/agent/vnext/index.js` | Barrel comment |
| `src/agent/vnext/sessionWorkspace/prompt.js` | Session agent system prompt |
| `src/content_script.js` | File-header comment only |
| `AGENTS.md` | Nested map / sys mention |
| `README.md` | Load blurb + sys mention |
| `src/AGENTS.md` | Host-doc sys / `workspace_sys` |
| `src/agent/AGENTS.md` | Runtime-doc sys ABI |
| `src/sidepanel/README.md` | +2 lines |
| `HANDOFF.md` | **Deleted** in working tree (`D`) |

`git diff --stat HEAD` at write time (tracked files only): `24 files changed, 488 insertions(+), 110 deletions(-)`.

### Untracked (`git ls-files --others --exclude-standard`)

| Path |
|------|
| `src/agent/vnext/sessionWorkspace/browserSys.js` |
| `src/agent/vnext/host/browserSysHost.js` |
| `src/preview/AGENTS.md` |

`src/preview/AGENTS.md` is new canvas-host documentation. It is in the working tree; canvas/office **code** is not in the sys file list above.

### Reconstruct the wave

```text
git status --porcelain
git diff HEAD --stat
git diff HEAD -- manifest.json src/background.js src/sandbox/runtime.js src/agent/vnext/
git add -N src/agent/vnext/sessionWorkspace/browserSys.js src/agent/vnext/host/browserSysHost.js
git diff HEAD -- src/agent/vnext/sessionWorkspace/browserSys.js src/agent/vnext/host/browserSysHost.js
```

(`-N` intend-to-add so untracked files appear in `git diff`. Do not commit unless asked.)

## 4. Architecture map (pointers only)

Do not reread these as law. Use them to find files:

1. `AGENTS.md`
2. `src/AGENTS.md`
3. `src/agent/AGENTS.md`

## 5. Entry points (paths)

| Surface | Path |
|---------|------|
| Guest ABI catalog / wrapper | `src/agent/vnext/sessionWorkspace/browserSys.js` |
| SW syscall implementation | `src/agent/vnext/host/browserSysHost.js` |
| SW message route | `src/background.js` — `action === 'workspace_sys'` |
| Offscreen → SW | `src/agent/vnext/service/sessionWorkspaceService.js` — `hostSys` |
| Turn wiring | `src/agent/vnext/sessionWorkspace/sendMessage.js` |
| Model tools | `src/agent/vnext/sessionWorkspace/tools.js` (`inspect` / `run`) |
| Model prompt / world line | `src/agent/vnext/sessionWorkspace/prompt.js` |
| Primitive `run` | `src/agent/vnext/primitives/run.js` |
| QuickJS inject | `src/agent/vnext/adapters/codeRuntime.js` — `injectSys` |
| Offscreen ↔ sandbox | `src/agent/vnext/adapters/sandboxClient.js` |
| Sandbox guest | `src/sandbox/runtime.js` (page: `src/sandbox/runtime.html`) |
| Guest stdlib re-export | `src/agent/vnext/adapters/stdlib.js` |
| Permissions | `manifest.json` — `permissions`, `host_permissions`, `minimum_chrome_version` |
| Content script (comment only in this wave) | `src/content_script.js` |

Channel string in sandbox files: `pawwork-code-sandbox-v1`. Message types: `sys-request` / `sys-response`.

## 6. Review charter (answer yourself)

Do not inherit answers from docs or from §10.

1. **Guest isolation.** Does guest JS (QuickJS / `src/sandbox/runtime.js`) ever receive `chrome.*`, store handles, or extension internals? What is actually injected (`injectSys`, `createSys`, `createGuestSys`)?
2. **Confused deputy / tab defaulting.** Who may send `workspace_sys`? Does the handler use `sender`? `sessionWorkspaceService.js` copies `activeTab` into `tabId` and `defaultTabId` when the guest omits them. `resolveTab` in `browserSysHost.js` uses `params.tabId ?? params.defaultTabId`. What is the attach / navigate / eval / fetch / screenshot / close scope?
3. **SW ephemerality.** `browserSysHost.js` keeps `cdpAttached` and `cdpEventBuf` in SW memory and calls `installCdpHooks()` at import. What happens on SW kill, reload, or multiple attach targets?
4. **Schema vs implementation.** Compare these four lists — do they match?
   - `SYS_OPS` / `SYS_HELP` / `wrapSysFromCall` in `browserSys.js`
   - `injectSys` guest object in `codeRuntime.js`
   - `handleWorkspaceSys` `op` switch in `browserSysHost.js`
   - `SYS_MODEL_HINT` + `inspect` `view=sys` + `prompt.js` wording
5. **Failure modes.** User Scripts off; Chrome &lt; 135; `debugger` missing; DevTools already attached (`CDP_BUSY`); restricted URLs (`chrome://`, other-extension, Widevine); result caps (`SYS_EVAL_JSON_MAX`, `SYS_FETCH_BYTES_MAX`, `SYS_EVAL_SOURCE_MAX`, `SYS_CDP_RESULT_MAX`, screenshot cap); `NOT_CLONEABLE`; timeout constants (`SYS_TIMEOUT_MS`, `SYS_CDP_TIMEOUT_MS`). Which codes are returned, and are they consistent across layers (sandbox reject vs `{ ok:false, code }`)?
6. **Prompt / tool text vs behavior.** `run` description, `code` field, `inspect view=sys`, world line `browserSys=pawwork-sys-v1`, `sessionWorkspace/prompt.js`. What does the model get told that the host does not do (or the reverse)?
7. **Surface shape.** Is there anything that looks like a prebuilt downloader product or a userscript manager UI/store? `sys.download` and `userScripts` appear in this wave — what do they actually implement?
8. **Permission blast radius.** `userScripts` + `debugger` + existing `<all_urls>` / `tabs` / `downloads`. Is the new surface gated, or is it a general SW RPC?
9. **Docs in the same tree.** `HANDOFF.md` is deleted while `AGENTS.md` / `README.md` still link to it. `minimum_chrome_version` vs 135+. Treat doc/code drift as in-scope for *this* wave only.

## 7. Out of scope

- Office canvases, preview engines, and packaged skills — unless you need them to explain a file that is actually in §3 (`src/preview/AGENTS.md` is docs-only in this tree).
- Rewriting `sessionWorkspace/prompt.js` (the live system prefix).
- Adding cookies, `tabCapture`, or further ABI ops.
- Whole-product rewrite, CWS packaging, or inventing a test harness as the review deliverable.
- Treating this file or `AGENTS.md` as a source of truth for what “should” exist.

## 8. How to spot-check

### Commands (no npm)

```text
git status --porcelain
git diff HEAD --stat
git log -5 --oneline
```

```text
rg -n "workspace_sys|handleWorkspaceSys|injectSys|SYS_OPS|SYS_MODEL_HINT|userScripts|chrome\.debugger" --glob "*.js" --glob "manifest.json"
```

```text
rg -n "chrome\." src/sandbox/runtime.js src/agent/vnext/adapters/codeRuntime.js src/agent/vnext/sessionWorkspace/browserSys.js
```

Compare op lists (read, do not “fix” during review):

| List | File |
|------|------|
| `SYS_OPS` | `src/agent/vnext/sessionWorkspace/browserSys.js` |
| `wrapSysFromCall` | same file |
| `injectSys` → `globalThis.sys` | `src/agent/vnext/adapters/codeRuntime.js` |
| `handleWorkspaceSys` | `src/agent/vnext/host/browserSysHost.js` |

### Load

1. Load this folder unpacked; **重新加载** after the working tree is what you intend to review.
2. Extension details: note **Allow User Scripts** (or Developer mode on older Chrome).
3. Confirm `manifest.json` lists `userScripts` and `debugger`.

### Mechanical tests (not product demos)

Need a BYOK key in the side panel (`pagewand_providers`) so `sendMessage` → `run` can execute. Open a normal `http(s)` page as the active tab unless the case says otherwise.

1. **Catalog round-trip.** `run` with `code` that returns `sys.help()` (and/or `inspect` `view=sys`). Diff the returned `ops` keys against `SYS_OPS` and against the `injectSys` methods.
2. **Isolation smoke.** In the same `run` guest, try to read `chrome`, `window.chrome`, or a store-looking global. Record what exists. Then `rg chrome.` on the sandbox + `injectSys` guest source as above.
3. **Restricted URL.** Active tab `chrome://version` (or another restricted URL). `sys.eval` / page `sys.fetch` / `sys.cdp`. Record `code` (host names include `NEED_PAGE`, `SYS_DENIED`).
4. **User Scripts off.** Chrome 138+: disable **Allow User Scripts**, reload, `sys.eval` on a normal `https` page. Record `code` (host names include `SYS_DENIED`). Re-enable when done.
5. **CDP busy.** Open F12 on the target tab, then `sys.cdp` attach or send. Record `code` (host names include `CDP_BUSY`). Close DevTools before other CDP checks.

Optional sixth: omit `tabId` in guest `sys.tabs.current` / `sys.eval` and see which tab is used (service injects `defaultTabId` — see §6.2).

Do not treat a green happy-path as a pass. Record codes, sizes, and which process held state.

---

## 9. Optional / biased — author notes (skip)

Authors call this a guest syscall table (`pawwork-sys-v1`), not a model tool. That is their framing, not a review criterion.

This brief must not be added to `AGENTS.md` as nested product law.
