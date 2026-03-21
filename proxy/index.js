const http = require('http');
const express = require('express');
const cors = require('cors');
const auth = require('./lib/auth');
const store = require('./lib/store');
const tunnel = require('./lib/tunnel');

const PROXY_DEBUG =
  process.env.PROXY_DEBUG === '1' ||
  process.env.HTMLCLASS_PROXY_DEBUG === 'true';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

if (PROXY_DEBUG) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      process.stdout.write(
        `[proxy] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${Date.now() - start}ms\n`
      );
    });
    next();
  });
}

app.get('/api/remote/status', (req, res) => {
  res.json({
    ok: true,
    proxyDebug: PROXY_DEBUG
  });
});

function authMiddleware(req, res, next) {
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
  req.userId = payload.sub;
  next();
}

app.post('/api/auth/register', (req, res) => {
  const username = (req.body && req.body.username) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  if (store.findUserByName(username)) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  const user = {
    id: auth.newId(),
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: auth.hashPassword(password)
  };
  store.addUser(user);
  const token = auth.signToken({ sub: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = (req.body && req.body.username) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';
  const user = store.findUserByName(username);
  if (!user || !auth.verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = auth.signToken({ sub: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = store.findUserById(req.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: { id: user.id, username: user.username } });
});

app.get('/api/devices', authMiddleware, (req, res) => {
  const list = store.listDevicesForUser(req.userId).map((d) => ({
    id: d.id,
    name: d.name,
    deviceKey: d.deviceKey,
    baseUrl: d.baseUrl
  }));
  res.json({ devices: list });
});

app.post('/api/devices/register', authMiddleware, (req, res) => {
  const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
  const deviceKey = (req.body && req.body.deviceKey) ? String(req.body.deviceKey) : '';
  const baseUrlRaw = (req.body && req.body.baseUrl) ? String(req.body.baseUrl).trim() : '';
  if (!name || !deviceKey) {
    res.status(400).json({ error: 'name and deviceKey required' });
    return;
  }
  const baseUrl = tunnel.normalizeBaseUrl(baseUrlRaw || process.env.DEFAULT_DEVICE_BASE || 'http://127.0.0.1:3000');
  const existing = store.findDeviceByUserAndKey(req.userId, deviceKey);
  if (existing) {
    existing.name = name;
    existing.baseUrl = baseUrl;
    store.updateDevice(existing);
    res.json({ device: { id: existing.id, name: existing.name, deviceKey: existing.deviceKey, baseUrl: existing.baseUrl } });
    return;
  }
  const device = {
    id: auth.newId(),
    userId: req.userId,
    name,
    deviceKey,
    baseUrl
  };
  store.addDevice(device);
  res.json({ device: { id: device.id, name: device.name, deviceKey: device.deviceKey, baseUrl: device.baseUrl } });
});

const proxy = tunnel.createProxy();
proxy.on('error', (err, req, res) => {
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad gateway' }));
  }
});

tunnel.attachTunnelHttp(app, proxy);

const server = http.createServer(app);
tunnel.attachTunnelWs(server, proxy);

const PORT = Number(process.env.PORT) || 3030;
server.listen(PORT, () => {
  process.stdout.write(
    `HTMLCLASS proxy listening on http://0.0.0.0:${PORT}${PROXY_DEBUG ? ' (PROXY_DEBUG: verbose / status exposure)' : ''}\n`
  );
});
