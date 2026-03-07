const ConnectionTracker = require('./connectionTracker');
const BrowserLauncher = require('./browserLauncher');
const logger = require('../utils/logger');

class AutoLauncher {
  constructor(port, wsManager) {
    this.port = port;
    this.wsManager = wsManager;
    this.connectionTracker = new ConnectionTracker();
    this.launchTimer = null;
    this.launched = false;
    this.browserLauncher = new BrowserLauncher(port);
    this.delay = 5000;
  }

  setup() {
    this.setupWebSocketListener();
    this.startLaunchTimer();
    logger.info('Auto-launcher initialized', { 
      delay: this.delay, 
      url: this.browserLauncher.getUrl() 
    });
  }

  setupWebSocketListener() {
    if (!this.wsManager) {
      logger.warn('WebSocket manager not available for auto-launcher');
      return;
    }

    this.wsManager.onConnection(() => {
      this.connectionTracker.markConnected();
      this.cancelLaunchTimer();
      logger.debug('WebSocket connection detected, auto-launch cancelled');
    });
  }

  startLaunchTimer() {
    this.launchTimer = setTimeout(() => {
      if (!this.connectionTracker.hasActiveConnection() && !this.launched) {
        this.launchBrowser();
      }
    }, this.delay);
  }

  cancelLaunchTimer() {
    if (this.launchTimer) {
      clearTimeout(this.launchTimer);
      this.launchTimer = null;
      logger.debug('Auto-launch timer cancelled');
    }
  }

  launchBrowser() {
    if (this.launched) {
      return;
    }

    this.launched = true;
    this.cancelLaunchTimer();
    logger.info('Auto-launching browser (no WebSocket connections detected)', {
      url: this.browserLauncher.getUrl(),
      delay: this.delay
    });
    this.browserLauncher.launch();
  }

  destroy() {
    this.cancelLaunchTimer();
  }
}

module.exports = AutoLauncher;
