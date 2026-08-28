/**
 * pawCanvas → editable PPTX (PptxGenJS export-only).
 * Slide transitions plus a narrow stagger-fade / fade entrance preset.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { createScene } from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import {
  compileSceneToPawCanvas,
  exportPawCanvas,
  parsePawCanvas
} from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import {
  exportPawCanvasPptx,
  inspectPawCanvasPptx,
  PPTX_ANIMATION_SUPPORT,
  validatePawCanvasPptx
} from '../../src/agent/vnext/sessionWorkspace/pawCanvasPptxExport.js';
import { platesToPptxBytes } from '../../src/agent/vnext/sessionWorkspace/pptxExport.js';
import { exportPlates } from '../../src/agent/vnext/sessionWorkspace/artifactExport.js';
import { themeNamedPalette, resolveVariantTokens, getTheme } from '../../src/agent/vnext/sessionWorkspace/themeCatalog.js';
import { sortFramesForStrip } from '../../src/agent/vnext/sessionWorkspace/slidesLayout.js';
import { semanticDeckOutline, SEMANTIC_THEME_ID } from './harness/semanticDeckFixture.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'artifacts/pptx-e2e');
fs.mkdirSync(outDir, { recursive: true });

assert.equal(PPTX_ANIMATION_SUPPORT.objectEntrance, true);
assert.ok(PPTX_ANIMATION_SUPPORT.slideTransitions.includes('fade'));
assert.ok(PPTX_ANIMATION_SUPPORT.presets.includes('stagger-fade'));

const scene = createScene({ op: 'createScene', ...semanticDeckOutline() });
assert.equal(scene.ok, true, scene.error);
const doc = parsePawCanvas(scene.canvas);
assert.equal(doc.themeId, SEMANTIC_THEME_ID);

const store = doc.tldraw.document.store;
const frames = sortFramesForStrip(
  Object.values(store).filter((r) => r && r.type === 'frame' && (!r.parentId || r.parentId === 'page:page'))
);
assert.equal(frames.length, 7);
assert.ok(frames[0].meta?.pawTransition?.type === 'fade');
assert.ok(frames[0].meta?.pawAnimation?.preset === 'stagger-fade');

const exported = await exportPawCanvasPptx(doc);
assert.equal(exported.ok, true, exported.error);
assert.ok(exported.bytes.byteLength > 2000);
assert.equal(exported.bytes[0], 0x50);
assert.equal(exported.bytes[1], 0x4b);
assert.equal(exported.animation.objectEntrance, true);
assert.equal(exported.animations.length, 7);
exported.animations.forEach((a, i) => {
  assert.equal(a.preset, 'stagger-fade', `slide ${i + 1} preset`);
  assert.ok(a.targets.length >= 1, `slide ${i + 1} has animation targets`);
  const groups = new Set(a.targets.map((t) => t.group));
  assert.ok(groups.size <= 12, `slide ${i + 1} group cap ${groups.size}`);
});

const pptxPath = path.join(outDir, 'semantic-v2-7.pptx');
const animatedPath = path.join(outDir, 'semantic-v2-7-animated.pptx');
fs.writeFileSync(pptxPath, exported.bytes);
fs.writeFileSync(animatedPath, exported.bytes);

const check = validatePawCanvasPptx(exported.bytes, { minSlides: 7, minDrawables: 2, requireText: true });
assert.equal(check.ok, true, (check.errors || []).join('; '));
const info = check.info;
assert.equal(info.slideCount, 7);
assert.equal(info.cx, 12192000);
assert.equal(info.cy, 6858000);
assert.equal(info.hasAppExample, false);
assert.equal(info.hasPawPink, false);

const palette = themeNamedPalette(SEMANTIC_THEME_ID);
assert.ok(palette);
const darkBg = resolveVariantTokens(getTheme(SEMANTIC_THEME_ID), 'dark').bg.replace('#', '').toUpperCase();
const paperBg = resolveVariantTokens(getTheme(SEMANTIC_THEME_ID), 'paper').bg.replace('#', '').toUpperCase();
assert.notEqual(darkBg, 'F43F8C');
assert.ok(info.slides[0].bgHex.toUpperCase() === darkBg, `slide1 bg ${info.slides[0].bgHex} != ${darkBg}`);
assert.ok(info.slides[1].bgHex.toUpperCase() === paperBg, `slide2 bg ${info.slides[1].bgHex} != ${paperBg}`);

info.slides.forEach((s, i) => {
  assert.equal(s.hasBackground, true, `slide ${i + 1} background`);
  assert.ok(s.drawables >= 2, `slide ${i + 1} drawables ${s.drawables}`);
  assert.equal(s.zeroRoot, false, `slide ${i + 1} 0x0 root`);
  assert.ok(s.textCount >= 1, `slide ${i + 1} text`);
  assert.equal(s.transition.type, 'fade');
  assert.equal(s.transition.present, true);
  assert.equal(s.animation.present, true, `slide ${i + 1} p:timing`);
  assert.equal(s.animation.fade, true, `slide ${i + 1} fade entrance`);
  assert.ok(s.animation.afterEffect, `slide ${i + 1} afterEffect`);
  const idSet = new Set(s.cnvPrIds);
  s.animation.targets.forEach((spid) => {
    assert.ok(idSet.has(spid), `slide ${i + 1} spid ${spid} missing from cNvPr`);
  });
  const report = exported.animations[i];
  const roles = report.targets.map((t) => t.role);
  assert.ok(
    roles.includes('title') || roles.includes('kicker'),
    `slide ${i + 1} title/kicker first-class target`
  );
  assert.ok(!report.targets.some((t) => t.role === 'bg' || t.role === 'paper' || t.role === 'decoration' || t.slot === '_rule' || t.slot === '_paper'));
  const first = report.targets[0];
  assert.ok(first.role === 'kicker' || first.role === 'title', `slide ${i + 1} first target ${first.role}`);
  const groups = new Set(report.targets.map((t) => t.group));
  assert.ok(groups.size <= 12, `slide ${i + 1} group cap ${groups.size}`);
});

const files = unzipSync(exported.bytes);
const slide1 = strFromU8(files['ppt/slides/slide1.xml']);
const ctnIds = [...slide1.matchAll(/<p:cTn\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]);
assert.ok(ctnIds.length > 4, 'timing tree has time nodes');
assert.equal(new Set(ctnIds).size, ctnIds.length, `duplicate cTn ids: ${ctnIds.join(',')}`);
assert.match(strFromU8(files['ppt/presentation.xml']), /<\/p:sldMasterIdLst><p:notesMasterIdLst>|<p:sldSz/);
assert.match(slide1, /<p:sp\b/);
assert.match(slide1, /<a:t>/);
assert.doesNotMatch(slide1, /app\.example/);
assert.doesNotMatch(slide1, /F43F8C/i);
assert.ok(info.slides.some((s) => s.pics >= 1), 'semantic deck embeds at least one image/icon');
assert.ok(info.media.length >= 1, `media ${info.media.join(',')}`);

const viaCanvas = await exportPawCanvas(doc, 'pptx');
assert.equal(viaCanvas.ok, true, viaCanvas.error);
assert.equal(viaCanvas.inspect.slideCount, 7);

for (const type of ['push', 'wipe', 'none']) {
  const one = createScene({
    op: 'createScene',
    kind: 'deck',
    title: `Motion ${type}`,
    themeId: 'cobalt',
    frames: [
      {
        id: 's1',
        layoutId: 'title',
        variant: 'paper',
        transition: { type, durationMs: 280 },
        animation: { preset: 'none' },
        slots: { title: '过渡', subtitle: type }
      }
    ]
  });
  assert.equal(one.ok, true, one.error);
  const out = await exportPawCanvasPptx(one.canvas);
  assert.equal(out.ok, true, out.error);
  const inspected = inspectPawCanvasPptx(out.bytes).slides[0];
  const got = inspected.transition;
  if (type === 'none') assert.equal(got.present, false);
  else assert.equal(got.type, type);
  assert.equal(inspected.animation.present, false, `${type} + animation none writes no p:timing`);
  fs.writeFileSync(path.join(outDir, `transition-${type}.pptx`), out.bytes);
}

const fadeTogether = createScene({
  op: 'createScene',
  kind: 'deck',
  title: 'Fade together',
  themeId: 'cobalt',
  frames: [
    {
      id: 's1',
      layoutId: 'title',
      variant: 'paper',
      transition: { type: 'fade', durationMs: 280 },
      animation: { preset: 'fade' },
      slots: { title: '同时进入', subtitle: 'fade' }
    }
  ]
});
assert.equal(fadeTogether.ok, true, fadeTogether.error);
const fadeOut = await exportPawCanvasPptx(fadeTogether.canvas);
assert.equal(fadeOut.ok, true, fadeOut.error);
const fadeSlide = inspectPawCanvasPptx(fadeOut.bytes).slides[0];
assert.equal(fadeSlide.animation.present, true);
assert.equal(fadeSlide.animation.fade, true);
assert.equal(fadeSlide.animation.afterEffect, false);
assert.equal(fadeSlide.animation.withEffect, true);
assert.equal(fadeOut.animations[0].preset, 'fade');

const brokenPath = 'C:\\Users\\yyy\\Downloads\\Paw_Work_功能介绍.pptx';
if (fs.existsSync(brokenPath)) {
  const broken = inspectPawCanvasPptx(fs.readFileSync(brokenPath));
  const report = {
    slideCount: broken.slideCount,
    cx: broken.cx,
    cy: broken.cy,
    wide16x9: broken.wide16x9,
    zeroRoots: broken.slides.filter((s) => s.zeroRoot).length,
    drawables: broken.slides.map((s) => s.drawables)
  };
  fs.writeFileSync(path.join(outDir, 'broken-pptx-inspect.json'), JSON.stringify(report, null, 2));
  assert.equal(broken.wide16x9, false, 'regression: old deck is not true 16:9');
}

const drawDoc = compileSceneToPawCanvas({
  kind: 'deck',
  title: 'Raw draw',
  frames: [{ id: 's1', name: 'Draw', nodes: [{ id: 't1', type: 'text', text: 'ok' }], size: { w: 1920, h: 1080 } }]
});
const drawStore = drawDoc.tldraw.document.store;
drawStore['shape:draw1'] = {
  id: 'shape:draw1',
  typeName: 'shape',
  type: 'draw',
  x: 80,
  y: 80,
  parentId: 'shape:s1',
  props: { w: 400, h: 300 },
  meta: {}
};
const denied = await exportPawCanvasPptx(drawDoc, { requireHost: false });
assert.equal(denied.ok, false);
assert.equal(denied.code, 'UNSUPPORTED_PPTX_SHAPES');

const needTab = await exportPawCanvasPptx(drawDoc);
assert.equal(needTab.ok, false);
assert.equal(needTab.code, 'NEED_TAB');

const fallback = await exportPawCanvasPptx(drawDoc, {
  renderShape: async () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
      0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4,
      0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    return png;
  }
});
assert.equal(fallback.ok, true, fallback.error);

const htmlPlates = exportPlates([{ html: '<h1>路演</h1><p>HTML plate</p>' }], 'pptx', { title: 'HTML deck' });
assert.equal(htmlPlates.filename.endsWith('.pptx'), true);
const htmlFiles = unzipSync(htmlPlates.bytes);
assert.match(strFromU8(htmlFiles['ppt/slides/slide1.xml'] || new Uint8Array()), /路演/);
const legacy = platesToPptxBytes([{ html: '<h1>Keep</h1><p>legacy</p>' }], { title: 'Legacy' });
assert.equal(legacy[0], 0x50);
assert.match(Buffer.from(legacy).toString('utf8'), /ppt\/slides\/slide1\.xml/);

const openXml = runOpenXmlValidator(animatedPath);
const pythonRead = runPythonPptxRead(animatedPath, info);
const comOpen = runPresentationCom(animatedPath, path.join(outDir, 'semantic-v2-7-animated-ppt-copy.pptx'));
if (openXml.available && openXml.errors !== 0) {
  assert.fail(`OpenXmlValidator errors: ${openXml.log}`);
}

const evidence = {
  package: { name: 'pptxgenjs', version: '4.0.1', license: 'MIT' },
  animation: PPTX_ANIMATION_SUPPORT,
  sources: [
    'ISO/IEC 29500-1 §19.5 CT_SlideTiming / animEffect (Microsoft Learn Timing, AnimateEffect)',
    'ECMA-376 p:animEffect transition in|out filter string (docx4java PresentationML/animEffect.html)',
    'ST_TLTimeNodeType afterEffect|withEffect|mainSeq|tmRoot',
    'PowerPoint COM AddEffect msoAnimEffectFade=10 after-previous → artifacts/pptx-e2e/ppt-com-fade-reference.pptx'
  ],
  mapping: {
    native: ['text', 'geo', 'image', 'line', 'arrow', 'note', 'nested-frame'],
    fallback: 'per-shape PNG when renderShape/renderFrame provided',
    fail: 'NEED_TAB / UNSUPPORTED_PPTX_SHAPES when unsupported coverage is material'
  },
  slides: info.slides.map((s, i) => ({
    i: i + 1,
    name: s.slideName,
    bg: s.bgHex,
    drawables: s.drawables,
    texts: s.textCount,
    pics: s.pics,
    transition: s.transition.type,
    animation: {
      preset: exported.animations[i].preset,
      targets: exported.animations[i].targets,
      timing: s.animation
    }
  })),
  media: info.media,
  validators: { openXml, pythonRead, comOpen },
  path: animatedPath
};
fs.writeFileSync(path.join(outDir, 'export-evidence.json'), JSON.stringify(evidence, null, 2));

const soffice = findSoffice();
if (soffice) {
  const profile = path.join(outDir, 'lo-profile');
  fs.mkdirSync(profile, { recursive: true });
  const conv = spawnSync(
    soffice,
    [
      '--headless',
      '--norestore',
      // Single-dash -env: is the only form LibreOffice accepts; --env: is ignored,
      // which made every conversion contend on the default user profile lock.
      `-env:UserInstallation=file:///${profile.replace(/\\/g, '/')}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      pptxPath
    ],
    { encoding: 'utf8', timeout: 60000, windowsHide: true }
  );
  fs.writeFileSync(
    path.join(outDir, 'libreoffice-log.txt'),
    `${conv.status}\n${conv.stdout || ''}\n${conv.stderr || ''}`
  );
} else {
  fs.writeFileSync(
    path.join(outDir, 'libreoffice-log.txt'),
    'LibreOffice not found. Evidence is OOXML/python-independent inspect only.\n'
  );
}

function runOpenXmlValidator(pptxFile) {
  const proj = path.join(root, 'tests/session-workspace/harness/PptxOpenXmlValidate/PptxOpenXmlValidate.csproj');
  if (!fs.existsSync(proj)) return { available: false, errors: null, log: 'helper missing' };
  const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (probe.status !== 0) return { available: false, errors: null, log: 'dotnet not available' };
  const run = spawnSync('dotnet', ['run', '--project', proj, '--', pptxFile], {
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true
  });
  const log = `${run.stdout || ''}\n${run.stderr || ''}`;
  fs.writeFileSync(path.join(outDir, 'openxml-validator.txt'), log);
  const count = Number(/ERROR_COUNT=(\d+)/.exec(log)?.[1]);
  return {
    available: true,
    status: run.status,
    errors: Number.isFinite(count) ? count : run.status === 0 ? 0 : -1,
    log: log.slice(0, 4000)
  };
}

function runPythonPptxRead(pptxFile, inspectInfo) {
  const script = [
    'import json, sys, zipfile',
    'from xml.etree import ElementTree as ET',
    'path = sys.argv[1]',
    'try:',
    '    from pptx import Presentation',
    '    prs = Presentation(path)',
    '    slides = len(prs.slides)',
    '    shapes = [len(s.shapes) for s in prs.slides]',
    '    texts = [[sh.text_frame.text if sh.has_text_frame else "" for sh in s.shapes] for s in prs.slides]',
    '    backend = "python-pptx"',
    'except Exception as e:',
    '    z = zipfile.ZipFile(path)',
    '    names = z.namelist()',
    '    slides = len([n for n in names if n.startswith("ppt/slides/slide") and n.endswith(".xml")])',
    '    shapes = []',
    '    texts = []',
    '    for i in range(1, slides + 1):',
    '        xml = z.read(f"ppt/slides/slide{i}.xml")',
    '        root = ET.fromstring(xml)',
    '        ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main", "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}',
    '        ts = [t.text or "" for t in root.findall(".//a:t", ns)]',
    '        texts.append(ts)',
    '        shapes.append(len(root.findall(".//p:sp", ns)) + len(root.findall(".//p:pic", ns)))',
    '    backend = "zipfile+xml"',
    'print(json.dumps({"ok": True, "backend": backend, "slides": slides, "shapes": shapes, "texts": texts}))'
  ].join('\n');
  const py = spawnSync('python', ['-c', script, pptxFile], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  let parsed = null;
  try {
    parsed = JSON.parse((py.stdout || '').trim().split('\n').pop() || '{}');
  } catch {
    parsed = { ok: false, error: py.stderr || py.stdout };
  }
  if (parsed?.ok) {
    assert.equal(parsed.slides, inspectInfo.slideCount);
    parsed.texts?.forEach((slideTexts, i) => {
      const joined = (slideTexts || []).join(' ');
      inspectInfo.slides[i].texts.forEach((t) => {
        if (t && t.trim()) assert.ok(joined.includes(t), `python/zip missing text ${t}`);
      });
    });
  }
  return { available: py.status === 0 && parsed?.ok, ...parsed, stderr: py.stderr };
}

function runPresentationCom(pptxFile, copyPath) {
  const ps = `
$ErrorActionPreference = 'Stop'
$path = ${JSON.stringify(pptxFile)}
$copy = ${JSON.stringify(copyPath)}
$app = $null
$pres = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  try { $app.DisplayAlerts = 1 } catch {}
  $pres = $app.Presentations.Open($path, $true, $false, $false)
  if (Test-Path $copy) { Remove-Item -Force $copy }
  $pres.SaveCopyAs($copy)
  Write-Output "ok slides=$($pres.Slides.Count)"
} catch {
  Write-Output "error $($_.Exception.Message)"
  exit 1
} finally {
  if ($pres) { try { $pres.Close() } catch {} }
  if ($app) { try { $app.Quit() } catch {} }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
`;
  const run = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  const log = `${run.stdout || ''}\n${run.stderr || ''}`;
  fs.writeFileSync(path.join(outDir, 'powerpoint-com.txt'), log);
  return {
    available: /ok slides=/.test(log),
    status: run.status,
    log: log.slice(0, 2000),
    copy: fs.existsSync(copyPath) ? copyPath : ''
  };
}

function findSoffice() {
  // Filesystem check first: `soffice --version` spawns a GUI-subsystem process on
  // Windows (flashes a window, touches the default profile lock), so only probe by
  // name when no standard install path exists.
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) return found;
  const names = ['soffice', 'soffice.exe', 'libreoffice'];
  for (const n of names) {
    const hit = spawnSync(n, ['--version'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    if (hit.status === 0) return n;
  }
  return '';
}

console.log('test_paw_canvas_pptx_export: ok', pptxPath);
