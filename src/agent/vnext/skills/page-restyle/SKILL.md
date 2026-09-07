---
name: Page Restyle
description: User wants the current http(s) tab restyled in place — hide named clutter, a calmer reading layout, a contrast tweak, or a floating TOC. Inject tagged CSS on the live document; do not save a cloned site. Do NOT trigger for copying article/list/table out to a file (page-extract), custom JS beyond style (userscript), 复刻官网 (html-site), Design 海报 (poster), or removing paywalls/ads as a product.
---

# Page restyle playbook

Use when the user wants the **live tab restyled in place** (hide named clutter, reading layout, contrast, floating TOC). The document is the outcome; do not extract a file or clone a site.

Load `inspect view=skill` `skillId=page-restyle` (and `userscript` if worlds/timeouts are unclear). Then `run` → `sys.eval` **USER**. One tagged `<style>`. Undo = remove that node.

Not an ad-blocker product. Only hide what they named (侧栏、推荐、评论、顶栏…) or a reading-mode they asked for.

## Order

1. `sys.tabs.current()` — confirm http(s).
2. Probe selectors (USER). Do not guess 40 rules; hide what exists.
3. Inject `#paw-restyle` CSS. Return `{ injected, hid, notes }`.
4. If they navigate, re-eval the same CSS. SPA remount: probe, then inject again (idempotent).

## Copy-paste

Probe:

```js
const out = await sys.eval({
  world: 'USER',
  code: `
    const cands = [
      ['aside', 'aside'],
      ['nav', 'nav'],
      ['[role="complementary"]', 'complementary'],
      ['.sidebar, #sidebar', 'sidebar'],
      ['#comments, .comments', 'comments'],
      ['article, main, [role="main"]', 'article']
    ];
    return cands.map(([sel, name]) => ({
      name, sel, n: document.querySelectorAll(sel).length
    }));
  `
});
```

Inject (idempotent) + optional TOC:

```js
const css = [
  'html.paw-reading article, html.paw-reading main, html.paw-reading [role="main"]{max-width:42rem;margin:0 auto;line-height:1.7;font-size:18px;}',
  'html.paw-reading nav, html.paw-reading aside, html.paw-reading [role="complementary"]{display:none !important;}',
  '#paw-toc{position:fixed;right:12px;top:72px;z-index:2147483646;max-width:16rem;max-height:70vh;overflow:auto;padding:8px 10px;background:#fff;color:#111;border:1px solid #ccc;border-radius:8px;font:13px/1.4 sans-serif;}',
  '@media (prefers-color-scheme: dark){#paw-toc{background:#1c1c1c;color:#eee;border-color:#444;}}'
].join('\\n');

await sys.eval({
  world: 'USER',
  code: `
    const CSS = ${JSON.stringify('PLACE_CSS')};
    const root = document.documentElement;
    root.classList.add('paw-reading');
    let st = document.getElementById('paw-restyle');
    if (!st) { st = document.createElement('style'); st.id = 'paw-restyle'; document.documentElement.appendChild(st); }
    st.textContent = CSS;
    let toc = document.getElementById('paw-toc');
    const hs = [...document.querySelectorAll('article h2, main h2, h2')].slice(0, 24);
    if (hs.length >= 3) {
      if (!toc) { toc = document.createElement('nav'); toc.id = 'paw-toc'; document.body.appendChild(toc); }
      toc.innerHTML = hs.map((h, i) => {
        if (!h.id) h.id = 'paw-h-' + i;
        return '<a href="#' + h.id + '" style="display:block;margin:4px 0;color:inherit;">' + (h.textContent || '').trim().slice(0, 80) + '</a>';
      }).join('');
    }
    return { injected: true, toc: !!toc, hid: 'nav/aside/complementary' };
  `
});
```

Replace `PLACE_CSS` by building `css` in guest and `JSON.stringify(css)` into `code`. Dark-ish tweak: set `--bg` / `filter` only on `article` if they asked; do not invert the whole site (breaks photos).

Undo:

```js
await sys.eval({
  world: 'USER',
  code: `
    document.getElementById('paw-restyle')?.remove();
    document.getElementById('paw-toc')?.remove();
    document.documentElement.classList.remove('paw-reading');
    return { undone: true };
  `
});
```

## Failures

- `NEED_PAGE` / `SYS_DENIED` → see skill `userscript`.
- Zero matches → report probe counts; ask which block; do not hide `body`.
- Shadow DOM widgets: USER can style open shadow if you reach `el.shadowRoot`; closed shadow → say so, do not fake success.
- After navigate: style is gone — re-inject, do not claim persistence.

## Must not

- Mass-hide `.ad` / `#google_ads` as a product.
- Paywall / login-wall removal, VIP overlays, DRM players.
- `write_artifact` a restyled clone unless they asked for a saved 阅读版 HTML (`html-preview` / `page-extract`).
