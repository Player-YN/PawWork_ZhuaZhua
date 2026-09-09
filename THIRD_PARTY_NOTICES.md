# Third-party notices

Paw Work's own code is MIT-licensed (see [LICENSE](LICENSE)). The **source repository** does not redistribute Univer runtime bundles — those are built locally. A few small compiled loaders and `esbuild.wasm` are committed for reproducible packaging, as noted. tldraw Design/Slides was removed from the product; `design-runtime.*` is no longer shipped.

| Component | License | How it ships |
|-----------|---------|--------------|
| [Univer](https://univer.ai) (`@univerjs/*` presets) | Apache-2.0 | Built locally into `src/preview/vendor/sheet-runtime.*` and `docs-runtime.*` (gitignored) |
| [SheetJS CE](https://sheetjs.com) (`xlsx`) | Apache-2.0 | Bundled locally into the sheet runtime (gitignored) |
| [Lucide](https://lucide.dev) (`lucide-static`) | ISC | Historical: icon pack was generated for the removed Design/Slides compile tree |
| [esbuild](https://esbuild.github.io) (`esbuild-wasm`) | MIT | `src/agent/vnext/adapters/vendor/esbuild.wasm` + loader are committed for reproducible packaging |
| [QuickJS](https://bellard.org/quickjs/) via [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) | MIT (both) | Compiled loader committed under `src/agent/vnext/adapters/vendor/` |
| [Vercel AI SDK](https://ai-sdk.dev) (`ai`, `@ai-sdk/openai-compatible`) | Apache-2.0 | Compiled loader committed under `src/agent/vnext/adapters/vendor/` |
| [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) | MIT | Compiled loader committed under `src/agent/vnext/adapters/vendor/` |
| [fflate](https://github.com/101arrowz/fflate) | MIT | Committed as `src/preview/vendor/fflate.js`; also bundled inside the PptxGenJS loader |
| [React](https://react.dev) / `react-dom` | MIT | Historical note: previously bundled into the removed tldraw design runtime |
| [Zod](https://zod.dev) | MIT | npm dependency, bundled locally |
| [Playwright](https://playwright.dev) | Apache-2.0 | Dev dependency only (visual / E2E tests); never packaged |

Upstream license texts are available in each package under `node_modules/` after `npm install`, and at the linked project pages. If you redistribute builds of this extension, you are responsible for complying with each upstream license.
