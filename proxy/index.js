const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const auth = require('./lib/auth');
const store = require('./lib/store');
const tunnel = require('./lib/tunnel');
const reverseTunnel = require('./lib/reverseTunnel');
const reachability = require('./lib/reachability');
const agentConnection = require('./lib/agentConnection');
const { pathnameOnly } = require('./lib/agentSocket');
const proxyDbg = require('./lib/debug');

let getBuildInfo;
try {
  getBuildInfo = require('../server/utils/buildInfo').getBuildInfo;
} catch (e) {
  getBuildInfo = function () {
    return { name: 'astro-proxy', version: '0.0.0' };
  };
}

const PROXY_DEBUG =
  process.env.PROXY_DEBUG === '1' ||
  process.env.ASTRO_CODE_PROXY_DEBUG === 'true' ||
  process.env.HTMLCLASS_PROXY_DEBUG === 'true';

const DEVICE_ONLINE_MS =
  Number(process.env.DEVICE_ONLINE_MS) > 0 ? Number(process.env.DEVICE_ONLINE_MS) : 90 * 1000;

const app = express();
app.use(cors({ origin: true, credentials: true }));

function pathNoQuery(u) {
  const s = u || '';
  const q = s.indexOf('?');
  return q === -1 ? s : s.slice(0, q);
}

app.use((req, res, next) => {
  const p = pathNoQuery(req.originalUrl || req.url || '');
  if (p.startsWith('/tunnel/')) {
    return next();
  }
  return express.json({ limit: '10mb' })(req, res, next);
});

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

function proxyBuildPayload() {
  const bi = getBuildInfo();
  return {
    ok: true,
    proxyDebug: PROXY_DEBUG,
    name: bi.name,
    version: bi.version,
    component: 'proxy'
  };
}

app.get('/api/remote/status', (req, res) => {
  res.json(proxyBuildPayload());
});

