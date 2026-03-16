const express = require('express');
const { PROXY_WS_URL } = require('../remote/config');
const logger = require('../utils/logger');

// Very small in-memory session store (per server process)
const remoteSession = {
  enabled: false,
  username: '',
  password: '',
  selectedMachineId: '',
};

function getHttpBaseFromWsUrl(wsUrl) {
  try {
    if (!wsUrl) return null;
    const url = new URL(wsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function setupRemoteRoutes() {
  const router = express.Router();

  router.get('/session', (req, res) => {
    res.json({ success: true, session: remoteSession });
  });

  router.post('/session', (req, res) => {
    try {
      const { enabled, username, password, selectedMachineId } = req.body || {};

      remoteSession.enabled = !!enabled;
      remoteSession.username = username || '';
      remoteSession.password = password || '';
      remoteSession.selectedMachineId = selectedMachineId || '';

      logger.info('[remote] Session updated from preview', {
        enabled: remoteSession.enabled,
        username: remoteSession.username,
        selectedMachineId: remoteSession.selectedMachineId,
      });

      res.json({ success: true, session: remoteSession });
    } catch (err) {
      logger.error('[remote] Failed to update session', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/machines', async (req, res) => {
    try {
      const username = req.query.username || remoteSession.username;
      if (!username) {
        return res.status(400).json({ success: false, error: 'username is required' });
      }

      const httpBase = getHttpBaseFromWsUrl(PROXY_WS_URL);
      if (!httpBase) {
        return res.status(500).json({ success: false, error: 'Proxy URL not configured' });
      }

      const url = `${httpBase}/machines?username=${encodeURIComponent(username)}`;
      // Use global fetch if available (Node 18+), otherwise require node-fetch dynamically
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
      const response = await fetchFn(url);
      const data = await response.json();

      if (!data.ok) {
        return res.status(500).json({ success: false, error: data.error || 'Failed to list machines' });
      }

      res.json({ success: true, machines: data.machines || [] });
    } catch (err) {
      logger.error('[remote] Failed to fetch machines from proxy', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return { router, remoteSession };
}

module.exports = { setupRemoteRoutes, remoteSession };

