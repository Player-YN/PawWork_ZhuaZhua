# Runtime stack — Session Workspace

**Product constitution:** [SESSION_WORKSPACE_RUNTIME.md](./SESSION_WORKSPACE_RUNTIME.md)  
**Authority / branch:** [WORKSPACE_RUNTIME_AUTHORITY.md](./WORKSPACE_RUNTIME_AUTHORITY.md)  
**CWS / generated-code boundary:** [CWS_CODE_RUNTIME.md](./CWS_CODE_RUNTIME.md)

This file is the **stack and self-build boundary** only. It does not define product workflow.

## Product path

```text
Sidepanel
  → workspaceRpc (background)
  → Offscreen SessionWorkspaceService
  → sendMessage
  → AI SDK 7 ToolLoopAgent (toolChoice=auto)
  → inspect / acquire / run
  → /artifacts (durable) + /scratch (per-execution)
```

## Keep

| Layer | Choice |
|-------|--------|
| Agent loop | Vercel AI SDK 7 `ToolLoopAgent` |
| LLM | OpenAI-compatible HTTPS (`createPageWandLanguageModel`) |
| Code compile | Packaged `esbuild-wasm` |
| Code execute | Packaged QuickJS-WASM on the sandbox page |
| Durable store | IndexedDB metadata + OPFS blobs |
| Skills | Folder packages (`SKILL.md` + resources); catalog in system, playbook on inspect |

All runtime JS / WASM ships in the extension. **No CDN executable.**

## Guest FS (model-visible)

```text
/context     read-only ambient
/artifacts   durable Session deliverables
/scratch     execution-scoped; settled away
```

Host jail denies cross-session paths. Generated code does not receive `chrome`, live page DOM, or raw `fetch`.

## Verify

```text
npm run build:agent
npm run test:session-workspace
npm run test:workspace
npm run pack:extension
```

Generated Lucide modules (`canvasIconPack.js`, `iconCatalogIndex.js`) are **tracked runtime files**. `build:agent` regenerates them from the `lucide-static` devDependency; `npm run check:icons` asserts the generator is deterministic. Pack copies `src/` only — never `node_modules` or Playwright browsers.

Browser pixels are opt-in:

```text
npm run playwright:install   # Chromium only; skipped by npm ci via .npmrc
npm run test:visual-deck
npm run test:extension-e2e   # packed artifacts/unpacked + local OpenAI-compatible mock
```
