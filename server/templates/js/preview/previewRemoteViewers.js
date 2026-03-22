/**
 * Remote tunnel viewers: count + popover with IP, proxy account, time, UA (from proxy).
 */
window.PreviewRemoteViewers = (function () {
  let widgetEl = null;
  let popoverEl = null;
  let countEl = null;
  let listEl = null;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return String(ts);
    }
  }

  function renderList(count, sessions) {
    if (!listEl || !countEl) return;
    const n = Math.max(0, Number(count) || 0);
    const list = Array.isArray(sessions) ? sessions : [];
    countEl.textContent = String(n);
    countEl.setAttribute(
      'title',
      n + ' remote tunnel viewer(s) (WebSocket streams via proxy)'
    );

    if (n === 0) {
      listEl.innerHTML =
        '<li class="client-sessions-empty">No remote viewers via tunnel. ' +
        'Requires outbound agent + Remote Explorer sign-in.</li>';
      return;
    }

    if (list.length === 0) {
      listEl.innerHTML =
        '<li class="client-sessions-row">' +
        '<span class="client-sessions-ip">' +
        escapeHtml(String(n)) +
        ' active session' +
        (n === 1 ? '' : 's') +
        '</span>' +
        '<span class="client-sessions-meta">Per-viewer details need an updated proxy.</span>' +
        '</li>';
      return;
    }

    listEl.innerHTML = list
      .map(function (s) {
        const ip = s.ip || '?';
        const account = (s.account && String(s.account).trim()) || '';
        const ua = s.userAgent ? String(s.userAgent) : '';
        return (
          '<li class="client-sessions-row">' +
          '<span class="client-sessions-ip">' +
          escapeHtml(ip) +
          '</span>' +
          (account
            ? '<span class="client-sessions-meta">' +
              'Account: <strong>' +
              escapeHtml(account) +
              '</strong> · ' +
              escapeHtml(formatTime(s.connectedAt)) +
              '</span>'
            : '<span class="client-sessions-meta">' +
              escapeHtml(formatTime(s.connectedAt)) +
              '</span>') +
          (ua
            ? '<div class="client-sessions-ua" title="' +
              escapeHtml(ua) +
              '">' +
              escapeHtml(ua.slice(0, 72)) +
              (ua.length > 72 ? '…' : '') +
              '</div>'
            : '') +
          '</li>'
        );
      })
      .join('');
  }

  function updateDisplay(count, sessions) {
    renderList(count, sessions);
  }

  function ensureWidget() {
    if (widgetEl) return;
    const mount = document.getElementById('remoteViewersMount');
    if (!mount) return;

    widgetEl = document.createElement('div');
    widgetEl.className = 'remote-viewers-widget';
    widgetEl.innerHTML =
      '<button type="button" class="client-sessions-trigger" id="remoteViewersTrigger" title="Remote tunnel viewers">' +
      '<span class="client-sessions-icon" aria-hidden="true">🌐</span>' +
      '<span class="client-sessions-count" id="remoteViewerCount">0</span>' +
      '</button>' +
      '<div class="client-sessions-popover status-bar-menu-popover" id="remoteViewersPopover" hidden>' +
      '<div class="client-sessions-popover-title">Remote tunnel viewers</div>' +
      '<p class="client-sessions-popover-hint">Who is viewing this machine through the proxy reverse tunnel. ' +
      'IP and browser come from the connection; <strong>Account</strong> is the signed-in proxy user.</p>' +
      '<ul class="client-sessions-list" id="remoteViewersList"></ul>' +
      '</div>';

    mount.appendChild(widgetEl);

    countEl = document.getElementById('remoteViewerCount');
    listEl = document.getElementById('remoteViewersList');
    popoverEl = document.getElementById('remoteViewersPopover');
    const trigger = document.getElementById('remoteViewersTrigger');

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!popoverEl) return;
      const open = popoverEl.hasAttribute('hidden');
      if (open) {
        if (window.PreviewStatusBar && typeof window.PreviewStatusBar.closeAllPopoversExcept === 'function') {
          window.PreviewStatusBar.closeAllPopoversExcept(popoverEl);
        }
        popoverEl.removeAttribute('hidden');
      } else {
        popoverEl.setAttribute('hidden', '');
      }
    });

    document.addEventListener('click', function () {
      if (popoverEl && !popoverEl.hasAttribute('hidden')) {
        popoverEl.setAttribute('hidden', '');
      }
    });

    widgetEl.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  function applyUpdate(data) {
    ensureWidget();
    if (!countEl) return;
    const count = Number(data.count) || 0;
    const previous =
      data.previous !== undefined && data.previous !== null
        ? Number(data.previous)
        : count;
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    updateDisplay(count, sessions);

    /**
     * Proxy only sends remote_viewers when the tunnel viewer count changes; it sets
     * previous = count before the change and count = new total. Toast when that
     * differs (do not require previous === lastSynced — that broke when fetch
     * was stale or a WS message arrived before init() finished).
     */
    const serverReportedChange = count !== previous;
    if (serverReportedChange) {
      const title =
        count > previous ? 'Remote viewer connected' : 'Remote viewer disconnected';
      const sub =
        (count === 1 ? '1 remote viewer' : count + ' remote viewers') +
        ' via tunnel · your PC';
      if (
        window.PreviewStatusBar &&
        typeof window.PreviewStatusBar.showStatusToast === 'function'
      ) {
        window.PreviewStatusBar.showStatusToast(title, sub);
      }
    }
  }

  async function fetchInitial() {
    try {
      const res = await fetch('/__api__/remote/tunnel-viewers', { cache: 'no-cache' });
      const data = await res.json();
      if (data && data.success) {
        const n = Number(data.count) || 0;
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        updateDisplay(n, sessions);
      }
    } catch (e) {
      updateDisplay(0, []);
    }
  }

  async function init() {
    ensureWidget();
    await fetchInitial();
  }

  /** Call before WebSocket connects so applyUpdate never runs before the widget exists. */
  function prewarm() {
    ensureWidget();
  }

  return {
    init: init,
    applyUpdate: applyUpdate,
    prewarm: prewarm
  };
})();
