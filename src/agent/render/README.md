# Document render engines

**Public API:** `render_document({ draftId, format })`.

## Formats

| format | engine | delivery |
|--------|--------|----------|
| md, txt, csv, html, zip | builtin | file download |
| pptx | builtin | HTML slide deck download |
| **pdf** | **builtin_print** | open print HTML → system print → **Save as PDF** |

## PDF flow

1. `render_document({ format: 'pdf' })` → print-ready HTML artifact + `delivery: 'browser_print'`
2. Side panel opens `src/preview/print.html?draftId=…&autoprint=1`
3. User chooses **Save as PDF** in the print dialog
