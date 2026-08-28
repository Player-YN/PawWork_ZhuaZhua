# PawWork Session Workspace Runtime — Constitution

**Status:** product authority  
**Companion:** [WORKSPACE_RUNTIME_AUTHORITY.md](./WORKSPACE_RUNTIME_AUTHORITY.md)

---

## 0. Executive Decision

```text
Session Workspace
  ├── Conversation
  ├── Web Context (bound SelectionGroups, ambient)
  └── Artifacts (durable)

Every user message → General ToolLoopAgent (toolChoice=auto)
  → world: bound groups + activeTab/focusPage
  → answer | inspect | acquire | run
  → /scratch (transient) and/or /artifacts (durable)
```

### North-star principles

1. **Session is the workspace.**
2. **Every user message enters the same general Agent loop.**
3. **The model decides** whether the sufficient outcome is text, inspection, research, computation, or a persistent artifact.
4. **Tools and Skills remain available; availability never implies obligation.**
5. **SelectionGroups are ambient Web context, not mandatory inputs.** The live tab is document identity (`activeTab` / `focusPage`) in the world snapshot — not a SelectionGroup. Empty selection + 「这页」 refers to `focusPage`; fetch that URL for evidence. `@` a page overrides focus for the turn.
6. **Artifacts persist for the Session. Scratch disappears after an execution settles.**
7. **Runtime enforces ownership, isolation, persistence and capability boundaries — not semantic workflow.** Frontier models **judge** (outcome, skill, clarify, compose). Host **binds** (write policy, open routing, fail-closed office writes). Matched duties: [PROMPT_RUNTIME.md](./PROMPT_RUNTIME.md).

### Tools

Always on: **inspect**, **acquire**, **run**, **sheet**, **deck**, **doc**, **web**. Clarify is control-plane UI (also always in `tools[]`): questions, or a plan the model presents when it judges the work complex. `/plan` is a slash command (not a skill) that forces a plan card this turn. Panel: Approve / Decline / 需要修改 (Required to change). Approve pins `execution.frozenPlan`; `prepareStep` re-injects the contract (not a chat bubble). Revise notes do not pin; the model re-yields a new card (old card + notes stay). Decline is a complete stop. Skills = folder playbooks, not tools.

Inventory (`canvasInventory`) lists office artifact ids as targets, not a progressive-disclosure gate. Missing canvas → host `NO_CANVAS`. `run` creates canvases (`createScene` / `write_artifact` with site|document markers / `createWorkbook` / `ingestPdf`); daily mutate is not `run.op`. Unmarked pretty HTML is `USE_CANVAS`. Writes omit target using session focus and return `{ dirty, readback }`. Guest `path`/`from` on sheet/deck/doc/web writes loads `/scratch` or `/artifacts` JSON/HTML (`ENOENT` / `BAD_INPUT`); `run` computes, official tools apply — do not retype. No 9th tool. World → Act → Verify.

`acquire` actions (vendor-agnostic): `search` | `fetch` | `map` | `crawl` | `image` | `note`. Host routes provider keys and rejects missing query/url/prompt before HTTP. Model cannot mutate SelectionGroups. External MCP is a capability catalog (empty this wave), not extra model tools.

---

## 1. Durable domain objects

```text
Session
SelectionGroup
WebItem
Artifact / ArtifactPackage
```

---

## 2. Execution bookkeeping (not a domain object)

```ts
ExecutionContext {
  executionId: string
  sessionId: string
  abortSignal: AbortSignal
  scratchRoot: string
  leases: Set<string>  // webItemIds
  startedAt: number
}
```

One Agent turn / tool-loop execution. No intent classifier, taskType, or semantic stages.

---

## 3. Storage model

**Product durable store:** `DurableSessionWorkspaceStore` (IDB metadata + OPFS blobs in browser; process-scoped durable backend in Node tests).  
`SessionWorkspaceService.create()` always opens a durable store. A **new service/store instance with the same db name recovers Session artifacts** — pure in-memory Maps are test-only.

Host layout (internal):

```text
/session/{sessionId}/
  artifacts/…
  metadata/artifact-index
/tmp/{sessionId}/{executionId}/   # scratch
```

Guest mounts (model-visible):

```text
/context     # read-only ambient
/artifacts   # durable Session workspace
/scratch     # execution-scoped temporary
```

Cross-session paths are **denied by host FS jail**, not by prompts.

UI: Session **artifact shelf** is always openable; lists count/storage, click-to-preview, download, delete via `listArtifacts` / `readArtifact` / `deleteArtifact`. Foot templates create blank Design / Slides / Sheet / Docs / Site in the current session. Deleting a Session UI entry must `deleteSession` cascade (artifacts + bindings; Groups kept).

