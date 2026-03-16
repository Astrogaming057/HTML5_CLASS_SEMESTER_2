// Preload script for Electron
// This runs in the renderer process before the page loads
// It can expose APIs to the web page

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to use functionality from the Electron main process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  mode: 'app',
  getHardwareAcceleration: () => ipcRenderer.invoke('get-hardware-acceleration'),
  setHardwareAcceleration: (enabled) => ipcRenderer.invoke('set-hardware-acceleration', enabled),
  getWorkingDirectory: () => ipcRenderer.invoke('get-working-directory'),
  selectWorkingDirectory: () => ipcRenderer.invoke('select-working-directory'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getRemoteConfig: () => ipcRenderer.invoke('get-remote-config'),
  setRemoteConfig: (config) => ipcRenderer.invoke('set-remote-config', config)
});
