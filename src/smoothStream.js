/**
 * Smooth high-frequency LLM stream renderer (vanilla JS).
 * Buffer → rAF drain → batched DOM writes; layout-stable thinking body.
 */

/**
 * @param {HTMLElement} bodyEl - scrollable plain-text container
 * @param {object} [opts]
 * @param {number} [opts.charsPerFrame=480] - max chars drained per animation frame
 * @param {boolean} [opts.fadeChunks=true] - wrap new batches in fade-in spans
 * @returns {{
 *   push: (text: string) => void,
 *   pushLine: (text: string) => void,
 *   flush: () => void,
 *   clear: () => void,
 *   getText: () => string,
 *   length: () => number,
 *   destroy: () => void
 * }}
 */
export function createSmoothStreamRenderer(bodyEl, opts = {}) {
  if (!bodyEl) {
    return {
      push() {},
      pushLine() {},
      flush() {},
      clear() {},
      getText: () => '',
      length: () => 0,
      destroy() {}
    };
  }

  const charsPerFrame = Math.max(64, opts.charsPerFrame ?? 480);
  const fadeChunks = opts.fadeChunks !== false;

  let queue = '';
  let fullText = '';
  let rafId = 0;
  let destroyed = false;

  const schedule = () => {
    if (destroyed || rafId) return;
    rafId = requestAnimationFrame(tick);
  };

  const tick = () => {
    rafId = 0;
    if (destroyed || !queue) return;

    const take = queue.slice(0, charsPerFrame);
    queue = queue.slice(charsPerFrame);
    fullText += take;
    appendVisual(take);

    // Do not auto-scroll while streaming — user owns the viewport
    if (queue) schedule();
  };

  const appendVisual = (chunk) => {
    if (!chunk) return;
    if (!fadeChunks) {
      bodyEl.appendChild(document.createTextNode(chunk));
      return;
    }
    const span = document.createElement('span');
    span.className = 'stream-chunk';
    span.textContent = chunk;
    bodyEl.appendChild(span);
    // Flatten after animation to limit DOM nodes under long streams
    window.setTimeout(() => {
      if (destroyed || !span.isConnected) return;
      const text = span.textContent || '';
      const tn = document.createTextNode(text);
      span.replaceWith(tn);
      // Merge adjacent text nodes
      bodyEl.normalize();
    }, 160);
  };

  return {
    push(text) {
      if (destroyed || text == null || text === '') return;
      queue += String(text);
      schedule();
    },
    pushLine(text) {
      if (destroyed || text == null || text === '') return;
      const line = String(text);
      const prefix =
        fullText.length && !fullText.endsWith('\n') && !queue.endsWith('\n')
          ? '\n'
          : '';
      queue += prefix + line + (line.endsWith('\n') ? '' : '\n');
      schedule();
    },
    flush() {
      if (destroyed) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (queue) {
        const rest = queue;
        queue = '';
        fullText += rest;
        // Final flush: plain text, no more fade spans thrash
        bodyEl.appendChild(document.createTextNode(rest));
        bodyEl.normalize();
        // no auto-scroll on flush
      }
    },
    clear() {
      queue = '';
      fullText = '';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      bodyEl.textContent = '';
    },
    getText() {
      return fullText + queue;
    },
    length() {
      return fullText.length + queue.length;
    },
    destroy() {
      destroyed = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      queue = '';
    }
  };
}

/**
 * Wire a <details> thinking lane: max-height body, optional collapse while streaming.
 * Does NOT force-reopen after the user collapses.
 *
 * @param {HTMLDetailsElement|null} detailsEl
 * @param {object} [opts]
 */
export function bindThinkingLane(detailsEl, opts = {}) {
  const labelEl = opts.labelEl || detailsEl?.querySelector?.('.agent-stream-label');
  const bodyEl = opts.bodyEl || detailsEl?.querySelector?.('.agent-stream-body');
  const dict = opts.dict || {};

  let userCollapsed = false;
  let autoOpened = false;
  let streaming = false;
  let startedAt = 0;
  let toggleHandler = null;

  const renderer = createSmoothStreamRenderer(bodyEl, {
    charsPerFrame: opts.charsPerFrame,
    fadeChunks: opts.fadeChunks
  });

  if (detailsEl) {
    toggleHandler = () => {
      // User explicitly toggled while visible
      userCollapsed = !detailsEl.open;
    };
    detailsEl.addEventListener('toggle', toggleHandler);
  }

  return {
    renderer,
    begin() {
      streaming = true;
      startedAt = performance.now();
      userCollapsed = false;
      autoOpened = false;
      if (!detailsEl) return;
      detailsEl.classList.add('is-visible', 'is-streaming');
      detailsEl.style.display = '';
      if (labelEl) {
        labelEl.textContent = dict.streamLaneLabel || '思考中…';
      }
      // Open once at start; never re-force if user collapses
      if (!autoOpened) {
        detailsEl.open = true;
        autoOpened = true;
        userCollapsed = false;
      }
    },
    ensureVisible() {
      if (!detailsEl) return;
      detailsEl.classList.add('is-visible', 'is-streaming');
      detailsEl.style.display = '';
      // Only auto-open if user has not collapsed
      if (!userCollapsed && !detailsEl.open) {
        detailsEl.open = true;
      }
    },
    push(text) {
      this.ensureVisible();
      renderer.push(text);
    },
    pushLine(text) {
      this.ensureVisible();
      renderer.pushLine(text);
    },
    finish() {
      streaming = false;
      renderer.flush();
      if (!detailsEl) return;
      detailsEl.classList.remove('is-streaming');
      const n = renderer.length();
      if (n === 0) {
        detailsEl.classList.remove('is-visible');
        detailsEl.style.display = 'none';
        return;
      }
      const sec = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
      if (labelEl) {
        const tpl =
          dict.streamLaneLabelDone ||
          dict.thoughtDoneLabel ||
          '已思考 {sec} 秒 · {count} 字';
        labelEl.textContent = tpl
          .replace('{sec}', String(sec))
          .replace('{count}', String(n));
      }
      // Auto-collapse when done (user can re-open)
      detailsEl.open = false;
      userCollapsed = true;
    },
    getText() {
      return renderer.getText();
    },
    destroy() {
      if (detailsEl && toggleHandler) {
        detailsEl.removeEventListener('toggle', toggleHandler);
      }
      renderer.destroy();
    }
  };
}
