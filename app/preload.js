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
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeToggleWindow: () => ipcRenderer.invoke('window-maximize-toggle'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowChromeState: (fn) => {
    ipcRenderer.on('window-chrome-state', (_event, state) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  },
  /** Main process asks renderer to run close checks before exiting */
  onAppCloseRequest: (fn) => {
    ipcRenderer.on('electron-app-close-request', (_event, payload) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(e);
      }
    });
  },
  sendCloseReady: () => ipcRenderer.send('electron-close-ready'),
  sendCloseAborted: () => ipcRenderer.send('electron-close-aborted'),
  sendCloseProgress: (stage) => ipcRenderer.send('electron-close-progress', stage)
});
