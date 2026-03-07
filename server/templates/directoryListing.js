const fs = require('fs').promises;
const path = require('path');
const { formatSize, formatDate } = require('../utils/formatters');

let htmlTemplate = null;
let cssContent = null;
let jsContent = null;

async function loadTemplates() {
  if (!htmlTemplate) {
    const templatesDir = path.join(__dirname, 'html');
    const cssDir = path.join(__dirname, 'css');
    const jsDir = path.join(__dirname, 'js');
    
    htmlTemplate = await fs.readFile(
      path.join(templatesDir, 'directoryListing.html'),
      'utf-8'
    );
    cssContent = await fs.readFile(
      path.join(cssDir, 'directoryListing.css'),
      'utf-8'
    );
    jsContent = await fs.readFile(
      path.join(jsDir, 'directoryListing.js'),
      'utf-8'
    );
  }
}

async function generateDirectoryListing(dirPath, requestPath, baseDir) {
  await loadTemplates();
  
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  
  const normalizedRequestPath = requestPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  let parentPath = path.dirname(normalizedRequestPath);
  parentPath = parentPath.replace(/\/+/g, '/') || '/';
  const hasParent = normalizedRequestPath !== '/';

  let rows = '';
  const fileList = [];

  for (const file of files) {
    if (file.name.startsWith('.')) continue;
    
    const fullPath = path.join(dirPath, file.name);
    const stats = await fs.stat(fullPath);
    const isDir = file.isDirectory();
    const size = isDir ? 0 : stats.size;
    const dateModified = Math.floor(stats.mtimeMs / 1000);
    
    fileList.push({
      name: file.name,
      isDir,
      size,
      dateModified,
      dateModifiedString: formatDate(stats.mtime)
    });
  }

  fileList.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const file of fileList) {
    const url = encodeURIComponent(file.name) + (file.isDir ? '/' : '');
    rows += `addRow("${file.name.replace(/"/g, '&quot;')}", "${url}", ${file.isDir ? 1 : 0}, ${file.size}, "${formatSize(file.size)}", ${file.dateModified}, "${file.dateModifiedString}");\n`;
  }

  const location = normalizedRequestPath === '/' ? baseDir : path.join(baseDir, normalizedRequestPath);
  const locationDisplay = location.replace(/\\/g, '/');

  return generateHTML(locationDisplay, parentPath, hasParent, rows);
}

function generateHTML(locationDisplay, parentPath, hasParent, rows) {
  const normalizedParentPath = parentPath.replace(/\/+/g, '/') || '/';
  
  let html = htmlTemplate
    .replace(/\{\{LOCATION\}\}/g, locationDisplay)
    .replace('{{HAS_PARENT}}', hasParent ? 'block' : 'none')
    .replace('{{PARENT_PATH}}', normalizedParentPath)
    .replace('{{PARENT_SCRIPT}}', hasParent ? 'onHasParentDirectory();' : '')
    .replace('{{ROWS_SCRIPT}}', rows)
    .replace('{{CSS_CONTENT}}', `<style>${cssContent}</style>`)
    .replace('{{JS_CONTENT}}', `<script>${jsContent}</script>`);

  return html;
}

module.exports = {
  generateDirectoryListing
};
