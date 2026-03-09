const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'find',
  description: 'Find files by name',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    const name = args[0] || '';
    const dir = args[1] || context.baseDir;
    
    try {
      const results = [];
      const search = async (currentDir, depth = 0) => {
        if (depth > 5) return;
        const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (entry.name === 'ide_editor_cache' || entry.name === 'node_modules') continue;
          if (entry.name.toLowerCase().includes(name.toLowerCase())) {
            results.push(path.join(currentDir, entry.name));
          }
          if (entry.isDirectory() && results.length < 50) {
            await search(path.join(currentDir, entry.name), depth + 1);
          }
        }
      };
      
      await search(dir);
      return {
        success: true,
        message: [
          `Found ${results.length} matches for "${name}":`,
          ...results.slice(0, 20).map(r => `  ${r}`),
          ...(results.length > 20 ? [`  ... and ${results.length - 20} more`] : [])
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error searching: ${error.message}`
      };
    }
  }
};
