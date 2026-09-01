/**
 * Click-toggle menus with light-dismiss (outside click / Esc).
 * Prefer reliable `hidden` toggle over native Popover API in Side Panel
 * (native can leave the menu visible under the trigger when UA styles fight author CSS).
 */

/** @returns {boolean} */
export function supportsPopover() {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.showPopover === 'function'
  );
}

/**
 * Position a menu under the trigger (right-aligned). Used for both native and fallback.
 * @param {HTMLElement} trigger
 * @param {HTMLElement} menu
 */
function positionUnderTrigger(trigger, menu) {
  const r = trigger.getBoundingClientRect();
  const gap = 4;
  menu.style.position = 'fixed';
  menu.style.inset = 'auto';
  menu.style.margin = '0';
  menu.style.top = `${Math.round(r.bottom + gap)}px`;
  menu.style.left = 'auto';
  menu.style.right = `${Math.round(Math.max(0, window.innerWidth - r.right))}px`;
  menu.style.zIndex = '10050';
}

/**
 * Wire a trigger + menu: default closed, open on demand, close on outside / Esc / choose item.
 *
 * @param {{
 *   trigger: HTMLElement|null|undefined,
 *   menu: HTMLElement|null|undefined,
 *   useNative?: boolean
 * }} opts
 * @returns {{
 *   close: () => void,
 *   open: () => void,
 *   isOpen: () => boolean,
 *   usesNative: boolean
 * }}
 */
export function wirePopoverMenu(opts) {
  const trigger = opts.trigger;
  const menu = opts.menu;
  // Default off: Side Panel + author display:flex fought native closed state (always-visible menu).
  const useNative = opts.useNative === true && supportsPopover();

  const noop = {
    close() {},
    open() {},
    isOpen() {
      return false;
    },
    usesNative: false
  };
  if (!trigger || !menu) return noop;

  if (useNative) {
    menu.setAttribute('popover', 'auto');
    menu.hidden = true;
    if (!menu.id) menu.id = `pw-pop-${Math.random().toString(36).slice(2, 9)}`;
    trigger.setAttribute('popovertarget', menu.id);
    trigger.setAttribute('popovertargetaction', 'toggle');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');

    const onToggle = (e) => {
      if (e && e.newState === 'open') {
        menu.hidden = false;
        positionUnderTrigger(trigger, menu);
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    };
    menu.addEventListener('toggle', onToggle);

    const onResize = () => {
      try {
        if (menu.matches(':popover-open')) positionUnderTrigger(trigger, menu);
      } catch (_) {}
    };
    window.addEventListener('resize', onResize);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      try {
        if (menu.matches(':popover-open')) menu.hidePopover();
      } catch (_) {}
      trigger.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    });

    return {
      usesNative: true,
      open() {
        try {
          menu.showPopover();
          menu.hidden = false;
          positionUnderTrigger(trigger, menu);
          trigger.setAttribute('aria-expanded', 'true');
        } catch (_) {}
      },
      close() {
        try {
          if (menu.matches(':popover-open')) menu.hidePopover();
        } catch (_) {}
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      },
      isOpen() {
        try {
          return menu.matches(':popover-open');
        } catch (_) {
          return false;
        }
      }
    };
  }

  // ── Reliable fallback: hidden attribute + outside click + Esc ──
  menu.removeAttribute('popover');
  trigger.removeAttribute('popovertarget');
  trigger.removeAttribute('popovertargetaction');
  menu.hidden = true;
  menu.classList.remove('is-open');
  if (!menu.id) menu.id = `pw-pop-${Math.random().toString(36).slice(2, 9)}`;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');

  const home = menu.parentElement;
  const close = () => {
    menu.hidden = true;
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (home && menu.parentElement === document.body) {
      home.appendChild(menu);
      menu.style.position = '';
      menu.style.top = '';
      menu.style.right = '';
      menu.style.left = '';
      menu.style.inset = '';
    }
  };
  const open = () => {
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
    menu.hidden = false;
    menu.classList.add('is-open');
    positionUnderTrigger(trigger, menu);
    trigger.setAttribute('aria-expanded', 'true');
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });

  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    const t = /** @type {Node|null} */ (e.target);
    if (trigger.contains(t) || menu.contains(t)) return;
    if (
      trigger.parentElement &&
      trigger.parentElement.contains(t) &&
      trigger.parentElement.contains(menu)
    ) {
      return;
    }
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      close();
      trigger.focus?.();
    }
  });

  return {
    usesNative: false,
    close,
    open,
    isOpen() {
      return !menu.hidden;
    }
  };
}
