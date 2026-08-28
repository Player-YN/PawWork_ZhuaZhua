/**
 * Site preview multi-pin must survive to host / web / inspect — not only the last click.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionWorkspaceStore } from '../../../src/agent/vnext/runSession.product.js';
import { SessionWorkspaceService } from '../../../src/agent/vnext/service/sessionWorkspaceService.js';
import { createSessionTools } from '../../../src/agent/vnext/sessionWorkspace/tools.js';
import { beginExecution } from '../../../src/agent/vnext/sessionWorkspace/execution.js';
import { createSessionGuestFs } from '../../../src/agent/vnext/sessionWorkspace/fs.js';
import { nextSitePinIds } from '../../../src/agent/vnext/sessionWorkspace/siteApply.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let failed = 0;
function record(name, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'BREACH'}] ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

const RAW = `<!DOCTYPE html>
<html data-paw-kind="site">
<head><meta charset="utf-8" /><title>Acme</title></head>
<body>
  <h1>Welcome</h1>
  <p>Hello world</p>
</body>
</html>`;

{
  const toggled = nextSitePinIds(['n1'], 'n2', { ctrlKey: true });
  record('ctrl-toggle-adds-second', toggled.length === 2 && toggled.includes('n1') && toggled.includes('n2'), toggled.join(','));
}

{
  const store = new SessionWorkspaceStore();
  const svc = new SessionWorkspaceService({ store });
  svc.ensureSession('s-pins');
  const execution = beginExecution(store, 's-pins', {});
  const guest = createSessionGuestFs(store, { sessionId: 's-pins', executionId: execution.executionId });
  guest.mkdirp('/artifacts');
  const tools = createSessionTools({ store, execution, fs: guest, sessionId: 's-pins' });
  const created = await tools.run.execute({
    op: 'write_artifact',
    name: 'home.html',
    mimeType: 'text/html',
    content: RAW
  });
  record('site-created', created.ok === true, created.error);
  const read = await tools.web.execute({ act: 'read' });
  const h1 = read.nodes?.find((n) => n.tag === 'h1');
  const p = read.nodes?.find((n) => n.tag === 'p');
  record('two-nodes', !!(h1?.nodeId && p?.nodeId), `${h1?.nodeId},${p?.nodeId}`);

  await svc.setActiveHtml({
    sessionId: 's-pins',
    artifactId: created.artifact.artifactId,
    overview: {
      kind: 'site',
      selections: [
        { nodeId: h1.nodeId, tag: 'h1', kind: 'text' },
        { nodeId: p.nodeId, tag: 'p', kind: 'text' }
      ]
    }
  });
  const host = store.get('sessions', 's-pins').activeHtml.selections || [];
  record(
    'host-keeps-both-pins',
    host.length === 2 && host[0].nodeId === h1.nodeId && host[1].nodeId === p.nodeId,
    host.map((s) => s.nodeId).join(',')
  );

  const webRead = await tools.web.execute({ act: 'read' });
  record(
    'web-read-sees-both',
    Array.isArray(webRead.selected) &&
      webRead.selected.length === 2 &&
      webRead.selected.includes(h1.nodeId) &&
      webRead.selected.includes(p.nodeId),
    String(webRead.selected)
  );

  const wrote = await tools.web.execute({ act: 'write', text: 'Together' });
  const html = guest.readFile(created.artifact.primaryPath);
  const hits = (html.match(/>Together</g) || []).length;
  record(
    'web-write-applies-all-pins',
    wrote.ok === true && hits === 2 && Array.isArray(wrote.selected) && wrote.selected.length === 2,
    `hits=${hits} selected=${wrote.selected}`
  );

  const inspected = await tools.inspect.execute({ view: 'html' });
  record(
    'inspect-sees-both-pins',
    inspected.kind === 'site' &&
      Array.isArray(inspected.selected) &&
      inspected.selected.length === 2 &&
      inspected.selected.includes(h1.nodeId) &&
      inspected.selected.includes(p.nodeId),
    String(inspected.selected)
  );
}

{
  const siteJs = fs.readFileSync(path.join(root, 'src/preview/site.js'), 'utf8');
  record(
    'preview-reports-full-selections',
    /html_tab_state/.test(siteJs) &&
      /nextSitePinIds/.test(siteJs) &&
      /ctrlKey/.test(siteJs) &&
      /metaKey/.test(siteJs) &&
      /siteSelectionsFromIds/.test(siteJs)
  );
}

console.log(`wave_site_multiselect: failed=${failed}`);
if (failed > 0) process.exit(1);
