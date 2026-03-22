const httpProxy = require('http-proxy');
const store = require('./store');
const auth = require('./auth');
const reverseTunnel = require('./reverseTunnel');

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'http://' + u;
  }
  return u.replace(/\/$/, '');
}

function verifyDeviceAccess(deviceId, userId) {
  const d = store.findDeviceById(deviceId);
  if (!d || d.userId !== userId) return null;
  return d;
}

/** Same as WS tunnel: Bearer header, or ?token= for img/iframe/script (no custom headers). */
function tunnelHttpToken(req) {
  let token = auth.bearerFromAuthHeader(req.headers.authorization);
  if (token) return token;
  try {
    const urlPath = req.url || '';
    const q = urlPath.indexOf('?');
    if (q === -1) return null;
    const params = new URLSearchParams(urlPath.slice(q + 1));
    return params.get('token');
  } catch (e) {
    return null;
  }
}

/** Remove token from query before forwarding to device (avoid leaking into logs/origin). */
function stripTunnelTokenFromReqUrl(urlPath) {
  if (!urlPath || urlPath.indexOf('token=') === -1) return urlPath;
  try {
    const u = new URL(urlPath, 'http://x');
    if (!u.searchParams.has('token')) return urlPath;
    u.searchParams.delete('token');
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return urlPath;
  }
}

function createProxy() {
  return httpProxy.createProxyServer({
    changeOrigin: true,
    ws: true,
    xfwd: true
  });
}

function attachTunnelHttp(app, proxy) {
  app.use('/tunnel/:deviceId', (req, res) => {
    const token = tunnelHttpToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const payload = auth.verifyToken(token);
    if (!payload || !payload.sub) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    const device = verifyDeviceAccess(req.params.deviceId, payload.sub);
    if (!device) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (req.url) {
      req.url = stripTunnelTokenFromReqUrl(req.url);
    }
    reverseTunnel.tryHttpForward(device.id, req, res).then((viaReverse) => {
      if (viaReverse) return;
      const target = normalizeBaseUrl(device.baseUrl);
      if (!target) {
        res.status(502).json({
          error: 'Bad gateway',
          detail:
            'No reverse agent connected and device has no reachable baseUrl. Open the preview on this PC and sign in to Remote Explorer so the server can connect to the proxy.'
        });
        return;
      }
      proxy.web(req, res, { target });
    });
  });
}

function handleTunnelUpgrade(req, socket, head, proxy) {
  const raw = req.url || '';
  if (raw.indexOf('/tunnel/') !== 0) {
    return false;
  }

  let pathname = raw;
  let search = '';
  const q = raw.indexOf('?');
  if (q >= 0) {
    pathname = raw.slice(0, q);
    search = raw.slice(q);
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== 'tunnel') {
    return false;
  }
  const deviceId = parts[1];

  const params = new URLSearchParams(search.replace(/^\?/, ''));
  let token = params.get('token');
  if (!token) {
    token = auth.bearerFromAuthHeader(req.headers.authorization);
  }
  if (!token) {
    socket.destroy();
    return true;
  }
  const payload = auth.verifyToken(token);
  if (!payload || !payload.sub) {
    socket.destroy();
    return true;
  }
  const device = verifyDeviceAccess(deviceId, payload.sub);
  if (!device) {
    socket.destroy();
    return true;
  }
  if (reverseTunnel.handleUpgradeReverse(device.id, req, socket, head)) {
    return true;
  }
  const target = normalizeBaseUrl(device.baseUrl);
  if (!target) {
    socket.destroy();
    return true;
  }

  req.url = '/';
  proxy.ws(req, socket, head, { target });
  return true;
}

module.exports = {
  normalizeBaseUrl,
  attachTunnelHttp,
  handleTunnelUpgrade,
  createProxy
};
