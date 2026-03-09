const fs = require('fs').promises;
const path = require('path');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'cache',
  description: 'Show cache directory info',
  category: 'Cache Management',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const cacheDir = path.join(context.baseDir, 'ide_editor_cache');
      const stats = await fs.stat(cacheDir).catch(() => null);
      
      if (!stats || !stats.isDirectory()) {
        return {
          success: true,
          message: 'Cache directory does not exist or is not accessible'
        };
      }
      
      const files = await fs.readdir(cacheDir, { withFileTypes: true, recursive: true });
      const fileCount = files.filter(f => f.isFile()).length;
      const dirCount = files.filter(f => f.isDirectory()).length;
      
      let totalSize = 0;
      for (const file of files.filter(f => f.isFile())) {
        try {
          const filePath = path.join(cacheDir, file.name);
          const fileStats = await fs.stat(filePath);
          totalSize += fileStats.size;
        } catch (error) {
          // Ignore individual file errors
        }
      }
      
      return {
        success: true,
        message: `Cache Directory: ${cacheDir}\n  Files: ${fileCount}\n  Directories: ${dirCount}\n  Total Size: ${formatBytes(totalSize)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error reading cache: ${error.message}`
      };
    }
  }
};
