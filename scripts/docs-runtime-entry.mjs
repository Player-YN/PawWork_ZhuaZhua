/**
 * Browser bundle for the live docs tab: Univer Docs OSS (no Pro).
 * Built to src/preview/vendor/docs-runtime.js
 */

import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { defaultTheme } from '@univerjs/themes';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import docsZhCN from '@univerjs/preset-docs-core/locales/zh-CN';
import docsEnUS from '@univerjs/preset-docs-core/locales/en-US';
import '@univerjs/preset-docs-core/lib/index.css';
import { UniverDocsDrawingPreset } from '@univerjs/preset-docs-drawing';
import drawingZhCN from '@univerjs/preset-docs-drawing/locales/zh-CN';
import drawingEnUS from '@univerjs/preset-docs-drawing/locales/en-US';
import '@univerjs/preset-docs-drawing/lib/index.css';
import { UniverDocsHyperLinkPreset } from '@univerjs/preset-docs-hyper-link';
import hyperLinkZhCN from '@univerjs/preset-docs-hyper-link/locales/zh-CN';
import hyperLinkEnUS from '@univerjs/preset-docs-hyper-link/locales/en-US';
import '@univerjs/preset-docs-hyper-link/lib/index.css';
import { UniverDocsThreadCommentPreset } from '@univerjs/preset-docs-thread-comment';
import commentZhCN from '@univerjs/preset-docs-thread-comment/locales/zh-CN';
import commentEnUS from '@univerjs/preset-docs-thread-comment/locales/en-US';
import '@univerjs/preset-docs-thread-comment/lib/index.css';

const presets = {
  UniverDocsCorePreset,
  UniverDocsDrawingPreset,
  UniverDocsHyperLinkPreset,
  UniverDocsThreadCommentPreset
};

const locales = {
  zhCN: mergeLocales(docsZhCN, drawingZhCN, hyperLinkZhCN, commentZhCN),
  enUS: mergeLocales(docsEnUS, drawingEnUS, hyperLinkEnUS, commentEnUS)
};

export {
  createUniver,
  LocaleType,
  mergeLocales,
  defaultTheme,
  UniverDocsCorePreset,
  UniverDocsDrawingPreset,
  UniverDocsHyperLinkPreset,
  UniverDocsThreadCommentPreset,
  docsZhCN,
  docsEnUS,
  drawingZhCN,
  drawingEnUS,
  hyperLinkZhCN,
  hyperLinkEnUS,
  commentZhCN,
  commentEnUS,
  presets,
  locales
};
