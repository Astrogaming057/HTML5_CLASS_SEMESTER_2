const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

const STATUS_DIR = path.join(__dirname);

async function getStatusPage(code) {
  const statusPath = path.join(STATUS_DIR, code.toString());
  const htmlPath = path.join(statusPath, 'index.html');
  
  try {
    const html = await fs.readFile(htmlPath, 'utf-8');
    return html;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('Status page not found', { code, path: htmlPath });
      return null;
    }
    logger.error('Error reading status page', { code, error: error.message });
    return null;
  }
}

async function getStatusAsset(code, assetName) {
  const statusPath = path.join(STATUS_DIR, code.toString());
  const assetPath = path.join(statusPath, assetName);
  
  try {
    const content = await fs.readFile(assetPath, 'utf-8');
    const ext = path.extname(assetName).toLowerCase();
    
    let contentType = 'text/plain';
    if (ext === '.css') {
      contentType = 'text/css';
    } else if (ext === '.js') {
      contentType = 'application/javascript';
    }
    
    return { content, contentType };
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('Status asset not found', { code, assetName, path: assetPath });
      return null;
    }
    logger.error('Error reading status asset', { code, assetName, error: error.message });
    return null;
  }
}

function setupStatusRoutes(app) {
  app.get('/__status__/:code', async (req, res) => {
    const code = parseInt(req.params.code, 10);
    
    if (isNaN(code) || code < 400 || code > 599) {
      return res.status(400).send('Invalid status code');
    }
    
    const html = await getStatusPage(code);
    
    if (!html) {
      return res.status(404).send(`Status page for ${code} not found`);
    }
    
    res.status(code).send(html);
  });
  
  app.get('/__status__/:code/:asset', async (req, res) => {
    const code = parseInt(req.params.code, 10);
    const assetName = req.params.asset;
    
    if (isNaN(code) || code < 400 || code > 599) {
      return res.status(400).send('Invalid status code');
    }
    
    const asset = await getStatusAsset(code, assetName);
    
    if (!asset) {
      return res.status(404).send('Asset not found');
    }
    
    res.setHeader('Content-Type', asset.contentType);
    res.send(asset.content);
  });
  
  logger.info('Status page routes configured');
}

module.exports = {
  setupStatusRoutes,
  getStatusPage
};
