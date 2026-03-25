window.PreviewRemoteSession = (function () {
  function clearP2pHandoffMarker() {
    try {
      if (
        window.PreviewRemoteHandoff &&
        typeof window.PreviewRemoteHandoff.clearP2pTabMarker === 'function'
      ) {
        window.PreviewRemoteHandoff.clearP2pTabMarker();
      }
    } catch (_e) {
      /* ignore */
    }
    try {
      if (
        window.PreviewRemoteTunnelStatus &&
        typeof window.PreviewRemoteTunnelStatus.refresh === 'function'
      ) {
        window.PreviewRemoteTunnelStatus.refresh();
      }
    } catch (_e2) {
      /* ignore */
    }
  }

  function deviceKey() {
    let k = localStorage.getItem(window.PreviewRemoteConfig.STORAGE_DEVICE_KEY);
    if (!k) {
      k = 'dk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_DEVICE_KEY, k);
    }
    return k;
  }

  function getToken() {
    return localStorage.getItem(window.PreviewRemoteConfig.STORAGE_TOKEN);
  }

  function setSession(token, userObj) {
    if (token) {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_TOKEN, token);
    } else {
      localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_TOKEN);
    }
    if (userObj) {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_USER, JSON.stringify(userObj));
    } else {
      localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_USER);
    }
  }

  function getUser() {
    const raw = localStorage.getItem(window.PreviewRemoteConfig.STORAGE_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_TOKEN);
    localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_USER);
    clearP2pHandoffMarker();
  }

  function getRegisteredLocalDeviceId() {
    return localStorage.getItem(window.PreviewRemoteConfig.STORAGE_REGISTERED_DEVICE_ID);
  }

  function setRegisteredLocalDeviceId(id) {
    if (id) {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_REGISTERED_DEVICE_ID, id);
    } else {
      localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_REGISTERED_DEVICE_ID);
    }
  }

  function getMode() {
    return localStorage.getItem(window.PreviewRemoteConfig.STORAGE_MODE) === 'remote'
      ? 'remote'
      : 'local';
  }

  function setMode(mode) {
    const prev = getMode();
    const next = mode === 'remote' ? 'remote' : 'local';
    if (mode === 'remote') {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_MODE, 'remote');
    } else {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_MODE, 'local');
    }
    /* Any switch away from remote clears; “Use Local” on an already-local P2P handoff tab must clear too. */
    if (prev !== next || next === 'local') {
      clearP2pHandoffMarker();
    }
  }

  function getTargetDeviceId() {
    return localStorage.getItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_ID);
  }

  function getTargetDeviceLabel() {
    return localStorage.getItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_LABEL);
  }

  function setTargetDeviceLabel(label) {
    if (label) {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_LABEL, String(label));
    } else {
      localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_LABEL);
    }
  }

  function setTargetDeviceId(id) {
    const prevRaw = localStorage.getItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_ID);
    const prev = prevRaw ? String(prevRaw) : null;
    const next = id ? String(id) : null;
    if (prev !== next) {
      clearP2pHandoffMarker();
    }
    if (id) {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_ID, id);
    } else {
      localStorage.removeItem(window.PreviewRemoteConfig.STORAGE_TARGET_DEVICE_ID);
      setTargetDeviceLabel(null);
    }
  }

  function isRemoteActive() {
    return getMode() === 'remote' && !!getTargetDeviceId() && !!getToken();
  }

  return {
    deviceKey,
    getToken,
    setSession,
    getUser,
    clearSession,
    getRegisteredLocalDeviceId,
    setRegisteredLocalDeviceId,
    getMode,
    setMode,
    getTargetDeviceId,
    setTargetDeviceId,
    getTargetDeviceLabel,
    setTargetDeviceLabel,
    isRemoteActive
  };
})();
