const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// Get app data path - use Local AppData consistently for both packaged and dev
function getAppDataPath() {
  // Always use Local AppData with "Astro Code" folder for consistency
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
  const appDataPath = path.join(localAppData, "Astro Code");
  
  // Ensure directory exists
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  
  // Migration: If old Electron config exists and new one doesn't, copy it
  if (!app.isPackaged) {
    const oldConfigPath = app.getPath('userData');
    const oldConfigFile = path.join(oldConfigPath, 'app-config.json');
    const newConfigFile = path.join(appDataPath, 'app-config.json');
    
    if (fs.existsSync(oldConfigFile) && !fs.existsSync(newConfigFile)) {
      try {
        console.log(`[Config] Migrating config from ${oldConfigFile} to ${newConfigFile}`);
        const oldConfig = JSON.parse(fs.readFileSync(oldConfigFile, 'utf8'));
        fs.writeFileSync(newConfigFile, JSON.stringify(oldConfig, null, 2), 'utf8');
        console.log(`[Config] Config migrated successfully`);
      } catch (error) {
        console.error(`[Config] Error migrating config:`, error);
      }
    }
  }
  
  return appDataPath;
}

// Load hardware acceleration setting
function loadHardwareAccelerationSetting() {
  try {
    const appDataPath = getAppDataPath();
    const configPath = path.join(appDataPath, 'app-config.json');
    
    console.log(`[Config] Loading from: ${configPath}`);
    console.log(`[Config] File exists: ${fs.existsSync(configPath)}`);
    
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      console.log(`[Config] File content: ${fileContent}`);
      const config = JSON.parse(fileContent);
      console.log(`[Config] Parsed config:`, JSON.stringify(config, null, 2));
      
      // Check if the setting exists and is explicitly set
      if ('useHardwareAcceleration' in config) {
        const value = config.useHardwareAcceleration === true;
        console.log(`[Config] Hardware acceleration value from config: ${value} (raw: ${config.useHardwareAcceleration})`);
        return value;
      } else {
        console.log(`[Config] useHardwareAcceleration key not found in config, defaulting to true`);
      }
    } else {
      console.log(`[Config] Config file does not exist, defaulting to true`);
    }
  } catch (error) {
    console.error('[Config] Error loading hardware acceleration setting:', error);
    console.error('[Config] Error stack:', error.stack);
  }
  console.log(`[Config] Returning default: true`);
  return true; // Default to enabled
}

// Save hardware acceleration setting
function saveHardwareAccelerationSetting(enabled) {
  const configPath = path.join(getAppDataPath(), 'app-config.json');
  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const config = loadAppConfig();
    config.useHardwareAcceleration = enabled === true; // Ensure boolean
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`[Config] Hardware acceleration setting saved: ${enabled}`);
  } catch (error) {
    console.error('Error saving hardware acceleration setting:', error);
  }
}

// Load app config
function loadAppConfig() {
  const configPath = path.join(getAppDataPath(), 'app-config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading app config:', error);
  }
  return {};
}

// Save app config
function saveAppConfig(config) {
  const configPath = path.join(getAppDataPath(), 'app-config.json');
  try {
    const currentConfig = loadAppConfig();
    const updatedConfig = { ...currentConfig, ...config };
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving app config:', error);
  }
}

// Get working directory
function getWorkingDirectory() {
  const config = loadAppConfig();
  if (config.workingDirectory) {
    // Resolve to absolute path and verify it exists
    const resolvedPath = path.resolve(config.workingDirectory);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    } else {
      console.warn(`[App] Saved working directory does not exist: ${resolvedPath}`);
    }
  }
  return null;
}

// Select working directory
async function selectWorkingDirectory() {
  const result = await dialog.showOpenDialog(mainWindow || null, {
    properties: ['openDirectory'],
    title: 'Select Working Directory',
    buttonLabel: 'Select'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    // Verify the directory exists and is accessible
    if (!fs.existsSync(selectedPath)) {
      dialog.showErrorBox('Invalid Directory', 'The selected directory does not exist.');
      return null;
    }
    
    try {
      // Test if we can read the directory
      await fs.promises.access(selectedPath, fs.constants.R_OK);
    } catch (error) {
      dialog.showErrorBox('Access Denied', 'Cannot access the selected directory. Please choose a different directory.');
      return null;
    }
    
    saveAppConfig({ workingDirectory: selectedPath });
    console.log(`[App] Working directory saved: ${selectedPath}`);
    
    // Verify it was saved
    const saved = getWorkingDirectory();
    if (saved !== selectedPath) {
      console.error(`[App] Warning: Directory save mismatch. Expected: ${selectedPath}, Got: ${saved}`);
    }
    
    return selectedPath;
  }
  return null;
}

// Apply hardware acceleration setting
// Note: This must be called before app.whenReady()
// We'll load it again in createWindow to ensure we have the latest value
let useHardwareAcceleration = loadHardwareAccelerationSetting();
console.log(`[Config] Initial hardware acceleration setting: ${useHardwareAcceleration}`);

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
  console.log('[Config] Hardware acceleration disabled via command line switches');
} else {
  console.log('[Config] Hardware acceleration enabled (default)');
}



