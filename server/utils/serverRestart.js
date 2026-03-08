const logger = require('./logger');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Restarts the server using the same mechanism as the update restart
 * This spawns a new process and exits the current one
 */
function restartServer() {
  logger.warn('Server restart initiated');
  
  try {
    const isWindows = process.platform === 'win32';
    const serverDir = path.join(__dirname, '../..');
    const serverFile = path.join(__dirname, '../index.js');
    
    if (isWindows) {
      const startBat = path.join(serverDir, 'start.bat');
      if (fs.existsSync(startBat)) {
        spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'start', 'cmd.exe', '/k', startBat], {
          cwd: serverDir,
          detached: true,
          stdio: 'ignore',
          shell: true
        });
      } else {
        const serverPath = path.join(__dirname, '..');
        spawn('cmd.exe', ['/c', 'timeout', '/t', '2', '/nobreak', '>', 'nul', '&&', 'start', 'cmd.exe', '/k', 'cd', '/d', serverPath, '&&', 'node', 'index.js'], {
          cwd: serverDir,
          detached: true,
          stdio: 'ignore',
          shell: true
        });
      }
    } else {
      const newProcess = spawn('node', [serverFile], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: 'ignore'
      });
      newProcess.unref();
    }
    
    // Give the new process time to start, then exit
    setTimeout(() => {
      logger.info('Restarting server...');
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
