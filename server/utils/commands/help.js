module.exports = {
  name: 'help',
  description: 'Show help message with all available commands',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    // Lazy load to avoid circular dependency
    const { getCommandsByCategory } = require('./index');
    const categorized = getCommandsByCategory();
    const lines = ['Available commands:', ''];
    
    // Define category order
    const categoryOrder = [
      'System Information',
      'Memory & Performance',
      'Network & Connections',
      'File Operations',
      'Cache Management',
      'Server Management',
      'Development & Debug',
      'Utilities'
    ];
    
    for (const category of categoryOrder) {
      if (categorized[category] && categorized[category].length > 0) {
        lines.push(`${category}:`);
        for (const cmd of categorized[category]) {
          const aliases = cmd.aliases && cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
          lines.push(`  ${cmd.name.padEnd(20)} - ${cmd.description}${aliases}`);
        }
        lines.push('');
      }
    }
    
    // Add any uncategorized commands
    for (const [category, commands] of Object.entries(categorized)) {
      if (!categoryOrder.includes(category) && commands.length > 0) {
        lines.push(`${category}:`);
        for (const cmd of commands) {
          const aliases = cmd.aliases && cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
          lines.push(`  ${cmd.name.padEnd(20)} - ${cmd.description}${aliases}`);
        }
        lines.push('');
      }
    }
    
    lines.push('Note: Some commands support arguments (e.g., "ls /path", "find name /dir")');
    lines.push('      Some commands support repetition (e.g., "ping 5" sends 5 pings)');
    
    return {
      success: true,
      message: lines.join('\n')
    };
  }
};
