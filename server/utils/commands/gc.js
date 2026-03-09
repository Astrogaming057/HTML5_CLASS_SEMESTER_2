const { formatBytes } = require('./utils');

module.exports = {
  name: 'gc',
  description: 'Force garbage collection',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;
      return {
        success: true,
        message: `Garbage collection completed. Freed: ${formatBytes(freed)}`
      };
    } else {
      return {
        success: false,
        message: 'Garbage collection not available. Run with --expose-gc flag.'
      };
    }
  }
};
