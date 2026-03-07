const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

// WebSocket manager instance (will be set by index.js)
let wsManager = null;

/**
 * Set WebSocket manager for broadcasting
 * @param {WebSocketManager} manager - WebSocket manager instance
 */
function setWebSocketManager(manager) {
  wsManager = manager;
}

const router = express.Router();

/**
 * Setup API routes for file operations
 * @param {string} baseDir - Base directory to serve from
 */
function setupAPI(baseDir) {
  // Get file content or directory listing
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
        // Return directory listing
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const files = [];
        
        for (const entry of entries) {
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

  // Create file or folder
  router.post('/files', async (req, res) => {
    try {
      const { path: filePath, content, isDirectory } = req.body;
      
      // Support both old format (dirPath, name, type) and new format (path, isDirectory)
      let fullPath, resolvedPath;
      
      if (filePath) {
        // New format
        fullPath = path.join(baseDir, filePath);
        resolvedPath = path.resolve(fullPath);
      } else {
        // Old format (for backward compatibility)
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

      // Check if already exists
      try {
        await fs.access(resolvedPath);
        return res.json({ success: false, error: 'File or folder already exists' });
      } catch {
        // File doesn't exist, proceed
      }

      const shouldCreateDir = isDirectory !== undefined ? isDirectory : (req.body.type === 'folder');
      
      const finalPath = filePath || (req.body.dirPath + '/' + req.body.name);
      
      if (shouldCreateDir) {
        await fs.mkdir(resolvedPath, { recursive: true });
        logger.info('API: Folder created', { path: finalPath });
        // Broadcast directory creation
        if (wsManager) {
          wsManager.notifyFileChange(finalPath, 'addDir');
        }
      } else {
        // Handle binary files (base64 encoded)
        if (req.body.isBinary && content) {
          // Decode base64 content
          const buffer = Buffer.from(content, 'base64');
          await fs.writeFile(resolvedPath, buffer);
          logger.info('API: Binary file created', { path: finalPath, size: buffer.length });
        } else {
          await fs.writeFile(resolvedPath, content || '', 'utf-8');
          logger.info('API: File created', { path: finalPath });
        }
        // Broadcast file creation
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

  // Update file content or rename file/folder
  router.put('/files', async (req, res) => {
    try {
      const { path: filePath, content, newPath, isDirectory } = req.body;
      
      // Handle rename
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

        await fs.rename(resolvedPath, newResolvedPath);
        logger.info('API: File/folder renamed', { path: filePath, newPath });
        
        // Broadcast rename (delete old, add new)
        if (wsManager) {
          const stats = await fs.stat(newResolvedPath);
          const eventType = stats.isDirectory() ? 'unlinkDir' : 'unlink';
          wsManager.notifyFileChange(filePath, eventType);
          const addEventType = stats.isDirectory() ? 'addDir' : 'add';
          wsManager.notifyFileChange(newPath, addEventType);
        }
        
        return res.json({ success: true });
      }
      
      // Handle file content update
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
      
      // Don't broadcast from API - the editor will broadcast its own save with sessionId
      // This prevents duplicate messages and allows proper session tracking
      
      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error updating file', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Delete file or folder
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
        // Broadcast directory deletion
        if (wsManager) {
          wsManager.notifyFileChange(filePath, 'unlinkDir');
        }
      } else {
        await fs.unlink(resolvedPath);
        logger.info('API: File deleted', { path: filePath });
        // Broadcast file deletion
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

  return router;
}

module.exports = {
  setupAPI,
  setWebSocketManager
};
