import assert from 'node:assert/strict';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const fs = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  fs.mkdirp('/artifacts');
  fs.mkdirp('/scratch');
  const tools = createSessionTools({ store, execution, fs, sessionId });
  return { store, runtime, fs, tools, sessionId };
}

async function run() {
  const { store, fs, tools } = setup('s-office-path');

  assert.match(String(tools.doc.description), /path\|from/);
  assert.match(String(tools.deck.description), /path\|from/);
  assert.match(String(tools.web.description), /path\|from/);

  const docCreated = await tools.run.execute({
    op: 'write_artifact',
    name: 'note.html',
    content:
      '<!DOCTYPE html><html data-paw-kind="document"><body><p data-paw-block-type="p">旧文</p></body></html>'
  });
  assert.equal(docCreated.ok, true, docCreated.error);
  const docId = docCreated.artifact.artifactId;
  fs.writeFile(
    '/scratch/doc-blocks.json',
    JSON.stringify({
      commands: [
        { op: 'createDocument', title: '路径文档' },
        { op: 'insertParagraph', text: '第一段压缩袋' },
        { op: 'insertParagraph', text: '第二段饮料架' }
      ]
    })
  );
  const docPath = await tools.doc.execute({
    act: 'write',
    artifactId: docId,
    path: '/scratch/doc-blocks.json'
  });
  assert.equal(docPath.ok, true, docPath.error);
  assert.ok(docPath.dirty || (docPath.readback?.blocks || []).length, JSON.stringify(docPath));
  assert.ok(
    (docPath.readback?.blocks || []).some((b) => /压缩袋/.test(b.text || '')),
    JSON.stringify(docPath.readback)
  );

  const docMissing = await tools.doc.execute({
    act: 'write',
    artifactId: docId,
    path: '/scratch/doc-missing.json'
  });
  assert.equal(docMissing.ok, false);
  assert.equal(docMissing.code, 'ENOENT');

  const docBadOp = await tools.doc.execute({
    act: 'write',
    artifactId: docId,
    commands: [{ text: 'no-op' }]
  });
  assert.equal(docBadOp.ok, false);
  assert.equal(docBadOp.code, 'BAD_INPUT');
  assert.match(String(docBadOp.error || ''), /missing op/i);

  const scene = await tools.run.execute({
    op: 'createScene',
    name: 'path-deck.json',
    kind: 'deck',
    themeId: 'ink-rose',
    frames: [
      {
        id: 'slide-1',
        layoutId: 'quote',
        slots: { quote: '旧句', attribution: 'Paw' }
      }
    ]
  });
  assert.equal(scene.ok, true, scene.error);
  const deckId = scene.artifact.artifactId;
  store.put('sessions', 's-office-path', {
    ...store.get('sessions', 's-office-path'),
    activeHtml: {
      artifactId: deckId,
      selections: [{ nodeId: 'shape:slide-1', plateId: 'slide-1' }]
    }
  });

  fs.writeFile(
    '/scratch/deck-slots.json',
    JSON.stringify({
      layoutId: 'quote',
      themeId: 'forest',
      slots: { quote: '路径写入的金句', attribution: 'Paw Work' }
    })
  );
  const deckPath = await tools.deck.execute({
    act: 'write',
    artifactId: deckId,
    plateId: 'slide-1',
    path: '/scratch/deck-slots.json'
  });
  assert.equal(deckPath.ok, true, deckPath.error || JSON.stringify(deckPath.qa || deckPath));
  assert.ok((deckPath.applied || []).includes('replacePlate'), JSON.stringify(deckPath.applied));
  const deckRead = await tools.deck.execute({ act: 'read', artifactId: deckId });
  assert.ok(
    (deckRead.nodes || listEngineNodes({ tldraw: { document: { store: {} } } })).some((n) =>
      /路径写入的金句/.test(n.text || '')
    ),
    JSON.stringify(deckRead.nodes?.map((n) => n.text).filter(Boolean))
  );

  const deckMissing = await tools.deck.execute({
    act: 'write',
    artifactId: deckId,
    plateId: 'slide-1',
    path: '/scratch/deck-missing.json'
  });
  assert.equal(deckMissing.ok, false);
  assert.equal(deckMissing.code, 'ENOENT');

  fs.writeFile(
    '/scratch/create-frames.json',
    JSON.stringify({
      kind: 'deck',
      themeId: 'ink-rose',
      frames: [
        {
          id: 's1',
          layoutId: 'title',
          slots: { title: '从路径编译', kicker: 'scratch' }
        }
      ]
    })
  );
  const compiled = await tools.run.execute({
    op: 'createScene',
    artifactId: deckId,
    path: '/scratch/create-frames.json'
  });
  assert.equal(compiled.ok, true, compiled.error);
  assert.equal(compiled.artifact?.artifactId || compiled.artifactId || deckId, deckId);
  const afterCompile = await tools.deck.execute({ act: 'read', artifactId: deckId });
  assert.ok(
    (afterCompile.nodes || []).some((n) => /从路径编译/.test(n.text || '')),
    JSON.stringify(afterCompile.nodes?.map((n) => n.text).filter(Boolean))
  );

  const webSession = setup('s-office-path-web');
  const site = await webSession.tools.run.execute({
    op: 'write_artifact',
    name: 'landing.html',
    content:
      '<!DOCTYPE html><html data-paw-kind="site"><body><h1>Welcome</h1><p>Hello</p></body></html>'
  });
  assert.equal(site.ok, true, site.error);
  const siteId = site.artifact.artifactId;
  const siteRead = await webSession.tools.web.execute({ act: 'read', artifactId: siteId });
  const h1 = (siteRead.nodes || []).find((n) => n.tag === 'h1');
  assert.ok(h1, JSON.stringify(siteRead.nodes));
  webSession.fs.writeFile(
    '/scratch/site-patches.json',
    JSON.stringify({
      commands: [{ op: 'setText', nodeId: h1.nodeId, text: '路径站点标题' }]
    })
  );
  const webPath = await webSession.tools.web.execute({
    act: 'write',
    artifactId: siteId,
    path: '/scratch/site-patches.json'
  });
  assert.equal(webPath.ok, true, webPath.error);
  assert.ok((webPath.applied || []).includes('setText'), JSON.stringify(webPath.applied));
  assert.match(String(webPath.readback?.text || ''), /路径站点标题/);

  webSession.fs.writeFile(
    '/scratch/site-page.html',
    '<!DOCTYPE html><html data-paw-kind="site"><body><h1>整页路径</h1></body></html>'
  );
  const webHtml = await webSession.tools.web.execute({
    act: 'write',
    artifactId: siteId,
    path: '/scratch/site-page.html'
  });
  assert.equal(webHtml.ok, true, webHtml.error);
  assert.ok((webHtml.applied || []).includes('replaceHtml'), JSON.stringify(webHtml.applied));
  assert.match(String(webHtml.readback?.text || ''), /整页路径/);

  const webMissing = await webSession.tools.web.execute({
    act: 'write',
    artifactId: siteId,
    from: '/scratch/site-missing.json'
  });
  assert.equal(webMissing.ok, false);
  assert.equal(webMissing.code, 'ENOENT');

  const webBadOp = await webSession.tools.web.execute({
    act: 'write',
    artifactId: siteId,
    commands: [{ nodeId: h1.nodeId, text: 'x' }]
  });
  assert.equal(webBadOp.ok, false);
  assert.equal(webBadOp.code, 'BAD_INPUT');

  console.log('test_office_path_write: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
