const { cleanupCache } = require('../cacheCleanup');

module.exports = {
  name: 'cleanup',
  description: 'Clean up cache (remove duplicates)',
  category: 'Cache Management',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      await cleanupCache(context.baseDir, context.wsManager);
      return {
        success: true,
        message: 'Cleanup completed. Check logs for details.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error during cleanup: ${error.message}`
      };
    }
  }
};
