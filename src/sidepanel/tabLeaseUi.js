/**
 * Human copy for SW tab-lease conflicts. No Chrome-profile flow.
 */

export function tabLeasePayload(ev = {}) {
  const result = ev.result && typeof ev.result === 'object' ? ev.result : {};
  const code = String(ev.code || result.code || '');
  if (code !== 'TAB_LEASED' && code !== 'NEED_EXPLICIT_TAB') return null;
  return {
    code,
    title: ev.title || result.title || '',
    tabId: ev.tabId ?? result.tabId ?? '',
    holderSessionId: ev.holderSessionId || result.holderSessionId || '',
    error: ev.error || ev.message || result.error || ''
  };
}

export function formatTabLeaseMessage(t, payload = {}, holderName = '') {
  const code = String(payload.code || '');
  if (code === 'TAB_LEASED') {
    const title = String(payload.title || '').trim() || (payload.tabId != null && payload.tabId !== '' ? `#${payload.tabId}` : 'tab');
    const name = String(holderName || payload.holderSessionId || '').trim() || payload.holderSessionId || 'session';
    return String(t('tabLeased') || '')
      .replace('{title}', title)
      .replace('{name}', name);
  }
  if (code === 'NEED_EXPLICIT_TAB') {
    return String(t('needExplicitTab') || payload.error || '');
  }
  return String(payload.error || payload.message || '');
}
