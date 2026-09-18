import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDialogCloseSelectors,
  wireDialogChrome
} from '../src/sidepanel/dialog.js';

test('closeSelectors string is one CSS query, not iterated as characters', () => {
  const joined = '[data-access-cancel], .modal-close-btn';
  assert.deepEqual(normalizeDialogCloseSelectors(joined), [joined]);
  assert.deepEqual(normalizeDialogCloseSelectors(['[data-access-cancel]', '.modal-close-btn']), [
    '[data-access-cancel]',
    '.modal-close-btn'
  ]);
  assert.deepEqual(normalizeDialogCloseSelectors(''), []);
});

test('wireDialogChrome does not call querySelectorAll with "["', () => {
  const seen = [];
  const cancel = { addEventListener() {} };
  const dialog = {
    dataset: {},
    addEventListener() {},
    querySelectorAll(sel) {
      seen.push(sel);
      if (sel === '[') throw new SyntaxError(`'${sel}' is not a valid selector`);
      return sel.includes('[data-access-cancel]') ? [cancel] : [];
    }
  };
  wireDialogChrome(dialog, { closeSelectors: '[data-access-cancel], .modal-close-btn' });
  assert.equal(seen.includes('['), false);
  assert.deepEqual(seen, ['[data-access-cancel], .modal-close-btn']);
});
