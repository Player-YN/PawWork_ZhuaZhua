/**
 * Vendor tldraw + React for Design/Slides preview.
 * Preview pages import only ./vendor/design-runtime.js — never node_modules.
 */
import * as esbuild from 'esbuild-wasm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'scripts/design-runtime-entry.jsx');
const outDir = path.join(root, 'src/preview/vendor');
const outfile = path.join(outDir, 'design-runtime.js');

async function main() {
  if (!fs.existsSync(path.join(root, 'node_modules/tldraw'))) {
    throw new Error('missing node_modules/tldraw — npm install tldraw react react-dom');
  }
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
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: {
      '.css': 'css',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.svg': 'dataurl'
    },
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.PAW_TLDRAW_LICENSE_KEY': JSON.stringify(
        process.env.PAW_TLDRAW_LICENSE_KEY || process.env.TLDRAW_LICENSE_KEY || ''
      ),
      'process.env.TLDRAW_LICENSE_KEY': JSON.stringify(
        process.env.PAW_TLDRAW_LICENSE_KEY || process.env.TLDRAW_LICENSE_KEY || ''
      )
    }
  });
  const kb = (fs.statSync(outfile).size / 1024).toFixed(1);
  console.log(`[build:design] ok → ${path.relative(root, outfile)} (${kb} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
