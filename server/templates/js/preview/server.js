window.PreviewServer = (function() {
  let serverUpdateNotificationShown = false;

  return {
    showServerUpdateNotification(restartServer) {
      if (serverUpdateNotificationShown) return;
      serverUpdateNotificationShown = true;
      
      const notification = document.getElementById('serverUpdateNotification');
      if (!notification) return;
      
      notification.style.display = 'block';
      
      const updateNowBtn = document.getElementById('serverUpdateNow');
      const skipBtn = document.getElementById('serverUpdateSkip');
      
      if (updateNowBtn) {
        updateNowBtn.onclick = () => {
          notification.style.display = 'none';
          restartServer();
        };
      }
      
      if (skipBtn) {
        skipBtn.onclick = () => {
          notification.style.display = 'none';
          serverUpdateNotificationShown = false;
        };
      }
    },

    async restartServer(editor, filePath, isDirty, saveFile, ws) {
      const overlay = document.getElementById('restartOverlay');
      const statusEl = document.getElementById('restartStatus');
      if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
      
      let savedState = null;
      try {
        if (editor && editor.getModel()) {
          const currentContent = editor.getModel().getValue();
          const currentPath = filePath;
          savedState = {
            filePath: currentPath,
            content: currentContent,
            cursorPosition: editor.getPosition(),
            scrollPosition: editor.getScrollTop(),
            viewState: editor.saveViewState()
          };
          localStorage.setItem('tempEditorState', JSON.stringify(savedState));
        }
      } catch (err) {
        console.error('Error saving editor state:', err);
      }
      
      if (statusEl) statusEl.textContent = 'Saving current work...';
      
      if (isDirty && editor && editor.getModel()) {
        try {
          await saveFile();
        } catch (err) {
          console.error('Error saving file before restart:', err);
        }
      }
      
      if (statusEl) statusEl.textContent = 'Restarting server...';
      
      if (ws) {
        ws.close();
        ws = null;
      }
      
      try {
        const response = await fetch('/__api__/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to restart server');
        }
        
        if (statusEl) statusEl.textContent = 'Waiting for server to restart...';
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        if (statusEl) statusEl.textContent = 'Waiting for server to bind port...';
        
        await this.waitForHttpServer();
        
        if (statusEl) statusEl.textContent = 'Waiting for WebSocket connection';
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        if (statusEl) statusEl.textContent = 'Connecting to WebSocket...';
        
        await this.waitForWebSocket();
        
        if (statusEl) statusEl.textContent = 'Server restarted! Reloading...';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        window.location.reload();
      } catch (err) {
        console.error('Error restarting server:', err);
        if (statusEl) statusEl.textContent = 'Error: ' + err.message;
        if (overlay) {
          setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
          }, 3000);
        }
      }
    },

    async waitForHttpServer(maxAttempts = 30, delay = 1000) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const response = await fetch('/__api__/files?path=/&list=true', {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
          });
          if (response.ok) {
            return true;
          }
        } catch (err) {
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      throw new Error('HTTP server did not restart in time');
    },

    async waitForWebSocket(maxAttempts = 60, delay = 500) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        let resolved = false;
        
        const checkConnection = () => {
          attempts++;
          
          if (attempts > maxAttempts) {
            if (!resolved) {
              resolved = true;
              reject(new Error('WebSocket did not reconnect in time'));
            }
            return;
          }
          
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = protocol + '//' + window.location.host;
          const testWs = new WebSocket(wsUrl);
          
          testWs.onopen = () => {
            if (!resolved) {
              resolved = true;
              testWs.close();
              resolve(true);
            }
          };
          
          testWs.onerror = () => {
            testWs.close();
            if (!resolved) {
              setTimeout(checkConnection, delay);
            }
          };
          
          testWs.onclose = (event) => {
            if (!resolved && testWs.readyState === WebSocket.CLOSED && event.code !== 1000) {
              setTimeout(checkConnection, delay);
            }
          };
        };
        
        checkConnection();
      });
    },

    restoreTempEditorState(filePath, editor, updateStatus) {
      try {
        const tempState = localStorage.getItem('tempEditorState');
        if (tempState) {
          const state = JSON.parse(tempState);
          localStorage.removeItem('tempEditorState');
          
          if (state.filePath === filePath && editor && editor.getModel()) {
            editor.getModel().setValue(state.content);
            
            if (state.cursorPosition) {
              editor.setPosition(state.cursorPosition);
              editor.revealPositionInCenter(state.cursorPosition);
            }
            
            if (state.scrollPosition !== undefined) {
              editor.setScrollTop(state.scrollPosition);
            }
            
            if (state.viewState) {
              editor.restoreViewState(state.viewState);
            }
            
            if (updateStatus) {
              updateStatus();
            }
          }
        }
      } catch (err) {
        console.error('Error restoring temp editor state:', err);
      }
    }
  };
})();
