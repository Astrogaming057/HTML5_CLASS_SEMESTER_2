module.exports = {
  PROXY_WS_URL: process.env.REMOTE_PROXY_WS_URL || 'ws://192.168.1.69:9978',
  ENABLE_REMOTE: process.env.ENABLE_REMOTE === 'true',
};

