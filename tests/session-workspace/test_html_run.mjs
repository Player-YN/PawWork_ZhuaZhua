import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../src/agent/vnext/sessionWorkspace/artifacts.js';

const pdfPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'pdf',
  'simple.pdf'
);

function run() {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-html-run';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });

  return tools.run
    .execute({
      op: 'html',
      name: 'poster.html',
      commands: [
        {
          op: 'createDocument',
          title: 'Poster',
          plates: [
            {
              id: 'hero',
              html: '<h1 data-paw-slot="title">Hi</h1><img data-paw-slot="cover" src="x.jpg" />'
            }
          ]
        }
      ]
    })
    .then((blocked) => {
      assert.equal(blocked.ok, false);
      assert.equal(blocked.code, 'USE_CANVAS');
      return tools.run.execute({
        op: 'html',
        name: 'poster.json',
        commands: [
          {
            op: 'createScene',
            kind: 'poster',
            title: 'Poster',
            nodes: [
              { id: 'title', type: 'text', text: 'Hi' },
              { id: 'cover', type: 'image', src: 'https://cdn.example/from-image1.png' }
            ]
          }
        ]
      });
    })
    .then((created) => {
      assert.equal(created.ok, true, created.error);
      const id = created.artifact.artifactId;
      return tools.deck
        .execute({
          act: 'write',
          artifactId: id,
          commands: [{ op: 'setSlotText', nodeId: 'shape:title', text: 'Cover' }]
        })
        .then((edited) => {
          assert.equal(edited.ok, true, edited.error);
          assert.ok(edited.readback);
          const rec = runtime.listArtifacts(sessionId).find((a) => a.artifactId === id);
          const jsonNow = guest.readFile(rec.primaryPath);
          assert.match(jsonNow, /Cover/);
          const pdfRec = createArtifact(store, guest, {
            sessionId,
            name: 'in.pdf',
            content: fs.readFileSync(pdfPath),
            mimeType: 'application/pdf'
          });
          return tools.run.execute({ op: 'ingestPdf', artifactId: pdfRec.artifactId });
        })
        .then((ingested) => {
          assert.equal(ingested.ok, true, ingested.error);
          assert.match(String(ingested.artifact?.name || ''), /html/);
          return tools.inspect.execute({ view: 'html', artifactId: ingested.artifact.artifactId });
        })
        .then((pdfHtml) => {
          assert.equal(pdfHtml.ok, true);
          assert.ok((pdfHtml.plates || []).length >= 1);
          return tools.run.execute({
            op: 'doc',
            name: 'note.html',
            commands: [
              { op: 'createDocument', title: 'Note' },
              { op: 'setText', text: 'Doc body' }
            ]
          });
        })
        .then((doc) => {
          assert.equal(doc.ok, true, doc.error);
          assert.ok(doc.artifact);
          return tools.run.execute({
            op: 'doc',
            name: 'bad-doc.html',
            commands: [{ op: 'insertImage' }]
          });
        })
        .then((bad) => {
          assert.equal(bad.ok, false);
          assert.match(String(bad.error || ''), /insertImage|src|url/i);
          const names = runtime.listArtifacts(sessionId).map((a) => a.name);
          assert.equal(names.includes('bad-doc.html'), false);
          return tools.run.execute({
            commands: [
              {
                op: 'createScene',
                kind: 'poster',
                title: 'Alias',
                nodes: [{ id: 't', type: 'text', text: 'Routed' }]
              }
            ]
          });
        })
        .then((aliased) => {
          assert.equal(aliased.ok, true, aliased.error);
          assert.equal(aliased.op, 'html');
          return tools.run.execute({
            op: 'createScene',
            commands: [{ op: 'createScene', name: 'empty-name-only' }]
          });
        })
        .then((emptyScene) => {
          assert.equal(emptyScene.ok, false);
          assert.match(String(emptyScene.error || ''), /nodes|html|fragments/i);
          assert.doesNotMatch(String(emptyScene.error || ''), /unknown op/);
          return tools.run.execute({
            commands: [{ op: 'fromRaster', path: '/artifacts/compose_mtbcmaya/compose_mtbcmaya.png' }]
          });
        })
        .then((fromPath) => {
          assert.notEqual(fromPath.op, 'sheet');
          assert.doesNotMatch(String(fromPath.error || ''), /unknown op|sheet requires/i);
          console.log('test_html_run: ok');
        });
    });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
