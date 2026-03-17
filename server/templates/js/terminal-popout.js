const channel = new BroadcastChannel('preview-sync');

const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get('theme') || 'dark';
const customCSS = urlParams.get('customCSS') ? atob(urlParams.get('customCSS')) : '';

let activeTab = 'client';
let ws = null;
let compilerInitialized = false;

// Load theme from localStorage if available, otherwise use URL params
function getTheme() {
  try {
    const saved = localStorage.getItem('previewSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        theme: settings.pageTheme || theme,
        customCSS: settings.customThemeCSS || customCSS
      };
    }
  } catch (e) {
    console.error('Error loading theme from localStorage:', e);
  }
  return { theme, customCSS };
}

// Load theme
async function loadTheme(themeName, customCSS) {
  const themeStyle = document.getElementById('theme-style');
  if (!themeStyle) {
    console.error('theme-style element not found');
    return;
  }
  
  try {
    if (themeName === 'custom' && customCSS) {
      themeStyle.textContent = customCSS;
    } else {
      const response = await fetch(`/__api__/theme?name=${encodeURIComponent(themeName)}`);
      if (response.ok) {
        const themeCss = await response.text();
        themeStyle.textContent = themeCss;
      } else {
        console.error('Failed to load theme:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

// Load theme on initial page load
async function loadThemeOnInit() {
  const themeInfo = getTheme();
  await loadTheme(themeInfo.theme, themeInfo.customCSS);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadThemeOnInit);
} else {
  loadThemeOnInit();
}

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
  let contentId = '';
  if (tabName === 'powershell') {
    contentId = 'terminalPowerShell';
  } else {
    contentId = `terminal${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
  }
  document.querySelectorAll('.terminal-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === contentId);
  });

  if (tabName === 'compiler') {
    initCompilerPopout();
  }
}

function initCompilerPopout() {
  if (compilerInitialized) return;
  compilerInitialized = true;

  const runBtn = document.getElementById('compilerRunBtn');
  const useBtn = document.getElementById('compilerUseFileLang');
  const select = document.getElementById('compilerLanguage');
  const runtimeSel = document.getElementById('compilerRuntime');
  const stdinEl = document.getElementById('compilerStdin');
  const outputEl = document.getElementById('compilerOutput');

  if (!runBtn || !select || !outputEl) return;

  function addLine(text, type) {
    const line = document.createElement('div');
    line.className = `compiler-line ${type || 'log'}`;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clear() {
    outputEl.textContent = '';
  }

  function setBusy(busy) {
    runBtn.disabled = !!busy;
    runBtn.textContent = busy ? 'Running…' : '▶ Run';
  }

  // The popout doesn't have access to Monaco, so "Use file language" is best-effort only.
  if (useBtn) {
    useBtn.addEventListener('click', () => {
      addLine('Tip: “Use file language” works best in the main window. In the popout, pick a language manually.', 'info');
    });
  }

  async function run() {
    clear();
    const runtime = runtimeSel && runtimeSel.value ? runtimeSel.value : (localStorage.getItem('lastCompilerRuntime') || 'sandbox');
    const moduleTypeSel = document.getElementById('compilerModuleType');
    const moduleType =
      moduleTypeSel && moduleTypeSel.value
        ? moduleTypeSel.value
        : (localStorage.getItem('lastCompilerModuleType') || 'cjs');
    const filePath = localStorage.getItem('lastCompilerFilePath') || null;

    addLine(`Running… (runtime=${runtime}${runtime === 'sandbox' ? `, languageId=${Number(select.value)}` : ''})`, 'info');
    setBusy(true);

    try {
      // In popout, user pastes code into stdin as a workaround? Better: run the last shared source from localStorage if present.
      // We'll look for a shared value set by main window (optional).
      const source = localStorage.getItem('lastCompilerSource') || '';
      if (!source.trim()) {
        addLine('No source code found. Run from the main window (it will share the last run source), or add sharing later.', 'warn');
        return;
      }

      const stdin = stdinEl && typeof stdinEl.value === 'string' ? stdinEl.value : '';
      const endpoint = runtime === 'local-node' ? '/__api__/run/node' : '/__api__/compile';
      const body =
        runtime === 'local-node'
          ? { source, stdin, moduleType, filePath }
          : { languageId: Number(select.value), source, stdin };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => null);

      if (!data || !data.success) {
        addLine(data && data.error ? data.error : 'Run failed.', 'error');
        return;
      }

      const r = data.result || {};
      const statusDesc = r.status && r.status.description ? r.status.description : 'Unknown';
      const runner = r.runner ? ` | runner=${r.runner}` : '';
      addLine(`Status: ${statusDesc}${runner}${r.time ? ` | time=${r.time}s` : ''}${r.memory ? ` | memory=${r.memory}KB` : ''}`, 'info');

      if (r.compile_output) {
        addLine('--- compile_output ---', 'warn');
        r.compile_output.split('\n').forEach(line => addLine(line, 'warn'));
      }
      if (r.stderr) {
        addLine('--- stderr ---', 'error');
        r.stderr.split('\n').forEach(line => addLine(line, 'error'));
      }
      if (r.stdout) {
        addLine('--- stdout ---', 'log');
        r.stdout.split('\n').forEach(line => addLine(line, 'log'));
      }
      if (!r.stdout && !r.stderr && !r.compile_output) {
        addLine('(no output)', 'log');
      }
    } catch (e) {
      addLine(e && e.message ? e.message : 'Run failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  runBtn.addEventListener('click', run);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter' && activeTab === 'compiler') {
      e.preventDefault();
      run();
    }
  });
}

function cleanAnsiCodes(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\\u001b\[[0-9;]*m/g, '');
}

function addTerminalLine(outputEl, text, type = 'log') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  const cleanText = cleanAnsiCodes(text).trim();
  if (cleanText) {
    line.textContent = cleanText;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

channel.addEventListener('message', (event) => {
  if (event.data.type === 'theme-changed') {
    // Update theme when it changes in the main window
    const themeInfo = {
      theme: event.data.theme || 'dark',
      customCSS: event.data.customCSS || ''
    };
    
    try {
      const saved = localStorage.getItem('previewSettings');
      const settings = saved ? JSON.parse(saved) : {};
      settings.pageTheme = themeInfo.theme;
      if (themeInfo.customCSS) {
        settings.customThemeCSS = themeInfo.customCSS;
      }
      localStorage.setItem('previewSettings', JSON.stringify(settings));
      
      loadTheme(themeInfo.theme, themeInfo.customCSS);
    } catch (e) {
      console.error('Error updating theme:', e);
    }
  } else if (event.data.type === 'terminal-output') {
    const { tab, output, append, type } = event.data;
    let tabName = tab;
    if (tab === 'powershell') {
      tabName = 'PowerShell';
    } else {
      tabName = tab.charAt(0).toUpperCase() + tab.slice(1);
    }
    const outputEl = document.getElementById(`terminal${tabName}Output`);
    if (outputEl) {
      if (append) {
        const cleanOutput = cleanAnsiCodes(output);
        const lines = cleanOutput.split('\n').filter(line => line.trim());
        
        lines.forEach(lineText => {
          const lineType = event.data.lineType || type || 
            (lineText.toLowerCase().includes('error') || lineText.toLowerCase().includes('exception') ? 'error' : 
             lineText.toLowerCase().includes('warning') ? 'warn' : 
             lineText.toLowerCase().includes('info') ? 'info' : 'log');
          addTerminalLine(outputEl, lineText, lineType);
        });
      } else {
        outputEl.innerHTML = '';
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
  } else if (event.data.type === 'preview-log') {
    const logOutput = document.getElementById('terminalLogOutput');
    if (logOutput) {
      const message = event.data.message || '';
      const logType = event.data.logType || 'log';
      const timestamp = event.data.timestamp ? new Date(event.data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      
      const cleanMessage = cleanAnsiCodes(message);
      const lines = cleanMessage.split('\n').filter(line => line.trim());
      
      lines.forEach(lineText => {
        const line = document.createElement('div');
        line.className = `terminal-line ${logType}`;
        line.textContent = `[${timestamp}] ${lineText}`;
        logOutput.appendChild(line);
      });
      
      logOutput.scrollTop = logOutput.scrollHeight;
    }
  }
});

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
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (parseErr) {
        return;
      }
      
      if (data.type === 'serverLog' && serverOutput) {
        const line = document.createElement('div');
        line.className = `terminal-line ${data.level || 'log'}`;
        
        let message = data.message || '';
        message = message.replace(/\u001b\[[0-9;]*m/g, '');
        
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        let metaStr = '';
        if (data.meta && Object.keys(data.meta).length > 0) {
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
        let message = data.message || '';
        message = message.replace(/\u001b\[[0-9;]*m/g, '');
        addTerminalLine(serverOutput, message, 'log');
      } else if (data.type === 'preview-log') {
        const logOutput = document.getElementById('terminalLogOutput');
        if (logOutput) {
          const message = data.message || '';
          const logType = data.logType || 'log';
          const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
          
          // Clear log when "Console injected successfully" appears
          if (message === 'Console injected successfully') {
            logOutput.textContent = '';
          }
          
          const cleanMessage = cleanAnsiCodes(message);
          const lines = cleanMessage.split('\n').filter(line => line.trim());
          
          lines.forEach(lineText => {
            const line = document.createElement('div');
            line.className = `terminal-line ${logType}`;
            line.textContent = `[${timestamp}] ${lineText}`;
            logOutput.appendChild(line);
          });
          
          logOutput.scrollTop = logOutput.scrollHeight;
        }
      } else if (data.type === 'preview-log-clear') {
        const logOutput = document.getElementById('terminalLogOutput');
        if (logOutput) {
          logOutput.textContent = '';
        }
      }
    } catch (err) {
      if (typeof event.data === 'string' && event.data.trim().startsWith('{')) {
        try {
          const data = JSON.parse(event.data);
          if (data.messageType === 'serverLog' && serverOutput) {
            let message = data.message || JSON.stringify(data);
            message = message.replace(/\u001b\[[0-9;]*m/g, '');
            addTerminalLine(serverOutput, message, 'log');
          }
        } catch (e) {
        }
      }
    }
  };
}

function createCommandHistory(terminalType) {
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
}

const clientHistory = createCommandHistory('client');
const powershellHistory = createCommandHistory('powershell');
const logHistory = createCommandHistory('log');

let clientHistoryIndex = -1;
let powershellHistoryIndex = -1;
let logHistoryIndex = -1;
let clientCurrentInput = '';
let powershellCurrentInput = '';
let logCurrentInput = '';

const clientInput = document.getElementById('terminalClientInput');
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
    if (e.key === 'ArrowUp') {
      e.preventDefault();
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

document.getElementById('closePopout').addEventListener('click', () => {
  window.close();
});

window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
  channel.postMessage({
    type: 'popout-closed',
    popoutType: 'terminal'
  });
});

setupWebSocket();
