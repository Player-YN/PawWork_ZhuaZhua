import assert from 'node:assert/strict';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createArtifact, listArtifacts } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import {
  buildShelfView,
  inferArtifactShelfFolder,
  compactShelfSnapshot,
  setArtifactFolder
} from '../../src/agent/vnext/sessionWorkspace/artifactShelf.js';
import { attachCanvasPreview } from '../../src/agent/vnext/sessionWorkspace/canvasPreview.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import { previewEntryForItem } from '../../src/agent/vnext/sessionWorkspace/openClassify.js';

function setup(id) {
  const store = new SessionWorkspaceStore();
  store.put('sessions', id, { sessionId: id });
  const execution = beginExecution(store, id, {});
  const fs = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs, sessionId: id });
  return { store, fs, tools, sessionId: id };
}

async function run() {
  assert.equal(inferArtifactShelfFolder({ name: 'cat.png', mimeType: 'image/png' }), 'images');
  assert.equal(inferArtifactShelfFolder({ name: 'rev.csv', mimeType: 'text/csv' }), 'sheets');
  assert.equal(inferArtifactShelfFolder({ name: 'poster.json', mimeType: 'application/json' }), 'design');
  assert.equal(inferArtifactShelfFolder({ name: 'qbr.json', folder: 'slides' }), 'slides');

  const { store, fs, tools, sessionId } = setup('s-shelf');
  const named = createArtifact(store, fs, {
    sessionId,
    name: '帅哥头像.png',
    displayLabel: '帅哥头像',
    mimeType: 'image/png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  });
  assert.equal(named.name, '帅哥头像.png');
  assert.equal(named.displayLabel, '帅哥头像');
  const imagesFolder = buildShelfView(listArtifacts(store, sessionId)).find((f) => f.id === 'images');
  assert.ok(imagesFolder?.items.some((a) => (a.displayLabel || a.name) === '帅哥头像'));
  createArtifact(store, fs, {
    sessionId,
    name: 'b.png',
    mimeType: 'image/png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  });
  const canvas = createArtifact(store, fs, {
    sessionId,
    name: 'board.json',
    mimeType: 'application/json',
    content: '{"pawCanvas":1}'
  });
  const view = buildShelfView(listArtifacts(store, sessionId));
  assert.ok(view.some((f) => f.id === 'images' && f.items.length === 2));
  assert.ok(view.some((f) => f.id === 'design' && f.items.length === 1));

  const moved = await tools.run.execute({
    op: 'shelf',
    commands: [{ op: 'setFolder', artifactId: canvas.artifactId, folder: 'slides' }]
  });
  assert.equal(moved.ok, true, moved.error);
  assert.ok(moved.shelf.some((f) => f.id === 'slides' && f.items.includes(canvas.artifactId)));

  const renamed = await tools.run.execute({
    op: 'shelf',
    commands: [{ op: 'renameFolder', folder: 'images', label: '本周海报' }]
  });
  assert.equal(renamed.ok, true, renamed.error);
  const snap = compactShelfSnapshot(listArtifacts(store, sessionId), store.get('sessions', sessionId).shelf);
  assert.equal(snap.find((f) => f.id === 'images')?.label, '本周海报');

  const before = listArtifacts(store, sessionId).length;
  const previewed = attachCanvasPreview(
    { ok: true, artifactId: canvas.artifactId },
    { frames: [{ id: 'f1', name: 'Cover', w: 10, h: 10, mime: 'image/jpeg', base64: 'xxxx' }] }
  );
  assert.equal(previewed.preview.ephemeral, true);
  assert.equal(previewed.preview.persist, false);
  assert.equal(listArtifacts(store, sessionId).length, before);

  assert.throws(
    () =>
      createArtifact(store, fs, {
        sessionId,
        name: 'frame.jpg',
        mimeType: 'image/jpeg',
        ephemeral: true,
        content: new Uint8Array([1, 2, 3])
      }),
    /ephemeral preview/
  );
  assert.equal(listArtifacts(store, sessionId).length, before);

  const inspected = await tools.inspect.execute({ view: 'artifacts' });
  assert.ok(Array.isArray(inspected.shelf));
  assert.ok(inspected.shelf.some((f) => f.id === 'images'));

  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  const blanks = [
    { kind: 'design', entry: 'design.html', folder: 'design', paw: /"shell"\s*:\s*"design"/ },
    { kind: 'slides', entry: 'design.html', folder: 'slides', paw: /"shell"\s*:\s*"slides"/ },
    { kind: 'sheet', entry: 'sheet.html', folder: 'sheets' },
    { kind: 'doc', entry: 'docs.html', folder: 'docs', html: /data-paw-kind\s*=\s*["']document["']/ },
    { kind: 'site', entry: 'site.html', folder: 'sites', html: /data-paw-kind\s*=\s*["']site["']/ }
  ];
  for (const spec of blanks) {
    const created = await svc.createBlankArtifact({ sessionId: 's-blank', kind: spec.kind });
    assert.equal(created.ok, true, created.error || spec.kind);
    const rec = created.artifact;
    assert.ok(rec?.artifactId, spec.kind);
    const read = await svc.readArtifact({ sessionId: 's-blank', artifactId: rec.artifactId });
    const text = String(read.content || '');
    if (spec.paw) assert.match(text, spec.paw);
    if (spec.html) assert.match(text, spec.html);
    const routed = previewEntryForItem({
      name: rec.name,
      mimeType: rec.mimeType || read.mimeType,
      text,
      content: text
    });
    assert.equal(routed.entry, spec.entry, `${spec.kind} → ${routed.entry}`);
    assert.equal(inferArtifactShelfFolder(rec), spec.folder, spec.kind);
  }

  console.log('test_artifact_shelf: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
