window.PreviewRemoteExplorer = (function () {
  const auth = window.PreviewRemoteAuthApi;
  const sess = window.PreviewRemoteSession;
  const transport = window.PreviewRemoteTransport;
  let dropdownEl = null;
  let devicesCache = [];
  let deviceContextMenuEl = null;

  function ensureAuthModal() {
    let wrap = document.getElementById('remoteAuthModal');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'remoteAuthModal';
    wrap.className = 'remote-auth-modal';
    wrap.setAttribute('hidden', '');
    wrap.innerHTML =
      '<div class="remote-auth-dialog">' +
      '<h2 class="remote-auth-title" id="remoteAuthTitle">Remote Explorer</h2>' +
      '<p class="remote-auth-hint" id="remoteAuthHint"></p>' +
      '<input type="text" class="remote-auth-input" id="remoteAuthUser" placeholder="Username" autocomplete="username">' +
      '<input type="password" class="remote-auth-input" id="remoteAuthPass" placeholder="Password" autocomplete="current-password">' +
      '<p class="remote-auth-error" id="remoteAuthError" hidden></p>' +
      '<div class="remote-auth-actions">' +
      '<button type="button" class="btn btn-secondary" id="remoteAuthCancel">Cancel</button>' +
      '<button type="button" class="btn btn-primary" id="remoteAuthSubmit">Sign in</button>' +
      '</div>' +
      '<button type="button" class="remote-auth-switch" id="remoteAuthSwitch">Need an account? Register</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) hideAuthModal();
    });
    return wrap;
  }

  let authModeLogin = true;

  async function showAuthModal(asRegister) {
    authModeLogin = !asRegister;
    const wrap = ensureAuthModal();
    const title = document.getElementById('remoteAuthTitle');
    const hint = document.getElementById('remoteAuthHint');
    const err = document.getElementById('remoteAuthError');
    const sw = document.getElementById('remoteAuthSwitch');
    const sub = document.getElementById('remoteAuthSubmit');
    if (title) title.textContent = authModeLogin ? 'Sign in' : 'Create account';
    await auth.ensureProxyBase();
    if (hint) {
      hint.textContent = 'Connect to ' + (window.PreviewRemoteConfig.PROXY_BASE || 'proxy');
      hint.classList.remove('remote-auth-hint-warn');
      Promise.all([
        auth.fetchProxyRemoteStatus().catch(function () { return {}; }),
        auth.fetchLocalBuildInfo && typeof auth.fetchLocalBuildInfo === 'function'
          ? auth.fetchLocalBuildInfo().catch(function () { return {}; })
          : Promise.resolve({}),
        fetch('/__api__/mode', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
      ]).then(function (results) {
        const st = results[0] || {};
        const localBi = results[1] || {};
        const modeRes = results[2] || {};
        const lv = normVersion(localBi.version) || normVersion(modeRes.version);
        const pv = normVersion(st.version);
        if (versionsDiffer(lv, pv) && hint) {
          hint.textContent +=
            ' — Proxy version (' +
            (pv || '?') +
            ') differs from this app (' +
            (lv || '?') +
            '). Update the proxy or clients to avoid subtle bugs.';
          hint.classList.add('remote-auth-hint-warn');
        } else if (st.proxyDebug && hint) {
          hint.textContent += ' — Warning: proxy is in debug mode (logs may be exposed).';
          hint.classList.add('remote-auth-hint-warn');
        }
      }).catch(function () {});
    }
    if (err) {
      err.textContent = '';
      err.setAttribute('hidden', '');
    }
    if (sw) {
      sw.textContent = authModeLogin ? 'Need an account? Register' : 'Have an account? Sign in';
    }
    if (sub) sub.textContent = authModeLogin ? 'Sign in' : 'Register';
    wrap.removeAttribute('hidden');
    const u = document.getElementById('remoteAuthUser');
    if (u) setTimeout(function () { u.focus(); }, 50);
  }

  function hideAuthModal() {
    const wrap = document.getElementById('remoteAuthModal');
    if (wrap) wrap.setAttribute('hidden', '');
  }

  function readAuthInputs() {
    const u = document.getElementById('remoteAuthUser');
    const p = document.getElementById('remoteAuthPass');
    return {
      username: (u && u.value) ? u.value.trim() : '',
      password: (p && p.value) ? p.value : ''
    };
  }

  function setAuthError(msg) {
    const err = document.getElementById('remoteAuthError');
    if (!err) return;
    err.textContent = msg || '';
    if (msg) err.removeAttribute('hidden');
    else err.setAttribute('hidden', '');
  }

  function bindAuthModal() {
    const wrap = ensureAuthModal();
    const cancel = document.getElementById('remoteAuthCancel');
    const submit = document.getElementById('remoteAuthSubmit');
    const sw = document.getElementById('remoteAuthSwitch');
    if (cancel) cancel.addEventListener('click', hideAuthModal);
    if (sw) {
      sw.addEventListener('click', function () {
        void showAuthModal(authModeLogin);
      });
    }
    if (submit) {
      submit.addEventListener('click', async function () {
        const { username, password } = readAuthInputs();
        if (!username || !password) {
          setAuthError('Enter username and password');
          return;
        }
        setAuthError('');
        try {
          if (authModeLogin) {
            await auth.login(username, password);
          } else {
            await auth.register(username, password);
          }
          hideAuthModal();
          await refreshDevices();
          await renderDropdown();
        } catch (e) {
          setAuthError(e.message || 'Request failed');
        }
      });
    }
  }

  function hideDeviceContextMenu() {
    if (deviceContextMenuEl && deviceContextMenuEl.parentNode) {
      deviceContextMenuEl.parentNode.removeChild(deviceContextMenuEl);
    }
    deviceContextMenuEl = null;
  }

  function formatLastSeen(ts) {
    if (ts == null || typeof ts !== 'number') return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return String(ts);
    }
  }

  function maskKey(k) {
    if (!k || typeof k !== 'string') return '—';
    if (k.length <= 8) return '••••••••';
    return '…' + k.slice(-6);
  }

  function normVersion(v) {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    if (!s || s === 'unknown') return '';
    return s;
  }

  /** True when both sides report a version string and they differ. */
  function versionsDiffer(a, b) {
    const x = normVersion(a);
    const y = normVersion(b);
    if (!x || !y) return false;
    return x !== y;
  }

  function formatBuildLine(bi) {
    if (!bi || !bi.version) return '';
    return String(bi.version);
  }

  /** Aligned key / value lines for monospace terminal panel */
  function formatTerminalKvRows(rows) {
    const keyW = Math.min(
      Math.max(14, ...rows.map(function (r) { return String(r[0]).length; })),
      26
    );
    return rows
      .map(function (kv) {
        const k = String(kv[0]);
        const v = String(kv[1] == null ? '—' : kv[1]);
        return k.padEnd(keyW) + '  ' + v;
      })
      .join('\n');
  }

  /** ASCII box + rows + fake shell prompt */
  function buildTerminalPanel(bannerLine, rowPairs) {
    const inner = 40;
    const bar = '─'.repeat(inner + 2);
    const top = '┌' + bar + '┐';
    const blink = String(bannerLine).slice(0, inner).padEnd(inner);
    const mid = '│ ' + blink + ' │';
    const bot = '└' + bar + '┘';
    return (
      top +
      '\n' +
      mid +
      '\n' +
      bot +
      '\n\n' +
      formatTerminalKvRows(rowPairs) +
      '\n\n' +
      'user@remote:~$ '
    );
  }

  const TERMINAL_ALERT = { terminal: true, title: '$ remote' };

  function syncSessionAfterDeviceRemoved(deviceId) {
    const sid = String(deviceId);
    if (sess.getTargetDeviceId() === sid) {
      sess.setMode('local');
      sess.setTargetDeviceId(null);
    }
    if (sess.getRegisteredLocalDeviceId() === sid) {
      sess.setRegisteredLocalDeviceId(null);
    }
  }

  function openDeviceContextMenu(clientX, clientY, dev) {
    hideDeviceContextMenu();
    const id = dev.id || dev.deviceId;
    const disabled = !!dev.disabled;
    const online = dev.online !== false;
    const agentOn = !!dev.agentConnected;

    const menu = document.createElement('div');
    menu.className = 'remote-device-context-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
      '<button type="button" class="remote-device-context-item" data-act="rename" role="menuitem">Rename…</button>' +
      '<button type="button" class="remote-device-context-item" data-act="baseurl" role="menuitem">Set base URL…</button>' +
      (disabled
        ? '<button type="button" class="remote-device-context-item" data-act="enable" role="menuitem">Enable</button>'
        : '<button type="button" class="remote-device-context-item" data-act="disable" role="menuitem">Disable</button>') +
      '<button type="button" class="remote-device-context-item" data-act="status" role="menuitem">Connection status…</button>' +
      '<button type="button" class="remote-device-context-item" data-act="info" role="menuitem">Device info…</button>' +
      '<button type="button" class="remote-device-context-item" data-act="copy-id" role="menuitem">Copy device ID</button>' +
      '<button type="button" class="remote-device-context-item remote-device-context-danger" data-act="remove" role="menuitem">Remove device…</button>';

    document.body.appendChild(menu);
    deviceContextMenuEl = menu;

    menu.style.position = 'fixed';
    menu.style.left = '0';
    menu.style.top = '0';
    menu.style.zIndex = '10060';
    menu.style.visibility = 'hidden';
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = Math.min(clientX, window.innerWidth - mw - 8);
    let top = Math.min(clientY, window.innerHeight - mh - 8);
    left = Math.max(8, left);
    top = Math.max(8, top);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.visibility = '';

    function closeAll() {
      hideDeviceContextMenu();
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onEsc, true);
    }

    function onDocClick(ev) {
      if (menu.contains(ev.target)) return;
      closeAll();
    }

    function onEsc(ev) {
      if (ev.key === 'Escape') closeAll();
    }

    setTimeout(function () {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onEsc, true);
    }, 0);

    menu.querySelectorAll('[data-act]').forEach(function (item) {
      item.addEventListener('click', async function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const act = item.getAttribute('data-act');
        closeAll();
        try {
          if (act === 'rename') {
            const cur = dev.name || dev.label || String(id);
            const next = await window.PreviewUtils.customPrompt('Device name', cur);
            if (next == null || !String(next).trim()) return;
            await auth.updateDevice(id, { name: String(next).trim() });
            await refreshDevices();
            await renderDropdown();
            return;
          }
          if (act === 'baseurl') {
            const cur = dev.baseUrl || '';
            const next = await window.PreviewUtils.customPrompt(
              'Base URL (as seen from the proxy)',
              cur
            );
            if (next == null || !String(next).trim()) return;
            await auth.updateDevice(id, { baseUrl: String(next).trim() });
            await refreshDevices();
            await renderDropdown();
            return;
          }
          if (act === 'disable') {
            await auth.updateDevice(id, { disabled: true });
            await refreshDevices();
            await renderDropdown();
            return;
          }
          if (act === 'enable') {
            await auth.updateDevice(id, { disabled: false });
            await refreshDevices();
            await renderDropdown();
            return;
          }
          if (act === 'status') {
            const text = buildTerminalPanel('connection status', [
              ['device', String(dev.name || id)],
              ['app_version', dev.appVersion != null ? String(dev.appVersion) : '—'],
              ['online', online ? 'yes' : 'no'],
              ['disabled', disabled ? 'yes' : 'no'],
              ['agent_proxy', agentOn ? 'connected' : 'not connected'],
              ['last_seen', formatLastSeen(dev.lastSeen)],
              ['base_url', dev.baseUrl || '—']
            ]);
            if (window.PreviewUtils.customAlert) {
              await window.PreviewUtils.customAlert(text, TERMINAL_ALERT);
            }
            return;
          }
          if (act === 'info') {
            const text = buildTerminalPanel('device record', [
              ['name', dev.name || '—'],
              ['id', String(id)],
              ['app_version', dev.appVersion != null ? String(dev.appVersion) : '—'],
              ['device_key', maskKey(dev.deviceKey)],
              ['base_url', dev.baseUrl || '—'],
              ['last_seen', formatLastSeen(dev.lastSeen)],
              ['online', online ? 'yes' : 'no'],
              ['disabled', disabled ? 'yes' : 'no'],
              ['agent', agentOn ? 'connected' : 'not connected']
            ]);
            if (window.PreviewUtils.customAlert) {
              await window.PreviewUtils.customAlert(text, TERMINAL_ALERT);
            }
            return;
          }
          if (act === 'copy-id') {
            const t = String(id);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(t);
            } else {
              const ta = document.createElement('textarea');
              ta.value = t;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            }
            return;
          }
          if (act === 'remove') {
            const ok = await window.PreviewUtils.customConfirm(
              'Remove this device from your account? You can register it again later.',
              false
            );
            if (!ok) return;
            await auth.deleteDevice(id);
            syncSessionAfterDeviceRemoved(id);
            await refreshDevices();
            await renderDropdown();
          }
        } catch (err) {
          if (window.PreviewUtils.customAlert) {
            const msg = (err && err.message) || String(err);
            await window.PreviewUtils.customAlert(
              buildTerminalPanel('error', [['message', msg]]),
              TERMINAL_ALERT
            );
          }
        }
      });
    });
  }

  function ensureDropdown() {
    if (dropdownEl) return dropdownEl;
    const btn = document.getElementById('remoteExplorerBtn');
    if (!btn) return null;
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'remote-explorer-dropdown';
    dropdownEl.id = 'remoteExplorerDropdown';
    dropdownEl.setAttribute('hidden', '');
    document.body.appendChild(dropdownEl);
    document.addEventListener('click', function (e) {
      if (!dropdownEl.contains(e.target) && e.target !== btn) {
        hideDeviceContextMenu();
        hideDropdown();
      }
    });
    dropdownEl.addEventListener('contextmenu', function (e) {
      const row = e.target && e.target.closest ? e.target.closest('.remote-dd-device-row') : null;
      if (!row || !dropdownEl.contains(row)) return;
      e.preventDefault();
      e.stopPropagation();
      const rid = row.getAttribute('data-id');
      const dev = devicesCache.find(function (d) {
        return String(d.id || d.deviceId) === String(rid);
      });
      if (!dev) return;
      openDeviceContextMenu(e.clientX, e.clientY, dev);
    });
    dropdownEl.addEventListener('click', function (e) {
      const dots = e.target && e.target.closest ? e.target.closest('.remote-dd-device-dots') : null;
      if (!dots || !dropdownEl.contains(dots)) return;
      e.preventDefault();
      e.stopPropagation();
      const rid = dots.getAttribute('data-id');
      const dev = devicesCache.find(function (d) {
        return String(d.id || d.deviceId) === String(rid);
      });
      if (!dev) return;
      const r = dots.getBoundingClientRect();
      openDeviceContextMenu(r.left, r.bottom + 2, dev);
    });
    return dropdownEl;
  }

  function positionDropdown() {
    const btn = document.getElementById('remoteExplorerBtn');
    if (!btn || !dropdownEl) return;
    const r = btn.getBoundingClientRect();
    dropdownEl.style.position = 'fixed';
    dropdownEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 260)) + 'px';
    dropdownEl.style.top = (r.bottom + 4) + 'px';
    dropdownEl.style.zIndex = '10050';
  }

  function hideDropdown() {
    hideDeviceContextMenu();
    if (dropdownEl) dropdownEl.setAttribute('hidden', '');
  }

  function deviceIsThisPc(d) {
    const reg = sess.getRegisteredLocalDeviceId();
    if (reg && String(d.id) === String(reg)) return true;
    const dk = sess.deviceKey();
    if (d.deviceKey && d.deviceKey === dk) return true;
    return false;
  }

  async function refreshDevices() {
    if (!sess.getToken()) {
      devicesCache = [];
      return;
    }
    try {
      devicesCache = await auth.fetchDevices();
    } catch (e) {
      devicesCache = [];
    }
  }

  async function renderDropdown() {
    const d = ensureDropdown();
    if (!d) return;
    const loggedIn = !!sess.getToken();
    let proxyDebug = false;
    let serverDebug = false;
    let agentStatus = null;
    let localVersion = '';
    let proxyStale = false;
    try {
      const modeFetch = fetch('/__api__/mode', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
      const localBuildFetch =
        auth.fetchLocalBuildInfo && typeof auth.fetchLocalBuildInfo === 'function'
          ? auth.fetchLocalBuildInfo().catch(function () { return {}; })
          : Promise.resolve({});
      const devicesFetch = loggedIn
        ? auth.fetchDevices().catch(function () { return []; })
        : Promise.resolve([]);
      const agentFetch =
        loggedIn && auth.fetchLocalAgentStatus
          ? auth.fetchLocalAgentStatus().catch(function () { return null; })
          : Promise.resolve(null);
      const [proxySt, modeRes, devicesList, agentFromParallel, localBi] = await Promise.all([
        auth.fetchProxyRemoteStatus(),
        modeFetch,
        devicesFetch,
        agentFetch,
        localBuildFetch
      ]);
      devicesCache = Array.isArray(devicesList) ? devicesList : [];
      proxyDebug = !!(proxySt && proxySt.proxyDebug);
      serverDebug = !!modeRes.debug;
      agentStatus = agentFromParallel;
      localVersion =
        normVersion(localBi && localBi.version) ||
        normVersion(modeRes.version);
      proxyStale = versionsDiffer(localVersion, proxySt && proxySt.version);
    } catch (e) {
      devicesCache = [];
      proxyDebug = false;
      serverDebug = false;
      agentStatus = null;
    }
    const registered = !!sess.getRegisteredLocalDeviceId() ||
      (devicesCache && devicesCache.some(deviceIsThisPc));
    let html = '';
    html += '<div class="remote-dd-title">Remote Explorer</div>';
    if (proxyDebug || serverDebug) {
      html += '<div class="remote-dd-debug-warn" role="alert">';
      if (proxyDebug) {
        html += '<div class="remote-dd-debug-line">Proxy is in debug mode.</div>';
      }
      if (serverDebug) {
        html += '<div class="remote-dd-debug-line">Astro Code backend is in debug mode.</div>';
      }
      html += '<div class="remote-dd-debug-sub">Verbose logs may be exposed. Do not use for production secrets.</div>';
      html += '</div>';
    }
    if (proxyStale) {
      html += '<div class="remote-dd-version-warn" role="status">';
      html +=
        '<div class="remote-dd-version-line"><strong>Proxy vs this app:</strong> different package version. ' +
        'Deploy the same app version on the proxy and all devices, or expect odd remote bugs.</div>';
      html += '</div>';
    }
    html += '<button type="button" class="remote-dd-item" data-action="local">Use Local</button>';
    html += '<span class="remote-dd-desc">Files and tools on this machine</span>';
    const localLine = formatBuildLine({ version: localVersion });
    if (localLine) {
      html +=
        '<div class="remote-dd-desc remote-dd-version-mono" title="package.json version on this Astro Code backend">' +
        'This app: v' +
        escapeHtml(localLine) +
        '</div>';
    }
    if (loggedIn) {
      html += '<div class="remote-dd-section">This PC → proxy tunnel</div>';
      if (agentStatus && agentStatus.connected) {
        html += '<div class="remote-dd-desc">Outbound agent: <strong>connected</strong> (' +
          escapeHtml(agentStatus.proxyHost || 'proxy') + ')</div>';
      } else if (agentStatus && agentStatus.connecting) {
        html += '<div class="remote-dd-desc">Outbound agent: connecting…</div>';
      } else if (agentStatus && agentStatus.configured) {
        const err = (agentStatus.lastError || agentStatus.lastCloseReason || '').trim();
        html += '<div class="remote-dd-desc remote-dd-debug-warn" role="status">Outbound agent: <strong>not connected</strong>' +
          (err ? ' — ' + escapeHtml(err) : '. Open the terminal where Astro Code runs for details.') + '</div>';
      } else if (agentStatus === null) {
        html += '<div class="remote-dd-desc">Outbound agent: status unavailable (restart the Astro Code backend).</div>';
      } else {
        html += '<div class="remote-dd-desc">Outbound agent: waiting — ensure proxy URLs are set in PreviewRemoteConfig and sign in again.</div>';
      }
      if (!registered) {
        html += '<button type="button" class="remote-dd-item" data-action="register-pc">Register This PC</button>';
        html += '<span class="remote-dd-desc">Allow access via your account</span>';
      }
      html += '<div class="remote-dd-section">Your devices</div>';
      if (devicesCache.length === 0) {
        html += '<div class="remote-dd-empty">No devices yet</div>';
      } else {
        devicesCache.forEach(function (dev) {
          const id = dev.id || dev.deviceId;
          const name = dev.name || dev.label || id;
          const isSelf = deviceIsThisPc(dev);
          let label = isSelf ? name + ' (this PC)' : name;
          if (dev.disabled) {
            label += ' — disabled';
          } else if (dev.online === false) {
            label += ' — offline';
          }
          const devV = normVersion(dev.appVersion);
          const deviceStale =
            !!devV && !!localVersion && versionsDiffer(localVersion, devV);
          if (deviceStale) {
            label += ' — old build';
          }
          let mainClass = 'remote-dd-item remote-dd-device remote-dd-device-main';
          if (dev.disabled) mainClass += ' remote-dd-device-disabled';
          else if (dev.online === false) mainClass += ' remote-dd-device-offline';
          const idEsc = String(id).replace(/"/g, '&quot;');
          const rowClass =
            'remote-dd-device-row' + (deviceStale ? ' remote-dd-device-stale' : '');
          html +=
            '<div class="' +
            rowClass +
            '" data-id="' +
            idEsc +
            '" role="group" title="Hover for ⋯ menu · right-click for device actions">' +
            '<button type="button" class="' +
            mainClass +
            '" data-action="remote" data-id="' +
            idEsc +
            '" title="Open this device">' +
            escapeHtml(label) +
            '</button>' +
            '<button type="button" class="remote-dd-device-dots" data-id="' +
            idEsc +
            '" aria-label="Device menu" title="Device actions — rename, remove, connection status…">⋯</button>' +
            '</div>';
        });
      }
      html += '<button type="button" class="remote-dd-item remote-dd-logout" data-action="logout">Sign out</button>';
    }
    d.innerHTML = html;
    d.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', onDropdownAction);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function onDropdownAction(e) {
    const action = e.currentTarget.getAttribute('data-action');
    const id = e.currentTarget.getAttribute('data-id');
    hideDropdown();
    if (action === 'local') {
      sess.setMode('local');
      sess.setTargetDeviceId(null);
      window.location.reload();
      return;
    }
    if (action === 'logout') {
      auth.logout();
      window.location.reload();
      return;
    }
    if (action === 'register-pc') {
      await openRegisterPcFlow();
      return;
    }
    if (action === 'remote' && id) {
      const dev = devicesCache.find(function (d) {
        return String(d.id || d.deviceId) === String(id);
      });
      if (dev && dev.disabled) {
        if (window.PreviewUtils.customAlert) {
          window.PreviewUtils.customAlert(
            'This device is disabled. Right-click it and choose Enable, or use the context menu.'
          );
        }
        return;
      }
      sess.setMode('remote');
      sess.setTargetDeviceId(id);
      const nm = dev ? dev.name || dev.label || id : id;
      if (sess.setTargetDeviceLabel) sess.setTargetDeviceLabel(nm);
      window.location.reload();
    }
  }

  async function openRegisterPcFlow() {
    const ok = await window.PreviewUtils.customConfirm(
      'Registering links this PC to your account so you can open its files from other machines. Continue?',
      false
    );
    if (!ok) return;
    const name = await window.PreviewUtils.customPrompt('Name for this PC', '');
    if (!name || !String(name).trim()) return;
    try {
      const dev = await auth.registerDevice(String(name).trim());
      const picked = dev && dev.baseUrl ? String(dev.baseUrl) : '';
      if (picked && window.PreviewUtils.customAlert) {
        await window.PreviewUtils.customAlert(
          'This PC is registered. The proxy will reach it at:\n' +
            picked +
            '\n\nAfter you connect (outbound /agent WebSocket), the proxy updates that URL from your real client IP and listen port when it can reach your HTTP server. Edit base URL in the device list to pin a value and stop auto-updates.'
        );
      }
      await refreshDevices();
    } catch (e) {
      if (window.PreviewUtils.customAlert) {
        await window.PreviewUtils.customAlert(e.message || 'Registration failed');
      }
    }
  }

  function attachPreviewFrame(iframe) {
    if (!iframe || iframe.__remoteSrcPatched) return;
    iframe.__remoteSrcPatched = true;
    const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (!desc || !desc.set || !desc.get) return;
    Object.defineProperty(iframe, 'src', {
      configurable: true,
      enumerable: true,
      get: function () {
        return desc.get.call(this);
      },
      set: function (v) {
        const next = transport.rewriteIframeSrc(v);
        desc.set.call(this, next);
      }
    });
  }

  function init() {
    if (
      window.PreviewRemoteHandoff &&
      typeof window.PreviewRemoteHandoff.applyFromHash === 'function'
    ) {
      window.PreviewRemoteHandoff.applyFromHash();
    }
    bindAuthModal();
    if (sess.getToken()) {
      auth.pushLocalAgentConfig();
    }
    const btn = document.getElementById('remoteExplorerBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!sess.getToken()) {
        await showAuthModal(false);
        return;
      }
      if (dropdownEl && !dropdownEl.hasAttribute('hidden')) {
        hideDropdown();
        return;
      }
      const d = ensureDropdown();
      if (!d) return;
      d.innerHTML =
        '<div class="remote-dd-title">Remote Explorer</div>' +
        '<div class="remote-dd-loading">Loading…</div>';
      positionDropdown();
      d.removeAttribute('hidden');
      await renderDropdown();
    });
  }

  return {
    init,
    attachPreviewFrame,
    refreshDevices,
    renderDropdown
  };
})();
