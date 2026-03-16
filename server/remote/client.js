const WebSocket = require('ws');
const os = require('os');
const { PROXY_WS_URL, ENABLE_REMOTE } = require('./config');
const logger = require('../utils/logger');

class RemoteClient {
  constructor({ userToken, machineId, baseDir }) {
    this.userToken = userToken;
    this.machineId = machineId || os.hostname();
    this.baseDir = baseDir;
    this.ws = null;
    this.connected = false;
  }

  connect() {
    if (!ENABLE_REMOTE) {
      logger.info('[remote] Remote client disabled by config');
      return;
    }

    if (!this.userToken) {
      logger.warn('[remote] No user token provided, remote client will not connect');
      return;
    }

    logger.info('[remote] Connecting to proxy', {
      url: PROXY_WS_URL,
      machineId: this.machineId
    });

    this.ws = new WebSocket(PROXY_WS_URL, {
      headers: {
        'x-auth-token': this.userToken,
        'x-machine-id': this.machineId,
      },
    });

    this.ws.on('open', () => {
      this.connected = true;
      logger.info('[remote] Connected to proxy', { machineId: this.machineId });
      this._send({
        type: 'REGISTER_MACHINE',
        machineId: this.machineId,
      });
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      logger.warn('[remote] Disconnected from proxy', { code, reason: reason && reason.toString ? reason.toString() : reason });
    });

    this.ws.on('error', (err) => {
      logger.error('[remote] WebSocket error', err);
    });

    this.ws.on('message', async (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        logger.warn('[remote] Failed to parse message', { error: err.message });
        return;
      }

      // TODO: integrate with existing API/file handlers.
      // For now we just log the incoming message type.
      logger.info('[remote] Received message', { type: msg.type });
    });
  }

  _send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }
}

module.exports = { RemoteClient };

