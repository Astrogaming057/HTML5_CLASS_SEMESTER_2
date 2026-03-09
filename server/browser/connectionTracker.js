class ConnectionTracker {
  constructor() {
    this.hasConnection = false;
    this.listeners = new Set();
  }

  markConnected() {
    if (!this.hasConnection) {
      this.hasConnection = true;
      this.notifyListeners();
    }
  }

  hasActiveConnection() {
    return this.hasConnection;
  }

  onConnection(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in connection listener', error);
      }
    });
  }

  reset() {
    this.hasConnection = false;
  }
}

module.exports = ConnectionTracker;
