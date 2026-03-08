module.exports = {
  name: 'routes',
  description: 'Show API routes',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'API Routes:',
        '  GET  /__api__/files - File operations',
        '  POST /__api__/files - Create files',
        '  PUT  /__api__/files - Update files',
        '  DELETE /__api__/files - Delete files',
        '  GET  /__api__/files/editor - Get cached file',
        '  POST /__api__/files/editor - Save to cache',
        '  DELETE /__api__/files/editor - Delete from cache',
        '  POST /__api__/restart - Restart server',
        '  POST /__api__/terminal - Execute terminal commands'
      ].join('\n')
    };
  }
};
