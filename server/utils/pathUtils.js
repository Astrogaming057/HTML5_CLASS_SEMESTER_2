const path = require('path');

/**
 * Check if a resolved path is within the base directory (security check)
 * @param {string} resolvedPath - The resolved absolute path
 * @param {string} baseDir - The base directory to check against
 * @returns {boolean} True if path is within base directory
 */
function isPathSafe(resolvedPath, baseDir) {
  return resolvedPath.startsWith(baseDir);
}

/**
 * Normalize a path for comparison (remove leading/trailing slashes, convert to lowercase)
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(filePath) {
  return filePath.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

/**
 * Get the directory portion of a path
 * @param {string} filePath - Full file path
 * @returns {string} Directory path
 */
function getDirectory(filePath) {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
}

module.exports = {
  isPathSafe,
  normalizePath,
  getDirectory
};
