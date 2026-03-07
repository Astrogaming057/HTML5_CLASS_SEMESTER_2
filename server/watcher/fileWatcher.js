const chokidar = require('chokidar');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Setup file watcher and notify clients on file changes
 * @param {string} baseDir - Base directory to watch
 * @param {Object} watchOptions - Chokidar watch options
 * @param {Function} onFileChange - Callback when file changes (receives filePath)
 * @returns {Object} Chokidar watcher instance
 */
function setupFileWatcher(baseDir, watchOptions, onFileChange) {
  const watcher = chokidar.watch(baseDir, watchOptions);

  watcher.on('ready', () => {
    logger.info('File watcher ready', { baseDir });
  });

  watcher.on('change', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.info('File changed', { filePath: relativePath, absolutePath: filePath });
    onFileChange(relativePath);
  });

  watcher.on('error', (error) => {
    logger.error('File watcher error', error);
  });

  watcher.on('add', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.debug('File added', { filePath: relativePath });
  });

  watcher.on('unlink', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.debug('File removed', { filePath: relativePath });
  });

  return watcher;
}

module.exports = {
  setupFileWatcher
};
