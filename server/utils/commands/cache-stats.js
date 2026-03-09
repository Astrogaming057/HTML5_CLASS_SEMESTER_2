const fs = require('fs').promises;
const path = require('path');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'cache-stats',
  description: 'Show cache statistics',
  category: 'Cache Management',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const cacheDir = path.join(context.baseDir, 'ide_editor_cache');
      const stats = await fs.stat(cacheDir).catch(() => null);
      
      if (!stats) {
        return {
          success: true,
          message: 'Cache directory does not exist'
        };
      }
      
      const files = await fs.readdir(cacheDir, { recursive: true, withFileTypes: true }).catch(() => []);
      const fileList = files.filter(f => f.isFile());
      let totalSize = 0;
      
      for (const file of fileList.slice(0, 100)) {
        try {
          const filePath = path.join(cacheDir, file.name);
          const fileStats = await fs.stat(filePath);
          totalSize += fileStats.size;
        } catch (e) {}
      }
      
      return {
        success: true,
        message: [
          'Cache Statistics:',
          `  Files: ${fileList.length}`,
          `  Total Size: ${formatBytes(totalSize)}`,
          `  Average Size: ${fileList.length > 0 ? formatBytes(totalSize / fileList.length) : '0 B'}`
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting cache stats: ${error.message}`
      };
    }
  }
};
