const { formatBytes } = require('./utils');

module.exports = {
  name: 'profile',
  description: 'Show profiling info',
  category: 'Development & Debug',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    return {
      success: true,
      message: [
        'Profiling Information:',
        `  Heap Used: ${formatBytes(memUsage.heapUsed)}`,
        `  Heap Total: ${formatBytes(memUsage.heapTotal)}`,
        `  RSS: ${formatBytes(memUsage.rss)}`,
        `  External: ${formatBytes(memUsage.external)}`,
        `  Array Buffers: ${formatBytes(memUsage.arrayBuffers)}`
      ].join('\n')
    };
  }
};
