---
name: paw-design-system
description: Enforce 爪爪 · Paw Work product design tokens and UI recipes when editing sidepanel or extension chrome. Use whenever changing sidepanel HTML/CSS/JS UI, adding controls, menus, chips, or theme-related styles.
---

# Paw Work Design System (product skill)

## When to use

Any edit to `src/sidepanel.html`, `src/sidepanel.css`, `src/sidepanel/**`, dialogs, or selection chrome.

## Authority

1. Read [`design-system/DESIGN.md`](../../../design-system/DESIGN.md) — rules + recipes.
2. Read [`design-system/tokens.json`](../../../design-system/tokens.json) — machine tokens.
3. Runtime CSS vars live in [`src/sidepanel/css/tokens.css`](../../../src/sidepanel/css/tokens.css).

This skill adapts [extract-design-system](https://github.com/arvindrk/extract-design-system) to **our own product**: tokens were reverse-engineered from live UI and frozen here — do not scrape random sites into this product.

## Checklist before shipping UI

- [ ] Colors/spacing/radius come from CSS variables (no stray hex for chrome)
- [ ] New top-toolbar controls match pick/shot height + `--radius-sm`
- [ ] No OS-native multi-select for product flows; custom menus use elevated surface
- [ ] Capture Group Select ≠ session bind bar (bind stays under dialog)
- [ ] Meta controls (model) stay half-size / faint
- [ ] Dark + light both use themed tokens (`body[data-theme]`)
- [ ] If you add a token, update `tokens.css` **and** `tokens.json` **and** note in `DESIGN.md` if a rule changed

## Forbidden regressions

- Dual Chat/Run CTA buttons
- Binding groups only in the selection toolbar
- Orange Tailwind leftovers (`#ea580c` / slate OS selects) as product chrome
- Growing model select back to primary control size
