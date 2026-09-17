import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handleWorkspacePageAction, invalidatePageActionTarget } from '../src/agent/vnext/host/pageActionHost.js';
import { resetTabLeases } from '../src/agent/vnext/host/tabLease.js';
import { consumeDispatchTicket, putDispatchTicket } from '../src/agent/vnext/host/dispatchTicket.js';
import { installTestPolicy, resetTestPolicy, seedAutoTicket, seedResolvedActionTicket } from './helpers/policyTestKit.mjs';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const src = join(root, 'src/agent/vnext/host');

function fixture() {
  installTestPolicy();
  resetTabLeases();
  invalidatePageActionTarget(11);
  globalThis.chrome = {
    tabs: {
      get: async (id) => ({ id, url: 'https://example.com/a', title: 'Test' }),
      sendMessage: async (_tabId, message) => {
        if (message.op === 'snapshot') {
          return {
            ok: true,
            controls: [
              { ref: 'a1', name: 'Save' },
              { ref: 'a2', name: 'Pay now' }
            ],
            frameUrl: 'https://example.com/a'
          };
        }
        if (message.op === 'resolve_name') {
          const name = message.name || message.label || 'Save';
          const ref = /pay/i.test(name) ? 'a2' : 'a1';
          return { matches: [{ ref, name }] };
        }
        return { ok: true, after: { ref: 'a1' } };
      }
    },
    webNavigation: {
      getFrame: async () => ({ frameId: 0, documentId: 'doc-a', documentLifecycle: 'active', url: 'https://example.com/a' }),
      getAllFrames: async () => [{ frameId: 0, parentFrameId: -1, documentId: 'doc-a', url: 'https://example.com/a' }]
    },
    scripting: { executeScript: async () => [] }
  };
}

test('direct SW page mutate without a ticket cannot dispatch; payment ticket still denied', async () => {
  fixture();
  const snap = await handleWorkspacePageAction({ tabId: 11, sessionId: 's', executionId: 'e', op: 'snapshot' });
  const bare = await handleWorkspacePageAction({
    tabId: 11, sessionId: 's', executionId: 'e', op: 'click', name: 'Save', rev: snap.rev
  });
  assert.equal(bare.code, 'TICKET_REQUIRED');

  const payReq = { tabId: 11, sessionId: 's', executionId: 'e', op: 'click', name: 'Pay now', rev: snap.rev };
  const seeded = await seedResolvedActionTicket(handleWorkspacePageAction, payReq, { name: 'Pay now' });
  Object.assign(payReq, {
    operationId: seeded.operationId,
    ticketNonce: seeded.ticketNonce,
    payloadHash: seeded.payloadHash,
    documentId: seeded.documentId
  });
  const pay = await handleWorkspacePageAction(payReq);
  assert.equal(pay.code, 'PAYMENT_DENIED');
  resetTestPolicy();
});

test('action and sys host files authorize before chrome side effects', () => {
  const page = readFileSync(join(src, 'pageActionHost.js'), 'utf8');
  assert.match(page, /authorizePageActionDispatch/);
  assert.match(page, /consumeDispatchTicket/);
  const sys = readFileSync(join(src, 'browserSysHost.js'), 'utf8');
  for (const name of ['sysEval', 'sysDownload', 'sysTabsClose', 'sysCdp', 'sysFetchAsExtension', 'sysScreenshot', 'sysUpload']) {
    assert.match(sys, new RegExp(`async function ${name}[\\s\\S]*authorizeSysDispatch`));
  }
  const service = readFileSync(join(root, 'src/agent/vnext/service/sessionWorkspaceService.js'), 'utf8');
  assert.match(service, /hostPageAction:[\s\S]*_gatedPageAction/);
  assert.match(service, /hostSys:[\s\S]*_gatedSys/);
});

test('a Save ticket cannot authorize a known delete at the SW door', async () => {
  installTestPolicy({ mode: 'full' });
  await putDispatchTicket({
    operationId: 'op-mix',
    sessionId: 's',
    executionId: 'e',
    nonce: 'n',
    payloadHash: 'h',
    risk: 'reversible-write',
    tabId: 11,
    documentId: 'doc-a',
    exp: Date.now() + 60_000
  });
  const out = await consumeDispatchTicket(
    { operationId: 'op-mix', sessionId: 's', executionId: 'e', payloadHash: 'h', ticketNonce: 'n', tabId: 11, documentId: 'doc-a' },
    { channel: 'action', op: 'click', name: 'Delete', tabId: 11, documentId: 'doc-a' }
  );
  assert.equal(out.ok, false);
  assert.equal(out.code, 'APPROVAL_MISMATCH');
  resetTestPolicy();
});
