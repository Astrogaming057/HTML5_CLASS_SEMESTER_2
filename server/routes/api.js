const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const crypto = require('crypto');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');
const appConfig = require('../config');
const remoteAgentModule = require('../remoteAgent');
const { Client: SshClient } = require('ssh2');

// Optional minification libraries
let terser = null;
let CleanCSS = null;
let htmlMinifier = null;
try {
  // eslint-disable-next-line global-require
  terser = require('terser');
} catch (_) {
  logger.warn('Minify: terser not installed, JS minification disabled');
}
try {
  // eslint-disable-next-line global-require
  CleanCSS = require('clean-css');
} catch (_) {
  logger.warn('Minify: clean-css not installed, CSS minification disabled');
}
try {
  // eslint-disable-next-line global-require
  htmlMinifier = require('html-minifier-terser');
} catch (_) {
  logger.warn('Minify: html-minifier-terser not installed, HTML minification disabled');
}

let wsManager = null;

// In-memory registry for long-running local Node processes (per server instance)
// Map<runId, { child, logs: Array<{ type, text, timestamp }>, exited, exitCode, runner, moduleType }>
const activeNodeRuns = new Map();

function setWebSocketManager(manager) {
  wsManager = manager;
}

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const router = express.Router();

function setupAPI(baseDir) {
  // Debug endpoint to check which BASE_DIR is being used
  router.get('/debug/base-dir', (req, res) => {
    res.json({
      baseDir: baseDir,
      cwd: process.cwd(),
      envBaseDir: process.env.BASE_DIR,
      resolvedBaseDir: path.resolve(baseDir)
    });
  });
  
  router.get('/mode', (req, res) => {
    const mode = process.env.SERVER_MODE || global.__SERVER_MODE || 'browser';
    res.json({ 
      success: true, 
      mode: mode,
      isAppMode: mode === 'app',
      isBrowserMode: mode === 'browser',
      debug: !!appConfig.DEBUG
    });
  });

  /**
   * Push proxy login + device key from the browser to this Node process so it can
   * open the outbound /agent WebSocket (presence + reverse tunnel when direct HTTP fails).
   */
  router.post('/remote/agent-config', (req, res) => {
    try {
      const result = remoteAgentModule.reconfigure(req.body || {});
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error || 'Invalid config' });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      logger.error('remote agent-config failed', e);
      res.status(500).json({ success: false, error: e.message || 'Server error' });
    }
  });

  /** Whether this Node process has an outbound /agent WebSocket to the proxy (for debugging). */
  router.get('/remote/agent-status', (req, res) => {
    try {
      const status = remoteAgentModule.getAgentStatus();
      res.json({ success: true, agent: status });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message || 'Server error' });
    }
  });

  /** Reverse-tunnel remote browsers viewing this device (via proxy); requires outbound agent. */
  router.get('/remote/tunnel-viewers', (req, res) => {
    try {
      const count =
        typeof remoteAgentModule.getRemoteTunnelViewerCount === 'function'
          ? remoteAgentModule.getRemoteTunnelViewerCount()
          : 0;
      const sessions =
        typeof remoteAgentModule.getRemoteTunnelViewerSessions === 'function'
          ? remoteAgentModule.getRemoteTunnelViewerSessions()
          : [];
      res.json({ success: true, count, sessions });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message || 'Server error' });
    }
  });

  /** Editor WebSocket peers (browsers connected to this Astro Code backend for live sync). */
  router.get('/ws/clients', (req, res) => {
    try {
      if (!wsManager || typeof wsManager.getClientSessionsList !== 'function') {
        res.json({ success: true, clients: [], total: 0 });
        return;
      }
      const clients = wsManager.getClientSessionsList();
      res.json({ success: true, clients, total: clients.length });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message || 'Server error' });
    }
  });

  router.get('/files', async (req, res) => {
    try {
      const filePath = req.query.path || '/';
      const listDir = req.query.list === 'true';

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access', { path: filePath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory() || listDir) {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const files = [];
        
        for (const entry of entries) {
          if (entry.name.toLowerCase() === 'ide_editor_cache' && entry.isDirectory()) {
            continue;
          }
          
          const entryPath = path.join(filePath === '/' ? '' : filePath, entry.name);
          files.push({
            name: entry.name,
            path: entryPath.replace(/\\/g, '/'),
            isDirectory: entry.isDirectory()
          });
        }
        
        logger.info('API: Directory listed', { path: filePath, count: files.length });
        return res.json({ success: true, files, isDirectory: true });
      }

      if (req.query.binary === 'true' || req.query.encoding === 'base64') {
        const buffer = await fs.readFile(resolvedPath);
        logger.info('API: File read (binary)', { path: filePath, bytes: buffer.length });
        return res.json({
          success: true,
          encoding: 'base64',
          content: buffer.toString('base64'),
          byteLength: buffer.length
        });
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      logger.info('API: File read', { path: filePath });
      res.json({ success: true, content });
    } catch (error) {
      logger.error('API: Error reading file/directory', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.post('/files', async (req, res) => {
    try {
      const { path: filePath, content, isDirectory } = req.body;
      
      let fullPath, resolvedPath;
      
      if (filePath) {
        fullPath = path.join(baseDir, filePath);
        resolvedPath = path.resolve(fullPath);
      } else {
        const { path: dirPath, name, type } = req.body;
        if (!dirPath || !name || !type) {
          return res.json({ success: false, error: 'Missing required fields' });
        }
        fullPath = path.join(baseDir, dirPath, name);
        resolvedPath = path.resolve(fullPath);
      }

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access', { path: filePath || (req.body.dirPath + '/' + req.body.name) });
        return res.json({ success: false, error: 'Forbidden' });
      }

      try {
        await fs.access(resolvedPath);
        return res.json({ success: false, error: 'File or folder already exists' });
      } catch {
      }

      const shouldCreateDir = isDirectory !== undefined ? isDirectory : (req.body.type === 'folder');
      
      const finalPath = filePath || (req.body.dirPath + '/' + req.body.name);
      
      if (shouldCreateDir) {
        await fs.mkdir(resolvedPath, { recursive: true });
        logger.info('API: Folder created', { path: finalPath });
        // File watcher will automatically detect and notify via WebSocket
      } else {
        if (req.body.isBinary && content) {
          const buffer = Buffer.from(content, 'base64');
          await fs.writeFile(resolvedPath, buffer);
          logger.info('API: Binary file created', { path: finalPath, size: buffer.length });
        } else {
          await fs.writeFile(resolvedPath, content || '', 'utf-8');
          logger.info('API: File created', { path: finalPath });
        }
        // File watcher will automatically detect and notify via WebSocket
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error creating file/folder', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.get('/files/editor', async (req, res) => {
    try {
      const filePath = req.query.path;
      
      if (!filePath) {
        return res.json({ success: false, error: 'Missing file path' });
      }

      const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const editorPath = path.join(editorDir, normalizedPath);
      const resolvedEditorPath = path.resolve(editorPath);

      if (!isPathSafe(resolvedEditorPath, baseDir)) {
        return res.json({ success: false, error: 'Forbidden' });
      }

      try {
        const stats = await fs.stat(resolvedEditorPath);
        if (stats.isDirectory()) {
          return res.json({ success: false, exists: false });
        }
        const content = await fs.readFile(resolvedEditorPath, 'utf-8');
        return res.json({ success: true, exists: true, content });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.json({ success: true, exists: false });
        }
        throw error;
      }
    } catch (error) {
      logger.error('API: Error checking ide_editor_cache', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.post('/files/editor', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      
      if (!filePath || content === undefined) {
        logger.warn('API: Missing required fields for ide_editor_cache save', { filePath: !!filePath, content: content !== undefined });
        return res.json({ success: false, error: 'Missing required fields' });
      }

      const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const editorPath = path.join(editorDir, normalizedPath);
      const resolvedEditorPath = path.resolve(editorPath);
      const resolvedEditorDir = path.resolve(editorDir);

      if (!isPathSafe(resolvedEditorPath, baseDir) || !isPathSafe(resolvedEditorDir, baseDir)) {
        logger.warn('API: Forbidden path access', { path: filePath, normalizedPath, resolvedEditorPath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      await fs.mkdir(path.dirname(resolvedEditorPath), { recursive: true });
      await fs.writeFile(resolvedEditorPath, content, 'utf-8');
      logger.info('API: File saved to ide_editor_cache folder', { path: filePath, normalizedPath, size: content.length });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error saving to ide_editor_cache folder', { error: error.message, stack: error.stack, filePath: req.body.path });
      res.json({ success: false, error: error.message });
    }
  });

  router.put('/files', async (req, res) => {
    try {
      const { path: filePath, content, newPath, isDirectory } = req.body;
      
      if (newPath) {
        if (!filePath) {
          return res.json({ success: false, error: 'Missing file path' });
        }

        const fullPath = path.join(baseDir, filePath);
        const resolvedPath = path.resolve(fullPath);
        const newFullPath = path.join(baseDir, newPath);
        const newResolvedPath = path.resolve(newFullPath);

        if (!isPathSafe(resolvedPath, baseDir) || !isPathSafe(newResolvedPath, baseDir)) {
          logger.warn('API: Forbidden path access', { path: filePath, newPath });
          return res.json({ success: false, error: 'Forbidden' });
        }

        const sourceStats = await fs.stat(resolvedPath).catch(() => null);
        if (!sourceStats) {
          return res.json({ success: false, error: 'Source file/folder does not exist' });
        }

        const destExists = await fs.stat(newResolvedPath).catch(() => null);
        if (destExists) {
          return res.json({ success: false, error: 'Destination already exists' });
        }

        if (sourceStats.isDirectory()) {
          try {
            await fs.rename(resolvedPath, newResolvedPath);
          } catch (renameError) {
            if (renameError.code === 'EPERM' || renameError.code === 'EBUSY') {
              logger.info('API: Rename failed, using copy+delete for directory', { path: filePath, newPath, error: renameError.code });
              
              await copyDirectory(resolvedPath, newResolvedPath);
              
              let deleted = false;
              for (let attempt = 0; attempt < 5; attempt++) {
                try {
                  await fs.rm(resolvedPath, { recursive: true, force: true });
                  deleted = true;
                  break;
                } catch (deleteError) {
                  if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                  } else {
                    logger.warn('API: Could not delete original directory after copy', { path: filePath, error: deleteError.message });
                    deleted = true;
                  }
                }
              }
            } else {
              throw renameError;
            }
          }
        } else {
          await fs.rename(resolvedPath, newResolvedPath);
        }
        
        logger.info('API: File/folder renamed', { path: filePath, newPath });
        
        if (wsManager) {
          const stats = await fs.stat(newResolvedPath);
          const eventType = stats.isDirectory() ? 'unlinkDir' : 'unlink';
          wsManager.notifyFileChange(filePath, eventType);
          const addEventType = stats.isDirectory() ? 'addDir' : 'add';
          wsManager.notifyFileChange(newPath, addEventType);
        }
        
        return res.json({ success: true });
      }
      
      if (!filePath || content === undefined) {
        return res.json({ success: false, error: 'Missing required fields' });
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access', { path: filePath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      if (req.body.isBinary && typeof content === 'string') {
        const buffer = Buffer.from(content, 'base64');
        await fs.writeFile(resolvedPath, buffer);
        logger.info('API: Binary file saved', { path: filePath, bytes: buffer.length });
      } else {
        await fs.writeFile(resolvedPath, content, 'utf-8');
        logger.info('API: File saved', { path: filePath, size: (content && content.length) || 0 });
      }
      
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const editorPath = path.join(editorDir, filePath);
      const resolvedEditorPath = path.resolve(editorPath);
      
      try {
        if (isPathSafe(resolvedEditorPath, baseDir)) {
          await fs.unlink(resolvedEditorPath).catch(() => {});
        }
      } catch (error) {
      }
      
      if (wsManager) {
        wsManager.notifyFileChange(filePath, 'change');
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error updating file', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.delete('/files/editor', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        return res.json({ success: false, error: 'Missing file path' });
      }

      const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const editorPath = path.join(editorDir, normalizedPath);
      const resolvedEditorPath = path.resolve(editorPath);

      if (!isPathSafe(resolvedEditorPath, baseDir)) {
        return res.json({ success: false, error: 'Forbidden' });
      }

      try {
        await fs.unlink(resolvedEditorPath);
        logger.info('API: Cache file deleted', { path: filePath });
        return res.json({ success: true });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.json({ success: true });
        }
        throw error;
      }
    } catch (error) {
      logger.error('API: Error deleting cache file', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.delete('/files', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) {
        return res.json({ success: false, error: 'No file path provided' });
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access', { path: filePath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      const stats = await fs.stat(resolvedPath);
      const isDirectory = stats.isDirectory();
      
      if (isDirectory) {
        await fs.rmdir(resolvedPath, { recursive: true });
        logger.info('API: Folder deleted', { path: filePath });
        if (wsManager) {
          wsManager.notifyFileChange(filePath, 'unlinkDir');
        }
      } else {
        await fs.unlink(resolvedPath);
        logger.info('API: File deleted', { path: filePath });
        if (wsManager) {
          wsManager.notifyFileChange(filePath, 'unlink');
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error deleting file/folder', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.post('/restart', async (req, res) => {
    try {
      logger.info('Server restart requested via API');
      res.json({ success: true, message: 'Server restarting...' });
      
      // Use the shared restart function
      setTimeout(() => {
        const { restartServer } = require('../utils/serverRestart');
        restartServer();
      }, 100);
    } catch (error) {
      logger.error('API: Error restarting server', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.post('/terminal', async (req, res) => {
    try {
      const { command, type } = req.body;
      if (!command) {
        return res.json({ success: false, error: 'No command provided' });
      }

      if (type === 'powershell') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        logger.info('Executing PowerShell command', { command: command.substring(0, 100) });
        
        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: baseDir,
            shell: 'powershell.exe',
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000
          });
          
          logger.info('PowerShell command executed successfully', { 
            commandLength: command.length,
            outputLength: stdout ? stdout.length : 0
          });
          
          res.json({ 
            success: true, 
            output: stdout || '',
            error: stderr || null
          });
        } catch (error) {
          const exitCode = error.code;
          const hasOutput = error.stdout || error.stderr;
          
          logger.warn('PowerShell command execution', { 
            command: command.substring(0, 100),
            exitCode: exitCode,
            hasOutput: hasOutput
          });
          
          if (hasOutput) {
            res.json({ 
              success: true, 
              output: error.stdout || '',
              error: error.stderr || null
            });
          } else {
            res.json({ 
              success: false, 
              error: error.message || `Command failed with exit code ${exitCode}`,
              output: error.stdout || '',
              stderr: error.stderr || ''
            });
          }
        }
      } else {
        return res.json({ success: false, error: 'Unsupported terminal type' });
      }
    } catch (error) {
      logger.error('API: Error executing terminal command', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Minify source code/content similar to VS Code MinifyAll
  router.post('/minify', async (req, res) => {
    try {
      const { content, language, filePath } = req.body || {};
      if (typeof content !== 'string' || !content.length) {
        return res.json({ success: false, error: 'No content provided' });
      }

      const lowerLang = (language || '').toLowerCase();
      const lowerPath = (filePath || '').toLowerCase();

      const isHTML = lowerLang === 'html' || lowerPath.endsWith('.html') || lowerPath.endsWith('.htm');
      const isCSS = lowerLang === 'css' || lowerPath.endsWith('.css');
      const isJSON = lowerLang === 'json' || lowerPath.endsWith('.json');
      const isJSONC = lowerLang === 'jsonc' || lowerPath.endsWith('.jsonc');
      const isJS =
        lowerLang === 'javascript' ||
        lowerLang === 'js' ||
        lowerPath.endsWith('.js') ||
        lowerPath.endsWith('.mjs') ||
        lowerPath.endsWith('.cjs');

      let result = content;

      if (isHTML) {
        if (!htmlMinifier) {
          return res.json({ success: false, error: 'HTML minifier not installed (html-minifier-terser)' });
        }
        result = await htmlMinifier.minify(content, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          removeOptionalTags: false,
          minifyCSS: !!CleanCSS,
          minifyJS: !!terser
        });
      } else if (isCSS) {
        if (!CleanCSS) {
          return res.json({ success: false, error: 'CSS minifier not installed (clean-css)' });
        }
        const out = new CleanCSS({
          level: 2
        }).minify(content);
        if (out.errors && out.errors.length) {
          throw new Error(out.errors[0]);
        }
        result = out.styles;
      } else if (isJSON || isJSONC) {
        let text = content;
        if (isJSONC) {
          // Strip // and /* */ comments
          text = text.replace(/\/\/[^\n\r]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        }
        const parsed = JSON.parse(text);
        result = JSON.stringify(parsed);
      } else if (isJS) {
        if (!terser) {
          return res.json({ success: false, error: 'JS minifier not installed (terser)' });
        }
        const out = await terser.minify(content, {
          compress: true,
          mangle: true
        });
        if (out.error) {
          throw out.error;
        }
        result = out.code || '';
      } else {
        return res.json({ success: false, error: 'Unsupported language for minify' });
      }

      return res.json({
        success: true,
        minified: result,
        originalLength: content.length,
        minifiedLength: result.length
      });
    } catch (error) {
      logger.error('API: Minify error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Minify failed' });
    }
  });

  // Execute a single SSH command on a remote host
  router.post('/ssh', async (req, res) => {
    try {
      const {
        host,
        port = 22,
        username,
        password,
        privateKey,
        passphrase,
        authType,
        command
      } = req.body || {};

      if (!host || !username || !command) {
        return res.json({ success: false, error: 'Missing host, username, or command' });
      }

      // Require at least one auth method
      if (!password && !privateKey) {
        return res.json({ success: false, error: 'Missing password or privateKey' });
      }

      const effectiveAuthType = authType === 'key' || privateKey ? 'key' : 'password';

      logger.info('SSH: Executing remote command', {
        host,
        port,
        username,
        authType: effectiveAuthType,
        hasPassphrase: !!passphrase,
        command: String(command).substring(0, 200)
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      const result = await new Promise((resolve, reject) => {
        const conn = new SshClient();
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { conn.end(); } catch (_) {}
            reject(new Error('SSH command timed out'));
          }
        }, 30000);

        conn
          .on('ready', () => {
            conn.exec(command, (err, stream) => {
              if (err) {
                clearTimeout(timeout);
                if (!settled) {
                  settled = true;
                  conn.end();
                  return reject(err);
                }
                return;
              }

              stream.on('close', (code, signal) => {
                clearTimeout(timeout);
                if (!settled) {
                  settled = true;
                  conn.end();
                  resolve({
                    code,
                    signal,
                    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                    stderr: Buffer.concat(stderrChunks).toString('utf8')
                  });
                }
              });

              stream.on('data', (data) => {
                stdoutChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
              });

              stream.stderr.on('data', (data) => {
                stderrChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
              });
            });
          })
          .on('error', (err) => {
            clearTimeout(timeout);
            if (!settled) {
              settled = true;
              reject(err);
            }
          })
          .connect((() => {
            const cfg = {
              host,
              port,
              username,
              readyTimeout: 15000
            };

            if (effectiveAuthType === 'key') {
              cfg.privateKey = Buffer.from(privateKey, 'utf8');
              if (passphrase) {
                cfg.passphrase = passphrase;
              }
            } else {
              cfg.password = password;
            }

            return cfg;
          })());
      });

      logger.info('SSH: Command completed', {
        host,
        code: result.code,
        signal: result.signal
      });

      return res.json({
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code,
        signal: result.signal
      });
    } catch (error) {
      logger.error('API: SSH command error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'SSH command failed' });
    }
  });

  // Compress a file or folder into an archive (zip / 7z / tar.gz)
  router.post('/files/compress', async (req, res) => {
    try {
      const { path: filePath, format } = req.body || {};

      if (!filePath || !format) {
        return res.json({ success: false, error: 'Missing path or format' });
      }

      const allowedFormats = ['zip', '7z', 'tar.gz'];
      if (!allowedFormats.includes(format)) {
        return res.json({ success: false, error: 'Unsupported format' });
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access for compress', { path: filePath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      const stats = await fs.stat(resolvedPath).catch(() => null);
      if (!stats) {
        return res.json({ success: false, error: 'Source path does not exist' });
      }

      const parentDir = path.dirname(resolvedPath);
      const baseName = path.basename(resolvedPath);

      function buildOutputPath(ext) {
        let name = `${baseName}${ext}`;
        let candidate = path.join(parentDir, name);
        let counter = 1;
        while (fsSync.existsSync(candidate)) {
          name = `${baseName} (${counter})${ext}`;
          candidate = path.join(parentDir, name);
          counter += 1;
        }
        return candidate;
      }

      let outputPath;
      let outputExt;
      if (format === 'zip') {
        outputExt = '.zip';
      } else if (format === '7z') {
        outputExt = '.7z';
      } else {
        outputExt = '.tar.gz';
      }
      outputPath = buildOutputPath(outputExt);

      const platform = os.platform();
      let command;
      let args;
      let spawnOptions = { cwd: parentDir };

      if (format === 'zip') {
        if (platform === 'win32') {
          // Use PowerShell Compress-Archive on Windows
          const psCommand = [
            'Compress-Archive',
            '-Path',
            `"${resolvedPath}"`,
            '-DestinationPath',
            `"${outputPath}"`,
            '-Force'
          ].join(' ');
          command = 'powershell.exe';
          args = ['-NoLogo', '-NoProfile', '-Command', psCommand];
          spawnOptions = { cwd: parentDir, windowsHide: true };
        } else {
          // Use zip CLI on Unix-like systems
          command = 'zip';
          args = ['-r', outputPath, baseName];
        }
      } else if (format === '7z') {
        // 7-Zip CLI (must be installed on the system)
        command = '7z';
        args = ['a', '-t7z', outputPath, stats.isDirectory() ? baseName : baseName];
      } else {
        // tar.gz using tar
        command = 'tar';
        args = ['-czf', outputPath, baseName];
      }

      logger.info('API: Starting compression', { path: filePath, format, outputPath, command, args });

      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, spawnOptions);

        let stderr = '';

        child.stdout.on('data', (data) => {
          logger.debug('Compress stdout', { chunk: data.toString().slice(0, 200) });
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('error', (err) => {
          rejectPromise(err);
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolvePromise();
          } else {
            const error = new Error(stderr || `Compression failed with exit code ${code}`);
            rejectPromise(error);
          }
        });
      });

      const relativeOutput = path.relative(baseDir, outputPath).replace(/\\/g, '/');

      if (wsManager) {
        const rel = relativeOutput.startsWith('/') ? relativeOutput : '/' + relativeOutput;
        wsManager.notifyFileChange(rel, 'add');
      }

      logger.info('API: Compression successful', { path: filePath, format, output: relativeOutput });

      return res.json({
        success: true,
        outputFile: relativeOutput
      });
    } catch (error) {
      logger.error('API: Error compressing file/folder', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Compression failed' });
    }
  });

  // Extract an archive (zip / 7z / tar.gz) into its containing directory
  router.post('/files/extract', async (req, res) => {
    try {
      const { path: filePath } = req.body || {};

      if (!filePath) {
        return res.json({ success: false, error: 'Missing path' });
      }

      const fullPath = path.join(baseDir, filePath);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access for extract', { path: filePath });
        return res.json({ success: false, error: 'Forbidden' });
      }

      const stats = await fs.stat(resolvedPath).catch(() => null);
      if (!stats || !stats.isFile()) {
        return res.json({ success: false, error: 'Archive file does not exist' });
      }

      const extLower = filePath.toLowerCase();
      let format = null;
      if (extLower.endsWith('.zip')) {
        format = 'zip';
      } else if (extLower.endsWith('.7z')) {
        format = '7z';
      } else if (extLower.endsWith('.tar.gz') || extLower.endsWith('.tgz')) {
        format = 'tar.gz';
      } else {
        return res.json({ success: false, error: 'Unsupported archive format' });
      }

      const parentDir = path.dirname(resolvedPath);
      const platform = os.platform();
      let command;
      let args;
      let spawnOptions = { cwd: parentDir };

      if (format === 'zip') {
        if (platform === 'win32') {
          // Use PowerShell Expand-Archive on Windows
          const psCommand = [
            'Expand-Archive',
            '-Path',
            `"${resolvedPath}"`,
            '-DestinationPath',
            `"${parentDir}"`,
            '-Force'
          ].join(' ');
          command = 'powershell.exe';
          args = ['-NoLogo', '-NoProfile', '-Command', psCommand];
          spawnOptions = { cwd: parentDir, windowsHide: true };
        } else {
          // Use unzip on Unix-like systems
          command = 'unzip';
          args = ['-o', resolvedPath];
        }
      } else if (format === '7z') {
        command = '7z';
        args = ['x', resolvedPath, `-o${parentDir}`, '-y'];
      } else {
        // tar.gz
        command = 'tar';
        args = ['-xzf', resolvedPath, '-C', parentDir];
      }

      logger.info('API: Starting extraction', { path: filePath, format, command, args });

      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, spawnOptions);

        let stderr = '';

        child.stdout.on('data', (data) => {
          logger.debug('Extract stdout', { chunk: data.toString().slice(0, 200) });
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('error', (err) => {
          rejectPromise(err);
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolvePromise();
          } else {
            const error = new Error(stderr || `Extraction failed with exit code ${code}`);
            rejectPromise(error);
          }
        });
      });

      // Let the file watcher broadcast actual file additions; we can optionally poke the parent dir
      if (wsManager) {
        const relDir = path.relative(baseDir, parentDir).replace(/\\/g, '/');
        const dirPath = relDir.startsWith('/') ? relDir : '/' + relDir;
        wsManager.notifyFileChange(dirPath, 'addDir');
      }

      logger.info('API: Extraction successful', { path: filePath, format });

      return res.json({ success: true });
    } catch (error) {
      logger.error('API: Error extracting archive', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Extraction failed' });
    }
  });

  // Multi-language compilation/execution via Judge0 (remote sandbox)
  router.post('/compile', async (req, res) => {
    try {
      const {
        languageId,
        source,
        stdin,
        args,
        compilerOptions,
        commandLineArguments,
        timeLimit,
        memoryLimit
      } = req.body || {};

      const langIdNum = Number(languageId);
      if (!Number.isFinite(langIdNum) || langIdNum <= 0) {
        return res.json({ success: false, error: 'Invalid languageId' });
      }

      if (typeof source !== 'string' || source.trim().length === 0) {
        return res.json({ success: false, error: 'Missing source code' });
      }

      // Keep payload sane (the UI can still run large code, but we protect the server)
      if (source.length > 1_000_000) {
        return res.json({ success: false, error: 'Source code too large' });
      }
      if (typeof stdin === 'string' && stdin.length > 200_000) {
        return res.json({ success: false, error: 'stdin too large' });
      }

      const judge0Base = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
      const endpoint = `${judge0Base}/submissions?base64_encoded=false&wait=true`;

      const payload = {
        language_id: langIdNum,
        source_code: source,
        stdin: typeof stdin === 'string' ? stdin : '',
        // Judge0 supports these fields; safe to omit when not provided
        compiler_options: typeof compilerOptions === 'string' ? compilerOptions : undefined,
        command_line_arguments: typeof commandLineArguments === 'string' ? commandLineArguments : undefined,
        args: typeof args === 'string' ? args : undefined,
        cpu_time_limit: Number.isFinite(Number(timeLimit)) ? Number(timeLimit) : undefined,
        memory_limit: Number.isFinite(Number(memoryLimit)) ? Number(memoryLimit) : undefined
      };

      logger.info('API: Compile request', {
        languageId: langIdNum,
        sourceLength: source.length,
        stdinLength: typeof stdin === 'string' ? stdin.length : 0,
        endpoint: judge0Base
      });

      const controller = new AbortController();
      const timeoutMs = 60_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let judgeRes;
      try {
        judgeRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!judgeRes.ok) {
        const text = await judgeRes.text().catch(() => '');
        logger.warn('API: Compile upstream error', { status: judgeRes.status, text: text.substring(0, 500) });
        return res.json({ success: false, error: `Compiler service error (${judgeRes.status})` });
      }

      const result = await judgeRes.json();

      // Normalize response for UI
      return res.json({
        success: true,
        result: {
          token: result.token || null,
          status: result.status || null,
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          compile_output: result.compile_output || '',
          message: result.message || '',
          time: result.time || null,
          memory: result.memory || null,
          exit_code: result.exit_code ?? null
        }
      });
    } catch (error) {
      const isAbort = error && (error.name === 'AbortError' || String(error.message || '').includes('aborted'));
      logger.error('API: Compile error', { message: error.message, stack: error.stack, isAbort });
      return res.json({ success: false, error: isAbort ? 'Compile request timed out' : (error.message || 'Compile failed') });
    }
  });

  // Local JS runner (Node.js) - allows require()/import and local file access like VS Code.
  // NOTE: This executes code on the user's machine. Keep timeouts and output limits.
  router.post('/run/node', async (req, res) => {
    try {
      const { source, stdin, moduleType, filePath } = req.body || {};

      if (typeof source !== 'string' || source.trim().length === 0) {
        return res.json({ success: false, error: 'Missing source code' });
      }
      if (source.length > 1_000_000) {
        return res.json({ success: false, error: 'Source code too large' });
      }
      if (typeof stdin === 'string' && stdin.length > 200_000) {
        return res.json({ success: false, error: 'stdin too large' });
      }

      // Optional: if a filePath is provided, ensure it's within baseDir (for display only; we execute source anyway)
      if (typeof filePath === 'string' && filePath.trim()) {
        const fullPath = path.join(baseDir, filePath);
        const resolvedPath = path.resolve(fullPath);
        if (!isPathSafe(resolvedPath, baseDir)) {
          return res.json({ success: false, error: 'Forbidden filePath' });
        }
      }

      const type = moduleType === 'esm' ? 'esm' : 'cjs';

      // Place the temp file next to the "virtual" file so relative requires like "./config" work.
      let targetDir = path.join(baseDir, 'ide_editor_cache', '.run');
      if (typeof filePath === 'string' && filePath.trim()) {
        const normalized = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
        const virtualFull = path.join(baseDir, normalized);
        const resolvedVirtual = path.resolve(virtualFull);
        if (isPathSafe(resolvedVirtual, baseDir)) {
          targetDir = path.dirname(resolvedVirtual);
        }
      }

      if (!fsSync.existsSync(targetDir)) {
        fsSync.mkdirSync(targetDir, { recursive: true });
      }

      const ext = type === 'esm' ? '.mjs' : '.cjs';
      const tmpFile = path.join(targetDir, `.__run-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
      await fs.writeFile(tmpFile, source, 'utf8');

      // Use the Node binary running this server.
      const nodeBin = process.execPath;
      const args = [tmpFile];

      const child = spawn(nodeBin, args, {
        cwd: baseDir,
        windowsHide: true,
        env: {
          ...process.env,
          // Make sure relative requires resolve like a project run
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      });

      let stdout = '';
      let stderr = '';
      const maxOut = 2 * 1024 * 1024; // 2MB combined

      const killTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 15_000);

      child.stdout.on('data', (d) => {
        if (stdout.length + stderr.length >= maxOut) return;
        stdout += d.toString('utf8');
      });
      child.stderr.on('data', (d) => {
        if (stdout.length + stderr.length >= maxOut) return;
        stderr += d.toString('utf8');
      });

      child.on('error', async (err) => {
        clearTimeout(killTimer);
        try { await fs.unlink(tmpFile); } catch {}
        return res.json({ success: false, error: err.message || 'Failed to start Node' });
      });

      // Write stdin then close
      if (typeof stdin === 'string' && stdin.length) {
        try {
          child.stdin.write(stdin);
        } catch {}
      }
      try { child.stdin.end(); } catch {}

      child.on('close', async (code, signal) => {
        clearTimeout(killTimer);
        try { await fs.unlink(tmpFile); } catch {}

        const timedOut = signal === 'SIGKILL' || signal === 'SIGTERM';
        if (timedOut) {
          return res.json({
            success: true,
            result: {
              status: { description: 'Time Limit Exceeded' },
              stdout,
              stderr: stderr || 'Process timed out',
              exit_code: null,
              runner: 'local-node',
              moduleType: type
            }
          });
        }

        return res.json({
          success: true,
          result: {
            status: { description: code === 0 ? 'Accepted' : 'Runtime Error' },
            stdout,
            stderr,
            exit_code: code,
            runner: 'local-node',
            moduleType: type
          }
        });
      });
    } catch (error) {
      logger.error('API: Local Node run error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Local run failed' });
    }
  });

  // Start a long-running local Node process and stream logs via polling.
  router.post('/run/node/start', async (req, res) => {
    try {
      const { source, stdin, moduleType, filePath } = req.body || {};

      if (typeof source !== 'string' || source.trim().length === 0) {
        return res.json({ success: false, error: 'Missing source code' });
      }
      if (source.length > 1_000_000) {
        return res.json({ success: false, error: 'Source code too large' });
      }
      if (typeof stdin === 'string' && stdin.length > 200_000) {
        return res.json({ success: false, error: 'stdin too large' });
      }

      let type = moduleType === 'esm' ? 'esm' : 'cjs';

      // Place the temp file next to the "virtual" file so relative requires like "./config" work.
      let targetDir = path.join(baseDir, 'ide_editor_cache', '.run');
      let normalizedPath = null;
      if (typeof filePath === 'string' && filePath.trim()) {
        normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
        const virtualFull = path.join(baseDir, normalizedPath);
        const resolvedVirtual = path.resolve(virtualFull);
        if (isPathSafe(resolvedVirtual, baseDir)) {
          targetDir = path.dirname(resolvedVirtual);
        }
      }

      if (!fsSync.existsSync(targetDir)) {
        fsSync.mkdirSync(targetDir, { recursive: true });
      }

      const ext = type === 'esm' ? '.mjs' : '.cjs';
      const tmpFile = path.join(targetDir, `.__run-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
      await fs.writeFile(tmpFile, source, 'utf8');

      const nodeBin = process.execPath;
      const args = [tmpFile];

      const child = spawn(nodeBin, args, {
        cwd: baseDir,
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      });

      const runId = crypto.randomBytes(8).toString('hex');
      const logs = [];

      const record = {
        child,
        logs,
        exited: false,
        exitCode: null,
        runner: 'local-node',
        moduleType: type,
        tmpFile
      };
      activeNodeRuns.set(runId, record);

      const maxOut = 2 * 1024 * 1024; // 2MB combined

      function pushLog(typeLog, chunk) {
        if (!chunk) return;
        const text = chunk.toString('utf8');
        if (!text.trim()) return;
        const currentSize = logs.reduce((acc, l) => acc + (l.text ? l.text.length : 0), 0);
        if (currentSize >= maxOut) return;
        logs.push({
          type: typeLog,
          text,
          timestamp: Date.now()
        });
      }

      child.stdout.on('data', (d) => pushLog('stdout', d));
      child.stderr.on('data', (d) => pushLog('stderr', d));

      child.on('error', (err) => {
        pushLog('stderr', err.message || 'Process error');
      });

      child.on('close', async (code, signal) => {
        record.exited = true;
        record.exitCode = code;
        const desc =
          signal === 'SIGKILL' || signal === 'SIGTERM'
            ? 'Killed'
            : code === 0
              ? 'Accepted'
              : 'Runtime Error';
        pushLog('info', `\n[process exited] status=${desc} code=${code ?? 'null'} signal=${signal || 'null'}\n`);
        try {
          await fs.unlink(tmpFile);
        } catch {}
        // Keep record in map so client can read final logs; it will be cleaned up on kill/logs after exit.
      });

      // Optional initial stdin write (non-streaming)
      if (typeof stdin === 'string' && stdin.length) {
        try {
          child.stdin.write(stdin);
        } catch {}
      }
      try {
        child.stdin.end();
      } catch {}

      logger.info('API: Local Node run started', { runId, moduleType: type, filePath: normalizedPath || filePath || null });

      return res.json({ success: true, runId });
    } catch (error) {
      logger.error('API: Local Node start error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Failed to start local run' });
    }
  });

  // Poll logs for a running local Node process
  router.get('/run/node/logs', async (req, res) => {
    try {
      const runId = req.query.runId;
      const cursor = parseInt(req.query.cursor || '0', 10) || 0;
      if (!runId || !activeNodeRuns.has(runId)) {
        return res.json({ success: false, error: 'Run not found', notFound: true });
      }

      const record = activeNodeRuns.get(runId);
      const { logs, exited, exitCode, runner, moduleType } = record;

      const slice = logs.slice(cursor);
      const nextCursor = logs.length;

      // Auto cleanup small finished runs when client has read everything
      let cleanedUp = false;
      if (exited && nextCursor === logs.length) {
        // Caller might call once more; we leave cleanup decision to client via /kill or timeout.
        cleanedUp = false;
      }

      return res.json({
        success: true,
        runId,
        cursor: nextCursor,
        logs: slice,
        exited,
        exitCode,
        runner: runner || 'local-node',
        moduleType,
        cleanedUp
      });
    } catch (error) {
      logger.error('API: Local Node logs error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Failed to read logs' });
    }
  });

  // Kill a running local Node process
  router.post('/run/node/kill', async (req, res) => {
    try {
      const { runId } = req.body || {};
      if (!runId || !activeNodeRuns.has(runId)) {
        return res.json({ success: false, error: 'Run not found', notFound: true });
      }

      const record = activeNodeRuns.get(runId);
      const { child, logs, tmpFile } = record;

      if (!record.exited && child && !child.killed) {
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!record.exited && child && !child.killed) {
              try {
                child.kill('SIGKILL');
              } catch {}
            }
          }, 2000);
        } catch (err) {
          logger.warn('API: Error killing local Node process', { runId, error: err.message });
        }
      }

      logs.push({
        type: 'info',
        text: '\n[process killed by user]\n',
        timestamp: Date.now()
      });

      record.exited = true;

      try {
        await fs.unlink(tmpFile);
      } catch {}

      activeNodeRuns.delete(runId);

      return res.json({ success: true });
    } catch (error) {
      logger.error('API: Local Node kill error', { message: error.message, stack: error.stack });
      return res.json({ success: false, error: error.message || 'Failed to kill process' });
    }
  });

  router.get('/theme', async (req, res) => {
    try {
      const themeName = req.query.name || 'dark';
      const validThemes = [
        'dark', 'light', 'high-contrast',
        'liquid-glass-blue', 'liquid-glass-purple', 'liquid-glass-green', 'liquid-glass-amber',
        'fog-gray', 'fog-blue',
        'neon-cyan', 'sunset', 'ocean', 'forest',
        'matrix', 'midnight-purple', 'amber-warm',
        'arctic', 'rose-gold', 'cyberpunk', 'space',
        'fire', 'ice', 'lavender', 'emerald', 'sakura',
        'volcanic', 'aurora', 'retro-80s', 'mint',
        'crimson', 'deep-sea', 'golden-hour', 'storm', 'candy',
        'bubbles', 'custom'
      ];
      
      if (themeName === 'custom') {
        return res.status(200).send('');
      }
      
      if (!validThemes.includes(themeName)) {
        return res.status(400).send('Invalid theme name');
      }
      
      const themePath = path.join(__dirname, '..', 'templates', 'css', 'themes', `${themeName}.css`);
      const themeContent = await fs.readFile(themePath, 'utf-8');
      
      res.setHeader('Content-Type', 'text/css');
      res.send(themeContent);
    } catch (error) {
      logger.error('API: Error loading theme', error);
      res.status(500).send('Error loading theme');
    }
  });

  router.get('/files/list-all', async (req, res) => {
    try {
      const allFiles = [];
      
      async function walkDirectory(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            // Skip ide_editor_cache directory
            if (entry.name.toLowerCase() === 'ide_editor_cache' && entry.isDirectory()) {
              continue;
            }
            
            const fullPath = path.join(dirPath, entry.name);
            const resolvedPath = path.resolve(fullPath);
            
            // Safety check
            if (!isPathSafe(resolvedPath, baseDir)) {
              continue;
            }
            
            if (entry.isDirectory()) {
              await walkDirectory(fullPath);
            } else {
              const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
              allFiles.push({
                name: entry.name,
                path: relativePath.startsWith('/') ? relativePath : '/' + relativePath
              });
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.debug('Error walking directory', { dirPath, error: error.message });
          }
        }
      }
      
      await walkDirectory(baseDir);
      
      // Sort by name for better UX
      allFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      logger.debug('Files: Listed all files', { count: allFiles.length });
      res.json({ success: true, files: allFiles });
    } catch (error) {
      logger.error('API: Error listing all files', error);
      res.json({ success: false, error: error.message });
    }
  });

  router.post('/search', async (req, res) => {
    const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024;
    const MAX_PATHS_PER_SEARCH_REQUEST = 300;

    function normalizeProjectRelativePath(filePath) {
      return String(filePath || '')
        .replace(/^\/+/, '')
        .replace(/\\/g, '/');
    }

    try {
      const { query, caseSensitive = false, wholeWord = false, paths: pathList } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.json({ success: true, results: [] });
      }

      const searchQuery = query.trim();
      const results = [];
      let filesSearched = 0;

      let regexPattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) {
        regexPattern = `\\b${regexPattern}\\b`;
      }

      /** Minified / single-line files can be megabytes; keep previews small for UI + JSON. */
      const MAX_MATCH_PREVIEW_CHARS = 480;

      function compactMatchPreview(line, matchIndex, matchLength) {
        const maxTotal = MAX_MATCH_PREVIEW_CHARS;
        if (!line || line.length <= maxTotal) {
          return line.trim();
        }
        const len = matchLength > 0 ? matchLength : 1;
        const center = matchIndex + Math.floor(len / 2);
        let start = Math.max(0, center - Math.floor(maxTotal / 2));
        let end = start + maxTotal;
        if (end > line.length) {
          end = line.length;
          start = Math.max(0, end - maxTotal);
        }
        let out = line.slice(start, end);
        if (start > 0) {
          out = '…' + out;
        }
        if (end < line.length) {
          out = out + '…';
        }
        return out.trim();
      }

      async function searchInFile(filePath) {
        try {
          const rel = normalizeProjectRelativePath(filePath);
          const fullPath = path.join(baseDir, rel);
          const resolvedPath = path.resolve(fullPath);

          if (!isPathSafe(resolvedPath, baseDir)) {
            return null;
          }

          const stats = await fs.stat(resolvedPath);
          if (stats.isDirectory()) {
            return null;
          }
          if (stats.size > MAX_SEARCH_FILE_BYTES) {
            return null;
          }

          const content = await fs.readFile(resolvedPath, 'utf-8');
          const lines = content.split('\n');
          const matches = [];

          lines.forEach((line, lineNum) => {
            let match;
            const lineRegex = new RegExp(regexPattern, caseSensitive ? 'g' : 'gi');
            while ((match = lineRegex.exec(line)) !== null) {
              matches.push({
                line: lineNum + 1,
                text: compactMatchPreview(line, match.index, match[0].length),
                matchIndex: match.index,
                matchLength: match[0].length
              });
              if (match[0].length === 0) break;
            }
          });

          if (matches.length > 0) {
            const displayPath = '/' + rel;
            return {
              filePath: displayPath,
              name: path.posix.basename(rel) || path.basename(rel),
              matches: matches.slice(0, 10)
            };
          }

          return null;
        } catch (error) {
          if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
            logger.debug('Error searching in file', { filePath, error: error.message });
          }
          return null;
        }
      }

      if (Array.isArray(pathList) && pathList.length > 0) {
        if (pathList.length > MAX_PATHS_PER_SEARCH_REQUEST) {
          return res.status(400).json({
            success: false,
            error: `Too many paths in one request (max ${MAX_PATHS_PER_SEARCH_REQUEST})`
          });
        }
        for (let i = 0; i < pathList.length; i++) {
          filesSearched++;
          const result = await searchInFile(pathList[i]);
          if (result) {
            results.push(result);
          }
        }
        logger.debug('Search: Batch completed', {
          query: searchQuery,
          filesSearched,
          resultsCount: results.length
        });
        return res.json({ success: true, results, filesSearched });
      }

      async function walkAndSearch(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name.toLowerCase() === 'ide_editor_cache' && entry.isDirectory()) {
              continue;
            }

            const fullPath = path.join(dirPath, entry.name);
            const resolvedPath = path.resolve(fullPath);

            if (!isPathSafe(resolvedPath, baseDir)) {
              continue;
            }

            if (entry.isDirectory()) {
              await walkAndSearch(fullPath);
            } else {
              filesSearched++;
              const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
              const filePath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
              const result = await searchInFile(filePath);
              if (result) {
                results.push(result);
              }
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.debug('Error walking directory for search', { dirPath, error: error.message });
          }
        }
      }

      await walkAndSearch(baseDir);

      logger.debug('Search: Completed', { query: searchQuery, filesSearched, resultsCount: results.length });
      res.json({ success: true, results, filesSearched });
    } catch (error) {
      logger.error('API: Error performing search', error);
      res.json({ success: false, error: error.message });
    }
  });

  /**
   * Replace all occurrences of `query` with `replacement` across files (text only).
   * Body: { query, replacement, caseSensitive?, wholeWord?, dryRun?, paths?: string[] }
   * When `paths` is provided, only those files; otherwise full workspace walk (heavy).
   * Use `dryRun: true` to count matches without writing.
   */
  router.post('/search/replace-in-files', async (req, res) => {
    const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024;
    const MAX_PATHS_PER_REPLACE_REQUEST = 300;

    function normalizeProjectRelativePath(filePath) {
      return String(filePath || '')
        .replace(/^\/+/, '')
        .replace(/\\/g, '/');
    }

    function escapeReplaceRegex(str) {
      return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildReplaceRegex(searchQuery, caseSensitive, wholeWord) {
      let pattern = escapeReplaceRegex(searchQuery);
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }

    function countMatchesInString(content, regex) {
      const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
      let count = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        count++;
        if (m[0].length === 0) {
          re.lastIndex += 1;
        }
      }
      return count;
    }

    function replaceAllLiteral(content, regex, replacementText) {
      const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
      return content.replace(re, () => replacementText);
    }

    try {
      const {
        query,
        replacement = '',
        caseSensitive = false,
        wholeWord = false,
        dryRun = false,
        paths: pathList
      } = req.body;

      if (!query || typeof query !== 'string') {
        return res.json({ success: false, error: 'Missing search query' });
      }
      if (typeof replacement !== 'string') {
        return res.json({ success: false, error: 'Replacement must be a string' });
      }

      const searchQuery = query;
      const regex = buildReplaceRegex(searchQuery, caseSensitive, wholeWord);
      const fileResults = [];
      let filesTouched = 0;
      let totalReplacements = 0;

      async function processFile(displayPath) {
        const rel = normalizeProjectRelativePath(displayPath);
        const fullPath = path.join(baseDir, rel);
        const resolvedPath = path.resolve(fullPath);

        if (!isPathSafe(resolvedPath, baseDir)) {
          return null;
        }

        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
          return null;
        }
        if (stats.size > MAX_SEARCH_FILE_BYTES) {
          return null;
        }

        let content;
        try {
          content = await fs.readFile(resolvedPath, 'utf-8');
        } catch (readErr) {
          if (readErr.code === 'ENOENT' || readErr.code === 'EACCES') {
            return null;
          }
          return null;
        }

        const matches = countMatchesInString(content, regex);
        if (matches === 0) {
          return null;
        }

        const outPath = '/' + rel;

        if (dryRun) {
          return { filePath: outPath, matches };
        }

        const newContent = replaceAllLiteral(content, regex, replacement);
        await fs.writeFile(resolvedPath, newContent, 'utf-8');

        const editorDir = path.join(baseDir, 'ide_editor_cache');
        const editorPath = path.join(editorDir, rel);
        const resolvedEditorPath = path.resolve(editorPath);
        try {
          if (isPathSafe(resolvedEditorPath, baseDir)) {
            await fs.unlink(resolvedEditorPath).catch(() => {});
          }
        } catch (_e) {
          /* ignore */
        }

        if (wsManager) {
          wsManager.notifyFileChange(outPath.replace(/^\//, '') || rel, 'change');
        }

        return { filePath: outPath, matches, modified: true };
      }

      if (Array.isArray(pathList) && pathList.length > 0) {
        if (pathList.length > MAX_PATHS_PER_REPLACE_REQUEST) {
          return res.status(400).json({
            success: false,
            error: `Too many paths in one request (max ${MAX_PATHS_PER_REPLACE_REQUEST})`
          });
        }
        for (let i = 0; i < pathList.length; i++) {
          filesTouched++;
          const r = await processFile(pathList[i]);
          if (r) {
            fileResults.push(r);
            totalReplacements += r.matches;
          }
        }
        return res.json({
          success: true,
          dryRun,
          files: fileResults,
          filesSearched: filesTouched,
          totalMatches: totalReplacements,
          filesWithMatches: fileResults.length
        });
      }

      async function walkAndReplace(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name.toLowerCase() === 'ide_editor_cache' && entry.isDirectory()) {
              continue;
            }

            const fullPath = path.join(dirPath, entry.name);
            const resolvedPath = path.resolve(fullPath);

            if (!isPathSafe(resolvedPath, baseDir)) {
              continue;
            }

            if (entry.isDirectory()) {
              await walkAndReplace(fullPath);
            } else {
              filesTouched++;
              const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
              const filePath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
              const r = await processFile(filePath);
              if (r) {
                fileResults.push(r);
                totalReplacements += r.matches;
              }
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.debug('Error walking directory for replace-in-files', { dirPath, error: error.message });
          }
        }
      }

      await walkAndReplace(baseDir);

      logger.debug('Replace in files: completed', {
        dryRun,
        query: searchQuery,
        filesSearched: filesTouched,
        totalMatches: totalReplacements
      });

      res.json({
        success: true,
        dryRun,
        files: fileResults,
        filesSearched: filesTouched,
        totalMatches: totalReplacements,
        filesWithMatches: fileResults.length
      });
    } catch (error) {
      logger.error('API: Error in replace-in-files', error);
      res.json({ success: false, error: error.message });
    }
  });

  /** Run git in the workspace folder (uses .git like any other IDE). */
  function runGitCmd(args) {
    return execFileAsync('git', args, {
      cwd: baseDir,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
  }

  function parseGitStatusPorcelain(stdout) {
    const lines = stdout.split(/\r?\n/).filter((l) => l.length > 0);
    const branch = { name: '', tracking: '', ahead: 0, behind: 0, detached: false, noCommits: false };
    const files = [];
    for (const line of lines) {
      if (line.startsWith('##')) {
        const rest = line.slice(3).trim();
        const detachedMatch = rest.match(/^HEAD \(detached at ([^)]+)\)/);
        if (detachedMatch) {
          branch.detached = true;
          branch.name = detachedMatch[1];
          continue;
        }
        const noCommits = rest.match(/^No commits yet on (.+)$/);
        if (noCommits) {
          branch.noCommits = true;
          branch.name = noCommits[1].trim();
          continue;
        }
        const ab = rest.match(/\[ahead (\d+)(?:,\s*behind (\d+))?\]/);
        if (ab) {
          branch.ahead = parseInt(ab[1], 10) || 0;
          branch.behind = parseInt(ab[2], 10) || 0;
        }
        const m = rest.match(/^([^\s.]+)(?:\.\.\.([^\s\[]+))?/);
        if (m) {
          branch.name = m[1] || branch.name;
          branch.tracking = m[2] || '';
        }
        continue;
      }
      if (line.startsWith('!!')) continue;
      if (line.startsWith('??')) {
        files.push({ path: line.slice(3).trim(), xy: '??', untracked: true });
        continue;
      }
      const xy = line.slice(0, 2);
      const pathRaw = line.slice(3);
      if (pathRaw.includes(' -> ')) {
        const parts = pathRaw.split(' -> ');
        const to = parts[parts.length - 1].trim();
        const from = parts.slice(0, -1).join(' -> ').trim();
        files.push({ path: to, pathFrom: from, xy, rename: true });
        continue;
      }
      files.push({
        path: pathRaw.trim(),
        xy,
        index: xy[0],
        worktree: xy[1],
      });
    }
    return { branch, files };
  }

  function gitPathError(relPath) {
    const resolved = path.resolve(baseDir, relPath);
    if (!isPathSafe(resolved, baseDir)) {
      return 'Forbidden path';
    }
    return null;
  }

  function parseGitShortstat(stdout) {
    const s = String(stdout || '').trim();
    if (!s) {
      return { filesChanged: 0, insertions: 0, deletions: 0 };
    }
    const fm = s.match(/(\d+) files? changed/);
    const im = s.match(/(\d+) insertions?\(\+\)/) || s.match(/(\d+) insertions?/);
    const dm = s.match(/(\d+) deletions?\(-\)/) || s.match(/(\d+) deletions?/);
    return {
      filesChanged: fm ? parseInt(fm[1], 10) : 0,
      insertions: im ? parseInt(im[1], 10) : 0,
      deletions: dm ? parseInt(dm[1], 10) : 0,
    };
  }

  /** Lines from `git show --name-status --pretty=format:` (tab-separated). */
  function parseGitShowNameStatus(stdout) {
    const files = [];
    const lines = String(stdout || '').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split('\t');
      if (parts.length < 2) continue;
      const statusRaw = parts[0].trim();
      if (parts.length === 2) {
        files.push({ status: statusRaw, path: parts[1].trim() });
      } else {
        files.push({
          status: statusRaw,
          oldPath: parts[1].trim(),
          path: parts[parts.length - 1].trim(),
        });
      }
    }
    return files;
  }

  /** Lines from `git show --numstat --pretty=format:` (ins \\t del \\t path). */
  function parseGitShowNumstat(stdout) {
    const map = new Map();
    const lines = String(stdout || '').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split('\t');
      if (parts.length < 3) continue;
      const insStr = parts[0];
      const delStr = parts[1];
      const filePath = parts.slice(2).join('\t').trim();
      let insertions = null;
      let deletions = null;
      if (insStr === '-' && delStr === '-') {
        insertions = null;
        deletions = null;
      } else {
        insertions = insStr === '-' ? 0 : parseInt(insStr, 10) || 0;
        deletions = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
      }
      map.set(filePath, { insertions, deletions });
    }
    return map;
  }

  function mergeFilesWithNumstat(files, numMap) {
    return files.map((f) => {
      let stats = numMap.get(f.path);
      if (stats == null && f.oldPath) {
        stats = numMap.get(f.oldPath);
      }
      if (stats == null) {
        stats = { insertions: null, deletions: null };
      }
      return {
        status: f.status,
        path: f.path,
        oldPath: f.oldPath,
        insertions: stats.insertions,
        deletions: stats.deletions,
      };
    });
  }

  function buildGithubCommitUrl(remoteUrl, fullHash) {
    if (!remoteUrl || !fullHash) return '';
    const s = String(remoteUrl).trim();
    const gitSsh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i.exec(s);
    if (gitSsh) {
      const repo = gitSsh[2].replace(/\.git$/i, '');
      return `https://github.com/${gitSsh[1]}/${repo}/commit/${fullHash}`;
    }
    const sshUrl = /^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i.exec(s);
    if (sshUrl) {
      const repo = sshUrl[2].replace(/\.git$/i, '');
      return `https://github.com/${sshUrl[1]}/${repo}/commit/${fullHash}`;
    }
    const https = /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i.exec(s);
    if (https) {
      const repo = https[2].replace(/\.git$/i, '');
      return `https://github.com/${https[1]}/${repo}/commit/${fullHash}`;
    }
    return '';
  }

  router.get('/git/repo-status', async (req, res) => {
    try {
      await runGitCmd(['rev-parse', '--is-inside-work-tree']);
    } catch (e) {
      return res.json({ success: true, isRepo: false });
    }
    try {
      let branchName = '';
      try {
        const { stdout } = await runGitCmd(['branch', '--show-current']);
        branchName = stdout.trim();
      } catch (_e) {
        /* detached or empty */
      }
      const { stdout: stOut } = await runGitCmd(['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-b']);
      const parsed = parseGitStatusPorcelain(stOut);
      const b = parsed.branch;
      if (branchName) {
        b.name = branchName;
      }
      res.json({
        success: true,
        isRepo: true,
        branch: b.name || '(unknown)',
        tracking: b.tracking || '',
        ahead: b.ahead,
        behind: b.behind,
        detached: b.detached,
        noCommits: b.noCommits,
        files: parsed.files,
      });
    } catch (error) {
      logger.error('API: git repo-status', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, isRepo: false, error: msg.trim() });
    }
  });

  router.post('/git/stage', async (req, res) => {
    try {
      const paths = req.body && Array.isArray(req.body.paths) ? req.body.paths : [];
      if (paths.length === 0) {
        return res.json({ success: false, error: 'No paths' });
      }
      for (const p of paths) {
        const err = gitPathError(p);
        if (err) {
          return res.json({ success: false, error: err });
        }
      }
      await runGitCmd(['add', '--', ...paths]);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git stage', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/unstage', async (req, res) => {
    try {
      const paths = req.body && Array.isArray(req.body.paths) ? req.body.paths : [];
      if (paths.length === 0) {
        return res.json({ success: false, error: 'No paths' });
      }
      for (const p of paths) {
        const err = gitPathError(p);
        if (err) {
          return res.json({ success: false, error: err });
        }
      }
      await runGitCmd(['reset', 'HEAD', '--', ...paths]);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git unstage', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/stage-all', async (req, res) => {
    try {
      await runGitCmd(['add', '-A']);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git stage-all', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/unstage-all', async (req, res) => {
    try {
      await runGitCmd(['reset', 'HEAD']);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git unstage-all', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/commit', async (req, res) => {
    try {
      const message = req.body && typeof req.body.message === 'string' ? req.body.message.trim() : '';
      if (!message) {
        return res.json({ success: false, error: 'Missing commit message' });
      }
      await runGitCmd(['commit', '-m', message]);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git commit', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/fetch', async (req, res) => {
    try {
      await runGitCmd(['fetch']);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git fetch', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/pull', async (req, res) => {
    try {
      await runGitCmd(['pull', '--no-edit']);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git pull', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.post('/git/push', async (req, res) => {
    try {
      await runGitCmd(['push']);
      res.json({ success: true });
    } catch (error) {
      logger.error('API: git push', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      res.json({ success: false, error: msg.trim() });
    }
  });

  router.get('/git/log', async (req, res) => {
    try {
      await runGitCmd(['rev-parse', '--is-inside-work-tree']);
    } catch (_e) {
      return res.json({ success: true, isRepo: false, branch: '', commits: [] });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 80, 1), 200);
    let headHash = '';
    try {
      const { stdout: hOut } = await runGitCmd(['rev-parse', 'HEAD']);
      headHash = hOut.trim();
    } catch (_e) {
      /* empty repo */
    }
    let branch = '';
    try {
      const { stdout: bOut } = await runGitCmd(['branch', '--show-current']);
      branch = bOut.trim();
    } catch (_e) {
      /* detached */
    }
    const sep = '\x01';
    const fmt = '%H' + sep + '%s' + sep + '%an' + sep + '%ai';
    let stdout = '';
    try {
      const out = await runGitCmd([
        '-c',
        'core.quotepath=false',
        'log',
        '-n',
        String(limit),
        '--pretty=format:' + fmt,
      ]);
      stdout = out.stdout || '';
    } catch (error) {
      logger.warn('API: git log empty or error', { message: error.message });
      return res.json({
        success: true,
        isRepo: true,
        branch: branch,
        commits: [],
        error: (error.stderr && String(error.stderr)) || error.message,
      });
    }
    const commits = [];
    const lines = stdout.split(/\r?\n/).filter((l) => l.length > 0);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const p = line.split(sep);
      if (p.length < 4) continue;
      const hash = p[0];
      const subject = p[1] || '';
      const author = p[2] || '';
      const date = p[3] || '';
      commits.push({
        hash: hash,
        subject: subject,
        author: author,
        date: date,
        isHead: !!(headHash && hash === headHash),
      });
    }
    res.json({ success: true, isRepo: true, branch: branch, commits: commits });
  });

  router.get('/git/commit-info', async (req, res) => {
    const raw = req.query && req.query.hash != null ? String(req.query.hash) : '';
    const hashInput = raw.trim();
    if (!/^[0-9a-fA-F]{7,40}$/.test(hashInput)) {
      return res.json({ success: false, error: 'Invalid hash' });
    }
    try {
      await runGitCmd(['rev-parse', '--is-inside-work-tree']);
    } catch (_e) {
      return res.json({ success: false, error: 'Not a git repository' });
    }
    let fullHash = '';
    try {
      const { stdout } = await runGitCmd(['rev-parse', '--verify', `${hashInput}^{commit}`]);
      fullHash = stdout.trim();
    } catch (_e) {
      return res.json({ success: false, error: 'Invalid commit' });
    }
    let author = '';
    let email = '';
    let dateIso = '';
    let subject = '';
    try {
      const { stdout: m1 } = await runGitCmd([
        'log',
        '-1',
        '--format=%an%x01%ae%x01%aI%x01%s',
        '--no-patch',
        fullHash,
      ]);
      const p1 = m1.split('\x01');
      author = (p1[0] || '').trim();
      email = (p1[1] || '').trim();
      dateIso = (p1[2] || '').trim();
      subject = (p1[3] || '').trim();
    } catch (error) {
      logger.error('API: git commit-info meta', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      return res.json({ success: false, error: msg.trim() });
    }
    let body = '';
    try {
      const { stdout: b1 } = await runGitCmd(['log', '-1', '--format=%B', '--no-patch', fullHash]);
      body = String(b1 || '').trim();
    } catch (_e) {
      body = '';
    }
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    try {
      const { stdout: st } = await runGitCmd(['show', '-s', '--shortstat', '--format=', fullHash]);
      const parsed = parseGitShortstat(st);
      filesChanged = parsed.filesChanged;
      insertions = parsed.insertions;
      deletions = parsed.deletions;
    } catch (_e) {
      /* merge-only or empty */
    }
    const branches = [];
    try {
      const { stdout: br } = await runGitCmd(['branch', '-a', '--contains', fullHash]);
      br.split(/\r?\n/).forEach((line) => {
        const t = line.replace(/^\*?\s+/, '').trim();
        if (t && !t.includes('->')) branches.push(t);
      });
    } catch (_e) {
      /* ignore */
    }
    let remoteUrl = '';
    try {
      const { stdout: ru } = await runGitCmd(['remote', 'get-url', 'origin']);
      remoteUrl = ru.trim();
    } catch (_e) {
      /* no origin */
    }
    const githubCommitUrl = buildGithubCommitUrl(remoteUrl, fullHash);
    res.json({
      success: true,
      hash: fullHash,
      shortHash: fullHash.slice(0, 7),
      author,
      email,
      date: dateIso,
      subject,
      body,
      filesChanged,
      insertions,
      deletions,
      branches,
      remoteUrl,
      githubCommitUrl,
    });
  });

  router.get('/git/commit-files', async (req, res) => {
    const raw = req.query && req.query.hash != null ? String(req.query.hash) : '';
    const hashInput = raw.trim();
    if (!/^[0-9a-fA-F]{7,40}$/.test(hashInput)) {
      return res.json({ success: false, error: 'Invalid hash' });
    }
    try {
      await runGitCmd(['rev-parse', '--is-inside-work-tree']);
    } catch (_e) {
      return res.json({ success: false, error: 'Not a git repository' });
    }
    let fullHash = '';
    try {
      const { stdout } = await runGitCmd(['rev-parse', '--verify', `${hashInput}^{commit}`]);
      fullHash = stdout.trim();
    } catch (_e) {
      return res.json({ success: false, error: 'Invalid commit' });
    }
    let files = [];
    try {
      const { stdout } = await runGitCmd([
        '-c',
        'core.quotepath=false',
        'show',
        '--pretty=format:',
        '--name-status',
        fullHash,
      ]);
      files = parseGitShowNameStatus(stdout || '');
    } catch (error) {
      logger.error('API: git commit-files', error);
      const msg = (error.stderr && String(error.stderr)) || error.message || String(error);
      return res.json({ success: false, error: msg.trim() });
    }
    if (files.length === 0) {
      try {
        const { stdout: mOut } = await runGitCmd([
          '-c',
          'core.quotepath=false',
          'show',
          '-m',
          '--pretty=format:',
          '--name-status',
          fullHash,
        ]);
        files = parseGitShowNameStatus(mOut || '');
      } catch (_e) {
        /* leave empty */
      }
    }
    let numMap = new Map();
    try {
      const { stdout: ns1 } = await runGitCmd([
        '-c',
        'core.quotepath=false',
        'show',
        '--pretty=format:',
        '--numstat',
        fullHash,
      ]);
      numMap = parseGitShowNumstat(ns1 || '');
    } catch (_e) {
      /* ignore */
    }
    if (files.length > 0 && numMap.size === 0) {
      try {
        const { stdout: ns2 } = await runGitCmd([
          '-c',
          'core.quotepath=false',
          'show',
          '-m',
          '--pretty=format:',
          '--numstat',
          fullHash,
        ]);
        numMap = parseGitShowNumstat(ns2 || '');
      } catch (_e) {
        /* ignore */
      }
    }
    files = mergeFilesWithNumstat(files, numMap);
    res.json({ success: true, hash: fullHash, files });
  });

  router.get('/git/modified', async (req, res) => {
    try {
      const editorDir = path.join(baseDir, 'ide_editor_cache');
      const modifiedFiles = [];
      
      // Check if cache directory exists
      try {
        const stats = await fs.stat(editorDir);
        if (!stats.isDirectory()) {
          return res.json({ success: true, files: [] });
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.json({ success: true, files: [] });
        }
        throw error;
      }
      
      // Walk the cache directory
      async function walkCacheDir(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const cacheFilePath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
              await walkCacheDir(cacheFilePath);
            } else {
              // Get relative path from ide_editor_cache
              const relativePath = path.relative(editorDir, cacheFilePath).replace(/\\/g, '/');
              const savedFilePath = path.join(baseDir, relativePath);
              const resolvedSavedPath = path.resolve(savedFilePath);
              const resolvedCachePath = path.resolve(cacheFilePath);
              
              // Safety check
              if (!isPathSafe(resolvedSavedPath, baseDir) || !isPathSafe(resolvedCachePath, baseDir)) {
                continue;
              }
              
              // Check if saved file exists
              let savedFileExists = false;
              try {
                const savedStats = await fs.stat(savedFilePath);
                savedFileExists = !savedStats.isDirectory();
              } catch (error) {
                if (error.code === 'ENOENT') {
                  // File doesn't exist in saved location - it's a new file
                  modifiedFiles.push({
                    path: relativePath,
                    name: entry.name,
                    isNew: true
                  });
                }
                continue;
              }
              
              if (!savedFileExists) {
                continue;
              }
              
              // Read both files and compare
              try {
                const [cacheContent, savedContent] = await Promise.all([
                  fs.readFile(cacheFilePath, 'utf-8'),
                  fs.readFile(savedFilePath, 'utf-8')
                ]);
                
                // If contents differ, file is modified
                if (cacheContent !== savedContent) {
                  modifiedFiles.push({
                    path: relativePath,
                    name: entry.name,
                    isNew: false
                  });
                }
              } catch (error) {
                // Skip files that can't be read (binary files, etc.)
                if (error.code !== 'ENOENT') {
                  logger.debug('Error comparing files', { cachePath: cacheFilePath, savedPath: savedFilePath, error: error.message });
                }
              }
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.debug('Error walking cache directory', { dirPath, error: error.message });
          }
        }
      }
      
      await walkCacheDir(editorDir);
      
      logger.debug('Git: Found modified files', { count: modifiedFiles.length });
      res.json({ success: true, files: modifiedFiles });
    } catch (error) {
      logger.error('API: Error getting modified files', error);
      res.json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = {
  setupAPI,
  setWebSocketManager
};
