/**
 * Legitimate tldraw production license resolution.
 * Never log the key. Missing key keeps official watermark/dev behavior.
 */

export const TLDRAW_LICENSE_STORAGE_KEY = 'pagewand_tldraw_license';
export const TLDRAW_LICENSE_MISSING_BLOCKER =
  'PAW_TLDRAW_LICENSE_KEY missing — official tldraw watermark remains; production ship is blocked until a real key is configured';

function envLicenseKey() {
  try {
    if (typeof process === 'undefined' || !process.env) return '';
    return String(process.env.PAW_TLDRAW_LICENSE_KEY || process.env.TLDRAW_LICENSE_KEY || '').trim();
  } catch {
    return '';
  }
}

export function resolveTldrawLicenseKey(opts = {}) {
  const fromOpt = String(opts.licenseKey || '').trim();
  if (fromOpt) return { key: fromOpt, source: 'option' };
  const fromBuild = envLicenseKey();
  if (fromBuild) return { key: fromBuild, source: 'build' };
  return { key: '', source: 'missing' };
}

export function tldrawLicenseStatus(opts = {}) {
  const resolved = resolveTldrawLicenseKey(opts);
  const present = resolved.key.length > 0;
  return {
    present,
    source: present ? resolved.source : 'missing',
    productionReady: present,
    blocker: present ? null : TLDRAW_LICENSE_MISSING_BLOCKER
  };
}
