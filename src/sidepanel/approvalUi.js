/**
 * Host approval pop-card. Reuses clarify-live visuals, not clarifyId / plan cards.
 */

import { approvalBelongsToSession } from './sessionIsolation.js';

export function approvalBannerText(rec, t) {
  if (!rec) return '';
  if (rec.kind === 'payment-handoff' || rec.type === 'policy-blocked' || rec.risk === 'payment') {
    return t('approvalPaymentWait');
  }
  if (rec.risk === 'delete') return t('approvalBannerDelete');
  return t('approvalBannerAmbiguous');
}

export function renderApprovalCard(host, rec, deps) {
  if (!host || !rec) return null;
  const t = deps.t;
  host.className = 'clarify-live approval-live';
  host.dataset.approvalId = String(rec.approvalId || '');
  host.dataset.operationId = String(rec.operationId || '');
  host.dataset.sessionId = String(rec.sessionId || '');
  host.dataset.risk = String(rec.risk || '');
  const payment = rec.kind === 'payment-handoff' || rec.type === 'policy-blocked' || rec.risk === 'payment' || rec.decisionRequired === false;
  const riskClass = rec.risk === 'delete' ? 'is-delete' : payment ? 'is-payment' : 'is-ambiguous';
  const banner = document.createElement('div');
  banner.className = 'clarify-live-banner approval-live-banner';
  banner.innerHTML = `<span class="clarify-live-orb" aria-hidden="true"></span><span class="clarify-live-banner-text">${escape(approvalBannerText(rec, t))}</span>`;
  const body = document.createElement('div');
  body.className = 'approval-live-body';
  const badge = document.createElement('div');
  badge.className = `approval-risk ${riskClass}`;
  badge.textContent = rec.risk === 'delete' ? t('approvalRiskDelete') : payment ? t('approvalRiskPayment') : t('approvalRiskAmbiguous');
  const summary = document.createElement('p');
  summary.className = 'approval-summary';
  summary.textContent = String(rec.summary || '');
  const detail = document.createElement('p');
  detail.className = 'approval-detail';
  detail.textContent = [rec.detail, hostLabel(rec.url)].filter(Boolean).join(' · ');
  const ttl = document.createElement('p');
  ttl.className = 'approval-ttl';
  ttl.dataset.expiresAt = String(rec.expiresAt || '');
  ttl.textContent = formatTtl(rec.expiresAt, t);
  body.append(badge, summary, detail, ttl);
  host.replaceChildren(banner, body);
  if (!payment) {
    const actions = document.createElement('div');
    actions.className = 'clarify-live-actions approval-live-actions';
    const deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'btn btn-secondary';
    deny.textContent = t('approvalDeny');
    deny.addEventListener('click', () => deps.onDeny?.(rec));
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'btn btn-primary';
    approve.textContent = t('approvalApprove');
    approve.addEventListener('click', () => deps.onApprove?.(rec));
    actions.append(deny, approve);
    host.append(actions);
  }
  return host;
}

function hostLabel(url) {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
}

function formatTtl(expiresAt, t) {
  const ms = Number(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return t('approvalExpired');
  const min = Math.max(1, Math.ceil(ms / 60000));
  return t('approvalTtl').replace('{min}', String(min));
}

function escape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createApprovalUi(deps) {
  let current = null;

  function hostFor(sessionId) {
    const sid = String(sessionId || '');
    const task = deps.getLiveTask?.(sid);
    const existing = task?.el?.querySelector?.('.approval-live');
    if (existing) return existing;
    if (!task?.el && !task?.body) return document.getElementById('approvalLive');
    const node = document.createElement('div');
    node.className = 'clarify-live approval-live';
    (task.body || task.el).append(node);
    return node;
  }

  function hide(sessionId) {
    const sid = String(sessionId || current?.sessionId || '');
    if (current && sid && !approvalBelongsToSession(current.sessionId, sid)) return;
    const host = hostFor(sid);
    host?.remove();
    current = null;
    deps.getComposer?.()?.classList.remove('is-clarifying');
    deps.getPanel?.()?.classList.remove('is-clarifying');
    deps.getLiveTask?.(sid)?.el?.classList.remove('is-clarifying');
  }

  function showBlocked(rec) {
    return show({
      ...rec,
      type: 'policy-blocked',
      kind: rec?.kind || 'payment-handoff',
      risk: rec?.risk || 'payment',
      decisionRequired: false,
      approvalId: ''
    });
  }

  function show(rec) {
    const sid = String(rec?.sessionId || '');
    const active = String(deps.getSessionId?.() || '');
    if (!approvalBelongsToSession(sid, active)) return null;
    if (rec?.type === 'approval-required' && (rec.risk === 'payment' || rec.decisionRequired === false)) {
      return showBlocked(rec);
    }
    current = rec;
    const host = hostFor(sid);
    if (!host) return null;
    renderApprovalCard(host, rec, {
      t: deps.t,
      onApprove: (row) => deps.answerApproval?.({ approvalId: row.approvalId, sessionId: row.sessionId, decision: 'approve' }),
      onDeny: (row) => deps.answerApproval?.({ approvalId: row.approvalId, sessionId: row.sessionId, decision: 'deny' })
    });
    deps.getLiveTask?.(sid)?.el?.classList.add('is-clarifying');
    deps.getComposer?.()?.classList.add('is-clarifying');
    deps.getPanel?.()?.classList.add('is-clarifying');
    return host;
  }

  function snapshot() {
    return current;
  }

  return { show, showBlocked, hide, snapshot, renderApprovalCard };
}
