# 爪爪 · Paw Work — Design Language

**Audience:** humans + coding agents touching sidepanel UI.  
**Runtime CSS:** [`src/sidepanel/css/tokens.css`](../src/sidepanel/css/tokens.css)  
**Machine tokens:** [`tokens.json`](./tokens.json)

This system was **extracted from the live product** (not a third-party site), following the spirit of [extract-design-system](https://github.com/arvindrk/extract-design-system): reverse-engineer primitives → freeze starter token files → use them as authority for every later UI change.

---

## Brand thesis

| Axis | Choice |
|------|--------|
| Product | Selection-first Web Agent (quiet, precise, results-first) |
| Dark accent | Rose / magenta (`#f43f8c`) on near-black stage |
| Light accent | Warm amber (`#d97706`) on 汉白玉 paper (`#f7f4ef` / `#fbf8f3`) |
| Emotion | Calm craft — not chatty SaaS blue, not neon cyber |
| Density | Compact sidepanel; primary controls **34px / 10px radius** |

---

## Hard rules (agents must not break)

1. **Use CSS variables** from `tokens.css` (`--accent`, `--bg-elevated`, `--radius-sm`, `--density-pick-h`, …). Do not invent one-off hex for chrome.
2. **Primary tier** (伸爪 / 截图 / Group Select): same height (`--density-pick-h`), same radius (`--radius-sm` = 10px), same hover ring (`--accent-ring`).
3. **No OS-native select** for product chrome. Custom menus match elevated surface + strong border + card shadow.
4. **Pill radius (999px)** is rare. Prefer 10px for controls; pills only for tiny status dots.
5. **Meta chrome stays quiet** — model select is half-size / faint; never steals weight from send or pick.
6. **Session bind ≠ capture target**
   - Top toolbar Group Select = *where new selections go*
   - Under dialog (`session-context-bar`) = *which groups freeze on Run*
6b. **Pinned selection bar squeezes the thread** — it is a flex sibling of `#panelScroll`, not an overlay. Expanding chips/clipboard reduces conversation height. Do not set `overflow: visible` on `.selection-bar` (menus portal to `document.body`). Narrow sidepanel: counts wrap onto their own row; never paint 文/图 pills outside the card.
6c. **No auto-tuck** — the conversation stays in place. Pin keeps the selection drawer open (and squeezes the thread); unpin lets the drawer close and the thread reclaim height. Do not collapse the thread into a chip. Chip rows scroll in whole-row increments; do not slice chips. Text chips have no 「入板」 suffix. Wand pick **pierces overlays** and snaps to harvest Context (文字/图片/表格/视频/链接/矢量/截图), not DOM containers. Do not label video as 图片. Quick harvest in `.quick-tools` (same recipe as 下图): 导出表 → real CSV; 复制链接; 下载文件 (pdf/office/zip…); 下矢量 → SVG; 下载封面 → one HTML of AVIF/poster `<img>` wrapped in `<a href=page>` (clipboard HTML too; never treat AVIF as a video file download).
6d. **Conversation title bar** — `.task-header` is the chat-window chrome: current session name, quiet workspace usage (`0 MB · 0 个文件`), trajectory download. It stays put inside the conversation panel (`.task-body` scrolls). Do not let long messages push the header off-screen.
6e. **Context ring** — 16px meter in `.composer-actions` (left of send). Empty = faint track only; fill uses `--accent` ( `--amber` at ≥80%). Compacting shows a floating “Compacting” chip and spin. Do not grow composer height. Tokens only (`--dur-*`, `--ease-out`, `--accent`, `--text-faint`).
6f. **Clarify overlay** — control-plane yield, not a world tool. Live card sits in `.task-body` (`#clarifyLive`), never as a persisted bubble. Always include Other. After answer, remove the node (no answered receipt). Thread + composer pulse with `--accent` / `--dur-4` / `--ease-in-out`; respect `prefers-reduced-motion`.
6g. **Composer @ mention** — typing `@` opens a custom palette. Groups are **collapsible sections** (chevron + name + count); items live in a nested list, collapsed by default, auto-expanded while filtering. Chosen refs are **inline tokens** (`.composer-mention`), never plain `@name` text. Tokens use `--accent-soft` / `--radius-xs`; item kinds may tint with `--blue-soft` / `--green-soft` like selection chips. Do not inspect on mention. Unbound Group: bind then insert. Palette matches elevated menu recipe (not OS native).
6h. **Sheet range chips** — `.sheet-sel-row` sits **under the float row, above the composer input**. One expandable bar **per worksheet** (toggle = sheet name + count; chips are A1 only). Empty = `hidden`. Overflow uses **‹ › click buttons**, not wheel, not drag — wheel must not steal the thread. Hint only: not Bind, not a lock. Do not mix with page SelectionBar. No 「格子」 kicker.
6i. **Deliverable folders** — `.artifact-rail-nav` is a quiet chip row under the 交付物 title (全部 + kinds that exist). Images (and other multi-file kinds) nest in `.artifact-shelf-folder`; images start collapsed. Tokens only (`--radius-xs`, `--accent-soft`, `--bg-elevated`). Not OS-native. Model may override folders via `run op=shelf`; host infers the rest. Frame-verify JPEGs never enter this rail. The 交付物 pull (composer bubble + right-edge tab) stays visible when the shelf is empty. Rail foot is 新建 templates + 下载所选; preview is a file-name click, not a footer button.
7. **Motion**: short, ease-out; respect `prefers-reduced-motion` when adding animation.
8. **Do not** reintroduce dual Chat/Run CTAs; single up-arrow + mode toggle only.

---

## Token map (semantic → CSS)

| Role | CSS vars |
|------|----------|
| Page / panel | `--bg-void` `--bg-stage` `--bg-panel` `--bg-soft` `--bg-elevated` |
| Text | `--text` `--text-muted` `--text-faint` |
| Border | `--border` `--border-strong` |
| Accent | `--accent` `--accent-hover` `--accent-2` `--accent-soft` `--accent-ring` |
| Semantic | `--green` `--amber` `--danger` (+ `-soft`) |
| Radius | `--radius-xs` `--radius-sm` `--radius` |
| Space | `--space-1` … `--space-4` |
| Control density | `--density-pick-h` `--density-pick-min-w` `--density-pick-fs` `--density-pick-pad-x` |
| Motion | `--ease-out` `--dur-1`…`--dur-4` |

When theming, set `body[data-theme="dark"|"light"]` (or `html`). Tokens swap as a set — never mix dark hex on light theme.

---

## Component recipes

### Primary action (伸爪)

```css
height: var(--density-pick-h);
border-radius: var(--radius-sm);
background: var(--accent);
color: #fff;
font-weight: 700;
box-shadow: 0 2px 8px var(--accent-ring);
```

### Secondary action (截图 / Group Select trigger)

```css
height: var(--density-pick-h);
border: 1px solid var(--border-strong);
border-radius: var(--radius-sm);
background: var(--bg-elevated);
color: var(--text);
/* hover: accent-soft fill + accent-ring outline */
```

### Menu (group list / session bind / model)

```css
border: 1px solid var(--border-strong);
border-radius: var(--radius-sm);
background: var(--bg-elevated);
box-shadow: var(--shadow-card);
```

Capture Group Select (next to 截图) keeps the dashed create row. Session bind does **not**.

### Destructive micro control (row ×)

Quiet by default (`--text-muted`); hover → `--danger` + `--danger-soft`.

### API vendor card (Settings)

Saved BYOK vendors (chat / image / search) render as elevated cards in Settings — never an empty form after save. Card: `--bg-elevated` + `--border-strong` + `--radius-sm`. Active = `--accent-soft` fill + inset `--accent-ring`. Delete is the row × recipe. Add is a dashed `--border-strong` control, not a primary CTA.

### Session context bar

Sits **under the dialog, above the composer input**. One `Bind Group` bubble and one same-size `交付物` bubble sit in the float row. Deliverables open an **upward** list (preview / download / delete) — do not park an artifact shelf under the thread. Creating a group lives next to 截图. Empty Bind Group label: `Bind Group`. Model chip is a short fixed width (`6.5rem`). Unbound non-home sessions show a dismissible coachmark above Bind Group. Generated images land in `/artifacts`; 完成 must not auto-attach into the composer.

---

## Do / Don't

| Do | Don't |
|----|--------|
| Match pick/shot size for any new top-toolbar control | Drop a raw `<select>` that looks like Windows/Mac chrome |
| Put session-level bind under the conversation | Bind groups next to 伸爪 as if “group owns session” |
| Shrink model picker further if it still shouts | Grow meta controls to 34px |
| Extend `tokens.css` + `tokens.json` together | Hardcode `#ea580c` orange leftovers from experiments |

---

## Updating the system

1. Change values in **`src/sidepanel/css/tokens.css`** (runtime).
2. Mirror into **`design-system/tokens.json`**.
3. Note rationale in this file if a rule changes.
4. Optional: re-run a visual pass on sidepanel dark + light.

Agents implementing UI: read this file first; fail closed on token violations.
