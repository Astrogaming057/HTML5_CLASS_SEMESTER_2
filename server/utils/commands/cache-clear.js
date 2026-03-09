const { cleanupCache } = require('../cacheCleanup');

module.exports = {
  name: 'cache-clear',
  description: 'Clear all cache files',
  category: 'Cache Management',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      await cleanupCache(context.baseDir, context.wsManager);
      return {
        success: true,
        message: 'Cache cleanup completed. Check logs for details.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error clearing cache: ${error.message}`
      };
    }
  }
};
