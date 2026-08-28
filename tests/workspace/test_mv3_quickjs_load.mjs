/**
 * MV3 / product-path QuickJS load proof.
 *
 * Simulates extension-style resolution: relative import of the vendored
 * loader (no bare `quickjs-emscripten` package specifier). Asserts:
 * - vendor file exists on disk (build:agent artifact)
 * - getQuickJS + eval 1+1 works
 * - runCode default path uses quickjs via the relative vendor
 *
 * Log: SCRATCH/mv3-quickjs-load.log
 */
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const SCRATCH = process.env.PAW_SCRATCH || path.join(os.tmpdir(), 'pawwork-runtime-tests');

const VENDOR = path.join(
  root,
  'src/agent/vnext/adapters/vendor/quickjs-loader.mjs'
);
const CODE_RUNTIME = path.join(
  root,
  'src/agent/vnext/adapters/codeRuntime.js'
);

const logLines = [];
function log(line) {
  logLines.push(line);
  console.log(line);
}

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  log(`  OK ${msg}`);
}

log('mv3_quickjs_load: vendor artifact + extension-relative import');

// 1) Vendor file on disk (build:agent product)
ok(fs.existsSync(VENDOR), 'vendor/quickjs-loader.mjs exists');
const st = fs.statSync(VENDOR);
ok(st.size > 100_000, `vendor size >= 100KB (got ${st.size})`);
log(`  vendor bytes=${st.size}`);

// 2) No bare package imports inside vendor (Chrome cannot resolve them)
const vendorSrc = fs.readFileSync(VENDOR, 'utf8');
ok(
  !/\bfrom\s+['"]quickjs-emscripten(?:-core)?['"]/.test(vendorSrc),
  'vendor has no bare quickjs-emscripten import'
);
ok(
  !/\bfrom\s+['"]@jitl\//.test(vendorSrc),
  'vendor has no bare @jitl/* import'
);
ok(
  !/\bimport\s*\(\s*['"]quickjs-emscripten/.test(vendorSrc),
  'vendor has no dynamic bare quickjs-emscripten'
);

// 3) codeRuntime prefers relative vendor path
const runtimeSrc = fs.readFileSync(CODE_RUNTIME, 'utf8');
ok(
  runtimeSrc.includes("./vendor/quickjs-loader.mjs"),
  'codeRuntime imports relative vendor first'
);
ok(
  /runtime\s*===\s*['"]soft['"]|PAW_SOFT_SANDBOX/.test(runtimeSrc),
  'soft path remains opt-in only'
);

// 4) Extension-style import: file:// relative URL to vendor (no package name)
log('mv3_quickjs_load: import vendor via relative file URL');
const vendorUrl = pathToFileURL(VENDOR).href;
const vendorMod = await import(vendorUrl);
ok(typeof vendorMod.getQuickJS === 'function', 'getQuickJS exported');
ok(
  typeof vendorMod.shouldInterruptAfterDeadline === 'function',
  'shouldInterruptAfterDeadline exported'
);

const QuickJS = await vendorMod.getQuickJS();
ok(QuickJS && typeof QuickJS.newRuntime === 'function', 'QuickJS module ready');

const rt = QuickJS.newRuntime();
const ctx = rt.newContext();
try {
  const evalResult = ctx.evalCode('1+1');
  ok(!evalResult.error, 'eval 1+1 no error');
  const val = ctx.dump(evalResult.value);
  evalResult.value.dispose();
  ok(val === 2, `eval 1+1 === 2 (got ${val})`);
  log(`  eval 1+1 => ${val}`);
} finally {
  try {
    ctx.dispose();
  } catch {
    /* */
  }
  try {
    rt.dispose();
  } catch {
    /* */
  }
}

// 5) runCode default path (product isolation path, not soft)
log('mv3_quickjs_load: runCode default path via codeRuntime');
const { runCode, codeRuntimeKind } = await import(
  pathToFileURL(CODE_RUNTIME).href
);
ok(codeRuntimeKind() === 'quickjs', 'codeRuntimeKind is quickjs');

const run = await runCode({
  code: `
    const n = 1 + 1;
    console.log('sum', n);
    module.exports = async () => ({ sum: n });
  `,
  timeoutMs: 5000
});
ok(run.exitStatus === 0, `runCode exit 0 (stderr=${run.stderr || ''})`);
ok(run.runtime === 'quickjs', `runtime is quickjs (got ${run.runtime})`);
ok(
  !run.error || !String(run.error).includes('QuickJS runtime failed'),
  'no QuickJS load failure'
);
log(`  runCode exit=${run.exitStatus} runtime=${run.runtime} stdout=${JSON.stringify(run.stdout)}`);

// 6) Persist proof log (best-effort; Windows may lock concurrent tee of same path)
await mkdir(SCRATCH, { recursive: true });
const body = [
  `timestamp=${new Date().toISOString()}`,
  `vendor=${path.relative(root, VENDOR)}`,
  `vendorBytes=${st.size}`,
  `passed=${passed}`,
  `status=PASS`,
  `notes=extension-relative vendor load; no bare package specifier; runCode quickjs`,
  '',
  ...logLines
].join('\n');
const candidates = [
  path.join(SCRATCH, 'mv3-quickjs-load.log'),
  path.join(SCRATCH, `mv3-quickjs-load.${Date.now()}.log`)
];
let written = null;
for (const logPath of candidates) {
  try {
    await writeFile(logPath, body, 'utf8');
    written = logPath;
    break;
  } catch (e) {
    if (e && (e.code === 'EBUSY' || e.code === 'EPERM')) continue;
    throw e;
  }
}
if (written) log(`wrote ${written}`);
else log('warning: could not write SCRATCH proof log (EBUSY); assertions still pass');

console.log(`mv3_quickjs_load: ${passed} assertions ok`);
process.exit(0);
