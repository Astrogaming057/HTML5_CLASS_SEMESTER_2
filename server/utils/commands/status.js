const { formatBytes, formatUptime } = require('./utils');

module.exports = {
  name: 'status',
  description: 'Show server status information',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const os = require('os');
    const process = require('process');
    
    const status = {
      uptime: formatUptime(process.uptime()),
      memory: {
        used: formatBytes(process.memoryUsage().heapUsed),
        total: formatBytes(process.memoryUsage().heapTotal),
        rss: formatBytes(process.memoryUsage().rss)
      },
      platform: process.platform,
      nodeVersion: process.version,
      clients: context.wsManager ? context.wsManager.clients.size : 0,
      baseDir: context.baseDir,
      cpuUsage: os.loadavg(),
      timestamp: new Date().toISOString()
    };
    
    const message = [
      'Server Status:',
      `  Uptime: ${status.uptime}`,
      `  Memory: ${status.memory.used} / ${status.memory.total} (RSS: ${status.memory.rss})`,
      `  Platform: ${status.platform}`,
      `  Node Version: ${status.nodeVersion}`,
      `  Connected Clients: ${status.clients}`,
      `  Base Directory: ${status.baseDir}`,
      `  CPU Load: ${status.cpuUsage[0].toFixed(2)}, ${status.cpuUsage[1].toFixed(2)}, ${status.cpuUsage[2].toFixed(2)}`,
      `  Timestamp: ${status.timestamp}`
    ].join('\n');
    
    return {
      success: true,
      message: message,
      data: status
    };
  }
};
