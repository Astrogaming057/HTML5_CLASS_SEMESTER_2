window.PreviewTerminal = (function() {
  let logMessageListenerSetup = false;

  return {
    addPreviewLog(message, type, receivedLogIds, generateLogId, syncChannel, ws) {
      const output = document.getElementById('terminalLogOutput');
      if (!output) return;
      
      if (message === 'Console injected successfully') {
        output.textContent = '';
        receivedLogIds.clear();
        
        syncChannel.postMessage({
          type: 'terminal-clear',
          tab: 'log'
        });
        
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'preview-log-clear'
          }));
        }
      }
      
      const line = document.createElement('div');
      line.className = `terminal-line ${type}`;
      line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    },

    setupPreviewLogInterception(receivedLogIds, generateLogId, addPreviewLog, syncChannel, ws) {
      if (logMessageListenerSetup) return;
      logMessageListenerSetup = true;
      
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'preview-log') {
          const { message, logType, timestamp } = event.data;
          const logId = generateLogId(message, logType || 'log', timestamp || new Date().toISOString());
          
          if (!receivedLogIds.has(logId)) {
            receivedLogIds.add(logId);
            addPreviewLog(message, logType || 'log');
            
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'preview-log',
                message: message,
                logType: logType || 'log',
                timestamp: timestamp || new Date().toISOString()
              }));
            }
          }
        } else if (event.data && event.data.type === 'preview-log-clear') {
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
      });
    },

    createCommandHistory(terminalType) {
      const storageKey = `terminalHistory_${terminalType}`;
      const maxHistory = 100;
      
      function loadHistory() {
        try {
          const saved = localStorage.getItem(storageKey);
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          return [];
        }
      }
      
      function saveHistory(history) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(history.slice(-maxHistory)));
        } catch (error) {
          console.error('Error saving command history:', error);
        }
      }
      
      function addCommand(command) {
        if (!command || command.trim() === '') return;
        const history = loadHistory();
        const trimmedCommand = command.trim();
        
        const index = history.indexOf(trimmedCommand);
        if (index !== -1) {
          history.splice(index, 1);
        }
        
        history.push(trimmedCommand);
        saveHistory(history);
      }
      
      return {
        load: loadHistory,
        add: addCommand,
        maxHistory: maxHistory
      };
    },

    handleTerminalCommand(tab, command, syncChannel, previewFrame) {
      let tabName = tab;
      if (tab === 'powershell') {
        tabName = 'PowerShell';
      } else {
        tabName = tab.charAt(0).toUpperCase() + tab.slice(1);
      }
      const outputEl = document.getElementById(`terminal${tabName}Output`);
      if (!outputEl) {
        console.error('Terminal output element not found for tab:', tab, 'element ID:', `terminal${tabName}Output`);
        return;
      }
      
      if (tab === 'client') {
        outputEl.textContent += `> ${command}\n`;
        try {
          const result = eval(command);
          outputEl.textContent += `${result}\n`;
        } catch (err) {
          outputEl.textContent += `Error: ${err.message}\n`;
        }
        outputEl.scrollTop = outputEl.scrollHeight;
        
        syncChannel.postMessage({
          type: 'terminal-output',
          tab: tab,
          output: outputEl.textContent,
          append: false
        });
      } else if (tab === 'powershell') {
        fetch('/__api__/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: command, type: 'powershell' })
        })
        .then(res => res.json())
        .then(data => {
          const commandLine = document.createElement('div');
          commandLine.className = 'terminal-line log';
          commandLine.textContent = `PS> ${command}`;
          outputEl.appendChild(commandLine);
          
          if (data.success) {
            if (data.output && data.output.trim()) {
              const lines = data.output.split('\n');
              lines.forEach(line => {
                if (line.trim()) {
                  const lineEl = document.createElement('div');
                  lineEl.className = 'terminal-line info';
                  lineEl.textContent = line;
                  outputEl.appendChild(lineEl);
                  
                  syncChannel.postMessage({
                    type: 'terminal-output',
                    tab: tab,
                    output: line + '\n',
                    append: true,
                    lineType: 'info'
                  });
                }
              });
            }
            if (data.error && data.error.trim()) {
              const errorLines = data.error.split('\n');
              errorLines.forEach(line => {
                if (line.trim()) {
                  let lineType = 'warn';
                  if (line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
                    lineType = 'error';
                  } else if (line.toLowerCase().includes('warning')) {
                    lineType = 'warn';
                  }
                  
                  const lineEl = document.createElement('div');
                  lineEl.className = `terminal-line ${lineType}`;
                  lineEl.textContent = line;
                  outputEl.appendChild(lineEl);
                  
                  syncChannel.postMessage({
                    type: 'terminal-output',
                    tab: tab,
                    output: line + '\n',
                    append: true,
                    lineType: lineType
                  });
                }
              });
            }
          } else {
            const errorLine = document.createElement('div');
            errorLine.className = 'terminal-line error';
            errorLine.textContent = `Error: ${data.error || 'Command failed'}`;
            outputEl.appendChild(errorLine);
            
            if (data.stderr) {
              const stderrLine = document.createElement('div');
              stderrLine.className = 'terminal-line error';
              stderrLine.textContent = data.stderr;
              outputEl.appendChild(stderrLine);
              
              syncChannel.postMessage({
                type: 'terminal-output',
                tab: tab,
                output: data.stderr + '\n',
                append: true,
                lineType: 'error'
              });
            }
            
            syncChannel.postMessage({
              type: 'terminal-output',
              tab: tab,
              output: `Error: ${data.error || 'Command failed'}\n`,
              append: true,
              lineType: 'error'
            });
          }
          
          outputEl.scrollTop = outputEl.scrollHeight;
          
          syncChannel.postMessage({
            type: 'terminal-output',
            tab: tab,
            output: `PS> ${command}\n`,
            append: true,
            lineType: 'log'
          });
        })
        .catch(err => {
          const errorLine = document.createElement('div');
          errorLine.className = 'terminal-line error';
          errorLine.textContent = `Network Error: ${err.message}`;
          outputEl.appendChild(errorLine);
          outputEl.scrollTop = outputEl.scrollHeight;
          
          syncChannel.postMessage({
            type: 'terminal-output',
            tab: tab,
            output: `Network Error: ${err.message}\n`,
            append: true,
            lineType: 'error'
          });
        });
      } else if (tab === 'log') {
        if (previewFrame && previewFrame.contentWindow) {
          try {
            const result = previewFrame.contentWindow.eval(command);
            outputEl.textContent += `> ${command}\n${result}\n`;
          } catch (err) {
            outputEl.textContent += `> ${command}\nError: ${err.message}\n`;
          }
          outputEl.scrollTop = outputEl.scrollHeight;
          
          syncChannel.postMessage({
            type: 'terminal-output',
            tab: tab,
            output: outputEl.textContent,
            append: false
          });
        }
      }
    },

    setupTerminal(saveState, syncChannel, previewFrame, addPreviewLog, setupPreviewLogInterception) {
      const tabs = document.querySelectorAll('.terminal-tab');
      const tabContents = document.querySelectorAll('.terminal-tab-content');
      const clientInput = document.getElementById('terminalClientInput');
      const powershellInput = document.getElementById('terminalPowerShellInput');
      const logInput = document.getElementById('terminalLogInput');
      const clientOutput = document.getElementById('terminalClientOutput');
      const serverOutput = document.getElementById('terminalServerOutput');
      const powershellOutput = document.getElementById('terminalPowerShellOutput');
      
      const clientHistory = this.createCommandHistory('client');
      const powershellHistory = this.createCommandHistory('powershell');
      const logHistory = this.createCommandHistory('log');
      
      let clientHistoryIndex = -1;
      let powershellHistoryIndex = -1;
      let logHistoryIndex = -1;
      let clientCurrentInput = '';
      let powershellCurrentInput = '';
      let logCurrentInput = '';
      
      if (clientInput) {
        clientInput.disabled = false;
        clientInput.style.pointerEvents = 'auto';
      }
      if (powershellInput) {
        powershellInput.disabled = false;
        powershellInput.style.pointerEvents = 'auto';
      }
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          tabContents.forEach(content => {
            content.classList.remove('active');
            let expectedId;
            if (tabName === 'powershell') {
              expectedId = 'terminalPowerShell';
            } else if (tabName === 'client') {
              expectedId = 'terminalClient';
            } else if (tabName === 'server') {
              expectedId = 'terminalServer';
            } else if (tabName === 'log') {
              expectedId = 'terminalLog';
            } else {
              expectedId = `terminal${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
            }
            
            if (content.id === expectedId) {
              content.classList.add('active');
              content.style.display = 'flex';
              
              const inputContainer = content.querySelector('.terminal-input-container');
              if (inputContainer) {
                inputContainer.style.display = 'flex';
              }
              
              const input = content.querySelector('.terminal-input');
              if (input) {
                input.disabled = false;
                input.style.pointerEvents = 'auto';
                input.style.display = 'block';
                setTimeout(() => {
                  input.focus();
                }, 100);
              }
            } else {
              content.style.display = 'none';
            }
          });
          
          saveState();
        });
      });
      
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;
      
      function addLogToTerminal(message, type = 'log') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        clientOutput.appendChild(line);
        clientOutput.scrollTop = clientOutput.scrollHeight;
        
        syncChannel.postMessage({
          type: 'terminal-output',
          tab: 'client',
          output: line.textContent + '\n',
          append: true
        });
      }
      
      console.log = function(...args) {
        originalLog.apply(console, args);
        addLogToTerminal(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'log');
      };
      
      console.info = function(...args) {
        originalInfo.apply(console, args);
        addLogToTerminal(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'info');
      };
      
      console.warn = function(...args) {
        originalWarn.apply(console, args);
        addLogToTerminal(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'warn');
      };
      
      console.error = function(...args) {
        originalError.apply(console, args);
        addLogToTerminal(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'error');
      };
      
      if (clientInput) {
        clientInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const history = clientHistory.load();
            if (history.length === 0) return;
            
            if (clientHistoryIndex === -1) {
              clientCurrentInput = clientInput.value;
              clientHistoryIndex = history.length;
            }
            
            if (clientHistoryIndex > 0) {
              clientHistoryIndex--;
              clientInput.value = history[clientHistoryIndex];
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const history = clientHistory.load();
            
            if (clientHistoryIndex === -1) return;
            
            if (clientHistoryIndex < history.length - 1) {
              clientHistoryIndex++;
              clientInput.value = history[clientHistoryIndex];
            } else {
              clientHistoryIndex = -1;
              clientInput.value = clientCurrentInput;
            }
          } else if (e.key === 'Enter') {
            const command = clientInput.value.trim();
            if (command) {
              clientHistory.add(command);
              clientHistoryIndex = -1;
              clientCurrentInput = '';
              
              addLogToTerminal(`> ${command}`, 'log');
              try {
                const result = eval(command);
                if (result !== undefined) {
                  addLogToTerminal(String(result), 'info');
                }
              } catch (err) {
                addLogToTerminal(`Error: ${err.message}`, 'error');
              }
              clientInput.value = '';
              
              syncChannel.postMessage({
                type: 'terminal-command',
                tab: 'client',
                command: command
              });
            }
          }
        });
      }
      
      if (powershellInput) {
        powershellInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (powershellInput.disabled) return;
            const history = powershellHistory.load();
            if (history.length === 0) return;
            
            if (powershellHistoryIndex === -1) {
              powershellCurrentInput = powershellInput.value;
              powershellHistoryIndex = history.length;
            }
            
            if (powershellHistoryIndex > 0) {
              powershellHistoryIndex--;
              powershellInput.value = history[powershellHistoryIndex];
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (powershellInput.disabled) return;
            const history = powershellHistory.load();
            
            if (powershellHistoryIndex === -1) return;
            
            if (powershellHistoryIndex < history.length - 1) {
              powershellHistoryIndex++;
              powershellInput.value = history[powershellHistoryIndex];
            } else {
              powershellHistoryIndex = -1;
              powershellInput.value = powershellCurrentInput;
            }
          } else if (e.key === 'Enter') {
            const command = powershellInput.value.trim();
            if (command) {
              powershellHistory.add(command);
              powershellHistoryIndex = -1;
              powershellCurrentInput = '';
              
              const addPowerShellLog = (message, type = 'log') => {
                if (!powershellOutput) return;
                const line = document.createElement('div');
                line.className = `terminal-line ${type}`;
                line.textContent = message;
                powershellOutput.appendChild(line);
                powershellOutput.scrollTop = powershellOutput.scrollHeight;
              };
              
              addPowerShellLog(`PS> ${command}`, 'log');
              powershellInput.value = '';
              powershellInput.disabled = true;
              
              const loadingLine = document.createElement('div');
              loadingLine.className = 'terminal-line info';
              loadingLine.textContent = 'Executing...';
              loadingLine.id = 'powershell-loading';
              powershellOutput.appendChild(loadingLine);
              powershellOutput.scrollTop = powershellOutput.scrollHeight;
              
              fetch('/__api__/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: command, type: 'powershell' })
              })
              .then(res => res.json())
              .then(data => {
                const loading = document.getElementById('powershell-loading');
                if (loading) loading.remove();
                
                if (data.success) {
                  if (data.output && data.output.trim()) {
                    const lines = data.output.split('\n');
                    lines.forEach(line => {
                      if (line.trim()) {
                        addPowerShellLog(line, 'info');
                      }
                    });
                  }
                  if (data.error && data.error.trim()) {
                    const errorLines = data.error.split('\n');
                    errorLines.forEach(line => {
                      if (line.trim() && !line.includes('Warning:')) {
                        if (line.toLowerCase().includes('error')) {
                          addPowerShellLog(line, 'error');
                        } else {
                          addPowerShellLog(line, 'warn');
                        }
                      }
                    });
                  }
                } else {
                  addPowerShellLog(`Error: ${data.error}`, 'error');
                  if (data.stderr) {
                    addPowerShellLog(data.stderr, 'error');
                  }
                }
              })
              .catch(err => {
                const loading = document.getElementById('powershell-loading');
                if (loading) loading.remove();
                
                addPowerShellLog(`Network Error: ${err.message}`, 'error');
              })
              .finally(() => {
                powershellInput.disabled = false;
                powershellInput.focus();
              });
            }
          }
        });
      }
      
      if (logInput) {
        logInput.disabled = false;
        logInput.style.pointerEvents = 'auto';
        
        logInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const history = logHistory.load();
            if (history.length === 0) return;
            
            if (logHistoryIndex === -1) {
              logCurrentInput = logInput.value;
              logHistoryIndex = history.length;
            }
            
            if (logHistoryIndex > 0) {
              logHistoryIndex--;
              logInput.value = history[logHistoryIndex];
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const history = logHistory.load();
            
            if (logHistoryIndex === -1) return;
            
            if (logHistoryIndex < history.length - 1) {
              logHistoryIndex++;
              logInput.value = history[logHistoryIndex];
            } else {
              logHistoryIndex = -1;
              logInput.value = logCurrentInput;
            }
          } else if (e.key === 'Enter') {
            const command = logInput.value.trim();
            if (command) {
              logHistory.add(command);
              logHistoryIndex = -1;
              logCurrentInput = '';
              
              addPreviewLog(`> ${command}`, 'log');
              logInput.value = '';
              
              try {
                const iframeWindow = previewFrame?.contentWindow;
                if (!iframeWindow) {
                  addPreviewLog('Error: Preview iframe not available', 'error');
                  return;
                }
                
                let result;
                try {
                  result = iframeWindow.eval(command);
                } catch (evalErr) {
                  try {
                    result = iframeWindow.eval(`(${command})`);
                  } catch (exprErr) {
                    throw evalErr;
                  }
                }
                
                if (result !== undefined) {
                  const resultStr = typeof result === 'object' 
                    ? JSON.stringify(result, null, 2)
                    : String(result);
                  addPreviewLog(resultStr, 'info');
                }
              } catch (err) {
                addPreviewLog(`Error: ${err.message}`, 'error');
              }
            }
          }
        });
      }
      
      setupPreviewLogInterception();
    }
  };
})();
