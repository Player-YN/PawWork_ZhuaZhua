import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { fillMissingSlotFromSelection } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { loadSkillInstructions } from '../../src/agent/vnext/skills/registry.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');
const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const sideHtml = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const designHtmlEarly = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');

assert.doesNotMatch(html, /class="artboard-tools/);
assert.doesNotMatch(html, /data-act="tool-hand"/);
assert.match(designHtmlEarly, /id="engine"/);
assert.doesNotMatch(designHtmlEarly, /fig-page-row/);
assert.doesNotMatch(designHtmlEarly, />Page 1</);
assert.match(designHtmlEarly, /id="insertBtn"/);
assert.match(designHtmlEarly, /id="toolStrip"/);
assert.match(designHtmlEarly, /\+ 幻灯片|id="filmstrip"/);
assert.doesNotMatch(js, /addArtboardFrame/);
assert.match(html, /id="page"/);
assert.doesNotMatch(html, /id="pagesBlock"/);
assert.doesNotMatch(html, /id="filmstrip"/);
assert.doesNotMatch(html, /id="inspector"/);
assert.doesNotMatch(html, /id="rail"/);
assert.match(side, /querySelector\('\.think-block'\)|think-block\.is-live/);
assert.doesNotMatch(js, /plates\[0\]\?\.slots\?\.\[0\]\?\.id/);
assert.match(side, /html_tab_state/);
assert.match(side, /canvasSelRow|renderCanvasSelRow/);
assert.match(sideHtml, /id="canvasSelRow"/);
assert.match(side, /function renderCanvasSelRow/);
assert.match(side, /function renderSheetSelRow/);
assert.match(side, /chip\.className = 'sheet-sel-chip'/);
assert.match(side, /sheet-sel-chip-x/);
assert.match(sideHtml, /id="moreSkillsBtn"/);
assert.match(sideHtml, /id="skillsSettingsModal"/);
assert.doesNotMatch(sideHtml, /id="settingsSkillsCard"/);

const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
assert.match(designHtml, /id="layerList"/);
assert.match(designJs, /function nestLayerTree/);
assert.match(designJs, /function applyPatchFromStore/);
assert.match(designJs, /function isStructuralCanvasReplace/);
assert.match(designJs, /incoming > 0 && incoming !== live/);
assert.match(designJs, /function isWorkLocked/);
assert.match(designJs, /await applyPatchFromStore\(\)/);
assert.match(designJs, /pagewand_tldraw_license|TLDRAW_LICENSE_STORAGE_KEY/);
assert.match(designJs, /licenseKey/);
assert.match(designJs, /tldrawLicenseStatus/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/tldrawLicense.js'), 'utf8'), /pagewand_tldraw_license/);
assert.match(sideHtml, /id="tldrawLicenseInput"/);
assert.doesNotMatch(designHtml, /transform:\s*none\s*!important/);
assert.match(designJs, /ignorePatchUntil/);
assert.match(designJs, /pointerDepth/);
assert.match(designJs, /collapsedLayerIds/);
assert.doesNotMatch(designJs, /location\.reload/);
assert.match(designJs, /editor\.loadSnapshot/);
assert.match(designJs, /pawwork_canvas_apply/);
assert.match(designJs, /applyCommands/);
assert.match(designJs, /exportSvg/);
assert.match(designJs, /exportFrames/);
assert.match(designJs, /captureEnginePreview/);
assert.match(designJs, /method === 'preview'/);
assert.match(designJs, /liveApplied/);
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
assert.match(runtimeEntry, /canvas-readback-hint/);
assert.match(runtimeEntry, /function bindViewport/);
assert.match(runtimeEntry, /function cameraSane/);
assert.match(runtimeEntry, /function contentInView/);
assert.match(runtimeEntry, /pointerdown/);
assert.match(runtimeEntry, /pointerup/);
assert.match(runtimeEntry, /op === 'zoomToSelection'/);
assert.doesNotMatch(runtimeEntry, /store\?\.listen/);
assert.match(runtimeEntry, /maxFontsToLoadBeforeRender:\s*0/);
assert.match(runtimeEntry, /applyLiveCommands|applyCommands/);
assert.match(runtimeEntry, /alignShapes/);
assert.match(runtimeEntry, /groupShapes/);
assert.match(runtimeEntry, /DebugPanel:\s*null/);
assert.doesNotMatch(runtimeEntry, /maxPages:\s*1/);
assert.doesNotMatch(runtimeEntry, /PageMenu:\s*null/);
assert.doesNotMatch(runtimeEntry, /NavigationPanel:\s*null/);
assert.doesNotMatch(runtimeEntry, /Minimap:\s*null/);
assert.doesNotMatch(runtimeEntry, /VideoToolbar:\s*null/);
assert.doesNotMatch(runtimeEntry, /Toolbar:\s*null/);
assert.doesNotMatch(runtimeEntry, /delete next\.laser/);
assert.doesNotMatch(runtimeEntry, /TLDRAW_OVERRIDES/);
assert.match(runtimeEntry, /TLDRAW_AUTHORING_TOOLS/);
assert.match(runtimeEntry, /SharePanel:\s*null/);
assert.match(runtimeEntry, /createBlankSlide|placeBlankSlide/);
assert.match(runtimeEntry, /exportFrames/);
assert.match(runtimeEntry, /exportPreview/);
assert.match(runtimeEntry, /getSelectionScreenBounds/);
assert.match(designJs, /mountOfficeSelBubble/);
assert.match(fs.readFileSync(path.join(root, 'src/background.js'), 'utf8'), /canvas_host/);
assert.match(fs.readFileSync(path.join(root, 'src/background.js'), 'utf8'), /pawwork_canvas_apply/);
assert.match(fs.readFileSync(path.join(root, 'src/background.js'), 'utf8'), /method === 'preview'/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /hostCanvas/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /inferDeckAct/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /DECK_OPS/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /DECK_ACTS/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /DECK_CAPABILITIES/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /act=export|method: 'export'/);
assert.match(fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8'), /method === 'export'/);
assert.match(runtimeEntry, /shell === 'slides'/);
assert.match(runtimeEntry, /frameBounds/);
assert.match(runtimeEntry, /1920/);
assert.match(fs.readFileSync(path.join(root, 'scripts/build-design.mjs'), 'utf8'), /PAW_TLDRAW_LICENSE_KEY/);
assert.match(fs.readFileSync(path.join(root, 'scripts/build-design.mjs'), 'utf8'), /TLDRAW_LICENSE_KEY/);
assert.match(runtimeEntry, /LoadingScreen:\s*null/);
assert.match(runtimeEntry, /TLDRAW_OPTIONS/);
assert.match(designJs, /tldraw: \{ document \}/);
assert.doesNotMatch(designJs, /htmlForce/);
assert.doesNotMatch(designJs, /looksLikeVisualHtml/);
assert.match(designJs, /artifactPreview\.html/);
assert.match(designJs, /function positionExportMenu/);
assert.match(designJs, /showPopover/);
assert.match(designHtml, /popover="auto"/);
assert.match(designHtml, /#engine \.tl-loading/);
assert.match(designHtml, /content-visibility:\s*visible/);
assert.match(designHtml, /width:\s*max-content/);
const hostBarCss = fs.readFileSync(path.join(root, 'src/preview/host-bar.css'), 'utf8');
assert.match(hostBarCss, /inset:\s*unset/);
assert.match(hostBarCss, /width:\s*max-content/);
assert.doesNotMatch(designHtml, /id="exportMenu" hidden/);
const vendorRuntime = fs.readFileSync(path.join(root, 'src/preview/vendor/design-runtime.js'), 'utf8');
assert.match(vendorRuntime, /maxFontsToLoadBeforeRender:\s*0/);
assert.match(vendorRuntime, /LoadingScreen:\s*null/);
const hint = fs.readFileSync(path.join(root, 'scripts/canvas-readback-hint.js'), 'utf8');
assert.match(hint, /willReadFrequently/);
assert.match(hint, /OffscreenCanvas/);
assert.match(hint, /isConnected/);
assert.match(designHtml, /src="canvas-readback-hint\.js"/);
assert.doesNotMatch(designHtml, /<script>\s*\(/);
assert.doesNotMatch(
  html.replace(/<span class="artboard-sel-actions"[\s\S]*?<\/span>/, ''),
  />左齐</
);

const emptyFill = fillMissingSlotFromSelection(
  [{ op: 'setSlotText', text: 'x' }],
  [{ plateId: 'poster' }]
);
assert.equal(emptyFill[0].slotId, undefined);

const poster = loadSkillInstructions('poster', { sessionId: 's' }) || '';
const deck = loadSkillInstructions('slides', { sessionId: 's' }) || '';
assert.doesNotMatch(poster, /op=html/);
assert.doesNotMatch(deck, /op=html/);

const MARKED = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="poster">
<head><meta charset="utf-8"/><title>P</title>
<style>:root{--paw-poster-w:720px;--paw-poster-h:1080px}</style></head>
<body>
<section data-paw-block data-paw-block-id="poster">
  <h1 data-paw-slot="headline">旧标题</h1>
  <p data-paw-slot="body">旧正文</p>
</section>
</body></html>`;

async function withTools(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  return { store, tools, guest };
}

async function run() {
  const a = await withTools('s-need-sel');
  const created = await a.tools.run.execute({
    op: 'html',
    name: 'poster.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        title: 'P',
        nodes: [
          { id: 'headline', type: 'headline', text: '旧标题' },
          { id: 'body', type: 'text', text: '旧正文' }
        ]
      }
    ]
  });
  assert.equal(created.ok, true, created.error);
  const artifactId = created.artifact.artifactId;
  a.store.put('sessions', 's-need-sel', {
    ...a.store.get('sessions', 's-need-sel'),
    activeHtml: { artifactId, selections: [] }
  });
  const blind = await a.tools.deck.execute({ act: 'write', artifactId, text: 'SHOULD-NOT' });
  assert.equal(blind.ok, false, 'field write without slot must fail');
  assert.equal(blind.code, 'NEED_SELECTION');
  assert.doesNotMatch(a.guest.readFile(created.artifact.primaryPath), /SHOULD-NOT/);

  a.store.put('sessions', 's-need-sel', {
    ...a.store.get('sessions', 's-need-sel'),
    activeHtml: {
      artifactId,
      selections: [{ nodeId: 'shape:headline', slotId: 'shape:headline' }]
    }
  });
  const pinned = await a.tools.deck.execute({ act: 'write', artifactId, text: '新标题' });
  assert.equal(pinned.ok, true, pinned.error);
  const after = a.guest.readFile(created.artifact.primaryPath);
  assert.match(after, /新标题/);
  assert.match(after, /旧正文/);
  assert.doesNotMatch(after, /旧标题/);

  console.log('test_design_slides_shell: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
