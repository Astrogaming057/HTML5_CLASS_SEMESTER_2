const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// Load hardware acceleration setting
function loadHardwareAccelerationSetting() {
  const configPath = path.join(app.getPath('userData'), 'app-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.useHardwareAcceleration === true;
    }
  } catch (error) {
    console.error('Error loading hardware acceleration setting:', error);
  }
  return true; // Default to enabled
}

// Save hardware acceleration setting
function saveHardwareAccelerationSetting(enabled) {
  const configPath = path.join(app.getPath('userData'), 'app-config.json');
  try {
    const config = { useHardwareAcceleration: enabled };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving hardware acceleration setting:', error);
  }
}

// Apply hardware acceleration setting
const useHardwareAcceleration = loadHardwareAccelerationSetting();
if (!useHardwareAcceleration) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
  app.commandLine.appendSwitch('disable-accelerated-video-encode');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
}



let mainWindow = null;
let serverProcess = null;
const PORT = 3000;
const APP_NAME = 'HTML Class IDE';

// Kill existing processes
function killExistingProcesses(callback) {
  console.log('Checking for existing processes...');

  const currentPid = process.pid;
  const currentPpid = process.ppid;
  console.log(`Current process PID: ${currentPid}, PPID: ${currentPpid}`);

  if (process.platform === 'win32') {
    // Windows: Find and kill process using the port (excluding current process)
    exec(`netstat -ano | findstr :${PORT}`, (error, stdout) => {
      if (stdout) {
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
              pids.add(pid);
            }
          }
        });

        pids.forEach(pid => {
          console.log(`Killing process ${pid} using port ${PORT}...`);
          exec(`taskkill /F /PID ${pid}`, (err) => {
            if (err && !err.message.includes('not found') && !err.message.includes('not running')) {
              console.error(`Error killing process ${pid}:`, err.message);
            }
          });
        });
      }

      // Kill server processes (node index.js with app mode) - excluding current
      exec(`wmic process where "name='node.exe'" get processid,commandline`, (err, stdout) => {
        if (stdout) {
          const lines = stdout.trim().split('\n').filter(line => line.trim() && !line.includes('CommandLine'));
          lines.forEach(line => {
            if ((line.toLowerCase().includes('index.js') || line.toLowerCase().includes('server\\index.js')) &&
              (line.toLowerCase().includes('--app-mode') || line.toLowerCase().includes('app_mode=true'))) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(pid) && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
                console.log(`Killing server process ${pid}...`);
                exec(`taskkill /F /PID ${pid}`, (killErr) => {
                  if (killErr && !killErr.message.includes('not found') && !killErr.message.includes('not running')) {
                    console.error(`Error killing server process ${pid}:`, killErr.message);
                  }
                });
              }
            }
          });
        }

        // Kill any existing Electron processes for this app - excluding current
        exec(`tasklist | findstr electron.exe`, (err2, stdout2) => {
          if (stdout2) {
            const lines = stdout2.trim().split('\n');
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                const pid = parts[1];
                if (pid && !isNaN(pid) && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
                  console.log(`Killing existing Electron process ${pid}...`);
                  exec(`taskkill /F /PID ${pid}`, (killErr) => {
                    if (killErr && !killErr.message.includes('not found') && !killErr.message.includes('not running')) {
                      console.error(`Error killing Electron process ${pid}:`, killErr.message);
                    }
                  });
                }
              }
            });
          }

          // Wait a bit for processes to terminate
          setTimeout(() => {
            if (callback) callback();
          }, 1500);
        });
      });
    });
  } else {
    // Unix/Linux/Mac: Find and kill process using the port (excluding current process)
    exec(`lsof -ti:${PORT}`, (error, stdout) => {
      if (stdout) {
        const pids = stdout.trim().split('\n');
        pids.forEach(pid => {
          if (pid && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
            console.log(`Killing process ${pid} using port ${PORT}...`);
            exec(`kill -9 ${pid}`, (err) => {
              if (err) {
                console.error(`Error killing process ${pid}:`, err.message);
              }
            });
          }
        });
      }

      // Kill server processes (node index.js with app mode) - excluding current
      exec(`pgrep -f "node.*index.js.*--app-mode"`, (err, stdout) => {
        if (stdout) {
          const pids = stdout.trim().split('\n');
          pids.forEach(pid => {
            if (pid && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
              console.log(`Killing server process ${pid}...`);
              exec(`kill -9 ${pid}`, (killErr) => {
                if (killErr) {
                  console.error(`Error killing server process ${pid}:`, killErr.message);
                }
              });
            }
          });
        }

        // Kill any existing Electron processes - excluding current
        exec(`pgrep -f "electron.*app/main.js"`, (err2, stdout2) => {
          if (stdout2) {
            const pids = stdout2.trim().split('\n');
            pids.forEach(pid => {
              if (pid && pid !== currentPid.toString() && pid !== currentPpid.toString()) {
                console.log(`Killing existing Electron process ${pid}...`);
                exec(`kill -9 ${pid}`, (killErr) => {
                  if (killErr) {
                    console.error(`Error killing Electron process ${pid}:`, killErr.message);
                  }
                });
              }
            });
          }

          setTimeout(() => {
            if (callback) callback();
          }, 1500);
        });
      });
    });
  }
}

