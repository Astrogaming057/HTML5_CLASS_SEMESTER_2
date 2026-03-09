const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.connectionListeners = new Set();
    this.serverCommands = null;
  }

  setServerCommands(serverCommands) {
    this.serverCommands = serverCommands;
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
      
      this.notifyConnectionListeners();

      ws.on('message', async (data) => {
        try {
          // Check if data is valid before parsing
          if (!data) {
            logger.debug('Received empty WebSocket message');
            return;
          }
          
          const dataString = data.toString();
          if (!dataString || dataString.trim().length === 0) {
            logger.debug('Received empty string WebSocket message');
            return;
          }
          
          // Check if it looks like JSON (starts with { or [)
          if (!dataString.trim().startsWith('{') && !dataString.trim().startsWith('[')) {
            logger.debug('Received non-JSON WebSocket message', { 
              preview: dataString.substring(0, 100),
              length: dataString.length 
            });
            return;
          }
          
          const message = JSON.parse(dataString);
          
          if (!message || typeof message !== 'object') {
            logger.debug('Parsed message is not an object', { message });
            return;
          }
          
          if (message.type === 'preview-log') {
            this.broadcast({
              type: 'preview-log',
              message: message.message,
              logType: message.logType || 'log',
              timestamp: message.timestamp || new Date().toISOString()
            });
          } else if (message.type === 'preview-log-clear') {
            this.broadcast({
              type: 'preview-log-clear'
            });
          } else if (message.type === 'server-command') {
            if (this.serverCommands) {
              const result = await this.serverCommands.executeCommand(message.command, message.args || []);
              ws.send(JSON.stringify({
                type: 'server-command-response',
                command: message.command,
                success: result.success,
                message: result.message,
                data: result.data,
                timestamp: new Date().toISOString()
              }));
              
              logger.info('Server command executed', { 
                command: message.command, 
                success: result.success 
              });
            }
          }
        } catch (error) {
          // Only log if it's not a JSON parse error for empty/invalid messages
          if (error instanceof SyntaxError) {
            const dataPreview = data ? data.toString().substring(0, 100) : 'null';
            logger.debug('Error parsing WebSocket message (invalid JSON)', { 
              error: error.message,
              preview: dataPreview,
              length: data ? data.toString().length : 0
            });
          } else {
            logger.debug('Error processing WebSocket message', { error: error.message });
          }
        }
      });

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

  onConnection(callback) {
    this.connectionListeners.add(callback);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  notifyConnectionListeners() {
    this.connectionListeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('Error in connection listener', error);
      }
    });
  }
}

module.exports = WebSocketManager;
