const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'cache-list',
  description: 'List cached files',
  category: 'Cache Management',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const cacheDir = path.join(context.baseDir, 'ide_editor_cache');
      const files = await fs.readdir(cacheDir, { recursive: true, withFileTypes: true }).catch(() => []);
      const fileList = files.filter(f => f.isFile()).slice(0, 30);
      
      return {
        success: true,
        message: [
          `Cached Files (${fileList.length}):`,
          ...fileList.map(f => `  ${f.name}`),
          ...(files.filter(f => f.isFile()).length > 30 ? [`  ... and ${files.filter(f => f.isFile()).length - 30} more`] : [])
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error listing cache: ${error.message}`
      };
    }
  }
};
