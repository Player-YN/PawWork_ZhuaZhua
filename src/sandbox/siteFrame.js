import { createSiteFrameRuntime } from './siteFrameRuntime.js';

const runtime = createSiteFrameRuntime({
  document,
  parentWindow: window.parent,
  postToParent(msg) {
    window.parent.postMessage(msg, '*');
  }
});

window.addEventListener('message', (ev) => {
  runtime.handleParent(ev);
});
document.addEventListener(
  'click',
  (e) => {
    runtime.onGuestClick(e);
  },
  true
);
document.addEventListener(
  'submit',
  (e) => {
    e.preventDefault();
  },
  true
);
runtime.announceReady();
