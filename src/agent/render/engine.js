/**
 * render_document engine routing.
 *
 * Public API: `render_document({ draftId, format })`.
 *
 * | format | engine | delivery |
 * |--------|--------|----------|
 * | md, txt, csv, html, zip, pptx | builtin | download artifact |
 * | pdf | builtin_print | HTML print dialog → Save as PDF |
 */

/** Formats shown in UI and accepted by render_document. */
export const PRODUCT_FORMATS = Object.freeze([
  'md',
  'txt',
  'csv',
  'html',
  'pdf',
  'pptx',
  'zip'
]);

/** Alias used by render_document. */
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
    notes: 'Markdown.'
  },
  txt: {
    defaultEngine: 'builtin',
    preferPandoc: false,
    builtin: true,
    pandoc: false,
    fallback: null,
    delivery: 'download',
    notes: 'Plain text.'
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
      'Print-ready HTML → system print dialog → Save as PDF.'
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

  if (options.forcePandoc || options.engine === 'pandoc') {
    return {
      engine: null,
      fallback: null,
      format: fmt,
      reason: 'pandoc_not_in_product_A_prime',
      delivery: row.delivery,
      errorCode: 'ENGINE_NOT_IN_PRODUCT',
      message:
        'Pandoc is not shipped. Use md/txt/csv/html/pdf(print)/zip/pptx.'
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
      'Formats ship inside the extension. PDF = HTML print → Save as PDF.'
  };
}

/** Always false; Pandoc is not shipped. */
export function isPandocReady() {
  return false;
}
