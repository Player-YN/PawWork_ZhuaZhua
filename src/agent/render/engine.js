/**
 * render_document engine routing — Product profile **A′** (2026-08-07)
 *
 * Install constraint: **extension only** — no npm, no desktop Pandoc for end users.
 * All product formats must work with files shipped inside the extension package.
 *
 * Public API: only `render_document({ draftId, format })`.
 * Never expose call_pandoc / md_to_* tools.
 *
 * | format | engine | delivery |
 * |--------|--------|----------|
 * | md, txt, csv, html, zip, pptx | builtin | download artifact |
 * | pdf | builtin_print | HTML print dialog → Save as PDF |
 *
 * docx / pandoc-wasm are **not** product formats under A′ (optional lab only, not default).
 */

/** Formats shown in UI and accepted as product capabilities (extension-only). */
export const PRODUCT_FORMATS = Object.freeze([
  'md',
  'txt',
  'csv',
  'html',
  'pdf',
  'pptx',
  'zip'
]);

/** Alias used by render_document — A′: same as product surface. */
export const RENDER_FORMATS = PRODUCT_FORMATS;

/**
 * @type {Readonly<Record<string, {
 *   defaultEngine: 'builtin'|'builtin_print',
 *   preferPandoc: boolean,
 *   builtin: boolean,
 *   pandoc: boolean,
 *   fallback: null,
 *   delivery: 'download'|'browser_print',
 *   notes: string
 * }>>}
 */
export const FORMAT_ENGINE_MATRIX = Object.freeze({
  md: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'A′ extension-only markdown.'
  },
  txt: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'A′ plain text.'
  },
  csv: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'First table/records only.'
  },
  html: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'Export HTML file.'
  },
  zip: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'md + csv + images zip.'
  },
  pptx: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'Native OOXML PPTX (zip + ppt/presentation.xml), one slide per plate.'
  },
  pdf: {
    defaultEngine: 'builtin_print',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'browser_print',
    notes:
      'A′: print-ready HTML → system print dialog → Save as PDF. No Pandoc, no extra install. Optional simple binary PDF not product default.'
  }
});

/**
 * @param {string} format
 * @param {{
 *   engine?: 'auto'|'builtin'|'builtin_print'|'pandoc',
 *   forceBuiltin?: boolean,
 *   forcePandoc?: boolean,
 *   pandocReady?: boolean
 * }} [options]
 */
export function resolveEngine(format, options = {}) {
  const fmt = String(format || '').toLowerCase();
  const row = FORMAT_ENGINE_MATRIX[fmt];
  if (!row) {
    return {
      engine: null,
      fallback: null,
      format: fmt,
      reason: 'unsupported_format',
      delivery: null,
      errorCode: 'UNSUPPORTED_FORMAT'
    };
  }

  // A′: never route product traffic to pandoc
  if (options.forcePandoc || options.engine === 'pandoc') {
    return {
      engine: null,
      fallback: null,
      format: fmt,
      reason: 'pandoc_not_in_product_A_prime',
      delivery: row.delivery,
      errorCode: 'ENGINE_NOT_IN_PRODUCT',
      message:
        'Pandoc is not part of the extension-only product (A′). Use md/txt/csv/html/pdf(print)/zip/pptx.'
    };
  }

  if (fmt === 'pdf' || row.defaultEngine === 'builtin_print') {
    return {
      engine: 'builtin_print',
      fallback: null,
      format: fmt,
      reason: 'a_prime_html_print_pdf',
      delivery: 'browser_print'
    };
  }

  return {
    engine: 'builtin',
    fallback: null,
    format: fmt,
    reason: 'a_prime_builtin',
    delivery: row.delivery || 'download'
  };
}

/**
 * @returns {{ formats: string[], matrix: typeof FORMAT_ENGINE_MATRIX, productProfile: string }}
 */
export function getRenderCapabilities() {
  return {
    productProfile: 'A_prime',
    install: 'extension_only',
    formats: [...PRODUCT_FORMATS],
    matrix: FORMAT_ENGINE_MATRIX,
    pandoc: false,
    notes:
      'All formats ship inside the extension. PDF = HTML print → Save as PDF. No npm/Pandoc for end users.'
  };
}

/** @deprecated lab only — always false in A′ product profile */
export function isPandocReady() {
  return false;
}
