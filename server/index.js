const express = require('express');
const http = require('http');
const config = require('./config');
const { setupFileServer } = require('./routes/fileServer');
const { setupAPI } = require('./routes/api');
const { serveEditor } = require('./routes/editor');
const { setupFileWatcher } = require('./watcher/fileWatcher');
const WebSocketManager = require('./websocket/websocketHandler');
const logger = require('./utils/logger');

// Initialize Express app and HTTP server
const app = express();
app.use(express.json()); // Parse JSON bodies
const server = http.createServer(app);

logger.info('Initializing server...', { port: config.PORT, baseDir: config.BASE_DIR });

// Setup WebSocket manager
const wsManager = new WebSocketManager();
wsManager.setup(server);
logger.info('WebSocket server initialized');

// Setup file watcher
let watcher;
try {
  watcher = setupFileWatcher(
    config.BASE_DIR,
    config.WATCH_OPTIONS,
    (filePath) => {
      logger.debug('File changed detected', { filePath });
      wsManager.notifyFileChange(filePath);
    }
  );
  logger.info('File watcher initialized', { watching: config.BASE_DIR });
} catch (error) {
  logger.error('Failed to initialize file watcher', error);
}

// Setup API routes (before file server to avoid conflicts)
app.use('/__api__', setupAPI(config.BASE_DIR));
logger.info('API routes configured');

// Setup editor route
app.get('/__editor__', async (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).send('No file specified');
    }
    const html = await serveEditor(config.BASE_DIR, filePath);
    res.send(html);
  } catch (error) {
    logger.error('Error serving editor', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Setup file server routes
app.use(setupFileServer(config.BASE_DIR));
logger.info('File server routes configured');

// Start server
server.listen(config.PORT, () => {
  logger.info('Server started successfully', {
    url: `http://localhost:${config.PORT}`,
    baseDir: config.BASE_DIR
  });
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  
  // Close WebSocket connections
  wsManager.close();
  
  // Close file watcher
  if (watcher && typeof watcher.close === 'function') {
    watcher.close();
    logger.info('File watcher closed');
  }
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout if server doesn't close
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