let mainWindow = null;
let serverProcess = null;
const PORT = 3000;
const APP_NAME = "Astro Code";

/** When true, BrowserWindow `close` is allowed to proceed (no preventDefault). */
let allowMainWindowClose = false;
let closeHangTimer = null;
/** Last progress line from renderer — shown if close watchdog fires. */
let lastCloseProgress = 'idle';

function clearMainWindowCloseHangTimer() {
  if (closeHangTimer) {
    clearTimeout(closeHangTimer);
    closeHangTimer = null;
  }
}

function scheduleMainWindowCloseHangWatchdog() {
  clearMainWindowCloseHangTimer();
  closeHangTimer = setTimeout(async () => {
    const win = mainWindow;
    if (!win || win.isDestroyed() || allowMainWindowClose) {
      return;
    }
    try {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Close is taking longer than expected',
        message: 'Astro Code has not finished closing yet.',
        detail:
          `Latest step:\n• ${lastCloseProgress}\n\n` +
          'Common causes: a confirmation dialog hidden behind this window, saving, WebSocket teardown, or the local server stopping.\n\n' +
          'Wait longer gives the app more time. Force exit may lose unsaved work.',
        buttons: ['Wait longer', 'Force exit'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (response === 1) {
        allowMainWindowClose = true;
        clearMainWindowCloseHangTimer();
        stopServer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
        app.quit();
      } else {
        scheduleMainWindowCloseHangWatchdog();
      }
    } catch (e) {
      console.error('[Close] hang watchdog dialog failed', e);
      scheduleMainWindowCloseHangWatchdog();
    }
  }, 15000);
}

function attachMainWindowCloseInterceptor(win) {
  if (!win) return;
  allowMainWindowClose = false;
  win.on('close', (e) => {
    if (allowMainWindowClose) {
      return;
    }
    e.preventDefault();
    lastCloseProgress = 'Waiting for editor process…';
    clearMainWindowCloseHangTimer();
    scheduleMainWindowCloseHangWatchdog();
    try {
      if (!win.isDestroyed()) {
        win.webContents.send('electron-app-close-request', { ts: Date.now() });
      }
    } catch (err) {
      console.error('[Close] failed to notify renderer', err);
    }
  });
}

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
  // Set app name to ensure proper AppData folder
  if (app.isPackaged) {
    app.setName("Astro Code");
  }
  
  // Reload hardware acceleration setting to ensure we have the latest value
  const useHwAccel = loadHardwareAccelerationSetting();
  console.log(`[Config] Hardware acceleration setting in createWindow: ${useHwAccel}`);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    /** Custom HTML title bar (see PreviewElectronTitleBar); native min/max/close removed. */
    frame: false,
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
    icon: path.join(__dirname, '..', 'build', 'icon.ico').replace(/\\/g, '/'),
    title: "Astro Code",
    backgroundColor: '#1e1e1e',
    show: false, // Don't show until ready to prevent flicker
    autoHideMenuBar: true // Hide the menu bar (File, Edit, View, etc.)
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('window-chrome-state', { maximized: true });
      } catch (_e) {
        /* ignore */
      }
    }
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('window-chrome-state', { maximized: false });
      } catch (_e) {
        /* ignore */
      }
    }
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
  
  // Setup zoom keyboard shortcuts (Ctrl+ and Ctrl-)
  setupZoomShortcuts(mainWindow);

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

  // Don't load URL here - wait for server to be ready
  // The server will trigger the loadURL when it's ready

  mainWindow.on('closed', () => {
    mainWindow = null;
    allowMainWindowClose = false;
    clearMainWindowCloseHangTimer();
  });

  attachMainWindowCloseInterceptor(mainWindow);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function setupZoomShortcuts(window) {
  // Handle zoom keyboard shortcuts
  window.webContents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    
    // Zoom in: Ctrl+Plus, Ctrl+Equal, or Ctrl+NumpadAdd
    if (input.key === '=' || input.code === 'Equal' || input.code === 'NumpadAdd') {
      event.preventDefault();
      const currentZoom = window.webContents.getZoomLevel();
      window.webContents.setZoomLevel(currentZoom + 0.5);
      return;
    }
    
    // Zoom out: Ctrl+Minus or Ctrl+NumpadSubtract
    if (input.key === '-' || input.code === 'Minus' || input.code === 'NumpadSubtract') {
      event.preventDefault();
      const currentZoom = window.webContents.getZoomLevel();
      window.webContents.setZoomLevel(currentZoom - 0.5);
      return;
    }
    
    // Zoom reset: Ctrl+0
    if (input.key === '0') {
      event.preventDefault();
      window.webContents.setZoomLevel(0);
      return;
    }
  });
}

