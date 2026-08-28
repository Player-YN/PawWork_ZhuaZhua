/**
 * Theme render contract: role → native color name, CSS var map, ThemeManager palette.
 * tldraw 5.3.2 paints named styles via ThemeManager getColorValue, not --tl-color-*.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLE_TO_TLDRAW_COLOR,
  TLDRAW_COLOR_NAMES,
  TLDRAW_FONT_CSS_VARS,
  CJK_SANS_STACK,
  CJK_SERIF_STACK,
  tldrawColorForRole,
  themeNamedPalette,
  themeCssVarMap,
  themeTokenBag,
  buildTldrawColorPalettes,
  getTheme,
  THEME_IDS,
  PAGE_VARIANT_IDS,
  resolvePageVariant,
  resolveVariantTokens
} from '../../src/agent/vnext/sessionWorkspace/themeCatalog.js';
import { compileLayoutFrame } from '../../src/agent/vnext/sessionWorkspace/layoutCompile.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeEntry = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
const tldrawCss = fs.readFileSync(path.join(root, 'node_modules/tldraw/tldraw.css'), 'utf8');
const colorStyle = fs.readFileSync(
  path.join(root, 'node_modules/@tldraw/tlschema/dist-esm/styles/TLColorStyle.mjs'),
  'utf8'
);

assert.match(colorStyle, /"black"/);
assert.match(colorStyle, /"grey"/);
assert.match(colorStyle, /"red"/);
assert.match(tldrawCss, /--tl-font-sans/);
assert.match(tldrawCss, /--tl-font-serif/);
assert.doesNotMatch(tldrawCss, /--tl-color-black:/);
assert.match(runtimeEntry, /applyPawThemePalette/);
assert.match(runtimeEntry, /updateTheme/);
assert.match(runtimeEntry, /setCurrentTheme/);
assert.match(runtimeEntry, /--tl-font-sans --tl-font-serif/);

assert.equal(tldrawColorForRole('ink'), 'black');
assert.equal(tldrawColorForRole('muted'), 'grey');
assert.equal(tldrawColorForRole('paper'), 'white');
assert.equal(tldrawColorForRole('surface'), 'yellow');
assert.equal(tldrawColorForRole('accent'), 'red');
assert.equal(tldrawColorForRole('accent2'), 'orange');
assert.equal(tldrawColorForRole('rule'), 'light-red');
assert.equal(tldrawColorForRole('bg', 'dark'), 'violet');
assert.equal(tldrawColorForRole('ink', 'dark'), 'light-violet');
assert.ok(TLDRAW_COLOR_NAMES.includes(ROLE_TO_TLDRAW_COLOR.ink));
assert.equal(TLDRAW_FONT_CSS_VARS.sans, '--tl-font-sans');
assert.match(CJK_SANS_STACK, /Segoe UI/);
assert.match(CJK_SANS_STACK, /Microsoft YaHei/);
assert.match(CJK_SERIF_STACK, /Songti SC|SimSun/);

for (const themeId of THEME_IDS) {
  const theme = getTheme(themeId);
  const named = themeNamedPalette(themeId);
  const vars = themeCssVarMap(themeId);
  const bag = themeTokenBag(themeId);
  const palettes = buildTldrawColorPalettes(themeId);
  assert.ok(named, themeId);
  assert.equal(named.black, theme.ink);
  assert.equal(named.white, theme.paper);
  assert.equal(named.grey, theme.muted);
  assert.equal(named.red, theme.accent);
  assert.equal(named.orange, theme.accent2);
  assert.equal(named['light-red'], theme.rule);
  assert.equal(named.yellow, theme.surface);
  assert.ok(named.violet);
  assert.ok(named['light-violet']);
  assert.notEqual(named.violet, named.white);
  assert.equal(vars['--paw-palette-black'], theme.ink);
  assert.equal(vars['--tl-font-sans'], CJK_SANS_STACK);
  assert.equal(vars['--tl-font-serif'], CJK_SERIF_STACK);
  assert.equal(bag.black, theme.ink);
  assert.equal(palettes.light.black.solid, theme.ink);
  assert.equal(palettes.light.white.solid, theme.paper);
  assert.equal(palettes.light.red.solid, theme.accent);
  assert.equal(palettes.dark.black.solid, theme.ink);
}

const compiled = compileLayoutFrame(
  { id: 'slide-1', layoutId: 'title', variant: 'paper', slots: { title: '在选区上直接交付', kicker: 'Paw Work' } },
  { themeId: 'ink-rose' }
);
assert.equal(compiled.ok, true, compiled.error);
assert.equal(compiled.variant, 'paper');
const title = compiled.frame.nodes.find((n) => n.meta?.pawSlot === 'title');
const kicker = compiled.frame.nodes.find((n) => n.meta?.pawSlot === 'kicker');
const paper = compiled.frame.nodes.find((n) => n.meta?.pawRole === 'bg');
assert.equal(title.color, 'black');
assert.equal(kicker.color, 'grey');
assert.equal(paper.fill, 'white');
assert.equal(themeNamedPalette('ink-rose').black, getTheme('ink-rose').ink);

const darkCover = compileLayoutFrame(
  { id: 'slide-1', layoutId: 'title', slots: { title: '在选区上直接交付' } },
  { themeId: 'ink-rose' }
);
assert.equal(darkCover.ok, true, darkCover.error);
assert.equal(darkCover.variant, 'dark');
assert.equal(darkCover.frame.nodes.find((n) => n.meta?.pawRole === 'bg')?.fill, 'violet');
assert.equal(darkCover.frame.nodes.find((n) => n.meta?.pawSlot === 'title')?.color, 'light-violet');
assert.equal(darkCover.frame.nodes.find((n) => n.meta?.pawSlot === 'title')?.meta?.pawVariant, 'dark');

const unknown = resolvePageVariant('neon', 'title');
assert.equal(unknown.ok, false);
assert.match(unknown.error, /unknown variant/);
assert.deepEqual(PAGE_VARIANT_IDS, ['paper', 'surface', 'accent', 'dark']);

const mixedPaper = compileLayoutFrame(
  { id: 'a', layoutId: 'compare', variant: 'paper', slots: { title: '对照', left: 'A', right: 'B' } },
  { themeId: 'ink-rose' }
);
const mixedDark = compileLayoutFrame(
  { id: 'b', layoutId: 'closing', variant: 'dark', slots: { title: '开始' } },
  { themeId: 'ink-rose' }
);
assert.equal(mixedPaper.ok, true);
assert.equal(mixedDark.ok, true);
assert.equal(mixedPaper.frame.nodes.find((n) => n.meta?.pawRole === 'bg')?.fill, 'white');
assert.equal(mixedDark.frame.nodes.find((n) => n.meta?.pawRole === 'bg')?.fill, 'violet');
assert.equal(themeNamedPalette('ink-rose').violet, resolveVariantTokens(getTheme('ink-rose'), 'dark').bg);

const palettes = buildTldrawColorPalettes('ink-rose');
assert.equal(palettes.light.violet.solid, themeNamedPalette('ink-rose').violet);
assert.equal(palettes.light['light-violet'].solid, themeNamedPalette('ink-rose')['light-violet']);

console.log('test_theme_render: ok');
