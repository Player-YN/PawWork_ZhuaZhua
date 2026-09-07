---
name: Site Hotkeys
description: User wants keyboard shortcuts that exist only on this open document until refresh — scroll, activate a named control, or toggle a restyle. Do NOT trigger for OS or Chrome remaps, extension commands, filling a form (form-autopilot), general live-page JS (userscript), or installing a lasting script.
---

# Site hotkeys playbook

Use when the user wants **page-local keys on this document only** (until refresh). Not OS remaps and not a general userscript.

Load `inspect view=skill` `skillId=site-hotkeys`. Inject a **USER**-world `keydown` listener on this document only. Gone after navigate/reload — say so. Re-eval after `tabs.navigate` / `reload`.

Do not steal Chrome/OS chords (`Ctrl+T/W/L`, `Alt+Tab`, `Ctrl+Shift+C`) unless they explicitly named that chord.

## Order

1. Confirm the keys and the action (scroll / click named button / toggle `#paw-restyle`).
2. `sys.eval` USER, idempotent (`window.__pawHotkeys` guard).
3. Return `{ bound: [...] }`. Tell them the bindings and that they last until refresh.

## Copy-paste

```js
await sys.eval({
  world: 'USER',
  code: `
    const KEY = '__pawHotkeys';
    if (window[KEY]) {
      window.removeEventListener('keydown', window[KEY], true);
    }
    const handler = (e) => {
      if (e.isComposing || e.altKey || e.metaKey || e.ctrlKey) return;
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      const k = e.key;
      if (k === 'j') { window.scrollBy(0, 320); e.preventDefault(); }
      else if (k === 'k') { window.scrollBy(0, -320); e.preventDefault(); }
      else if (k === 'g') { window.scrollTo(0, 0); e.preventDefault(); }
      else if (k === 'G' || (k === 'g' && e.shiftKey)) { window.scrollTo(0, document.body.scrollHeight); e.preventDefault(); }
    };
    window[KEY] = handler;
    window.addEventListener('keydown', handler, true);
    return { bound: ['j/k scroll', 'g top', 'Shift+G bottom'] };
  `
});
```

Click a page button from a key: `document.querySelector(...)?.click()` inside the handler — prefer a selector you probed this turn. Toggle restyle: dispatch the undo/inject from skill `page-restyle` (same `#paw-restyle` id).

Unbind:

```js
await sys.eval({
  world: 'USER',
  code: `
    const KEY = '__pawHotkeys';
    if (window[KEY]) window.removeEventListener('keydown', window[KEY], true);
    window[KEY] = null;
    return { unbound: true };
  `
});
```

## Failures

- Keys do nothing: they focused an input; or document remounted (re-inject).
- `NEED_PAGE` / `SYS_DENIED` → `userscript`.
- Closed shadow button: USER `querySelector` fails — report, do not claim bound click works.

## Must not

- Register a durable Chrome command or `userScripts.register`.
- Keylog / capture passwords.
- Bind keys that submit payment or delete data without an explicit ask.
