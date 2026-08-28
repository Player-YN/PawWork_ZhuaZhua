/**
 * Classic script (not module) so it runs before design.js and stays CSP-legal.
 * tldraw reads pixels from HTMLCanvasElement and OffscreenCanvas without willReadFrequently.
 */
(function () {
  function patch(proto) {
    if (!proto || typeof proto.getContext !== 'function' || proto.getContext._pawReadHint) return;
    var orig = proto.getContext;
    function patched(type, attrs) {
      var offscreen = typeof OffscreenCanvas !== 'undefined' && proto === OffscreenCanvas.prototype;
      var tiny = this && this.width <= 2 && this.height <= 2;
      var detached = typeof this.isConnected === 'boolean' && !this.isConnected;
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
  patch(typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype);
  patch(typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype);
})();
