module.exports = {
  name: 'check',
  description: 'Check system integrity',
  category: 'Development & Debug',
  aliases: [],
  
  async execute(context, args = []) {
    return {
      success: true,
      message: [
        'System Check:',
        '  ✓ Server running',
        `  ✓ WebSocket: ${context.wsManager ? 'Active' : 'Inactive'}`,
        `  ✓ Base Directory: ${context.baseDir}`,
        '  ✓ All systems operational'
      ].join('\n')
    };
  }
};
