/**
 * Bundle Univer OSS + SheetJS for the live sheet preview tab.
 */
import * as esbuild from 'esbuild-wasm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'scripts/sheet-runtime-entry.mjs');
const outDir = path.join(root, 'src/preview/vendor');
const outfile = path.join(outDir, 'sheet-runtime.js');

async function main() {
  if (!fs.existsSync(entry)) throw new Error('missing scripts/sheet-runtime-entry.mjs');
  fs.mkdirSync(outDir, { recursive: true });
  const fflateSrc = path.join(root, 'node_modules/fflate/esm/browser.js');
  const fflateDst = path.join(outDir, 'fflate.js');
  if (!fs.existsSync(fflateSrc)) throw new Error('missing node_modules/fflate/esm/browser.js');
  fs.copyFileSync(fflateSrc, fflateDst);
  console.log(`[build:sheet] ok → ${path.relative(root, fflateDst)} (${(fs.statSync(fflateDst).size / 1024).toFixed(1)} KB)`);
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120'],
    minify: true,
    sourcemap: false,
    logLevel: 'warning',
    loader: {
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.eot': 'dataurl',
      '.svg': 'dataurl',
      '.png': 'dataurl'
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
  const st = fs.statSync(outfile);
  if (st.size < 200_000) {
    throw new Error(`sheet runtime too small: ${st.size}`);
  }
  const jsText = fs.readFileSync(outfile, 'utf8');
  if (jsText.includes('@univerjs-pro')) {
    throw new Error('sheet runtime must not import @univerjs-pro');
  }
  const cssNames = [
    'preset-sheets-core',
    'preset-sheets-filter',
    'preset-sheets-sort',
    'preset-sheets-conditional-formatting',
    'preset-sheets-data-validation',
    'preset-sheets-hyper-link',
    'preset-sheets-find-replace',
    'preset-sheets-note',
    'preset-sheets-table',
    'preset-sheets-thread-comment',
    'preset-sheets-drawing'
  ];
  const cssChunks = [];
  for (const name of cssNames) {
    const p = path.join(root, 'node_modules', '@univerjs', name, 'lib', 'index.css');
    if (fs.existsSync(p)) cssChunks.push(fs.readFileSync(p, 'utf8'));
  }
  const css = path.join(outDir, 'sheet-runtime.css');
  if (cssChunks.length) {
    fs.writeFileSync(css, cssChunks.join('\n'));
  } else if (!fs.existsSync(css)) {
    console.warn('[build:sheet] no extracted CSS next to sheet-runtime.js');
  }
  console.log(`[build:sheet] ok → ${path.relative(root, outfile)} (${(st.size / 1024).toFixed(1)} KB)`);
  if (fs.existsSync(css)) {
    console.log(
      `[build:sheet] ok → ${path.relative(root, css)} (${(fs.statSync(css).size / 1024).toFixed(1)} KB)`
    );
  }
}

main().catch((error) => {
  console.error('[build:sheet]', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