function startServer() {
  // Get the correct path for both development and packaged app
  let appPath, serverPath;
  
  if (app.isPackaged) {
    // In packaged app, unpacked files are in resources/app.asar.unpacked
    appPath = process.resourcesPath || path.dirname(process.execPath);
    // Server files are unpacked from asar, so they're accessible
    serverPath = path.join(appPath, 'app.asar.unpacked', 'server', 'index.js');
    
    // Fallback if unpacked path doesn't exist
    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(appPath, 'app', 'server', 'index.js');
    }
  } else {
    // Development mode
    appPath = path.join(__dirname, '..');
    serverPath = path.join(__dirname, '..', 'server', 'index.js');
  }

  // Get working directory - use selected directory if available, otherwise default
  let workingDir;
  const selectedDir = getWorkingDirectory();
  
  if (selectedDir && fs.existsSync(selectedDir)) {
    // Use saved working directory (works in both dev and packaged mode)
    workingDir = selectedDir;
    console.log(`[Server] Using selected working directory: ${workingDir}`);
  } else if (app.isPackaged) {
    // Default to user's Documents folder for packaged app
    workingDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents');
    console.log(`[Server] Using default working directory: ${workingDir}`);
  } else {
    // Development mode - use project root
    workingDir = path.join(__dirname, '..');
    console.log(`[Server] Using development working directory: ${workingDir}`);
  }

  // Always use system Node.js (user must have Node.js installed)
  // Alternatively, you could bundle Node.js, but that increases size significantly
  const nodePath = 'node';

  const spawnOptions = {
    cwd: workingDir, // Use selected working directory
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      APP_MODE: 'true',
      SERVER_MODE: 'app',
      BASE_DIR: path.resolve(workingDir), // Pass working directory to server (resolve to absolute path)
      PATH: process.env.PATH // Ensure system PATH is available for node
    },
    windowsHide: true, // Hide console window on Windows
    detached: false
  };
  
  console.log(`[Server] Starting server with BASE_DIR: ${spawnOptions.env.BASE_DIR}`);
  console.log(`[Server] Working directory (cwd): ${workingDir}`);

  // Use spawn with windowsHide - this should hide the console window on Windows
  // Pass --app-mode flag to indicate app mode
  serverProcess = spawn(nodePath, [serverPath, '--app-mode'], spawnOptions);

  let serverReady = false;
  let loadURLAttempted = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server] ${output}`);

    // Check if server is ready (look for various success messages)
    if (!serverReady && (
      output.includes('Server started successfully') || 
      output.includes('Server listening') ||
      output.includes('listening on port') ||
      output.includes(`Port ${PORT}`)
    )) {
      serverReady = true;
      console.log('[App] Server is ready, loading window...');
      
      // Wait a moment for server to fully initialize, then load URL
      setTimeout(() => {
        loadWindowWhenReady();
      }, 500);
    }
    
    // Log BASE_DIR from server output if available
    if (output.includes('BASE_DIR') || output.includes('baseDir')) {
      console.log(`[Server Output] ${output.trim()}`);
    }
  });
  
  // Function to load window with retry logic
  function loadWindowWhenReady() {
    if (loadURLAttempted) return; // Already loaded or attempting
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    // Check if already loaded
    const currentURL = mainWindow.webContents.getURL();
    if (currentURL && currentURL.includes('localhost')) {
      loadURLAttempted = true;
      return;
    }
    
    loadURLAttempted = true;
    
    // Try to load the URL
    const url = `http://localhost:${PORT}/__preview__?file=start.bat`;
    console.log(`[App] Attempting to load: ${url}`);
    
    // First, verify server is actually responding
    checkServerHealth(url, 0);
  }
  
  // Check server health with retries
  function checkServerHealth(url, retryCount) {
    const maxRetries = 10;
    const retryDelay = 500; // 500ms between retries
    
    if (retryCount >= maxRetries) {
      console.error('[App] Server health check failed after max retries');
      // Load anyway - might work
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url).catch(err => {
          console.error('[App] Failed to load URL:', err);
          // Retry loading after a delay
          setTimeout(() => {
            loadURLAttempted = false;
            if (serverReady) {
              loadWindowWhenReady();
            }
          }, 2000);
        });
      }
      return;
    }
    
    // Use http module to check if server is responding
    const healthCheckUrl = `http://localhost:${PORT}/__api__/mode`;
    
    const req = http.get(healthCheckUrl, (res) => {
      if (res.statusCode === 200) {
        console.log('[App] Server is responding, loading window...');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(url).catch(err => {
            console.error('[App] Failed to load URL:', err);
          });
        }
      } else {
        // Server responded but with error, retry
        setTimeout(() => checkServerHealth(url, retryCount + 1), retryDelay);
      }
    });
    
    req.on('error', (err) => {
      // Server not ready yet, retry
      if (retryCount < maxRetries - 1) {
        setTimeout(() => checkServerHealth(url, retryCount + 1), retryDelay);
      } else {
        // Last attempt - try loading anyway
        console.warn('[App] Server health check failed, loading anyway...');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(url).catch(err => {
            console.error('[App] Failed to load URL:', err);
          });
        }
      }
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      // Timeout - retry
      if (retryCount < maxRetries - 1) {
        setTimeout(() => checkServerHealth(url, retryCount + 1), retryDelay);
      }
    });
  }

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`[Server] Process exited with code ${code}`);
    // crash.server test command uses exit 42 — do not auto-restart (otherwise it looks like nothing happened)
    if (code === 42) {
      console.log('[Server] Exit code 42 (crash.server test): not auto-restarting.');
      return;
    }
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
    console.log('[Server] Stopping server process...');
    try {
      // Try graceful shutdown first
      serverProcess.kill('SIGTERM');
      
      // Force kill after 2 seconds if still running
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          console.log('[Server] Force killing server process...');
          serverProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (error) {
      console.error('[Server] Error stopping server:', error);
      try {
        serverProcess.kill('SIGKILL');
      } catch (e) {
        // Ignore errors
      }
    }
    serverProcess = null;
  }
}

