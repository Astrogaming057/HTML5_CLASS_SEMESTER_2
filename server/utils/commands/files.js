const fs = require('fs').promises;

module.exports = {
  name: 'files',
  description: 'List files in base directory',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const entries = await fs.readdir(context.baseDir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).length;
      const dirs = entries.filter(e => e.isDirectory() && e.name !== 'ide_editor_cache').length;
      
      return {
        success: true,
        message: `Base Directory: ${context.baseDir}\n  Files: ${files}\n  Directories: ${dirs}\n  Total Items: ${entries.length}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error reading directory: ${error.message}`
      };
    }
  }
};
