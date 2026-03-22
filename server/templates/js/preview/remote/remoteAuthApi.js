window.PreviewRemoteAuthApi = (function () {
  const cfg = window.PreviewRemoteConfig;
  const sess = window.PreviewRemoteSession;

  /** Default timeout for proxy HTTP (browser can hang ~30s when host is down). */
  const DEFAULT_PROXY_FETCH_MS = 8000;

  /**
   * fetch() with AbortController timeout so Remote Explorer stays responsive when proxy is offline.
   * @param {number} [timeoutMs] - default DEFAULT_PROXY_FETCH_MS
   */
  function fetchWithTimeout(url, options, timeoutMs) {
    const ms =
      timeoutMs !== undefined && timeoutMs !== null ? Number(timeoutMs) : DEFAULT_PROXY_FETCH_MS;
    const controller = new AbortController();
    const id = setTimeout(function () {
      controller.abort();
    }, Math.max(1000, ms));
    const next = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, next).finally(function () {
      clearTimeout(id);
    });
  }

  function proxyUrl(path) {
    const base = (cfg.PROXY_BASE || '').replace(/\/$/, '');
    const p = path.startsWith('/') ? path : '/' + path;
    return base + p;
  }

  function authHeaders() {
    const t = sess.getToken();
    const h = { 'Content-Type': 'application/json' };
    if (t) {
      h.Authorization = 'Bearer ' + t;
    }
    return h;
  }

  async function parseJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return { _raw: text };
    }
  }

  /** Tell the local HTMLCLASS server to connect outbound to the proxy (reverse tunnel + presence). */
  async function pushLocalAgentConfig() {
    const t = sess.getToken();
    if (!t) return;
    const base = (cfg.PROXY_BASE || '').trim();
    if (!base) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Remote] Set PreviewRemoteConfig.PROXY_BASE to your proxy URL (e.g. http://127.0.0.1:3030) so the server can connect.'
        );
      }
      return;
    }
    try {
      const res = await fetch('/__api__/remote/agent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyUrl: base,
          token: t,
          deviceKey: sess.deviceKey()
        })
      });
      const data = await parseJson(res);
      if (!res.ok) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Remote] agent-config failed', res.status, data.error || data);
        }
        return;
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Remote] agent-config request failed', e.message || e);
      }
    }
  }

  async function fetchLocalAgentStatus() {
    try {
      const res = await fetch('/__api__/remote/agent-status', { cache: 'no-cache' });
      const data = await parseJson(res);
      if (!res.ok || !data.agent) return null;
      return data.agent;
    } catch (e) {
      return null;
    }
  }

  async function login(username, password) {
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.login), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }
    const token = data.token || data.accessToken || data.access_token;
    const user = data.user || { username: data.username || username };
    if (!token) {
      throw new Error('No token in response');
    }
    sess.setSession(token, user);
    await pushLocalAgentConfig();
    return { token, user };
  }

  async function register(username, password) {
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.register), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Registration failed');
    }
    const token = data.token || data.accessToken || data.access_token;
    const user = data.user || { username: data.username || username };
    if (!token) {
      throw new Error('No token in response');
    }
    sess.setSession(token, user);
    await pushLocalAgentConfig();
    return { token, user };
  }

  async function fetchDevices() {
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.devices), {
      method: 'GET',
      headers: authHeaders()
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to list devices');
    }
    const list = data.devices || data.items || data;
    return Array.isArray(list) ? list : [];
  }

  async function registerDevice(name, baseUrlOverride) {
    let base =
      typeof baseUrlOverride === 'string' && baseUrlOverride.trim()
        ? baseUrlOverride.trim()
        : '';
    if (!base && typeof window !== 'undefined' && window.location) {
      base = window.location.origin;
    }
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.registerDevice), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: name,
        deviceKey: sess.deviceKey(),
        baseUrl: base
      })
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Device registration failed');
    }
    const dev = data.device || data;
    const id = dev.id || dev.deviceId;
    if (id) {
      sess.setRegisteredLocalDeviceId(String(id));
    }
    await pushLocalAgentConfig();
    return dev;
  }

  async function fetchMe() {
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.me), {
      method: 'GET',
      headers: authHeaders()
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Session invalid');
    }
    return data.user || data;
  }

  function logout() {
    sess.clearSession();
    sess.setMode('local');
    sess.setTargetDeviceId(null);
  }

  async function sendHeartbeat() {
    const t = sess.getToken();
    if (!t) return;
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.heartbeat), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ deviceKey: sess.deviceKey() })
    });
    if (!res.ok) {
      if (res.status === 404) return;
      const data = await parseJson(res);
      throw new Error(data.message || data.error || 'Heartbeat failed');
    }
  }

  async function fetchProxyRemoteStatus() {
    try {
      const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.remoteStatus), {
        method: 'GET',
        cache: 'no-cache'
      });
      if (!res.ok) {
        return { proxyDebug: false };
      }
      const data = await parseJson(res);
      return { proxyDebug: !!data.proxyDebug };
    } catch (e) {
      return { proxyDebug: false };
    }
  }

  function deviceUrl(id) {
    return proxyUrl('/api/devices/' + encodeURIComponent(String(id)));
  }

  async function updateDevice(id, patch) {
    const res = await fetchWithTimeout(deviceUrl(id), {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch || {})
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to update device');
    }
    return data.device || data;
  }

  async function deleteDevice(id) {
    const res = await fetchWithTimeout(deviceUrl(id), {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to remove device');
    }
    return data;
  }

  return {
    login,
    register,
    fetchDevices,
    registerDevice,
    fetchMe,
    logout,
    proxyUrl,
    fetchProxyRemoteStatus,
    sendHeartbeat,
    pushLocalAgentConfig,
    fetchLocalAgentStatus,
    fetchWithTimeout,
    updateDevice,
    deleteDevice
  };
})();
