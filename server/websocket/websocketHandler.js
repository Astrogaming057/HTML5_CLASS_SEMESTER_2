const WebSocket = require('ws');
const logger = require('../utils/logger');

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  constructor() {
    this.clients = new Set();
  }

  /**
   * Setup WebSocket server
   * @param {http.Server} server - HTTP server instance
   * @returns {WebSocket.Server} WebSocket server instance
   */
  setup(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      const clientInfo = { 
        ip: req.socket.remoteAddress, 
        totalClients: this.clients.size 
      };
      logger.info('WebSocket client connected', clientInfo);

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected', { 
          remainingClients: this.clients.size 
        });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', error);
      });
    });

    return this.wss;
  }

  /**
   * Close all WebSocket connections and server
   */
  close() {
    logger.info('Closing WebSocket server', { clients: this.clients.size });
    
    // Close all client connections
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    });
    this.clients.clear();
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message object to send
   */
  broadcast(message) {
    const messageString = JSON.stringify(message);
    let sentCount = 0;
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
          sentCount++;
        } catch (error) {
          logger.error('Error sending WebSocket message', error);
        }
      }
    });
    logger.debug('WebSocket broadcast', { 
      messageType: message.type, 
      clientsNotified: sentCount,
      totalClients: this.clients.size 
    });
  }

  /**
   * Notify clients about file changes
   * @param {string} filePath - Relative path of changed file
   */
  notifyFileChange(filePath) {
    logger.info('Notifying clients of file change', { filePath, clients: this.clients.size });
    this.broadcast({
      type: 'fileChanged',
      path: filePath
    });
  }
}

module.exports = WebSocketManager;
