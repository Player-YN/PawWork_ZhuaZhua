---
name: Site Tool Reuse
description: User needs an outcome a live website or already-open logged-in tab already provides — edit, export, generate, convert, upload, send — before building a substitute in run or HTML.
---

# When this applies

The result already exists as an in-page control, an open tab, or a service the user is logged into. Operate that tool. Do not replace it with a homemade canvas unless the ready-made path cannot produce the visible outcome.

# Discover

1. Read this turn's world: focusPage / activeTab, and openTabs (tabCount + domains only).
2. Snapshot the current page. Look for the site's own import, export, generate, edit, upload, download, share.
3. If the needed service is already open (matching domain), list tabs and focus that tab. Do not open a parallel editor.
4. If nothing useful is open, prefer a logged-in service the user named over a blank HTML artifact.

# Compare then choose

Write one comparison line before acting:

- Ready-made tool: what it already does, and the visible success check.
- run / self-built canvas: only for glue, byte reshape, or compute the site cannot do.

Choose the ready-made tool when it can produce the user-visible result.

# Operate

Use action on the live tab (snapshot → click / fill / upload / wait). run is glue: fetch or convert bytes, stage `/scratch`, then upload. Do not default to writing a replacement website.

# Check afterward

Confirm a host-visible postcondition (new filename, canvas object, download, URL change). Tool `ok` is not task success. Upload `siteAccepted` stays unknown — look at the page.

# If the preferred route fails

Re-enter discovery. Try another control, another open domain, or another logged-in service the user already has. Then compare again. A failed preferred route is not a lock; discovery stays allowed.

# Parameterize

Keep task class, intents, and locate strategies (role, accessible name, region). Do not persist `ref`, `rev`, coordinates, or fragile CSS.
