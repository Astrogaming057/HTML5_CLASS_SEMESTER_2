const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'tree',
  description: 'Show directory tree',
  category: 'File Operations',
  aliases: [],
  
  async execute(context, args = []) {
    const dir = args[0] || context.baseDir;
    const maxDepth = parseInt(args[1]) || 3;
    
    try {
      const buildTree = async (currentDir, prefix = '', depth = 0) => {
        if (depth >= maxDepth) return [];
        const lines = [];
        const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
        const filtered = entries.filter(e => e.name !== 'ide_editor_cache' && e.name !== 'node_modules').slice(0, 20);
        
        for (let i = 0; i < filtered.length; i++) {
          const entry = filtered[i];
          const isLast = i === filtered.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
          
          if (entry.isDirectory() && depth < maxDepth - 1) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            const subLines = await buildTree(path.join(currentDir, entry.name), nextPrefix, depth + 1);
            lines.push(...subLines);
          }
        }
        return lines;
      };
      
      const treeLines = await buildTree(dir);
      return {
        success: true,
        message: [`${dir}/`, ...treeLines].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error building tree: ${error.message}`
      };
    }
  }
};
