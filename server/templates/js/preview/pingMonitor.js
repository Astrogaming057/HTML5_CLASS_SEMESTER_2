window.PreviewPingMonitor = (function() {
  let pingHistory = [];
  let pingInterval = null;
  const MAX_PING_HISTORY = 60; // Store last 60 pings (3 minutes at 3s intervals)
  /** Stats + graph use the last N samples (rolling window). */
  const DISPLAY_PING_WINDOW = 20;
  const PING_INTERVAL = 3000; // Ping every 3 seconds

  /** After mode check stays failed for this long, show crash dialog (once until recovery). */
  const BACKEND_CRASH_DELAY_MS = 10000;

  /** Slightly faster: remote tunnel / bad gateway is usually not a local crash. */
  const REMOTE_OFFLINE_DELAY_MS = 6000;

  let backendCrashTimer = null;
  let backendCrashDialogShown = false;
  let lastCrashDetail = null;

  let remoteOfflineTimer = null;
  let remoteOfflineDialogShown = false;
  let pendingRemoteOfflineDetail = null;

  function isRemoteSessionActive() {
    return (
      window.PreviewRemoteSession &&
      typeof PreviewRemoteSession.isRemoteActive === 'function' &&
      PreviewRemoteSession.isRemoteActive()
    );
  }

  function hideRemoteOfflineDialog() {
    const overlay = document.getElementById('remoteOfflineOverlay');
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function ensureRemoteOfflineDialog() {
    let overlay = document.getElementById('remoteOfflineOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'remoteOfflineOverlay';
    overlay.className = 'remote-offline-overlay';
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="remote-offline-dialog" role="dialog" aria-modal="true" aria-labelledby="remoteOfflineTitle">' +
      '<h2 id="remoteOfflineTitle" class="remote-offline-title">Remote connection issue</h2>' +
      '<p id="remoteOfflineBody" class="remote-offline-body">Loading…</p>' +
      '<div class="remote-offline-actions-top">' +
      '<button type="button" class="btn btn-primary" id="remoteOfflineUseLocal">Use this PC (local)</button>' +
      '</div>' +
      '<div class="remote-offline-section-title">Your devices</div>' +
      '<div id="remoteOfflineDeviceList" class="remote-offline-device-list"></div>' +
      '<p class="remote-offline-hint" id="remoteOfflineHint"></p>' +
      '<div class="remote-offline-actions-bottom">' +
      '<button type="button" class="btn btn-secondary" id="remoteOfflineOpenExplorer">Open Remote Explorer</button>' +
      '<button type="button" class="btn btn-secondary" id="remoteOfflineDismiss">Dismiss</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideRemoteOfflineDialog();
    });

    document.getElementById('remoteOfflineUseLocal').addEventListener('click', function () {
      if (window.PreviewRemoteSession) {
        PreviewRemoteSession.setMode('local');
        PreviewRemoteSession.setTargetDeviceId(null);
      }
      hideRemoteOfflineDialog();
      window.location.reload();
    });

    document.getElementById('remoteOfflineOpenExplorer').addEventListener('click', function () {
      hideRemoteOfflineDialog();
      const btn = document.getElementById('remoteExplorerBtn');
      if (btn) btn.click();
    });

    document.getElementById('remoteOfflineDismiss').addEventListener('click', hideRemoteOfflineDialog);

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideRemoteOfflineDialog();
    });

    return overlay;
  }

  function populateRemoteOfflineDeviceList(detail) {
    const container = document.getElementById('remoteOfflineDeviceList');
    const hint = document.getElementById('remoteOfflineHint');
    if (!container) return;
    container.innerHTML = '';
    if (hint) hint.textContent = '';

    const kind = detail && detail.kind;
    if (kind === 'proxyUnreachable' && hint) {
      hint.textContent =
        'Listing devices needs the proxy. “Use this PC” always works — it only changes this tab to local mode (no proxy call).';
    }

    if (!window.PreviewRemoteAuthApi || !window.PreviewRemoteSession) {
      if (hint && !hint.textContent) hint.textContent = 'Remote Explorer is not available.';
      return;
    }
    const sess = PreviewRemoteSession;
    const auth = PreviewRemoteAuthApi;
    if (!sess.getToken()) {
      if (hint && !hint.textContent) {
        hint.textContent = 'Sign in via Remote Explorer (satellite icon) to list your devices.';
      }
      return;
    }

    container.innerHTML =
      '<span class="remote-offline-loading">Loading devices…</span>';
    auth
      .fetchDevices()
      .then(function (devices) {
        container.innerHTML = '';
        if (!devices || devices.length === 0) {
          if (hint && !hint.textContent) {
            hint.textContent = 'No online devices. Use “Use this PC” or register a device when it is back.';
          }
          return;
        }
        const currentId = sess.getTargetDeviceId();
        devices.forEach(function (dev) {
          const id = dev.id || dev.deviceId;
          const name = dev.name || dev.label || id;
          const isCurrent = currentId && String(id) === String(currentId);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-secondary remote-offline-device-btn';
          if (isCurrent) btn.className += ' remote-offline-device-current';
          btn.textContent = (isCurrent ? '● ' : '') + name;
          btn.setAttribute('data-device-id', String(id));
          btn.addEventListener('click', function () {
            sess.setMode('remote');
            sess.setTargetDeviceId(String(id));
            if (sess.setTargetDeviceLabel) sess.setTargetDeviceLabel(name);
            hideRemoteOfflineDialog();
            window.location.reload();
          });
          container.appendChild(btn);
        });
      })
      .catch(function () {
        container.innerHTML = '';
        if (hint && !hint.textContent) {
          hint.textContent =
            'Could not load devices (proxy may be down). Use “Use this PC” to exit remote mode without the proxy.';
        }
      });
  }

  function applyRemoteOfflineCopy(detail) {
    const title = document.getElementById('remoteOfflineTitle');
    const body = document.getElementById('remoteOfflineBody');
    if (!title || !body) return;
    const kind = detail && detail.kind;
    if (kind === 'proxyUnreachable') {
      title.textContent = 'Proxy unreachable';
      body.textContent =
        'The proxy server is down or not reachable from this browser, so the tunnel to the remote device cannot be used. ' +
        'Your local Astro Code backend is still running — use “Use this PC” below to keep working without the proxy. ' +
        'No network is required for that switch.';
    } else if (kind === 'remoteTunnelOffline') {
      title.textContent = 'Remote device unreachable';
      body.textContent =
        'The other computer may be offline, or the proxy returned an error (bad gateway) for the tunnel. ' +
        'Try “Use this PC” to work locally, or pick another device when the proxy is available.';
    } else {
      title.textContent = 'Remote connection unavailable';
      body.textContent =
        'The tunnel through the proxy is not working right now. Use “Use this PC” to continue on this machine without the remote session.';
    }
  }

  function showRemoteOfflineDialog(detail) {
    const overlay = ensureRemoteOfflineDialog();
    applyRemoteOfflineCopy(detail || pendingRemoteOfflineDetail || { kind: 'unknown' });
    populateRemoteOfflineDeviceList(detail);
    hideBackendCrashDialog();
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    const focusBtn = document.getElementById('remoteOfflineUseLocal');
    if (focusBtn) focusBtn.focus();
  }

  function clearRemoteOfflineTimer() {
    if (remoteOfflineTimer) {
      clearTimeout(remoteOfflineTimer);
      remoteOfflineTimer = null;
    }
  }

  function scheduleRemoteOfflineDialog(detail) {
    if (remoteOfflineDialogShown) return;
    if (remoteOfflineTimer) return;
    pendingRemoteOfflineDetail = detail || null;
    remoteOfflineTimer = setTimeout(function () {
      remoteOfflineTimer = null;
      remoteOfflineDialogShown = true;
      const d = pendingRemoteOfflineDetail;
      pendingRemoteOfflineDetail = null;
      showRemoteOfflineDialog(d);
    }, REMOTE_OFFLINE_DELAY_MS);
  }

  /**
   * Second step when Remote Explorer is active: probe tunnel to remote device via proxy.
   * Local GET /__api__/mode stays on this machine (see remoteTransport); this fetch uses the tunneled URL.
   */
  function notifyTunnelProbeResult(ok, detail) {
    if (!isRemoteSessionActive()) {
      clearRemoteOfflineTimer();
      remoteOfflineDialogShown = false;
      pendingRemoteOfflineDetail = null;
      hideRemoteOfflineDialog();
      return;
    }
    if (ok) {
      clearRemoteOfflineTimer();
      remoteOfflineDialogShown = false;
      pendingRemoteOfflineDetail = null;
      hideRemoteOfflineDialog();
      return;
    }
    clearBackendCrashTimer();
    backendCrashDialogShown = false;
    hideBackendCrashDialog();
    if (remoteOfflineDialogShown) return;
    if (remoteOfflineTimer) return;
    scheduleRemoteOfflineDialog(detail);
  }

  async function probeRemoteTunnelAfterLocalOk() {
    if (!isRemoteSessionActive()) {
      notifyTunnelProbeResult(true);
      return;
    }
    const transport = window.PreviewRemoteTransport;
    if (!transport || typeof transport.rewriteUrl !== 'function') {
      notifyTunnelProbeResult(true);
      return;
    }
    let tunnelUrl;
    try {
      tunnelUrl = transport.rewriteUrl('/__api__/mode');
    } catch (e) {
      notifyTunnelProbeResult(true);
      return;
    }
    if (
      !tunnelUrl ||
      typeof tunnelUrl !== 'string' ||
      tunnelUrl.indexOf('http') !== 0 ||
      tunnelUrl.indexOf(window.location.origin) === 0
    ) {
      notifyTunnelProbeResult(true);
      return;
    }

    const ctrl2 = new AbortController();
    const t2 = setTimeout(function () {
      ctrl2.abort();
    }, 6000);
    try {
      const r2 = await fetch(tunnelUrl, {
        method: 'GET',
        cache: 'no-cache',
        signal: ctrl2.signal
      });
      clearTimeout(t2);
      if (!r2.ok) {
        const st = r2.status;
        const kind = st >= 502 && st <= 504 ? 'remoteTunnelOffline' : 'proxyUnreachable';
        notifyTunnelProbeResult(false, {
          kind: kind,
          message: 'HTTP ' + st + ' ' + (r2.statusText || ''),
          status: st
        });
      } else {
        notifyTunnelProbeResult(true);
      }
    } catch (e2) {
      clearTimeout(t2);
      notifyTunnelProbeResult(false, {
        kind: 'proxyUnreachable',
        message: e2 && e2.message ? e2.message : String(e2),
        stack: e2 && e2.stack ? e2.stack : ''
      });
    }
  }

  function buildBugReportText(detail) {
    const client = typeof window !== 'undefined' && window.__CLIENT_MODE ? window.__CLIENT_MODE : 'unknown';
    const msg = detail && detail.message ? detail.message : 'Mode check failed';
    const stack = detail && detail.stack ? detail.stack : '';
    return [
      'Astro Code preview — backend mode check failed',
      'Time: ' + new Date().toISOString(),
      'Client mode: ' + client,
      'Endpoint: GET /__api__/mode',
      '',
      'Error:',
      msg,
      '',
      'Stack (browser / fetch, if available):',
      stack || '(No JS stack. If the Node server crashed, copy the stack from the terminal or Electron main process logs.)'
    ].join('\n');
  }

  function hideBackendCrashDialog() {
    const overlay = document.getElementById('backendCrashOverlay');
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function ensureBackendCrashDialog() {
    let overlay = document.getElementById('backendCrashOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'backendCrashOverlay';
    overlay.className = 'backend-crash-overlay';
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="backend-crash-dialog" role="dialog" aria-modal="true" aria-labelledby="backendCrashTitle">' +
      '<h2 id="backendCrashTitle" class="backend-crash-title">Uh oh :(</h2>' +
      '<p class="backend-crash-body">The <strong>local</strong> Astro Code backend on this machine is not responding (GET /__api__/mode failed). ' +
      'This is not the same as the remote proxy being down — if you only lost the proxy, use Remote Explorer’s “Use this PC” instead. ' +
      'Otherwise restart the app or the Node process. If this keeps happening, file a bug report with the details below.</p>' +
      '<label class="backend-crash-label" for="backendCrashStack">Details for bug reports</label>' +
      '<pre class="backend-crash-stack" id="backendCrashStack" readonly tabindex="0"></pre>' +
      '<div class="backend-crash-actions">' +
      '<button type="button" class="btn btn-secondary" id="backendCrashCopy">Copy details</button>' +
      '<button type="button" class="btn btn-primary" id="backendCrashDismiss">OK</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideBackendCrashDialog();
    });

    const pre = document.getElementById('backendCrashStack');
    const copyBtn = document.getElementById('backendCrashCopy');
    const dismissBtn = document.getElementById('backendCrashDismiss');

    copyBtn.addEventListener('click', function () {
      const text = pre ? pre.textContent : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
    });

    dismissBtn.addEventListener('click', hideBackendCrashDialog);

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideBackendCrashDialog();
    });

    return overlay;
  }

  function showBackendCrashDialog(detail) {
    const overlay = ensureBackendCrashDialog();
    const pre = document.getElementById('backendCrashStack');
    if (pre) {
      pre.textContent = buildBugReportText(detail);
    }
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    const dismissBtn = document.getElementById('backendCrashDismiss');
    if (dismissBtn) dismissBtn.focus();
  }

  function clearBackendCrashTimer() {
    if (backendCrashTimer) {
      clearTimeout(backendCrashTimer);
      backendCrashTimer = null;
    }
  }

  /**
   * Call when any GET /__api__/mode check completes.
   * @param {boolean} ok
   * @param {{ message?: string, stack?: string, kind?: string, status?: number } | null} detail
   */
  function notifyModeCheckResult(ok, detail) {
    if (ok) {
      clearBackendCrashTimer();
      backendCrashDialogShown = false;
      lastCrashDetail = null;
      hideBackendCrashDialog();
      /* Remote/proxy overlay is driven by tunnel probe (notifyTunnelProbeResult), not local ping — avoids flicker and false “crash” when proxy is down. */
      return;
    }

    lastCrashDetail = detail || { message: 'Mode check failed', stack: '' };

    /* Local GET /__api__/mode failed — real local backend issue, not proxy (mode is never tunneled). */
    clearRemoteOfflineTimer();
    remoteOfflineDialogShown = false;
    pendingRemoteOfflineDetail = null;
    hideRemoteOfflineDialog();

    if (backendCrashDialogShown) return;
    if (backendCrashTimer) return;
    backendCrashTimer = setTimeout(function () {
      backendCrashTimer = null;
      backendCrashDialogShown = true;
      showBackendCrashDialog(lastCrashDetail);
    }, BACKEND_CRASH_DELAY_MS);
  }

  function modeCheckFailureDetail(status, statusText) {
    return {
      message: 'HTTP ' + status + ' ' + (statusText || ''),
      stack: '',
      status: status
    };
  }

  async function measurePing() {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, 5000);

    try {
      const response = await fetch('/__api__/mode', {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const ping = Math.round(endTime - startTime);

      if (response.ok) {
        pingHistory.push({
          time: Date.now(),
          ping: ping,
          success: true
        });
        notifyModeCheckResult(true);
        await probeRemoteTunnelAfterLocalOk();
      } else {
        pingHistory.push({
          time: Date.now(),
          ping: null,
          success: false
        });
        notifyModeCheckResult(false, modeCheckFailureDetail(response.status, response.statusText));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      pingHistory.push({
        time: Date.now(),
        ping: null,
        success: false
      });
      notifyModeCheckResult(false, {
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : ''
      });
    }

    if (pingHistory.length > MAX_PING_HISTORY) {
      pingHistory = pingHistory.slice(-MAX_PING_HISTORY);
    }
  }

  function getConnectionEndpointText() {
    const sess = window.PreviewRemoteSession;
    if (
      sess &&
      typeof sess.isRemoteActive === 'function' &&
      sess.isRemoteActive()
    ) {
      const label = typeof sess.getTargetDeviceLabel === 'function' ? sess.getTargetDeviceLabel() : null;
      const id = typeof sess.getTargetDeviceId === 'function' ? sess.getTargetDeviceId() : null;
      if (label) return label;
      if (id) return 'Device ' + String(id).slice(0, 10) + (String(id).length > 10 ? '…' : '');
      return 'Remote device';
    }
    return typeof window !== 'undefined' && window.location && window.location.host
      ? window.location.host
      : 'localhost';
  }

  function getPingStats() {
    const windowHist = pingHistory.slice(-DISPLAY_PING_WINDOW);
    const successfulPings = windowHist.filter(p => p.success && p.ping !== null);
    const failedPings = windowHist.filter(p => !p.success || p.ping === null);

    if (successfulPings.length === 0) {
      return {
        average: null,
        last: null,
        packetLoss: windowHist.length > 0 ? (failedPings.length / windowHist.length * 100).toFixed(1) : '0.0',
        serverEndpoint: getConnectionEndpointText()
      };
    }

    const pings = successfulPings.map(p => p.ping);
    const average = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    const last = successfulPings[successfulPings.length - 1].ping;
    const packetLoss = windowHist.length > 0 ? (failedPings.length / windowHist.length * 100).toFixed(1) : '0.0';

    return {
      average,
      last,
      packetLoss,
      serverEndpoint: getConnectionEndpointText()
    };
  }

  /**
   * Upper bound for the Y-axis so any latency (e.g. 60ms) is not clipped at a fixed 0–20ms scale.
   * Adds a little headroom and rounds to a readable step (10, 20, 50, 100ms, …).
   */
  function niceAxisMaxMs(maxPingMs) {
    const v = Number(maxPingMs);
    if (!isFinite(v) || v <= 0) return 20;
    const headroom = Math.max(v * 1.12, v + 4);
    const exp = Math.floor(Math.log10(headroom));
    const pow = Math.pow(10, exp);
    const n = headroom / pow;
    let step;
    if (n <= 1) step = 1;
    else if (n <= 2) step = 2;
    else if (n <= 5) step = 5;
    else step = 10;
    return step * pow;
  }

  function drawPingGraph(canvas, ctx) {
    const history = pingHistory.slice(-DISPLAY_PING_WINDOW);
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;

    const successVals = history
      .filter(p => p.success && p.ping !== null)
      .map(p => Number(p.ping))
      .filter(p => isFinite(p));
    const dataMax = successVals.length ? Math.max.apply(null, successVals) : 0;
    const yMax = dataMax > 0 ? niceAxisMaxMs(dataMax) : 20;
    const yMin = 0;

    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      ctx.fillStyle = '#aaa';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      const value = Math.round(yMax - (i / 4) * (yMax - yMin));
      ctx.fillText(String(value), 5, y + 3);
    }

    const n = history.length;
    function xAt(index) {
      if (n <= 1) return padding + graphWidth / 2;
      return padding + (graphWidth / (n - 1)) * index;
    }
    function yForPing(ms) {
      const t = (ms - yMin) / (yMax - yMin || 1);
      return padding + graphHeight - t * graphHeight;
    }

    if (n > 0) {
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const p = history[i];
        if (!p.success || p.ping === null) {
          started = false;
          continue;
        }
        const x = xAt(i);
        const y = yForPing(p.ping);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      for (let i = 0; i < n; i++) {
        const p = history[i];
        const x = xAt(i);
        if (p.success && p.ping !== null) {
          ctx.fillStyle = '#4a9eff';
          ctx.beginPath();
          ctx.arc(x, yForPing(p.ping), 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#c44';
          ctx.beginPath();
          ctx.arc(x, padding + graphHeight - 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (history.length > 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';

      const firstTime = new Date(history[0].time);
      const lastTime = new Date(history[history.length - 1].time);

      const formatTime = (date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      };

      ctx.fillText(formatTime(firstTime), padding, height - 5);
      ctx.fillText(formatTime(lastTime), width - padding, height - 5);
    }
  }

  function updatePingGraph() {
    const canvas = document.getElementById('pingGraph');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    drawPingGraph(canvas, ctx);

    // Update stats
    const stats = getPingStats();
    const avgPingEl = document.getElementById('avgPing');
    const lastPingEl = document.getElementById('lastPing');
    const packetLossEl = document.getElementById('packetLoss');

    if (avgPingEl) avgPingEl.textContent = stats.average !== null ? `${stats.average} ms` : '-';
    if (lastPingEl) lastPingEl.textContent = stats.last !== null ? `${stats.last} ms` : '-';
    if (packetLossEl) packetLossEl.textContent = `${stats.packetLoss}%`;
    const endpointEl = document.getElementById('connectionEndpoint');
    if (endpointEl) endpointEl.textContent = stats.serverEndpoint;
  }

  const module = {
    start() {
      if (pingInterval) return;

      void measurePing().catch(function () {});

      pingInterval = setInterval(function () {
        void measurePing().catch(function () {});
      }, PING_INTERVAL);
    },

    stop() {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    },

    getStats() {
      return getPingStats();
    },

    updateGraph() {
      updatePingGraph();
    },

    getHistory() {
      return [...pingHistory];
    },

    /** Exposed for other /__api__/mode callers (e.g. mode indicator) */
    notifyModeCheckResult: notifyModeCheckResult
  };

  return module;
})();
