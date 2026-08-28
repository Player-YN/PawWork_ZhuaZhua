/**
 * Source contract: background.js is a plain MV3 service worker.
 * `node --check` catches syntax only — a handler name in the onMessage
 * dispatch that is imported/declared only inside a comment still throws
 * ReferenceError at runtime (see handleWorkspaceCapturePageBlueprint).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/background.js'), 'utf8');
const live = stripJsComments(src);

const defined = new Set();
for (const m of live.matchAll(/\bimport\s*\{([^}]+)\}/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim();
    if (name) defined.add(name);
  }
}
for (const m of live.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
  defined.add(m[1]);
}
for (const m of live.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
  defined.add(m[1]);
}

const called = new Set();
for (const m of live.matchAll(/\b(handle[A-Z][A-Za-z0-9]*)\s*\(/g)) {
  called.add(m[1]);
}

assert.ok(
  called.has('handleWorkspaceCapturePageBlueprint'),
  'dispatch must call handleWorkspaceCapturePageBlueprint'
);
assert.ok(
  /(?:async\s+)?function\s+handleWorkspaceCapturePageBlueprint\s*\(/.test(live),
  'handleWorkspaceCapturePageBlueprint must be live code, not a commented-out body'
);

const missing = [...called].filter((name) => !defined.has(name)).sort();
assert.deepEqual(
  missing,
  [],
  `background.js dispatch references undefined handlers: ${missing.join(', ')}`
);

function stripJsComments(input) {
  let out = '';
  let i = 0;
  let state = 'code';
  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        state = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out += ch;
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      if (ch === '\n') out += '\n';
      i += 1;
      continue;
    }
    out += ch;
    if (ch === '\\' && i + 1 < input.length) {
      out += input[i + 1];
      i += 2;
      continue;
    }
    if (ch === state) state = 'code';
    i += 1;
  }
  return out;
}
