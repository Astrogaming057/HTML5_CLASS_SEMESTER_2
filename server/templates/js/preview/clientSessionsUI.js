/**
 * Shows how many browsers are connected to this HTMLCLASS server via WebSocket
 * (live file sync / preview). Count + popover list only — no connect/disconnect toasts.
 */
window.PreviewClientSessions = (function () {
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

  function renderList(clients) {
    if (!listEl || !countEl) return;
    const n = clients ? clients.length : 0;
    countEl.textContent = String(n);
    countEl.setAttribute('title', n + ' browser(s) connected to this server (WebSocket)');
    if (!clients || clients.length === 0) {
      listEl.innerHTML = '<li class="client-sessions-empty">No other connections (only you).</li>';
      return;
    }
    listEl.innerHTML = clients
      .map(function (c) {
        return (
          '<li class="client-sessions-row">' +
          '<span class="client-sessions-ip">' +
          escapeHtml(c.ip || '?') +
          '</span>' +
          '<span class="client-sessions-meta">' +
          escapeHtml(formatTime(c.connectedAt)) +
          '</span>' +
          (c.userAgent
            ? '<div class="client-sessions-ua" title="' +
              escapeHtml(c.userAgent) +
              '">' +
              escapeHtml(c.userAgent.slice(0, 72)) +
              (c.userAgent.length > 72 ? '…' : '') +
              '</div>'
            : '') +
          '</li>'
        );
      })
      .join('');
  }

  function applySnapshot(data) {
    const clients = (data && data.clients) || [];
    renderList(clients);
  }

  function ensureWidget() {
    if (widgetEl) return;
    const mount = document.getElementById('clientSessionsMount');
    const actions = document.querySelector('.preview-header .preview-actions');

    widgetEl = document.createElement('div');
    widgetEl.className = 'client-sessions-widget';
    widgetEl.innerHTML =
      '<button type="button" class="client-sessions-trigger" id="clientSessionsTrigger" title="Browsers connected to this server">' +
      '<span class="client-sessions-icon" aria-hidden="true">👥</span>' +
      '<span class="client-sessions-count" id="clientSessionsCount">0</span>' +
      '</button>' +
      '<div class="client-sessions-popover" id="clientSessionsPopover" hidden>' +
      '<div class="client-sessions-popover-title">Connected to this server</div>' +
      '<p class="client-sessions-popover-hint">Live sync / preview WebSockets (same project).</p>' +
      '<ul class="client-sessions-list" id="clientSessionsList"></ul>' +
      '</div>';

    if (mount) {
      mount.appendChild(widgetEl);
    } else if (actions) {
      const status = document.getElementById('status');
      if (status && status.parentNode === actions) {
        actions.insertBefore(widgetEl, status);
      } else {
        actions.insertBefore(widgetEl, actions.firstChild);
      }
    } else {
      return;
    }

    countEl = document.getElementById('clientSessionsCount');
    listEl = document.getElementById('clientSessionsList');
    popoverEl = document.getElementById('clientSessionsPopover');
    const trigger = document.getElementById('clientSessionsTrigger');

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!popoverEl) return;
      const open = popoverEl.hasAttribute('hidden');
      if (open) {
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

  async function fetchInitial() {
    try {
      const res = await fetch('/__api__/ws/clients', { cache: 'no-cache' });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.clients)) {
        applySnapshot({ clients: data.clients });
      }
    } catch (e) {
      /* ignore */
    }
  }

  function init() {
    ensureWidget();
    fetchInitial();
  }

  return {
    init: init,
    applySnapshot: applySnapshot
  };
})();
