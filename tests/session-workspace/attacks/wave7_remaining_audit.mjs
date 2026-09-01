/**
 * Wave 7 — remaining audit alignment: SoT cache, storage pressure, pack clean,
 * stable product path, preview bytes availability.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { createArtifact } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// C-6 structural: sidepanel documents UI cache + prune/rename write-through
{
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  record(
    'sidepanel-ui-cache-not-sole-truth',
    /pagewand_session_ui_cache|UI projection cache|Runtime is durable SoT/.test(side) &&
      /pruneSessions|renameSession|listSessions|getSession/.test(side),
    ''
  );
  record(
    'sidepanel-session-thread-not-task-primary',
    /session-thread/.test(side) && /历史任务|Tasks/.test(fs.readFileSync(path.join(root, 'src/sidepanel/i18n.js'), 'utf8')),
    ''
  );
}

// H-5b: readArtifact returns bytes for PNG
{
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('p');
  const fsG = createSessionGuestFs(svc.runtime.store, { sessionId: 'p', executionId: null });
  fsG.mkdirp('/artifacts');
  const art = createArtifact(svc.runtime.store, fsG, {
    sessionId: 'p',
    name: 'x.png',
    content: PNG,
    mimeType: 'image/png'
  });
  const read = await svc.readArtifact({ sessionId: 'p', artifactId: art.artifactId });
  record(
    'preview-bytes-available-for-image',
    read.byteLength === PNG.byteLength &&
      read.mimeType === 'image/png' &&
      Buffer.from(String(read.base64 || ''), 'base64')[0] === 0x89,
    `len=${read.byteLength}`
  );
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  record(
    'preview-opens-extension-tab-not-window-open',
    /open_artifact_preview/.test(side) &&
      /previewSessionArtifact/.test(side) &&
      !/window\.open\(/.test(side),
    ''
  );
}

// Storage pressure never deletes artifacts
{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('s');
  const fsG = createSessionGuestFs(svc.runtime.store, { sessionId: 's', executionId: null });
  fsG.mkdirp('/artifacts');
  createArtifact(svc.runtime.store, fsG, { sessionId: 's', name: 'keep.md', content: 'keep' });
  svc.runtime.store.put('meta', 'cache:tmp', { x: 1 });
  const r = await svc.applyStoragePressure({ level: 'soft' });
  const arts = await svc.listArtifacts({ sessionId: 's' });
  record(
    'storage-pressure-preserves-artifacts',
    arts.length === 1 && r.artifactsPreserved >= 1,
    `arts=${arts.length} preserved=${r.artifactsPreserved}`
  );
  const est = await svc.estimateStorage();
  record('estimate-storage-api', typeof est.blobBytes === 'number', JSON.stringify(est));
}

// M-5 product path
{
  const off = fs.readFileSync(path.join(root, 'src/offscreen/runtime.js'), 'utf8');
  const sm = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/sendMessage.js'), 'utf8');
  record(
    'product-not-legacy-workspaceService',
    /SessionWorkspaceService/.test(off) && !/service\/workspaceService/.test(off),
    ''
  );
  record(
    'product-loop-is-ToolLoopAgent',
    /runSessionToolLoopAgent/.test(sm) && !/async function runToolLoop/.test(sm),
    ''
  );
}

// M-7 pack script clean gate exists
{
  const pack = fs.readFileSync(path.join(root, 'scripts/pack-unpacked.mjs'), 'utf8');
  record(
    'pack-has-clean-forbidden-gate',
    /FORBIDDEN|node_modules|\.git/.test(pack) && /assertClean|forbidden/.test(pack),
    ''
  );
  record(
    'pack-copies-mit-and-tldraw-license',
    /THIRD_PARTY_NOTICES/.test(pack) && /tldraw-LICENSE/.test(pack) && /['"]licenses['"]/.test(pack),
    ''
  );
  record(
    'pack-writes-load-readme',
    /README\.md/.test(pack) && /Load unpacked/.test(pack) && /chrome:\/\/extensions/.test(pack),
    ''
  );
}

// M-8: agent_invoke removed; user export/screenshot entry points retained
{
  const cs = fs.readFileSync(path.join(root, 'src/content_script.js'), 'utf8');
  record(
    'content-script-agent-invoke-removed',
    !/agent_invoke|async function agentInvoke/.test(cs),
    ''
  );
  record(
    'content-script-user-export-entry-kept',
    /agent_export_selection|agent_export_csv|agent_download_images|fetch_urls_as_data_urls/.test(cs),
    ''
  );
}

// Skills: folder packages + semantic description catalog
{
  const reg = fs.readFileSync(
    path.join(root, 'src/agent/vnext/skills/registry.js'),
    'utf8'
  );
  record(
    'skills-loaded-from-folders',
    /html-preview\/index|slides\/index|poster\/index|compose-image\/index|visual-compile\/index|sheet-nl\/index|listing-sheet\/index|briefing-deck\/index|remake-poster\/index/.test(
      reg
    ),
    ''
  );
  const { listSkillCatalog, formatSkillsForSystemPrompt, loadSkillResource } = await import(
    '../../../src/agent/vnext/skills/registry.js'
  );
  const cat = listSkillCatalog();
  record(
    'skills-have-semantic-descriptions',
    cat.length >= 3 && cat.every((s) => s.description && s.description.length > 20),
    cat.map((s) => s.id).join(',')
  );
  const block = formatSkillsForSystemPrompt({});
  record(
    'skills-system-block-catalog-only',
    /semantic understanding/.test(block) &&
      /Skill catalog/.test(block) &&
      /view=skill/.test(block) &&
      !/### Skill playbooks/.test(block) &&
      !block.includes('data-pawwork-preview'),
    ''
  );
  record(
    'skill-folder-resources-loadable',
    !!loadSkillResource('html-preview', 'templates/report.html')?.includes('data-pawwork-preview="blocks"'),
    ''
  );
}

{
  const { readHtmlPreviewKind } = await import(
    '../../../src/agent/vnext/sessionWorkspace/htmlPreviewMarker.js'
  );
  record(
    'html-preview-marker-detects-blocks',
    readHtmlPreviewKind('<!DOCTYPE html><html data-pawwork-preview="blocks"><head></head></html>') ===
      'blocks',
    ''
  );
  record(
    'html-preview-marker-ignores-plain-html',
    readHtmlPreviewKind('<!DOCTYPE html><html><head><title>x</title></head><body>hi</body></html>') ===
      null,
    ''
  );
}

// H-10 pagination present
{
  const tools = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/tools.js'), 'utf8');
  record('inspect-group-has-limit-offset', /offset.*limit|limit.*offset/.test(tools) && /hasMore/.test(tools), '');
}

// Offscreen has chrome.runtime but not chrome.storage — loadLlmSettings must not
// throw "Cannot read properties of undefined (reading 'local')"
{
  const llmSrc = fs.readFileSync(path.join(root, 'src/agent/llm.js'), 'utf8');
  const bg = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
  record(
    'llm-storage-guards-offscreen',
    /storage\?\.local/.test(llmSrc) && /storage_local_get/.test(llmSrc),
    ''
  );
  record(
    'legacy-chatCompletion-removed',
    !/chatCompletion|handleSseLine|pagewand-llm-stream/.test(llmSrc) &&
      !/pagewand-llm-stream/.test(bg) &&
      !fs.existsSync(path.join(root, 'src/agent/protocol.js')),
    ''
  );
  record(
    'sw-proxies-storage-for-offscreen',
    /storage_local_get/.test(bg) && /storage_local_set/.test(bg),
    ''
  );

  const prevChrome = globalThis.chrome;
  const stored = {
    pagewand_providers: [
      {
        id: 'p1',
        name: 'Test',
        baseURL: 'https://api.example.com/v1',
        apiKey: 'sk-offscreen-test',
        model: 'demo-model',
        createdAt: 1
      }
    ],
    pagewand_active_provider_id: 'p1'
  };
  globalThis.chrome = {
    runtime: {
      sendMessage: async (msg) => {
        if (msg?.action === 'storage_local_get') {
          const out = {};
          for (const k of msg.keys || []) out[k] = stored[k];
          return { ok: true, result: out };
        }
        if (msg?.action === 'storage_local_set') {
          Object.assign(stored, msg.values || {});
          return { ok: true };
        }
        return { ok: false, error: `unexpected ${msg?.action}` };
      }
    }
  };
  try {
    const { loadLlmSettings } = await import('../../../src/agent/llm.js');
    const settings = await loadLlmSettings();
    record(
      'offscreen-loadLlmSettings-via-sw-bridge',
      settings.apiKey === 'sk-offscreen-test' && settings.model === 'demo-model',
      `key=${settings.apiKey} model=${settings.model}`
    );
  } catch (e) {
    record(
      'offscreen-loadLlmSettings-via-sw-bridge',
      false,
      e instanceof Error ? e.message : String(e)
    );
  } finally {
    globalThis.chrome = prevChrome;
  }
}

{
  const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
  const selStart = html.indexOf('id="selectionBar"');
  const scrollStart = html.indexOf('id="panelScroll"');
  record(
    'selection-bar-pinned-outside-scroll',
    selStart > 0 && scrollStart > selStart,
    `sel=${selStart} scroll=${scrollStart}`
  );
  record(
    'turn-jump-rail-present',
    /id="turnJumpRail"/.test(html) && /class="turn-jump"/.test(html),
    ''
  );
  const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
  record(
    'session-rail-has-delete-workspace',
    /session-rail-item-close/.test(side) &&
      /async function deleteSessionById/.test(side) &&
      /deleteSession/.test(side),
    ''
  );
  record(
    'text-picks-go-to-clipboard-not-chips',
    /function isSelectionChipKind/.test(side) &&
      /kind !== 'text'/.test(side) &&
      /if \(!isSelectionChipKind\(kind\)\) return;/.test(side) &&
      /pinTextsToClipboard\(fresh, \{ openDrawer: true, toast: false \}\)/.test(side),
    ''
  );
  record(
    'selection-hints-infer-via-rpc',
    /workspaceRpc\(\s*['"]suggestSelectionActions['"]/.test(side) &&
      /function inferSelectionHintChips/.test(side) &&
      /正在根据选区推断/.test(side),
    ''
  );
  record(
    'restore-highlights-skips-page-items-with-loop-var',
    /function pageItemsForActiveGroup/.test(side) &&
      /if \(it\.labelKind === 'page' \|\| it\.kindHint === 'page'/.test(side) &&
      !/if \(item\.labelKind === 'page'/.test(side),
    ''
  );
}

console.log(`\nwave7 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log('WAVE7 PASS: remaining audit items structural+product');
