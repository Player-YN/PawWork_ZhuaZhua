/**
 * Frame JPEG preview after deck write / createScene — pixels for the model,
 * metadata only in JSON (no base64 in preview.frames).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import {
  attachCanvasPreview,
  PREVIEW_MAX_FRAMES,
  PREVIEW_TIMEOUT_MS,
  requestCanvasPreview,
  sessionToolToModelOutput
} from '../../src/agent/vnext/sessionWorkspace/canvasPreview.js';

const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

function setup(id, extra = {}) {
  const store = new SessionWorkspaceStore();
  store.put('sessions', id, { sessionId: id });
  const execution = beginExecution(store, id, {});
  const guest = createSessionGuestFs(store, { sessionId: id, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({
    store,
    execution,
    fs: guest,
    sessionId: id,
    hostCanvas: extra.hostCanvas || null
  });
  return { store, guest, tools, sessionId: id };
}

async function run() {
  assert.ok(PREVIEW_TIMEOUT_MS >= 8000 && PREVIEW_TIMEOUT_MS <= 20000);
  const hung = await requestCanvasPreview(
    () => new Promise(() => {}),
    { artifactId: 'a1', timeoutMs: 40 }
  );
  assert.equal(hung.code, 'NEED_TAB');
  assert.equal(hung.skipped, 'PREVIEW_TIMEOUT');

  const skipped = attachCanvasPreview({ ok: true, artifactId: 'a' }, { skipped: 'NEED_TAB', code: 'NEED_TAB' });
  assert.equal(skipped.preview.code, 'NEED_TAB');
  assert.equal(skipped.modelParts, undefined);

  const frames = [];
  for (let i = 0; i < PREVIEW_MAX_FRAMES + 2; i++) {
    frames.push({ id: `shape:f${i}`, name: `P${i}`, w: 720, h: 1080, mime: 'image/jpeg', base64: TINY_JPEG });
  }
  const attached = attachCanvasPreview({ ok: true, artifactId: 'a' }, { frames, truncated: true });
  assert.equal(attached.preview.ephemeral, true);
  assert.equal(attached.preview.persist, false);
  assert.equal(attached.preview.frames.length, PREVIEW_MAX_FRAMES);
  assert.equal(attached.preview.truncated, true);
  assert.ok(attached.preview.frames.every((f) => !f.base64));
  assert.equal(attached.modelParts.filter((p) => p.type === 'file').length, PREVIEW_MAX_FRAMES);

  const modelOut = sessionToolToModelOutput({ output: attached });
  assert.equal(modelOut.type, 'content');
  assert.ok(modelOut.value.some((p) => p.type === 'file' && p.data?.data));
  assert.equal(JSON.stringify(modelOut).includes(TINY_JPEG), true);

  const jsonOut = sessionToolToModelOutput({ output: skipped });
  assert.equal(jsonOut.type, 'json');
  assert.equal(jsonOut.value.preview.code, 'NEED_TAB');
  assert.equal(jsonOut.value.modelParts, undefined);

  const headless = setup('s-preview-headless');
  const created = await headless.tools.run.execute({
    op: 'html',
    name: 'poster.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        title: 'Poster',
        nodes: [{ id: 't', type: 'text', text: 'Hi' }]
      }
    ]
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.preview.code, 'NEED_TAB');
  assert.equal(created.modelParts, undefined);

  const seen = await headless.tools.deck.execute({
    act: 'read',
    artifactId: created.artifact.artifactId
  });
  const nodeId = String(seen.available?.[0] || seen.nodes?.[0]?.nodeId || seen.nodes?.[0]?.id || '');
  const wrote = await headless.tools.deck.execute({
    act: 'write',
    artifactId: created.artifact.artifactId,
    nodeId,
    text: 'Hello'
  });
  assert.equal(wrote.ok, true, wrote.error);
  assert.equal(wrote.preview.code, 'NEED_TAB');

  let previewed = 0;
  const live = setup('s-preview-live', {
    hostCanvas: async (payload) => {
      if (payload.method === 'apply') {
        return {
          ok: true,
          result: {
            ok: true,
            liveApplied: true,
            json: null,
            applied: ['setSlotText'],
            readback: { nodeId: 'shape:t', text: 'Hi' },
            preview: {
              frames: [{ id: 'shape:frame1', name: 'Cover', w: 360, h: 540, mime: 'image/jpeg', base64: TINY_JPEG }]
            }
          }
        };
      }
      if (payload.method === 'preview') {
        previewed += 1;
        return {
          ok: true,
          result: {
            ok: true,
            frames: [{ id: 'shape:frame1', name: 'Cover', w: 360, h: 540, mime: 'image/jpeg', base64: TINY_JPEG }]
          }
        };
      }
      return { ok: false, code: 'NEED_TAB' };
    }
  });
  const liveCreated = await live.tools.run.execute({
    op: 'html',
    name: 'live.json',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        title: 'Live',
        nodes: [{ id: 't', type: 'text', text: 'Hi' }]
      }
    ]
  });
  assert.equal(liveCreated.ok, true, liveCreated.error);
  assert.equal(liveCreated.preview.frames[0].name, 'Cover');
  assert.equal(liveCreated.preview.frames[0].base64, undefined);
  assert.ok(liveCreated.modelParts.some((p) => p.type === 'file'));
  assert.ok(previewed >= 1);

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const designJs = fs.readFileSync(path.join(root, 'src/preview/design.js'), 'utf8');
  const bg = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'scripts/design-runtime-entry.jsx'), 'utf8');
  assert.match(designJs, /method === 'preview'/);
  assert.match(designJs, /captureEnginePreview/);
  assert.match(bg, /method === 'preview'/);
  assert.match(runtime, /exportPreview/);

  console.log('test_canvas_frame_preview: ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
