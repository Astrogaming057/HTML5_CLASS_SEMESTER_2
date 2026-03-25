/**
 * Status bar: P2P vs proxy-tunneled remote, optional auto/handoff to P2P.
 */
window.PreviewRemoteTunnelStatus = (function () {
  const POLL_MS = 14000;
  const SESSION_P2P = 'previewRemoteP2pHandoff';
  let btnEl;
  let sepEl;
  let pollId = null;
  let lastHintsForP2p = null;
  /** Set when PRXY chip should navigate to P2P on click (capture listener). */
  let pendingP2pClick = null;

  function autoP2pSettingOn() {
    try {
      const s = window.PreviewSettings && window.PreviewSettings.getSettings();
      return !!(s && s.autoRemoteP2pWhenAvailable);
    } catch (e) {
      return false;
    }
  }

  function isP2pHandoffTab() {
    try {
      return sessionStorage.getItem(SESSION_P2P) === '1';
    } catch (e) {
      return false;
    }
  }

  function formatHostPortFromBaseUrl(base) {
    if (!base || typeof base !== 'string') return '—';
    try {
      const u = new URL(base.trim().startsWith('http') ? base.trim() : 'http://' + base.trim());
      const p = u.port;
      if (!p) {
        return u.hostname;
      }
      return u.hostname + ':' + p;
    } catch (e) {
      return base.replace(/^https?:\/\//, '').replace(/\/+$/, '') || '—';
    }
  }

  function p2pLocalHostPort() {
    try {
      if (window.location.port) {
        return window.location.hostname + ':' + window.location.port;
      }
      return window.location.hostname;
    } catch (e) {
      return '—';
    }
  }

  function hide() {
    lastHintsForP2p = null;
    pendingP2pClick = null;
    if (btnEl) {
      btnEl.hidden = true;
      btnEl.textContent = 'Remote';
      btnEl.title = '';
      btnEl.style.cursor = 'default';
    }
    if (sepEl) sepEl.hidden = true;
  }

  async function navigateP2PWithCredentials(base, hints, targetDeviceId) {
    const pack = window.PreviewRemoteHandoff;
    const sess = window.PreviewRemoteSession;
    const auth = window.PreviewRemoteAuthApi;
    if (!pack || typeof pack.encodePayload !== 'function' || !sess) return;
    const token = sess.getToken();
    let dk = hints && hints.deviceKey;
    let hUse = hints;
    if ((!dk || !String(dk).trim()) && auth && targetDeviceId) {
      try {
        hUse = await auth.fetchTransportHints(targetDeviceId);
        dk = hUse && hUse.deviceKey;
      } catch (e) {
        /* ignore */
      }
    }
    if (!token || !dk || !String(dk).trim() || !base || !targetDeviceId) {
      const msg =
        'Cannot open P2P: need proxy login and device registration. Re-open Remote Explorer or restart the proxy so transport-hints includes deviceKey.';
      if (window.PreviewUtils && typeof window.PreviewUtils.customAlert === 'function') {
        await window.PreviewUtils.customAlert(msg);
      }
      return;
    }
    const enc = pack.encodePayload({
      t: token,
      dk: String(dk),
      u: sess.getUser(),
      rid: String(targetDeviceId)
    });
    const q = window.location.search || '';
    const url =
      String(base).replace(/\/+$/, '') + '/__preview__' + q + '#remoteHandoff=' + enc;
    window.location.assign(url);
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
    if (!btnEl || !sepEl) return;

    if (isP2pHandoffTab()) {
      pendingP2pClick = null;
      sepEl.hidden = false;
      btnEl.hidden = false;
      btnEl.textContent = 'P2P ~ ' + p2pLocalHostPort();
      btnEl.title = 'Direct LAN session to this Astro Code server (not tunneled through the proxy).';
      btnEl.style.cursor = 'default';
      lastHintsForP2p = null;
      return;
    }

    if (!sess || !auth || typeof sess.isRemoteActive !== 'function' || !sess.isRemoteActive()) {
      hide();
      return;
    }
    const deviceId = sess.getTargetDeviceId();
    if (!deviceId) {
      hide();
      return;
    }

    sepEl.hidden = false;
    btnEl.hidden = false;

    let hints;
    try {
      hints = await auth.fetchTransportHints(deviceId);
    } catch (e) {
      lastHintsForP2p = null;
      btnEl.textContent = 'PRXY TUNNELED ~ —';
      btnEl.title = 'Could not load transport status from proxy.';
      pendingP2pClick = null;
      btnEl.style.cursor = 'default';
      return;
    }
    lastHintsForP2p = hints;

    const base = hints.deviceBaseUrl || '';
    const remoteEp = formatHostPortFromBaseUrl(base);
    let browserOk = false;
    if (hints.proxyCanReachDevice && base && !hints.deviceBaseIsLoopback) {
      browserOk = await probeBrowserLan(base);
    }

    let label = 'PRXY TUNNELED ~ ' + remoteEp;
    if (browserOk) {
      label += ' · CLICK TO P2P';
    }

    btnEl.textContent = label;

    if (browserOk && autoP2pSettingOn()) {
      btnEl.title = 'Auto-switching to direct LAN (settings).';
      pendingP2pClick = null;
      navigateP2PWithCredentials(base, hints, deviceId).catch(function () {});
      return;
    }

    if (browserOk) {
      btnEl.title =
        'Proxy tunnel active. Your browser can reach ' +
        remoteEp +
        ' — click to open a direct LAN (P2P) session with credentials.';
      const handoffBase = base;
      pendingP2pClick = function () {
        const sid = sess.getTargetDeviceId();
        navigateP2PWithCredentials(handoffBase, lastHintsForP2p, sid).catch(function () {});
      };
      btnEl.style.cursor = 'pointer';
    } else {
      pendingP2pClick = null;
      btnEl.title =
        'Traffic is tunneled through the proxy to ' +
        remoteEp +
        '. P2P is offered when your browser can reach that host on the LAN.';
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
    btnEl.addEventListener(
      'click',
      function (ev) {
        if (!pendingP2pClick) return;
        ev.preventDefault();
        ev.stopPropagation();
        const go = pendingP2pClick;
        pendingP2pClick = null;
        go();
      },
      true
    );
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
