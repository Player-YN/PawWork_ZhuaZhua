/**
 * Bundle Univer Docs OSS for the live docs preview tab.
 * Never include @univerjs-pro/*.
 */
import * as esbuild from 'esbuild-wasm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'scripts/docs-runtime-entry.mjs');
const outDir = path.join(root, 'src/preview/vendor');
const outfile = path.join(outDir, 'docs-runtime.js');

async function main() {
  if (!fs.existsSync(entry)) throw new Error('missing scripts/docs-runtime-entry.mjs');
  fs.mkdirSync(outDir, { recursive: true });
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
  if (st.size < 100_000) {
    throw new Error(`docs runtime too small: ${st.size}`);
  }
  const js = fs.readFileSync(outfile, 'utf8');
  if (js.includes('@univerjs-pro')) {
    throw new Error('docs runtime must not include @univerjs-pro');
  }
  const css = path.join(outDir, 'docs-runtime.css');
  if (!fs.existsSync(css)) {
    console.warn('[build:docs] no extracted CSS next to docs-runtime.js');
  }
  console.log(`[build:docs] ok → ${path.relative(root, outfile)} (${(st.size / 1024).toFixed(1)} KB)`);
  if (fs.existsSync(css)) {
    console.log(
      `[build:docs] ok → ${path.relative(root, css)} (${(fs.statSync(css).size / 1024).toFixed(1)} KB)`
    );
  }
}

main().catch((error) => {
  console.error('[build:docs]', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
