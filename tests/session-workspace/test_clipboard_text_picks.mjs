/**
 * Clicked live-page text → Clipboard group only (not 文字N capture chips).
 * No small per-item char cap; silent MV3 host max is huge.
 */
import assert from 'node:assert/strict';
import { SessionWorkspaceStore } from '../../src/agent/vnext/sessionWorkspace/index.js';
import { SessionWorkspaceService } from '../../src/agent/vnext/service/sessionWorkspaceService.js';
import {
  pinClipboardItems,
  isClipboardTextPick,
  clipClipboardText,
  CLIPBOARD_TEXT_HOST_MAX
} from '../../src/agent/vnext/sessionWorkspace/groups.js';

function captureItems(state) {
  return (state.groups || [])
    .filter((g) => g.kind !== 'clipboard')
    .flatMap((g) => g.items || []);
}

function clipboardItems(state) {
  return (state.groups || []).find((g) => g.kind === 'clipboard')?.items || [];
}

{
  assert.equal(isClipboardTextPick({ tag: 'p', text: 'hello paragraph' }), true);
  assert.equal(isClipboardTextPick({ tag: 'img', kind: 'image', src: 'https://x/a.png' }), false);
  assert.equal(isClipboardTextPick({ kind: 'container', tag: 'div', text: 'block' }), false);
  assert.equal(isClipboardTextPick({ tag: 'table', kind: 'table', text: 'cell' }), false);
  assert.equal(isClipboardTextPick({ kind: 'screenshot', src: 'data:image/png;base64,xx' }), false);
  assert.equal(isClipboardTextPick({ kind: 'page', href: 'https://example.com' }), false);
  const article = '篇'.repeat(20000);
  assert.equal(clipClipboardText(article).length, 20000);
  assert.ok(CLIPBOARD_TEXT_HOST_MAX >= 8 * 1024 * 1024);
}

{
  const store = new SessionWorkspaceStore();
  const long = `${'第一段。'.repeat(80)}\n\n${'第二段，带换行。'.repeat(80)}`;
  const { added } = pinClipboardItems(store, [{ text: long }, { text: long }], 'pin');
  assert.equal(added.length, 1, 'dedupes identical long text');
  assert.equal(added[0].capture.text, long, 'stores full text including newlines');
  assert.ok(!added[0].capture.text.includes('…'));
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('click');
  await svc.createGroup({ name: 'Picks', sessionId: 'click' });
  const long = '长'.repeat(12000);
  const state = await svc.syncTabSelection({
    sessionId: 'click',
    tabId: 4,
    url: 'https://example.com/article',
    elements: [
      { text: long, tag: 'P', selector: 'p.article' },
      { src: 'https://cdn.example/hero.png', kind: 'image', tag: 'IMG', selector: 'img.hero' },
      { kind: 'container', tag: 'DIV', text: 'box copy', selector: 'div.box' },
      { kind: 'table', tag: 'TABLE', text: 'cell', selector: 'table.t' }
    ]
  });
  const capture = captureItems(state);
  const clip = clipboardItems(state);
  assert.equal(
    capture.some((it) => String(it.text || '').includes('长'.repeat(8))),
    false,
    'clicked text must not become a capture 文字 item'
  );
  assert.ok(
    capture.some((it) => String(it.src || '').includes('hero.png')),
    'image stays in capture Group'
  );
  assert.ok(
    capture.some((it) => it.kindHint === 'container' || it.kind === 'container'),
    'container stays in capture Group'
  );
  assert.ok(
    capture.some((it) => it.kindHint === 'table' || it.kind === 'table' || it.labelKind === 'table'),
    'table stays in capture Group'
  );
  const pin = clip.find((it) => String(it.text || '').startsWith('长'));
  assert.ok(pin, 'text pick lands on Clipboard');
  assert.equal(String(pin.text).length, 12000, 'clipboard text is not truncated at 500/2000/8000');
}

{
  const svc = new SessionWorkspaceService({ store: new SessionWorkspaceStore() });
  svc.ensureSession('pin-long');
  const body = '段'.repeat(50000);
  const pinned = await svc.pinClipboard({ sessionId: 'pin-long', items: [{ text: body }] });
  const clip = clipboardItems(pinned);
  assert.equal(clip.length, 1);
  assert.equal(String(clip[0].text).length, 50000);
}

console.log('clipboard text picks: PASS');
