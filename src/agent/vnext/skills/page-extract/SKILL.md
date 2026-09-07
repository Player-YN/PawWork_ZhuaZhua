---
name: Page Extract
description: User wants visible article, list, or table text on the current tab copied out as markdown or JSON (optionally an artifact), leaving the live page unchanged. Read only reachable DOM. Do NOT trigger for in-page reading layout (page-restyle), cloning a whole site (html-site), a selected-card comparison workbook (listing-sheet), unlocking paywalled HTML, or paging first when more pages are still needed (auto-pager).
---

# Page extract playbook

Use when the user wants **visible** article / list / table **copied out** as markdown or JSON. The live page is a source, not the deliverable.

Load `inspect view=skill` `skillId=page-extract`. Extract **visible, user-reachable** content. No bundled Readability library — use the heuristic below.

Do not unlock paid HTML. If the article is behind a login wall you cannot see in USER DOM, say so; `sys.fetch as:page` only for same-origin HTML the tab could already GET.

## Order

1. USER eval: pick root (`article` > `[role=main]` > `main` > longest text container).
2. If they asked 列表 / 表格, extract those structures, not only paragraphs.
3. Return compact JSON (`title`, `url`, `blocks` or `rows`). Never return Element.
4. In the same `run`, `fs.writeFile` `/scratch/extract.md` or `/artifacts/extract.md`, then `write_artifact` if they want it kept.
5. Optional: `createWorkbook` / `sheet` only when they asked for a table workbook.

## Copy-paste extract

```js
const tab = await sys.tabs.current();
const page = await sys.eval({
  world: 'USER',
  tabId: tab.id,
  code: `
    function txt(el) { return (el && el.innerText || '').replace(/\\s+/g, ' ').trim(); }
    function clean(el) {
      const n = el.cloneNode(true);
      n.querySelectorAll('script,style,nav,aside,form,iframe,noscript,[role="complementary"]').forEach((x) => x.remove());
      return n;
    }
    const root =
      document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('main') ||
      document.body;
    const c = clean(root);
    const title = (document.querySelector('h1')?.innerText || document.title || '').trim();
    const paras = [...c.querySelectorAll('p, h2, h3, li')]
      .map((el) => ({ t: el.tagName.toLowerCase(), text: txt(el) }))
      .filter((x) => x.text.length > 1)
      .slice(0, 400);
    const tables = [...c.querySelectorAll('table')].slice(0, 8).map((table) => {
      const rows = [...table.querySelectorAll('tr')].slice(0, 80).map((tr) =>
        [...tr.querySelectorAll('th,td')].map((td) => txt(td)).slice(0, 20)
      );
      return rows;
    });
    const links = [...c.querySelectorAll('a[href]')].slice(0, 80).map((a) => ({
      text: txt(a).slice(0, 80),
      href: a.href
    }));
    return {
      title,
      url: location.href,
      chars: txt(c).length,
      blocks: paras,
      tables,
      links
    };
  `
});

const v = page.value || page;
const lines = [];
lines.push('# ' + (v.title || 'extract'));
lines.push('');
lines.push('Source: ' + (v.url || tab.url || ''));
lines.push('');
for (const b of v.blocks || []) {
  if (b.t === 'h2') lines.push('## ' + b.text);
  else if (b.t === 'h3') lines.push('### ' + b.text);
  else if (b.t === 'li') lines.push('- ' + b.text);
  else lines.push(b.text);
  lines.push('');
}
if ((v.tables || [])[0]) {
  const t0 = v.tables[0];
  lines.push('## Table');
  lines.push('');
  for (const row of t0) lines.push('| ' + row.join(' | ') + ' |');
}
const md = lines.join('\\n');
await fs.writeFile('/artifacts/page-extract.md', md);
return { title: v.title, chars: v.chars, path: '/artifacts/page-extract.md', tables: (v.tables || []).length };
```

Then `run` `write_artifact` / register if the host did not already pick up `/artifacts/page-extract.md`. Prefer one markdown (or JSON) file. Do not dump 200k chars into the chat.

List-only (cards):

```js
await sys.eval({
  world: 'USER',
  code: `
    const nodes = [...document.querySelectorAll('a, li, article, [class*="item"], [class*="card"]')];
    const items = [];
    const seen = new Set();
    for (const el of nodes) {
      const a = el.closest('a') || el.querySelector('a') || (el.tagName === 'A' ? el : null);
      const href = a && a.href;
      const text = (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
      if (!href || !text || seen.has(href)) continue;
      seen.add(href);
      items.push({ text, href });
      if (items.length >= 80) break;
    }
    return { url: location.href, items };
  `
});
```

SPA empty: wait for `article` (skill `userscript`), then extract. Paginated: `auto-pager` first, then extract.

MAIN only if USER text is empty but `__NEXT_DATA__` / `#__NUXT__` exists — return `props`/JSON slices, not the whole heap.

## Failures

- `chars` tiny + login CTA → stop; do not claim extract success; no paywall bypass.
- `NOT_CLONEABLE` / `TOO_LARGE` → fewer blocks, no `innerHTML` of `body`.
- `NEED_PAGE` → see `userscript`.
- Widevine / canvas-only text → say not extractable via DOM.

## Must not

- Bypass 付费墙 / VIP / DRM.
- `sys.download` media files as an extract.
- Invent prices or rows not on the page (`listing-sheet` honesty rule).
