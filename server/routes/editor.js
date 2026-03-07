const fs = require('fs').promises;
const path = require('path');
const { isPathSafe } = require('../utils/pathUtils');
const logger = require('../utils/logger');

let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

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
      content = '';
    } else {
      throw error;
    }
  }

  const fileName = filePath.split(path.sep).pop() || filePath;
  
  const escapedContent = JSON.stringify(content);
  
  let html = htmlTemplate
    .replace('{{FILENAME}}', fileName)
    .replace('{{CONTENT}}', '')
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style>`)
    .replace('{{JS_CONTENT}}', `<script>${jsContent}</script>`);

  return html;
}

function setupEditorRoutes(baseDir) {
  const express = require('express');
  const router = express.Router();
  
  router.get('/', async (req, res) => {
    try {
      const filePath = req.query.file;
      if (!filePath) {
        return res.status(400).send('No file specified');
      }
      const html = await serveEditor(baseDir, filePath);
      res.send(html);
    } catch (error) {
      logger.error('Error serving editor', error);
      res.status(500).send('Error: ' + error.message);
    }
  });
  
  return router;
}

module.exports = {
  serveEditor,
  setupEditorRoutes
};
