const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const { generateDirectoryListing } = require('../templates/directoryListing');
const { injectHTML } = require('../middleware/htmlInjector');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

const router = express.Router();

function setupFileServer(baseDir) {
  router.get('*', async (req, res) => {
    const startTime = Date.now();
    try {
      let requestPath = decodeURIComponent(req.path).replace(/\/+/g, '/');
      if (requestPath !== '/' && requestPath.endsWith('/')) {
        requestPath = requestPath.slice(0, -1);
      }
      const fullPath = path.join(baseDir, requestPath);
      
      const resolvedPath = path.resolve(fullPath);
      if (!isPathSafe(resolvedPath, baseDir)) {
        const responseTime = Date.now() - startTime;
        logger.warn('Forbidden path access attempt', { path: requestPath, resolvedPath });
        logger.http('GET', requestPath, 403, responseTime);
        return res.status(403).send('Forbidden');
      }
      
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        logger.debug('Serving directory listing', { path: requestPath });
        const html = await generateDirectoryListing(resolvedPath, requestPath, baseDir);
        const responseTime = Date.now() - startTime;
        logger.http('GET', requestPath, 200, responseTime);
        res.send(html);
      } else {
        const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';
        const content = await fs.readFile(resolvedPath);
        
        logger.debug('Serving file', { 
          path: requestPath, 
          mimeType, 
          size: content.length,
          injected: mimeType.startsWith('text/html')
        });
        
        const injectedContent = await injectHTML(content, mimeType);
        
        if (injectedContent !== null) {
          res.setHeader('Content-Type', mimeType);
          const responseTime = Date.now() - startTime;
          logger.http('GET', requestPath, 200, responseTime);
          res.send(injectedContent);
        } else {
          res.setHeader('Content-Type', mimeType);
          const responseTime = Date.now() - startTime;
          logger.http('GET', requestPath, 200, responseTime);
          res.send(content);
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      if (error.code === 'ENOENT') {
        logger.warn('File not found', { path: req.path, error: error.message });
        logger.http('GET', req.path, 404, responseTime);
        res.status(404).send('File not found');
      } else {
        logger.error('Error serving file', error);
        logger.http('GET', req.path, 500, responseTime);
        res.status(500).send('Internal server error');
      }
    }
  });

  return router;
}

module.exports = {
  setupFileServer
};
