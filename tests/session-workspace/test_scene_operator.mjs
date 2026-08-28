import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionWorkspaceRuntime, SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { createSessionGuestFs } from '../../src/agent/vnext/sessionWorkspace/fs.js';
import { beginExecution } from '../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionTools } from '../../src/agent/vnext/sessionWorkspace/tools.js';
import { isPawCanvasDoc, listEngineNodes } from '../../src/agent/vnext/sessionWorkspace/engineCanvas.js';
import { parseMarkedHtml } from '../../src/agent/vnext/sessionWorkspace/htmlApply.js';
import {
  createScene,
  compilePageHtml,
  compileSelectionFragments
} from '../../src/agent/vnext/sessionWorkspace/sceneCompile.js';
import { pdfBytesToHtml, PDF_VISUAL_WARNING } from '../../src/agent/vnext/sessionWorkspace/pdfIngest.js';
import { buildSessionAgentInstructions } from '../../src/agent/vnext/sessionWorkspace/prompt.js';
import { loadSkillInstructions } from '../../src/agent/vnext/skills/registry.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const simplePdf = path.join(dir, 'fixtures', 'pdf', 'simple.pdf');

const PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<body>
  <section class="hero-section">
    <h1>闪念贝壳</h1>
    <img src="https://example.com/hero.png" alt="hero photo">
    <a class="cta" href="/watch">观看视频</a>
    <p>产品介绍不应糊成整段唯一槽</p>
  </section>
