/**
 * tldraw reads pixels from:
 *   - a detached 1×1 HTML canvas (max-size probe)
 *   - OffscreenCanvas (image alpha hit-testing)
 * Chrome warns unless willReadFrequently is set at getContext time.
 */
export function installCanvasReadbackHint() {
  function patch(proto) {
    if (!proto || typeof proto.getContext !== 'function' || proto.getContext._pawReadHint) return;
    const orig = proto.getContext;
    function patched(type, attrs) {
      const offscreen = typeof OffscreenCanvas !== 'undefined' && proto === OffscreenCanvas.prototype;
      const tiny = this && this.width <= 2 && this.height <= 2;
      const detached = typeof this.isConnected === 'boolean' && !this.isConnected;
      if (
        type === '2d' &&
        !(attrs && attrs.willReadFrequently === false) &&
        (offscreen || tiny || detached)
      ) {
        attrs = { willReadFrequently: true, ...(attrs || {}) };
      }
      return orig.call(this, type, attrs);
    }
    patched._pawReadHint = true;
    proto.getContext = patched;
  }
  if (typeof HTMLCanvasElement !== 'undefined') patch(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== 'undefined') patch(OffscreenCanvas.prototype);
}

installCanvasReadbackHint();
