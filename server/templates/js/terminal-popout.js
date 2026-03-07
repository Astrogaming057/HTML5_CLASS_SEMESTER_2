// BroadcastChannel for cross-window communication
const channel = new BroadcastChannel('preview-sync');

let activeTab = 'client';
let ws = null;

// Tab switching
document.querySelectorAll('.terminal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.terminal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  // Handle tab name capitalization correctly for content ID
  let contentId = '';
  if (tabName === 'powershell') {
    contentId = 'terminalPowerShell';
  } else {
    contentId = `terminal${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
  }
  document.querySelectorAll('.terminal-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === contentId);
  });
}

// Helper function to clean ANSI escape codes
function cleanAnsiCodes(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\\u001b\[[0-9;]*m/g, '');
}

// Helper function to add styled terminal line
function addTerminalLine(outputEl, text, type = 'log') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  // Clean ANSI codes and normalize whitespace
  const cleanText = cleanAnsiCodes(text).trim();
  if (cleanText) {
    line.textContent = cleanText;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

// Listen for terminal updates from main window
channel.addEventListener('message', (event) => {
  if (event.data.type === 'terminal-output') {
    const { tab, output, append, type } = event.data;
    // Handle tab name capitalization correctly
    let tabName = tab;
    if (tab === 'powershell') {
      tabName = 'PowerShell';
    } else {
      tabName = tab.charAt(0).toUpperCase() + tab.slice(1);
    }
    const outputEl = document.getElementById(`terminal${tabName}Output`);
    if (outputEl) {
      if (append) {
        // Clean the output and split by newlines to handle multiple lines
        const cleanOutput = cleanAnsiCodes(output);
        const lines = cleanOutput.split('\n').filter(line => line.trim());
        
        lines.forEach(lineText => {
          // Use lineType from event.data if provided, otherwise use type, otherwise detect
          const lineType = event.data.lineType || type || 
            (lineText.toLowerCase().includes('error') || lineText.toLowerCase().includes('exception') ? 'error' : 
             lineText.toLowerCase().includes('warning') ? 'warn' : 
             lineText.toLowerCase().includes('info') ? 'info' : 'log');
          addTerminalLine(outputEl, lineText, lineType);
        });
      } else {
        outputEl.innerHTML = '';
        // Clean the output and split by newlines
        const cleanOutput = cleanAnsiCodes(output);
        const lines = cleanOutput.split('\n').filter(line => line.trim());
        
        const lineType = type || 'log';
        lines.forEach(lineText => {
          addTerminalLine(outputEl, lineText, lineType);
        });
      }
    }
  } else if (event.data.type === 'terminal-clear') {
    const { tab } = event.data;
    // Handle tab name capitalization correctly
    let tabName = tab;
    if (tab === 'powershell') {
      tabName = 'PowerShell';
    } else {
      tabName = tab.charAt(0).toUpperCase() + tab.slice(1);
    }
    const outputEl = document.getElementById(`terminal${tabName}Output`);
    if (outputEl) {
      outputEl.textContent = '';
    }
  }
});

// Setup WebSocket for server logs
function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + window.location.host;
  ws = new WebSocket(wsUrl);
  
  const serverOutput = document.getElementById('terminalServerOutput');
  
  ws.onopen = () => {
    console.log('Terminal popout WebSocket connected');
  };
  
  ws.onclose = () => {
    console.log('Terminal popout WebSocket disconnected - Reconnecting...');
    setTimeout(setupWebSocket, 2000);
  };
  
  ws.onerror = (error) => {
    console.error('Terminal popout WebSocket error:', error);
  };
  
  ws.onmessage = (event) => {
    try {
      // Try to parse as JSON first
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (parseErr) {
        // If it's not JSON, it might be a raw string - ignore it
        return;
      }
      
      if (data.type === 'serverLog' && serverOutput) {
        const line = document.createElement('div');
        line.className = `terminal-line ${data.level || 'log'}`;
        
        // Format message - remove ANSI escape codes
        let message = data.message || '';
        message = message.replace(/\u001b\[[0-9;]*m/g, ''); // Remove ANSI codes
        
        // Format timestamp
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        // Format meta data nicely if present
        let metaStr = '';
        if (data.meta && Object.keys(data.meta).length > 0) {
          // Only show important meta fields
          const importantFields = ['port', 'baseDir', 'watching', 'ip', 'totalClients'];
          const filteredMeta = {};
          for (const key of importantFields) {
            if (data.meta[key] !== undefined) {
              filteredMeta[key] = data.meta[key];
            }
          }
          if (Object.keys(filteredMeta).length > 0) {
            metaStr = ' ' + JSON.stringify(filteredMeta);
          }
        }
        
        line.textContent = `[${timestamp}] ${message}${metaStr}`;
        serverOutput.appendChild(line);
        serverOutput.scrollTop = serverOutput.scrollHeight;
      } else if (data.type === 'log' && serverOutput) {
        // Fallback for old format
        let message = data.message || '';
        message = message.replace(/\u001b\[[0-9;]*m/g, ''); // Remove ANSI codes
        addTerminalLine(serverOutput, message, 'log');
      }
    } catch (err) {
      // If event.data is a string that looks like JSON, try to parse it
      if (typeof event.data === 'string' && event.data.trim().startsWith('{')) {
        try {
          const data = JSON.parse(event.data);
          if (data.messageType === 'serverLog' && serverOutput) {
            // Handle alternative format
            let message = data.message || JSON.stringify(data);
            message = message.replace(/\u001b\[[0-9;]*m/g, ''); // Remove ANSI codes
            addTerminalLine(serverOutput, message, 'log');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  };
}

// Terminal input handlers
const clientInput = document.getElementById('terminalClientInput');
if (clientInput) {
  clientInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const command = clientInput.value.trim();
      if (command) {
        // Send command to main window for execution
        channel.postMessage({
          type: 'terminal-command',
          tab: 'client',
          command: command
        });
        clientInput.value = '';
      }
    }
  });
}

const powershellInput = document.getElementById('terminalPowerShellInput');
if (powershellInput) {
  powershellInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const command = powershellInput.value.trim();
      if (command) {
        channel.postMessage({
          type: 'terminal-command',
          tab: 'powershell',
          command: command
        });
        powershellInput.value = '';
      }
    }
  });
}

const logInput = document.getElementById('terminalLogInput');
if (logInput) {
  logInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const command = logInput.value.trim();
      if (command) {
        channel.postMessage({
          type: 'terminal-command',
          tab: 'log',
          command: command
        });
        logInput.value = '';
      }
    }
  });
}

// Close button
document.getElementById('closePopout').addEventListener('click', () => {
  window.close();
});

// Handle window close
window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
  channel.postMessage({
    type: 'popout-closed',
    popoutType: 'terminal'
  });
});

// Initial WebSocket connection
setupWebSocket();
