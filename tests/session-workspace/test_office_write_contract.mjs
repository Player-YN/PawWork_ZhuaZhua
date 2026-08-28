import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';

const DECK = `<!DOCTYPE html>
<html data-pawwork-preview="blocks" data-paw-kind="deck">
<head><meta charset="utf-8" /><title>Deck</title></head>
<body>
<section data-paw-block data-paw-block-id="slide-title">
  <h1 data-paw-slot="title">Old</h1>
  <p data-paw-slot="kicker">Keep</p>
</section>
</body>
</html>`;

async function run() {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-office-write';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId });

  const wb = await tools.run.execute({
    op: 'sheet',
    commands: [
      {
        op: 'createWorkbook',
        name: 'n.csv',
        sheets: [{ name: 'Sheet1', rows: [['A', 'B'], ['1', '2']] }]
      }
    ]
  });
  assert.equal(wb.ok, true, wb.error);
  const sheetId = wb.artifact.artifactId;
  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeWorkbook: {
      artifactId: sheetId,
      overview: { selections: [{ sheet: 'Sheet1', a1: 'B2' }] }
    }
  });

  const omitted = await tools.sheet.execute({ act: 'write', value: '720.1' });
  assert.equal(omitted.ok, true, omitted.error);
  assert.equal(String(omitted.readback.values[0][0]), '720.1');
  assert.match(String(omitted.dirty || omitted.readback.a1), /B2/);
  assert.ok(Array.isArray(omitted.sheets) && omitted.sheets.some((s) => s.name === 'Sheet1' && s.rowCount >= 2), JSON.stringify(omitted.sheets));

  const mutateRun = await tools.run.execute({
    op: 'sheet',
    artifactId: sheetId,
    commands: [{ op: 'setRange', a1: 'A2', value: 'nope' }]
  });
  assert.equal(mutateRun.ok, false);
  assert.equal(mutateRun.code, 'USE_OFFICE_TOOL');

  const html = await tools.run.execute({
    op: 'html',
    name: 'deck.json',
    commands: [
      {
        op: 'createScene',
        kind: 'deck',
        title: 'Deck',
        nodes: [
          { id: 'bg', type: 'geo', fill: '#0f172a', box: { x: 0, y: 0, w: 1920, h: 1080 } },
          { id: 'title', type: 'text', text: 'Old', box: { x: 80, y: 80, w: 1600, h: 100 } },
          { id: 'kicker', type: 'text', text: 'Keep', box: { x: 80, y: 220, w: 1600, h: 80 } }
        ]
      }
    ]
  });
  assert.equal(html.ok, true, html.error);
  const deckId = html.artifact.artifactId;
  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: {
      artifactId: deckId,
      selections: [{ nodeId: 'shape:title', slotId: 'shape:title' }]
    }
  });

  const slotWrite = await tools.deck.execute({ act: 'write', text: 'Q3' });
  assert.equal(slotWrite.ok, true, slotWrite.error);
  assert.equal(slotWrite.readback.text, 'Q3');
  assert.equal(slotWrite.preview?.code, 'NEED_TAB');
  assert.equal(slotWrite.modelParts, undefined);
  const ins = await tools.deck.execute({ act: 'read', artifactId: deckId });
  assert.ok((ins.nodes || []).some((n) => /Keep/.test(n.text || '')), JSON.stringify(ins));

  const bad = await tools.deck.execute({
    act: 'write',
    nodeId: 'nope',
    text: 'x'
  });
  assert.equal(bad.ok, false);
  assert.ok(Array.isArray(bad.available) && bad.available.some((id) => String(id).includes('title')), JSON.stringify(bad));

  const htmlMutate = await tools.run.execute({
    op: 'html',
    artifactId: deckId,
    commands: [{ op: 'setSlotText', slotId: 'title', value: 'via-run' }]
  });
  assert.equal(htmlMutate.ok, false);
  assert.equal(htmlMutate.code, 'USE_OFFICE_TOOL');

  const pngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const g = runtime.createGroup({ name: 'pics', sessionId });
  const item = runtime.addWebItem(g.groupId, {
    src: `data:image/png;base64,${pngB64}`,
    kindHint: 'image'
  });
  runtime.bindGroups(sessionId, [g.groupId]);
  const pictured = await tools.sheet.execute({
    act: 'write',
    artifactId: sheetId,
    commands: [{ op: 'insertCellImage', a1: 'T17', src: item.webItemId, sheet: 'Sheet1' }]
  });
  assert.equal(pictured.ok, true, pictured.error);
  const appliedImg = (pictured.applied || []).find((a) => a.op === 'insertCellImage') || pictured.applied?.[0];
  const srcOut = String(appliedImg?.src || pictured.readback?.values?.[0]?.[0] || '');
  assert.match(srcOut, /data:image|🖼/, JSON.stringify(pictured));
  assert.doesNotMatch(srcOut, /\[image:wi_/, 'must not persist webItem id as cell text');
  const cell = String(pictured.readback?.values?.[0]?.[0] || '');
  assert.doesNotMatch(cell, /wi_/, cell);

  const missing = await tools.sheet.execute({
    act: 'write',
    artifactId: sheetId,
    commands: [{ op: 'insertCellImage', a1: 'T19', src: 'wi_does_not_exist', sheet: 'Sheet1' }]
  });
  assert.equal(missing.ok, false, JSON.stringify(missing));
  assert.doesNotMatch(String(missing.readback?.values?.[0]?.[0] || ''), /wi_does_not_exist/);

  const itemB = runtime.addWebItem(g.groupId, {
    src: `data:image/png;base64,${pngB64}`,
    kindHint: 'screenshot'
  });
  runtime.bindGroups(sessionId, [g.groupId]);
  const zipped = await tools.sheet.execute({
    act: 'write',
    artifactId: sheetId,
    commands: [{ op: 'insertCellImage', a1: 'T17:T18', sheet: 'Sheet1' }]
  });
  assert.equal(zipped.ok, true, zipped.error);
  const zipApplied = zipped.applied || [];
  assert.ok(
    zipApplied.filter((a) => a.op === 'insertCellImage').length >= 2 ||
      String(zipped.dirty || '').includes('T'),
    JSON.stringify(zipped)
  );
  assert.doesNotMatch(JSON.stringify(zipped.readback || {}), /\[image:wi_/);

  const deckImg = await tools.deck.execute({
    act: 'write',
    artifactId: deckId,
    nodeId: 'shape:title',
    src: item.webItemId
  });
  assert.equal(deckImg.ok !== false, true, deckImg.error);
  if (deckImg.readback?.src) {
    assert.match(String(deckImg.readback.src), /data:image|https?:/);
    assert.doesNotMatch(String(deckImg.readback.src), /^wi_/);
  }

  const svgXml =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#38bdf8"/></svg>';
  const vec = runtime.addWebItem(g.groupId, {
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml),
    kindHint: 'vector',
    labelKind: 'vector',
    labelN: 1,
    html: svgXml
  });
  runtime.bindGroups(sessionId, [g.groupId]);
  const poster = await tools.run.execute({
    op: 'html',
    name: 'hiring_poster.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        title: 'hiring',
        nodes: [{ id: 'cover', type: 'image', src: 'https://example.com/old.png', box: { x: 0, y: 0, w: 200, h: 120 } }]
      }
    ]
  });
  assert.equal(poster.ok, true, poster.error);
  const covered = await tools.deck.execute({
    act: 'write',
    artifactId: poster.artifact.artifactId,
    nodeId: 'shape:cover',
    src: '矢量1'
  });
  assert.equal(covered.ok, true, covered.error);
  assert.match(String(covered.readback?.src || ''), /data:image\/svg\+xml/);
  assert.doesNotMatch(String(covered.readback?.src || ''), /data:text\/plain/);
  assert.doesNotMatch(String(covered.readback?.html || ''), /example\.com\/old\.png/);

  const logo = await tools.run.execute({
    op: 'write_artifact',
    name: 'ideashell_logo.svg',
    content: svgXml
  });
  assert.equal(logo.ok, true, logo.error);
  assert.equal(logo.artifact.mimeType, 'image/svg+xml', JSON.stringify(logo.artifact));

  const { decodeDataUrl } = await import('../../src/agent/vnext/sessionWorkspace/itemPixels.js');
  const decoded = decodeDataUrl(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml)
  );
  assert.equal(decoded.mimeType, 'image/svg+xml');
  assert.match(new TextDecoder().decode(decoded.bytes), /<svg\b/);
  assert.ok(vec.webItemId);

  console.log('test_office_write_contract: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
