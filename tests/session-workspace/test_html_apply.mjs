import assert from 'node:assert/strict';
import {
  DRAFT_SUFFIX,
  applyHtmlCommands,
  applyHtmlDraftAction,
  discardDraftPlates,
  fillMissingSlotFromSelection,
  inspectHtml,
  mergeDraftPlates,
  parseMarkedHtml
} from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';

const SAMPLE = `<!DOCTYPE html>
<html lang="zh-CN" data-pawwork-preview="blocks">
<head>
  <meta charset="utf-8" />
  <meta name="pawwork-preview" content="blocks" />
  <title>Demo</title>
  <style>body{margin:0}</style>
</head>
<body>
<section data-paw-block data-paw-block-id="hero">
  <h1 data-paw-slot="title">Old Title</h1>
  <img data-paw-slot="cover" src="old.png">
  <p data-paw-slot="lead" data-box="10,20,200,40">Lead copy</p>
</section>
</body>
</html>`;

function plate(doc, id) {
  return (doc.plates || []).find((p) => p.id === id);
}

function run() {
  const parsed = parseMarkedHtml(SAMPLE);
  assert.equal(parsed.title, 'Demo');
  assert.equal(parsed.plates.length, 1);
  assert.equal(parsed.plates[0].id, 'hero');
  const slots = parsed.plates[0].slots;
  assert.equal(slots.length, 3);
  const title = slots.find((s) => s.id === 'title');
  const cover = slots.find((s) => s.id === 'cover');
  const lead = slots.find((s) => s.id === 'lead');
  assert.equal(title.tag, 'h1');
  assert.match(title.html, /Old Title/);
  assert.equal(cover.tag, 'img');
  assert.match(cover.src, /old\.png/);
  assert.equal(lead.tag, 'p');
  assert.equal(lead.box?.x, 10);
  assert.equal(lead.box?.y, 20);
  assert.equal(lead.box?.w, 200);
  assert.equal(lead.box?.h, 40);

  const titled = applyHtmlCommands(SAMPLE, [
    { op: 'setSlotText', plateId: 'hero', slotId: 'title', text: 'New Title' }
  ]);
  assert.equal(titled.ok, true);
  const titledDoc = parseMarkedHtml(titled.html);
  const origHero = plate(titledDoc, 'hero');
  const draftHero = plate(titledDoc, `hero${DRAFT_SUFFIX}`);
  assert.ok(origHero, 'original plate remains');
  assert.ok(draftHero, 'draft plate created');
  assert.match(origHero.html, /Old Title/);
  assert.equal(/New Title/.test(origHero.html), false);
  assert.match(draftHero.html, /New Title/);
  assert.equal(titled.readback.slotId, 'title');
  assert.equal(titled.readback.plateId, `hero${DRAFT_SUFFIX}`);

  const merged = mergeDraftPlates(titled.html);
  const mergedDoc = parseMarkedHtml(merged.html);
  assert.ok(plate(mergedDoc, 'hero'));
  assert.equal(plate(mergedDoc, `hero${DRAFT_SUFFIX}`), undefined);
  assert.match(plate(mergedDoc, 'hero').html, /New Title/);

  const discarded = discardDraftPlates(titled.html);
  const discardedDoc = parseMarkedHtml(discarded.html);
  assert.match(plate(discardedDoc, 'hero').html, /Old Title/);
  assert.equal(plate(discardedDoc, `hero${DRAFT_SUFFIX}`), undefined);

  const viaPreviewAccept = applyHtmlDraftAction(titled.html, 'accept');
  assert.equal(viaPreviewAccept.action, 'accept');
  assert.equal(viaPreviewAccept.merged, true);
  assert.match(plate(parseMarkedHtml(viaPreviewAccept.html), 'hero').html, /New Title/);
  assert.equal(plate(parseMarkedHtml(viaPreviewAccept.html), `hero${DRAFT_SUFFIX}`), undefined);
  const viaPreviewDiscard = applyHtmlDraftAction(titled.html, 'discard');
  assert.equal(viaPreviewDiscard.action, 'discard');
  assert.match(plate(parseMarkedHtml(viaPreviewDiscard.html), 'hero').html, /Old Title/);

  const srcd = applyHtmlCommands(SAMPLE, [
    { op: 'setSlotSrc', plateId: 'hero', slotId: 'cover', src: 'new.jpg' }
  ]);
  assert.equal(srcd.ok, true);
  const srcDoc = parseMarkedHtml(srcd.html);
  assert.match(plate(srcDoc, 'hero').html, /old\.png/);
  assert.match(plate(srcDoc, `hero${DRAFT_SUFFIX}`).html, /new\.jpg/);
  const coverSlot = plate(srcDoc, `hero${DRAFT_SUFFIX}`).slots.find((s) => s.id === 'cover');
  assert.match(coverSlot.src, /new\.jpg/);

  const filled = fillMissingSlotFromSelection(
    [{ op: 'setSlotText', text: 'Pinned' }],
    [{ plateId: 'hero', slotId: 'lead' }]
  );
  assert.equal(filled[0].plateId, 'hero');
  assert.equal(filled[0].slotId, 'lead');

  const pinned = applyHtmlCommands(SAMPLE, [{ op: 'setSlotText', text: 'Pinned' }], {
    selections: [{ plateId: 'hero', slotId: 'lead' }]
  });
  assert.equal(pinned.ok, true);
  const pinDoc = parseMarkedHtml(pinned.html);
  const pinDraft = plate(pinDoc, `hero${DRAFT_SUFFIX}`);
  const pinOrig = plate(pinDoc, 'hero');
  assert.match(pinDraft.html, /Pinned/);
  assert.match(pinDraft.html, /Old Title/);
  assert.match(pinOrig.html, /Lead copy/);
  assert.equal(/Pinned/.test(pinOrig.html), false);
  const leadDraft = pinDraft.slots.find((s) => s.id === 'lead');
  assert.match(leadDraft.html, /Pinned/);

  const inspected = inspectHtml(SAMPLE, { plateId: 'hero', slotId: 'title' });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.slotId, 'title');
  assert.equal(inspected.slot.id, 'title');
  assert.equal(inspected.plateId, 'hero');
  assert.notEqual(inspected.slot.id, 'hero');
  assert.equal(inspected.requested.slotId, 'title');
  assert.match(inspected.slot.html, /Old Title/);

  const leadInspect = inspectHtml(SAMPLE, { plateId: 'hero', slotId: 'lead' });
  assert.equal(leadInspect.slot.id, 'lead');
  assert.notEqual(leadInspect.slot.id, 'hero');
  assert.match(leadInspect.slot.html, /Lead copy/);

  const inPlace = applyHtmlCommands(
    SAMPLE,
    [{ op: 'setSlotText', plateId: 'hero', slotId: 'title', text: 'Live' }],
    { draft: false }
  );
  const liveDoc = parseMarkedHtml(inPlace.html);
  assert.equal(plate(liveDoc, `hero${DRAFT_SUFFIX}`), undefined);
  assert.match(plate(liveDoc, 'hero').html, /Live/);

  console.log('test_html_apply: ok');
}

run();
