const express = require('express');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const { setupFileServer } = require('./routes/fileServer');
const { setupAPI, setWebSocketManager } = require('./routes/api');
const { serveEditor } = require('./routes/editor');
const { servePreview } = require('./routes/preview');
const { setupFileWatcher } = require('./watcher/fileWatcher');
const { isPathSafe } = require('./utils/pathUtils');
const WebSocketManager = require('./websocket/websocketHandler');
const logger = require('./utils/logger');

// Initialize Express app and HTTP server
const app = express();
app.use(express.json({ limit: '100mb' })); // Parse JSON bodies with increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // For URL-encoded bodies
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
    (filePath, eventType) => {
      logger.debug('File event detected', { filePath, eventType });
      wsManager.notifyFileChange(filePath, eventType);
    }
  );
  logger.info('File watcher initialized', { watching: config.BASE_DIR });
} catch (error) {
  logger.error('Failed to initialize file watcher', error);
}

// Setup API routes (before file server to avoid conflicts)
app.use('/__api__', setupAPI(config.BASE_DIR));
setWebSocketManager(wsManager); // Pass WebSocket manager to API
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

// Setup preview route
app.get('/__preview__', async (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).send('No file specified');
    }
    const html = await servePreview(config.BASE_DIR, filePath);
    res.send(html);
  } catch (error) {
    logger.error('Error serving preview', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// In-memory cache for preview content (keyed by file path)
const previewCache = new Map();

// Setup preview content route (for iframe to load HTML with proper base path)
app.get('/__preview-content__', async (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).send('No file specified');
    }

    // Check cache first
    let content = previewCache.get(filePath);
    
    if (content === undefined) {
      // Not in cache, read from file
      const fullPath = path.join(config.BASE_DIR, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, config.BASE_DIR)) {
        return res.status(403).send('Forbidden');
      }

      try {
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
          return res.status(400).send('Cannot preview directory');
        }
        content = await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          content = '';
        } else {
          throw error;
        }
      }
    }

    // Get directory path for base tag - normalize to use forward slashes
    // filePath is already normalized (e.g., "week8/midterm_izaiah_niemuth/index.html")
    const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
    const basePath = fileDir ? '/' + fileDir + '/' : '/';
    const baseUrl = req.protocol + '://' + req.get('host') + basePath;

    // Inject or update base tag
    let modifiedContent = content;
    modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
    
    if (modifiedContent.match(/<head[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
        return match + `\n<base href="${baseUrl}">`;
      });
    } else if (modifiedContent.match(/<html[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
        return match + `\n<head><base href="${baseUrl}"></head>`;
      });
    } else if (modifiedContent.trim().length > 0) {
      modifiedContent = `<!DOCTYPE html><html><head><base href="${baseUrl}"></head><body>${modifiedContent}</body></html>`;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedContent);
  } catch (error) {
    logger.error('Error serving preview content', error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Route to update preview cache (for live preview updates)
app.post('/__preview-content__', express.text({ limit: '50mb' }), (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'No file specified' });
    }

    // Validate path
    const fullPath = path.join(config.BASE_DIR, filePath);
    const resolvedPath = path.resolve(fullPath);
    if (!isPathSafe(resolvedPath, config.BASE_DIR)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Store content in cache
    previewCache.set(filePath, req.body);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating preview cache', error);
    res.status(500).json({ success: false, error: error.message });
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
