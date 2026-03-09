const logger = require('../logger');
const { restartServer } = require('../serverRestart');

module.exports = {
  name: 'restart',
  description: 'Restart the server',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    logger.warn('Server restart requested via command');
    
    // Broadcast restart warning
    if (context.wsManager) {
      context.wsManager.broadcast({
        type: 'server-restart-request',
        message: 'Server restart requested. Server will restart in 2 seconds...',
        timestamp: new Date().toISOString()
      });
    }
    
    // Schedule restart using the shared restart function
    setTimeout(() => {
      restartServer();
    }, 2000);
    
    return {
      success: true,
      message: 'Server restart initiated. Restarting in 2 seconds...'
    };
  }
};
