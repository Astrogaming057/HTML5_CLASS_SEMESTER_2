const { getInjectionScript } = require('../templates/injectionScript');

async function injectHTML(content, mimeType) {
  if (!mimeType.startsWith('text/html')) {
    return null;
  }

  let htmlContent = content.toString();
  const injectionScript = await getInjectionScript();
  
  htmlContent = htmlContent.replace('</body>', injectionScript + '</body>');
  
  return htmlContent;
}

module.exports = {
  injectHTML
};
