# Document render engines — Product **A′**

**Install rule:** end users only install the Chrome extension. No npm, no desktop Pandoc.

**Public API:** only `render_document({ draftId, format })`.

## Product formats (shipped in extension)

| format | engine | delivery |
|--------|--------|----------|
| md, txt, csv, html, zip | builtin | file download |
| pptx | builtin | HTML slide deck download |
| **pdf** | **builtin_print** | open print HTML → system print → **Save as PDF** |

## Not in A′ product surface

| format | reason |
|--------|--------|
| docx | would need large WASM in package or extra install — deferred |
| pandoc-wasm | not bundled; optional lab only, not user path |

## PDF flow

1. `render_document({ format: 'pdf' })` → print-ready HTML artifact + `delivery: 'browser_print'`
2. Side panel opens `src/preview/print.html?draftId=…&autoprint=1`
3. User chooses **Save as PDF** in the print dialog

No extra software. Chinese / layout use browser engines.
