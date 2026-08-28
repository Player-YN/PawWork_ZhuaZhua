/**
 * Wave 3 — real coding run on product Session path (QuickJS via shipped tools).
 * Dual-run consistency required.
 */
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';

let failed = 0;

function record(name, ok, detail) {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

function callModelRunCode(code) {
  let step = 0;
  return async () => {
    step += 1;
    if (step === 1) {
      return {
        text: null,
        toolCalls: [{ toolName: 'run', args: { code }, toolCallId: 'c1' }]
      };
    }
    return { text: 'done', toolCalls: [] };
  };
}

async function runOnce(label) {
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('coding');
  const code = `
const rows = [];
for (let i = 1; i <= 10; i++) rows.push([i, i * i]);
const body = JSON.stringify({ squares: rows });
await fs.writeFile('/artifacts/squares.json', body);
console.log('wrote', body.length);
`;
  const res = await svc.sendMessage({
    sessionId: 'coding',
    content: '生成一个JSON文件，内容为1到10的平方',
    callModel: callModelRunCode(code)
  });
  const runTc = res.toolCalls.find((t) => t.toolName === 'run');
  const runOk = runTc && runTc.result && runTc.result.ok !== false && !runTc.result.error;
  const arts = await svc.listArtifacts({ sessionId: 'coding' });
  let content = '';
  if (arts.length) {
    const read = await svc.readArtifact({ sessionId: 'coding', artifactId: arts[0].artifactId });
    content =
      read.content ||
      new TextDecoder().decode(new Uint8Array(Buffer.from(String(read.base64 || ''), 'base64')));
  }
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    /* ignore */
  }
  const good =
    runOk &&
    arts.length >= 1 &&
    parsed &&
    Array.isArray(parsed.squares) &&
    parsed.squares.length === 10 &&
    parsed.squares[9][1] === 100;
  record(
    label,
    good,
    `runOk=${runOk} arts=${arts.length} result=${JSON.stringify(runTc?.result || {}).slice(0, 200)} content=${content.slice(0, 120)}`
  );
  return { good, content, runTc };
}

// Attack: {code} must NOT be unknown op
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s');
  const res = await svc.sendMessage({
    sessionId: 's',
    content: 'compute',
    callModel: callModelRunCode('console.log(2 + 2)')
  });
  const runTc = res.toolCalls.find((t) => t.toolName === 'run');
  const unknownOp = /unknown op/i.test(JSON.stringify(runTc?.result || {}));
  record('code-not-unknown-op', !unknownOp && runTc, JSON.stringify(runTc?.result || {}).slice(0, 180));
}

const r1 = await runOnce('coding-run-1');
const r2 = await runOnce('coding-run-2');
record(
  'dual-run-consistency',
  r1.good && r2.good && r1.content === r2.content,
  `c1=${r1.content.slice(0, 60)} c2=${r2.content.slice(0, 60)}`
);

/**
 * Adversarial: guest code writes real PNG bytes (Uint8Array) via product run.
 * Attack BREACH if product reports ok/writtenFiles but file is 0 bytes,
 * artifact not registered, or readArtifact bytes differ from expected magic.
 * Drives SessionWorkspaceService.sendMessage → createSessionTools.run → QuickJS.
 */
{
  // Minimal valid 1x1 PNG (same fixture as wave2)
  const PNG = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ];
  const expected = new Uint8Array(PNG);
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('bin');
  const code = `
const png = new Uint8Array([${PNG.join(',')}]);
await fs.writeFile('/artifacts/from_code.png', png);
console.log('pngLen', png.length);
`;
  const res = await svc.sendMessage({
    sessionId: 'bin',
    content: 'write a png via code',
    callModel: callModelRunCode(code)
  });
  const runTc = res.toolCalls.find((t) => t.toolName === 'run');
  const runResult = runTc?.result || {};
  const arts = await svc.listArtifacts({ sessionId: 'bin' });
  const pngArt = arts.find((a) => String(a.name).includes('png') || String(a.primaryPath).includes('.png'));
  let fileLen = 0;
  let equal = false;
  let magicOk = false;
  if (pngArt) {
    const read = await svc.readArtifact({ sessionId: 'bin', artifactId: pngArt.artifactId });
    const back = new Uint8Array(Buffer.from(String(read.base64 || ''), 'base64'));
    fileLen = back.byteLength;
    equal =
      fileLen === expected.byteLength && back.every((b, i) => b === expected[i]);
    magicOk = fileLen >= 8 && back[0] === 0x89 && back[1] === 0x50 && back[2] === 0x4e && back[3] === 0x47;
  }
  // Silent corruption: ok + writtenFiles but empty file / no artifact
  const silentCorrupt =
    runResult.ok &&
    Array.isArray(runResult.writtenFiles) &&
    runResult.writtenFiles.length > 0 &&
    (fileLen === 0 || !pngArt);
  const good =
    runResult.ok &&
    !runResult.error &&
    pngArt &&
    fileLen === expected.byteLength &&
    equal &&
    magicOk &&
    !silentCorrupt;
  record(
    'binary-png-via-product-run-code',
    good,
    `ok=${runResult.ok} arts=${arts.length} fileLen=${fileLen} equal=${equal} written=${JSON.stringify(runResult.writtenFiles)} stdout=${runResult.stdout}`
  );
}

// Direct coerce path: plain-object dump must not become empty write
{
  const { createSessionGuestFs, coerceToUint8Array } = await import(
    '../../../src/agent/vnext/sessionWorkspace/fs.js'
  );
  const { SessionWorkspaceStore: S } = await import('../../../src/agent/vnext/runSession.product.js');
  const store = new S();
  store.put('sessions', 'c', { sessionId: 'c', messages: [] });
  const fs = createSessionGuestFs(store, { sessionId: 'c', executionId: null });
  fs.mkdirp('/artifacts');
  const dump = { 0: 0x89, 1: 0x50, 2: 0x4e, 3: 0x47, length: 4 };
  const coerced = coerceToUint8Array(dump);
  fs.writeFile('/artifacts/dump.bin', dump, { mimeType: 'application/octet-stream' });
  const back = fs.readFileBytes('/artifacts/dump.bin');
  record(
    'coerce-quickjs-dump-object-not-empty',
    coerced.byteLength === 4 && back.byteLength === 4 && back[0] === 0x89,
    `coerced=${coerced.byteLength} back=${back.byteLength}`
  );
}

// Product run(code) must not silently drop fake format files
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('fake');
  const res = await svc.sendMessage({
    sessionId: 'fake',
    content: 'write png',
    callModel: callModelRunCode(`await fs.writeFile('/artifacts/evil.png', 'not a png');`)
  });
  const runTc = res.toolCalls.find((t) => t.toolName === 'run');
  const out = runTc?.result || {};
  const arts = await svc.listArtifacts({ sessionId: 'fake' });
  record(
    'run-code-surfaces-artifact-truth-reject',
    out.ok === false &&
      /artifact truth rejected/i.test(String(out.error || '')) &&
      Array.isArray(out.rejected) &&
      out.rejected.length >= 1 &&
      arts.length === 0,
    `ok=${out.ok} error=${out.error} rejected=${JSON.stringify(out.rejected)} arts=${arts.length}`
  );
}

console.log(`\nwave3 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE3 PASS: product coding run works');
