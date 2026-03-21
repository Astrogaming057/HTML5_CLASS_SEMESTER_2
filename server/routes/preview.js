const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const { escapeHtml } = require('../utils/formatters');
const { renderMarkdownWithStyles } = require('../utils/markdownRenderer');
const { getStatusPage } = require('../templates/status/statusHandler');
const logger = require('../utils/logger');
const mammoth = require('mammoth');

let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

async function loadPreviewTemplates() {
  if (!htmlTemplate) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    const jsDir = path.join(templatesDir, 'js');
    const previewModulesDir = path.join(jsDir, 'preview');
    
    htmlTemplate = await fs.readFile(
      path.join(templatesDir, 'html', 'preview.html'),
      'utf-8'
    );
    cssContent = await fs.readFile(
      path.join(templatesDir, 'css', 'preview.css'),
      'utf-8'
    );
    try {
      const remoteExplorerCss = await fs.readFile(
        path.join(templatesDir, 'css', 'remoteExplorer.css'),
        'utf-8'
      );
      cssContent += '\n' + remoteExplorerCss;
    } catch (e) {
      logger.info('remoteExplorer.css not loaded: ' + (e && e.message));
    }

    try {
      const utilsJs = await fs.readFile(
        path.join(previewModulesDir, 'utils.js'),
        'utf-8'
      );
      const remoteConfigJs = await fs.readFile(
        path.join(previewModulesDir, 'remote', 'remoteConfig.js'),
        'utf-8'
      );
      const remoteSessionJs = await fs.readFile(
        path.join(previewModulesDir, 'remote', 'remoteSession.js'),
        'utf-8'
      );
      const remoteAuthApiJs = await fs.readFile(
        path.join(previewModulesDir, 'remote', 'remoteAuthApi.js'),
        'utf-8'
      );
      const remoteTransportJs = await fs.readFile(
        path.join(previewModulesDir, 'remote', 'remoteTransport.js'),
        'utf-8'
      );
      const remoteExplorerUIJs = await fs.readFile(
        path.join(previewModulesDir, 'remote', 'remoteExplorerUI.js'),
        'utf-8'
      );
      const settingsJs = await fs.readFile(
        path.join(previewModulesDir, 'settings.js'),
        'utf-8'
      );
      const popoutsJs = await fs.readFile(
        path.join(previewModulesDir, 'popouts.js'),
        'utf-8'
      );
      const uiJs = await fs.readFile(
        path.join(previewModulesDir, 'ui.js'),
        'utf-8'
      );
      const stateJs = await fs.readFile(
        path.join(previewModulesDir, 'state.js'),
        'utf-8'
      );
      const serverJs = await fs.readFile(
        path.join(previewModulesDir, 'server.js'),
        'utf-8'
      );
      const previewManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'previewManager.js'),
        'utf-8'
      );
      const editorManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'editorManager.js'),
        'utf-8'
      );
      const tabManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'tabManager.js'),
        'utf-8'
      );
      const websocketJs = await fs.readFile(
        path.join(previewModulesDir, 'websocket.js'),
        'utf-8'
      );
      const terminalJs = await fs.readFile(
        path.join(previewModulesDir, 'terminal.js'),
        'utf-8'
      );
      const compilerJs = await fs.readFile(
        path.join(previewModulesDir, 'compiler.js'),
        'utf-8'
      );
      const fileIconsJs = await fs.readFile(
        path.join(previewModulesDir, 'fileIcons.js'),
        'utf-8'
      );
      const fileExplorerJs = await fs.readFile(
        path.join(previewModulesDir, 'fileExplorer.js'),
        'utf-8'
      );
      const resizersJs = await fs.readFile(
        path.join(previewModulesDir, 'resizers.js'),
        'utf-8'
      );
      const syncChannelJs = await fs.readFile(
        path.join(previewModulesDir, 'syncChannel.js'),
        'utf-8'
      );
      const crossModuleNavigationJs = await fs.readFile(
        path.join(previewModulesDir, 'crossModuleNavigation.js'),
        'utf-8'
      );
      const editorSetupJs = await fs.readFile(
        path.join(previewModulesDir, 'editorSetup.js'),
        'utf-8'
      );
      const hexEditorJs = await fs.readFile(
        path.join(previewModulesDir, 'hexEditor.js'),
        'utf-8'
      );
      const terminalUIJs = await fs.readFile(
        path.join(previewModulesDir, 'terminalUI.js'),
        'utf-8'
      );
      const settingsUIJs = await fs.readFile(
        path.join(previewModulesDir, 'settingsUI.js'),
        'utf-8'
      );
      const eventsJs = await fs.readFile(
        path.join(previewModulesDir, 'events.js'),
        'utf-8'
      );
      const electronCloseJs = await fs.readFile(
        path.join(previewModulesDir, 'electronClose.js'),
        'utf-8'
      );
      const fileSearchJs = await fs.readFile(
        path.join(previewModulesDir, 'fileSearch.js'),
        'utf-8'
      );
      const globalSearchJs = await fs.readFile(
        path.join(previewModulesDir, 'globalSearch.js'),
        'utf-8'
      );
      const gitPanelJs = await fs.readFile(
        path.join(previewModulesDir, 'gitPanel.js'),
        'utf-8'
      );
      const helpMenuJs = await fs.readFile(
        path.join(previewModulesDir, 'helpMenu.js'),
        'utf-8'
      );
      const symbolNavigatorJs = await fs.readFile(
        path.join(previewModulesDir, 'symbolNavigator.js'),
        'utf-8'
      );
      const editorNavigationJs = await fs.readFile(
        path.join(previewModulesDir, 'editorNavigation.js'),
        'utf-8'
      );
      const initializationJs = await fs.readFile(
        path.join(previewModulesDir, 'initialization.js'),
        'utf-8'
      );
      const browserManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'browserManager.js'),
        'utf-8'
      );
      const inspectorManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'inspectorManager.js'),
        'utf-8'
      );
      const bookmarkManagerJs = await fs.readFile(
        path.join(previewModulesDir, 'bookmarkManager.js'),
        'utf-8'
      );
      const pingMonitorJs = await fs.readFile(
        path.join(previewModulesDir, 'pingMonitor.js'),
        'utf-8'
      );
      const mainJs = await fs.readFile(
        path.join(jsDir, 'preview.js'),
        'utf-8'
      );
      
      // Load autocomplete files
      const autocompleteDir = path.join(previewModulesDir, 'autocomplete');
      const clientAutocompleteJs = await fs.readFile(
        path.join(autocompleteDir, 'client.js'),
        'utf-8'
      );
      const commandsAutocompleteJs = await fs.readFile(
        path.join(autocompleteDir, 'commands.js'),
        'utf-8'
      );
      const powershellAutocompleteJs = await fs.readFile(
        path.join(autocompleteDir, 'powershell.js'),
        'utf-8'
      );
      const logAutocompleteJs = await fs.readFile(
        path.join(autocompleteDir, 'log.js'),
        'utf-8'
      );
      
      jsContent = [
        '// Autocomplete - Client',
        clientAutocompleteJs,
        '// Autocomplete - Commands',
        commandsAutocompleteJs,
        '// Autocomplete - PowerShell',
        powershellAutocompleteJs,
        '// Autocomplete - Log',
        logAutocompleteJs,
        '// Utils',
        utilsJs,
        '// Remote Explorer',
        remoteConfigJs,
        remoteSessionJs,
        remoteAuthApiJs,
        remoteTransportJs,
        remoteExplorerUIJs,
        '// Settings',
        settingsJs,
        '// Popouts',
        popoutsJs,
        '// UI',
        uiJs,
        '// State',
        stateJs,
        '// Server',
        serverJs,
        '// Preview Manager',
        previewManagerJs,
        '// Editor Manager',
        editorManagerJs,
        '// Tab Manager',
        tabManagerJs,
        '// WebSocket',
        websocketJs,
        '// Terminal',
        terminalJs,
        '// Compiler',
        compilerJs,
        '// File icons',
        fileIconsJs,
        '// File Explorer',
        fileExplorerJs,
        '// Resizers',
        resizersJs,
        '// Sync Channel',
        syncChannelJs,
        '// Cross-module navigation (go to definition, import completions)',
        crossModuleNavigationJs,
        '// Editor Navigation',
        editorNavigationJs,
        '// Editor Setup',
        editorSetupJs,
        '// Hex Editor',
        hexEditorJs,
        '// Terminal UI',
        terminalUIJs,
        '// Settings UI',
        settingsUIJs,
        '// Events',
        eventsJs,
        '// Electron close handshake',
        electronCloseJs,
        '// File Search',
        fileSearchJs,
        '// Global Search',
        globalSearchJs,
        '// Git Panel',
        gitPanelJs,
        '// Help Menu',
        helpMenuJs,
        '// Symbol Navigator',
        symbolNavigatorJs,
        '// Browser Manager',
        browserManagerJs,
        '// Inspector Manager',
        inspectorManagerJs,
        '// Bookmark Manager',
        bookmarkManagerJs,
        '// Ping Monitor',
        pingMonitorJs,
        '// Initialization',
        initializationJs,
        '// Main',
        mainJs
      ].join('\n\n');
    } catch (error) {
      logger.error('Error loading preview module files', error);
    jsContent = await fs.readFile(
        path.join(jsDir, 'preview.js'),
      'utf-8'
    );
    }
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
  
  const darkTheme = await fs.readFile(
    path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css'),
    'utf-8'
  );
  
  let html = htmlTemplate
    .replace('{{FILENAME}}', fileName)
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style><style id="theme-style">${darkTheme}</style>`)
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
        const statusPage = await getStatusPage(400);
        return res.status(400).send(statusPage || 'No file specified');
      }
      const html = await servePreview(baseDir, filePath);
      res.send(html);
    } catch (error) {
      logger.error('Error serving preview', error);
      const statusPage = await getStatusPage(500);
      res.status(500).send(statusPage || 'Error: ' + error.message);
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
        const statusPage = await getStatusPage(400);
        return res.status(400).send(statusPage || 'No file specified');
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
            const statusPage = await getStatusPage(403);
            return res.status(403).send(statusPage || 'Forbidden');
          }

          try {
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
              const statusPage = await getStatusPage(400);
              return res.status(400).send(statusPage || 'Cannot preview directory');
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

      const fileName = filePath.split('/').pop() || filePath;
      const ext = fileName.split('.').pop().toLowerCase();
      const isHTML = ext === 'html' || ext === 'htm';
      const isMarkdown = ext === 'md' || ext === 'markdown';
      const isDocumentLike = [
        'doc', 'docx', 'rtf', 'odt',
        'pdf',
        'ppt', 'pptx', 'odp',
        'xls', 'xlsx', 'ods'
      ].includes(ext);

      let modifiedContent = content;

      // Initialize theme styles BEFORE document-like preview branch uses them (avoids TDZ ReferenceError)
      const themeName = req.query.theme || 'dark';
      let themeStyles = '';
      try {
        if (themeName === 'custom' && req.query.customCSS) {
          const customCSS = Buffer.from(req.query.customCSS, 'base64').toString('utf-8');
          if (customCSS.trim() === '') {
            // Fallback to dark theme if custom CSS is empty
            const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
            const themeContent = await fs.readFile(themePath, 'utf-8');
            themeStyles = `<style id="theme-style">${themeContent}</style>`;
          } else {
            themeStyles = `<style id="theme-style">${customCSS}</style>`;
          }
        } else {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${themeName}.css`);
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyles = `<style id="theme-style">${themeContent}</style>`;
        }
      } catch (error) {
        logger.warn('Error loading theme for preview', { theme: themeName, error: error.message });
        // Fallback to dark theme on error
        try {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyles = `<style id="theme-style">${themeContent}</style>`;
        } catch (fallbackError) {
          logger.error('Error loading fallback theme', fallbackError);
        }
      }

      if (isDocumentLike && ext === 'docx') {
        // Convert DOCX to HTML using mammoth for in-IDE document-style preview
        try {
          const fullDocPath = path.join(baseDir, filePath);
          const resolvedDocPath = path.resolve(fullDocPath);
          
          if (!isPathSafe(resolvedDocPath, baseDir)) {
            const statusPage = await getStatusPage(403);
            return res.status(403).send(statusPage || 'Forbidden');
          }

          const docxBuffer = await fs.readFile(resolvedDocPath);

          const result = await mammoth.convertToHtml({ buffer: docxBuffer });
          const bodyHtml = result.value || '';

          const docxStyles = `
<style>
  body {
    margin: 0;
    padding: 24px;
    background: var(--bg-primary, #111827);
    color: var(--text-primary, #e5e7eb);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .docx-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 40px;
    background: #ffffff;
    color: #111827;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
    box-sizing: border-box;
  }
  .docx-title {
    font-size: 14px;
    color: var(--text-secondary, #9ca3af);
    margin-bottom: 12px;
  }
  .docx-content {
    color: #111827;
  }
  .docx-content h1,
  .docx-content h2,
  .docx-content h3 {
    color: #111827;
  }
  .docx-content p {
    line-height: 1.6;
    margin: 0 0 0.75em;
  }
</style>`;

          modifiedContent = `<!DOCTYPE html>
<html>
<head>
${themeStyles}${docxStyles}
</head>
<body>
  <div class="docx-page">
    <div class="docx-title">${escapeHtml(fileName)}</div>
    <div class="docx-content">
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;

        } catch (error) {
          logger.error('Error converting DOCX for preview', { path: filePath, error: error.message });

          // Fallback to iframe-based document embedding
          const fileUrl = '/' + filePath.replace(/^\/+/, '').replace(/\\/g, '/');
          modifiedContent = `<!DOCTYPE html>
<html>
<head>
<base href="${baseUrl}">${themeStyles}</head>
<body>
  <iframe src="${encodeURI(fileUrl)}" style="border:none;width:100%;height:100vh;background:#111827;"></iframe>
</body>
</html>`;
        }
      } else if (isDocumentLike) {
        // For document-like files, don't try to read or render the binary content directly.
        // Instead, embed the original file using an iframe so the browser (or associated
        // plugins) can handle the rendering.
        const fileUrl = '/' + filePath.replace(/^\/+/, '').replace(/\\/g, '/');
        const docStyles = `
<style>
  body {
    margin: 0;
    padding: 0;
    background: var(--bg-primary, #111827);
    color: var(--text-primary, #e5e7eb);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .doc-preview-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    box-sizing: border-box;
    padding: 12px;
    gap: 8px;
  }
  .doc-preview-header {
    font-size: 13px;
    color: var(--text-secondary, #9ca3af);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .doc-preview-frame {
    flex: 1;
    border-radius: 6px;
    border: 1px solid var(--border-primary, #374151);
    background: #ffffff;
    width: 100%;
  }
  .doc-preview-note {
    font-size: 11px;
    color: var(--text-tertiary, #6b7280);
  }
</style>`;

        modifiedContent = `<!DOCTYPE html>
<html>
<head>
<base href="${baseUrl}">${themeStyles}${docStyles}
</head>
<body>
  <div class="doc-preview-wrapper">
    <div class="doc-preview-header">
      <span>Document preview: ${escapeHtml(fileName)}</span>
      <span class="doc-preview-note">If this doesn't render, your browser may download it instead.</span>
    </div>
    <iframe class="doc-preview-frame" src="${encodeURI(fileUrl)}"></iframe>
  </div>
</body>
</html>`;
      } else if (isHTML) {
        modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
        
        const rewriteResourceLink = (tag, attr) => {
          const regex = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["'][^>]*>`, 'gi');
          modifiedContent = modifiedContent.replace(regex, (match, url) => {
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#')) {
              return match;
            }
            
            let resourcePath = url;
            if (!resourcePath.startsWith('/')) {
              resourcePath = fileDir ? '/' + fileDir + '/' + resourcePath : '/' + resourcePath;
            }
            resourcePath = resourcePath.replace(/^\/+/, '').replace(/\\/g, '/');
            
            const resourceExt = resourcePath.split('.').pop().toLowerCase();
            if (resourceExt === 'css' || resourceExt === 'js') {
              const cacheUrl = `/__preview-resource__?file=${encodeURIComponent(resourcePath)}&t=${Date.now()}`;
              return match.replace(url, cacheUrl);
            }
            return match;
          });
        };
        
        rewriteResourceLink('link', 'href');
        rewriteResourceLink('script', 'src');
        
        modifiedContent = modifiedContent.replace(/console\.(log|info|warn|error|debug|trace|table|group|groupEnd|groupCollapsed|time|timeEnd|timeLog|timeStamp|clear|dir|dirxml|assert|count|countReset|profile|profileEnd)\s*\(/gi, (match, method) => {
          return `debug_Injected_Console.${method}(`;
        });
      } else if (isMarkdown) {
        try {
          modifiedContent = await renderMarkdownWithStyles(content);
        } catch (error) {
          logger.error('Error parsing markdown', error);
          modifiedContent = escapeHtml(content);
          modifiedContent = `<pre>${modifiedContent}</pre>`;
        }
      } else {
        modifiedContent = escapeHtml(modifiedContent);
        modifiedContent = `<pre>${modifiedContent}</pre>`;
      }
      
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
  
  window.debug_Injected_Console = debug_Injected_Console;
  
  console.log('Console injected successfully');
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

      if (isHTML) {
        if (modifiedContent.match(/<head[^>]*>/i)) {
          modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
            return match + `${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}`;
          });
        } else if (modifiedContent.match(/<html[^>]*>/i)) {
          modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
            return match + `\n<head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}</head>`;
          });
        } else if (modifiedContent.trim().length > 0) {
          modifiedContent = `<!DOCTYPE html><html><head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}</head><body>${modifiedContent}</body></html>`;
        }
        } else {
        if (modifiedContent.trim().length > 0) {
          const preStyles = `<style>pre { margin: 0; padding: 20px; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; background: var(--bg-secondary, #f6f8fa); color: var(--text-primary, #24292e); border: 1px solid var(--border-primary, #e1e4e8); border-radius: 4px; } body { background: var(--bg-primary, #ffffff); color: var(--text-primary, #24292e); }</style>`;
          modifiedContent = `<!DOCTYPE html><html><head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}${preStyles}</head><body>${modifiedContent}</body></html>`;
        }
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedContent);
    } catch (error) {
      logger.error('Error serving preview content', error);
      const statusPage = await getStatusPage(500);
      res.status(500).send(statusPage || 'Error: ' + error.message);
    }
  });
  
  router.get('/live', async (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        const statusPage = await getStatusPage(400);
        return res.status(400).send(statusPage || 'No file specified');
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        const statusPage = await getStatusPage(403);
        return res.status(403).send(statusPage || 'Forbidden');
      }

      let content = '';
      try {
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
          const statusPage = await getStatusPage(400);
          return res.status(400).send(statusPage || 'Cannot preview directory');
        }
        content = await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          content = '';
        } else {
          throw error;
        }
      }

      const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
      const basePath = fileDir ? '/' + fileDir + '/' : '/';
      const baseUrl = req.protocol + '://' + req.get('host') + basePath;

      const fileName = filePath.split('/').pop() || filePath;
      const ext = fileName.split('.').pop().toLowerCase();
      const isHTML = ext === 'html' || ext === 'htm';
      const isMarkdown = ext === 'md' || ext === 'markdown';

      let modifiedContent = content;
      
      if (isHTML) {
        modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
        
        const rewriteResourceLink = (tag, attr) => {
          const regex = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["'][^>]*>`, 'gi');
          modifiedContent = modifiedContent.replace(regex, (match, url) => {
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#')) {
              return match;
            }
            
            let resourcePath = url;
            if (!resourcePath.startsWith('/')) {
              resourcePath = fileDir ? '/' + fileDir + '/' + resourcePath : '/' + resourcePath;
            }
            resourcePath = resourcePath.replace(/^\/+/, '').replace(/\\/g, '/');
            
            const resourceExt = resourcePath.split('.').pop().toLowerCase();
            if (resourceExt === 'css' || resourceExt === 'js') {
              const cacheUrl = `/__preview-resource__?file=${encodeURIComponent(resourcePath)}&t=${Date.now()}`;
              return match.replace(url, cacheUrl);
            }
            return match;
          });
        };
        
        rewriteResourceLink('link', 'href');
        rewriteResourceLink('script', 'src');
        
        modifiedContent = modifiedContent.replace(/console\.(log|info|warn|error|debug|trace|table|group|groupEnd|groupCollapsed|time|timeEnd|timeLog|timeStamp|clear|dir|dirxml|assert|count|countReset|profile|profileEnd)\s*\(/gi, (match, method) => {
          return `debug_Injected_Console.${method}(`;
        });
      } else if (isMarkdown) {
        try {
          modifiedContent = await renderMarkdownWithStyles(content);
        } catch (error) {
          logger.error('Error parsing markdown', error);
          modifiedContent = escapeHtml(content);
          modifiedContent = `<pre>${modifiedContent}</pre>`;
        }
      } else {
        modifiedContent = escapeHtml(modifiedContent);
        modifiedContent = `<pre>${modifiedContent}</pre>`;
      }
      
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
  
  const debug_Injected_Console = {
    log: function(...args) {
      originalLog.apply(originalConsole, args);
      sendLogToWebSocket(formatMessage(args), 'log');
    },
    info: function(...args) {
      originalInfo.apply(originalConsole, args);
      sendLogToWebSocket(formatMessage(args), 'info');
    },
    warn: function(...args) {
      originalWarn.apply(originalConsole, args);
      sendLogToWebSocket(formatMessage(args), 'warn');
    },
    error: function(...args) {
      originalError.apply(originalConsole, args);
      sendLogToWebSocket(formatMessage(args), 'error');
    }
  };
  
  window.console = debug_Injected_Console;
  window.debug_Injected_Console = debug_Injected_Console;
  console.log('Console injected successfully');
  connectWebSocket();
})();
</script>`;

      const themeName = req.query.theme || 'dark';
      let themeStyles = '';
      try {
        if (themeName === 'custom' && req.query.customCSS) {
          const customCSS = Buffer.from(req.query.customCSS, 'base64').toString('utf-8');
          if (customCSS.trim() === '') {
            const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
            const themeContent = await fs.readFile(themePath, 'utf-8');
            themeStyles = `<style id="theme-style">${themeContent}</style>`;
          } else {
            themeStyles = `<style id="theme-style">${customCSS}</style>`;
          }
        } else {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${themeName}.css`);
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyles = `<style id="theme-style">${themeContent}</style>`;
        }
      } catch (error) {
        logger.warn('Error loading theme for preview', { theme: themeName, error: error.message });
        try {
          const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', 'dark.css');
          const themeContent = await fs.readFile(themePath, 'utf-8');
          themeStyles = `<style id="theme-style">${themeContent}</style>`;
        } catch (fallbackError) {
          logger.error('Error loading fallback theme', fallbackError);
        }
      }
      
      if (isHTML) {
        if (modifiedContent.match(/<head[^>]*>/i)) {
          modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
            return match + `${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}`;
          });
        } else if (modifiedContent.match(/<html[^>]*>/i)) {
          modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
            return match + `\n<head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}</head>`;
          });
        } else if (modifiedContent.trim().length > 0) {
          modifiedContent = `<!DOCTYPE html><html><head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}</head><body>${modifiedContent}</body></html>`;
        }
        } else {
        if (modifiedContent.trim().length > 0) {
          const preStyles = `<style>pre { margin: 0; padding: 20px; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; background: var(--bg-secondary, #f6f8fa); color: var(--text-primary, #24292e); border: 1px solid var(--border-primary, #e1e4e8); border-radius: 4px; } body { background: var(--bg-primary, #ffffff); color: var(--text-primary, #24292e); }</style>`;
          modifiedContent = `<!DOCTYPE html><html><head>${consoleLogScript}\n<base href="${baseUrl}">${themeStyles}${preStyles}</head><body>${modifiedContent}</body></html>`;
        }
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedContent);
    } catch (error) {
      logger.error('Error serving live preview content', error);
      const statusPage = await getStatusPage(500);
      res.status(500).send(statusPage || 'Error: ' + error.message);
    }
  });

  router.post('/', express.text({ limit: '50mb' }), async (req, res) => {
    try {
      const statusPage = await getStatusPage(301);
      return res.status(301).send(statusPage || 'Moved Permanently');
    } catch (error) {
      logger.error('Error serving 301 status page', error);
      const statusPage = await getStatusPage(500);
      res.status(500).send(statusPage || 'Error: ' + error.message);
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

function setupPreviewResourceRoutes(baseDir) {
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
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.warn('Preview resource: Error checking ide_editor_cache folder', { path: filePath, error: error.message });
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
              return res.status(400).send('Cannot serve directory');
            }
            content = await fs.readFile(resolvedPath, 'utf-8');
          } catch (error) {
            if (error.code === 'ENOENT') {
              return res.status(404).send('File not found');
            }
            throw error;
          }
        }
      }

      const fileName = filePath.split('/').pop() || filePath;
      const ext = fileName.split('.').pop().toLowerCase();
      
      let contentType = 'text/plain';
      if (ext === 'css') {
        contentType = 'text/css';
      } else if (ext === 'js') {
        contentType = 'application/javascript';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(content);
    } catch (error) {
      logger.error('Error serving preview resource', error);
      res.status(500).send('Error: ' + error.message);
    }
  });

  return router;
}

module.exports = {
  servePreview,
  setupPreviewRoutes,
  setupPreviewContentRoutes,
  setupPreviewResourceRoutes
};
