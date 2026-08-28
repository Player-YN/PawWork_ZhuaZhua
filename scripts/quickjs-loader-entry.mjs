/**
 * Build entry for extension-shipped QuickJS loader.
 * Bundled by scripts/build-agent.mjs → src/agent/vnext/adapters/vendor/quickjs-loader.mjs
 *
 * Singlefile browser variant embeds WASM in JS (no separate .wasm path resolution).
 * Consumed via relative import from codeRuntime.js (Chrome MV3 has no node_modules).
 */
import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline
} from 'quickjs-emscripten-core';

/** @type {import('quickjs-emscripten-core').QuickJSWASMModule | null} */
let singleton = null;
/** @type {Promise<import('quickjs-emscripten-core').QuickJSWASMModule> | null} */
let singletonPromise = null;

/**
 * Load (once) a QuickJS WASM module from the vendored singlefile variant.
 * @returns {Promise<import('quickjs-emscripten-core').QuickJSWASMModule>}
 */
export async function getQuickJS() {
  if (singleton) return singleton;
  if (!singletonPromise) {
    singletonPromise = newQuickJSWASMModuleFromVariant(variant).then((mod) => {
      singleton = mod;
      return mod;
    });
  }
  return singletonPromise;
}

export { shouldInterruptAfterDeadline };
