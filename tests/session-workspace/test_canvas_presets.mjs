/**
 * HANDOFF_DESIGN_CANVAS Q2=B (user-decided 2026-08-27): component library —
 * speech bubbles / comic panels / title bars / color blocks as deterministic
 * geo compositions, plus a packaged Lucide icon subset. Presets expand into
 * plain createShape/setSlotSrc ops before selection checks and the live
 * editor; shapes and icons never route to image generation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  listCanvasPresets,
  compactPresetCatalog,
  expandPresetCommands,
  iconSvgDataUrl,
  isPresetCommand
} from '../../src/agent/vnext/sessionWorkspace/canvasPresets.js';
import { CANVAS_ICONS, CANVAS_ICON_IDS } from '../../src/agent/vnext/sessionWorkspace/canvasIconPack.js';
import { applyStoreCommands } from '../../src/agent/vnext/sessionWorkspace/canvasOps.js';

// ── Catalog shape ────────────────────────────────────────────────────────────
const catalog = listCanvasPresets();
assert.ok(catalog.length >= 20, `catalog too small: ${catalog.length}`);
const compact = compactPresetCatalog();
for (const id of [
  'speech-bubble',
  'thought-bubble',
  'shout-bubble',
  'comic-panel',
  'title-bar',
  'caption-strip',
  'color-block'
]) {
  assert.ok(compact.components.includes(id), `missing component ${id}`);
}
assert.ok(compact.icons && typeof compact.icons === 'object');
assert.ok(compact.icons.count >= 1500, `icon pack too small: ${compact.icons.count}`);
assert.ok(Array.isArray(compact.icons.common));
assert.ok(compact.icons.common.every((id) => id.startsWith('icon:')));
assert.ok(compact.icons.common.length <= 24, 'default catalog must not dump the icon pack');
assert.ok(CANVAS_ICON_IDS.length >= 1500, `icon pack too small: ${CANVAS_ICON_IDS.length}`);
for (const id of CANVAS_ICON_IDS) {
  assert.match(CANVAS_ICONS[id], /^<svg/, `icon ${id} is not svg markup`);
  // xmlns namespace URL is fine; actual remote refs (href/src/url()) are not.
  assert.doesNotMatch(
    CANVAS_ICONS[id],
    /(href|src)\s*=\s*["']https?:|url\(\s*["']?https?:/i,
    `icon ${id} must be inline, no remote refs`
  );
}

// ── Speech bubble expands to deterministic geo shapes (with rotated tail) ────
const bubble = expandPresetCommands([
  { op: 'createShape', preset: 'speech-bubble', text: '我会看！', x: 100, y: 100 }
]);
assert.equal(bubble.unknown.length, 0);
assert.ok(bubble.commands.length >= 2);
assert.ok(bubble.commands.every((c) => c.op === 'createShape'));
const bubbleStore = {};
const bubbleApplied = applyStoreCommands(bubbleStore, bubble.commands, { shell: 'design' });
assert.equal(bubbleApplied.ok, true, bubbleApplied.error);
const shapes = Object.values(bubbleStore).filter((r) => r.typeName === 'shape');
const oval = shapes.find((r) => r.props?.geo === 'oval');
assert.ok(oval, 'speech bubble oval missing');
assert.equal(oval.props.richText.content[0].content[0].text, '我会看！');
const tail = shapes.find((r) => r.props?.geo === 'triangle');
assert.ok(tail, 'speech bubble tail missing');
assert.ok(Math.abs(tail.rotation - Math.PI) < 0.01, `tail not rotated: ${tail.rotation}`);

// ── Comic panel: outline only, solid stroke, no fill ─────────────────────────
const panel = expandPresetCommands([{ preset: 'comic-panel', x: 0, y: 0, w: 400, h: 400 }]);
assert.equal(panel.unknown.length, 0);
const panelStore = {};
applyStoreCommands(panelStore, panel.commands, { shell: 'design' });
const panelRec = Object.values(panelStore).find((r) => r.props?.geo === 'rectangle');
assert.equal(panelRec.props.fill, 'none');
assert.equal(panelRec.props.dash, 'solid');

// ── Icons compile to image shape + inline svg asset ──────────────────────────
const star = expandPresetCommands([{ op: 'createShape', preset: 'icon:star', x: 10, y: 10 }]);
assert.equal(star.unknown.length, 0);
assert.equal(star.commands.length, 2);
assert.equal(star.commands[0].op, 'createShape');
assert.equal(star.commands[0].shapeType, 'image');
assert.equal(star.commands[1].op, 'setSlotSrc');
assert.match(star.commands[1].src, /^data:image\/svg\+xml/);
const starStore = {};
const starApplied = applyStoreCommands(starStore, star.commands, { shell: 'design' });
assert.equal(starApplied.ok, true, starApplied.error);
const asset = Object.values(starStore).find((r) => r.typeName === 'asset');
assert.ok(asset, 'icon asset missing');
assert.match(asset.props.src, /^data:image\/svg\+xml/);
assert.match(decodeURIComponent(asset.props.src), /<svg/);
// default tint applied — no unresolved currentColor left in the data url
assert.doesNotMatch(decodeURIComponent(asset.props.src), /currentColor/);
assert.equal(iconSvgDataUrl('icon:definitely-not-an-icon'), '');

// ── Pass-through + unknown reporting ─────────────────────────────────────────
const mixed = expandPresetCommands([
  { op: 'setSlotText', nodeId: 'shape:a', text: 'hi' },
  { preset: 'no-such-preset' }
]);
assert.equal(mixed.commands.length, 1);
assert.deepEqual(mixed.unknown, ['no-such-preset']);
assert.equal(isPresetCommand({ op: 'setSlotText', nodeId: 'shape:a' }), false);
assert.equal(isPresetCommand({ op: 'createShape', preset: 'title-bar' }), true);

// ── Deck tool wiring: expansion before selection check, catalog on read ──────
const officeJs = fs.readFileSync(
  new URL('../../src/agent/vnext/sessionWorkspace/officeTools.js', import.meta.url),
  'utf8'
);
assert.match(officeJs, /expandPresetCommands/);
assert.match(officeJs, /UNKNOWN_PRESET/);
assert.match(officeJs, /compactPresetCatalog\(\)/);

// Icon pack stays small enough for the CWS bundle (component budget).
const packBytes = fs.statSync(
  new URL('../../src/agent/vnext/sessionWorkspace/canvasIconPack.js', import.meta.url)
).size;
assert.ok(packBytes < 2.5 * 1024 * 1024, `icon pack too large: ${packBytes} bytes`);

console.log('test_canvas_presets: ok');
