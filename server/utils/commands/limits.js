module.exports = {
  name: 'limits',
  description: 'Show system limits',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'System Limits:',
        `  Max Listeners: ${process.getMaxListeners()}`,
        `  Max Memory: ${process.memoryUsage().heapTotal > 0 ? 'Dynamic' : 'N/A'}`,
        `  Platform: ${process.platform}`
      ].join('\n')
    };
  }
};
