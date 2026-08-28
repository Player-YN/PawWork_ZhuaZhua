/**
 * Static + structural gate: product entry must not depend on Task-centric architecture.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  createSessionWorkspaceRuntime,
  PRODUCT_RUNTIME,
  PRODUCT_ENTRY,
  PRODUCT_STORE
} from '../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  createDurableSessionWorkspaceStore,
  __resetDurableMemoryBackends
} from '../../src/agent/vnext/sessionWorkspace/durableStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

// Structural import / call patterns (not prose mentions in comments)
const FORBIDDEN_RE = [
  /from\s+['"].*taskInput['"]/,
  /from\s+['"].*taskWorkspace['"]/,
  /import\s*\{[^}]*freezeTaskInput/,
  /import\s*\{[^}]*initTaskWorkspace/,
  /\bfreezeTaskInput\s*\(/,
  /\binitTaskWorkspace\s*\(/,
  /\brunTask\s*\(/,
  /\bstartTask\s*\(/
];

const PRODUCT_FILES = [
  'src/agent/vnext/runSession.product.js',
  'src/agent/vnext/sessionWorkspace/sendMessage.js',
  'src/agent/vnext/sessionWorkspace/index.js',
  'src/agent/vnext/service/sessionWorkspaceService.js',
  'src/offscreen/runtime.js'
];

let failed = false;

// Sidepanel must use unified sendMessage, not startTask/runTask product path
{
  const sidepanel = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  if (/\bworkspaceRpc\(\s*['"]startTask['"]/.test(sidepanel)) {
    console.error('sidepanel still calls workspaceRpc(startTask)');
    failed = true;
  }
  if (/\bworkspaceRpc\(\s*['"]runTask['"]/.test(sidepanel)) {
    console.error('sidepanel still calls workspaceRpc(runTask)');
    failed = true;
  }
  if (!/workspaceRpc\(\s*['"]sendMessage['"]/.test(sidepanel)) {
    console.error('sidepanel must call workspaceRpc(sendMessage)');
    failed = true;
  }
  // Offscreen must mount SessionWorkspaceService
  const off = fs.readFileSync(path.join(root, 'src/offscreen/runtime.js'), 'utf8');
  if (!/SessionWorkspaceService/.test(off)) {
    console.error('offscreen must use SessionWorkspaceService');
    failed = true;
  }
  if (/from\s+['"].*workspaceService['"]/.test(off)) {
    console.error('offscreen must not import legacy WorkspaceService');
    failed = true;
  }
}
for (const rel of PRODUCT_FILES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`MISSING product file: ${rel}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  for (const re of FORBIDDEN_RE) {
    if (re.test(text)) {
      console.error(`FORBIDDEN pattern ${re} in ${rel}`);
      failed = true;
    }
  }
}

// Runtime behavior: sendMessage does not create tasks map
const rt = createSessionWorkspaceRuntime();
const s = rt.createSession();
const res = await rt.sendMessage({
  sessionId: s.sessionId,
  content: 'ping',
  allowOfflineDirect: true
});
if (res.createdTask !== false) {
  console.error('createdTask must be false');
  failed = true;
}
if (rt.store.tasks) {
  console.error('store must not have tasks collection');
  failed = true;
}
if (PRODUCT_RUNTIME !== 'session-workspace') {
  console.error('PRODUCT_RUNTIME marker wrong');
  failed = true;
}
if (!PRODUCT_ENTRY.includes('runSession.product')) {
  console.error('PRODUCT_ENTRY marker wrong');
  failed = true;
}

// Ensure product entry module graph does not import taskWorkspace/taskInput
const productEntry = fs.readFileSync(path.join(root, 'src/agent/vnext/runSession.product.js'), 'utf8');
if (/taskWorkspace|taskInput|freezeTaskInput/.test(productEntry)) {
  console.error('runSession.product.js imports task-centric modules');
  failed = true;
}

if (PRODUCT_STORE !== 'durable-session-workspace') {
  console.error('PRODUCT_STORE marker must be durable-session-workspace');
  failed = true;
}

// Product service.create uses durable store (survives new instance)
{
  __resetDurableMemoryBackends();
  const dbName = `gate-durable-${Date.now()}`;
  const svc1 = await SessionWorkspaceService.create({
    store: await createDurableSessionWorkspaceStore({ dbName }),
    callModel: async () => ({ text: 'ok', toolCalls: [] })
  });
  if (svc1.storeKind !== 'durable') {
    console.error('SessionWorkspaceService.storeKind must be durable');
    failed = true;
  }
  svc1.ensureSession('s1');
  // write via runtime artifact path
  const { createArtifact } = await import('../../src/agent/vnext/sessionWorkspace/artifacts.js');
  const { createSessionGuestFs } = await import('../../src/agent/vnext/sessionWorkspace/fs.js');
  const { beginExecution, settleExecution } = await import(
    '../../src/agent/vnext/sessionWorkspace/execution.js'
  );
  const ex = beginExecution(svc1.runtime.store, 's1');
  const fsGuest = createSessionGuestFs(svc1.runtime.store, {
    sessionId: 's1',
    executionId: ex.executionId
  });
  fsGuest.mkdirp('/artifacts');
  createArtifact(svc1.runtime.store, fsGuest, {
    sessionId: 's1',
    name: 'g.md',
    packageDir: 'gate',
    content: 'gate'
  });
  settleExecution(svc1.runtime.store, ex, 'settled');
  await svc1.runtime.store.flush();

  const svc2 = await SessionWorkspaceService.create({
    store: await createDurableSessionWorkspaceStore({ dbName })
  });
  const arts = await svc2.listArtifacts({ sessionId: 's1' });
  if (arts.length !== 1) {
    console.error(`durable restart: expected 1 artifact, got ${arts.length}`);
    failed = true;
  }
  __resetDurableMemoryBackends();
}

// sidepanel must cascade deleteSession + have artifact shelf hooks
{
  const sidepanel = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  if (!/workspaceRpc\(\s*['"]deleteSession['"]/.test(sidepanel)) {
    console.error('sidepanel must workspaceRpc(deleteSession)');
    failed = true;
  }
  if (!/workspaceRpc\(\s*['"]listArtifacts['"]/.test(sidepanel)) {
    console.error('sidepanel must workspaceRpc(listArtifacts)');
    failed = true;
  }
  if (!/workspaceRpc\(\s*['"]deleteArtifact['"]/.test(sidepanel)) {
    console.error('sidepanel must workspaceRpc(deleteArtifact)');
    failed = true;
  }
  const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
  if (!/id="artifactShelfList"/.test(html)) {
    console.error('sidepanel.html missing artifactShelfList');
    failed = true;
  }
}

if (failed) {
  console.error('NO-TASK-RUNTIME GATE FAIL');
  process.exit(1);
}
console.log('NO-TASK-RUNTIME GATE PASS');
process.exit(0);
