const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

// Cache template files
let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

/**
 * Load editor template files (with caching)
 */
async function loadEditorTemplates() {
  if (!htmlTemplate) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    
    htmlTemplate = await fs.readFile(
      path.join(templatesDir, 'html', 'editor.html'),
      'utf-8'
    );
    cssContent = await fs.readFile(
      path.join(templatesDir, 'css', 'editor.css'),
      'utf-8'
    );
    jsContent = await fs.readFile(
      path.join(templatesDir, 'js', 'editor.js'),
      'utf-8'
    );
  }
}

/**
 * Serve editor page
 * @param {string} baseDir - Base directory
 * @param {string} filePath - File path to edit
 * @returns {Promise<string>} HTML content
 */
async function serveEditor(baseDir, filePath) {
  await loadEditorTemplates();
  
  const fullPath = path.join(baseDir, filePath);
  const resolvedPath = path.resolve(fullPath);

  if (!isPathSafe(resolvedPath, baseDir)) {
    throw new Error('Forbidden');
  }

  let content = '';
  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error('Cannot edit directory');
    }
    content = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      content = ''; // New file
    } else {
      throw error;
    }
  }

  const fileName = filePath.split(path.sep).pop() || filePath;
  
  // Escape content for JavaScript string (Monaco will load it via API)
  const escapedContent = JSON.stringify(content);
  
  let html = htmlTemplate
    .replace('{{FILENAME}}', fileName)
    .replace('{{CONTENT}}', '') // Monaco will load via API, so empty initial value
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style>`)
    .replace('{{JS_CONTENT}}', `<script>${jsContent}</script>`);

  return html;
}

module.exports = {
  serveEditor
};
