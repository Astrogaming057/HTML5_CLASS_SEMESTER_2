window.PreviewRemoteAuthApi = (function () {
  const cfg = window.PreviewRemoteConfig;
  const sess = window.PreviewRemoteSession;

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

  async function login(username, password) {
    const res = await fetch(proxyUrl(cfg.PATHS.login), {
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
    return { token, user };
  }

  async function register(username, password) {
    const res = await fetch(proxyUrl(cfg.PATHS.register), {
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
    return { token, user };
  }

  async function fetchDevices() {
    const res = await fetch(proxyUrl(cfg.PATHS.devices), {
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

  async function registerDevice(name) {
    const res = await fetch(proxyUrl(cfg.PATHS.registerDevice), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: name,
        deviceKey: sess.deviceKey(),
        baseUrl: typeof window !== 'undefined' && window.location ? window.location.origin : ''
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
    return dev;
  }

  async function fetchMe() {
    const res = await fetch(proxyUrl(cfg.PATHS.me), {
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

  return {
    login,
    register,
    fetchDevices,
    registerDevice,
    fetchMe,
    logout,
    proxyUrl
  };
})();
