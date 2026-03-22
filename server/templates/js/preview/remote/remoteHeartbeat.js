window.PreviewRemoteHeartbeat = (function () {
  let timer = null;
  const INTERVAL_MS = 20000;

  function tick() {
    const sess = window.PreviewRemoteSession;
    const api = window.PreviewRemoteAuthApi;
    if (!sess || !api || typeof api.sendHeartbeat !== 'function') return;
    if (!sess.getToken()) return;
    api.sendHeartbeat().catch(function () {});
  }

  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, INTERVAL_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop };
})();
