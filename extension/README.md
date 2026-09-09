# 爪爪 · 完全解放版

Chrome MV3 **unpacked** load root. Not on the Chrome Web Store.

1. Chrome → `chrome://extensions` → Developer mode
2. **Load unpacked** → select **this folder** (it contains `manifest.json`)
3. Open the side panel → paste your API key → send a task on a normal webpage

Need Chrome 135+. Chrome 138+: allow **User Scripts** on the extension card for `sys.eval` / page fetch. Close F12 on the target tab before CDP.

After you change files here, click **重新加载** on the extension card. Restricted pages (`chrome://`, Web Store) return `NEED_PAGE`. You must bring your own model key.
