const chokidar = require('chokidar');
const path = require('path');
const logger = require('../utils/logger');

function setupFileWatcher(baseDir, watchOptions, onFileChange) {
  const watcher = chokidar.watch(baseDir, watchOptions);

  watcher.on('ready', () => {
    logger.info('File watcher ready', { baseDir });
  });

  watcher.on('change', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.info('File changed', { filePath: relativePath, absolutePath: filePath });
    onFileChange(relativePath, 'change');
  });

  watcher.on('error', (error) => {
    logger.error('File watcher error', error);
  });

  watcher.on('add', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.info('File added', { filePath: relativePath });
    onFileChange(relativePath, 'add');
  });

  watcher.on('unlink', (filePath) => {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    logger.info('File removed', { filePath: relativePath });
    onFileChange(relativePath, 'unlink');
  });

  watcher.on('addDir', (dirPath) => {
    const relativePath = path.relative(baseDir, dirPath).replace(/\\/g, '/');
    logger.info('Directory added', { filePath: relativePath });
    onFileChange(relativePath, 'addDir');
  });

  watcher.on('unlinkDir', (dirPath) => {
    const relativePath = path.relative(baseDir, dirPath).replace(/\\/g, '/');
    logger.info('Directory removed', { filePath: relativePath });
    onFileChange(relativePath, 'unlinkDir');
  });

  return watcher;
}

module.exports = {
  setupFileWatcher
};
