import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { placeBlankSlide } from '../../src/agent/vnext/sessionWorkspace/slidesStage.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
const designHtml = fs.readFileSync(path.join(root, 'src/preview/design.html'), 'utf8');
const helpJs = fs.readFileSync(path.join(root, 'src/preview/officeHelp.js'), 'utf8');
const shortcutsJs = fs.readFileSync(path.join(root, 'src/preview/officeShortcuts.js'), 'utf8');
const workLockJs = fs.readFileSync(path.join(root, 'src/preview/workLock.js'), 'utf8');
const workTabPickerJs = fs.readFileSync(path.join(root, 'src/preview/workTabPicker.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');

const INTENTIONAL_NULL_COMPONENTS = [
  'LoadingScreen',
  'DebugPanel',
  'DebugMenu',
  'SharePanel',
  'CursorChatBubble',
  'PeopleMenu',
  'FollowingIndicator'
];
const AUTHORING_COMPONENTS = [
  'PageMenu',
  'NavigationPanel',
  'Minimap',
  'VideoToolbar',
  'Toolbar',
  'StylePanel',
  'ActionsMenu',
  'ContextMenu',
  'MainMenu',
  'ImageToolbar',
  'RichTextToolbar',
  'QuickActions',
  'HelperButtons',
  'ZoomMenu'
];
const AUTHORING_TOOLS = [
  'select',
  'hand',
  'draw',
  'eraser',
  'text',
  'geo',
  'arrow',
  'line',
  'frame',
  'note',
  'highlight',
  'laser',
  'asset'
];

assert.doesNotMatch(runtimeEntry, /maxPages\s*[:=]\s*1(?!\d)/);
assert.doesNotMatch(runtimeEntry.replace(/\/\*[\s\S]*?\*\//g, ''), /maxPages\s*[:=]/);
assert.doesNotMatch(runtimeEntry, /hideUi\s*[:=]\s*true/);
assert.doesNotMatch(runtimeEntry, /TLDRAW_OVERRIDES/);
assert.doesNotMatch(runtimeEntry.replace(/\/\*[\s\S]*?\*\//g, ''), /\boverrides\s*=/);
assert.doesNotMatch(runtimeEntry, /delete next\.laser/);
assert.doesNotMatch(runtimeEntry, /delete tools?\.(laser|asset|highlight|note|arrow|line)/);
assert.match(runtimeEntry, /maxFontsToLoadBeforeRender:\s*0/);
assert.match(runtimeEntry, /TLDRAW_AUTHORING_TOOLS/);

const componentsBlock = runtimeEntry.match(/const TLDRAW_COMPONENTS = \{([\s\S]*?)\};/);
assert.ok(componentsBlock, 'TLDRAW_COMPONENTS block');
const nulled = [...componentsBlock[1].matchAll(/(\w+):\s*null/g)].map((m) => m[1]);
assert.deepEqual(nulled.sort(), [...INTENTIONAL_NULL_COMPONENTS].sort());
for (const name of AUTHORING_COMPONENTS) {
  assert.doesNotMatch(runtimeEntry, new RegExp(`${name}:\\s*null`));
}

const toolsBlock = runtimeEntry.match(/const TLDRAW_AUTHORING_TOOLS = \[([\s\S]*?)\];/);
assert.ok(toolsBlock, 'TLDRAW_AUTHORING_TOOLS block');
for (const tool of AUTHORING_TOOLS) {
  assert.match(toolsBlock[1], new RegExp(`'${tool}'`));
}

assert.match(runtimeEntry, /editor\.setCurrentTool\(tool\)/);
assert.doesNotMatch(runtimeEntry, /ALLOWED_TOOLS|toolAllowlist|tools\s*=\s*\{/);
assert.match(runtimeEntry, /createBlankSlide\(/);
assert.match(runtimeEntry, /duplicateSlide\(/);
assert.match(runtimeEntry, /deleteSlide\(/);
assert.match(runtimeEntry, /reorderSlides\(/);
assert.match(runtimeEntry, /if \(!editor \|\| frames\.length <= 1\) return false/);
assert.doesNotMatch(runtimeEntry, /frames\.length\s*[>=]{1,2}\s*1\s*&&\s*return/);
assert.doesNotMatch(runtimeEntry, /if \(frames\.length\) return ''/);

let frames = [];
for (let i = 0; i < 8; i++) {
  const placed = placeBlankSlide(frames, frames.length - 1, { newId: `f${i}` });
  frames = placed.next;
}
assert.equal(frames.length, 8);
assert.equal(frames[0].w, 1920);
assert.equal(frames[0].h, 1080);
assert.ok(frames[7].x > frames[0].x);

assert.match(designJs, /textContent = '放映'/);
assert.match(designJs, /createBlankSlide/);
assert.match(designJs, /duplicateSlide/);
assert.match(designJs, /deleteSlide/);
assert.match(designJs, /reorderSlides/);
assert.match(designJs, /isFilmstripReorderKey/);
assert.match(designJs, /setSlideView/);
assert.match(designJs, /isPresent:\s*\(\)\s*=>\s*isPresent\(\)/);
assert.match(designJs, /handleWorkTabPickerMessage/);
assert.match(designJs, /setTool\?\.\('select'\)/);
assert.match(designJs, /setTool\?\.\('text'\)/);
assert.match(designJs, /setTool\?\.\('frame'\)/);
assert.match(designHtml, /id="filmstrip"/);
assert.match(designHtml, /id="toolStrip"/);
assert.doesNotMatch(designHtml, />Page 1</);
assert.doesNotMatch(designHtml, /fig-page-row/);
assert.match(designHtml, /body\[data-present="1"\] \.tlui-layout/);
assert.doesNotMatch(designHtml.replace(/body\[data-present="1"\][\s\S]*?\.tlui-layout[\s\S]*?\}/, ''), /\.tlui-(toolbar|layout|page-menu|navigation|minimap)/);

assert.match(helpJs, /Page 菜单可新建/);
assert.doesNotMatch(helpJs, /新建页 — 稍后/);
assert.doesNotMatch(helpJs, /不可用|暂不支持|unavailable/);
assert.match(helpJs, /未放映时方向键微移形状|arrows nudge shapes/);

assert.match(shortcutsJs, /opts\.present && key === 'ArrowRight'/);
assert.match(shortcutsJs, /key === 'PageDown'/);

assert.match(workLockJs, /execution-start/);
assert.match(workLockJs, /execution-end/);
assert.match(workLockJs, /paw_work_lock/);
assert.doesNotMatch(workLockJs, /Escape[\s\S]{0,120}setLocked\(false\)/);
assert.match(workTabPickerJs, /toggle_picker/);

assert.match(manifest, /wasm-unsafe-eval/);
assert.match(manifest, /script-src 'self' 'wasm-unsafe-eval'/);

const { classifyOfficeKey } = await import(
  pathToFileURL(path.join(root, 'src/preview/officeShortcuts.js')).href
);
function keyEvent(partial) {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: '', code: '', ...partial };
}
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'slides' }), null);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowLeft' }), { surface: 'slides' }), null);
assert.equal(
  classifyOfficeKey(keyEvent({ altKey: true, shiftKey: true, key: 'ArrowRight' }), { surface: 'slides' }),
  null
);
assert.equal(classifyOfficeKey(keyEvent({ key: 'ArrowRight' }), { surface: 'slides', present: true }), 'pageNext');
assert.equal(classifyOfficeKey(keyEvent({ key: 'PageDown' }), { surface: 'slides' }), 'pageNext');
assert.equal(classifyOfficeKey(keyEvent({ key: 'Delete' }), { surface: 'design' }), 'delete');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: 'z' }), { surface: 'design' }), 'undo');
assert.equal(classifyOfficeKey(keyEvent({ ctrlKey: true, key: 'd' }), { surface: 'design' }), 'duplicate');

console.log('test_design_sdk_permissions: ok');
