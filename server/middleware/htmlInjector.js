const { getInjectionScript } = require('../templates/injectionScript');

/**
 * Middleware to inject navigation and WebSocket script into HTML files
 * @param {Buffer} content - File content buffer
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string|null>} Modified content if HTML, null otherwise
 */
async function injectHTML(content, mimeType) {
  if (!mimeType.startsWith('text/html')) {
    return null;
  }

  let htmlContent = content.toString();
  const injectionScript = await getInjectionScript();
  
  // Inject before closing body tag
  htmlContent = htmlContent.replace('</body>', injectionScript + '</body>');
  
  return htmlContent;
}

module.exports = {
  injectHTML
};
