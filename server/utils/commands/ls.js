const fs = require('fs').promises;

module.exports = {
  name: 'ls',
  description: 'List directory contents',
  category: 'File Operations',
  aliases: ['dir'],
  
  async execute(context, args = []) {
    const dirPath = args[0] || context.baseDir;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).map(e => e.name);
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name + '/');
      
      return {
        success: true,
        message: [
          `Directory: ${dirPath}`,
          `  Files: ${files.length}`,
          `  Directories: ${dirs.length}`,
          ...(files.length > 0 ? ['', 'Files:', ...files.slice(0, 20).map(f => `  ${f}`)] : []),
          ...(dirs.length > 0 ? ['', 'Directories:', ...dirs.slice(0, 20).map(d => `  ${d}`)] : [])
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error listing directory: ${error.message}`
      };
    }
  }
};
