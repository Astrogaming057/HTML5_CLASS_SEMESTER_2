const os = require('os');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'memory',
  description: 'Show memory usage details',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      success: true,
      message: [
        'Memory Usage:',
        `  Heap Used: ${formatBytes(memUsage.heapUsed)}`,
        `  Heap Total: ${formatBytes(memUsage.heapTotal)}`,
        `  RSS: ${formatBytes(memUsage.rss)}`,
        `  External: ${formatBytes(memUsage.external)}`,
        `  Array Buffers: ${formatBytes(memUsage.arrayBuffers)}`,
        '',
        'System Memory:',
        `  Total: ${formatBytes(totalMem)}`,
        `  Used: ${formatBytes(usedMem)} (${((usedMem / totalMem) * 100).toFixed(2)}%)`,
        `  Free: ${formatBytes(freeMem)} (${((freeMem / totalMem) * 100).toFixed(2)}%)`
      ].join('\n'),
      data: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        total: totalMem,
        used: usedMem,
        free: freeMem
      }
    };
  }
};
