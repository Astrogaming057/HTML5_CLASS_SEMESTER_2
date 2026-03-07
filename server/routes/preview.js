const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

async function loadPreviewTemplates() {
  if (!htmlTemplate) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    
    htmlTemplate = await fs.readFile(
      path.join(templatesDir, 'html', 'preview.html'),
      'utf-8'
    );
    cssContent = await fs.readFile(
      path.join(templatesDir, 'css', 'preview.css'),
      'utf-8'
    );
    jsContent = await fs.readFile(
      path.join(templatesDir, 'js', 'preview.js'),
      'utf-8'
    );
  }
}

async function servePreview(baseDir, filePath) {
  await loadPreviewTemplates();
  
  const fullPath = path.join(baseDir, filePath);
  const resolvedPath = path.resolve(fullPath);

  if (!isPathSafe(resolvedPath, baseDir)) {
    throw new Error('Forbidden');
  }

  let content = '';
  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error('Cannot preview directory');
    }
    content = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      content = '';
    } else {
      throw error;
    }
  }

  const fileName = filePath.split(path.sep).pop() || filePath;
  
  let html = htmlTemplate
    .replace('{{FILENAME}}', fileName)
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style>`)
    .replace('{{JS_CONTENT}}', `<script>${jsContent}</script>`);

  return html;
}

module.exports = {
  servePreview
};
