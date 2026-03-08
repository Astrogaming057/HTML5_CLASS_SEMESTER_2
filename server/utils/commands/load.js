const os = require('os');

module.exports = {
  name: 'load',
  description: 'Show system load average',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    const loadAvg = os.loadavg();
    return {
      success: true,
      message: [
        'System Load Average:',
        `  1 minute: ${loadAvg[0].toFixed(2)}`,
        `  5 minutes: ${loadAvg[1].toFixed(2)}`,
        `  15 minutes: ${loadAvg[2].toFixed(2)}`
      ].join('\n')
    };
  }
};
