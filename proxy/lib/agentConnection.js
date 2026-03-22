const store = require('./store');
const auth = require('./auth');

function refreshDevice(deviceId) {
  const d = store.findDeviceById(deviceId);
  if (!d) return;
  d.lastSeen = Date.now();
  store.updateDevice(d);
}

function setupAgentConnection(ws, req, deviceOnlineMs) {
  const token = auth.bearerFromAuthHeader(req.headers.authorization);
  let deviceKey = '';
  try {
    deviceKey = new URL(req.url, 'http://x').searchParams.get('deviceKey') || '';
  } catch (e) {
    ws.close(4000, 'bad request');
    return null;
  }
  if (!token || !deviceKey) {
    ws.close(4001, 'auth required');
    return null;
  }
  const payload = auth.verifyToken(token);
  if (!payload || !payload.sub) {
    ws.close(4002, 'invalid token');
    return null;
  }
  const device = store.findDeviceByUserAndKey(payload.sub, deviceKey);
  if (!device) {
    ws.close(4003, 'device not registered');
    return null;
  }
  const deviceId = device.id;
  const tickMs = Math.min(15000, Math.max(5000, deviceOnlineMs / 6));
  refreshDevice(deviceId);
  const iv = setInterval(() => refreshDevice(deviceId), tickMs);
  ws.on('close', () => {
    clearInterval(iv);
  });
  ws.on('error', () => {});
  return deviceId;
}

module.exports = {
  setupAgentConnection
};
