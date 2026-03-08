const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'count',
  description: 'Count files in directory',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    const dirPath = args[0] || context.baseDir;
    try {
      const countFiles = async (dir) => {
        let fileCount = 0;
        let dirCount = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'ide_editor_cache' || entry.name === 'node_modules') continue;
          if (entry.isDirectory()) {
            dirCount++;
            try {
              const subCounts = await countFiles(path.join(dir, entry.name));
              fileCount += subCounts.files;
              dirCount += subCounts.dirs;
            } catch (e) {}
          } else {
            fileCount++;
          }
        }
        return { files: fileCount, dirs: dirCount };
      };
      
      const counts = await countFiles(dirPath);
      return {
        success: true,
        message: `Directory: ${dirPath}\n  Files: ${counts.files}\n  Directories: ${counts.dirs}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error counting files: ${error.message}`
      };
    }
  }
};
