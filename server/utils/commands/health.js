const os = require('os');
const { formatUptime } = require('./utils');

module.exports = {
  name: 'health',
  description: 'Show health check status',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    const load = os.loadavg()[0];
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    const isHealthy = load < 5 && memPercent < 90;
    
    return {
      success: true,
      message: [
        'Health Check:',
        `  Status: ${isHealthy ? '✓ Healthy' : '⚠ Warning'}`,
        `  Memory Usage: ${memPercent.toFixed(2)}%`,
        `  CPU Load: ${load.toFixed(2)}`,
        `  Clients: ${context.wsManager ? context.wsManager.clients.size : 0}`,
        `  Uptime: ${formatUptime(process.uptime())}`
      ].join('\n')
    };
  }
};