function createWindow() {
  const useHwAccel = loadHardwareAccelerationSetting();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Disable hardware acceleration in renderer if setting is disabled
      enableBlinkFeatures: useHwAccel ? undefined : '',
      disableBlinkFeatures: useHwAccel ? undefined : 'Accelerated2dCanvas,AcceleratedSmallCanvases,AcceleratedVideoDecode,AcceleratedVideoEncode',
      // Additional remote desktop optimizations
      offscreen: false,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, '..', 'server', 'templates', 'html', 'favicon.ico').replace(/\\/g, '/'),
    title: 'HTML Class IDE',
    backgroundColor: '#1e1e1e',
    show: false, // Don't show until ready to prevent flicker
    autoHideMenuBar: true // Hide the menu bar (File, Edit, View, etc.)
  });

  // Show window when ready to prevent remote desktop issues
  // Add a small delay to ensure everything is initialized
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }, 100);
  });

  // Completely remove the menu bar
  mainWindow.setMenuBarVisibility(false);

  // Prevent window from being minimized/maximized during remote desktop
  mainWindow.on('will-move', (event) => {
    // Allow window movement but prevent issues
  });

  // Handle remote desktop specific issues
  mainWindow.on('blur', () => {
    // Window lost focus - this is normal in remote desktop
  });

  // Start the server
  startServer();

  // Load the preview interface once server is ready
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.loadURL(`http://localhost:${PORT}/__preview__?file=start.bat`);
    }
  }, 2000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');

  const spawnOptions = {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      APP_MODE: 'true',
      SERVER_MODE: 'app'
    },
    windowsHide: true, // Hide console window on Windows
    detached: false
  };

  // Use spawn with windowsHide - this should hide the console window on Windows
  // Pass --app-mode flag to indicate app mode
  serverProcess = spawn('node', [serverPath, '--app-mode'], spawnOptions);

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server] ${output}`);

    // Check if server is ready
    if (output.includes('Server started successfully')) {
      if (mainWindow && !mainWindow.webContents.getURL().includes('localhost')) {
        mainWindow.loadURL(`http://localhost:${PORT}/__preview__?file=start.bat`);
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`[Server] Process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      // Server crashed, try to restart after a delay
      setTimeout(() => {
        if (mainWindow) {
          startServer();
        }
      }, 3000);
    }
  });

  serverProcess.on('error', (error) => {
    console.error(`[Server] Failed to start: ${error.message}`);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Restart the app using start-app.vbs
function restartApp() {
  const isWindows = process.platform === 'win32';
  const appDir = path.join(__dirname, '..');

  if (isWindows) {
    const startAppVbs = path.join(appDir, 'start-app.vbs');
    if (fs.existsSync(startAppVbs)) {
      // Spawn start-app.vbs in detached mode
      spawn('wscript.exe', [startAppVbs], {
        cwd: appDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });

      // Give it time to start, then quit
      setTimeout(() => {
        app.quit();
      }, 1000);
    } else {
      console.error('start-app.vbs not found');
    }
  } else {
    const appMain = path.join(__dirname, 'main.js');
    const newProcess = spawn('npx', ['electron', appMain], {
      cwd: appDir,
      detached: true,
      stdio: 'ignore'
    });
    newProcess.unref();

    setTimeout(() => {
      app.quit();
    }, 1000);
  }
}

// IPC handlers
ipcMain.handle('get-hardware-acceleration', () => {
  return loadHardwareAccelerationSetting();
});

ipcMain.handle('set-hardware-acceleration', async (event, enabled) => {
  saveHardwareAccelerationSetting(enabled);
  return { success: true };
});

ipcMain.handle('restart-app', async () => {
  restartApp();
  return { success: true };
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, focus it and quit
  console.log('Another instance is already running. Exiting...');
  app.quit();
} else {
  // Kill existing processes before starting
  killExistingProcesses(() => {
    app.whenReady().then(() => {
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });

    // Handle second instance - focus the existing window
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  });
}

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// Handle app termination
process.on('SIGINT', () => {
  stopServer();
  app.quit();
});

process.on('SIGTERM', () => {
  stopServer();
  app.quit();
});
