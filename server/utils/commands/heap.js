const v8 = require('v8');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'heap',
  description: 'Show heap memory details',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      success: true,
      message: [
        'Heap Memory:',
        `  Used: ${formatBytes(memUsage.heapUsed)}`,
        `  Total: ${formatBytes(memUsage.heapTotal)}`,
        `  Limit: ${formatBytes(heapStats.heap_size_limit)}`,
        `  Available: ${formatBytes(heapStats.heap_size_limit - memUsage.heapUsed)}`,
        `  Usage: ${((memUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(2)}%`
      ].join('\n')
    };
  }
};
