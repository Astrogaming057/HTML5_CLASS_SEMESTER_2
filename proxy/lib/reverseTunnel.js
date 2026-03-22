const crypto = require('crypto');
const WebSocket = require('ws');
const dbg = require('./debug');

/** deviceId -> agent WebSocket (Astro Code backend outbound connection) */
const deviceSockets = new Map();
/** http request id -> { res, timer } */
const pendingHttp = new Map();
/** streamId -> { clientWs, deviceId, ip, userAgent, account, connectedAt } */
const pendingWsStreams = new Map();
/** Last broadcast remote viewer count per device (for previous/count payloads) */
const viewerCountByDevice = new Map();

function normalizeClientIp(req) {
  if (!req) return '';
  const h = req.headers || {};
  const xff = h['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  if (h['x-real-ip']) return String(h['x-real-ip']).trim();
  const sock = req.socket || req.connection;
  const ra = sock && sock.remoteAddress;
  if (!ra) return '';
  return String(ra).replace(/^::ffff:/, '');
}

function buildSessionsSnapshot(deviceId) {
  const out = [];
  for (const [streamId, entry] of pendingWsStreams.entries()) {
    if (entry.deviceId !== deviceId) continue;
    out.push({
      streamId: String(streamId).slice(0, 12),
      ip: entry.ip || '',
      userAgent: entry.userAgent || '',
      account: entry.account || '',
      connectedAt: entry.connectedAt || Date.now()
    });
  }
  out.sort(function (a, b) {
    return (a.connectedAt || 0) - (b.connectedAt || 0);
  });
  return out;
}

function computedTunnelViewerCount(deviceId) {
  let n = 0;
  for (const [, entry] of pendingWsStreams.entries()) {
    if (entry.deviceId === deviceId) n++;
  }
  return n;
}

/**
 * Notify agent WebSocket of how many reverse-tunnel browser WS streams are open for this device.
 */
function broadcastViewerCount(deviceId) {
  const ws = deviceSockets.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const old = viewerCountByDevice.has(deviceId) ? viewerCountByDevice.get(deviceId) : 0;
  const n = computedTunnelViewerCount(deviceId);
  viewerCountByDevice.set(deviceId, n);
  sendJson(ws, {
    type: 'remote_viewers',
    count: n,
    previous: old,
    sessions: buildSessionsSnapshot(deviceId)
  });
}

function sendJson(ws, obj) {
  if (dbg.isProxyDebug() && obj && typeof obj.type === 'string') {
    let extra = '';
    if (obj.id) extra += ` id=${String(obj.id).slice(0, 10)}`;
    if (obj.streamId) extra += ` stream=${String(obj.streamId).slice(0, 10)}`;
    dbg.logWss(`reverse agent→device type=${obj.type}${extra}`);
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

function sanitizeHeaders(h) {
  const out = {};
  const skip = new Set([
    'connection',
    'transfer-encoding',
    'keep-alive',
    'proxy-connection',
    'upgrade',
    'http2-settings'
  ]);
  for (const k of Object.keys(h || {})) {
    if (skip.has(k.toLowerCase())) continue;
    const v = h[k];
    out[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

function cleanupDeviceStreams(deviceId) {
  for (const [sid, entry] of pendingWsStreams.entries()) {
    if (entry.deviceId === deviceId) {
      try {
        if (entry.clientWs && entry.clientWs.readyState === WebSocket.OPEN) {
          entry.clientWs.close(1001);
        }
      } catch (e) {
        /* ignore */
      }
      pendingWsStreams.delete(sid);
    }
  }
}

function registerDevice(deviceId, ws) {
  const old = deviceSockets.get(deviceId);
  if (old && old !== ws) {
    try {
      old.close();
    } catch (e) {
      /* ignore */
    }
  }
  deviceSockets.set(deviceId, ws);
  viewerCountByDevice.delete(deviceId);
  broadcastViewerCount(deviceId);
}

function unregisterDevice(deviceId, ws) {
  if (ws && deviceSockets.get(deviceId) !== ws) {
    return;
  }
  cleanupDeviceStreams(deviceId);
  deviceSockets.delete(deviceId);
  viewerCountByDevice.delete(deviceId);
}

function hasAgentForDevice(deviceId) {
  const ws = deviceSockets.get(deviceId);
  return !!(ws && ws.readyState === WebSocket.OPEN);
}

function onDeviceMessage(deviceId, data) {
  if (dbg.isProxyDebug()) {
    dbg.logWss(
      `reverse device→agent device=${String(deviceId).slice(0, 8)}… ${dbg.summarizeWsPayload(data)}`
    );
  }
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch (e) {
    return;
  }

  if (msg.type === 'http_res' && msg.id) {
    const p = pendingHttp.get(msg.id);
    if (!p) return;
    clearTimeout(p.timer);
    pendingHttp.delete(msg.id);
    if (p.res.headersSent) return;
    const headers = msg.headers || {};
    const body = msg.bodyB64 ? Buffer.from(msg.bodyB64, 'base64') : Buffer.alloc(0);
    try {
      p.res.writeHead(msg.status || 502, headers);
      p.res.end(body);
    } catch (e) {
      /* ignore */
    }
    return;
  }

  if (msg.type === 'ws_server_frame' && msg.streamId) {
    const entry = pendingWsStreams.get(msg.streamId);
    if (entry && entry.clientWs && entry.clientWs.readyState === WebSocket.OPEN) {
      const buf = Buffer.from(msg.data || '', 'base64');
      entry.clientWs.send(buf, { binary: !!msg.binary });
    }
    return;
  }

  if (msg.type === 'ws_server_close' && msg.streamId) {
    const entry = pendingWsStreams.get(msg.streamId);
    const did = entry && entry.deviceId;
    if (entry && entry.clientWs) {
      try {
        entry.clientWs.close(msg.code || 1000);
      } catch (e) {
        /* ignore */
      }
    }
    pendingWsStreams.delete(msg.streamId);
    if (did) broadcastViewerCount(did);
  }
}

/**
 * Forward HTTP through agent WebSocket. Returns true if the request was accepted
 * (response sent asynchronously). False if no agent — caller may use direct proxy.
 */
function tryHttpForward(deviceId, req, res) {
  const ws = deviceSockets.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const bodyBuf = Buffer.concat(chunks);
      const id = crypto.randomBytes(16).toString('hex');
      const timer = setTimeout(() => {
        pendingHttp.delete(id);
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Reverse tunnel timeout' }));
        }
        resolve(true);
      }, 120000);

      pendingHttp.set(id, { res, timer });
      const path = req.url || '/';
      const headers = sanitizeHeaders(req.headers);
      const ok = sendJson(ws, {
        type: 'http_req',
        id,
        method: req.method || 'GET',
        path,
        headers,
        bodyB64: bodyBuf.length ? bodyBuf.toString('base64') : undefined
      });
      if (!ok) {
        clearTimeout(timer);
        pendingHttp.delete(id);
        resolve(false);
      } else {
        resolve(true);
      }
    });
    req.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Handle browser WebSocket upgrade via reverse agent. Returns false if no agent.
 * @param {object} [viewerContext] - { username } from JWT (proxy account viewing this device)
 */
function handleUpgradeReverse(deviceId, req, socket, head, viewerContext) {
  const ws = deviceSockets.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  const ctx = viewerContext && typeof viewerContext === 'object' ? viewerContext : {};
  const account =
    typeof ctx.username === 'string'
      ? ctx.username.trim()
      : typeof ctx.account === 'string'
        ? ctx.account.trim()
        : '';
  const ip = normalizeClientIp(req);
  const rawUa = (req.headers && req.headers['user-agent']) || '';
  const userAgent = rawUa.length > 160 ? rawUa.slice(0, 160) + '…' : rawUa;
  const connectedAt = Date.now();

  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const streamId = crypto.randomBytes(16).toString('hex');
    const path = req.url || '/';
    const headers = sanitizeHeaders(req.headers);
    pendingWsStreams.set(streamId, {
      clientWs,
      deviceId,
      ip,
      userAgent,
      account,
      connectedAt
    });
    broadcastViewerCount(deviceId);
    if (dbg.isProxyDebug()) {
      dbg.logWss(
        `reverse tunnel-ws browser open stream=${streamId.slice(0, 10)}… device=${String(deviceId).slice(0, 8)}… path=${dbg.safeUrlForLog(path)}`
      );
    }

    clientWs.on('message', (data, isBinary) => {
      if (dbg.isProxyDebug()) {
        dbg.logWss(
          `reverse tunnel-ws browser→agent frame len=${data.length} binary=${!!isBinary} stream=${streamId.slice(0, 10)}…`
        );
      }
      sendJson(ws, {
        type: 'ws_client_frame',
        streamId,
        data: Buffer.from(data).toString('base64'),
        binary: !!isBinary
      });
    });
    clientWs.on('close', (code, reason) => {
      if (dbg.isProxyDebug()) {
        dbg.logWss(
          `reverse tunnel-ws browser close stream=${streamId.slice(0, 10)}… code=${code} reason=${String(reason || '').slice(0, 40)}`
        );
      }
      sendJson(ws, { type: 'ws_client_close', streamId });
      pendingWsStreams.delete(streamId);
      broadcastViewerCount(deviceId);
    });
    clientWs.on('error', () => {
      if (dbg.isProxyDebug()) {
        dbg.logWss(`reverse tunnel-ws browser error stream=${streamId.slice(0, 10)}…`);
      }
      sendJson(ws, { type: 'ws_client_close', streamId });
      pendingWsStreams.delete(streamId);
      broadcastViewerCount(deviceId);
    });

    const ok = sendJson(ws, {
      type: 'ws_open',
      streamId,
      path,
      headers
    });
    if (!ok) {
      try {
        clientWs.close(1011);
      } catch (e) {
        /* ignore */
      }
      pendingWsStreams.delete(streamId);
      broadcastViewerCount(deviceId);
    }
  });
  return true;
}

module.exports = {
  registerDevice,
  unregisterDevice,
  onDeviceMessage,
  tryHttpForward,
  handleUpgradeReverse,
  hasAgentForDevice,
  sanitizeHeaders
};
