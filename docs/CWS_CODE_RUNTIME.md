# PawWork Generated-Code Runtime and Chrome Web Store Boundary

## Implemented execution boundary

PawWork treats model-generated TypeScript/JavaScript as **task data**, not as extension source code.

```text
ToolLoopAgent
  → run({ code/files })
  → manifest sandbox page
  → packaged esbuild-wasm compiles locally
  → packaged QuickJS-WASM executes in an isolated VM
  → explicit filesystem RPC only
```

The guest program does not receive `chrome`, `window`, `document`, `fetch`, IndexedDB, OPFS, or the extension host global object. It sees only the current Session filesystem (`/context`, `/artifacts`, `/scratch`) plus console output. The host validates and jails every filesystem path.

All runtime JavaScript, QuickJS loader code, AI SDK bundles, esbuild loader code, and WASM binaries are packaged under the extension. The product runtime does not load executable JavaScript or WASM from a CDN. The former `userScripts`/live-page code injection path is removed from the product and manifest.

## Remaining external gate

This repository can verify technical isolation, packaging locality, CSP declarations, and absence of remote executable dependencies. It cannot itself grant Chrome Web Store approval. Before a public store release, submit the exact packaged build for policy review and retain the review result as a release artifact.

## Release checks

- `npm run build:agent`
- `npm run test:workspace`
- static product import/remote-code gate
- unpacked-extension manifest load or Chrome extension packing check
- verify generated code cannot access `chrome`, `window`, `document`, or another task's filesystem
