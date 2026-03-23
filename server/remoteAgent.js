/**
 * Outbound WebSocket to the remote proxy (/agent):
 * - Presence (lastSeen)
 * - Reverse tunnel: HTTP + WebSocket multiplexed when direct baseUrl is unreachable
 *
 * Credentials from env (REMOTE_*) or from POST /__api__/remote/agent-config (browser → server).
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');
const logger = require('./utils/logger');
const { getBuildInfo } = require('./utils/buildInfo');
const appConfig = require('./config');

const streams = new Map();

/** Last known count of reverse-tunnel remote browsers (from proxy). */
let remoteTunnelViewerCount = 0;

/** Snapshot of tunnel WS sessions (ip, account, UA, …) from proxy. */
let remoteTunnelSessions = [];

/** Broadcast preview WebSocket messages (set from index.js). */
let previewBroadcaster = null;

function setPreviewBroadcaster(fn) {
  previewBroadcaster = typeof fn === 'function' ? fn : null;
}

function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map(function (s) {
    return {
      streamId: s.streamId != null ? String(s.streamId) : '',
      ip: s.ip != null ? String(s.ip) : '',
      userAgent: s.userAgent != null ? String(s.userAgent) : '',
      account: s.account != null ? String(s.account) : '',
      connectedAt: Number(s.connectedAt) || 0
    };
  });
}

function broadcastRemoteViewersToPreview(count, previous, sessions) {
  remoteTunnelViewerCount = Math.max(0, Number(count) || 0);
  remoteTunnelSessions = normalizeSessions(sessions);
  if (typeof previewBroadcaster === 'function') {
    previewBroadcaster({
      type: 'remoteViewersUpdate',
      count: remoteTunnelViewerCount,
      previous: Number(previous) || 0,
      sessions: remoteTunnelSessions
    });
  }
}

/** Observable state for GET /__api__/remote/agent-status */
const agentRuntimeState = {
  configured: false,
  connected: false,
  connecting: false,
  proxyHost: null,
  lastError: null,
  lastCloseCode: null,
  lastCloseReason: '',
  deviceKeySuffix: null,
  agentWsUrlHint: null
};

function maskDeviceKey(dk) {
  const s = String(dk || '');
  if (s.length <= 6) return '***';
  return '…' + s.slice(-6);
}

function setAgentState(partial) {
  Object.assign(agentRuntimeState, partial);
}

function getAgentStatus() {
  return {
    configured: agentRuntimeState.configured,
    connected: agentRuntimeState.connected,
    connecting: agentRuntimeState.connecting,
    proxyHost: agentRuntimeState.proxyHost,
    lastError: agentRuntimeState.lastError,
    lastCloseCode: agentRuntimeState.lastCloseCode,
    lastCloseReason: agentRuntimeState.lastCloseReason,
    deviceKeySuffix: agentRuntimeState.deviceKeySuffix,
    agentWsUrlHint: agentRuntimeState.agentWsUrlHint
  };
}

function buildAgentWsUrl(proxyUrl, deviceKey) {
  let u;
  try {
    u = new URL(proxyUrl.trim());
  } catch (e) {
    return null;
  }
  const wsProto =
    u.protocol === 'https:' || u.protocol === 'wss:' ? 'wss:' : 'ws:';
  const basePath = (u.pathname || '').replace(/\/$/, '');
  const q = new URLSearchParams({ deviceKey: String(deviceKey) });
  const pathJoin = basePath ? `${basePath}/agent` : '/agent';
  return `${wsProto}//${u.host}${pathJoin}?${q}`;
}

function tunnelPathToLocal(rawUrl) {
  const u = String(rawUrl);
  const q = u.indexOf('?');
  const pathPart = q === -1 ? u : u.slice(0, q);
  const query = q === -1 ? '' : u.slice(q);
  const m = pathPart.match(/^\/tunnel\/[^/]+(\/.*)?$/);
  if (!m) {
    return u.startsWith('/') ? u : '/' + u;
  }
  const sub = m[1] && m[1].length > 0 ? m[1] : '/';
  return sub + query;
}

