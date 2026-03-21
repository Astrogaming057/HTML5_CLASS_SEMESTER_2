const httpProxy = require('http-proxy');
const store = require('./store');
const auth = require('./auth');

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

function createProxy() {
  return httpProxy.createProxyServer({
    changeOrigin: true,
    ws: true,
    xfwd: true
  });
}

function attachTunnelHttp(app, proxy) {
  app.use('/tunnel/:deviceId', (req, res) => {
    const token = auth.bearerFromAuthHeader(req.headers.authorization);
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
    const target = normalizeBaseUrl(device.baseUrl);
    if (!target) {
      res.status(502).json({ error: 'Device has no baseUrl' });
      return;
    }
    proxy.web(req, res, { target });
  });
}

function attachTunnelWs(server, proxy) {
  server.on('upgrade', (req, socket, head) => {
    const raw = req.url || '';
    if (raw.indexOf('/tunnel/') !== 0) return;

    let pathname = raw;
    let search = '';
    const q = raw.indexOf('?');
    if (q >= 0) {
      pathname = raw.slice(0, q);
      search = raw.slice(q);
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'tunnel') return;
    const deviceId = parts[1];

    const params = new URLSearchParams(search.replace(/^\?/, ''));
    let token = params.get('token');
    if (!token) {
      token = auth.bearerFromAuthHeader(req.headers.authorization);
    }
    if (!token) {
      socket.destroy();
      return;
    }
    const payload = auth.verifyToken(token);
    if (!payload || !payload.sub) {
      socket.destroy();
      return;
    }
    const device = verifyDeviceAccess(deviceId, payload.sub);
    if (!device) {
      socket.destroy();
      return;
    }
    const target = normalizeBaseUrl(device.baseUrl);
    if (!target) {
      socket.destroy();
      return;
    }

    req.url = '/';
    proxy.ws(req, socket, head, { target });
  });
}

module.exports = {
  normalizeBaseUrl,
  attachTunnelHttp,
  attachTunnelWs,
  createProxy
};
