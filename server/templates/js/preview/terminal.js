window.PreviewTerminal = (function() {
  let logMessageListenerSetup = false;
  
  // Tab autocomplete state
  let autocompleteState = {
    client: { matches: [], index: -1, lastInput: '' },
    powershell: { matches: [], index: -1, lastInput: '' },
    log: { matches: [], index: -1, lastInput: '' },
    commands: { matches: [], index: -1, lastInput: '' },
    ssh: { matches: [], index: -1, lastInput: '' }
  };
  
  // Get command suggestions from autocomplete files or use defaults
  function getCommandSuggestions(terminalType) {
    // Try to get from loaded autocomplete files
    if (terminalType === 'client' && window.ClientAutocomplete) {
      return window.ClientAutocomplete;
    } else if (terminalType === 'commands' && window.CommandsAutocomplete) {
      return window.CommandsAutocomplete;
    } else if (terminalType === 'powershell' && window.PowerShellAutocomplete) {
      return window.PowerShellAutocomplete;
    } else if (terminalType === 'log' && window.LogAutocomplete) {
      return window.LogAutocomplete;
    }
    
    // Fallback to defaults if autocomplete files not loaded
    const defaults = {
      client: ['mode', 'app-mode', 'browser-mode', 'console', 'window', 'document', 'localStorage', 'sessionStorage'],
      commands: ['help', 'ping', 'status', 'restart', 'reconnect', 'clear', 'exit'],
      powershell: ['Get-Process', 'Get-ChildItem', 'Get-Location', 'Set-Location', 'Clear-Host', 'Write-Host', 'Get-Help'],
      log: ['console', 'window', 'document', 'localStorage', 'sessionStorage'],
      ssh: ['ls', 'pwd', 'whoami', 'cd', 'cat', 'top', 'htop', 'ps aux']
    };
    return defaults[terminalType] || [];
  }
  
  // Get autocomplete suggestions
  function getAutocompleteSuggestions(input, terminalType, history) {
    const suggestions = [];
    const inputLower = input.toLowerCase();
    const words = input.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const prefix = words.slice(0, -1).join(' ') + (words.length > 1 ? ' ' : '');
    
    // Add command suggestions from autocomplete files
    const commandSuggestions = getCommandSuggestions(terminalType);
    commandSuggestions.forEach(cmd => {
      if (cmd.toLowerCase().startsWith(lastWord.toLowerCase())) {
        suggestions.push(prefix + cmd);
      }
    });
    
    // Add history matches
    if (history && history.length > 0) {
      history.forEach(cmd => {
        if (cmd.toLowerCase().startsWith(inputLower) && !suggestions.includes(cmd)) {
          suggestions.push(cmd);
        }
      });
    }
    
    return suggestions.sort();
  }
  
  // Get the first/best autocomplete suggestion
  function getBestSuggestion(input, terminalType, history) {
    const suggestions = getAutocompleteSuggestions(input, terminalType, history);
    if (suggestions.length === 0) return '';
    
    // Return the first suggestion that extends the current input
    const inputLower = input.toLowerCase();
    for (const suggestion of suggestions) {
      if (suggestion.toLowerCase().startsWith(inputLower) && suggestion !== input) {
        return suggestion.substring(input.length);
      }
    }
    return '';
  }
  
  // Update autocomplete hint display
  function updateAutocompleteHint(input, terminalType, history) {
    const container = input.parentElement;
    if (!container) return;
    
    // Get or create hint element
    let hint = container.querySelector('.terminal-autocomplete-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'terminal-autocomplete-hint';
      container.appendChild(hint);
    }
    
    const currentInput = input.value;
    const suggestion = getBestSuggestion(currentInput, terminalType, history);
    
    if (suggestion && currentInput.length > 0) {
      hint.textContent = suggestion;
      hint.style.display = 'inline';
      
      // Create a temporary span to measure text width accurately
      const tempSpan = document.createElement('span');
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.style.whiteSpace = 'pre';
      tempSpan.style.font = window.getComputedStyle(input).font;
      tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
      tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
      tempSpan.textContent = currentInput;
      document.body.appendChild(tempSpan);
      
      const textWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      // Account for prompt width and padding
      const prompt = container.querySelector('.terminal-prompt');
      const promptWidth = prompt ? prompt.offsetWidth + 8 : 0;
      const containerPadding = 8; // padding from container
      
      hint.style.left = (promptWidth + containerPadding + textWidth) + 'px';
    } else {
      hint.style.display = 'none';
    }
  }
  
  // Handle tab autocomplete
  function handleTabAutocomplete(input, terminalType, history, e) {
    const state = autocompleteState[terminalType];
    const currentInput = input.value;
    
    // If input changed, reset autocomplete
    if (currentInput !== state.lastInput) {
      state.matches = getAutocompleteSuggestions(currentInput, terminalType, history);
      state.index = -1;
      state.lastInput = currentInput;
    }
    
    if (state.matches.length === 0) {
      return; // No matches, don't prevent default
    }
    
    e.preventDefault();
    
    // Cycle through matches
    state.index = (state.index + 1) % state.matches.length;
    input.value = state.matches[state.index];
    
    // Update hint
    updateAutocompleteHint(input, terminalType, history);
    
    // Reset on next input change
    const originalValue = input.value;
    const resetOnChange = () => {
      if (input.value !== originalValue) {
        state.lastInput = '';
        input.removeEventListener('input', resetOnChange);
      }
    };
    input.addEventListener('input', resetOnChange);
  }

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
        // Handle special client commands
        if (command.trim() === 'mode' || command.trim() === 'app-mode' || command.trim() === 'browser-mode') {
          const clientMode = window.__CLIENT_MODE || (window.electronAPI && window.electronAPI.isElectron ? 'app' : 'browser');
          
          // Fetch server mode
          fetch('/__api__/mode')
            .then(res => res.json())
            .then(data => {
              const clientModeText = clientMode === 'app' ? 'App (Electron)' : 'Browser';
              const serverModeText = data.mode === 'app' ? 'App (Electron)' : 'Browser';
              const output = `Client Mode: ${clientModeText}\n` +
                           `Server Mode: ${serverModeText}\n` +
                           `  Client running in: ${clientMode === 'app' ? 'Electron application window' : 'Web browser'}\n` +
                           `  Server running in: ${data.mode === 'app' ? 'App mode (no auto-launch)' : 'Browser mode (auto-launch enabled)'}\n` +
                           `  Restart method: ${data.mode === 'app' ? 'start-app.bat' : 'start.bat'}`;
              
              outputEl.textContent += `> ${command}\n${output}\n`;
              outputEl.scrollTop = outputEl.scrollHeight;
              
              syncChannel.postMessage({
                type: 'terminal-output',
                tab: tab,
                output: `> ${command}\n${output}\n`,
                append: false
              });
            })
            .catch(err => {
              const output = `Client Mode: ${clientMode === 'app' ? 'App (Electron)' : 'Browser'}\nError fetching server mode: ${err.message}`;
              outputEl.textContent += `> ${command}\n${output}\n`;
              outputEl.scrollTop = outputEl.scrollHeight;
            });
        } else {
          // Default client command handling
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
        }
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
      } else if (tab === 'ssh') {
        (async () => {
          const sshOutput = outputEl;

          function addSshLine(text, type) {
            const lineEl = document.createElement('div');
            lineEl.className = `terminal-line ${type || 'log'}`;
            lineEl.textContent = text;
            sshOutput.appendChild(lineEl);
            sshOutput.scrollTop = sshOutput.scrollHeight;
          }

          const cfg = window.__previewSshConfig;
          if (!cfg || !cfg.connected) {
            addSshLine('Not connected. Use the SSH Connect form above first.', 'error');
            return;
          }

          try {
            addSshLine(`SSH ${cfg.username}@${cfg.host}:${cfg.port}$ ${command}`, 'log');

            const res = await fetch('/__api__/ssh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                host: cfg.host,
                port: cfg.port,
                username: cfg.username,
                password: cfg.password,
                command
              })
            });
            const data = await res.json().catch(() => null);

            if (!data || !data.success) {
              addSshLine(`Error: ${(data && data.error) || 'SSH command failed'}`, 'error');
              syncChannel.postMessage({
                type: 'terminal-output',
                tab: 'ssh',
                output: `Error: ${(data && data.error) || 'SSH command failed'}\n`,
                append: true,
                lineType: 'error'
              });
              return;
            }

            if (data.stdout) {
              data.stdout.split('\n').forEach(line => {
                if (line.trim()) {
                  addSshLine(line, 'info');
                  syncChannel.postMessage({
                    type: 'terminal-output',
                    tab: 'ssh',
                    output: line + '\n',
                    append: true,
                    lineType: 'info'
                  });
                }
              });
            }
            if (data.stderr) {
              data.stderr.split('\n').forEach(line => {
                if (line.trim()) {
                  addSshLine(line, 'error');
                  syncChannel.postMessage({
                    type: 'terminal-output',
                    tab: 'ssh',
                    output: line + '\n',
                    append: true,
                    lineType: 'error'
                  });
                }
              });
            }
          } catch (err) {
            addSshLine(`Network Error: ${err.message}`, 'error');
            syncChannel.postMessage({
              type: 'terminal-output',
              tab: 'ssh',
              output: `Network Error: ${err.message}\n`,
              append: true,
              lineType: 'error'
            });
          }
        })();
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

    setupTerminal(saveState, syncChannel, previewFrame, addPreviewLog, setupPreviewLogInterception, wsRef) {
      const tabs = document.querySelectorAll('.terminal-tab');
      const tabContents = document.querySelectorAll('.terminal-tab-content');
      const clientInput = document.getElementById('terminalClientInput');
      const powershellInput = document.getElementById('terminalPowerShellInput');
      const logInput = document.getElementById('terminalLogInput');
      const commandsInput = document.getElementById('terminalCommandsInput');
      const clientOutput = document.getElementById('terminalClientOutput');
      const serverOutput = document.getElementById('terminalServerOutput');
      const powershellOutput = document.getElementById('terminalPowerShellOutput');
      const commandsOutput = document.getElementById('terminalCommandsOutput');
      const sshInput = document.getElementById('terminalSshInput');
      const sshOutput = document.getElementById('terminalSshOutput');
      const sshHostInput = document.getElementById('terminalSshHost');
      const sshPortInput = document.getElementById('terminalSshPort');
      const sshUserInput = document.getElementById('terminalSshUser');
      const sshPassInput = document.getElementById('terminalSshPassword');
      const sshAuthTypeInput = document.getElementById('terminalSshAuthType');
      const sshKeyInput = document.getElementById('terminalSshPrivateKey');
      const sshKeyPassInput = document.getElementById('terminalSshPassphrase');
      const sshPasswordRow = document.getElementById('terminalSshPasswordRow');
      const sshKeyRow = document.getElementById('terminalSshKeyRow');
      const sshConnectBtn = document.getElementById('terminalSshConnectBtn');
      const sshDisconnectBtn = document.getElementById('terminalSshDisconnectBtn');
      
      const clientHistory = this.createCommandHistory('client');
      const powershellHistory = this.createCommandHistory('powershell');
      const logHistory = this.createCommandHistory('log');
      const commandsHistory = this.createCommandHistory('commands');
      const sshHistory = this.createCommandHistory('ssh');
      
      let clientHistoryIndex = -1;
      let powershellHistoryIndex = -1;
      let logHistoryIndex = -1;
      let commandsHistoryIndex = -1;
      let sshHistoryIndex = -1;
      let clientCurrentInput = '';
      let powershellCurrentInput = '';
      let logCurrentInput = '';
      let commandsCurrentInput = '';
      let sshCurrentInput = '';
      
      if (clientInput) {
        clientInput.disabled = false;
        clientInput.style.pointerEvents = 'auto';
      }
      if (powershellInput) {
        powershellInput.disabled = false;
        powershellInput.style.pointerEvents = 'auto';
      }

      // SSH connection state & UI helpers
      function getSshConfig() {
        return window.__previewSshConfig || null;
      }

      function setSshConfig(cfg) {
        if (cfg) {
          window.__previewSshConfig = { ...cfg, connected: !!cfg.connected };
        } else {
          window.__previewSshConfig = null;
        }
        updateSshUI(true);
      }

      function updateSshUI(showStatusLine = false) {
        const cfg = getSshConfig();
        const connected = !!(cfg && cfg.connected);

        if (sshInput) {
          sshInput.disabled = !connected;
          sshInput.style.pointerEvents = connected ? 'auto' : 'none';
          if (!connected) {
            sshInput.value = '';
          }
        }
        if (sshConnectBtn) {
          sshConnectBtn.disabled = connected;
        }
        if (sshDisconnectBtn) {
          sshDisconnectBtn.disabled = !connected;
        }

        if (sshHostInput && sshPortInput && sshUserInput) {
          if (connected && cfg) {
            sshHostInput.value = cfg.host || '';
            sshPortInput.value = cfg.port || 22;
            sshUserInput.value = cfg.username || '';
          }
        }

        if (sshAuthTypeInput && sshPasswordRow && sshKeyRow) {
          const authType = (cfg && cfg.authType) || (sshAuthTypeInput.value || 'password');
          sshAuthTypeInput.value = authType;
          const isKey = authType === 'key';
          sshPasswordRow.style.display = isKey ? 'none' : 'flex';
          sshKeyRow.style.display = isKey ? 'flex' : 'none';
        }

        if (sshOutput && showStatusLine) {
          const line = document.createElement('div');
          line.className = `terminal-line ${connected ? 'info' : 'log'}`;
          line.textContent = connected
            ? `Connected to ${cfg.username}@${cfg.host}:${cfg.port}`
            : 'Disconnected. Configure connection above and press Connect.';
          sshOutput.appendChild(line);
          sshOutput.scrollTop = sshOutput.scrollHeight;
        }
      }

      if (sshInput && sshOutput) {
        // Initial UI state (disconnected)
        updateSshUI(true);

        // Auth type toggle between password and key
        if (sshAuthTypeInput && sshPasswordRow && sshKeyRow) {
          sshAuthTypeInput.addEventListener('change', () => {
            const isKey = sshAuthTypeInput.value === 'key';
            sshPasswordRow.style.display = isKey ? 'none' : 'flex';
            sshKeyRow.style.display = isKey ? 'flex' : 'none';
          });
        }

        sshInput.addEventListener('input', () => {
          const history = sshHistory.load();
          updateAutocompleteHint(sshInput, 'ssh', history);
        });

        sshInput.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            const history = sshHistory.load();
            handleTabAutocomplete(sshInput, 'ssh', history, e);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const history = sshHistory.load();
            if (history.length === 0) return;

            if (sshHistoryIndex === -1) {
              sshCurrentInput = sshInput.value;
              sshHistoryIndex = history.length;
            }

            if (sshHistoryIndex > 0) {
              sshHistoryIndex--;
              sshInput.value = history[sshHistoryIndex];
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const history = sshHistory.load();

            if (sshHistoryIndex === -1) return;

            if (sshHistoryIndex < history.length - 1) {
              sshHistoryIndex++;
              sshInput.value = history[sshHistoryIndex];
            } else {
              sshHistoryIndex = -1;
              sshInput.value = sshCurrentInput;
            }
          } else if (e.key === 'Escape') {
            const hint = sshInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
          } else if (e.key === 'Enter') {
            const hint = sshInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';

            const cmd = sshInput.value.trim();
            if (cmd) {
              sshHistory.add(cmd);
              sshHistoryIndex = -1;
              sshCurrentInput = '';

              // Delegate to generic handler so output + sync are centralized
              window.PreviewTerminal.handleTerminalCommand('ssh', cmd, syncChannel, previewFrame);
              sshInput.value = '';
            }
          }
        });

        if (sshConnectBtn) {
          sshConnectBtn.addEventListener('click', async () => {
            if (!sshHostInput || !sshUserInput || !sshAuthTypeInput) return;
            const host = sshHostInput.value.trim();
            const username = sshUserInput.value.trim();
            const password = sshPassInput ? sshPassInput.value : '';
            const port = sshPortInput && sshPortInput.value ? parseInt(sshPortInput.value, 10) || 22 : 22;
            const authType = sshAuthTypeInput.value || 'password';
            const privateKey = sshKeyInput ? sshKeyInput.value : '';
            const passphrase = sshKeyPassInput ? sshKeyPassInput.value : '';

            const isKey = authType === 'key';

            if (!host || !username || (!isKey && !password) || (isKey && !privateKey.trim())) {
              const line = document.createElement('div');
              line.className = 'terminal-line error';
              line.textContent = isKey
                ? 'Please fill host, username and private key before connecting.'
                : 'Please fill host, username and password before connecting.';
              sshOutput.appendChild(line);
              sshOutput.scrollTop = sshOutput.scrollHeight;
              return;
            }

            // Show connecting status
            const statusLine = document.createElement('div');
            statusLine.className = 'terminal-line info';
            statusLine.textContent = `Connecting to ${username}@${host}:${port}...`;
            sshOutput.appendChild(statusLine);
            sshOutput.scrollTop = sshOutput.scrollHeight;

            sshConnectBtn.disabled = true;
            try {
              const body = {
                host,
                port,
                username,
                authType,
                command: 'echo __ASTRO_SSH_OK__'
              };

              if (isKey) {
                body.privateKey = privateKey;
                if (passphrase) body.passphrase = passphrase;
              } else {
                body.password = password;
              }

              // Test connection with a simple command
              const res = await fetch('/__api__/ssh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              const data = await res.json().catch(() => null);

              if (!data || !data.success) {
                const errLine = document.createElement('div');
                errLine.className = 'terminal-line error';
                errLine.textContent = `Connection failed: ${(data && data.error) || 'Unable to connect'}`;
                sshOutput.appendChild(errLine);
                sshOutput.scrollTop = sshOutput.scrollHeight;
                sshConnectBtn.disabled = false;
                return;
              }

              // Connection OK
              setSshConfig({
                host,
                port,
                username,
                password: isKey ? undefined : password,
                privateKey: isKey ? privateKey : undefined,
                passphrase: isKey ? passphrase : undefined,
                authType: isKey ? 'key' : 'password',
               connected: true
              });
            } catch (e) {
              const errLine = document.createElement('div');
              errLine.className = 'terminal-line error';
              errLine.textContent = `Connection error: ${e.message}`;
              sshOutput.appendChild(errLine);
              sshOutput.scrollTop = sshOutput.scrollHeight;
              sshConnectBtn.disabled = false;
            }
          });
        }

        if (sshDisconnectBtn) {
          sshDisconnectBtn.addEventListener('click', () => {
            const cfg = getSshConfig();
            if (cfg && cfg.connected) {
              const line = document.createElement('div');
              line.className = 'terminal-line log';
              line.textContent = `Disconnected from ${cfg.username}@${cfg.host}:${cfg.port}`;
              sshOutput.appendChild(line);
              sshOutput.scrollTop = sshOutput.scrollHeight;
            }
            setSshConfig(null);
          });
        }
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
        // Update autocomplete hint on input
        clientInput.addEventListener('input', () => {
          const history = clientHistory.load();
          updateAutocompleteHint(clientInput, 'client', history);
        });
        
        clientInput.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            const history = clientHistory.load();
            handleTabAutocomplete(clientInput, 'client', history, e);
          } else if (e.key === 'ArrowUp') {
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
          } else if (e.key === 'Escape') {
            // Hide autocomplete hint
            const hint = clientInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
          } else if (e.key === 'Enter') {
            // Hide autocomplete hint
            const hint = clientInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
            
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
        // Update autocomplete hint on input
        powershellInput.addEventListener('input', () => {
          if (powershellInput.disabled) return;
          const history = powershellHistory.load();
          updateAutocompleteHint(powershellInput, 'powershell', history);
        });
        
        powershellInput.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            if (powershellInput.disabled) return;
            const history = powershellHistory.load();
            handleTabAutocomplete(powershellInput, 'powershell', history, e);
          } else if (e.key === 'ArrowUp') {
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
          } else if (e.key === 'Escape') {
            // Hide autocomplete hint
            const hint = powershellInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
          } else if (e.key === 'Enter') {
            // Hide autocomplete hint
            const hint = powershellInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
            
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
        
        // Update autocomplete hint on input
        logInput.addEventListener('input', () => {
          const history = logHistory.load();
          updateAutocompleteHint(logInput, 'log', history);
        });
        
        logInput.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            const history = logHistory.load();
            handleTabAutocomplete(logInput, 'log', history, e);
          } else if (e.key === 'ArrowUp') {
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
          } else if (e.key === 'Escape') {
            // Hide autocomplete hint
            const hint = logInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
          } else if (e.key === 'Enter') {
            // Hide autocomplete hint
            const hint = logInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
            
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
      
      if (commandsInput && commandsOutput) {
        // Update autocomplete hint on input
        commandsInput.addEventListener('input', () => {
          const history = commandsHistory.load();
          updateAutocompleteHint(commandsInput, 'commands', history);
        });
        
        commandsInput.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            const history = commandsHistory.load();
            handleTabAutocomplete(commandsInput, 'commands', history, e);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const history = commandsHistory.load();
            if (history.length === 0) return;
            
            if (commandsHistoryIndex === -1) {
              commandsCurrentInput = commandsInput.value;
              commandsHistoryIndex = history.length;
            }
            
            if (commandsHistoryIndex > 0) {
              commandsHistoryIndex--;
              commandsInput.value = history[commandsHistoryIndex];
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const history = commandsHistory.load();
            
            if (commandsHistoryIndex === -1) return;
            
            if (commandsHistoryIndex < history.length - 1) {
              commandsHistoryIndex++;
              commandsInput.value = history[commandsHistoryIndex];
            } else {
              commandsHistoryIndex = -1;
              commandsInput.value = commandsCurrentInput;
            }
          } else if (e.key === 'Escape') {
            // Hide autocomplete hint
            const hint = commandsInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
          } else if (e.key === 'Enter') {
            // Hide autocomplete hint
            const hint = commandsInput.parentElement?.querySelector('.terminal-autocomplete-hint');
            if (hint) hint.style.display = 'none';
            
            const command = commandsInput.value.trim();
            if (command) {
              commandsHistory.add(command);
              commandsHistoryIndex = -1;
              commandsCurrentInput = '';
              
              const line = document.createElement('div');
              line.className = 'terminal-line log';
              line.textContent = `$> ${command}`;
              commandsOutput.appendChild(line);
              commandsOutput.scrollTop = commandsOutput.scrollHeight;
              
              // Send command to server via WebSocket
              const ws = wsRef && wsRef.current ? wsRef.current : (wsRef && wsRef.ws ? wsRef.ws : null);
              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'server-command',
                  command: command,
                  args: []
                }));
              } else {
                const errorLine = document.createElement('div');
                errorLine.className = 'terminal-line error';
                errorLine.textContent = 'Error: WebSocket not connected';
                commandsOutput.appendChild(errorLine);
                commandsOutput.scrollTop = commandsOutput.scrollHeight;
              }
              
              commandsInput.value = '';
            }
          }
        });
      }
      
      setupPreviewLogInterception();
    }
  };
})();
