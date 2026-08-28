/**
 * Seed a real Session Workspace createScene + replacePlate deck for the tldraw harness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { createArtifact } from '../../../src/agent/vnext/sessionWorkspace/artifacts.js';
import { emptyPawCanvas, listEngineNodes, parsePawCanvas } from '../../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { semanticDeckOutline, slide4ReplaceSlots, SEMANTIC_THEME_ID } from './semanticDeckFixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
export const QA_DECK_DIR = path.join(root, 'artifacts/qa-semantic-deck');

function setup(sessionId) {
  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });
  return { store, runtime, fs: guest, tools, sessionId };
}

function seedBlankSlides(store, guest, sessionId) {
  const rec = createArtifact(store, guest, {
    sessionId,
    name: 'slides.json',
    content: JSON.stringify(emptyPawCanvas({ shell: 'slides', title: 'Slides' })),
    mimeType: 'application/json'
  });
  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: { artifactId: rec.artifactId, selections: [{ nodeId: 'shape:frame' }] }
  });
  return rec;
}

function frameIds(raw) {
  return listEngineNodes(raw)
    .filter((n) => n.type === 'frame')
    .map((n) => n.nodeId)
    .sort();
}

export async function seedSemanticDeck(outDir = QA_DECK_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  const { store, runtime, fs: guest, tools, sessionId } = setup('s-qa-semantic-deck');
  const blank = seedBlankSlides(store, guest, sessionId);
  const beforeCount = runtime.listArtifacts(sessionId).length;
  const created = await tools.run.execute({
    op: 'createScene',
    artifactId: blank.artifactId,
    ...semanticDeckOutline()
  });
  if (!created.ok) {
    throw new Error(`createScene failed: ${created.error || created.code} ${JSON.stringify(created.qa?.issues || [])}`);
  }
  const afterCreateCount = runtime.listArtifacts(sessionId).length;
  const rec = runtime.listArtifacts(sessionId).find((a) => a.artifactId === blank.artifactId);
  const beforeReplace = guest.readFile(rec.primaryPath);
  const beforeFrames = frameIds(beforeReplace);
  const beforeSlide4Kids = listEngineNodes(beforeReplace)
    .filter((n) => n.parentId === 'shape:slide-4')
    .map((n) => n.nodeId)
    .sort();

  store.put('sessions', sessionId, {
    ...store.get('sessions', sessionId),
    activeHtml: { artifactId: blank.artifactId, selections: [{ nodeId: 'shape:slide-4' }] }
  });
  const replaced = await tools.deck.execute({
    act: 'write',
    artifactId: blank.artifactId,
    op: 'replacePlate',
    plateId: 'slide-4',
    layoutId: 'quote',
    themeId: SEMANTIC_THEME_ID,
    slots: slide4ReplaceSlots()
  });
  if (!replaced.ok) {
    throw new Error(`replacePlate failed: ${replaced.error || replaced.code} ${JSON.stringify(replaced.qa?.issues || [])}`);
  }
  const afterReplace = guest.readFile(rec.primaryPath);
  const afterFrames = frameIds(afterReplace);
  const afterCount = runtime.listArtifacts(sessionId).length;
  const namedBefore = listEngineNodes(beforeReplace)
    .filter((n) => n.type === 'frame')
    .sort((a, b) => a.x - b.x)
    .map((n) => ({ id: n.nodeId, x: n.x, y: n.y, w: n.w, h: n.h, name: n.text }));
  const namedAfter = listEngineNodes(afterReplace)
    .filter((n) => n.type === 'frame')
    .sort((a, b) => a.x - b.x)
    .map((n) => ({ id: n.nodeId, x: n.x, y: n.y, w: n.w, h: n.h, name: n.text }));
  const identity = {
    themeId: SEMANTIC_THEME_ID,
    artifactId: blank.artifactId,
    artifactCountBefore: beforeCount,
    artifactCountAfterCreate: afterCreateCount,
    artifactCountAfterReplace: afterCount,
    sameArtifact: blank.artifactId === created.artifactId && created.reused === true,
    frameIdsBefore: beforeFrames,
    frameIdsAfter: afterFrames,
    slide4Unchanged: beforeFrames.includes('shape:slide-4') && afterFrames.includes('shape:slide-4'),
    otherFramesUnchanged: beforeFrames.filter((id) => id !== 'shape:slide-4').every((id) => afterFrames.includes(id)),
    slide4ChildIdsBefore: beforeSlide4Kids,
    framesBefore: namedBefore,
    framesAfter: namedAfter,
    slide4NameBefore: namedBefore.find((f) => f.id === 'shape:slide-4')?.name || '',
    slide4NameAfter: namedAfter.find((f) => f.id === 'shape:slide-4')?.name || '',
    createQa: created.qa || null,
    replaceQa: replaced.qa || null
  };

  fs.writeFileSync(path.join(outDir, 'deck.json'), beforeReplace);
  fs.writeFileSync(path.join(outDir, 'deck-after-replace.json'), afterReplace);
  fs.writeFileSync(path.join(outDir, 'identity.json'), JSON.stringify(identity, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'qa.json'),
    JSON.stringify({ create: created.qa || null, replace: replaced.qa || null }, null, 2)
  );
  const parsed = parsePawCanvas(beforeReplace);
  return {
    outDir,
    identity,
    themeId: parsed?.themeId || SEMANTIC_THEME_ID,
    artifactId: blank.artifactId,
    sessionId
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  seedSemanticDeck()
    .then((r) => {
      console.log(`seed_semantic_deck: ok → ${r.outDir}`);
      console.log(JSON.stringify(r.identity, null, 2));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
