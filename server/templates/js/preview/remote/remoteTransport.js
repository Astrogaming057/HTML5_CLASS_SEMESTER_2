window.PreviewRemoteTransport = (function () {
  const sess = window.PreviewRemoteSession;
  const cfg = window.PreviewRemoteConfig;
  let fetchPatched = false;

  function tunnelBase() {
    const base = (cfg.PROXY_BASE || '').replace(/\/$/, '');
    const id = sess.getTargetDeviceId();
    if (!id) return null;
    return base + '/tunnel/' + encodeURIComponent(id);
  }

  function isRemote() {
    return sess.isRemoteActive();
  }

  function pathFromAnyUrl(urlStr) {
    try {
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const u = new URL(urlStr);
        return u.pathname + u.search + u.hash;
      }
      if (urlStr.startsWith('/')) {
        return urlStr;
      }
      const u = new URL(urlStr, window.location.origin);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return urlStr;
    }
  }

  /**
   * Paths under /__api__/remote/* must stay on the preview origin (this machine's
   * HTMLCLASS server). They must NOT go through the tunnel — e.g. agent-config
   * starts the outbound reverse agent; tunneling it would deadlock (502).
   */
  function isLocalRemoteControlPath(path) {
    return path.indexOf('/__api__/remote/') === 0;
  }

  function shouldRewriteUrl(urlStr) {
    if (!isRemote() || typeof urlStr !== 'string') return false;
    const path = pathFromAnyUrl(urlStr);
    if (path.indexOf('/__') !== 0) return false;
    if (isLocalRemoteControlPath(path)) return false;
    return true;
  }

  function rewriteUrl(urlStr) {
    const tb = tunnelBase();
    if (!tb) return urlStr;
    const path = pathFromAnyUrl(urlStr);
    if (path.indexOf('/__') !== 0) return urlStr;
    return tb + path;
  }

  function mergeAuth(init) {
    const next = init ? Object.assign({}, init) : {};
    const headers = new Headers(next.headers || undefined);
    const t = sess.getToken();
    if (t && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + t);
    }
    next.headers = headers;
    return next;
  }

  function installFetchPatch() {
    if (fetchPatched) return;
    fetchPatched = true;
    const orig = window.fetch.bind(window);
    window.fetch = function (input, init) {
      if (!isRemote()) {
        return orig(input, init);
      }
      let urlStr = null;
      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof Request) {
        urlStr = input.url;
      }
      if (urlStr && shouldRewriteUrl(urlStr)) {
        const newUrl = rewriteUrl(urlStr);
        const merged = mergeAuth(init);
        if (input instanceof Request) {
          return orig(new Request(newUrl, input), merged);
        }
        return orig(newUrl, merged);
      }
      return orig(input, init);
    };
  }

  function getWebSocketUrl() {
    if (!isRemote()) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return protocol + '//' + window.location.host;
    }
    const tb = tunnelBase();
    if (!tb) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return protocol + '//' + window.location.host;
    }
    const u = new URL(tb);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws = wsProto + '//' + u.host + u.pathname;
    const t = sess.getToken();
    if (t) {
      const join = ws.indexOf('?') === -1 ? '?' : '&';
      ws += join + 'token=' + encodeURIComponent(t);
    }
    return ws;
  }

  function rewriteIframeSrc(src) {
    if (!isRemote() || typeof src !== 'string') return src;
    try {
      const u = src.startsWith('http://') || src.startsWith('https://')
        ? new URL(src)
        : new URL(src, window.location.origin);
      if (u.pathname.indexOf('/__') !== 0) return src;
      if (isLocalRemoteControlPath(u.pathname + u.search)) return src;
      return rewriteUrl(u.pathname + u.search + u.hash);
    } catch (e) {
      return src;
    }
  }

  installFetchPatch();

  return {
    installFetchPatch,
    isRemote,
    tunnelBase,
    rewriteUrl,
    getWebSocketUrl,
    rewriteIframeSrc,
    shouldRewriteUrl
  };
})();
