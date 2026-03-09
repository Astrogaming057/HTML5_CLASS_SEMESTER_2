const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');

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
      
      // Kill server processes (node index-app.js or node server/index-app.js) - excluding current
      exec(`wmic process where "name='node.exe'" get processid,commandline`, (err, stdout) => {
        if (stdout) {
          const lines = stdout.trim().split('\n').filter(line => line.trim() && !line.includes('CommandLine'));
          lines.forEach(line => {
            if (line.toLowerCase().includes('index-app.js') || line.toLowerCase().includes('server\\index-app.js')) {
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
      
      // Kill server processes (node index-app.js) - excluding current
      exec(`pgrep -f "node.*index-app.js"`, (err, stdout) => {
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'server', 'templates', 'html', 'favicon.ico').replace(/\\/g, '/'),
    title: 'HTML Class IDE'
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
  const serverPath = path.join(__dirname, '..', 'server', 'index-app.js');
  
  const spawnOptions = {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
    windowsHide: true, // Hide console window on Windows
    detached: false
  };
  
  // Use spawn with windowsHide - this should hide the console window on Windows
  serverProcess = spawn('node', [serverPath], spawnOptions);

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
