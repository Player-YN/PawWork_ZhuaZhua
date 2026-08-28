/**
 * build:agent — produce extension-loadable, offline vendored runtime artifacts.
 * Uses esbuild-wasm so the repository builds cross-platform even when a stale
 * platform-native node_modules archive is present.
 */
import * as esbuild from 'esbuild-wasm';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'src/agent/vnext/adapters/vendor');
const targets = [
  {
    entry: path.join(root, 'scripts/quickjs-loader-entry.mjs'),
    outfile: path.join(outDir, 'quickjs-loader.mjs'),
    minBytes: 100_000
  },
  {
    entry: path.join(root, 'scripts/ai-sdk-loader-entry.mjs'),
    outfile: path.join(outDir, 'ai-sdk-loader.mjs'),
    minBytes: 250_000
  },
  {
    entry: path.join(root, 'scripts/esbuild-loader-entry.mjs'),
    outfile: path.join(outDir, 'esbuild-loader.mjs'),
    minBytes: 30_000
  },
  {
    entry: path.join(root, 'scripts/pptxgen-loader-entry.mjs'),
    outfile: path.join(outDir, 'pptxgen-loader.mjs'),
    minBytes: 80_000
  }
];

async function bundle(target) {
  if (!fs.existsSync(target.entry)) throw new Error(`missing entry: ${path.relative(root, target.entry)}`);
  await esbuild.build({
    entryPoints: [target.entry],
    outfile: target.outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120'],
    minify: false,
    sourcemap: false,
    logLevel: 'silent'
  });
  const st = fs.statSync(target.outfile);
  if (st.size < target.minBytes) {
    throw new Error(`bundle too small: ${path.relative(root, target.outfile)} (${st.size})`);
  }
  const src = fs.readFileSync(target.outfile, 'utf8');
  const bare = /\bfrom\s+['"](?:ai|@ai-sdk\/|quickjs-emscripten|esbuild-wasm)['"]|\bimport\s*\(\s*['"](?:ai|@ai-sdk\/|quickjs-emscripten|esbuild-wasm)['"]/.test(src);
  if (bare) throw new Error(`bare package import remains in ${path.relative(root, target.outfile)}`);
  console.log(`[build:agent] ok → ${path.relative(root, target.outfile)} (${(st.size / 1024).toFixed(1)} KB)`);
}

function generateIconPack() {
  const script = path.join(root, 'scripts', 'build-icon-pack.mjs');
  const result = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('build-icon-pack failed — lucide-static must be installed (devDependency)');
  }
}

async function main() {
  generateIconPack();
  fs.mkdirSync(outDir, { recursive: true });
  for (const target of targets) await bundle(target);
  const wasmSrc = path.join(root, 'node_modules/esbuild-wasm/esbuild.wasm');
  const wasmDst = path.join(outDir, 'esbuild.wasm');
  if (!fs.existsSync(wasmSrc)) throw new Error('missing node_modules/esbuild-wasm/esbuild.wasm');
  fs.copyFileSync(wasmSrc, wasmDst);
  console.log(`[build:agent] ok → ${path.relative(root, wasmDst)} (${(fs.statSync(wasmDst).size / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error('[build:agent]', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
