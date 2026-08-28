/**
 * Product import gate: Sidepanel → background → offscreen SessionWorkspaceService.
 * Session Workspace path (sendMessage), not legacy Task startTask.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const SIDEPANEL = path.join(root, 'src/sidepanel.js');
const CLIENT = path.join(root, 'src/agent/vnext/host/workspaceClient.js');
const BACKGROUND = path.join(root, 'src/background.js');
const OFFSCREEN = path.join(root, 'src/offscreen/runtime.js');
const SERVICE = path.join(root, 'src/agent/vnext/service/sessionWorkspaceService.js');
const MANIFEST = path.join(root, 'manifest.json');

function read(file) {
  assert.ok(fs.existsSync(file), 'missing ' + path.relative(root, file));
  return fs.readFileSync(file, 'utf8');
}

const sidepanel = read(SIDEPANEL);
const client = read(CLIENT);
const background = read(BACKGROUND);
const offscreen = read(OFFSCREEN);
const service = read(SERVICE);
const manifest = JSON.parse(read(MANIFEST));

assert.match(sidepanel, /workspaceClient\.js/, 'sidepanel imports workspace RPC client');
assert.match(sidepanel, /function attachPastedImages\(/, 'paste images have a dedicated capture path');
assert.match(sidepanel, /source:\s*['"]paste['"]/, 'pasted images are tagged source=paste');
assert.match(
  sidepanel,
  /dropPastedComposerAttachments/,
  'clipboard clear also drops pasted composer chips'
);
const pasteHandler = sidepanel.slice(
  sidepanel.indexOf("addEventListener('paste'"),
  sidepanel.indexOf("addEventListener('paste'") + 900
);
assert.match(
  pasteHandler,
  /if \(images\.length\) attachPastedImages\(images\);/,
  'paste images do not share processInputFiles with the file picker'
);
assert.doesNotMatch(
  pasteHandler,
  /processInputFiles\(files\)/,
  'paste handler no longer dumps every clipboard file into workspace persist'
);
assert.match(
  sidepanel,
  /workspaceRpc\(['"]sendMessage['"]/,
  'sidepanel sends via workspace service sendMessage'
);
assert.doesNotMatch(
  sidepanel,
  /workspaceRpc\(['"]startTask['"]/,
  'sidepanel must not start Task-centric startTask'
);
assert.doesNotMatch(sidepanel, /runVnextTask\s*\(/, 'sidepanel does not invoke old ephemeral runVnextTask');
assert.doesNotMatch(
  sidepanel,
  /legacyPipeline|runPipelineTask|classifyRoute/,
  'sidepanel has no old runtime fallback'
);

assert.match(client, /action:\s*['"]workspace_rpc['"]/, 'client addresses background workspace RPC');
assert.match(background, /workspace_rpc/, 'background forwards workspace RPC');
assert.match(background, /ensurePawWorkOffscreen/, 'background owns offscreen lifecycle');
assert.match(offscreen, /SessionWorkspaceService/, 'offscreen instantiates SessionWorkspaceService');
assert.match(offscreen, /workspace_rpc_execute/, 'offscreen executes workspace RPC');
assert.match(service, /sendMessage/, 'product service exposes sendMessage');
assert.match(service, /createDurableSessionWorkspaceStore|DurableSessionWorkspaceStore/, 'durable store');
assert.match(service, /createPageWandLanguageModel/, 'product service builds AI SDK LanguageModel');
const sendMessageSrc = read(path.join(root, 'src/agent/vnext/sessionWorkspace/sendMessage.js'));
assert.match(sendMessageSrc, /runSessionToolLoopAgent/, 'sendMessage uses ToolLoopAgent runner');
assert.doesNotMatch(sendMessageSrc, /async function runToolLoop/, 'handwritten runToolLoop removed');
assert.doesNotMatch(
  offscreen,
  /from\s+['"].*service\/workspaceService['"]/,
  'offscreen must not import legacy Task WorkspaceService'
);
assert.doesNotMatch(
  service,
  /from\s+['"].*workspace\/task|freezeTaskInput|runTask\s*\(/,
  'Session service must not depend on Task freeze/runTask'
);
assert.ok(
  Array.isArray(manifest.permissions) && manifest.permissions.includes('offscreen'),
  'manifest grants offscreen permission'
);
assert.equal(manifest.background?.service_worker, 'src/background.js', 'background service worker is declared');

const repositoryFiles = walkFiles(root, {
  exclude: new Set(['node_modules', '.git', 'artifacts'])
});
const executableFiles = repositoryFiles.filter((file) => /\.(?:js|mjs|html|json)$/i.test(file));
for (const file of executableFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const source = read(file);
  if (rel.startsWith('src/agent/vnext/adapters/vendor/')) continue;
  if (rel.startsWith('src/preview/vendor/')) continue;
  assert.doesNotMatch(
    source,
    /<script[^>]+src=["']https?:|import\s*\(\s*["']https?:|wasmURL\s*:\s*["']https?:|unpkg\.com|cdn\.jsdelivr\.net|esm\.sh/i,
    `remote executable dependency forbidden: ${rel}`
  );
}
const srcFiles = walkFiles(path.join(root, 'src'), {
  exclude: new Set(['vendor', 'node_modules'])
});
for (const file of srcFiles) {
  if (!/\.(?:js|mjs)$/i.test(file)) continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const source = read(file);
  assert.doesNotMatch(
    source,
    /from\s+['"]fflate['"]|from\s+['"]xlsx['"]/,
    `Chrome MV3 cannot resolve bare npm specifiers: ${rel}`
  );
}
assert.ok(fs.existsSync(path.join(root, 'src/preview/vendor/fflate.js')), 'vendored fflate for offscreen/sheet');
assert.match(
  read(path.join(root, 'src/preview/sheetModel.js')),
  /from\s+['"]\.\/vendor\/fflate\.js['"]/,
  'sheetModel imports relative fflate'
);

assert.ok(!manifest.permissions?.includes('userScripts'), 'manifest does not expose userScripts');
assert.ok(
  !fs.existsSync(path.join(root, 'src/agent/userScriptsExec.js')),
  'live page generated-code executor removed'
);
assert.ok(!fs.existsSync(path.join(root, 'src/index.html')), 'obsolete remote-code HTML entry removed');

function walkFiles(directory, { exclude }) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(target, { exclude }));
    else out.push(target);
  }
  return out;
}

console.log('prod import gate: ok (sidepanel -> background -> offscreen -> SessionWorkspaceService)');
