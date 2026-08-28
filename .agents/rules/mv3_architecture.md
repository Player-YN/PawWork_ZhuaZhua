# Rule: Chrome Manifest V3 (Paw Work)

1. **manifest_version: 3** only.
2. **Service Worker is ephemeral** — durable state lives in IndexedDB/OPFS via WorkspaceService (offscreen), not SW RAM alone.
3. **End-user product = extension only** — no Tauri/desktop/Python required install.
4. **Message path:** sidepanel ↔ background ↔ offscreen WorkspaceService; generated code runs in sandbox/QuickJS, never holds Ring-0 `chrome.*`.
5. **Authority:** `docs/SESSION_WORKSPACE_RUNTIME.md` + `docs/RUNTIME_STACK.md` (not retired pipeline specs).
