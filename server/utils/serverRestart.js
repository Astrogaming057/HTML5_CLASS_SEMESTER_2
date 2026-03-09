const logger = require('./logger');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Restarts the server using the same mechanism as the update restart
 * This spawns a new process and exits the current one
 * Detects if running in app mode or browser mode and restarts accordingly
 */
function restartServer() {
  logger.warn('Server restart initiated');
  
  try {
    const mode = process.env.SERVER_MODE || global.__SERVER_MODE || 'browser';
    const isAppMode = mode === 'app';
    const isWindows = process.platform === 'win32';
    const serverDir = path.join(__dirname, '../..');
    
    logger.info(`Restarting in ${isAppMode ? 'app' : 'browser'} mode`);
    
    if (isWindows) {
      if (isAppMode) {
        // App mode: restart using start-app.bat or Electron
        const startAppBat = path.join(serverDir, 'start-app.bat');
        if (fs.existsSync(startAppBat)) {
          spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'start', '""', startAppBat], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore',
            shell: true
          });
        } else {
          // Fallback: try to start Electron directly
          const appMain = path.join(serverDir, 'app', 'main.js');
          if (fs.existsSync(appMain)) {
            spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'npx', 'electron', appMain], {
              cwd: serverDir,
              detached: true,
              stdio: 'ignore',
              shell: true
            });
          } else {
            logger.error('Cannot restart in app mode: start-app.bat and app/main.js not found');
            return;
          }
        }
      } else {
        // Browser mode: restart using start.bat
        const startBat = path.join(serverDir, 'start.bat');
        if (fs.existsSync(startBat)) {
          spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'start', 'cmd.exe', '/k', startBat], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore',
            shell: true
          });
        } else {
          const serverFile = path.join(__dirname, '../index.js');
          spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'start', 'cmd.exe', '/k', 'cd', '/d', path.join(__dirname, '..'), '&&', 'node', 'index.js'], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore',
            shell: true
          });
        }
      }
    } else {
      // Unix/Linux/Mac
      if (isAppMode) {
        const appMain = path.join(serverDir, 'app', 'main.js');
        if (fs.existsSync(appMain)) {
          const newProcess = spawn('npx', ['electron', appMain], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore'
          });
          newProcess.unref();
        } else {
          logger.error('Cannot restart in app mode: app/main.js not found');
          return;
        }
      } else {
        const serverFile = path.join(__dirname, '../index.js');
        const newProcess = spawn('node', [serverFile], {
          cwd: path.join(__dirname, '..'),
          detached: true,
          stdio: 'ignore'
        });
        newProcess.unref();
      }
    }
    
    // Give the new process time to start, then exit
    setTimeout(() => {
      logger.info(`Restarting server in ${isAppMode ? 'app' : 'browser'} mode...`);
      process.exit(0);
    }, 2000);
  } catch (error) {
    logger.error('Error restarting server', error);
    throw error;
  }
}

module.exports = {
  restartServer
};
