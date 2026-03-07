const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketManager {
  constructor() {
    this.clients = new Set();
  }

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

  close() {
    logger.info('Closing WebSocket server', { clients: this.clients.size });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    });
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }

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

  notifyFileChange(filePath, eventType = 'change') {
    const messageTypes = {
      'change': 'fileChanged',
      'add': 'fileAdded',
      'unlink': 'fileDeleted',
      'addDir': 'directoryAdded',
      'unlinkDir': 'directoryDeleted'
    };
    
    const messageType = messageTypes[eventType] || 'fileChanged';
    logger.info('Notifying clients of file event', { filePath, eventType, messageType, clients: this.clients.size });
    
    this.broadcast({
      type: messageType,
      path: filePath,
      eventType: eventType
    });
  }
}

module.exports = WebSocketManager;
