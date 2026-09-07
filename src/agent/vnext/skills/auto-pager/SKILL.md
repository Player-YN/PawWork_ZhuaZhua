---
name: Auto Pager
description: User wants more items from the open list or article series by walking Next, Load more, or infinite scroll a few times, then merge or extract. Do NOT trigger for a single-page extract (page-extract), cloning the site (html-site), video binge, or unlocking paid next-chapter / serial dumps.
---

# Auto-pager playbook

Use when the user wants **more items from the open list or series** by walking next / load-more / infinite scroll a few times, then merge or extract.

Load `inspect view=skill` `skillId=auto-pager`. Generic next-page / “load more” / infinite append. Not a site-locked crawler.

Hard stop: copyrighted book/comic/video chapter dump, VIP serial unlock. If they want **this** open list scrolled a few pages to extract, stay small (default 3–5 pages) and save via `page-extract`.

## Order

1. USER probe: `rel=next`, `a` text 下一页/Next/›, button 加载更多/Load more, or a sentinel at list bottom.
2. Snapshot first item signatures (href or text) so you can detect “no new items”.
3. Loop: click via `action` if there is a control `ref`; else USER `.click()`. Then `action` `wait` or short eval wait.
4. After each page, eval item count. Stop on no growth, loop URL, or cap.
5. Extract once (`page-extract`) or write JSON to `/artifacts`.

Prefer `action` click when snapshot sees Next. Eval click when it is a custom button.

## Copy-paste probe + one step

```js
const probe = await sys.eval({
  world: 'USER',
  code: `
    function txt(el) { return (el && el.innerText || '').replace(/\\s+/g, ' ').trim(); }
    const next =
      document.querySelector('a[rel="next"]') ||
      [...document.querySelectorAll('a,button')].find((el) =>
        /^(下一页|下页|next|load more|加载更多|更多)$/i.test(txt(el))
      );
    const items = [...document.querySelectorAll('a[href]')].map((a) => a.href);
    return {
      href: location.href,
      next: next ? { tag: next.tagName, text: txt(next).slice(0, 40), href: next.href || null } : null,
      linkCount: items.length
    };
  `
});
```

Click next in USER (only if `action` had `NO_TARGET`):

```js
await sys.eval({
  world: 'USER',
  code: `
    const el =
      document.querySelector('a[rel="next"]') ||
      [...document.querySelectorAll('a,button')].find((n) =>
        /^(下一页|下页|next|load more|加载更多|更多)$/i.test((n.innerText || '').trim())
      );
    if (!el) return { ok: false, code: 'NO_TARGET' };
    el.click();
    return { ok: true, href: el.href || location.href };
  `
});
```

Infinite scroll (no button):

```js
await sys.eval({
  world: 'USER',
  code: `
    const before = document.querySelectorAll('a[href]').length;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    return { before, after: document.querySelectorAll('a[href]').length, href: location.href };
  `
});
```

Cap: 5 iterations unless they asked more. If `href` repeats and counts do not rise, stop.

SPA: after click, wait for new text (`action` `wait` `text` or eval wait < 10s). Full navigation: `sys.tabs.current()` URL change → re-probe; previous USER listeners are dead.

## Failures

- `NO_TARGET` → no next; extract what you have.
- Count stuck → stop; do not hammer click.
- `SYS_TIMEOUT` → probe URL + count; do not assume the next page loaded.
- Login interstitial → stop (not a pager).

## Must not

- Auto-walk entire novel/comic/video sites.
- Bypass paid “next chapter”.
- `sys.download` each media URL as the pager goal (that is a downloader product).
