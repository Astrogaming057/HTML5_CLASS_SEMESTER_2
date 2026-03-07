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
  // Get file content
  router.get('/files', async (req, res) => {
    try {
      const filePath = req.query.path;
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
      if (stats.isDirectory()) {
        return res.json({ success: false, error: 'Path is a directory' });
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      logger.info('API: File read', { path: filePath });
      res.json({ success: true, content });
    } catch (error) {
      logger.error('API: Error reading file', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Create file or folder
  router.post('/files', async (req, res) => {
    try {
      const { path: dirPath, name, type } = req.body;
      if (!dirPath || !name || !type) {
        return res.json({ success: false, error: 'Missing required fields' });
      }

      const fullPath = path.join(baseDir, dirPath, name);
      const resolvedPath = path.resolve(fullPath);

      if (!isPathSafe(resolvedPath, baseDir)) {
        logger.warn('API: Forbidden path access', { path: dirPath + '/' + name });
        return res.json({ success: false, error: 'Forbidden' });
      }

      // Check if already exists
      try {
        await fs.access(resolvedPath);
        return res.json({ success: false, error: 'File or folder already exists' });
      } catch {
        // File doesn't exist, proceed
      }

      if (type === 'folder') {
        await fs.mkdir(resolvedPath, { recursive: true });
        logger.info('API: Folder created', { path: dirPath + '/' + name });
      } else {
        await fs.writeFile(resolvedPath, '', 'utf-8');
        logger.info('API: File created', { path: dirPath + '/' + name });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('API: Error creating file/folder', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Update file content
  router.put('/files', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
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
      logger.error('API: Error saving file', error);
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
      if (stats.isDirectory()) {
        await fs.rmdir(resolvedPath, { recursive: true });
        logger.info('API: Folder deleted', { path: filePath });
      } else {
        await fs.unlink(resolvedPath);
        logger.info('API: File deleted', { path: filePath });
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
