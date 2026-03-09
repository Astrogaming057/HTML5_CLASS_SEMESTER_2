const os = require('os');
const { formatBytes, formatUptime } = require('./utils');

module.exports = {
  name: 'info',
  description: 'Show detailed server information',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    
    return {
      success: true,
      message: [
        'Server Information:',
        `  Node.js: ${process.version}`,
        `  Platform: ${os.type()} ${os.release()}`,
        `  Architecture: ${process.arch}`,
        `  Hostname: ${os.hostname()}`,
        `  Uptime: ${formatUptime(process.uptime())}`,
        `  Memory: ${formatBytes(memUsage.rss)}`,
        `  Base Directory: ${context.baseDir}`,
        `  Clients: ${context.wsManager ? context.wsManager.clients.size : 0}`
      ].join('\n')
    };
  }
};
