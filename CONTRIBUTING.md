# Contributing

Thanks for looking at Paw Work. This is a small, opinionated codebase; [AGENTS.md](AGENTS.md) is the spine and [docs/](docs/) is the constitution. Read those before proposing structural changes.

## Build

```bash
npm install
npm run build:agent
npm run pack:extension     # → artifacts/unpacked/, load via chrome://extensions
```

## Test gates

All Node-only, no browser download required:

```bash
npm run test:session-workspace          # S-A…S-R acceptance gate
npm run test:session-workspace:all      # full suite
npm run test:session-workspace:attacks  # adversarial waves
npm run test:workspace                  # MV3 + import gates
```

Optional pixel/E2E tests need `npm run playwright:install` first (`test:visual-deck`, `test:extension-e2e`). There is no hosted CI; run the gates locally.

## Pull requests

- Keep the gates green: `test:session-workspace:all` + `attacks` + `test:workspace` before opening a PR.
- Follow the commit style in history: `type(scope): summary` (e.g. `fix(sheet): …`, `feat(canvas): …`).
- Respect the duty split: the runtime **binds** (isolation, write policy, routing), the prompt and skills **judge**. Don't move host law into prompts or ask prompts to enforce isolation.
- Don't add kernel tools beside `inspect / acquire / run / clarify`; office tools follow artifact inventory.
- The model must never gain SelectionGroup write APIs, and generated code stays inside the QuickJS sandbox.
- A green suite is progress, not proof — for canvas/preview changes, verify in a real unpacked extension.
- If your change alters durable behavior, update AGENTS.md / docs in the same PR. Keep the spine short and truthful.
