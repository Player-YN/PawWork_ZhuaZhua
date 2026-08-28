/**
 * Whole sidepanel scroll helpers.
 * Home / no-thread: #panelScroll is the document scrollport.
 * Conversation open: .task-body is the message scrollport (chat-window chrome).
 */

function getScrollRoot() {
  return (
    document.querySelector('#taskStream .session-thread:not([hidden]) .task-body') ||
    document.getElementById('panelScroll') ||
    document.getElementById('taskStream') ||
    null
  );
}

/**
 * @param {Element|null} el
 * @param {number} deltaY
 */
function canScrollY(el, deltaY) {
  if (!el || !(el instanceof HTMLElement)) return false;
  let node = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    const scrollable =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1;
    if (scrollable) {
      const top = node.scrollTop;
      const max = node.scrollHeight - node.clientHeight;
      if (deltaY < 0 && top > 0) return true;
      if (deltaY > 0 && top < max - 0.5) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Relay wheel from sticky chrome (topbar/composer) onto #panelScroll.
 * @returns {() => void}
 */
export function setupSidepanelWheelRelay() {
  const panel = document.getElementById('panel');
  if (!panel) return () => {};

  /** @param {WheelEvent} e */
  const onWheel = (e) => {
    if (e.defaultPrevented || e.ctrlKey) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        '.modal-overlay, .more-sheet, .settings-modal, .sheet-backdrop, .pw-dialog, dialog, [role="dialog"], .think-body-wrap'
      )
    ) {
      return;
    }
    const root = getScrollRoot();
    if (!root) return;
    // Already scrolling the main root
    if (root.contains(target) && canScrollY(target, e.deltaY)) return;
    if (canScrollY(target, e.deltaY)) return;
    if (root.scrollHeight <= root.clientHeight + 1) return;

    const top = root.scrollTop;
    const max = root.scrollHeight - root.clientHeight;
    if (e.deltaY < 0 && top <= 0) return;
    if (e.deltaY > 0 && top >= max - 0.5) return;

    root.scrollTop = Math.min(max, Math.max(0, top + e.deltaY));
    e.preventDefault();
  };

  panel.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => panel.removeEventListener('wheel', onWheel, { capture: true });
}

/**
 * Edge fades on the whole-panel scrollport.
 * @returns {() => void}
 */
export function setupTaskStreamScrollAffordances() {
  let raf = 0;
  let lastRoot = null;
  const update = () => {
    raf = 0;
    const root = getScrollRoot();
    if (!root) return;
    if (lastRoot && lastRoot !== root) {
      lastRoot.classList.remove('is-scroll-up', 'is-scroll-down');
    }
    lastRoot = root;
    const max = root.scrollHeight - root.clientHeight;
    const canScroll = max > 2;
    const top = root.scrollTop;
    root.classList.toggle('is-scroll-up', canScroll && top > 2);
    root.classList.toggle('is-scroll-down', canScroll && top < max - 2);
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(update);
  };

  document.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule, { passive: true });

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(schedule);
    const panelScroll = document.getElementById('panelScroll');
    if (panelScroll) ro.observe(panelScroll);
  }
  let mo = null;
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(schedule);
    const observe = document.getElementById('panelScroll') || document.body;
    mo.observe(observe, { childList: true, subtree: true, characterData: true });
  }
  schedule();

  return () => {
    document.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('resize', schedule);
    if (ro) ro.disconnect();
    if (mo) mo.disconnect();
    if (raf) cancelAnimationFrame(raf);
    lastRoot?.classList.remove('is-scroll-up', 'is-scroll-down');
  };
}

export function taskStreamScrollMetrics() {
  const root = getScrollRoot();
  if (!root) return null;
  return {
    clientHeight: root.clientHeight,
    scrollHeight: root.scrollHeight,
    scrollTop: root.scrollTop,
    canScroll: root.scrollHeight > root.clientHeight + 1,
    isScrollUp: root.classList.contains('is-scroll-up'),
    isScrollDown: root.classList.contains('is-scroll-down')
  };
}
