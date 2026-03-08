window.PreviewWebSocket = (function() {
  return {
    setupWebSocket(wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog, showServerUpdateNotification, handleFileSystemEvent, previewSettings, filePath, previewFrame, loadFileTree) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host;
      const ws = new WebSocket(wsUrl);
      
      const serverOutput = document.getElementById('terminalServerOutput');
      
      ws.onopen = () => {
        console.log('Preview WebSocket connected');
      };
      
      ws.onclose = () => {
        console.log('Preview WebSocket disconnected - Reconnecting...');
        setTimeout(() => {
          wsRef.ws = this.setupWebSocket(wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog, showServerUpdateNotification, handleFileSystemEvent, previewSettings, filePath, previewFrame, loadFileTree);
        }, 2000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'serverLog' && serverOutput) {
            const line = document.createElement('div');
            line.className = `terminal-line ${data.level || 'log'}`;
            const metaStr = data.meta && Object.keys(data.meta).length > 0 
              ? ' ' + JSON.stringify(data.meta) 
              : '';
            line.textContent = `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.message}${metaStr}`;
            serverOutput.appendChild(line);
            serverOutput.scrollTop = serverOutput.scrollHeight;
            
            syncChannel.postMessage({
              type: 'terminal-output',
              tab: 'server',
              output: line.textContent + '\n',
              append: true
            });
          }
          
          if (data.type === 'preview-log') {
            const { message, logType, timestamp } = data;
            const logId = generateLogId(message, logType || 'log', timestamp || new Date().toISOString());
            
            if (!receivedLogIds.has(logId)) {
              receivedLogIds.add(logId);
              addPreviewLog(message, logType || 'log');
            }
          }
          
          if (data.type === 'preview-log-clear') {
            const output = document.getElementById('terminalLogOutput');
            if (output) {
              output.textContent = '';
              receivedLogIds.clear();
            }
            
            syncChannel.postMessage({
              type: 'terminal-clear',
              tab: 'log'
            });
          }
          
          if (data.type === 'serverUpdateAvailable') {
            showServerUpdateNotification();
          }
          
          if (data.type === 'fileAdded' || data.type === 'fileDeleted' || 
              data.type === 'directoryAdded' || data.type === 'directoryDeleted') {
            handleFileSystemEvent(data, loadFileTree);
          } else if (data.type === 'fileChanged' && previewSettings.autoRefreshPreview) {
            const normalizePath = (p) => {
              const pathStr = typeof p === 'function' ? p() : (typeof p === 'string' ? p : String(p || ''));
              return pathStr.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
            };
            const currentPathNormalized = normalizePath(filePath);
            const changedPathNormalized = normalizePath(data.path);
            
            if (currentPathNormalized === changedPathNormalized) {
              const actualFilePath = typeof filePath === 'function' ? filePath() : filePath;
              let previewUrl = '/__preview-content__?file=' + encodeURIComponent(actualFilePath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
              if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
                previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
              }
              previewUrl += '&t=' + Date.now();
              previewFrame.src = previewUrl;
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      return ws;
    },

    handleFileSystemEvent(data, getCurrentDir, loadFileTree) {
      const normalizePath = (p) => {
        const pathStr = typeof p === 'function' ? p() : (typeof p === 'string' ? p : String(p || ''));
        return pathStr.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
      };
      const eventPath = normalizePath(data.path);
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      const currentDirNormalized = normalizePath(currentDir || '/');
      
      const isInCurrentDir = eventPath.startsWith(currentDirNormalized + '/') || 
                            eventPath === currentDirNormalized ||
                            currentDirNormalized === '/';
      
      const isParentChange = currentDirNormalized.startsWith(eventPath + '/');
      
      if (isInCurrentDir || isParentChange) {
        loadFileTree(currentDir);
      }
    }
  };
})();
