/**
 * Inline SVG icons (consistent chrome; no emoji dependency for primary actions).
 */

/** @param {string} pathD @param {{ size?: number, stroke?: number }} [o] */
function svg(pathD, o = {}) {
  const size = o.size ?? 16;
  const sw = o.stroke ?? 2;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathD}</svg>`;
}

/**
 * Soft cat-paw mark (filled pads) — brand + 伸爪.
 * Geometry: 4 toe pads arc above a larger palm pad (classic print, not aggressive claws).
 * @param {number} [size]
 * @param {{ filled?: boolean, className?: string, beans?: boolean }} [o]
 *   beans: tag toe pads as .paw-bean for home hover easter egg (default false)
 */
export function pawSvg(size = 16, o = {}) {
  const filled = o.filled !== false;
  const beans = !!o.beans;
  const cls = o.className ? ` class="${o.className}"` : ' class="paw-svg"';
  const bean = beans ? ' class="paw-bean"' : '';
  const palm = beans ? ' class="paw-palm"' : '';
  // Slightly roomier pads so small sizes still read as a paw
  const pads = filled
    ? `<ellipse${bean} cx="7.2" cy="8" rx="2.35" ry="2.9" fill="currentColor"/>
       <ellipse${bean} cx="12" cy="6.2" rx="2.45" ry="3.05" fill="currentColor"/>
       <ellipse${bean} cx="16.8" cy="8" rx="2.35" ry="2.9" fill="currentColor"/>
       <ellipse${bean} cx="19.2" cy="12.2" rx="2.1" ry="2.55" fill="currentColor"/>
       <ellipse${palm} cx="12" cy="16.1" rx="5.6" ry="4.7" fill="currentColor"/>`
    : `<ellipse cx="7.2" cy="8" rx="2.35" ry="2.9"/>
       <ellipse cx="12" cy="6.2" rx="2.45" ry="3.05"/>
       <ellipse cx="16.8" cy="8" rx="2.35" ry="2.9"/>
       <ellipse cx="19.2" cy="12.2" rx="2.1" ry="2.55"/>
       <ellipse cx="12" cy="16.1" rx="5.6" ry="4.7"/>`;
  return `<svg${cls} viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}" stroke-width="${filled ? 0 : 1.5}">${pads}</svg>`;
}

export const ICONS = {
  send: svg('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>', { size: 18 }),
  stop: `<span class="stop-icon-box" aria-hidden="true"></span>`,
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
  ),
  moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  system: svg(
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
  ),
  paperclip: svg(
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
  ),
  wand: svg(
    '<path d="m15 4-1 3-3 1 3 1 1 3 1-3 3-1-3-1z"/><path d="M4 20 14 10"/><path d="m18 8 2 2"/>'
  ),
  /** Brand / 伸爪 — cat paw */
  paw: pawSvg(16),
  pawLg: pawSvg(22),
  /** Subtle pushpin / nail for selection → clipboard */
  pin: svg(
    '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11-2.36l1-4A2 2 0 0 1 10.76 2h2.48a2 2 0 0 1 1.87 2.4l-1 4A2 2 0 0 1 13 10.76V17"/><path d="M8 17h8"/>',
    { size: 14, stroke: 1.75 }
  ),
  gear: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  ),
  more: svg(
    '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>'
  ),
  /** Lucide pencil — session / group rename */
  pencil: svg(
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    { size: 13 }
  )
};

/**
 * Optional topbar SVG icons (keeps accessible names on the button).
 * Emoji fallback remains if this is not called.
 */
export function enhanceTopbarIcons() {
  const gear = document.getElementById('gearBtn');
  if (gear && !gear.querySelector('svg')) {
    gear.innerHTML = ICONS.gear;
  }
  const more = document.getElementById('moreBtn');
  if (more && !more.querySelector('svg')) {
    more.innerHTML = ICONS.more;
  }
  // Brand mark: cat paw (topbar compact)
  const logo = document.querySelector('.brand .logo, #brandLogo');
  if (logo) {
    logo.innerHTML = pawSvg(20);
    logo.classList.add('logo-paw');
  }
  // 伸爪 primary action
  const pickIcon = document.querySelector('#pickBtn .pick-icon');
  if (pickIcon) {
    pickIcon.innerHTML = pawSvg(16);
    pickIcon.classList.add('pick-icon-paw');
  }
  const edgeFab = document.getElementById('sessionEdgeFab');
  const edgeIcon = edgeFab?.querySelector('.session-edge-fab-icon');
  if (edgeIcon && !edgeIcon.querySelector('svg')) {
    edgeIcon.innerHTML = pawSvg(14, { className: 'paw-svg session-edge-paw' });
  }
  // Subtle pin on selection toolbar
  const pinIcon = document.querySelector('#pinSelBtn .sel-pin-icon');
  if (pinIcon && !pinIcon.querySelector('svg')) {
    pinIcon.innerHTML = ICONS.pin;
  }
  // Home empty hero mark — larger + bean-flash easter egg (hover only)
  document.querySelectorAll('.home-mark').forEach((el) => {
    // Hero logo 50% larger than original 48px → 72px
    el.innerHTML = pawSvg(72, {
      className: 'paw-svg paw-svg-hero',
      beans: true
    });
    el.classList.add('home-mark-paw');
    el.setAttribute('title', ''); // decorative; flash is the only interaction
  });
}

/**
 * Ensure composer send/stop use vector icons on their own buttons.
 * Visibility swap is owned by sendStop.applySendStopUi — boot seeds idle via setAgentRunningUi(false).
 */
export function enhanceComposerIcons() {
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    const sendIcon = sendBtn.querySelector('.send-icon');
    if (sendIcon) {
      sendIcon.innerHTML = `<svg class="send-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`;
    }
  }
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    const stopIcon = stopBtn.querySelector('.stop-icon');
    if (stopIcon) {
      stopIcon.innerHTML = `<svg class="stop-svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>`;
    }
  }
}
