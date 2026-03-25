/**
 * P2P handoff: after navigating to the remote PC's origin, localStorage is empty or has a random
 * deviceKey. The proxy expects this machine's registered deviceKey + user JWT for /agent.
 * We pass credentials in the URL hash (not sent to server), apply before remoteSession runs, then strip.
 */
window.PreviewRemoteHandoff = (function () {
  function encodePayload(obj) {
    const s = JSON.stringify(obj);
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(bin);
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    const b64 = btoa(unescape(encodeURIComponent(s)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodePayload(encoded) {
    let b64 = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i) & 0xff;
      }
      const s = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return JSON.parse(s);
    }
    return JSON.parse(decodeURIComponent(escape(bin)));
  }

  function applyFromHash() {
    const cfg = window.PreviewRemoteConfig;
    if (!cfg || !location.hash) return false;
    const needle = 'remoteHandoff=';
    const h = location.hash.replace(/^#/, '');
    if (h.indexOf(needle) !== 0) return false;
    let raw = h.slice(needle.length).split('&')[0];
    if (!raw) return false;
    let data;
    try {
      data = decodePayload(decodeURIComponent(raw));
    } catch (e) {
      try {
        data = decodePayload(raw);
      } catch (e2) {
        return false;
      }
    }
    if (!data || typeof data.t !== 'string' || !data.t.trim()) return false;
    if (typeof data.dk !== 'string' || !data.dk.trim()) return false;

    localStorage.setItem(cfg.STORAGE_TOKEN, data.t.trim());
    localStorage.setItem(cfg.STORAGE_DEVICE_KEY, data.dk.trim());
    localStorage.setItem(cfg.STORAGE_MODE, 'local');
    localStorage.removeItem(cfg.STORAGE_TARGET_DEVICE_ID);
    localStorage.removeItem(cfg.STORAGE_TARGET_DEVICE_LABEL);
    if (data.u) {
      try {
        const rawUser =
          typeof data.u === 'string' ? data.u : JSON.stringify(data.u);
        localStorage.setItem(cfg.STORAGE_USER, rawUser);
      } catch (e) {
        /* ignore */
      }
    }
    if (data.rid != null && String(data.rid).trim()) {
      localStorage.setItem(cfg.STORAGE_REGISTERED_DEVICE_ID, String(data.rid).trim());
    }

    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      /* ignore */
    }
    try {
      sessionStorage.setItem('previewRemoteP2pHandoff', '1');
    } catch (e) {
      /* ignore */
    }
    return true;
  }

  applyFromHash();

  return {
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    applyFromHash: applyFromHash
  };
})();
