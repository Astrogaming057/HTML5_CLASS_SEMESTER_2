const os = require('os');
const { formatBytes, formatUptime } = require('./utils');

module.exports = {
  name: 'stats',
  description: 'Show performance statistics',
  category: 'Memory & Performance',
  aliases: [],
  
  async execute(context, args = []) {
    const memUsage = process.memoryUsage();
    
    return {
      success: true,
      message: [
        'Performance Statistics:',
        `  Uptime: ${formatUptime(process.uptime())}`,
        `  Memory RSS: ${formatBytes(memUsage.rss)}`,
        `  Heap Used: ${formatBytes(memUsage.heapUsed)}`,
        `  Heap Total: ${formatBytes(memUsage.heapTotal)}`,
        `  External: ${formatBytes(memUsage.external)}`,
        `  CPU Load: ${os.loadavg()[0].toFixed(2)}`,
        `  Clients: ${context.wsManager ? context.wsManager.clients.size : 0}`
      ].join('\n')
    };
  }
};
