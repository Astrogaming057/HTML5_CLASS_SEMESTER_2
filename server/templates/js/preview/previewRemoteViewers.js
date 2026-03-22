/**
 * Remote tunnel viewers: count + popover with IP, proxy account, time, UA (from proxy).
 *
 * While Remote Explorer is viewing *another* PC, the main preview WebSocket is tunneled to that
 * device, so we open a second WebSocket to this page origin (local HTMLCLASS) to keep receiving
 * `remoteViewersUpdate` for **this** machine’s outbound agent.
 */
window.PreviewRemoteViewers = (function () {
  let lastSynced = null;
  /** True after first fetchInitial — avoids false toasts and fixes sync when server `previous` ≠ client state (e.g. remote session). */
  let baselineEstablished = false;
  let homeViewerWs = null;
  let homeViewerReconnectTimer = null;
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
      isRemoteExplorerViewingOtherPc()
        ? n + ' viewer(s) of this PC via tunnel (live while remote)'
        : n + ' remote tunnel viewer(s) (WebSocket streams via proxy)'
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

  function isRemoteExplorerViewingOtherPc() {
    return (
      window.PreviewRemoteTransport &&
      typeof window.PreviewRemoteTransport.isRemote === 'function' &&
      window.PreviewRemoteTransport.isRemote()
    );
  }

  function getLocalPreviewWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + window.location.host;
  }

  function stopHomeViewerSocket() {
    if (homeViewerReconnectTimer) {
      clearTimeout(homeViewerReconnectTimer);
      homeViewerReconnectTimer = null;
    }
    if (homeViewerWs) {
      try {
        homeViewerWs.onclose = function () {};
        homeViewerWs.close();
      } catch (e) {
        /* ignore */
      }
      homeViewerWs = null;
    }
  }

  function scheduleHomeViewerSocketReconnect() {
    if (homeViewerReconnectTimer) return;
    if (!isRemoteExplorerViewingOtherPc()) return;
    homeViewerReconnectTimer = setTimeout(function () {
      homeViewerReconnectTimer = null;
      startHomeViewerSocket();
    }, 1200);
  }

  /**
   * Second WS to local HTMLCLASS — only used while tunneled to another device — so “who’s viewing my PC”
   * still updates live. Ignores all other message types so local file/sync events don’t mix with remote.
   */
  function startHomeViewerSocket() {
    if (!isRemoteExplorerViewingOtherPc()) {
      stopHomeViewerSocket();
      return;
    }
    if (homeViewerWs && homeViewerWs.readyState === WebSocket.OPEN) return;
    stopHomeViewerSocket();
    try {
      const ws = new WebSocket(getLocalPreviewWebSocketUrl());
      homeViewerWs = ws;
      ws.onmessage = function (event) {
        if (!isRemoteExplorerViewingOtherPc()) return;
        try {
          const dataString =
            typeof event.data === 'string' ? event.data : event.data.toString();
          if (!dataString || !dataString.trim().startsWith('{')) return;
          const data = JSON.parse(dataString);
          if (data.type === 'remoteViewersUpdate') {
            applyUpdate(data);
          }
        } catch (e) {
          /* ignore */
        }
      };
      ws.onclose = function () {
        if (homeViewerWs === ws) homeViewerWs = null;
        scheduleHomeViewerSocketReconnect();
      };
      ws.onerror = function () {
        try {
          ws.close();
        } catch (e) {
          /* ignore */
        }
      };
    } catch (e) {
      scheduleHomeViewerSocketReconnect();
    }
  }

  function syncHomeViewerSocket() {
    if (isRemoteExplorerViewingOtherPc()) {
      startHomeViewerSocket();
    } else {
      stopHomeViewerSocket();
    }
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
      '<p class="client-sessions-popover-hint" id="remoteViewersPopoverHint">Who is viewing this machine through the proxy reverse tunnel. ' +
      'IP and browser come from the connection; <strong>Account</strong> is the signed-in proxy user.</p>' +
      '<ul class="client-sessions-list" id="remoteViewersList"></ul>' +
      '</div>';

    mount.appendChild(widgetEl);

    countEl = document.getElementById('remoteViewerCount');
    listEl = document.getElementById('remoteViewersList');
    popoverEl = document.getElementById('remoteViewersPopover');
    const hintEl = document.getElementById('remoteViewersPopoverHint');
    if (hintEl && isRemoteExplorerViewingOtherPc()) {
      hintEl.innerHTML =
        '<strong>This PC</strong> (your outbound agent): who is viewing <em>this computer</em> through the tunnel. ' +
        'While you edit another device, counts here stay for your machine. ' +
        'IP / <strong>Account</strong> come from the proxy.';
    }
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
    const count = Math.max(0, Number(data.count) || 0);
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    updateDisplay(count, sessions);

    if (!baselineEstablished) {
      lastSynced = count;
      return;
    }

    if (lastSynced === null) {
      lastSynced = count;
      return;
    }

    if (count !== lastSynced) {
      const title =
        count > lastSynced ? 'Remote viewer connected' : 'Remote viewer disconnected';
      let sub =
        (count === 1 ? '1 remote viewer' : count + ' remote viewers') + ' via tunnel';
      if (count > lastSynced && sessions.length > 0) {
        const newest = sessions[sessions.length - 1];
        const ip = newest && newest.ip ? String(newest.ip) : '';
        const acct =
          newest && newest.account ? String(newest.account).trim() : '';
        if (ip) {
          sub =
            'New viewer: ' +
            ip +
            (acct ? ' · ' + acct : '') +
            ' — ' +
            count +
            ' total';
        }
      }
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
        const n = Math.max(0, Number(data.count) || 0);
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        updateDisplay(n, sessions);
        lastSynced = n;
      } else {
        lastSynced = 0;
        updateDisplay(0, []);
      }
    } catch (e) {
      lastSynced = 0;
      updateDisplay(0, []);
    }
  }

  async function init() {
    ensureWidget();
    await fetchInitial();
    baselineEstablished = true;
    syncHomeViewerSocket();
  }

  return {
    init: init,
    applyUpdate: applyUpdate,
    syncHomeViewerSocket: syncHomeViewerSocket
  };
})();
