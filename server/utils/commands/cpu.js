const os = require('os');

module.exports = {
  name: 'cpu',
  description: 'Show CPU information',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    return {
      success: true,
      message: [
        'CPU Information:',
        `  Cores: ${cpus.length}`,
        `  Model: ${cpus[0]?.model || 'Unknown'}`,
        `  Speed: ${cpus[0]?.speed || 0} MHz`,
        `  Load Average (1m): ${loadAvg[0].toFixed(2)}`,
        `  Load Average (5m): ${loadAvg[1].toFixed(2)}`,
        `  Load Average (15m): ${loadAvg[2].toFixed(2)}`
      ].join('\n'),
      data: { cores: cpus.length, loadAvg }
    };
  }
};
