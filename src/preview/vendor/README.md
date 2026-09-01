# Sheet runtime bundle

`sheet-runtime.js` / `sheet-runtime.css` are generated:

```text
npm run build:sheet
```

They package Univer OSS + SheetJS for `src/preview/sheet.html`. Do not import `xlsx` or `@univerjs/*` from extension pages directly.

# Docs runtime bundle

`docs-runtime.js` / `docs-runtime.css` are generated:

```text
npm run build:docs
```

They package Univer Docs OSS (`preset-docs-core` + drawing + hyper-link + thread-comment, Apache-2.0) for `src/preview/docs.html`. Do not import `@univerjs/*` from extension pages. Never import or ship `@univerjs-pro/*`.

# Design / Slides runtime bundle

`design-runtime.js` / `design-runtime.css` are generated:

```text
npm run build:design
```

They package tldraw for `src/preview/design.html`. Gitignored. Do not import `tldraw` from `node_modules` in extension pages.
