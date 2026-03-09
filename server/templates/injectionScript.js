const fs = require('fs').promises;
const path = require('path');

let injectionScriptContent = null;

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

async function getInjectionScript() {
  await loadInjectionScript();
  return injectionScriptContent;
}

module.exports = {
  getInjectionScript
};
