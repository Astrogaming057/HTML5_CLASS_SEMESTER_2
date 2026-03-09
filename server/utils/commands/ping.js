module.exports = {
  name: 'ping',
  description: 'Check server connectivity and latency',
  category: 'System Information',
  aliases: [],
  
  async execute(context, args = []) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const os = require('os');
    const process = require('process');
    const latency = Date.now() - startTime;
    
    return {
      success: true,
      message: `pong - Latency: ${latency}ms\n  Timestamp: ${timestamp}\n  Platform: ${os.platform()}\n  Node: ${process.version}`,
      latency: latency,
      timestamp: timestamp,
      data: {
        latency,
        platform: os.platform(),
        nodeVersion: process.version
      }
    };
  }
};
