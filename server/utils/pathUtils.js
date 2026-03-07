const path = require('path');

function isPathSafe(resolvedPath, baseDir) {
  return resolvedPath.startsWith(baseDir);
}

function normalizePath(filePath) {
  return filePath.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

function getDirectory(filePath) {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
}

module.exports = {
  isPathSafe,
  normalizePath,
  getDirectory
};
