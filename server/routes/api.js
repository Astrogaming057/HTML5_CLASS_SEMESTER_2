const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

let wsManager = null;

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
        if (wsManager) {
          wsManager.notifyFileChange(finalPath, 'addDir');
        }
      } else {
        if (req.body.isBinary && content) {
          const buffer = Buffer.from(content, 'base64');
          await fs.writeFile(resolvedPath, buffer);
          logger.info('API: Binary file created', { path: finalPath, size: buffer.length });
        } else {
          await fs.writeFile(resolvedPath, content || '', 'utf-8');
          logger.info('API: File created', { path: finalPath });
        }
        if (wsManager) {
          wsManager.notifyFileChange(finalPath, 'add');
        }
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

      await fs.writeFile(resolvedPath, content, 'utf-8');
      logger.info('API: File saved', { path: filePath, size: content.length });
      
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

  return router;
}

module.exports = {
  setupAPI,
  setWebSocketManager
};
