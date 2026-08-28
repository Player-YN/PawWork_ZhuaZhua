/**
 * Wave 8 — right-rail 交付物, script-level preview, plate seeder, real PPTX.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifyArtifactSelection,
  seedPlatesFromArtifacts
} from '../../../src/agent/vnext/sessionWorkspace/artifactStage.js';
import { platesToPptxBytes as pptxFromPlates } from '../../../src/agent/vnext/sessionWorkspace/pptxExport.js';
import { exportPlates } from '../../../src/agent/vnext/sessionWorkspace/artifactExport.js';
import { validateArtifactBytes } from '../../../src/agent/vnext/sessionWorkspace/artifactValidate.js';

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const html = fs.readFileSync(path.join(root, 'src/sidepanel.html'), 'utf8');
const side = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const bg = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.js'), 'utf8');

record(
  'right-artifact-rail-markup',
  /id="artifactRail"/.test(html) &&
    /artifact-rail-scrim/.test(html) &&
    /id="artifactShelfList"/.test(html) &&
    /id="artifactRailNav"/.test(html) &&
    /id="artifactEdgeFab"/.test(html) &&
    /id="artifactRailNew"/.test(html) &&
    /data-blank-kind="design"/.test(html) &&
    /data-blank-kind="slides"/.test(html) &&
    /data-blank-kind="sheet"/.test(html) &&
    /data-blank-kind="doc"/.test(html) &&
    /data-blank-kind="site"/.test(html) &&
    /id="artifactRailZipSelected"/.test(html) &&
    !/id="artifactRailPreviewSelected"/.test(html) &&
    !/预览所选/.test(html) &&
    /id="artifactRail"[^>]*\binert\b/.test(html) &&
    !/id="sessionArtifactMenu"/.test(html) &&
    !/session-artifact-menu/.test(html),
  ''
);
record(
  'artifact-rail-blurs-before-aria-hidden',
  /function restoreFocusOutside/.test(side) &&
    /function setAriaRegionOpen/.test(side) &&
    /setAriaRegionOpen\(rail, next, btn \|\| edgeFab\)/.test(side),
  ''
);

record(
  'preview-selected-not-window-open',
  /open_artifact_preview/.test(side) &&
    /function previewSessionArtifact/.test(side) &&
    /function createBlankArtifactAndOpen/.test(side) &&
    /createBlankArtifact/.test(side) &&
    !/window\.open\s*\(/.test(side) &&
    /chrome\.tabs\.create/.test(bg) &&
    /artifactPreview\.html/.test(bg),
  ''
);

const previewHtml = fs.readFileSync(path.join(root, 'src/preview/artifactPreview.html'), 'utf8');
record(
  'preview-page-is-generic-viewer',
  // Intentional collapse (HANDOFF_DESIGN_CANVAS 特意为之 #19): the preview page
  // is a generic viewer (HTML/PDF page, raster image, opaque file card) — not
  // the old plate/export studio. Export lives on office canvases.
  !/seedPlatesFromArtifacts/.test(preview) &&
    !/exportPlates/.test(preview) &&
    !/data-export="/.test(previewHtml) &&
    />保存</.test(previewHtml) &&
    !/保存网页/.test(previewHtml) &&
    /previewViewForItem/.test(preview) &&
    /renderImage/.test(preview) &&
    /id="imageWrap"/.test(previewHtml),
  ''
);
record(
  'save-is-html-view-only-write-through',
  // Save writes through workspace RPC and only for the HTML view; image/pdf/
  // binary views download original bytes (never lastHtml into non-HTML bytes).
  /updateArtifact/.test(preview) &&
    /canSave/.test(preview) &&
    !/artifact_written/.test(preview) &&
    /pulseArtifactBadge/.test(side),
  ''
);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const imgA = { artifactId: 'a1', name: 'one.png', mimeType: 'image/png', bytes: PNG };
const imgB = { artifactId: 'a2', name: 'two.png', mimeType: 'image/png', bytes: PNG };
const gallery = classifyArtifactSelection([imgA, imgB]);
record('all-images-is-gallery', gallery.mode === 'gallery', gallery.mode);
const gallerySeed = seedPlatesFromArtifacts([imgA, imgB]);
record(
  'gallery-seed-does-not-save',
  gallerySeed.mode === 'gallery' &&
    gallerySeed.plates.length === 2 &&
    gallerySeed.plates.every((p) => p.kind === 'image') &&
    !('saved' in gallerySeed) &&
    !gallerySeed.artifactId,
  `n=${gallerySeed.plates.length}`
);

const csv = {
  artifactId: 'c1',
  name: 'rows.csv',
  mimeType: 'text/csv',
  text: 'h1,h2\na,b',
  bytes: new TextEncoder().encode('h1,h2\na,b')
};
const unmarked = {
  artifactId: 'h1',
  name: 'plain.html',
  mimeType: 'text/html',
  text: '<html><body><h1>Loose</h1><p>Hi</p></body></html>'
};
const mixed = seedPlatesFromArtifacts([imgA, csv, unmarked]);
record(
  'mixed-emits-sibling-plates',
  mixed.mode === 'plates' &&
    mixed.plates.some((p) => p.kind === 'image') &&
    mixed.plates.some((p) => p.kind === 'table' && Array.isArray(p.table)) &&
    mixed.plates.some((p) => p.kind === 'html' && /Loose|Hi/.test(p.html || p.title || '')),
  mixed.plates.map((p) => p.kind).join(',')
);
const quoted = seedPlatesFromArtifacts([
  {
    artifactId: 'qcsv',
    name: 'product_specifications.csv',
    mimeType: 'text/csv',
    text: 'name,size\n"Mats, Pumpkin","2 Pcs (Set of 2)"\n'
  }
]);
const qt = quoted.plates.find((p) => p.kind === 'table');
const tsv = seedPlatesFromArtifacts([
  {
    artifactId: 'tsv1',
    name: 'rows.tsv',
    mimeType: 'text/tab-separated-values',
    text: 'h1\th2\na\tb'
  }
]);
record(
  'tsv-seeds-table',
  tsv.plates[0]?.kind === 'table' && tsv.plates[0].table?.[1]?.[0] === 'a',
  JSON.stringify(tsv.plates[0]?.table || [])
);
const mdReport = seedPlatesFromArtifacts([
  {
    artifactId: 'md1',
    name: 'week.md',
    mimeType: 'text/markdown',
    text: '## Hello\n\n1. one\n\n- [x] done\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n'
  }
]);
record(
  'preview-md-uses-office-markdown',
  /<ol>/.test(mdReport.plates[0]?.html || '') &&
    /md-task/.test(mdReport.plates[0]?.html || '') &&
    /md-table/.test(mdReport.plates[0]?.html || ''),
  (mdReport.plates[0]?.html || '').slice(0, 120)
);
record(
  'csv-quoted-commas-stay-in-cell',
  qt?.table?.[1]?.[0] === 'Mats, Pumpkin' &&
    qt?.table?.[1]?.[1] === '2 Pcs (Set of 2)' &&
    /class="pw-table"/.test(qt.html || '') &&
    /<thead>/.test(qt.html || ''),
  JSON.stringify(qt?.table?.[1] || [])
);

const marked = {
  artifactId: 'm1',
  name: 'report.html',
  mimeType: 'text/html',
  text: `<html data-pawwork-preview="blocks"><head><meta name="pawwork-preview" content="blocks"/></head>
<body>
<section data-paw-block data-paw-block-id="hero"><h1>Hero</h1></section>
<section data-paw-block data-paw-block-id="about"><h2>About</h2><p>x</p></section>
</body></html>`
};
const split = seedPlatesFromArtifacts([marked, imgA]);
record(
  'marked-html-splits-then-image-plate',
  split.mode === 'plates' &&
    split.plates.filter((p) => p.kind === 'html').length >= 2 &&
    split.plates.some((p) => p.kind === 'image') &&
    split.plates.some((p) => p.id === 'hero' || /Hero/.test(p.html || '')),
  split.plates.map((p) => `${p.kind}:${p.id}`).join(',')
);

record(
  'seeder-is-not-an-agent',
  !/callModel|ToolLoopAgent|sendMessage/.test(
    fs.readFileSync(path.join(root, 'src/agent/vnext/sessionWorkspace/artifactStage.js'), 'utf8')
  ),
  ''
);

const pptx = pptxFromPlates(
  [
    { kind: 'html', title: 'Hello', html: '<h1>Hello</h1>', text: 'Body copy' },
    { kind: 'html', html: '<p>Paragraph</p>', text: 'Paragraph' },
    { kind: 'image', title: 'Pic', imageBytes: PNG, imageMime: 'image/png' },
    { kind: 'table', title: 'Grid', table: [['A', 'B'], ['1', '2']] }
  ],
  { title: 'Deck' }
);
const check = validateArtifactBytes('deck.pptx', pptx);
record(
  'pptx-is-office-container',
  check.valid === true &&
    pptx[0] === 0x50 &&
    pptx[1] === 0x4b &&
    !new TextDecoder().decode(pptx.slice(0, 80)).includes('<html'),
  check.error || check.mimeType
);

const mixedPlates = mixed.plates;
for (const fmt of ['pptx', 'markdown', 'csv', 'html', 'docx', 'pdf']) {
  const out = exportPlates(mixedPlates, fmt, { title: 'Mix' });
  const dec = new TextDecoder();
  const head = dec.decode(out.bytes.slice(0, Math.min(80, out.bytes.length)));
  let ok = out.bytes.byteLength > 20 && out.filename;
  if (fmt === 'pptx') ok = ok && validateArtifactBytes(out.filename, out.bytes).valid;
  if (fmt === 'docx') {
    const v = validateArtifactBytes('mix.docx', out.bytes);
    ok = ok && v.valid && out.filename.endsWith('.docx');
  }
  if (fmt === 'html') ok = ok && /data-pawwork-preview/.test(dec.decode(out.bytes));
  if (fmt === 'pdf') {
    const blob = dec.decode(out.bytes);
    ok =
      ok &&
      /paw-print/.test(blob) &&
      !/id="bar"/.test(blob) &&
      !/class="pw-handle"/.test(blob) &&
      !/data-act="/.test(blob);
  }
  if (fmt === 'markdown') {
    ok = ok && (out.filename.endsWith('.zip') || out.filename.endsWith('.md'));
    const blob = dec.decode(out.bytes);
    ok = ok && (/^# /m.test(blob) || out.filename.endsWith('.zip'));
  }
  if (fmt === 'csv') {
    ok = ok && (out.filename.endsWith('.zip') || out.filename.endsWith('.csv'));
    ok = ok && (head.includes('order,kind') || out.filename.endsWith('.zip'));
  }
  record(`export-${fmt}-always-succeeds`, ok, `${out.filename} ${out.bytes.length}b`);
}

const imgMd = exportPlates(
  [{ kind: 'image', title: 'pic', imageBytes: PNG, imageMime: 'image/png' }],
  'markdown',
  { title: 'Pic' }
);
record(
  'image-to-markdown-is-zip-or-linked',
  imgMd.filename.endsWith('.zip') && imgMd.bytes[0] === 0x50,
  imgMd.filename
);
const tablePptx = exportPlates(
  [{ kind: 'table', title: 'Grid', table: [['A', 'B'], ['1', '2']] }],
  'pptx',
  { title: 'T' }
);
record(
  'table-to-pptx-is-office',
  validateArtifactBytes('t.pptx', tablePptx.bytes).valid,
  ''
);

console.log(`\nwave8 summary: breaches=${failed}`);
if (failed > 0) process.exitCode = 1;
