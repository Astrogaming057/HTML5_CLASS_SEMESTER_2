window.PreviewWebSocket = (function() {
  let refreshTimeout = null;
  
  return {
    setupWebSocket(wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog, showServerUpdateNotification, handleFileSystemEvent, previewSettings, filePath, previewFrame, loadFileTree, isPreviewPinned, restartServerCallback) {
      let wsUrl;
      if (window.PreviewRemoteTransport && typeof window.PreviewRemoteTransport.getWebSocketUrl === 'function') {
        wsUrl = window.PreviewRemoteTransport.getWebSocketUrl();
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = protocol + '//' + window.location.host;
      }
      const ws = new WebSocket(wsUrl);
      
      const serverOutput = document.getElementById('terminalServerOutput');
      
      ws.onopen = () => {
        console.log('Preview WebSocket connected');
      };
      
      ws.onclose = (event) => {
        console.log('Preview WebSocket disconnected - Reconnecting...', { code: event.code, reason: event.reason });
        // Reconnect after a short delay, unless it was a normal closure (1000)
        // Code 1001 (going away) and others will trigger reconnection
        if (event.code !== 1000) {
          setTimeout(() => {
            wsRef.ws = this.setupWebSocket(wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog, showServerUpdateNotification, handleFileSystemEvent, previewSettings, filePath, previewFrame, loadFileTree, isPreviewPinned, restartServerCallback);
          }, 1000);
        } else {
          // Even for normal closure, reconnect if it was a reconnect request
          setTimeout(() => {
            wsRef.ws = this.setupWebSocket(wsRef, syncChannel, receivedLogIds, generateLogId, addPreviewLog, showServerUpdateNotification, handleFileSystemEvent, previewSettings, filePath, previewFrame, loadFileTree, isPreviewPinned, restartServerCallback);
          }, 1000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onmessage = (event) => {
        try {
          // Check if data is valid before parsing
          if (!event.data) {
            return;
          }
          
          const dataString = typeof event.data === 'string' ? event.data : event.data.toString();
          if (!dataString || dataString.trim().length === 0) {
            return;
          }
          
          // Check if it looks like JSON
          const trimmed = dataString.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            // Not JSON, might be a plain string message - ignore it
            return;
          }
          
          const data = JSON.parse(dataString);

          if (data.type === 'editorClientsSnapshot') {
            if (window.PreviewClientSessions && typeof window.PreviewClientSessions.applySnapshot === 'function') {
              window.PreviewClientSessions.applySnapshot(data);
            }
          }

          if (data.type === 'remoteViewersUpdate') {
            const remoteUi =
              window.PreviewRemoteTransport &&
              typeof window.PreviewRemoteTransport.isRemote === 'function' &&
              window.PreviewRemoteTransport.isRemote();
            if (remoteUi) {
              /* Counts for *this* PC come from PreviewRemoteViewers’ second WS to the local Astro Code origin. */
            } else if (
              window.PreviewRemoteViewers &&
              typeof window.PreviewRemoteViewers.applyUpdate === 'function'
            ) {
              window.PreviewRemoteViewers.applyUpdate(data);
            }
          }

          // Handle cache cleanup messages
          if (data.type === 'cache-cleanup-start') {
            console.log(`[Cache Cleanup] ${data.message}`);
            if (addPreviewLog) {
              addPreviewLog(data.message, 'info', generateLogId);
            }
          } else if (data.type === 'cache-cleanup-delete') {
            console.log(`[Cache Cleanup] ${data.message}`);
            if (addPreviewLog) {
              addPreviewLog(data.message, 'info', generateLogId);
            }
          } else if (data.type === 'cache-cleanup-complete') {
            console.log(`[Cache Cleanup] ${data.message}`);
            if (addPreviewLog) {
              addPreviewLog(data.message, 'info', generateLogId);
              if (data.log && data.log.length > 0) {
                // Log all cleanup details
                data.log.forEach(logLine => {
                  if (logLine !== data.message) {
                    addPreviewLog(logLine, 'info', generateLogId);
                  }
                });
              }
            }
          } else if (data.type === 'cache-cleanup-error') {
            console.error(`[Cache Cleanup Error] ${data.message}`);
            if (addPreviewLog) {
              addPreviewLog(data.message, 'error', generateLogId);
            }
          }
          
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
          
          if (data.type === 'server-restart-request') {
            // Trigger the same restart flow as server update
            // This will show the notification and allow user to restart, or auto-restart if callback provided
            if (restartServerCallback) {
              // Auto-restart immediately
              restartServerCallback();
            } else if (showServerUpdateNotification) {
              // Show notification for manual restart
              showServerUpdateNotification();
            }
          }
          
          if (data.type === 'fileAdded' || data.type === 'fileDeleted' || 
              data.type === 'directoryAdded' || data.type === 'directoryDeleted') {
            handleFileSystemEvent(data, loadFileTree);
          } else if (data.type === 'server-command-response') {
            const commandsOutput = document.getElementById('terminalCommandsOutput');
            if (commandsOutput) {
              // Handle clear command
              if (data.message === 'CLEAR_TERMINAL') {
                commandsOutput.innerHTML = '';
              } else {
                const lines = (data.message || (data.success ? 'Command executed successfully' : 'Command failed')).split('\n');
                lines.forEach(lineText => {
                  if (lineText.trim()) {
                    const line = document.createElement('div');
                    line.className = `terminal-line ${data.success ? 'info' : 'error'}`;
                    line.textContent = lineText;
                    commandsOutput.appendChild(line);
                  }
                });
              }
              commandsOutput.scrollTop = commandsOutput.scrollHeight;
            }
          } else if (data.type === 'reconnect-request') {
            console.log('Server requested reconnect - closing connection to reconnect...');
            // Close with code 1001 to trigger reconnection
            ws.close(1001, 'Reconnect requested by server');
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
      if (typeof PreviewSettings !== 'undefined' && PreviewSettings.getSettings().explorerTreeView) {
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
          loadFileTree('/');
          refreshTimeout = null;
        }, 100);
        return;
      }

      const normalizePath = (p) => {
        const pathStr = typeof p === 'function' ? p() : (typeof p === 'string' ? p : String(p || ''));
        const cleaned = pathStr.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
        return cleaned;
      };

      const eventPath = normalizePath(data.path);
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      let currentDirNormalized = normalizePath(currentDir || '/');

      // Treat empty normalized path as root directory
      if (!currentDirNormalized) {
        currentDirNormalized = '/';
      }

      let isInCurrentDir = false;
      let isParentChange = false;

      if (currentDirNormalized === '/') {
        // When viewing the project root, any file system change should refresh the tree
        isInCurrentDir = true;
        isParentChange = false;
      } else {
        isInCurrentDir = eventPath.startsWith(currentDirNormalized + '/') ||
                         eventPath === currentDirNormalized;
        isParentChange = currentDirNormalized.startsWith(eventPath + '/');
      }
      
      if (isInCurrentDir || isParentChange) {
        // Debounce rapid file system events to prevent multiple refreshes
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
          loadFileTree(currentDir || '/');
          refreshTimeout = null;
        }, 100);
      }
    }
  };
})();
