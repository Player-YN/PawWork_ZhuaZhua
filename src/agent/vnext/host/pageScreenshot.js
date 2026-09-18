/** Viewport JPEG for short-path action / sys.screenshot vision. */

export const PAGE_SHOT_JPEG_QUALITY = 50;

function splitDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!m) return null;
  return { contentType: m[1], base64: m[2] };
}

/**
 * @param {typeof chrome} chromeLike
 * @param {number} tabId
 */
export async function captureVisibleJpeg(chromeLike, tabId) {
  const id = Number(tabId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, code: 'NEED_EXPLICIT_TAB', error: 'screenshot requires tabId' };
  }
  if (typeof chromeLike?.tabs?.captureVisibleTab !== 'function') {
    return { ok: false, code: 'NEED_PAGE', error: 'captureVisibleTab unavailable' };
  }
  let tab;
  try {
    tab = await chromeLike.tabs.get(id);
  } catch (error) {
    return { ok: false, code: 'NEED_PAGE', error: error?.message || String(error) };
  }
  try {
    const [active] = await chromeLike.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id) {
      return { ok: false, code: 'TAB_NOT_VISIBLE', error: 'Target tab is not visible.' };
    }
  } catch {
    /* query may fail in tests without windows */
  }
  const dataUrl = await chromeLike.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: PAGE_SHOT_JPEG_QUALITY
  });
  const parsed = splitDataUrl(dataUrl);
  if (!parsed?.base64) return { ok: false, code: 'SYS_FAILED', error: 'screenshot produced no image' };
  return {
    ok: true,
    base64: parsed.base64,
    mediaType: parsed.contentType || 'image/jpeg',
    tabId: id
  };
}
