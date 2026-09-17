import {
  ACCESS_POLICY_SCHEMA,
  createMemoryAccessPolicyStorage,
  installAccessPolicyStorage,
  resetAccessPolicyStorage,
  writeAccessPolicy
} from '../../src/agent/vnext/host/accessPolicy.js';
import {
  installDispatchTicketStorage,
  putDispatchTicket,
  resetDispatchTicketStorage
} from '../../src/agent/vnext/host/dispatchTicket.js';
import { classifyRisk, needsDispatchTicket } from '../../src/agent/vnext/host/riskClassify.js';
import { hashOperationPayload, newNonce, newOperationId } from '../../src/agent/vnext/host/payloadHash.js';

export function installTestPolicy({ mode } = {}) {
  const areas = createMemoryAccessPolicyStorage(
    mode === 'full'
      ? { profile: { schema: ACCESS_POLICY_SCHEMA, mode: 'full', updatedAt: 1, updatedBy: 'ui' } }
      : {}
  );
  installAccessPolicyStorage(areas);
  installDispatchTicketStorage(areas.session);
  return areas;
}

export function resetTestPolicy() {
  resetAccessPolicyStorage();
  resetDispatchTicketStorage();
}

export function classifyForRequest(request = {}, extra = {}) {
  const params = extra.params || request.params || {};
  const channel = extra.channel ||
    (extra.sysOp || request.sysOp || (request.op && String(request.op).includes('.')) ? 'sys' : extra.channel) ||
    (['eval', 'waitFor', 'fetch', 'cdp', 'download', 'screenshot', 'help', 'capabilities'].includes(request.op) ||
      String(request.op || '').startsWith('tabs.')
      ? 'sys'
      : 'action');
  return classifyRisk({
    channel,
    op: extra.op || request.op,
    sysOp: extra.sysOp || (channel === 'sys' ? request.op : undefined),
    name: extra.name || request.name || request.label,
    key: extra.key || request.key,
    url: extra.frameUrl || extra.url || request.url || params.url,
    frameUrl: extra.frameUrl || request.frameUrl,
    method: extra.method || params.init?.method || params.method,
    code: extra.code || params.code || request.code,
    control: extra.control,
    tabId: extra.tabId ?? request.tabId ?? params.tabId,
    documentId: extra.documentId || request.documentId || params.documentId,
    action: extra.action || params.action,
    hints: extra.hints
  });
}

function seedHashInput(request = {}, extra = {}, channel) {
  if (extra.hashInput) return extra.hashInput;
  const op = extra.op || request.op;
  if (channel === 'sys') {
    return {
      channel: 'sys',
      op,
      sysOp: extra.sysOp || op,
      url: extra.url || request.url || request.params?.url,
      method: extra.method || request.params?.init?.method || request.params?.method,
      code: extra.code || request.params?.code || request.code,
      tabId: extra.tabId ?? request.tabId ?? request.params?.tabId,
      documentId: extra.documentId || request.documentId || request.params?.documentId
    };
  }
  return {
    channel: 'action',
    op,
    ref: extra.ref || request.ref || extra.control?.ref || '',
    name: extra.name || request.name || request.label || extra.control?.name || '',
    key: request.key,
    url: extra.frameUrl || extra.control?.frameUrl || extra.url || request.url || '',
    frameUrl: extra.frameUrl || extra.control?.frameUrl || '',
    tabId: extra.tabId ?? request.tabId,
    documentId: extra.documentId || request.documentId || extra.control?.documentId || '',
    frameId: extra.frameId ?? request.frameId ?? extra.control?.frameId ?? 0,
    value: request.value,
    fields: request.fields
  };
}

/** Seed a one-shot ticket with a real payload hash and nonce. Never seeds an empty hash. */
export async function seedAutoTicket(request, extra = {}) {
  const classified = extra.classified || classifyForRequest(request, extra);
  const operationId = request.operationId || extra.operationId || newOperationId();
  const nonce = extra.nonce || request.ticketNonce || newNonce();
  const params = extra.params || request.params || {};
  const channel = extra.channel ||
    (['eval', 'waitFor', 'fetch', 'cdp', 'download', 'screenshot', 'help', 'capabilities'].includes(request.op) ||
      String(request.op || '').startsWith('tabs.')
      ? 'sys'
      : 'action');
  const payloadHash = extra.payloadHash || await hashOperationPayload(seedHashInput(request, extra, channel));
  if (needsDispatchTicket(classified)) {
    await putDispatchTicket({
      operationId,
      nonce,
      sessionId: String(request.sessionId || extra.sessionId || ''),
      executionId: String(request.executionId || extra.executionId || ''),
      risk: classified.risk,
      payloadHash,
      tabId: extra.tabId ?? request.tabId ?? params.tabId,
      documentId: extra.documentId || request.documentId || params.documentId,
      exp: extra.exp || Date.now() + 60_000
    });
  }
  return { operationId, classified, payloadHash, ticketNonce: nonce };
}

export async function seedResolvedActionTicket(handle, request, extra = {}) {
  const resolved = await handle({
    ...request,
    op: 'resolve_intent',
    targetOp: request.op
  });
  if (!resolved?.ok) return { resolved, operationId: '', ticketNonce: '' };
  const seeded = await seedAutoTicket(request, {
    ...extra,
    channel: 'action',
    payloadHash: resolved.payloadHash,
    documentId: resolved.documentId,
    tabId: request.tabId,
    frameUrl: resolved.frameUrl,
    name: resolved.name,
    ref: resolved.ref,
    classified: resolved.classified
  });
  return { resolved, ...seeded, documentId: resolved.documentId };
}

export { writeAccessPolicy, classifyRisk, needsDispatchTicket, hashOperationPayload };
