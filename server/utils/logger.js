class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
    this.wsManager = null;
  }
  
  setWebSocketManager(wsManager) {
    this.wsManager = wsManager;
  }
  
  broadcastLog(level, message, meta = {}) {
    if (this.wsManager) {
      this.wsManager.broadcast({
        type: 'serverLog',
        level: level.toLowerCase(),
        message: message,
        meta: meta,
        timestamp: new Date().toISOString()
      });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('INFO', message, meta);
    console.log(`${this.colors.cyan}${formatted}${this.colors.reset}`);
    this.broadcastLog('info', message, meta);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('WARN', message, meta);
    console.log(`${this.colors.yellow}${formatted}${this.colors.reset}`);
    this.broadcastLog('warn', message, meta);
  }

  error(message, error = {}) {
    const meta = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : error;
    const formatted = this.formatMessage('ERROR', message, meta);
    console.error(`${this.colors.red}${formatted}${this.colors.reset}`);
    this.broadcastLog('error', message, meta);
  }

  debug(message, meta = {}) {
    const formatted = this.formatMessage('DEBUG', message, meta);
    console.log(`${this.colors.dim}${formatted}${this.colors.reset}`);
  }

  http(method, path, statusCode, responseTime = null) {
    const meta = { method, path, statusCode };
    if (responseTime !== null) {
      meta.responseTime = `${responseTime}ms`;
    }
    const color = statusCode >= 500 ? this.colors.red 
                 : statusCode >= 400 ? this.colors.yellow 
                 : statusCode >= 300 ? this.colors.blue 
                 : this.colors.green;
    const formatted = this.formatMessage('HTTP', `${method} ${path} - ${statusCode}`, 
      responseTime !== null ? { responseTime: `${responseTime}ms` } : {});
    console.log(`${color}${formatted}${this.colors.reset}`);
  }
}

module.exports = new Logger();