/** Public build identity (no auth) — clients compare with local Astro backend. */
app.get('/api/version', (req, res) => {
  res.json(proxyBuildPayload());
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

/** deviceId -> { t, ok } short cache for HTTP reachability from this proxy */
const transportProbeCache = new Map();
const TRANSPORT_PROBE_TTL_MS = 12000;

app.get('/api/devices/:id/transport-hints', authMiddleware, async (req, res) => {
  const id = req.params && req.params.id ? String(req.params.id) : '';
  const d = store.findDeviceById(id);
  if (!d || d.userId !== req.userId) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  const base = tunnel.normalizeBaseUrl(d.baseUrl);
  const loopback = base ? tunnel.isLoopbackBaseUrl(base) : true;
  let listenPort = null;
  if (base) {
    try {
      const u = new URL(base.startsWith('http') ? base : `http://${base}`);
      listenPort = u.port ? parseInt(u.port, 10) : u.protocol === 'https:' ? 443 : 80;
    } catch (e) {
      listenPort = null;
    }
  }
  const now = Date.now();
  let proxyCanReachDevice = false;
  if (base) {
    const hit = transportProbeCache.get(id);
    if (hit && now - hit.t < TRANSPORT_PROBE_TTL_MS) {
      proxyCanReachDevice = hit.ok;
    } else {
      try {
        proxyCanReachDevice = await reachability.probeDeviceHttpBase(base, 2000);
      } catch (e) {
        proxyCanReachDevice = false;
      }
      transportProbeCache.set(id, { t: now, ok: proxyCanReachDevice });
    }
  }
  res.json({
    deviceId: id,
    deviceKey: d.deviceKey,
    deviceBaseUrl: base,
    listenPort,
    proxyCanReachDevice,
    agentConnected: reverseTunnel.hasAgentForDevice(id),
    deviceBaseIsLoopback: loopback
  });
});

app.get('/api/devices', authMiddleware, (req, res) => {
  const now = Date.now();
  const list = store.listDevicesForUser(req.userId).map((d) => {
    const seen = typeof d.lastSeen === 'number' ? d.lastSeen : 0;
    const online = now - seen < DEVICE_ONLINE_MS;
    return {
      id: d.id,
      name: d.name,
      deviceKey: d.deviceKey,
      baseUrl: d.baseUrl,
      lastSeen: d.lastSeen,
      online,
      disabled: !!d.disabled,
      agentConnected: reverseTunnel.hasAgentForDevice(d.id),
      appVersion: d.appVersion != null ? d.appVersion : null,
      buildReportedAt: typeof d.buildReportedAt === 'number' ? d.buildReportedAt : null
    };
  });
  list.sort(function (a, b) {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  res.json({ devices: list });
});

app.patch('/api/devices/:id', authMiddleware, (req, res) => {
  const id = req.params && req.params.id ? String(req.params.id) : '';
  const d = store.findDeviceById(id);
  if (!d || d.userId !== req.userId) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  const body = req.body || {};
  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (n) d.name = n;
  }
  if (typeof body.disabled === 'boolean') {
    d.disabled = body.disabled;
  }
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
    d.baseUrl = tunnel.normalizeBaseUrl(body.baseUrl.trim());
    d.baseUrlAuto = false;
  }
  store.updateDevice(d);
  res.json({
    device: {
      id: d.id,
      name: d.name,
      deviceKey: d.deviceKey,
      baseUrl: d.baseUrl,
      lastSeen: d.lastSeen,
      disabled: !!d.disabled
    }
  });
});

app.delete('/api/devices/:id', authMiddleware, (req, res) => {
  const id = req.params && req.params.id ? String(req.params.id) : '';
  const d = store.findDeviceById(id);
  if (!d || d.userId !== req.userId) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  store.removeDevice(id);
  res.json({ ok: true });
});

app.post('/api/devices/heartbeat', authMiddleware, (req, res) => {
  const deviceKey = (req.body && req.body.deviceKey) ? String(req.body.deviceKey) : '';
  if (!deviceKey) {
    res.status(400).json({ error: 'deviceKey required' });
    return;
  }
  const d = store.findDeviceByUserAndKey(req.userId, deviceKey);
  if (!d) {
    res.status(404).json({ error: 'Device not registered' });
    return;
  }
  d.lastSeen = Date.now();
  const body = req.body || {};
  if (typeof body.appVersion === 'string' && body.appVersion.trim()) {
    d.appVersion = body.appVersion.trim().slice(0, 48);
  }
  d.buildReportedAt = Date.now();
  store.updateDevice(d);
  res.json({ ok: true });
});

app.post('/api/devices/register', authMiddleware, async (req, res) => {
  const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
  const deviceKey = (req.body && req.body.deviceKey) ? String(req.body.deviceKey) : '';
  const baseUrlRaw = (req.body && req.body.baseUrl) ? String(req.body.baseUrl).trim() : '';
  if (!name || !deviceKey) {
    res.status(400).json({ error: 'name and deviceKey required' });
    return;
  }
  const extraCandidates =
    req.body && Array.isArray(req.body.baseUrlCandidates) ? req.body.baseUrlCandidates : [];
  const probeMs =
    Number(process.env.DEVICE_BASE_PROBE_MS) > 0 ? Number(process.env.DEVICE_BASE_PROBE_MS) : 2500;
  let baseUrl;
  try {
    baseUrl = await reachability.pickReachableDeviceBase(baseUrlRaw, extraCandidates, {
      timeoutMs: probeMs
    });
  } catch (e) {
    baseUrl = tunnel.normalizeBaseUrl(
      baseUrlRaw || process.env.DEFAULT_DEVICE_BASE || 'http://127.0.0.1:17456'
    );
  }
  const now = Date.now();
  const av =
    req.body && typeof req.body.appVersion === 'string' && req.body.appVersion.trim()
      ? req.body.appVersion.trim().slice(0, 48)
      : '';
  const existing = store.findDeviceByUserAndKey(req.userId, deviceKey);
  if (existing) {
    existing.name = name;
    existing.baseUrl = baseUrl;
    existing.baseUrlAuto = true;
    existing.lastSeen = now;
    if (av) existing.appVersion = av;
    existing.buildReportedAt = now;
    store.updateDevice(existing);
    res.json({ device: { id: existing.id, name: existing.name, deviceKey: existing.deviceKey, baseUrl: existing.baseUrl } });
    return;
  }
  const device = {
    id: auth.newId(),
    userId: req.userId,
    name,
    deviceKey,
    baseUrl,
    baseUrlAuto: true,
    lastSeen: now,
    disabled: false,
    appVersion: av || undefined,
    buildReportedAt: av ? now : undefined
  };
  store.addDevice(device);
  res.json({ device: { id: device.id, name: device.name, deviceKey: device.deviceKey, baseUrl: device.baseUrl } });
});

const proxy = tunnel.createProxy();
proxy.on('error', (err, req, res) => {
  if (PROXY_DEBUG) {
    const addr = err && (err.address || err.hostname);
    const port = err && err.port;
    process.stderr.write(
      `[proxy tunnel error] ${err.code || 'ERR'} ${err.message || ''}${addr ? ` addr=${addr}:${port || ''}` : ''} path=${req && (req.url || req.originalUrl)}` +
        '\n'
    );
  }
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    const body = { error: 'Bad gateway' };
    if (PROXY_DEBUG && err && err.message) {
      body.detail = `${err.code || ''} ${err.message}`.trim();
    }
    res.end(JSON.stringify(body));
  }
});

tunnel.attachTunnelHttp(app, proxy);

if (PROXY_DEBUG) {
  proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
    const t = options && options.target;
    const href =
      t &&
      (t.href ||
        (t.protocol && t.host ? `${t.protocol}//${t.host}` : '') ||
        String(t));
    proxyDbg.logWss(
      `direct-tunnel proxyReqWs target=${href || '?'} url=${proxyDbg.safeUrlForLog(req && req.url)}`
    );
  });
  proxy.on('open', () => {
    proxyDbg.logWss('direct-tunnel WS upstream open (http-proxy pipe active)');
  });
}

const server = http.createServer(app);
const agentWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (PROXY_DEBUG) {
    process.stdout.write(
      `[proxy-wss] upgrade ${req.method} ${proxyDbg.safeUrlForLog(req.url)}\n`
    );
  }
  const path = pathnameOnly(req.url || '');
  if (path === '/agent') {
    agentWss.handleUpgrade(req, socket, head, (ws) => {
      agentConnection.setupAgentConnection(ws, req, DEVICE_ONLINE_MS);
    });
    return;
  }
  const handled = tunnel.handleTunnelUpgrade(req, socket, head, proxy);
  if (!handled) {
    socket.destroy();
  }
});

const PORT = Number(process.env.PORT) || 3030;
server.listen(PORT, () => {
  process.stdout.write(
    `Astro Code remote proxy listening on http://0.0.0.0:${PORT}${PROXY_DEBUG ? ' (PROXY_DEBUG: HTTP + [proxy-wss] WebSocket traffic)' : ''}\n`
  );
});
