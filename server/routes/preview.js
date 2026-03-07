const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

async function loadPreviewTemplates() {
  if (!htmlTemplate) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    
    htmlTemplate = await fs.readFile(
      path.join(templatesDir, 'html', 'preview.html'),
      'utf-8'
    );
    cssContent = await fs.readFile(
      path.join(templatesDir, 'css', 'preview.css'),
      'utf-8'
    );
    jsContent = await fs.readFile(
      path.join(templatesDir, 'js', 'preview.js'),
      'utf-8'
    );
  }
}

async function servePreview(baseDir, filePath) {
  await loadPreviewTemplates();
  
  const fullPath = path.join(baseDir, filePath);
  const resolvedPath = path.resolve(fullPath);

  if (!isPathSafe(resolvedPath, baseDir)) {
    throw new Error('Forbidden');
  }

  let content = '';
  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error('Cannot preview directory');
    }
    content = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      content = '';
    } else {
      throw error;
    }
  }

  const fileName = filePath.split(path.sep).pop() || filePath;
  
  let html = htmlTemplate
    .replace('{{FILENAME}}', fileName)
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style>`)
    .replace('{{JS_CONTENT}}', `<script>${jsContent}</script>`);

  return html;
}

const previewCache = new Map();

function setupPreviewRoutes(baseDir) {
  const router = express.Router();
  
  router.get('/', async (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        return res.status(400).send('No file specified');
      }
      const html = await servePreview(baseDir, filePath);
      res.send(html);
    } catch (error) {
      logger.error('Error serving preview', error);
      res.status(500).send('Error: ' + error.message);
    }
  });
  
  return router;
}

function setupPreviewContentRoutes(baseDir, wsManager) {
  const router = express.Router();
  
  router.get('/', async (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        return res.status(400).send('No file specified');
      }

      const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const editorPath = path.join(editorDir, normalizedPath);
      const resolvedEditorPath = path.resolve(editorPath);
      
      let content = undefined;
      let useEditorFile = false;
      
      if (isPathSafe(resolvedEditorPath, baseDir)) {
        try {
          const editorStats = await fs.stat(resolvedEditorPath);
          if (!editorStats.isDirectory()) {
            content = await fs.readFile(resolvedEditorPath, 'utf-8');
            useEditorFile = true;
            logger.info('Preview: Loading from ide_editor_cache folder', { path: filePath, normalizedPath });
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.warn('Preview: Error checking ide_editor_cache folder', { path: filePath, error: error.message });
          }
        }
      }
      
      if (!useEditorFile) {
        const cachedContent = previewCache.get(filePath);
        if (cachedContent !== undefined) {
          content = cachedContent;
        } else {
          const fullPath = path.join(baseDir, filePath);
          const resolvedPath = path.resolve(fullPath);

          if (!isPathSafe(resolvedPath, baseDir)) {
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
      }

      const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
      const basePath = fileDir ? '/' + fileDir + '/' : '/';
      const baseUrl = req.protocol + '://' + req.get('host') + basePath;

      let modifiedContent = content;
      modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
      
      modifiedContent = modifiedContent.replace(/console\.(log|info|warn|error|debug|trace|table|group|groupEnd|groupCollapsed|time|timeEnd|timeLog|timeStamp|clear|dir|dirxml|assert|count|countReset|profile|profileEnd)\s*\(/gi, (match, method) => {
        return `debug_Injected_Console.${method}(`;
      });
      
      const protocol = req.protocol === 'https' ? 'wss:' : 'ws:';
      const wsHost = req.get('host');
      const wsUrl = `${protocol}//${wsHost}`;
      
      const consoleLogScript = `
<script>
(function() {
  'use strict';
  const originalConsole = window.console;
  const originalLog = originalConsole.log.bind(originalConsole);
  const originalInfo = originalConsole.info.bind(originalConsole);
  const originalWarn = originalConsole.warn.bind(originalConsole);
  const originalError = originalConsole.error.bind(originalConsole);
  
  let ws = null;
  let wsReconnectTimeout = null;
  const logQueue = [];
  
  function connectWebSocket() {
    try {
      ws = new WebSocket('${wsUrl}');
      
      ws.onopen = () => {
        if (wsReconnectTimeout) {
          clearTimeout(wsReconnectTimeout);
          wsReconnectTimeout = null;
        }
        while (logQueue.length > 0) {
          const queuedLog = logQueue.shift();
          sendLogToWebSocket(queuedLog.message, queuedLog.type);
        }
      };
      
      ws.onclose = () => {
        ws = null;
        wsReconnectTimeout = setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = () => {
        ws = null;
      };
    } catch (error) {
      ws = null;
    }
  }
  
  function sendLogToWebSocket(message, type) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'preview-log',
          message: message,
          logType: type,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        logQueue.push({ message, type });
      }
    } else {
      logQueue.push({ message, type });
    }
  }
  
  function sendLogToParent(message, type) {
    return; // This is disabled
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'preview-log',
          message: message,
          logType: type,
          timestamp: new Date().toISOString()
        }, '*');
      } catch (error) {
      }
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
  
  function sendLog(message, type) {
    sendLogToParent(message, type);
    sendLogToWebSocket(message, type);
  }
  
  const debug_Injected_Console = {
    log: function(...args) {
      originalLog.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    info: function(...args) {
      originalInfo.apply(originalConsole, args);
      sendLog(formatMessage(args), 'info');
    },
    warn: function(...args) {
      originalWarn.apply(originalConsole, args);
      sendLog(formatMessage(args), 'warn');
    },
    error: function(...args) {
      originalError.apply(originalConsole, args);
      sendLog(formatMessage(args), 'error');
    },
    debug: function(...args) {
      originalLog.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    trace: function(...args) {
      originalConsole.trace.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    table: function(...args) {
      originalConsole.table.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    dir: function(...args) {
      originalConsole.dir.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    dirxml: function(...args) {
      originalConsole.dirxml.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    assert: function(...args) {
      originalConsole.assert.apply(originalConsole, args);
      if (args.length > 0 && !args[0]) {
        sendLog(formatMessage(args.slice(1)), 'error');
      }
    },
    count: function(...args) {
      originalConsole.count.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    countReset: function(...args) {
      originalConsole.countReset.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    profile: function(...args) {
      originalConsole.profile.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    profileEnd: function(...args) {
      originalConsole.profileEnd.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    time: function(...args) {
      originalConsole.time.apply(originalConsole, args);
    },
    timeEnd: function(...args) {
      originalConsole.timeEnd.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    timeLog: function(...args) {
      originalConsole.timeLog.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    timeStamp: function(...args) {
      originalConsole.timeStamp.apply(originalConsole, args);
      sendLog(formatMessage(args), 'log');
    },
    group: function(...args) {
      originalConsole.group.apply(originalConsole, args);
    },
    groupEnd: function(...args) {
      originalConsole.groupEnd.apply(originalConsole, args);
    },
    groupCollapsed: function(...args) {
      originalConsole.groupCollapsed.apply(originalConsole, args);
    },
    clear: function(...args) {
      originalConsole.clear.apply(originalConsole, args);
    }
  };
  
  Object.keys(originalConsole).forEach(key => {
    if (!debug_Injected_Console.hasOwnProperty(key)) {
      debug_Injected_Console[key] = originalConsole[key];
    }
  });
  
  Object.defineProperty(window, 'console', {
    value: debug_Injected_Console,
    writable: false,
    configurable: false
  });
  
  connectWebSocket();
  
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
    }
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
    }
  });
})();
</script>`;
      
      if (modifiedContent.match(/<head[^>]*>/i)) {
        modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
          return match + `${consoleLogScript}\n<base href="${baseUrl}">`;
        });
      } else if (modifiedContent.match(/<html[^>]*>/i)) {
        modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
          return match + `\n<head>${consoleLogScript}\n<base href="${baseUrl}"></head>`;
        });
      } else if (modifiedContent.trim().length > 0) {
        modifiedContent = `<!DOCTYPE html><html><head>${consoleLogScript}\n<base href="${baseUrl}"></head><body>${modifiedContent}</body></html>`;
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedContent);
    } catch (error) {
      logger.error('Error serving preview content', error);
      res.status(500).send('Error: ' + error.message);
    }
  });
  
  router.post('/content', express.text({ limit: '50mb' }), (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'No file specified' });
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);
      if (!isPathSafe(resolvedPath, baseDir)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      previewCache.set(filePath, req.body);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating preview cache', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  return router;
}

module.exports = {
  servePreview,
  setupPreviewRoutes,
  setupPreviewContentRoutes
};
