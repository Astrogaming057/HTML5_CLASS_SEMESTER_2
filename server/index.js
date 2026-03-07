const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const { setupFileServer } = require('./routes/fileServer');
const { setupAPI, setWebSocketManager } = require('./routes/api');
const { setupEditorRoutes } = require('./routes/editor');
const { setupPreviewRoutes, setupPreviewContentRoutes } = require('./routes/preview');
const popoutsRouter = require('./routes/popouts');
const { setupFileWatcher } = require('./watcher/fileWatcher');
const WebSocketManager = require('./websocket/websocketHandler');
const AutoLauncher = require('./browser/autoLauncher');
const { setupStatusRoutes } = require('./templates/status/statusHandler');
const logger = require('./utils/logger');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
const server = http.createServer(app);

logger.info('Initializing server...', { port: config.PORT, baseDir: config.BASE_DIR });

const wsManager = new WebSocketManager();
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

app.use('/__popout__', popoutsRouter);
logger.info('Popout routes configured');

setupStatusRoutes(app);

app.use(setupFileServer(config.BASE_DIR));
logger.info('File server routes configured');

server.listen(config.PORT, () => {
  logger.info('Server started successfully', {
    url: `http://localhost:${config.PORT}`,
    baseDir: config.BASE_DIR
  });

  const autoLauncher = new AutoLauncher(config.PORT, wsManager);
  autoLauncher.setup();
});

const shutdown = () => {
  logger.info('Shutting down gracefully...');
  
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
