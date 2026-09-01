/**
 * Optional compact density flag on the panel root.
 * Primary narrow chrome still uses @container queries in layout.css;
 * data-density="compact" is a light JS mirror for width < 320.
 */

const COMPACT_MAX = 320;

/**
 * @param {HTMLElement|null|undefined} panel
 * @returns {() => void} disconnect
 */
export function setupPanelDensity(panel) {
  const el = panel || document.getElementById('panel') || document.querySelector('.panel');
  if (!el || typeof ResizeObserver === 'undefined') {
    return () => {};
  }

  const apply = () => {
    const w = el.clientWidth;
    if (w > 0 && w < COMPACT_MAX) {
      if (el.getAttribute('data-density') !== 'compact') {
        el.setAttribute('data-density', 'compact');
      }
    } else if (el.hasAttribute('data-density')) {
      el.removeAttribute('data-density');
    }
  };

  const ro = new ResizeObserver(() => apply());
  ro.observe(el);
  apply();
  return () => ro.disconnect();
}
