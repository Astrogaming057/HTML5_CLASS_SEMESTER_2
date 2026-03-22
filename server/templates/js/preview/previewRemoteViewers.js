/**
 * Remote tunnel viewers: browsers hitting /tunnel/:deviceId on the proxy (reverse tunnel).
 * Count from server + live WebSocket updates; toasts + notification bell on connect/disconnect.
 */
window.PreviewRemoteViewers = (function () {
  let lastSynced = null;
  let ready = false;

  function updateDisplay(n) {
    const el = document.getElementById('remoteViewerCount');
    const w = document.getElementById('remoteViewersWidget');
    if (el) el.textContent = String(n);
    if (w) {
      w.setAttribute(
        'title',
        n === 0
          ? 'No remote viewers via tunnel (needs outbound agent + Remote Explorer sign-in)'
          : n +
            ' remote browser(s) viewing this machine through the proxy tunnel'
      );
    }
  }

  function applyUpdate(data) {
    if (!ready) return;
    const count = Number(data.count) || 0;
    const previous =
      data.previous !== undefined && data.previous !== null
        ? Number(data.previous)
        : count;
    updateDisplay(count);
    if (lastSynced === null) {
      lastSynced = count;
      return;
    }
    if (previous === lastSynced && count !== previous) {
      const title =
        count > previous ? 'Remote viewer connected' : 'Remote viewer disconnected';
      const sub =
        (count === 1 ? '1 remote viewer' : count + ' remote viewers') + ' via tunnel';
      if (
        window.PreviewStatusBar &&
        typeof window.PreviewStatusBar.showStatusToast === 'function'
      ) {
        window.PreviewStatusBar.showStatusToast(title, sub);
      }
    }
    lastSynced = count;
  }

  async function fetchInitial() {
    try {
      const res = await fetch('/__api__/remote/tunnel-viewers', { cache: 'no-cache' });
      const data = await res.json();
      if (data && data.success) {
        const n = Number(data.count) || 0;
        updateDisplay(n);
        lastSynced = n;
      }
    } catch (e) {
      lastSynced = 0;
      updateDisplay(0);
    }
  }

  async function init() {
    await fetchInitial();
    ready = true;
  }

  return {
    init: init,
    applyUpdate: applyUpdate
  };
})();
