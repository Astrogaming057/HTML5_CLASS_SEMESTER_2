// Preload script for Electron
// This runs in the renderer process before the page loads
// It can expose APIs to the web page

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process
// to use functionality from the Electron main process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
