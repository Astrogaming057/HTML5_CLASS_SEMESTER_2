const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Recursively walks through a directory and returns all file paths
 */
async function walkDirectory(dirPath, baseDir, fileList = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, baseDir, fileList);
      } else {
        fileList.push({
          fullPath,
          relativePath
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  return fileList;
}

/**
 * Checks if a path is safe (within base directory)
 */
function isPathSafe(resolvedPath, baseDir) {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedPath);
  return resolved.startsWith(resolvedBase);
}

/**
 * Performs cleanup of ide_editor_cache by removing files that match saved files
 */
async function cleanupCache(baseDir, wsManager) {
  const cleanupLog = [];
  let filesChecked = 0;
  let filesDeleted = 0;
  let errors = 0;
  
  try {
    const editorDir = path.join(baseDir, 'ide_editor_cache');
    
    // Check if cache directory exists
    try {
      const stats = await fs.stat(editorDir);
      if (!stats.isDirectory()) {
        logger.info('Cache cleanup: ide_editor_cache is not a directory, skipping cleanup');
        return { filesChecked: 0, filesDeleted: 0, errors: 0, log: [] };
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Cache cleanup: ide_editor_cache directory does not exist, skipping cleanup');
        return { filesChecked: 0, filesDeleted: 0, errors: 0, log: [] };
      }
      throw error;
    }
    
    // Get all files in cache directory
    const cacheFiles = await walkDirectory(editorDir, editorDir);
    
    logger.info('Cache cleanup: Starting cleanup', { cacheFilesCount: cacheFiles.length });
    cleanupLog.push(`Starting cleanup: Found ${cacheFiles.length} cached files`);
    
    // Broadcast cleanup start
    if (wsManager) {
      wsManager.broadcast({
        type: 'cache-cleanup-start',
        message: `Starting cache cleanup: Found ${cacheFiles.length} cached files`,
        timestamp: new Date().toISOString()
      });
    }
    
    for (const cacheFile of cacheFiles) {
      try {
        filesChecked++;
        const relativePath = cacheFile.relativePath;
        
        // Get the corresponding saved file path
        const savedFilePath = path.join(baseDir, relativePath);
        const resolvedSavedPath = path.resolve(savedFilePath);
        const resolvedCachePath = path.resolve(cacheFile.fullPath);
        
        // Safety check
        if (!isPathSafe(resolvedSavedPath, baseDir) || !isPathSafe(resolvedCachePath, baseDir)) {
          cleanupLog.push(`⚠️ Skipped ${relativePath} (path safety check failed)`);
          errors++;
          continue;
        }
        
        // Check if saved file exists
        let savedFileExists = false;
        try {
          const savedStats = await fs.stat(savedFilePath);
          savedFileExists = !savedStats.isDirectory();
        } catch (error) {
          if (error.code === 'ENOENT') {
            // Saved file doesn't exist, keep cache file
            continue;
          }
          throw error;
        }
        
        if (!savedFileExists) {
          continue;
        }
        
        // Read both files and compare
        const [cacheContent, savedContent] = await Promise.all([
          fs.readFile(cacheFile.fullPath, 'utf-8'),
          fs.readFile(savedFilePath, 'utf-8')
        ]);
        
        // If contents are identical, delete the cache file
        if (cacheContent === savedContent) {
          await fs.unlink(cacheFile.fullPath);
          filesDeleted++;
          const logMsg = `✓ Deleted ${relativePath} (matches saved file)`;
          cleanupLog.push(logMsg);
          logger.info('Cache cleanup: Deleted cached file', { path: relativePath });
          
          // Broadcast individual deletion
          if (wsManager) {
            wsManager.broadcast({
              type: 'cache-cleanup-delete',
              message: logMsg,
              path: relativePath,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        errors++;
        const errorMsg = `✗ Error processing ${cacheFile.relativePath}: ${error.message}`;
        cleanupLog.push(errorMsg);
        logger.error('Cache cleanup: Error processing file', { 
          path: cacheFile.relativePath, 
          error: error.message 
        });
      }
    }
    
    const summary = `Cleanup complete: Checked ${filesChecked} files, deleted ${filesDeleted} files, ${errors} errors`;
    cleanupLog.push(summary);
    logger.info('Cache cleanup: Completed', { 
      filesChecked, 
      filesDeleted, 
      errors 
    });
    
    // Broadcast cleanup completion
    if (wsManager) {
      wsManager.broadcast({
        type: 'cache-cleanup-complete',
        message: summary,
        filesChecked,
        filesDeleted,
        errors,
        log: cleanupLog,
        timestamp: new Date().toISOString()
      });
    }
    
    return { filesChecked, filesDeleted, errors, log: cleanupLog };
  } catch (error) {
    const errorMsg = `Cache cleanup failed: ${error.message}`;
    cleanupLog.push(errorMsg);
    logger.error('Cache cleanup: Fatal error', error);
    
    if (wsManager) {
      wsManager.broadcast({
        type: 'cache-cleanup-error',
        message: errorMsg,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    return { filesChecked, filesDeleted: 0, errors: errors + 1, log: cleanupLog };
  }
}

module.exports = {
  cleanupCache
};
