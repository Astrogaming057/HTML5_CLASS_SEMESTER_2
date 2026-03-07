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

let editorPopoutHtml = null;
let editorPopoutCss = null;
let editorPopoutJs = null;
let previewPopoutHtml = null;
let previewPopoutCss = null;
let previewPopoutJs = null;
let terminalPopoutHtml = null;
let terminalPopoutCss = null;
let terminalPopoutJs = null;

async function loadPopoutTemplates() {
  const templatesDir = path.join(__dirname, 'templates');
  
  if (!editorPopoutHtml) {
    editorPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'editor-popout.html'),
      'utf-8'
    );
    editorPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'editor-popout.css'),
      'utf-8'
    );
    editorPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'editor-popout.js'),
      'utf-8'
    );
  }
  
  if (!previewPopoutHtml) {
    previewPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'preview-popout.html'),
      'utf-8'
    );
    previewPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'preview-popout.css'),
      'utf-8'
    );
    previewPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'preview-popout.js'),
      'utf-8'
    );
  }
  
  if (!terminalPopoutHtml) {
    terminalPopoutHtml = await fs.readFile(
      path.join(templatesDir, 'html', 'terminal-popout.html'),
      'utf-8'
    );
    terminalPopoutCss = await fs.readFile(
      path.join(templatesDir, 'css', 'terminal-popout.css'),
      'utf-8'
    );
    terminalPopoutJs = await fs.readFile(
      path.join(templatesDir, 'js', 'terminal-popout.js'),
      'utf-8'
    );
  }
}

app.get('/__popout__/editor', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const filePath = req.query.file;
    const originalUrl = req.query.original;
    const html = editorPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${editorPopoutCss}</style>`)
      .replace('{{JS_CONTENT}}', `<script>${editorPopoutJs}</script>`);
    res.send(html);
  } catch (error) {
    logger.error('Error serving editor popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/__popout__/preview', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const html = previewPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${previewPopoutCss}</style>`)
      .replace('{{JS_CONTENT}}', `<script>${previewPopoutJs}</script>`);
    res.send(html);
  } catch (error) {
    logger.error('Error serving preview popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/__popout__/terminal', async (req, res) => {
  try {
    await loadPopoutTemplates();
    const html = terminalPopoutHtml
      .replace('{{CSS_CONTENT}}', `<style>${terminalPopoutCss}</style>`)
      .replace('{{JS_CONTENT}}', `<script>${terminalPopoutJs}</script>`);
    res.send(html);
  } catch (error) {
    logger.error('Error serving terminal popout', error);
    res.status(500).send('Error: ' + error.message);
  }
});

const previewCache = new Map();

app.get('/__preview-content__', async (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).send('No file specified');
    }

    let content = previewCache.get(filePath);
    
    if (content === undefined) {
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

    const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
    const basePath = fileDir ? '/' + fileDir + '/' : '/';
    const baseUrl = req.protocol + '://' + req.get('host') + basePath;

    let modifiedContent = content;
    modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
    
    const consoleLogScript = `
<script>
(function() {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  function sendLogToParent(message, type) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'preview-log',
        message: message,
        logType: type,
        timestamp: new Date().toISOString()
      }, '*');
    }
  }
  
  function formatMessage(args) {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }
  
  console.log = function(...args) {
    originalLog.apply(console, args);
    sendLogToParent(formatMessage(args), 'log');
  };
  
  console.info = function(...args) {
    originalInfo.apply(console, args);
    sendLogToParent(formatMessage(args), 'info');
  };
  
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendLogToParent(formatMessage(args), 'warn');
  };
  
  console.error = function(...args) {
    originalError.apply(console, args);
    sendLogToParent(formatMessage(args), 'error');
  };
})();
</script>`;
    
    if (modifiedContent.match(/<head[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
        return match + `\n<base href="${baseUrl}">${consoleLogScript}`;
      });
    } else if (modifiedContent.match(/<html[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
        return match + `\n<head><base href="${baseUrl}">${consoleLogScript}</head>`;
      });
    } else if (modifiedContent.trim().length > 0) {
      modifiedContent = `<!DOCTYPE html><html><head><base href="${baseUrl}">${consoleLogScript}</head><body>${modifiedContent}</body></html>`;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedContent);
  } catch (error) {
    logger.error('Error serving preview content', error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.post('/__preview-content__', express.text({ limit: '50mb' }), (req, res) => {
  try {
    const filePath = req.query.file;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'No file specified' });
    }

    const fullPath = path.join(config.BASE_DIR, filePath);
    const resolvedPath = path.resolve(fullPath);
    if (!isPathSafe(resolvedPath, config.BASE_DIR)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    previewCache.set(filePath, req.body);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating preview cache', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use(setupFileServer(config.BASE_DIR));
logger.info('File server routes configured');

server.listen(config.PORT, () => {
  logger.info('Server started successfully', {
    url: `http://localhost:${config.PORT}`,
    baseDir: config.BASE_DIR
  });
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