function flattenHeaders(h) {
  const out = {};
  for (const k of Object.keys(h || {})) {
    if (k.toLowerCase() === 'transfer-encoding') continue;
    const v = h[k];
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(', ');
  }
  return out;
}

function filterWsClientHeaders(h) {
  const skip = new Set(['connection', 'upgrade', 'host']);
  const out = {};
  for (const k of Object.keys(h || {})) {
    if (skip.has(k.toLowerCase())) continue;
    out[k] = Array.isArray(h[k]) ? h[k].join(', ') : String(h[k]);
  }
  return out;
}

function handleHttpReq(msg, proxyWs, localBase) {
  let localUrl;
  try {
    localUrl = new URL(msg.path, localBase.endsWith('/') ? localBase : localBase + '/');
  } catch (e) {
    proxyWs.send(
      JSON.stringify({
        type: 'http_res',
        id: msg.id,
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        bodyB64: Buffer.from(JSON.stringify({ error: 'bad path' })).toString('base64')
      })
    );
    return;
  }
  const port =
    localUrl.port ||
    (localUrl.protocol === 'https:' ? 443 : 80);
  const lib = localUrl.protocol === 'https:' ? https : http;
  const opts = {
    hostname: '127.0.0.1',
    port: Number(port) || appConfig.PORT,
    path: localUrl.pathname + localUrl.search,
    method: msg.method || 'GET',
    headers: Object.assign({}, msg.headers || {}, {
      host: `127.0.0.1:${Number(port) || appConfig.PORT}`
    })
  };

  const req = lib.request(opts, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const body = Buffer.concat(chunks);
      proxyWs.send(
        JSON.stringify({
          type: 'http_res',
          id: msg.id,
          status: res.statusCode || 502,
          headers: flattenHeaders(res.headers),
          bodyB64: body.length ? body.toString('base64') : undefined
        })
      );
    });
  });
  req.on('error', (err) => {
    proxyWs.send(
      JSON.stringify({
        type: 'http_res',
        id: msg.id,
        status: 502,
        headers: { 'Content-Type': 'application/json' },
        bodyB64: Buffer.from(
          JSON.stringify({ error: 'local forward failed', detail: err.message })
        ).toString('base64')
      })
    );
  });
  if (msg.bodyB64) {
    req.write(Buffer.from(msg.bodyB64, 'base64'));
  }
  req.end();
}

function handleWsOpen(msg, proxyWs, localPort) {
  const streamId = msg.streamId;
  const localPath = tunnelPathToLocal(msg.path);
  const wsUrl = `ws://127.0.0.1:${localPort}${localPath}`;
  const headers = filterWsClientHeaders(msg.headers || {});
  const localWs = new WebSocket(wsUrl, { headers });

  streams.set(streamId, localWs);

  localWs.on('message', (data, isBinary) => {
    if (proxyWs.readyState !== WebSocket.OPEN) return;
    proxyWs.send(
      JSON.stringify({
        type: 'ws_server_frame',
        streamId,
        data: Buffer.from(data).toString('base64'),
        binary: !!isBinary
      })
    );
  });
  localWs.on('close', (code, reason) => {
    streams.delete(streamId);
    if (proxyWs.readyState === WebSocket.OPEN) {
      proxyWs.send(
        JSON.stringify({
          type: 'ws_server_close',
          streamId,
          code: code || 1000
        })
      );
    }
  });
  localWs.on('error', () => {
    streams.delete(streamId);
    if (proxyWs.readyState === WebSocket.OPEN) {
      proxyWs.send(
        JSON.stringify({
          type: 'ws_server_close',
          streamId,
          code: 1011
        })
      );
    }
  });
}

