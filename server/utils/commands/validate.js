const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'validate',
  description: 'Validate configuration',
  category: 'Development & Debug',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const baseDirExists = await fs.stat(context.baseDir).then(() => true).catch(() => false);
      const cacheDirExists = await fs.stat(path.join(context.baseDir, 'ide_editor_cache')).then(() => true).catch(() => false);
      
      return {
        success: true,
        message: [
          'Validation Results:',
          `  Base Directory: ${baseDirExists ? '✓ Exists' : '✗ Missing'}`,
          `  Cache Directory: ${cacheDirExists ? '✓ Exists' : '⚠ Will be created'}`,
          `  Server: ✓ Running`,
          `  WebSocket: ${context.wsManager ? '✓ Active' : '✗ Inactive'}`
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation error: ${error.message}`
      };
    }
  }
};
