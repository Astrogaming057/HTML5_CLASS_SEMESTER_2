const fs = require('fs').promises;
const path = require('path');

// Cache injection script
let injectionScriptContent = null;

/**
 * Load injection script (with caching)
 */
async function loadInjectionScript() {
  if (!injectionScriptContent) {
    const jsDir = path.join(__dirname, 'js');
    const scriptContent = await fs.readFile(
      path.join(jsDir, 'injection.js'),
      'utf-8'
    );
    injectionScriptContent = `<script>${scriptContent}</script>`;
  }
}

/**
 * Get the HTML injection script for adding navigation and WebSocket functionality
 * @returns {Promise<string>} HTML script tag with injection code
 */
async function getInjectionScript() {
  await loadInjectionScript();
  return injectionScriptContent;
}

module.exports = {
  getInjectionScript
};
