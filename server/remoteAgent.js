/**
 * Keeps an always-on WebSocket to the HTMLCLASS remote proxy (/agent) so
 * device presence (lastSeen) is updated by this Node server, not the browser.
 *
 * Set REMOTE_PROXY_URL, REMOTE_AGENT_TOKEN (JWT from proxy login), and
 * REMOTE_DEVICE_KEY (registered device key).
 */
const WebSocket = require('ws');
const logger = require('./utils/logger');

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
  return `${wsProto}//${u.host}${basePath}/agent?${q}`;
}

function startRemoteAgent(config) {
  const proxyUrl = config.REMOTE_PROXY_URL;
  const token = config.REMOTE_AGENT_TOKEN;
  const deviceKey = config.REMOTE_DEVICE_KEY;
  if (!proxyUrl || !token || !deviceKey) {
    return { stop: () => {} };
  }

  const url = buildAgentWsUrl(proxyUrl, deviceKey);
  if (!url) {
    logger.error('REMOTE_PROXY_URL is invalid', { proxyUrl });
    return { stop: () => {} };
  }

  let ws = null;
  let reconnectTimer = null;
  let stopped = false;
  const reconnectMs = 4000;

  function connect() {
    if (stopped) return;
    try {
      ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      logger.error('remote agent: failed to create WebSocket', e);
      scheduleReconnect();
      return;
    }

    ws.on('open', () => {
      logger.info('remote agent: connected to proxy (server-side presence)');
    });

    ws.on('close', (code, reason) => {
      ws = null;
      if (!stopped) {
        logger.info('remote agent: disconnected', {
          code,
          reason: String(reason || '')
        });
        scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      logger.warn('remote agent: socket error', { message: err && err.message });
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

  logger.info('remote agent: starting (server → proxy WebSocket)');
  connect();

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          /* ignore */
        }
        ws = null;
      }
    }
  };
}

module.exports = { startRemoteAgent, buildAgentWsUrl };
