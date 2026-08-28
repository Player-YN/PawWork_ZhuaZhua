/**
 * Real internet office jobs: freeze public captures, produce artifacts
 * through shipped sheet/HTML apply, then one-field fine-tune.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import {
  applyCommandsToWorkbookData,
  inspectSheetSelection,
  sheetsToWorkbookData
} from '../../src/agent/vnext/sessionWorkspace/sheetApply.js';
import {
  applyHtmlCommands,
  inspectHtml
} from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import { extractWorkbookSnapshot, injectWorkbookSnapshot } from '../../src/preview/sheetModel.js';
import { fillTemplate as fillReport } from '../../src/agent/vnext/skills/html-preview/scripts/fillTemplate.js';
import { REPORT_HTML } from '../../src/agent/vnext/skills/html-preview/templates/reportHtml.js';
import { detectHtmlKind, platesToPrintHtml } from '../../src/agent/vnext/sessionWorkspace/printHtml.js';
import { parseMarkedHtml } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/session-workspace/fixtures/internet-office/sources.json'), 'utf8')
);

const HERO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect fill="#1e293b" width="640" height="360"/><rect fill="#38bdf8" x="0" y="0" width="12" height="360"/><text x="40" y="180" fill="#e2e8f0" font-size="28" font-family="system-ui,sans-serif">Starship · Flight 13</text><text x="40" y="220" fill="#94a3b8" font-size="16" font-family="system-ui,sans-serif">Starbase · Super Heavy</text></svg>'
  );

function xlsxFromSheets(sheets, name) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows || []);
    XLSX.utils.book_append_sheet(wb, ws, String(sh.name || 'Sheet1').slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const data = sheetsToWorkbookData(sheets, name, { id: 'internet-office-sheet' });
  return injectWorkbookSnapshot(new Uint8Array(buf), data);
}

function buildSheet() {
  const src = sources.sheet;
  const rows = [src.headers, ...src.rows];
  const seed = sheetsToWorkbookData([{ name: src.sheetName, rows: [] }], 'fortune-500.xlsx', {
    id: 'internet-office-sheet'
  });
  const built = applyCommandsToWorkbookData(
    seed,
    [{ op: 'setValues2d', sheet: src.sheetName, a1: 'A1', values: rows }],
    { agentWrite: false }
  );
  assert.equal(built.ok !== false, true, built.error);
  const bytes = xlsxFromSheets(built.sheets, 'fortune-500.xlsx');
  const snap = extractWorkbookSnapshot(bytes);
  const text = JSON.stringify(snap);
  for (const s of src.distinctive) assert.match(text, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const inspect = inspectSheetSelection(snap, 'A1:D3', src.sheetName);
  assert.equal(inspect.values[1][1], 'Amazon');
  assert.equal(inspect.values[2][1], 'Walmart');
  return { bytes, data: snap, sheets: built.sheets };
}

function fineTuneSheet(data) {
  const src = sources.sheet;
  const next = applyCommandsToWorkbookData(
    data,
    [{ op: 'setRange', sheet: src.sheetName, a1: 'D2', value: 720.1 }],
    { agentWrite: false }
  );
  assert.equal(next.ok !== false, true, next.error);
  const inspect = inspectSheetSelection(next.data, 'A1:D3', src.sheetName);
  assert.equal(inspect.values[1][3], 720.1);
  assert.equal(inspect.values[2][1], 'Walmart');
  assert.equal(inspect.values[2][3], 713);
  assert.equal(inspect.values[1][1], 'Amazon');
  return next;
}

function buildDocument() {
  const src = sources.document;
  const filled = fillReport(REPORT_HTML, {
    title: src.title,
    lead: src.lead,
    aboutHeading: src.aboutHeading,
    about: src.about,
    skillsHeading: src.skillsHeading,
    skills: src.skills,
    principlesHeading: src.principlesHeading,
    principles: src.principles
  });
  const created = applyHtmlCommands('', [{ op: 'createDocument', html: filled, kind: 'document' }], {
    draft: false
  });
  assert.equal(created.ok, true, created.error);
  for (const s of src.distinctive) assert.match(created.html, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(created.html, /data-paw-slot="title"/);
  assert.match(created.html, /data-paw-kind="document"/);
  const ins = inspectHtml(created.html, { plateId: 'hero', slotId: 'lead' });
  assert.match(String(ins.slot?.text || ins.slot?.html || ''), /measurable goals/);
  assert.equal(detectHtmlKind(created.html), 'document');
  return created;
}

function fineTuneDocument(html) {
  const src = sources.document;
  const next = applyHtmlCommands(
    html,
    [{ op: 'setSlotText', plateId: 'hero', slotId: 'title', text: 'OKR briefing · Q3' }],
    { draft: false }
  );
  assert.equal(next.ok, true, next.error);
  assert.match(next.html, /OKR briefing · Q3/);
  assert.doesNotMatch(next.html, /data-paw-slot="title">Objectives and key results</);
  assert.match(next.html, /Andrew Grove/);
  assert.match(next.html, /High Output Management/);
  assert.match(next.html, /Framework used to define measurable goals/);
  return next;
}

function fill(html, map) {
  let s = html;
  for (const [k, v] of Object.entries(map)) s = s.split(`{{${k}}}`).join(v);
  return s;
}

function buildDeck() {
  const src = sources.deck;
  const deckHtml = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="deck">
<body>
<section data-paw-block data-paw-block-id="slide-title">
  <p data-paw-slot="kicker">{{kicker}}</p>
  <h1 data-paw-slot="title">{{title}}</h1>
  <p data-paw-slot="subtitle">{{subtitle}}</p>
</section>
<section data-paw-block data-paw-block-id="slide-visual">
  <h2 data-paw-slot="visualTitle">{{visualTitle}}</h2>
  <p data-paw-slot="visualBody">{{visualBody}}</p>
  <img data-paw-slot="hero" src="{{cover}}" alt="">
</section>
<section data-paw-block data-paw-block-id="slide-points">
  <h2 data-paw-slot="pointsTitle">{{pointsTitle}}</h2>
  <p data-paw-slot="bullets">{{bullets}}</p>
  <p data-paw-slot="footer">{{footer}}</p>
</section>
</body></html>`;
  const filled = fill(deckHtml, {
    kicker: src.kicker,
    title: src.title,
    subtitle: src.subtitle,
    visualTitle: src.visualTitle,
    visualBody: src.visualBody,
    cover: HERO,
    pointsTitle: src.pointsTitle,
    bullets: src.bullets,
    footer: src.footer
  });
  const created = applyHtmlCommands('', [{ op: 'createDocument', html: filled, kind: 'deck' }], {
    draft: false
  });
  assert.equal(created.ok, true, created.error);
  for (const s of src.distinctive) assert.match(created.html, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(created.html, /data:image\/svg\+xml/);
  assert.doesNotMatch(created.html, /\ssrc=["'](?!data:)[^"']+["']/);
  const ins = inspectHtml(created.html, { plateId: 'slide-visual', slotId: 'hero' });
  assert.match(String(ins.slot?.src || ''), /data:image\/svg\+xml/);
  assert.equal(detectHtmlKind(created.html), 'deck');
  const parsed = parseMarkedHtml(created.html);
  const print = platesToPrintHtml(parsed.plates, { title: src.title, kind: 'deck', styles: parsed.styles });
  assert.doesNotMatch(print, /id="bar"/);
  assert.doesNotMatch(print, /data-act="/);
  assert.match(print, /Super Heavy/);
  return created;
}

function fineTuneDeck(html) {
  const next = applyHtmlCommands(
    html,
    [{ op: 'setSlotText', plateId: 'slide-title', slotId: 'title', text: 'Starship QBR · Block 3' }],
    { draft: false }
  );
  assert.equal(next.ok, true, next.error);
  assert.match(next.html, /Starship QBR · Block 3/);
  assert.doesNotMatch(next.html, /data-paw-slot="title">Starship launch vehicle</);
  assert.match(next.html, /Raptor/);
  assert.match(next.html, /Starbase, Texas/);
  return next;
}

function run() {
  assert.match(sources.sheet.url, /wikipedia\.org/);
  assert.match(sources.document.url, /wikipedia\.org/);
  assert.match(sources.deck.url, /wikipedia\.org/);

  const sheet = buildSheet();
  const sheetTuned = fineTuneSheet(sheet.data);
  const doc = buildDocument();
  const docTuned = fineTuneDocument(doc.html);
  const deck = buildDeck();
  const deckTuned = fineTuneDeck(deck.html);

  const outDir = process.env.PAW_OFFICE_OUT;
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'fortune-500.xlsx'), sheet.bytes);
    fs.writeFileSync(path.join(outDir, 'okr-brief.html'), docTuned.html);
    fs.writeFileSync(path.join(outDir, 'starship-qbr.html'), deckTuned.html);
    const table = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fortune 500 capture</title>',
      '<style>body{font-family:system-ui;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}</style>',
      '</head><body><h1>List of largest companies by revenue</h1><p data-source="wikipedia">Frozen capture</p><table>',
      '<tr>' + sources.sheet.headers.map((h) => `<th>${h}</th>`).join('') + '</tr>',
      ...sheetTuned.sheets[0].rows.slice(1).map(
        (r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>'
      ),
      '</table></body></html>'
    ].join('');
    fs.writeFileSync(path.join(outDir, 'fortune-500.html'), table);
  }

  console.log('test_internet_office_scenarios: ok');
}

run();
