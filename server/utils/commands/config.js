module.exports = {
  name: 'config',
  description: 'Show configuration',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'Configuration:',
        `  Base Directory: ${context.baseDir}`,
        `  Port: ${context.server?.address()?.port || 'N/A'}`,
        `  Environment: ${process.env.NODE_ENV || 'development'}`,
        `  Platform: ${process.platform}`
      ].join('\n')
    };
  }
};
