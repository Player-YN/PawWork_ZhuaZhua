/**
 * Shared UI language for Univer Sheets / Docs (classic ribbon).
 * Excel and Word stay on the same memory so switching one follows the other.
 */

const KEY = 'pawwork_office_locale';
const LEGACY_SHEET_KEY = 'pawwork_sheet_locale';

export function officeUiLang() {
  try {
    const s = String(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_SHEET_KEY) || '').toLowerCase();
    if (s === 'en' || s === 'en-us') return 'en';
    if (s === 'zh' || s === 'zh-cn') return 'zh';
  } catch {
    /* */
  }
  return /en/i.test(navigator.language || '') ? 'en' : 'zh';
}

export function persistOfficeUiLang(lang) {
  const v = lang === 'en' ? 'en' : 'zh';
  try {
    localStorage.setItem(KEY, v);
    localStorage.setItem(LEGACY_SHEET_KEY, v);
  } catch {
    /* */
  }
}

export function applyOfficeDocumentLang(lang) {
  try {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  } catch {
    /* */
  }
}
