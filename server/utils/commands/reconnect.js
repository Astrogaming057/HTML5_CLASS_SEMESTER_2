const logger = require('../logger');

module.exports = {
  name: 'reconnect',
  description: 'Reconnect WebSocket connections',
  category: 'Network & Connections',
  aliases: [],
  
  async execute(context, args = []) {
    if (!context.wsManager) {
      return {
        success: false,
        message: 'WebSocket manager not available'
      };
    }
    
    const clientCount = context.wsManager.clients.size;
    
    // Close all connections with a reconnect code (1001 = going away, will trigger reconnect)
    const clients = Array.from(context.wsManager.clients);
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        // Send a message to client to reconnect before closing
        try {
          client.send(JSON.stringify({
            type: 'reconnect-request',
            message: 'Server requested reconnect'
          }));
        } catch (error) {
          // Ignore send errors
        }
        // Close with code 1001 (going away) which will trigger automatic reconnection
        setTimeout(() => {
          try {
            client.close(1001, 'Reconnect requested');
          } catch (error) {
            // Ignore close errors
          }
        }, 100);
      }
    });
    
    logger.info('Reconnect command executed', { disconnectedClients: clientCount });
    
    return {
      success: true,
      message: `Reconnect initiated. ${clientCount} client(s) disconnected and will reconnect automatically.`
    };
  }
};
