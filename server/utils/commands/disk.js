const fs = require('fs').promises;
const os = require('os');
const { formatBytes } = require('./utils');

module.exports = {
  name: 'disk',
  description: 'Show disk usage',
  category: 'System Information',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const stats = await fs.statfs ? await fs.statfs(context.baseDir) : null;
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      return {
        success: true,
        message: [
          'Disk Information:',
          `  Total Memory: ${formatBytes(totalMem)}`,
          `  Free Memory: ${formatBytes(freeMem)}`,
          `  Used Memory: ${formatBytes(totalMem - freeMem)}`,
          `  Usage: ${(((totalMem - freeMem) / totalMem) * 100).toFixed(2)}%`
        ].join('\n')
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting disk info: ${error.message}`
      };
    }
  }
};
