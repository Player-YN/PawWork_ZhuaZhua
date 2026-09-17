/**
 * Preview UI language. Query `lang` wins. Otherwise navigator language.
 * Do not treat a hardcoded <html lang="zh-CN"> as the user preference.
 */

export function resolvePreviewLang({ query = '', documentLang = '', navigatorLang = '' } = {}) {
  void documentLang;
  const q = String(query || '').trim().toLowerCase();
  if (q === 'en' || q.startsWith('en-')) return 'en';
  if (q === 'zh' || q.startsWith('zh-')) return 'zh';
  const nav = String(navigatorLang || '').toLowerCase();
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}
