/**
 * Minimal document for packaged site-motion unit tests (no extra runtime deps).
 */

function tokens(sel) {
  return String(sel || '').trim();
}

export function createMemoryWindow(opts = {}) {
  const timers = new Map();
  const observers = new Set();
  const rafs = new Map();
  let tid = 1;
  let rafId = 1;
  const reduced = !!opts.reducedMotion;
  const listeners = new Map();

  const win = {
    innerHeight: opts.innerHeight || 800,
    __guestScriptRan: false,
    __guestModuleRan: false,
    __onclickRan: false,
    __jsUrlRan: false,
    __btnRan: false,
    matchMedia(q) {
      const query = String(q || '');
      const matches =
        (query.includes('prefers-reduced-motion') && query.includes('reduce') && reduced) ||
        (query.includes('pointer: coarse') && !!opts.coarse);
      return { matches, media: query, addEventListener() {}, removeEventListener() {} };
    },
    setInterval(fn, ms) {
      const id = tid++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    requestAnimationFrame(fn) {
      const id = rafId++;
      rafs.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((x) => x !== fn)
      );
    },
    dispatch(type, ev = {}) {
      for (const fn of listeners.get(type) || []) fn(ev);
    },
    flushIntervals() {
      for (const t of timers.values()) t.fn();
    },
    flushRaf() {
      const pending = [...rafs.entries()];
      rafs.clear();
      for (const [, fn] of pending) fn(0);
    },
    timerCount() {
      return timers.size;
    },
    observerCount() {
      return observers.size;
    },
    _observers: observers
  };

  class MemClassList {
    constructor(el) {
      this.el = el;
    }
    get _set() {
      return new Set(String(this.el.className || '').split(/\s+/).filter(Boolean));
    }
    _write(set) {
      this.el.className = [...set].join(' ');
    }
    add(...xs) {
      const s = this._set;
      xs.forEach((x) => s.add(x));
      this._write(s);
    }
    remove(...xs) {
      const s = this._set;
      xs.forEach((x) => s.delete(x));
      this._write(s);
    }
    toggle(x, force) {
      const s = this._set;
      const on = force == null ? !s.has(x) : !!force;
      if (on) s.add(x);
      else s.delete(x);
      this._write(s);
      return on;
    }
    contains(x) {
      return this._set.has(x);
    }
  }

  class MemEl {
    constructor(tag, doc) {
      this.tagName = String(tag || 'div').toUpperCase();
      this.nodeType = 1;
      this.ownerDocument = doc;
      this.parentNode = null;
      this.childNodes = [];
      this.attrs = {};
      this.className = '';
      this.style = {
        _props: {},
        setProperty(k, v) {
          this._props[k] = String(v);
          this[k] = String(v);
        },
        getPropertyValue(k) {
          return this._props[k] || '';
        }
      };
      this._listeners = new Map();
      this.hidden = false;
      this._id = '';
      this.classList = new MemClassList(this);
      this.scrollWidth = 400;
      this.clientWidth = 320;
    }
    get children() {
      return this.childNodes.filter((n) => n.nodeType === 1);
    }
    get firstChild() {
      return this.childNodes[0] || null;
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent || '').join('');
    }
    set textContent(v) {
      this.childNodes = [];
      if (v) this.childNodes.push({ nodeType: 3, textContent: String(v), parentNode: this });
    }
    get id() {
      return this._id;
    }
    set id(v) {
      this._id = String(v || '');
      if (this._id && this.ownerDocument) this.ownerDocument._ids.set(this._id, this);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      if (k === 'id') return this.id;
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    }
    setAttribute(name, value) {
      const k = String(name);
      const v = value == null ? '' : String(value);
      if (k === 'class') this.className = v;
      else if (k === 'id') {
        this.id = v;
        if (this.ownerDocument) this.ownerDocument._ids.set(v, this);
      } else this.attrs[k] = v;
    }
    hasAttribute(name) {
      const k = String(name);
      if (k === 'class') return !!this.className;
      if (k === 'id') return !!this.id;
      return Object.prototype.hasOwnProperty.call(this.attrs, k);
    }
    removeAttribute(name) {
      delete this.attrs[String(name)];
    }
    appendChild(node) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
      return node;
    }
    insertBefore(node, ref) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      const i = this.childNodes.indexOf(ref);
      if (i < 0) this.childNodes.push(node);
      else this.childNodes.splice(i, 0, node);
      return node;
    }
    removeChild(node) {
      this.childNodes = this.childNodes.filter((n) => n !== node);
      node.parentNode = null;
      if (node._id && this.ownerDocument?._ids.get(node._id) === node) {
        this.ownerDocument._ids.delete(node._id);
      }
      return node;
    }
    remove() {
      this.parentNode?.removeChild(this);
    }
    cloneNode(deep = false) {
      const copy = new MemEl(this.tagName, this.ownerDocument);
      copy.className = this.className;
      copy.id = '';
      copy.attrs = { ...this.attrs };
      copy.hidden = this.hidden;
      copy.textContent = deep ? '' : this.textContent;
      if (deep) {
        for (const child of this.childNodes) {
          if (child.cloneNode) copy.appendChild(child.cloneNode(true));
          else copy.appendChild({ nodeType: child.nodeType, textContent: child.textContent, parentNode: null });
        }
      }
      return copy;
    }
    contains(node) {
      if (node === this) return true;
      return this.childNodes.some((c) => (c.contains ? c.contains(node) : c === node));
    }
    closest(sel) {
      let n = this;
      while (n) {
        if (n.matches?.(sel)) return n;
        n = n.parentNode;
      }
      return null;
    }
    matches(sel) {
      return matchSel(this, tokens(sel));
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
    querySelectorAll(sel) {
      const out = [];
      walk(this, (el) => {
        if (el !== this && matchSel(el, tokens(sel))) out.push(el);
      });
      return out;
    }
    addEventListener(type, fn) {
      const list = this._listeners.get(type) || [];
      list.push(fn);
      this._listeners.set(type, list);
    }
    removeEventListener(type, fn) {
      this._listeners.set(
        type,
        (this._listeners.get(type) || []).filter((x) => x !== fn)
      );
    }
    dispatchEvent(ev) {
      const e = ev && ev.type ? ev : { type: ev, target: this, preventDefault() {}, stopPropagation() {} };
      e.target = e.target || this;
      e.preventDefault = e.preventDefault || (() => {});
      let n = this;
      while (n) {
        for (const fn of n._listeners.get(e.type) || []) fn(e);
        n = n.parentNode;
      }
    }
    focus() {
      this.ownerDocument.activeElement = this;
    }
    getBoundingClientRect() {
      return { top: this._top || 120, height: 80, width: this.clientWidth || 320, left: 0, right: 320 };
    }
    animate() {
      return { cancel() {}, finished: Promise.resolve() };
    }
  }

  class MemIO {
    constructor(cb) {
      this.cb = cb;
      this.nodes = new Set();
      observers.add(this);
    }
    observe(el) {
      this.nodes.add(el);
    }
    unobserve(el) {
      this.nodes.delete(el);
    }
    disconnect() {
      this.nodes.clear();
      observers.delete(this);
    }
    trigger(intersecting = true) {
      this.cb([...this.nodes].map((target) => ({ target, isIntersecting: intersecting })));
    }
  }

  const doc = {
    hidden: false,
    _ids: new Map(),
    defaultView: win,
    IntersectionObserver: MemIO,
    createElement(tag) {
      return new MemEl(tag, doc);
    },
    getElementById(id) {
      return doc._ids.get(String(id)) || null;
    },
    querySelector(sel) {
      return doc.documentElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return doc.documentElement.querySelectorAll(sel);
    },
    addEventListener(type, fn) {
      win.addEventListener(type, fn);
    },
    removeEventListener(type, fn) {
      win.removeEventListener(type, fn);
    },
    get visibilityState() {
      return doc.hidden ? 'hidden' : 'visible';
    }
  };
  doc.documentElement = new MemEl('html', doc);
  doc.head = new MemEl('head', doc);
  doc.body = new MemEl('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  win.document = doc;
  win.IntersectionObserver = MemIO;
  return { win, doc, MemEl };
}

