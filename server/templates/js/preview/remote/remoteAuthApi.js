window.PreviewRemoteAuthApi = (function () {
  const cfg = window.PreviewRemoteConfig;
  const sess = window.PreviewRemoteSession;

  /** Default timeout for proxy HTTP (browser can hang ~30s when host is down). */
  const DEFAULT_PROXY_FETCH_MS = 8000;
  /** Per-candidate probe budget when choosing the fastest proxy. */
  const PROXY_PICK_TIMEOUT_MS = 3500;

  let localBuildCache = null;
  let localBuildPromise = null;

  /**
   * GET /__api__/version — package semver for comparing devices and proxy.
   * @returns {Promise<{ name?: string, version?: string }>}
   */
  async function fetchLocalBuildInfo() {
    if (localBuildCache) {
      return localBuildCache;
    }
    if (localBuildPromise) {
      return localBuildPromise;
    }
    localBuildPromise = fetch('/__api__/version', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (data) {
        const out = {
          name: data.name,
          version: data.version
        };
        localBuildCache = out;
        return out;
      })
      .catch(function () {
        return {};
      })
      .finally(function () {
        localBuildPromise = null;
      });
    return localBuildPromise;
  }

  function getCachedLocalBuild() {
    return localBuildCache;
  }

  /** undefined = not picked yet; null = no URLs configured; string = chosen base */
  let resolvedProxyBase = undefined;
  let proxyBasePickPromise = null;

  function normalizeProxyBaseUrl(s) {
    return String(s || '')
      .trim()
      .replace(/\/+$/, '');
  }

  function getProxyCandidates() {
    const arr = cfg.PROXY_CANDIDATES;
    if (Array.isArray(arr) && arr.length > 0) {
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const n = normalizeProxyBaseUrl(arr[i]);
        if (n) out.push(n);
      }
      if (out.length) return out;
    }
    const single = normalizeProxyBaseUrl(cfg.PROXY_BASE);
    return single ? [single] : [];
  }

  function proxyStatusProbeUrl(base) {
    const path = cfg.PATHS.remoteStatus.startsWith('/')
      ? cfg.PATHS.remoteStatus
      : '/' + cfg.PATHS.remoteStatus;
    return base + path;
  }

  async function probeProxyLatency(base) {
    const url = proxyStatusProbeUrl(base);
    const t0 =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    try {
      const res = await fetchWithTimeout(
        url,
        { method: 'GET', cache: 'no-cache' },
        PROXY_PICK_TIMEOUT_MS
      );
      if (!res.ok) return null;
      const t1 =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      return { base: base, ms: t1 - t0 };
    } catch (_e) {
      return null;
    }
  }

  /**
   * Resolves PreviewRemoteConfig.PROXY_BASE to the fastest responding candidate (or the sole URL).
   * Safe to call many times; completes one shared pick per page load.
   */
  async function ensureProxyBase() {
    if (resolvedProxyBase !== undefined) {
      cfg.PROXY_BASE = resolvedProxyBase || '';
      return;
    }
    if (!proxyBasePickPromise) {
      proxyBasePickPromise = (async function () {
        const candidates = getProxyCandidates();
        if (candidates.length === 0) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              '[Remote] No proxy URLs — set PreviewRemoteConfig.PROXY_CANDIDATES or PROXY_BASE.'
            );
          }
          resolvedProxyBase = null;
          cfg.PROXY_BASE = '';
          return;
        }
        if (candidates.length === 1) {
          resolvedProxyBase = candidates[0];
          cfg.PROXY_BASE = resolvedProxyBase;
          return;
        }
        const results = await Promise.all(candidates.map(probeProxyLatency));
        const ok = results.filter(Boolean);
        let chosen = candidates[0];
        if (ok.length > 0) {
          ok.sort(function (a, b) {
            return a.ms - b.ms;
          });
          chosen = ok[0].base;
        }
        resolvedProxyBase = chosen;
        cfg.PROXY_BASE = chosen;
      })();
    }
    try {
      await proxyBasePickPromise;
    } finally {
      proxyBasePickPromise = null;
    }
    if (resolvedProxyBase !== undefined) {
      cfg.PROXY_BASE = resolvedProxyBase || '';
    }
  }

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
    const base = normalizeProxyBaseUrl(cfg.PROXY_BASE);
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

  /** Tell the local Astro Code backend to connect outbound to the proxy (reverse tunnel + presence). */
  async function pushLocalAgentConfig() {
    if (
      window.PreviewRemoteHandoff &&
      typeof window.PreviewRemoteHandoff.applyFromHash === 'function'
    ) {
      window.PreviewRemoteHandoff.applyFromHash();
    }
    const t = sess.getToken();
    if (!t) return;
    await ensureProxyBase();
    const base = normalizeProxyBaseUrl(cfg.PROXY_BASE);
    if (!base) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Remote] Set PreviewRemoteConfig.PROXY_CANDIDATES or PROXY_BASE so the server can connect.'
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
    await ensureProxyBase();
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
    await ensureProxyBase();
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
    await ensureProxyBase();
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
    const manual =
      typeof baseUrlOverride === 'string' && baseUrlOverride.trim()
        ? baseUrlOverride.trim().replace(/\/+$/, '')
        : '';
    let lanUrls = [];
    try {
      const r = await fetch('/__api__/remote/lan-base-candidates', { cache: 'no-cache' });
      const j = await r.json();
      if (j && j.success && Array.isArray(j.urls)) {
        lanUrls = j.urls;
      }
    } catch (_e) {
      /* ignore */
    }
    const baseUrlCandidates = [];
    const seen = new Set();
    function addCandidate(u) {
      if (u == null || u === '') return;
      const t = String(u).trim().replace(/\/+$/, '');
      if (!t || seen.has(t)) return;
      seen.add(t);
      baseUrlCandidates.push(t);
    }
    if (manual) addCandidate(manual);
    for (let i = 0; i < lanUrls.length; i++) {
      addCandidate(lanUrls[i]);
    }
    if (typeof window !== 'undefined' && window.location) {
      addCandidate(window.location.origin);
    }
    let base = manual;
    if (!base && typeof window !== 'undefined' && window.location) {
      base = window.location.origin;
    }
    await ensureProxyBase();
    const bi = await fetchLocalBuildInfo();
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.registerDevice), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: name,
        deviceKey: sess.deviceKey(),
        baseUrl: base,
        baseUrlCandidates: baseUrlCandidates,
        appVersion: bi.version || ''
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
    await ensureProxyBase();
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
    await ensureProxyBase();
    const bi = await fetchLocalBuildInfo();
    const res = await fetchWithTimeout(proxyUrl(cfg.PATHS.heartbeat), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        deviceKey: sess.deviceKey(),
        appVersion: bi.version || ''
      })
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
        return { proxyDebug: false, version: null, name: null };
      }
      const data = await parseJson(res);
      return {
        proxyDebug: !!data.proxyDebug,
        version: data.version != null ? String(data.version) : null,
        name: data.name != null ? String(data.name) : null,
        component: data.component != null ? String(data.component) : null
      };
    } catch (e) {
      return { proxyDebug: false, version: null, name: null };
    }
  }

  function deviceUrl(id) {
    return proxyUrl('/api/devices/' + encodeURIComponent(String(id)));
  }

  async function fetchTransportHints(deviceId) {
    await ensureProxyBase();
    const res = await fetchWithTimeout(
      proxyUrl('/api/devices/' + encodeURIComponent(String(deviceId)) + '/transport-hints'),
      {
        method: 'GET',
        headers: authHeaders()
      }
    );
    const data = await parseJson(res);
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Transport hints failed');
    }
    return data;
  }

  async function updateDevice(id, patch) {
    await ensureProxyBase();
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
    await ensureProxyBase();
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
    ensureProxyBase,
    proxyUrl,
    fetchProxyRemoteStatus,
    sendHeartbeat,
    pushLocalAgentConfig,
    fetchLocalAgentStatus,
    fetchWithTimeout,
    updateDevice,
    deleteDevice,
    fetchLocalBuildInfo,
    getCachedLocalBuild,
    fetchTransportHints
  };
})();
