import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sheet = fs.readFileSync(path.join(root, 'src/preview/sheet.html'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'src/preview/docs.html'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
const sheetJs = fs.readFileSync(path.join(root, 'src/preview/sheet.js'), 'utf8');
const sheetModelJs = fs.readFileSync(path.join(root, 'src/preview/sheetModel.js'), 'utf8');
const docsJs = fs.readFileSync(path.join(root, 'src/preview/docs.js'), 'utf8');
const htmlJs = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');
const toolsJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/tools.js'), 'utf8');
const sendJs = fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/sendMessage.js'), 'utf8');

function actionOrder(src) {
  const acts = [];
  const re = /data-act="(accept|discard|save|download|undo)"/g;
  let m;
  while ((m = re.exec(src))) acts.push(m[1]);
  return acts;
}

assert.equal((htmlJs.match(/function b64ToBytes\(/g) || []).length, 1);

assert.doesNotMatch(sheet, /host-bar\.css/);
assert.doesNotMatch(docs, /host-bar\.css/);
assert.match(html, /host-bar\.css/);

assert.doesNotMatch(sheet, /id="bar"/);
assert.doesNotMatch(docs, /id="bar"/);
assert.doesNotMatch(sheet, /id="pawRibbon"/);
assert.doesNotMatch(sheet, /paw-ribbon/);
assert.match(sheetJs, /createSubmenu/);
assert.match(sheetJs, /ribbon\.start\.others/);
assert.match(sheetJs, /appendTo\(parent\.id\)/);
assert.match(sheetJs, /id: 'paw\.export'/);
assert.match(sheetJs, /id: 'paw\.lang'/);
assert.match(sheetJs, /_commandService/);
assert.match(sheetJs, /pawwork\.export/);
assert.match(sheetJs, /pawwork\.langMenu/);
assert.match(sheetJs, /ExportIcon/);
assert.match(sheetJs, /UndoIcon/);
assert.match(sheetJs, /RedoIcon/);
assert.match(sheetJs, /redoLastAgentEdit/);
assert.match(sheet, /data-act="redo"/);
assert.match(sheetJs, /schedulePawRibbonMenus/);
assert.match(sheet, /id="agentUndoToast"/);
assert.match(sheetJs, /showAgentUndoToast/);
assert.match(sheetJs, /ensurePromptCheckpoint/);
assert.match(sheetJs, /injectWorkbookSnapshot/);
assert.match(sheetJs, /extractWorkbookSnapshot/);
assert.match(sheetModelJs, /from ['"]\.\/vendor\/fflate\.js['"]/);
assert.doesNotMatch(sheetModelJs, /from ['"]fflate['"]/);
assert.match(sheetJs, /installPawSheetPlugin/);
assert.match(sheetJs, /disposeUniverRuntime/);
assert.match(sheetJs, /pagehide/);
assert.match(sheetJs, /evaluateBeforeCommand\(ev, \{ applying \}\)/);
assert.match(sheetJs, /fromAgent: true/);
assert.match(sheetJs, /withFromAgent/);
assert.doesNotMatch(sheetJs, /agentCommand: agentCommandDepth > 0/);
assert.doesNotMatch(sheetJs, /agentCommandDepth/);
assert.match(sheetJs, /await withFromAgent\(async \(\) => \{/);
assert.match(sheetJs, /Stages\.Steady/);
assert.match(sheetJs, /pawSheetPlugin\?\.dispose/);
assert.match(sheetJs, /shouldReinsertXlsxImages\(snapshot\)/);
assert.match(sheetJs, /evaluateBeforeCommand/);
assert.match(sheetJs, /pastePayloadAllowed/);
assert.match(sheetJs, /appendCommandLog/);
assert.doesNotMatch(
  sheetJs,
  /createWorkbook\(data\);\s*schedulePawRibbonMenus\(\);\s*installPawSheetPlugin\(\);/
);
assert.match(docsJs, /disposeUniverRuntime/);
assert.match(docsJs, /pagehide/);
assert.match(sheetJs, /encodeUtf8Csv/);
assert.match(sheetJs, /applyImageUrlsToRows/);
assert.match(sheetJs, /collectLiveSheetImages/);
assert.match(sheetJs, /bytesForPersist/);
assert.match(sheetJs, /bytesForXlsxExport/);
assert.match(sheetJs, /writeWorkbookXlsxBytes/);
assert.match(sheetJs, /readWorkbookFromXlsxBytes/);
assert.match(sheetJs, /classifyOpenArtifact/);
assert.match(sheetJs, /previewEntryForKind/);
assert.doesNotMatch(sheetJs, /if \(!isSheetArtifact\(item\)\)/);
assert.match(docsJs, /htmlForDocumentExport/);
assert.match(docsJs, /liveDocumentData/);
assert.match(docsJs, /durableLiveDocument/);
assert.match(docsJs, /normalizeUniverDoc/);
assert.match(docsJs, /LifeCycleChanged/);
assert.match(docsJs, /extractDocumentSnapshot/);
assert.match(htmlJs, /classifyOpenArtifact/);
assert.match(htmlJs, /previewEntryForKind/);
assert.doesNotMatch(htmlJs, /extractDocumentSnapshot/);
assert.doesNotMatch(htmlJs, /durablePlateHtml/);
assert.match(sheetJs, /rewriteWorkbookImages/);
assert.doesNotMatch(docsJs, /serializeDocHtml\(liveSnapshot\(\)\)/);
assert.doesNotMatch(htmlJs, /flushLivePlates/);
assert.doesNotMatch(htmlJs, /markedHtmlFromPlates/);
assert.match(sheetJs, /extractXlsxImages/);
assert.match(sheetJs, /writeXlsxBytes\(currentSheets\(\), images\)/);
assert.match(sheetJs, /growLiveGridFromScroll/);
assert.match(sheetJs, /Event\.Scroll/);
assert.match(sheetJs, /gridExtentFromUsed/);
assert.match(sheetJs, /growGridExtent/);
assert.doesNotMatch(sheetJs, /ensureExcelGrid/);
assert.match(sheetJs, /msg\.promptId/);
assert.match(toolsJs, /promptId/);
assert.match(sendJs, /promptId: message\.messageId/);
assert.match(docsJs, /ribbonType:\s*['"]classic['"]/);
assert.match(docsJs, /header:\s*true/);
assert.match(docsJs, /installPawRibbonMenus/);
assert.match(docsJs, /paw\.doc\.lang/);
assert.match(docsJs, /applyUniverLocale/);
assert.match(docsJs, /officeUiLang/);
assert.match(sheetJs, /officeUiLang|pawwork_office_locale/);
assert.match(docsJs, /docxBytesToUniverData/);
assert.match(docsJs, /classifyOpenArtifact/);
assert.match(docsJs, /previewEntryForKind/);
assert.doesNotMatch(docsJs, /parseLoadedDoc\(text \|\| bytesToUtf8\(bytes\)\)/);
assert.match(html, /data-act="save"/);
assert.match(html, /data-act="download"/);
assert.match(html, /id="page"/);
assert.doesNotMatch(html, /id="engine"/);
assert.doesNotMatch(html, /id="layers"/);
assert.doesNotMatch(html, /id="inspector"/);
assert.doesNotMatch(html, /id="filmstrip"/);
assert.doesNotMatch(html, /class="artboard-tools/);
assert.doesNotMatch(html, /data-act="tool-hand"/);
assert.equal(fs.existsSync(path.join(root, 'src/preview/artboardStage.js')), false);
assert.equal(fs.existsSync(path.join(root, 'src/preview/htmlCanvasPatch.js')), false);
assert.equal(fs.existsSync(path.join(root, 'src/preview/artboardHistory.js')), false);
assert.equal(fs.existsSync(path.join(root, 'src/preview/vendor/konva.js')), false);
assert.equal(fs.existsSync(path.join(root, 'scripts/build-konva.mjs')), false);
assert.match(htmlJs, /pawwork_html_preview_patch/);
assert.match(htmlJs, /srcdoc/);
assert.doesNotMatch(htmlJs, /undoArtboard/);
assert.doesNotMatch(htmlJs, /applyMarkedHtml/);
assert.doesNotMatch(htmlJs, /flushLivePlates/);
const bgJs = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
assert.match(bgJs, /pawwork_html_preview_patch/);
assert.match(bgJs, /html_canvas_updated/);
assert.match(bgJs, /previewEntryForItem/);
assert.match(bgJs, /wantDesign !== haveDesign/);
assert.match(bgJs, /site\.html/);
assert.match(bgJs, /wantSite !== haveSite/);
const siteHtml = fs.readFileSync(path.join(root, 'src/preview/site.html'), 'utf8');
const siteJs = fs.readFileSync(path.join(root, 'src/preview/site.js'), 'utf8');
assert.match(siteHtml, /host-bar\.css/);
assert.match(siteHtml, /id="page"/);
assert.match(siteHtml, /data-act="save"/);
assert.match(siteHtml, /data-act="undo"/);
assert.match(siteHtml, /data-act="download"/);
assert.doesNotMatch(siteHtml, /id="engine"/);
assert.match(siteJs, /html_tab_state/);
assert.match(siteJs, /nextSitePinIds/);
assert.match(siteJs, /ctrlKey|metaKey/);
assert.match(siteJs, /srcdoc/);
assert.match(siteJs, /data-paw-node/);
assert.match(siteJs, /pawwork_html_preview_patch/);
assert.match(siteJs, /kind: 'site'/);
assert.match(siteJs, /pickActive/);
assert.match(siteJs, /if \(!pickActive\) return/);
assert.match(siteJs, /handleWorkTabPickerMessage/);
assert.match(siteJs, /toggle_picker|setPickActive/);
assert.doesNotMatch(bgJs, /chrome\.tabs\.reload\(existing\.id\).*artifactPreview/);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/officeTools.js'), 'utf8'), /html_canvas_updated/);
assert.doesNotMatch(htmlJs, /toggleSelection/);
assert.doesNotMatch(htmlJs, /mountArtboardKonva/);
assert.doesNotMatch(htmlJs, /from ['"]\\.\/artboardStage/);
assert.equal(fs.existsSync(path.join(root, 'src/preview/artboardKonva.js')), false);
assert.match(fs.readFileSync(path.join(root, 'src/agent/vnext/host/workspaceClient.js'), 'utf8'), /formatRpcError/);
assert.doesNotMatch(htmlJs, /platesToPrintHtml/);
assert.doesNotMatch(htmlJs, /propagateSlotSrc|openPrintSurface/);

assert.match(sheetJs, /setLocale/);
assert.match(sheetJs, /from ['"]\.\/officeLocale\.js['"]/);
assert.match(fs.readFileSync(path.join(root, 'src/preview/officeLocale.js'), 'utf8'), /pawwork_office_locale/);
assert.match(sheetJs, /installPawRibbonMenus/);
assert.doesNotMatch(html, /接受草稿/);
assert.match(sheetJs, /inPlace: true/);
assert.match(sheetJs, /insertCellImageAsync/);
assert.match(sheetJs, /ribbonType: 'classic'/);

const docsOrder = actionOrder(docs).filter((a) => a === 'save' || a === 'download');
assert.deepEqual(docsOrder, []);
const sheetActs = actionOrder(sheet);
assert.equal(sheetActs.includes('download'), false);

const htmlFileOrder = actionOrder(html);
assert.ok(htmlFileOrder.indexOf('save') < htmlFileOrder.indexOf('download'));
assert.equal(htmlFileOrder.includes('accept'), false);

assert.match(sheetJs, /retargetDrawingCommands/);
assert.doesNotMatch(htmlJs, /applyHtmlDraftAction/);

const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
const workLockJs = fs.readFileSync(path.join(root, 'src/preview/workLock.js'), 'utf8');
const officeKeysJs = fs.readFileSync(path.join(root, 'src/preview/officeShortcuts.js'), 'utf8');
const officeHelpJs = fs.readFileSync(path.join(root, 'src/preview/officeHelp.js'), 'utf8');

assert.equal(fs.existsSync(path.join(root, 'src/preview/officeShortcuts.js')), true);
assert.equal(fs.existsSync(path.join(root, 'src/preview/officeHelp.js')), true);
assert.equal(fs.existsSync(path.join(root, 'src/preview/officeHelp.css')), true);

assert.match(designHtml, /officeHelp\.css/);
assert.match(siteHtml, /officeHelp\.css/);
assert.match(sheet, /officeHelp\.css/);
assert.match(docs, /officeHelp\.css/);
assert.doesNotMatch(sheet, /host-bar\.css/);
assert.doesNotMatch(docs, /host-bar\.css/);

assert.match(designHtml, /data-act="help"/);
assert.match(siteHtml, /data-act="help"/);
assert.match(designHtml, /class="paw-help-btn"/);
assert.match(siteHtml, /class="paw-help-btn"/);

assert.match(designJs, /installOfficeShortcuts/);
assert.match(designJs, /mountOfficeHelp/);
assert.match(designJs, /zoomIn/);
assert.match(designJs, /pageNext/);
assert.doesNotMatch(designJs, /key === ['"]v['"]|key === ['"]t['"]|key === ['"]r['"]/);
assert.match(siteJs, /installOfficeShortcuts/);
assert.match(siteJs, /bindDocument/);
assert.match(siteJs, /__pawSiteBound/);
assert.match(siteJs, /op: 'remove'/);
assert.match(siteJs, /op: 'duplicate'/);
assert.match(siteJs, /style\.zoom/);
assert.doesNotMatch(siteJs, /view-source|Ctrl\+U|metaKey.*['"]u['"]/);
assert.match(sheetJs, /univerSheetZoom/);
assert.match(docsJs, /univerDocsZoom/);
assert.match(officeKeysJs, /classifyOfficeKey/);
assert.match(officeKeysJs, /isTypingTarget/);
assert.match(officeHelpJs, /rowsFor/);
assert.match(officeHelpJs, /designEngine/);
assert.match(workLockJs, /__pawCloseOfficeHelp/);
assert.match(workLockJs, /ev\.key !== 'Escape'/);
assert.doesNotMatch(workLockJs, /Escape[\s\S]{0,120}setLocked\(false\)/);
assert.match(workLockJs, /paw-work-lock-mist/);
assert.match(workLockJs, /paw-work-lock-frame/);
assert.doesNotMatch(workLockJs, /paw-work-lock-orbit|paw-work-lock-comet|syncOrbit|pathLength/);
assert.doesNotMatch(workLockJs, /HEAD_COUNT|DUST_COUNT|makeDust|paintSparks|<canvas/);
const workLockCss = fs.readFileSync(path.join(root, 'src/preview/workLock.css'), 'utf8');
assert.match(workLockCss, /paw-lock-pulse/);
assert.match(workLockCss, /paw-lock-mist/);
assert.doesNotMatch(
  workLockCss,
  /paw-lock-orbit|paw-work-lock-comet|paw-work-lock-edge|paw-lock-travel-x|paw-lock-travel-y/
);

const { classifyOfficeKey, stepZoom, isTypingTarget } = await import(
  pathToFileURL(path.join(root, 'src/preview/officeShortcuts.js')).href
);

function keyEvent(partial) {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: '',
    code: '',
    ...partial
  };
}

assert.equal(stepZoom(1, 1), 1.1);
assert.equal(stepZoom(1, -1), 0.9);
assert.equal(stepZoom(1.25, 0), 1);
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: '=', code: 'Equal' })), 'zoomIn');
assert.equal(classifyOfficeKey(keyEvent({ metaKey: true, key: '-', code: 'Minus' })), 'zoomOut');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: '0', code: 'Digit0' })), 'zoomFit');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: 's' })), 'save');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: 'z' })), 'undo');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, shiftKey: true, key: 'z' })), 'redo');
assert.equal(classifyOfficeKey(keyEvent({ key: 'Escape' })), 'escape');
assert.equal(classifyOfficeKey(keyEvent({ key: 'Delete' }), { typing: true }), null);
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: 's' }), { typing: true }), 'save');
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'slides' }), null);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'slides', present: true }), 'pageNext');
assert.equal(classifyOfficeKey(keyEvent({ key: 'PageDown' }), { surface: 'slides' }), 'pageNext');
assert.equal(classifyOfficeKey(keyEvent({ key: 'PageUp' }), { surface: 'slides' }), 'pagePrev');
assert.equal(classifyOfficeKey(keyEvent({ key: 'F5' }), { surface: 'slides' }), 'present');
assert.equal(classifyOfficeKey(keyEvent({ key: 'F5' }), { surface: 'design' }), null);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'design' }), null);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'site' }), 'nudge');
assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: false }), false);

