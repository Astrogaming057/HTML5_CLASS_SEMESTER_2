const { formatBytes, formatUptime } = require('./utils');

module.exports = {
  name: 'process',
  description: 'Show process information',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const memUsage = process.memoryUsage();
    return {
      success: true,
      message: [
        'Process Information:',
        `  PID: ${process.pid}`,
        `  PPID: ${process.ppid || 'N/A'}`,
        `  Uptime: ${formatUptime(process.uptime())}`,
        `  Memory: ${formatBytes(memUsage.rss)}`,
        `  Heap: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`,
        `  Exec Path: ${process.execPath}`,
        `  CWD: ${process.cwd()}`
      ].join('\n')
    };
  }
};
