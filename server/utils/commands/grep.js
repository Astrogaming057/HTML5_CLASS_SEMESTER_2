const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'grep',
  description: 'Search for text in files',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    const text = args[0] || '';
    const dir = args[1] || context.baseDir;
    
    try {
      const results = [];
      const search = async (currentDir, depth = 0) => {
        if (depth > 3) return;
        const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (entry.name === 'ide_editor_cache' || entry.name === 'node_modules') continue;
          if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.txt'))) {
            try {
              const content = await fs.readFile(path.join(currentDir, entry.name), 'utf-8');
              if (content.includes(text)) {
                results.push(path.join(currentDir, entry.name));
              }
            } catch (e) {}
          } else if (entry.isDirectory() && results.length < 20) {
            await search(path.join(currentDir, entry.name), depth + 1);
          }
        }
      };
      
      await search(dir);
      return {
        success: true,
        message: [
          `Found "${text}" in ${results.length} files:`,
          ...results.slice(0, 15).map(r => `  ${r}`),
          ...(results.length > 15 ? [`  ... and ${results.length - 15} more`] : [])
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