const bubbleJs = fs.readFileSync(path.join(root, 'src/preview/officeSelBubble.js'), 'utf8');
assert.match(bubbleJs, /export function mountOfficeSelBubble/);
assert.match(bubbleJs, /navigator\.clipboard\.writeText/);
assert.match(bubbleJs, /execCommand\(['"]copy['"]\)/);
assert.match(bubbleJs, /已复制/);
assert.match(sheetJs, /mountOfficeSelBubble/);
assert.match(sheetJs, /paintOfficeSelBubble/);
assert.match(sheetJs, /sheet_tab_state/);
assert.match(designJs, /mountOfficeSelBubble/);
assert.match(designJs, /officeSelCopyLabel/);
assert.match(designJs, /html_tab_state/);
assert.match(siteJs, /mountOfficeSelBubble/);
assert.match(siteJs, /paintOfficeSelBubble/);
assert.match(siteJs, /html_tab_state/);

const { officeSelCopyLabel } = await import(
  pathToFileURL(path.join(root, 'src/preview/officeSelBubble.js')).href
);
assert.equal(officeSelCopyLabel({ a1: 'A1' }), 'A1');
assert.equal(officeSelCopyLabel({ a1: 'A1:B3' }), 'A1:B3');
assert.equal(officeSelCopyLabel({ text: 'Headline slot', nodeId: 'shape:1' }), 'Headline slot');
assert.equal(officeSelCopyLabel({ nodeId: 'n3' }), 'n3');

const sideJs = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const applyStart = sideJs.indexOf('function applySheetSelState');
const applyEnd = sideJs.indexOf('function sheetSelGroupsFrom');
assert.ok(applyStart >= 0 && applyEnd > applyStart);
const applyFn = sideJs.slice(applyStart, applyEnd);
assert.match(applyFn, /renderSheetSelRow\(/);
assert.match(applyFn, /nextFp === lastSheetSelFp/);
assert.match(applyFn, /pulseKeys/);
assert.doesNotMatch(applyFn, /hideSheetSelRow/);
assert.doesNotMatch(applyFn, /hideCanvasSelRow/);
assert.doesNotMatch(applyFn, /Pin lives on the host/);
assert.match(sideJs, /function sheetSelFingerprint/);
assert.match(sideJs, /function pulseSheetSelChip/);
assert.match(sideJs, /function renderSheetSelRow/);
assert.match(sideJs, /function renderCanvasSelRow/);
assert.match(sideJs, /chip\.className = 'sheet-sel-chip'/);
assert.match(sideJs, /sheet-sel-chip-x/);
assert.match(sideJs, /host\.replaceChildren\(\)/);
assert.doesNotMatch(sideJs, /chip\.className = 'sheet-sel-chip is-flash'/);

const sideCss = fs.readFileSync(path.join(root, 'src/sidepanel.css'), 'utf8');
const selCssStart = sideCss.indexOf('.sheet-sel-row {');
const selCssEnd = sideCss.indexOf('.canvas-sel-glyph');
assert.ok(selCssStart >= 0 && selCssEnd > selCssStart, 'sheet-sel CSS block');
const selCss = sideCss.slice(selCssStart, selCssEnd);
assert.doesNotMatch(selCss, /infinite/);
assert.match(selCss, /\.sheet-sel-chip\.is-flash/);
assert.match(selCss, /@keyframes pw-sheet-sel-flash/);
assert.match(selCss, /prefers-reduced-motion: reduce/);
assert.match(selCss, /\.sheet-sel-chip\.is-flash \{ animation: none/);
assert.doesNotMatch(sheetJs, /insertComposerMention/);
assert.doesNotMatch(designJs, /insertComposerMention/);
assert.doesNotMatch(siteJs, /insertComposerMention/);
assert.match(sideJs, /function restartComposerTypewriter/);
assert.match(sideJs, /I18N\[currentLang\]\?\.composerTypeLines/);
assert.doesNotMatch(sideJs, /renderWorldStrip/);

console.log('test_preview_host_bars: ok');
console.log('sheet-actions', actionOrder(sheet).join(','));
console.log('docs-actions', actionOrder(docs).join(','));
console.log('html-actions', actionOrder(html).join(','));
