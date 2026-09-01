/**
 * Session clipboard pin store — pure (no chrome).
 * Pins survive page selection deselect; clear only via removeIds/clear.
 */

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   kind?: string,
 *   sourceIndex?: number|null,
 *   pinned: true,
 *   createdAt: number
 * }} ClipboardPinItem
 */

let _seq = 0;

/**
 * @returns {string}
 */
function nextId() {
  _seq += 1;
  return `clip_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

/**
 * Create an isolated clipboard store (per run / test).
 * @returns {{
 *   pinItems: (items: Array<object|string>) => ClipboardPinItem[],
 *   listItems: () => ClipboardPinItem[],
 *   removeIds: (ids: string[]) => number,
 *   clear: () => void,
 *   size: () => number
 * }}
 */
export function createClipboardStore() {
  /** @type {ClipboardPinItem[]} */
  const items = [];

  /**
   * @param {Array<object|string>} raw
   * @returns {ClipboardPinItem[]}
   */
  function pinItems(raw) {
    const list = Array.isArray(raw) ? raw : [];
    /** @type {ClipboardPinItem[]} */
    const pinned = [];
    for (const entry of list) {
      if (entry == null) continue;
      let text = '';
      let kind;
      let sourceIndex = null;
      let id;
      if (typeof entry === 'string') {
        text = entry;
      } else if (typeof entry === 'object') {
        text =
          entry.text != null
            ? String(entry.text)
            : entry.content != null
              ? String(entry.content)
              : entry.body != null
                ? String(entry.body)
                : '';
        if (entry.kind != null) kind = String(entry.kind);
        if (typeof entry.sourceIndex === 'number') sourceIndex = entry.sourceIndex;
        else if (typeof entry.index === 'number') sourceIndex = entry.index;
        if (entry.id != null && String(entry.id).trim()) id = String(entry.id).trim();
      }
      if (!text) continue;
      /** @type {ClipboardPinItem} */
      const item = {
        id: id || nextId(),
        text,
        pinned: true,
        createdAt: Date.now()
      };
      if (kind) item.kind = kind;
      if (sourceIndex != null) item.sourceIndex = sourceIndex;
      items.push(item);
      pinned.push(item);
    }
    return pinned;
  }

  function listItems() {
    return items.map((it) => ({ ...it }));
  }

  /**
   * @param {string[]} ids
   * @returns {number} removed count
   */
  function removeIds(ids) {
    const set = new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)));
    if (!set.size) return 0;
    let removed = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      if (set.has(items[i].id)) {
        items.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  function clear() {
    items.length = 0;
  }

  function size() {
    return items.length;
  }

  return { pinItems, listItems, removeIds, clear, size };
}

/** Module-level session store (shared across tools when ctx does not inject one). */
const sessionStore = createClipboardStore();

/**
 * @returns {ReturnType<typeof createClipboardStore>}
 */
export function getSessionClipboardStore() {
  return sessionStore;
}

/**
 * Pin into the session store.
 * @param {Array<object|string>} items
 */
export function pinItems(items) {
  return sessionStore.pinItems(items);
}

/** @returns {import('./clipboardStore.js').ClipboardPinItem[]} */
export function listItems() {
  return sessionStore.listItems();
}

/**
 * @param {string[]} ids
 */
export function removeIds(ids) {
  return sessionStore.removeIds(ids);
}

export function clear() {
  sessionStore.clear();
}

/**
 * Resolve store from ToolContext hooks or session default.
 * @param {{ clipboardStore?: ReturnType<typeof createClipboardStore>, pinClipboardItems?: Function, getClipboardItems?: Function }} [ctx]
 */
export function resolveClipboardStore(ctx) {
  if (ctx?.clipboardStore && typeof ctx.clipboardStore.pinItems === 'function') {
    return ctx.clipboardStore;
  }
  return sessionStore;
}
