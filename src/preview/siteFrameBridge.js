/**
 * Parent-side site frame helpers. Guest runtime lives in the sandbox page
 * `src/sandbox/siteFrame.html` (external script). Do not inject inline <script>
 * into srcdoc — extension CSP blocks it and this wave does not execute guest JS.
 */

export {
  SITE_FRAME_CHANNEL,
  SITE_FRAME_PAGE,
  SITE_FRAME_SANDBOX,
  createSiteFrameRuntime,
  isSiteFrameEnvelope,
  isTrustedSiteChildEvent,
  isTrustedSiteParentEvent
} from '../sandbox/siteFrameRuntime.js';

import { isSiteFrameEnvelope } from '../sandbox/siteFrameRuntime.js';

export function isSiteFrameMessage(ev) {
  return isSiteFrameEnvelope(ev?.data || ev);
}

export function siteFrameUrl(getURL) {
  const path = 'src/sandbox/siteFrame.html';
  if (typeof getURL === 'function') return getURL(path);
  return `../sandbox/siteFrame.html`;
}