function onProxyMessage(data, proxyWs, localBase, localPort) {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch (e) {
    return;
  }
  if (msg.type === 'remote_viewers') {
    const n = Math.max(0, Number(msg.count) || 0);
    const prev =
      msg.previous !== undefined && msg.previous !== null
        ? Math.max(0, Number(msg.previous) || 0)
        : remoteTunnelViewerCount;
    const sessions = Array.isArray(msg.sessions) ? msg.sessions : [];
    broadcastRemoteViewersToPreview(n, prev, sessions);
    return;
  }
  if (msg.type === 'http_req') {
    handleHttpReq(msg, proxyWs, localBase);
    return;
  }
  if (msg.type === 'ws_open') {
    handleWsOpen(msg, proxyWs, localPort);
    return;
  }
  if (msg.type === 'ws_client_frame') {
    const localWs = streams.get(msg.streamId);
    if (localWs && localWs.readyState === WebSocket.OPEN) {
      const buf = Buffer.from(msg.data || '', 'base64');
      localWs.send(buf, { binary: !!msg.binary });
    }
    return;
  }
  if (msg.type === 'ws_client_close') {
    const localWs = streams.get(msg.streamId);
    if (localWs) {
      try {
        localWs.close();
      } catch (e) {
        /* ignore */
      }
      streams.delete(msg.streamId);
    }
  }
}

function clearStreams() {
  for (const [, localWs] of streams.entries()) {
    try {
      localWs.close();
    } catch (e) {
      /* ignore */
    }
  }
  streams.clear();
}

function startRemoteAgent(opts) {
  const proxyUrl = opts.proxyUrl;
  const token = opts.token;
  const deviceKey = opts.deviceKey;
  const localPort = Number(opts.localPort) || appConfig.PORT;
  const localBase = `http://127.0.0.1:${localPort}`;

  if (!proxyUrl || !token || !deviceKey) {
    setAgentState({
      configured: false,
      connected: false,
      connecting: false,
      lastError: 'missing proxyUrl, token, or deviceKey'
    });
    return { stop: () => {} };
  }

  const url = buildAgentWsUrl(proxyUrl, deviceKey);
  let proxyHost = null;
  let agentHint = null;
  try {
    const pu = new URL(proxyUrl.trim());
    proxyHost = pu.host;
    agentHint = `${pu.protocol}//${pu.host}${(pu.pathname || '').replace(/\/$/, '') || ''}/agent`;
  } catch (e) {
    proxyHost = null;
  }
  if (!url) {
    logger.error('remote agent: invalid proxyUrl', { proxyUrl });
    setAgentState({
      configured: false,
      connected: false,
      lastError: 'invalid proxyUrl',
      proxyHost
    });
    return { stop: () => {} };
  }

  setAgentState({
    configured: true,
    proxyHost,
    deviceKeySuffix: maskDeviceKey(deviceKey),
    agentWsUrlHint: agentHint,
    lastError: null
  });

  let ws = null;
  let reconnectTimer = null;
  let stopped = false;
  const reconnectMs = 4000;

  const isTls = url.startsWith('wss:');
  const wsOptions = {
    headers: { Authorization: `Bearer ${token}` },
    handshakeTimeout: 20000
  };
  if (isTls && appConfig.REMOTE_PROXY_TLS_INSECURE) {
    wsOptions.rejectUnauthorized = false;
    logger.warn(
      'remote agent: REMOTE_PROXY_TLS_INSECURE enabled (insecure — dev only)'
    );
  }

  function connect() {
    if (stopped) return;
    clearStreams();
    setAgentState({
      connecting: true,
      connected: false,
      lastError: null
    });
    try {
      ws = new WebSocket(url, wsOptions);
    } catch (e) {
      logger.error('remote agent: failed to create WebSocket', e);
      setAgentState({
        connecting: false,
        lastError: e.message || String(e)
      });
      scheduleReconnect();
      return;
    }

    ws.on('open', () => {
      setAgentState({
        connected: true,
        connecting: false,
        lastError: null,
        lastCloseCode: null,
        lastCloseReason: ''
      });
      logger.info('remote agent: connected to proxy (presence + reverse tunnel)', {
        proxyHost
      });
      try {
        const bi = getBuildInfo();
        ws.send(
          JSON.stringify({
            type: 'agent_hello',
            name: bi.name,
            appVersion: bi.version,
            commit: bi.commit
          })
        );
      } catch (e) {
        /* ignore */
      }
    });

    ws.on('message', (data) => {
      onProxyMessage(data, ws, localBase, localPort);
    });

    ws.on('close', (code, reason) => {
      ws = null;
      clearStreams();
      const prevViewers = remoteTunnelViewerCount;
      if (prevViewers > 0) {
        broadcastRemoteViewersToPreview(0, prevViewers, []);
      } else {
        remoteTunnelViewerCount = 0;
        remoteTunnelSessions = [];
      }
      const r = String(reason || '');
      setAgentState({
        connected: false,
        connecting: false,
        lastCloseCode: code,
        lastCloseReason: r
      });
      if (!stopped) {
        logger.warn('remote agent: WebSocket closed', {
          code,
          reason: r,
          proxyHost
        });
        if (code === 4003 || code === 4002 || code === 4001) {
          logger.error(
            'remote agent: auth rejected by proxy — sign in again in Remote Explorer (token/device may be invalid)'
          );
          setAgentState({
            lastError: `proxy closed connection (${code}) — check token and device registration`
          });
        }
        scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      const msg = err && err.message ? err.message : String(err);
      setAgentState({ lastError: msg });
      logger.warn('remote agent: socket error', { message: msg, proxyHost });
    });

    ws.on('unexpected-response', (req, res) => {
      const code = res && res.statusCode;
      const txt = `HTTP ${code || '?'} ${res && res.statusMessage}`;
      setAgentState({ connecting: false, connected: false, lastError: txt });
      logger.error('remote agent: proxy rejected WebSocket upgrade', {
        statusCode: code,
        statusMessage: res && res.statusMessage,
        proxyHost,
        hint:
          'Check proxy is running, JWT_SECRET matches, and URL uses ws:// or wss:// correctly'
      });
    });
  }

  function scheduleReconnect() {
    if (stopped) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectMs);
  }

  logger.info('remote agent: starting outbound connection to proxy');
  connect();

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      clearStreams();
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          /* ignore */
        }
        ws = null;
      }
      setAgentState({ connected: false, connecting: false });
    }
  };
}