// Restart the app using start-app.vbs
function restartApp() {
  const isWindows = process.platform === 'win32';
  
  if (app.isPackaged) {
    // For packaged app, restart using the executable
    const exePath = process.execPath;
    spawn(exePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    
    // Give it time to start, then quit
    setTimeout(() => {
      app.quit();
    }, 1000);
  } else {
    // Development mode - use start-app.vbs or electron
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
}

// IPC handlers
ipcMain.handle('get-hardware-acceleration', () => {
  const value = loadHardwareAccelerationSetting();
  console.log(`[IPC] get-hardware-acceleration: ${value}`);
  return value;
});

ipcMain.handle('set-hardware-acceleration', async (event, enabled) => {
  console.log(`[IPC] set-hardware-acceleration: ${enabled}`);
  saveHardwareAccelerationSetting(enabled);
  // Verify it was saved
  const saved = loadHardwareAccelerationSetting();
  console.log(`[IPC] Hardware acceleration setting saved and verified: ${saved}`);
  return { success: true, saved: saved };
});

ipcMain.handle('restart-app', async () => {
  restartApp();
  return { success: true };
});

ipcMain.on('electron-close-progress', (_event, stage) => {
  lastCloseProgress = typeof stage === 'string' && stage ? stage : 'unknown';
  console.log('[Close] progress:', lastCloseProgress);
});

ipcMain.on('electron-close-ready', () => {
  lastCloseProgress = 'Renderer finished — closing…';
  clearMainWindowCloseHangTimer();
  allowMainWindowClose = true;
  stopServer();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on('electron-close-aborted', () => {
  lastCloseProgress = 'Close canceled in editor';
  clearMainWindowCloseHangTimer();
});

ipcMain.on('electron-force-close', () => {
  console.log('[Close] force exit requested from renderer');
  allowMainWindowClose = true;
  clearMainWindowCloseHangTimer();
  lastCloseProgress = 'Force exit (renderer)';
  try {
    stopServer();
  } catch (e) {
    console.error('[Close] stopServer during force close', e);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});

ipcMain.handle('get-working-directory', () => {
  return getWorkingDirectory();
});

ipcMain.handle('select-working-directory', async () => {
  const selectedPath = await selectWorkingDirectory();
  if (selectedPath) {
    // Directory is saved, but requires full app restart to take effect
    // Return success - the UI will show restart prompt
    return { success: true, path: selectedPath, requiresRestart: true };
  }
  return { success: false };
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { maximized: false };
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return { maximized: mainWindow.isMaximized() };
});

ipcMain.handle('window-is-maximized', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  return mainWindow.isMaximized();
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
    app.whenReady().then(async () => {
      // If packaged and no working directory is set, prompt user
      // Also allow setting in development mode for testing
      if (app.isPackaged && !getWorkingDirectory()) {
        const selectedPath = await selectWorkingDirectory();
        if (!selectedPath) {
          // User cancelled, use default
          console.log('No working directory selected, using default');
        }
      }
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
