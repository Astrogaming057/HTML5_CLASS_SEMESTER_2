const os = require('os');
const { formatUptime } = require('./utils');

module.exports = {
  name: 'uptime',
  description: 'Show server uptime',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const processUptime = process.uptime();
    const systemUptime = os.uptime();
    
    return {
      success: true,
      message: [
        'Uptime:',
        `  Process: ${formatUptime(processUptime)}`,
        `  System: ${formatUptime(systemUptime)}`
      ].join('\n'),
      data: {
        process: processUptime,
        system: systemUptime
      }
    };
  }
};
