window.PreviewRemoteConfig = {
  /**
   * Multiple proxy base URLs. The client GETs /api/remote/status on each in parallel and
   * sets PROXY_BASE to the fastest successful response (same logical proxy may be reachable
   * on LAN and public IP).
   * If empty, use PROXY_BASE as a single manual URL (legacy).
   */
  PROXY_CANDIDATES: [/* 'http://192.168.1.69:3030', /*removed local host server/* */ 'http://75.17.59.80:3030'],
  /** Filled by PreviewRemoteAuthApi.ensureProxyBase() — do not set manually when using PROXY_CANDIDATES. */
  PROXY_BASE: '',
  STORAGE_TOKEN: 'previewRemoteToken',
  STORAGE_USER: 'previewRemoteUser',
  STORAGE_DEVICE_KEY: 'previewRemoteDeviceKey',
  STORAGE_REGISTERED_DEVICE_ID: 'previewRemoteRegisteredDeviceId',
  STORAGE_MODE: 'previewRemoteMode',
  STORAGE_TARGET_DEVICE_ID: 'previewRemoteTargetDeviceId',
  STORAGE_TARGET_DEVICE_LABEL: 'previewRemoteTargetDeviceLabel',
  PATHS: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    me: '/api/auth/me',
    devices: '/api/devices',
    registerDevice: '/api/devices/register',
    remoteStatus: '/api/remote/status',
    heartbeat: '/api/devices/heartbeat'
  }
};
