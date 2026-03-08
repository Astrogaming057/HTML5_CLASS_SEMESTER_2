const os = require('os');

module.exports = {
  name: 'network',
  description: 'Show network information',
  category: 'Network & Connections',
  aliases: [],
  
  execute(context, args = []) {
    const interfaces = os.networkInterfaces();
    const info = [];
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          info.push(`  ${name}: ${addr.address}`);
        }
      }
    }
    
    return {
      success: true,
      message: ['Network Interfaces:'].concat(info.length > 0 ? info : ['  No external interfaces found']).join('\n')
    };
  }
};
