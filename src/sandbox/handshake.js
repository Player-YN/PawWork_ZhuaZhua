/** Guest → host ready pulse. No imports so it runs before the code runtime graph. */
const CHANNEL = 'pawwork-code-sandbox-v1';

function announceReady() {
  try {
    parent.postMessage({ channel: CHANNEL, type: 'ready' }, '*');
  } catch (_) {}
}

announceReady();
const readyPulse = setInterval(announceReady, 250);
window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  const msg = event.data;
  if (msg && msg.channel === CHANNEL && msg.type === 'ready-ack') {
    clearInterval(readyPulse);
  }
});
