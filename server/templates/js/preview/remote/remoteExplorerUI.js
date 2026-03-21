window.PreviewRemoteExplorer = (function () {
  const auth = window.PreviewRemoteAuthApi;
  const sess = window.PreviewRemoteSession;
  const transport = window.PreviewRemoteTransport;
  let dropdownEl = null;
  let devicesCache = [];

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

  function showAuthModal(asRegister) {
    authModeLogin = !asRegister;
    const wrap = ensureAuthModal();
    const title = document.getElementById('remoteAuthTitle');
    const hint = document.getElementById('remoteAuthHint');
    const err = document.getElementById('remoteAuthError');
    const sw = document.getElementById('remoteAuthSwitch');
    const sub = document.getElementById('remoteAuthSubmit');
    if (title) title.textContent = authModeLogin ? 'Sign in' : 'Create account';
    if (hint) {
      hint.textContent = 'Connect to ' + (window.PreviewRemoteConfig.PROXY_BASE || 'proxy');
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
        showAuthModal(authModeLogin);
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
          renderDropdown();
        } catch (e) {
          setAuthError(e.message || 'Request failed');
        }
      });
    }
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
        hideDropdown();
      }
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
    if (dropdownEl) dropdownEl.setAttribute('hidden', '');
  }

  function showDropdown() {
    const d = ensureDropdown();
    if (!d) return;
    renderDropdown();
    positionDropdown();
    d.removeAttribute('hidden');
  }

  function toggleDropdown() {
    if (dropdownEl && !dropdownEl.hasAttribute('hidden')) {
      hideDropdown();
    } else {
      showDropdown();
    }
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

  function renderDropdown() {
    const d = ensureDropdown();
    if (!d) return;
    const loggedIn = !!sess.getToken();
    const registered = !!sess.getRegisteredLocalDeviceId() ||
      (devicesCache && devicesCache.some(deviceIsThisPc));
    let html = '';
    html += '<div class="remote-dd-title">Remote Explorer</div>';
    html += '<button type="button" class="remote-dd-item" data-action="local">Use Local</button>';
    html += '<span class="remote-dd-desc">Files and tools on this machine</span>';
    if (loggedIn) {
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
          const label = isSelf ? name + ' (this PC)' : name;
          html += '<button type="button" class="remote-dd-item remote-dd-device" data-action="remote" data-id="' +
            String(id).replace(/"/g, '&quot;') + '">' + escapeHtml(label) + '</button>';
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
      sess.setMode('remote');
      sess.setTargetDeviceId(id);
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
      await auth.registerDevice(String(name).trim());
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
    bindAuthModal();
    const btn = document.getElementById('remoteExplorerBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!sess.getToken()) {
        showAuthModal(false);
        return;
      }
      await refreshDevices();
      toggleDropdown();
    });
  }

  return {
    init,
    attachPreviewFrame,
    refreshDevices,
    renderDropdown
  };
})();
