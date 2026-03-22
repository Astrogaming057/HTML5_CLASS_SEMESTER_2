window.PreviewRemoteConfig = {
  PROXY_BASE: 'http://192.168.1.69:3030',
  STORAGE_TOKEN: 'previewRemoteToken',
  STORAGE_USER: 'previewRemoteUser',
  STORAGE_DEVICE_KEY: 'previewRemoteDeviceKey',
  STORAGE_REGISTERED_DEVICE_ID: 'previewRemoteRegisteredDeviceId',
  STORAGE_MODE: 'previewRemoteMode',
  STORAGE_TARGET_DEVICE_ID: 'previewRemoteTargetDeviceId',
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
