# Runtime Authority — Session Workspace (product)

**Current product constitution:** [SESSION_WORKSPACE_RUNTIME.md](./SESSION_WORKSPACE_RUNTIME.md)  
**Product entry:** `src/agent/vnext/runSession.product.js`  
**Service:** `src/agent/vnext/service/sessionWorkspaceService.js`  
**Agent runner:** `sessionWorkspace/sessionAgent.js` → AI SDK 7 `ToolLoopAgent`  
**Acceptance:** `tests/session-workspace/` (S-A…S-R, pendingCount=0) + `test:session-workspace:attacks`

Product path is Session Workspace only.

---

## Product truth (current)

| Layer | Truth |
|-------|--------|
| Product path | Sidepanel → background RPC → **offscreen SessionWorkspaceService** → **sendMessage** → **ToolLoopAgent** |
| Workspace owner | **Session** (`/artifacts` durable, `/scratch` execution-scoped) |
| Model tools | Always on: **inspect**, **acquire**, **run**, **clarify**, **sheet**, **deck**, **doc**, **web**; inventory aims targets, does not hide tools; `toolChoice=auto`; **no SelectionGroup mutation** |
| Skills | Folder packages under `vnext/skills/<id>/` (SKILL.md + resources); description = semantic when-to-use |
| Selection | Bound groups = ambient compact context; inspect on demand |
| Code runtime | Packaged QuickJS + esbuild-wasm (no CDN); sandbox page |
| Durable storage | IDB snapshot metadata + OPFS blob bytes (lazy hydrate) |
| Tests | session-workspace gates + adversarial waves (`wave_canvas_playbook`, `wave_site_multiselect`, …); pack gates |
| Stable | **`main`** · worktree `Desktop/PawWork` |
| Dev | **`runtime-vnext`** · worktree `Desktop/PawWork-vnext` |
| Remote | https://github.com/Player-YN/PawWork-vnext (private) |
| Public | https://github.com/Player-YN/PawWork_ZhuaZhua · tree via `npm run sync:public` (do not push private commits) |
| Brand | **Paw Work** (`pagewand_*` storage keys legacy) |

## Intentional CI / packaging

- `.github/workflows/ci.yml`: build + session-workspace:all + attacks + pack gates + pack:extension  
- `pack:extension` forbids shipping `node_modules` / `.git` / plan extracts  
- `sync:public` archives `main` into `Desktop/PawWork_ZhuaZhua` (separate public history)  

## Stack companions

- [PROMPT_RUNTIME.md](./PROMPT_RUNTIME.md) — prompt judges; runtime binds  
- [ENGINE_CANVAS_A.md](./ENGINE_CANVAS_A.md) — landed Design/Slides + site HTML  
- [RUNTIME_STACK.md](./RUNTIME_STACK.md) — stack / self-build boundary  
- [CWS_CODE_RUNTIME.md](./CWS_CODE_RUNTIME.md) — CWS / generated-code notes  