</body>
</html>`;

function makeBitmapPdf() {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(28, 0x00), Buffer.from([0xff, 0xd9])]);
  const stream = jpeg.toString('latin1');
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /XObject /Subtype /Image /Width 720 /Height 1080 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Length 18 >>
stream
q 612 0 0 792 0 0 cm /Im0 Do Q
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
  return Uint8Array.from(Buffer.from(body, 'latin1'));
}

async function runOnce() {
  const compiledDirect = compilePageHtml(PAGE_HTML, { kind: 'poster' });
  assert.equal(compiledDirect.ok, true);
  assert.ok(compiledDirect.nodes.length >= 3, `leaf count ${compiledDirect.nodes.length}`);

  const store = new SessionWorkspaceStore();
  const runtime = createSessionWorkspaceRuntime(store);
  const sessionId = 's-scene-operator';
  runtime.createSession({ sessionId });
  const execution = beginExecution(store, sessionId, {});
  const guest = createSessionGuestFs(store, { sessionId, executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId });

  const created = await tools.run.execute({
    op: 'html',
    name: 'page-poster.html',
    commands: [{ op: 'createScene', source: 'page', html: PAGE_HTML, kind: 'poster' }]
  });
  assert.equal(created.ok, true, created.error);
  assert.ok(created.artifact?.artifactId, 'createScene must persist an artifact');
  const artifactId = created.artifact.artifactId;
  const raw = guest.readFile(created.artifact.primaryPath);
  assert.equal(isPawCanvasDoc(raw), true, 'createScene persists a pawCanvas snapshot');
  const nodes = listEngineNodes(raw);
  assert.ok(nodes.some((n) => n.type === 'frame'));
  const heading = nodes.find((n) => /闪念贝壳/.test(n.text));
  assert.ok(heading, 'heading must be its own node');
  const image = nodes.find((n) => n.type === 'image' || /hero\.png/.test(n.src));
  assert.ok(image, 'image must be its own node');
  const control = nodes.find((n) => /观看视频/.test(n.text));
  assert.ok(control, 'control must be its own node');
  assert.notEqual(heading.nodeId, image.nodeId);
  assert.notEqual(heading.nodeId, control.nodeId);

  const inspected = await tools.inspect.execute({ view: 'html', artifactId });
  assert.equal(inspected.ok, true, inspected.error);
  assert.ok(Array.isArray(inspected.nodes) && inspected.nodes.length >= 3, 'inspect lists nodes');
  const sample = inspected.nodes.find((n) => n.id === heading.nodeId || n.slotId === heading.nodeId);
  assert.ok(sample, 'inspect sample includes heading id');
  assert.match(String(sample.text || ''), /闪念贝壳/);
  const imgSample = inspected.nodes.find((n) => n.id === image.nodeId);
  assert.ok(imgSample);
  assert.match(String(imgSample.src || ''), /hero\.png/);

  const siblingBefore = control.text;
  const imageSrcBefore = image.src;
  const wrote = await tools.deck.execute({
    act: 'write',
    artifactId,
    nodeId: heading.nodeId,
    text: 'NEW TITLE'
  });
  assert.equal(wrote.ok, true, wrote.error);
  assert.equal(wrote.readback?.text || wrote.readback?.slot?.text, 'NEW TITLE');
  const afterRaw = guest.readFile(created.artifact.primaryPath);
  const afterNodes = listEngineNodes(afterRaw);
  const afterHeading = afterNodes.find((s) => s.nodeId === heading.nodeId);
  const afterControl = afterNodes.find((s) => s.nodeId === control.nodeId);
  const afterImage = afterNodes.find((s) => s.nodeId === image.nodeId);
  assert.equal(afterHeading?.text, 'NEW TITLE');
  assert.equal(afterControl?.text, siblingBefore);
  assert.equal(afterImage?.src, imageSrcBefore);
  assert.doesNotMatch(JSON.stringify(afterNodes), /闪念贝壳/);

  const sel = await tools.run.execute({
    op: 'html',
    name: 'sel-poster.html',
    commands: [
      {
        op: 'fromSelection',
        kind: 'poster',
        fragments: [{ html: '<h2>选区标题</h2>' }, { html: '<img src="https://example.com/shot.png" alt="shot">' }]
      }
    ]
  });
  assert.equal(sel.ok, true, sel.error);
  const selRaw = guest.readFile(sel.artifact.primaryPath);
  assert.equal(isPawCanvasDoc(selRaw), true);
  const selNodes = listEngineNodes(selRaw);
  assert.ok(selNodes.length >= 2, `selection compile nodes ${selNodes.map((s) => s.nodeId).join(',')}`);
  assert.ok(selNodes.some((s) => /选区标题/.test(s.text)));
  assert.ok(selNodes.some((s) => /shot\.png/.test(s.src)));

  const directSel = compileSelectionFragments(['<p>Quote A</p>', '<p>Quote B</p>'], { kind: 'poster' });
  assert.ok(directSel.nodes.length >= 2);

  const nodeCreated = await tools.run.execute({
    op: 'html',
    name: 'nodes-poster.html',
    commands: [
      {
        op: 'createScene',
        kind: 'poster',
        nodes: [
          { id: 'headline', type: 'headline', text: 'Node Title' },
          { id: 'cover', type: 'image', src: 'https://example.com/n.png', alt: 'n' }
        ]
      }
    ]
  });
  assert.equal(nodeCreated.ok, true, nodeCreated.error);
  const nodeRaw = guest.readFile(nodeCreated.artifact.primaryPath);
  assert.equal(isPawCanvasDoc(nodeRaw), true);
  const nodeSlots = listEngineNodes(nodeRaw);
  assert.ok(nodeSlots.some((s) => /headline/.test(s.nodeId) && /Node Title/.test(s.text)));
  assert.ok(nodeSlots.some((s) => /cover/.test(s.nodeId) && /n\.png/.test(s.src)));

  const pdfBytes = fs.readFileSync(simplePdf);
  const pdf = await pdfBytesToHtml(pdfBytes);
  assert.equal(pdf.ok, true);
  const pdfSlots = (parseMarkedHtml(pdf.html).plates || []).flatMap((p) => p.slots || []);
  assert.ok(
    pdfSlots.some((s) => /PawPdfHello/.test(s.text)),
    'text PDF reconstructs a text slot'
  );
  assert.match(pdf.html, /data-paw-slot="t0"/);

  const visual = await pdfBytesToHtml(makeBitmapPdf(), { title: 'poster-scan' });
  assert.equal(visual.ok, true);
  assert.match(visual.html, /data-paw-slot="cover"/);
  assert.match(visual.warning || '', /not layered|bitmap/i);
  assert.equal(visual.warning, PDF_VISUAL_WARNING);
  const visualSlots = (parseMarkedHtml(visual.html).plates || []).flatMap((p) => p.slots || []);
  const covers = visualSlots.filter((s) => s.id === 'cover' || s.tag === 'img');
  assert.ok(covers.length >= 1);
  assert.equal(
    visualSlots.filter((s) => s.id && s.id !== 'cover' && /^t\d+$/.test(s.id)).length,
    0,
    'bitmap PDF must not invent extra text layers'
  );

  const policy = buildSessionAgentInstructions({ sessionId, inventory: {} });
  assert.match(policy, /last-resort|last resort/i);
  assert.doesNotMatch(policy, /fromRaster/);
  assert.doesNotMatch(policy, /fill templates\/poster\.html as the regular/i);
  const posterSkill = loadSkillInstructions('poster', { sessionId }) || '';
  assert.match(posterSkill, /fromPage/);
  assert.match(posterSkill, /deck/);
  assert.match(posterSkill, /last resort|last-resort/i);
  const deckSkill = loadSkillInstructions('slides', { sessionId }) || '';
  assert.match(deckSkill, /createScene|fromPage|fromSelection/);

  const sceneApi = createScene({ op: 'fromPage', html: PAGE_HTML, kind: 'poster' });
  assert.equal(sceneApi.ok, true);
  assert.ok((sceneApi.nodes || []).length >= 3);

  console.log('test_scene_operator: ok');
}

async function run() {
  await runOnce();
  await runOnce();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