### Open ingest (host)

`classifyOpenArtifact({ name, mime, bytes, text })` is the only open router. Magic bytes win; filename/MIME are hints. ZIP (`PK`) and PDF (`%PDF`) are never UTF-8-decoded as document text.

| Kind | Canvas |
|------|--------|
| xlsx / csv / tsv / json-workbook | sheet |
| docx / json-document / html-document | docs |
| json-canvas (pawCanvas) | design (tldraw) |
| html-site (`data-paw-kind=site`) | web (`site.html`) |
| pdf reconstruct / leftover html-plates / html / md | generic preview (`artifactPreview.html`) — not a layout editor |
| png / jpeg / gif / webp | gallery |
| unknown zip / opaque binary | file card — not text |

Adapters declare loss: xlsx → Univer `IWorkbookData` is not Excel-complete; poster PDFs prefer embedded JPEGs over CID text.

---

## 4. Persistence rules

### `/artifacts`

- Survive turns, agent restarts, browser/runtime restart for that Session.
- Deleted only by explicit artifact delete **or** Session delete.
- Runtime **never** auto-deletes artifacts for age, size, “unused”, or model preference.

### `/scratch`

- Available for the active ExecutionContext.
- Deleted when execution settles / aborts / fails (no model cleanup tool required).

### WebItem materialization

Reachable if:

- referenced by a SelectionGroup, **or**
- held by an active ExecutionLease

Otherwise eligible for GC under policy / storage pressure.

---

## 5. Message path

```text
sendMessage(sessionId, message)
  → append Session conversation
  → world snapshot: bound groups + activeTab/focusPage + canvases
  → General ToolLoopAgent (tools always registered, toolChoice=auto)
  → loop until the model stops calling tools, or Abort
  → final text and/or tool use
  → settle: release leases, delete scratch
```

There is **no** user-visible Chat vs Run product split. Every user message is `sendMessage`.

Trajectory is UI support, not workspace truth: fat command payloads slim to `[stripped]` / `[path-hydrate]` / `[omitted]`; empty official writes fail-speak (`BAD_INPUT`, never `ok` with `applied:0`); `user_stop` is a first-class abort on the path; thought/text are first-class events; `plan-pinned` fires once on approve, not on every `prepareStep` hop.

---

## 6. Ambient SelectionGroup

- Capture Groups + items are **ambient** (one catalog, one active capture target). They are not owned by a session workspace.
- Session **binds** group ids for the agent (inspect / world). Bind ≠ picker visibility.
- Clipboard stays per-session.
- Initial model context: compact `{ id, name, itemCount }` — **not** all items.
- Unrelated questions must not force inspect / materialize-all.
- inspect is on-demand when the model needs evidence.
- Group membership mutations are visible to **future** inspect; active leases protect items in use.

---

## 7. Acceptance invariants (S-A … S-R)

| Id | Invariant |
|----|-----------|
| S-A | Direct question → text only |
| S-B | Selected context unrelated → no inspect |
| S-C | Selected-context question → inspect + answer, no artifact required |
| S-D | Artifact request → run + durable artifact |
| S-E | Later turn modifies previous artifact |
| S-F | New session isolated workspace |
| S-G | Cross-session FS read denied |
| S-H | Execution scratch removed after settle |
| S-I | Artifact survives execution settle |
| S-J | Artifact survives runtime restart (store flush/reload) |
| S-K | Deleting session deletes its artifacts |
| S-L | Deleting session does not delete SelectionGroup |
| S-M | Group mutation visible to future inspect |
| S-N | Active execution lease protects used WebItem |
| S-O | Released unreachable WebItem gets GC |
| S-P | Storage pressure never auto-deletes artifacts |
| S-Q | Many artifacts not injected into initial model context |
| S-R | No Task object created per normal message |

Gate: `tests/session-workspace/` with `pendingCount=0`.

---

## 8. Product entry

**Only** product runtime entry for agent work:

```text
src/agent/vnext/runSession.product.js
```

Sidepanel → `workspaceRpc('sendMessage' | …)` → Session Workspace Service → general agent.

---

## 9. NOT DONE IF

Any of:

- Workspace ownership is per-message instead of the Session
- Selection auto-inspect / auto-run
- Ordinary Q creates answer.md “for show”
- User must pick Chat vs Run as product modes
- Model must report executionReadiness
- Tools require a prior freeze/commit
- Artifacts deleted per turn
- Agent may auto-delete persistent artifacts
- Sessions can open each other’s scratch
- System prompt is a pile of if/else scenario patches
- Opening ZIP/PDF as UTF-8 (garbled `PK` / `%PDF` / CID junk) instead of `classifyOpenArtifact`