function walk(el, fn) {
  fn(el);
  for (const c of el.childNodes || []) {
    if (c.nodeType === 1) walk(c, fn);
  }
}

function matchSel(el, sel) {
  if (!sel) return false;
  if (sel.includes(',')) return sel.split(',').some((s) => matchSel(el, s.trim()));
  const parts = sel.trim().split(/\s+/);
  if (parts.length > 1) return false;
  let s = parts[0];
  if (s.startsWith('#')) return el.id === s.slice(1);
  const tag = s.match(/^([a-z][\w-]*)/i);
  if (tag) {
    if (el.tagName !== tag[1].toUpperCase()) return false;
    s = s.slice(tag[1].length);
  }
  const cls = [...s.matchAll(/\.([a-z][\w-]*)/gi)].map((m) => m[1]);
  if (cls.some((c) => !el.classList.contains(c))) return false;
  s = s.replace(/\.[a-z][\w-]*/gi, '');
  const attrs = [...s.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  for (const raw of attrs) {
    const eq = raw.match(/^([^\s=]+)(?:\s*=\s*["']?([^"'\]]+)["']?)?$/);
    if (!eq) return false;
    const name = eq[1];
    const want = eq[2];
    if (!el.hasAttribute(name)) return false;
    if (want != null && el.getAttribute(name) !== want) return false;
  }
  return true;
}

export function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className' || k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}
