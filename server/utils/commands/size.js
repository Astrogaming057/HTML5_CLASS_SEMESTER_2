const fs = require('fs').promises;
const path = require('path');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'size',
  description: 'Calculate directory size',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    const dirPath = args[0] || context.baseDir;
    try {
      const calculateSize = async (dir) => {
        let totalSize = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'ide_editor_cache' || entry.name === 'node_modules') continue;
          const fullPath = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              totalSize += await calculateSize(fullPath);
            } else {
              const stats = await fs.stat(fullPath);
              totalSize += stats.size;
            }
          } catch (e) {}
        }
        return totalSize;
      };
      
      const totalSize = await calculateSize(dirPath);
      return {
        success: true,
        message: `Directory Size: ${dirPath}\n  Total: ${formatBytes(totalSize)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error calculating size: ${error.message}`
      };
    }
  }
};
