const crypto = require('crypto');
const WebSocket = require('ws');

/** deviceId -> agent WebSocket (HTMLCLASS server outbound connection) */
const deviceSockets = new Map();
/** http request id -> { res, timer } */
const pendingHttp = new Map();
/** streamId -> { clientWs, deviceId } (browser <-> proxy WS, piped through agent) */
const pendingWsStreams = new Map();

function sendJson(ws, obj) {
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
}

function unregisterDevice(deviceId, ws) {
  if (ws && deviceSockets.get(deviceId) !== ws) {
    return;
  }
  cleanupDeviceStreams(deviceId);
  deviceSockets.delete(deviceId);
}

function hasAgentForDevice(deviceId) {
  const ws = deviceSockets.get(deviceId);
  return !!(ws && ws.readyState === WebSocket.OPEN);
}

function onDeviceMessage(deviceId, data) {
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
    if (entry && entry.clientWs) {
      try {
        entry.clientWs.close(msg.code || 1000);
      } catch (e) {
        /* ignore */
      }
    }
    pendingWsStreams.delete(msg.streamId);
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
 */
function handleUpgradeReverse(deviceId, req, socket, head) {
  const ws = deviceSockets.get(deviceId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const streamId = crypto.randomBytes(16).toString('hex');
    const path = req.url || '/';
    const headers = sanitizeHeaders(req.headers);
    pendingWsStreams.set(streamId, { clientWs, deviceId });

    clientWs.on('message', (data, isBinary) => {
      sendJson(ws, {
        type: 'ws_client_frame',
        streamId,
        data: Buffer.from(data).toString('base64'),
        binary: !!isBinary
      });
    });
    clientWs.on('close', () => {
      sendJson(ws, { type: 'ws_client_close', streamId });
      pendingWsStreams.delete(streamId);
    });
    clientWs.on('error', () => {
      sendJson(ws, { type: 'ws_client_close', streamId });
      pendingWsStreams.delete(streamId);
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
