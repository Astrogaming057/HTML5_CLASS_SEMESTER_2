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

function setupPreviewContentRoutes(baseDir) {
  const router = express.Router();
  
  router.get('/', async (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        return res.status(400).send('No file specified');
      }

      let content = previewCache.get(filePath);
      
      if (content === undefined) {
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
