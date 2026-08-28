# Side panel modules (vanilla)

Production UI entry remains **`src/sidepanel.html`** → **`src/sidepanel.js`** (orchestrator).

## CSS load order

Linked from `sidepanel.html` (do not reorder without reason):

| Order | File | Role |
|------:|------|------|
| 1 | `css/tokens.css` | Theme tokens (black+rose / 汉白玉+amber) |
| 2 | `css/layout.css` | Height chain, chrome shrink, task-stream scrollport, **container queries** |
| 3 | `css/motion.css` | Ambient, send/stop rings, reduced-motion |
| 4 | `sidepanel.css` | Components / surfaces leftovers |

### Container queries + density (P3)

`.panel` sets `container-type: inline-size` + `container-name: panel`.

| Query / flag | Behavior |
|--------------|----------|
| `@container panel (max-width: 340px)` | Hide `.page-url`, stack `.composer-meta` / `.sel-toolbar`, hide `.brand-sub`; **tighter topbar / pick-btn / task-stream padding** |
| `@container panel (max-width: 280px)` | Visually hide status label, hide composer hint, even tighter chrome |
| `data-density="compact"` on `.panel` | JS mirror when panel width &lt; 320 (`density.js` ResizeObserver); same density tokens as mid-narrow |

Prefer container queries over viewport media for side-panel chrome (width is the panel, not the OS window). Density tokens live in `css/tokens.css` (`--density-*`).

### Popover menus (P3)

Clipboard **Export ▾** (`#clipExportMenu`) uses the **native Popover API** when `HTMLElement.prototype.showPopover` exists (`popoverMenu.js` + light-dismiss + fixed position under trigger). Fallback: existing `hidden` toggle + outside-click. Styles use design tokens; open state is top-layer (no z-index stacking wars). Enter animation `pw-popover-in` is gated by reduced-motion in `motion.css`.

## JS layout

```
src/sidepanel/
  css/tokens.css
  css/layout.css
  css/motion.css
  dom.js             # $, escapeHtml, sanitizeModelHtml, truncateUi
  theme.js           # system | light | dark (+ color-scheme)
  sendStop.js        # send↔stop morph UI
  hoverDrawer.js     # hover-intent FSM (clip/history/drafts)
  icons.js           # SVG composer icons
  scroll.js          # whole-panel #panelScroll wheel + edge fades
  dialog.js          # native <dialog> open/close + return-focus
  popoverMenu.js     # native popover + click-toggle fallback (clip export)
  density.js         # data-density=compact via ResizeObserver
  i18n.js            # I18N tables + createT / getDict / translate
  trajectoryUi.js    # mountTaskTrajectoryButton + downloadTaskTrajectory
  README.md
```

`sidepanel.js` still owns `currentLang`, session state, and agent event loop; domain modules take deps/getters.

## Layout contract (whole-panel scroll)

**Product rule:** one scroll for the entire side panel — not nested scrolls per section.
History and the live task share `.thread-workspace` (same block). Sticky: topbar + composer.

Source of truth: **`css/layout.css`**.

| Surface | Rule |
|--------|------|
| `html`, `body`, `.panel` | `height: 100%`, shell `overflow: hidden` |
| **`#panelScroll`** | **Only** vertical scrollport: `flex: 1 1 0%`, `overflow-y: auto` |
| Sticky | `.topbar` + `.composer` (outside the scroll root) |
| Same-level blocks in scroll | context, selection, drafts, **`.thread-workspace`** (history + task-stream) — all `overflow: visible`, no nested max-height traps |
| `#taskStream` | document flow only (not a scrollport) |
| History | lives **inside** `.thread-workspace` with the live task |

`scroll.js` scrolls `#panelScroll` and applies edge fades to it.

## Control layer

Critical actions (trajectory download, skill save, script quick-run) mount on **`.task-actions` / `.task-traj-row`** inside `.task-body`, **outside** `.md-body`. Markdown re-render (`innerHTML`) must not swallow click handlers.

Trajectory controls live in **`trajectoryUi.js`** (`createTrajectoryUi({ t, getLang, getSessions, … })`).

## Rules

1. Prefer new UI helpers here; keep agent imports in `sidepanel.js` until a full domain split.
2. Target: no single new file > ~400 LOC; orchestrator shrinks over time.
3. Theme storage: `pagewand_theme_mode` (+ legacy `pagewand_theme`). Resolved theme also sets `color-scheme` on `html`/`body`.
4. React scaffold is archived under `archive/ui-react-scaffold/`.
5. i18n: edit strings in `i18n.js`; orchestrator keeps `currentLang` + `applyI18n()`.

## Next extractions candidates

- `taskCard.js` (createTaskCard, makeCollapsibleThinking)
- `selection.js` (renderSelectionUI, picker state)
- `task/events.js` (agent stream → DOM)
- `drafts/card.js`
- Optional `a11y.css` if focus/dialog rules grow further
