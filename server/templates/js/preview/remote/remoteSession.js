window.PreviewRemoteSession = (function () {
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
    if (mode === 'remote') {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_MODE, 'remote');
    } else {
      localStorage.setItem(window.PreviewRemoteConfig.STORAGE_MODE, 'local');
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
