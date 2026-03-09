const logger = require('./logger');
const { executeCommand } = require('./commands/index');

class ServerCommands {
  constructor(wsManager, server, baseDir) {
    this.wsManager = wsManager;
    this.server = server;
    this.baseDir = baseDir;
  }

  async executeCommand(command, args = []) {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const count = parseInt(parts[1]) || 1;
    
    // Handle commands that support repetition
    if (count > 1 && (cmd === 'ping')) {
      const results = [];
      for (let i = 0; i < count; i++) {
        const result = await executeCommand(cmd, { wsManager: this.wsManager, server: this.server, baseDir: this.baseDir }, args);
        results.push(result);
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between pings
        }
      }
      
      // Aggregate results for ping
      if (cmd === 'ping') {
        const latencies = results.map(r => r.latency).filter(l => l !== undefined);
        const avgLatency = latencies.length > 0 
          ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
          : 'N/A';
        const minLatency = latencies.length > 0 ? Math.min(...latencies).toFixed(2) : 'N/A';
        const maxLatency = latencies.length > 0 ? Math.max(...latencies).toFixed(2) : 'N/A';
        const successCount = results.filter(r => r.success).length;
        
        return {
          success: true,
          message: `Ping results (${successCount}/${count} successful):\n  Average: ${avgLatency}ms\n  Min: ${minLatency}ms\n  Max: ${maxLatency}ms\n  Packets: ${successCount} sent, ${count} received`,
          data: { count, successCount, avgLatency, minLatency, maxLatency, results }
        };
      }
      
      return {
        success: true,
        message: `Command executed ${count} times`,
        data: { count, results }
      };
    }
    
    // Parse args from command string if not provided
    if (!args || args.length === 0) {
      args = parts.slice(1);
    }
    
    return await executeCommand(cmd, { wsManager: this.wsManager, server: this.server, baseDir: this.baseDir }, args);
  }
}

module.exports = ServerCommands;
