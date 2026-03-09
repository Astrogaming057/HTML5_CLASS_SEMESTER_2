const { exec } = require('child_process');
const logger = require('../utils/logger');

class BrowserLauncher {
  constructor(port) {
    this.port = port;
    this.url = `http://localhost:${port}`;
  }

  launch() {
    const platform = process.platform;
    let command;

    try {
      if (platform === 'win32') {
        command = `start "" "${this.url}"`;
      } else if (platform === 'darwin') {
        command = `open "${this.url}"`;
      } else {
        command = `xdg-open "${this.url}"`;
      }

      logger.info('Launching browser', { url: this.url, platform, command });

      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Failed to launch browser', { error: error.message, stderr });
          return;
        }
        logger.info('Browser launched successfully', { url: this.url });
      });
    } catch (error) {
      logger.error('Error launching browser', error);
    }
  }

  getUrl() {
    return this.url;
  }
}

module.exports = BrowserLauncher;
