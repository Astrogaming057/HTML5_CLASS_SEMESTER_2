/**
 * Status bar (remote-only): how traffic reaches the other PC (proxy tunnel vs HTTP vs P2P).
 * Polls proxy transport-hints; offers LAN handoff when this browser can reach the device.
 */
window.PreviewRemoteTunnelStatus = (function () {
  const POLL_MS = 14000;
  let btnEl;
  let sepEl;
  let pollId = null;

  function hide() {
    if (btnEl) {
      btnEl.hidden = true;
      btnEl.textContent = 'Remote';
      btnEl.title = '';
      btnEl.onclick = null;
      btnEl.style.cursor = 'default';
    }
    if (sepEl) sepEl.hidden = true;
  }

  function buildHandoffUrl(deviceBase) {
    const b = String(deviceBase || '').replace(/\/+$/, '');
    if (!b) return '';
    return b + '/__preview__' + window.location.search + window.location.hash;
  }

  function describeMode(hints) {
    const agent = !!hints.agentConnected;
    const direct = !!hints.proxyCanReachDevice;
    if (!direct && agent) {
      return 'Remote · reverse tunnel';
    }
    if (direct && !agent) {
      return 'Remote · proxy → device HTTP';
    }
    if (direct && agent) {
      return 'Remote · proxy → HTTP + tunnel ready';
    }
    if (!direct && !agent) {
      return 'Remote · proxy (device may be offline)';
    }
    return 'Remote · via proxy';
  }

  async function probeBrowserLan(deviceBaseUrl) {
    if (!deviceBaseUrl) return false;
    const u =
      String(deviceBaseUrl).replace(/\/+$/, '') + '/__api__/remote/handoff-probe';
    try {
      const r = await fetch(u, { method: 'GET', cache: 'no-cache' });
      return r.ok;
    } catch (e) {
      return false;
    }
  }

  async function tick() {
    const sess = window.PreviewRemoteSession;
    const auth = window.PreviewRemoteAuthApi;
    if (!sess || !auth || typeof sess.isRemoteActive !== 'function' || !sess.isRemoteActive()) {
      hide();
      return;
    }
    const deviceId = sess.getTargetDeviceId();
    if (!deviceId) {
      hide();
      return;
    }
    if (!btnEl || !sepEl) return;
    sepEl.hidden = false;
    btnEl.hidden = false;

    let hints;
    try {
      hints = await auth.fetchTransportHints(deviceId);
    } catch (e) {
      btnEl.textContent = 'Remote · proxy';
      btnEl.title = 'Could not load transport status from proxy.';
      btnEl.onclick = null;
      btnEl.style.cursor = 'default';
      return;
    }

    const base = hints.deviceBaseUrl || '';
    const portHint =
      hints.listenPort != null && String(hints.listenPort) !== ''
        ? ' · port ' + hints.listenPort
        : '';
    let browserOk = false;
    if (hints.proxyCanReachDevice && base && !hints.deviceBaseIsLoopback) {
      browserOk = await probeBrowserLan(base);
    }
    let label = describeMode(hints) + portHint;
    if (browserOk) {
      label += ' — P2P';
    }
    btnEl.textContent = label;
    if (browserOk) {
      btnEl.title =
        'Your browser can reach this machine at ' +
        base +
        '. Click to open this preview there (direct LAN, bypass proxy).';
      btnEl.onclick = function (ev) {
        ev.preventDefault();
        const url = buildHandoffUrl(base);
        if (url) window.location.href = url;
      };
      btnEl.style.cursor = 'pointer';
    } else {
      btnEl.title =
        'Traffic goes through the proxy tunnel. P2P appears if your browser can reach ' +
        (base || 'the device') +
        ' on the LAN.';
      btnEl.onclick = null;
      btnEl.style.cursor = 'default';
    }
  }

  function startPolling() {
    if (pollId) clearInterval(pollId);
    pollId = setInterval(tick, POLL_MS);
  }

  function init() {
    btnEl = document.getElementById('remoteTunnelStatus');
    sepEl = document.getElementById('remoteTunnelStatusSep');
    if (!btnEl) return;
    tick();
    startPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { refresh: tick };
})();