function startFromEnv(config) {
  if (
    config.REMOTE_PROXY_URL &&
    config.REMOTE_AGENT_TOKEN &&
    config.REMOTE_DEVICE_KEY
  ) {
    return startRemoteAgent({
      proxyUrl: config.REMOTE_PROXY_URL,
      token: config.REMOTE_AGENT_TOKEN,
      deviceKey: config.REMOTE_DEVICE_KEY,
      localPort: config.PORT
    });
  }
  setAgentState({
    configured: false,
    connected: false,
    connecting: false,
    proxyHost: null,
    agentWsUrlHint: null,
    deviceKeySuffix: null
  });
  return { stop: () => {} };
}

function reconfigure(body) {
  const proxyUrl = body && body.proxyUrl ? String(body.proxyUrl).trim() : '';
  const token = body && body.token ? String(body.token).trim() : '';
  const deviceKey = body && body.deviceKey ? String(body.deviceKey).trim() : '';
  if (!proxyUrl || !token || !deviceKey) {
    return { ok: false, error: 'proxyUrl, token, and deviceKey required' };
  }
  if (global.__remoteAgent && typeof global.__remoteAgent.stop === 'function') {
    global.__remoteAgent.stop();
  }
  global.__remoteAgent = startRemoteAgent({
    proxyUrl,
    token,
    deviceKey,
    localPort: appConfig.PORT
  });
  logger.info('remote agent: reconfigured from preview (browser → server)');
  return { ok: true };
}

function getRemoteTunnelViewerCount() {
  return remoteTunnelViewerCount;
}

function getRemoteTunnelViewerSessions() {
  return remoteTunnelSessions.slice();
}

module.exports = {
  startRemoteAgent,
  startFromEnv,
  reconfigure,
  buildAgentWsUrl,
  getAgentStatus,
  setPreviewBroadcaster,
  getRemoteTunnelViewerCount,
  getRemoteTunnelViewerSessions
};
