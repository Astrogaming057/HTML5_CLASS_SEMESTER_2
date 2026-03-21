const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const { setupFileServer } = require('./routes/fileServer');
const { setupAPI, setWebSocketManager } = require('./routes/api');
const { setupEditorRoutes } = require('./routes/editor');
const { setupPreviewRoutes, setupPreviewContentRoutes, setupPreviewResourceRoutes } = require('./routes/preview');
const popoutsRouter = require('./routes/popouts');
const { setupFileWatcher } = require('./watcher/fileWatcher');
const WebSocketManager = require('./websocket/websocketHandler');
const AutoLauncher = require('./browser/autoLauncher');
const { setupStatusRoutes } = require('./templates/status/statusHandler');
const logger = require('./utils/logger');
const { cleanupCache } = require('./utils/cacheCleanup');
const ServerCommands = require('./utils/serverCommands');

// Detect mode: check for APP_MODE environment variable or if running from Electron
// Defaults to 'browser' mode if not specified
const isAppMode = process.env.APP_MODE === 'true' || process.env.SERVER_MODE === 'app' || 
                  process.argv.includes('--app-mode') || 
                  (process.env.npm_package_name && process.env.npm_package_name.includes('electron')) ||
                  process.execPath.includes('electron');

const serverMode = isAppMode ? 'app' : 'browser';

// Set mode flag
process.env.SERVER_MODE = serverMode;
global.__SERVER_MODE = serverMode;

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

if (config.DEBUG) {
  global.__HTMLCLASS_DEBUG__ = true;
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.http(req.method, req.originalUrl || req.url, res.statusCode, Date.now() - start);
    });
    next();
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('unhandledRejection', err);
  });
  logger.info('HTMLCLASS_DEBUG: verbose HTTP logging and process error hooks enabled');
} else {
  global.__HTMLCLASS_DEBUG__ = false;
}

const server = http.createServer(app);

logger.info(`Initializing server (${serverMode} mode)...`, { port: config.PORT, baseDir: config.BASE_DIR, mode: serverMode, debug: !!config.DEBUG });

const wsManager = new WebSocketManager();
const serverCommands = new ServerCommands(wsManager, server, config.BASE_DIR);
wsManager.setServerCommands(serverCommands);
wsManager.setup(server);
logger.setWebSocketManager(wsManager);
logger.info('WebSocket server initialized');
let watcher;
try {
  watcher = setupFileWatcher(
    config.BASE_DIR,
    config.WATCH_OPTIONS,
    (filePath, eventType) => {
      logger.debug('File event detected', { filePath, eventType });
      wsManager.notifyFileChange(filePath, eventType);
    }
  );
  logger.info('File watcher initialized', { watching: config.BASE_DIR });
} catch (error) {
  logger.error('Failed to initialize file watcher', error);
}

let serverWatcher;
try {
  const serverDir = path.join(__dirname);
  serverWatcher = setupFileWatcher(
    serverDir,
    { ...config.WATCH_OPTIONS, ignored: /(^|[\/\\])(node_modules|\.git)([\/\\]|$)/ },
    (filePath, eventType) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.json')) {
        logger.info('Server file changed', { filePath, eventType });
        wsManager.broadcast({
          type: 'serverUpdateAvailable',
          filePath: filePath,
          eventType: eventType
        });
      }
    }
  );
  logger.info('Server file watcher initialized', { watching: serverDir });
} catch (error) {
  logger.error('Failed to initialize server file watcher', error);
}

app.use('/__api__', setupAPI(config.BASE_DIR));
setWebSocketManager(wsManager);
logger.info('API routes configured');

app.use('/__editor__', setupEditorRoutes(config.BASE_DIR));
logger.info('Editor routes configured');

app.use('/__preview__', setupPreviewRoutes(config.BASE_DIR));
logger.info('Preview routes configured');

app.use('/__preview-content__', setupPreviewContentRoutes(config.BASE_DIR, wsManager));
logger.info('Preview content routes configured');

app.use('/__preview-resource__', setupPreviewResourceRoutes(config.BASE_DIR));
logger.info('Preview resource routes configured');

app.use('/__popout__', popoutsRouter);
logger.info('Popout routes configured');

setupStatusRoutes(app);

app.use(setupFileServer(config.BASE_DIR));
logger.info('File server routes configured');

server.listen(config.PORT, () => {
  logger.info(`Server started successfully (${serverMode} mode)`, {
    url: `http://localhost:${config.PORT}`,
    baseDir: config.BASE_DIR,
    mode: serverMode
  });

  // Only setup auto-launcher in browser mode
  if (serverMode === 'browser') {
    const autoLauncher = new AutoLauncher(config.PORT, wsManager);
    autoLauncher.setup();
  } else {
    logger.info('Auto-launcher disabled (app mode)');
  }
  
  // Start cache cleanup interval (every 30 seconds)
  logger.info('Starting cache cleanup scheduler (every 30 seconds)');
  const cleanupInterval = setInterval(async () => {
    try {
      await cleanupCache(config.BASE_DIR, wsManager);
    } catch (error) {
      logger.error('Cache cleanup interval error', error);
    }
  }, 30000); // 30 seconds
  
  // Run initial cleanup after 5 seconds
  const initialCleanupTimeout = setTimeout(async () => {
    try {
      logger.info('Running initial cache cleanup');
      await cleanupCache(config.BASE_DIR, wsManager);
    } catch (error) {
      logger.error('Initial cache cleanup error', error);
    }
  }, 5000);
  
  // Store cleanup interval for shutdown
  global.__cleanupInterval = cleanupInterval;
  global.__initialCleanupTimeout = initialCleanupTimeout;
  
  // Notify Electron that server is ready (if running in app mode)
  if (serverMode === 'app' && process.send) {
    process.send({ type: 'server-ready', port: config.PORT });
  }
});

const shutdown = () => {
  logger.info('Shutting down gracefully...');
  
  // Clear cleanup intervals
  if (global.__cleanupInterval) {
    clearInterval(global.__cleanupInterval);
    logger.info('Cache cleanup interval cleared');
  }
  if (global.__initialCleanupTimeout) {
    clearTimeout(global.__initialCleanupTimeout);
  }
  
  wsManager.close();
  
  if (watcher && typeof watcher.close === 'function') {
    watcher.close();
    logger.info('File watcher closed');
  }
  if (serverWatcher && typeof serverWatcher.close === 'function') {
    serverWatcher.close();
    logger.info('Server file watcher closed');
  }
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.warn('Forcing exit after timeout');
    process.exit(0);
  }, 5000);
};

process.on('SIGINT', () => {
  logger.info('Received SIGINT');
  shutdown();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM');
  shutdown();
});

// Handle messages from Electron main process (app mode only)
if (serverMode === 'app') {
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      shutdown();
    }
  });
}
