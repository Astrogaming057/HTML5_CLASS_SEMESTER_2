// Get file path from URL
const urlParams = new URLSearchParams(window.location.search);
let filePath = urlParams.get('file');
let currentDir = '';

let editor = null;
let originalContent = '';
let isDirty = false;
let previewFrame = null;
let fileTree = null;
let ws = null;

// Language mapping
function getLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'html' || ext === 'htm') {
    return 'html';
  }
  return 'html'; // Default to HTML for preview
}

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
  const editorContainer = document.getElementById('editor');
  const saveBtn = document.getElementById('saveBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const closeBtn = document.getElementById('closeBtn');
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  const status = document.getElementById('status');
  const fileName = document.getElementById('fileName');
  previewFrame = document.getElementById('previewFrame');
  fileTree = document.getElementById('fileTree');
  const imagePreview = document.getElementById('imagePreview');
  const previewImage = document.getElementById('previewImage');
  const previewTitle = document.getElementById('previewTitle');
  const backToPreviewBtn = document.getElementById('backToPreviewBtn');
  const toggleExplorer = document.getElementById('toggleExplorer');
  const fileExplorerPanel = document.getElementById('fileExplorerPanel');
  const backBtn = document.getElementById('backBtn');
  const editorPanel = document.getElementById('editorPanel');
  const previewPanel = document.getElementById('previewPanel');
  const togglePreview = document.getElementById('togglePreview');
  const contextMenu = document.getElementById('contextMenu');
  const resizerEditor = document.getElementById('resizerEditor');
  
  if (!filePath) {
    status.textContent = 'Error: No file specified';
    status.className = 'status error';
    return;
  }
  
  // Calculate current directory
  currentDir = filePath.split('/').slice(0, -1).join('/') || '';
  
  fileName.textContent = filePath.split('/').pop();
  const language = getLanguage(filePath);
  
  // Flag to prevent saving state during initialization (before restore)
  let isRestoringState = true;
  
  // Check for saved state and restore directory BEFORE loading file tree
  const savedState = localStorage.getItem('previewState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      // If saved directory exists and is different, use it
      if (state.currentDir && state.currentDir !== currentDir) {
        currentDir = state.currentDir;
        console.log('Restored directory from state:', currentDir);
      }
    } catch (err) {
      console.error('Error parsing saved state:', err);
    }
  }
  
  // Setup file explorer with potentially restored directory
  setupFileExplorer();
  
  // Restore full state from localStorage (after everything is initialized)
  // Use requestAnimationFrame to ensure DOM is ready
  // This MUST happen before any visibility updates to prevent resetting state
  requestAnimationFrame(() => {
    setTimeout(() => {
      restoreState();
      // After state is restored, ensure visibility is correct
      // (restoreState already calls these, but this is a safety net)
      updateExplorerVisibility();
      updatePreviewVisibility();
      if (terminalPanel) {
        updateTerminalVisibility();
      }
      // Now allow saving state
      isRestoringState = false;
      console.log('State restoration complete - saving enabled');
    }, 300);
  });
  
  // Setup context menu
  setupContextMenu();
  
  // Setup drag and drop
  setupDragAndDrop();
  
  // Setup terminal
  setupTerminal();
  
  // Setup WebSocket connection for sync
  setupWebSocket();
  
  // Toggle explorer button (in panel)
  toggleExplorer.addEventListener('click', () => {
    toggleFileExplorer();
  });
  
  // Toggle preview button (in panel)
  togglePreview.addEventListener('click', () => {
    togglePreviewPanel();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggleFileExplorer();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      togglePreviewPanel();
    }
  });
  
  function toggleFileExplorer() {
    const isCollapsed = fileExplorerPanel.classList.contains('collapsed');
    console.log('toggleFileExplorer called, current state:', isCollapsed);
    fileExplorerPanel.classList.toggle('collapsed');
    const newState = fileExplorerPanel.classList.contains('collapsed');
    console.log('toggleFileExplorer new state:', newState);
    toggleExplorer.textContent = newState ? '▶' : '◀';
    updateExplorerVisibility();
    updateBackButton();
    saveState();
  }
  
  function updateExplorerVisibility() {
    const isCollapsed = fileExplorerPanel.classList.contains('collapsed');
    const explorerReopenBar = document.getElementById('explorerReopenBar');
    const resizerExplorer = document.getElementById('resizerExplorer');
    
    console.log('updateExplorerVisibility, collapsed:', isCollapsed);
    
    if (explorerReopenBar) {
      explorerReopenBar.style.display = isCollapsed ? 'flex' : 'none';
      console.log('Explorer reopen bar display:', explorerReopenBar.style.display);
    }
    
    if (resizerExplorer) {
      resizerExplorer.style.display = isCollapsed ? 'none' : 'block';
    }
  }
  
  function togglePreviewPanel() {
    const isCollapsed = previewPanel.classList.contains('collapsed');
    console.log('togglePreviewPanel called, current state:', isCollapsed);
    previewPanel.classList.toggle('collapsed');
    const newState = previewPanel.classList.contains('collapsed');
    console.log('togglePreviewPanel new state:', newState);
    
    updatePreviewVisibility();
    togglePreview.textContent = newState ? '▶' : '◀';
    saveState();
  }
  
  function updatePreviewVisibility() {
    const isCollapsed = previewPanel.classList.contains('collapsed');
    const previewReopenBar = document.getElementById('previewReopenBar');
    
    console.log('updatePreviewVisibility, collapsed:', isCollapsed);
    
    // Hide/show resizer based on preview state
    if (resizerEditor) {
      resizerEditor.style.display = isCollapsed ? 'none' : 'block';
    }
    
    if (previewReopenBar) {
      previewReopenBar.style.display = isCollapsed ? 'flex' : 'none';
      console.log('Preview reopen bar display:', previewReopenBar.style.display);
    }
  }
  
  // Initialize resizer visibility
  if (resizerEditor && previewPanel) {
    if (previewPanel.classList.contains('collapsed')) {
      resizerEditor.style.display = 'none';
    }
  }
  
  // Terminal toggle
  const toggleTerminal = document.getElementById('toggleTerminal');
  const terminalPanel = document.getElementById('terminalPanel');
  const resizerTerminal = document.getElementById('resizerTerminal');
  const terminalReopenBar = document.getElementById('terminalReopenBar');
  const reopenTerminalBtn = document.getElementById('reopenTerminalBtn');
  
  function updateTerminalVisibility() {
    const isCollapsed = terminalPanel.classList.contains('collapsed');
    
    // Update toggle button
    if (toggleTerminal) {
      toggleTerminal.textContent = isCollapsed ? '+' : '−';
    }
    
    // Update resizer visibility
    if (resizerTerminal) {
      resizerTerminal.style.display = isCollapsed ? 'none' : 'block';
    }
    
    // Update reopen bar visibility
    if (terminalReopenBar) {
      terminalReopenBar.style.display = isCollapsed ? 'flex' : 'none';
    }
  }
  
  if (toggleTerminal && terminalPanel) {
    toggleTerminal.addEventListener('click', () => {
      terminalPanel.classList.toggle('collapsed');
      updateTerminalVisibility();
      saveState();
    });
  }
  
  // Reopen terminal button
  if (reopenTerminalBtn && terminalPanel) {
    reopenTerminalBtn.addEventListener('click', () => {
      terminalPanel.classList.remove('collapsed');
      updateTerminalVisibility();
      saveState();
    });
  }
  
  // Reopen explorer button
  const reopenExplorerBtn = document.getElementById('reopenExplorerBtn');
  if (reopenExplorerBtn && fileExplorerPanel) {
    reopenExplorerBtn.addEventListener('click', () => {
      console.log('Reopen explorer clicked');
      fileExplorerPanel.classList.remove('collapsed');
      updateExplorerVisibility();
      saveState();
    });
  }
  
  // Reopen preview button
  const reopenPreviewBtn = document.getElementById('reopenPreviewBtn');
  if (reopenPreviewBtn && previewPanel) {
    reopenPreviewBtn.addEventListener('click', () => {
      console.log('Reopen preview clicked');
      previewPanel.classList.remove('collapsed');
      updatePreviewVisibility();
      togglePreview.textContent = '◀';
      saveState();
    });
  }
  
  // Don't initialize visibility here - let restoreState() handle it
  // This prevents resetting to defaults before state is restored
  
  // Back button
  backBtn.addEventListener('click', () => {
    goBackFolder();
  });
  
  function goBackFolder() {
    if (!currentDir || currentDir === '/') return;
    
    const parentDir = currentDir.split('/').slice(0, -1).join('/') || '/';
    loadFileTree(parentDir);
    currentDir = parentDir;
    updateBackButton();
  }
  
  function updateBackButton() {
    backBtn.disabled = !currentDir || currentDir === '/';
  }
  
  updateBackButton();
  
  // Create Monaco Editor instance
  editor = monaco.editor.create(editorContainer, {
    value: '',
    language: language,
    theme: 'vs-dark',
    fontSize: 14,
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly: false,
    cursorStyle: 'line',
    automaticLayout: true,
    minimap: {
      enabled: true
    },
    wordWrap: 'on',
    formatOnPaste: true,
    formatOnType: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    renderWhitespace: 'selection',
    renderLineHighlight: 'all',
    bracketPairColorization: {
      enabled: true
    }
  });
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.file) {
      const newPath = e.state.file;
      if (newPath !== filePath) {
        // Don't check for unsaved changes on back/forward
        filePath = newPath;
        fileName.textContent = newPath.split('/').pop();
        const newDir = newPath.split('/').slice(0, -1).join('/') || '';
        if (newDir !== currentDir) {
          currentDir = newDir;
          loadFileTree(currentDir);
        } else {
          // Just update the active item if we're in the same directory
          updateActiveFileTreeItem(newPath);
        }
        loadFile(newPath);
        saveState();
      }
    }
  });
  
  // Load file content
  loadFile(filePath);
  
  // Track changes and update preview
  editor.onDidChangeModelContent(() => {
    const currentContent = editor.getValue();
    isDirty = currentContent !== originalContent;
    updateStatus();
    updatePreview(currentContent);
  });
  
  // Save on Ctrl+S
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveFile();
  });
  
  // Save button
  saveBtn.addEventListener('click', saveFile);
  
  // Refresh preview button
  refreshBtn.addEventListener('click', () => {
    updatePreview(editor.getValue());
  });
  
  // Close button
  closeBtn.addEventListener('click', () => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    window.close();
  });
  
  // Reset settings button
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings? This will clear panel sizes, positions, and preferences.')) {
        resetSettings();
      }
    });
  }
  
  // Warn before closing with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  
  // Setup resizers
  setupResizers();
  
  // Setup file explorer
  function setupFileExplorer() {
    // Load file tree for current directory
    loadFileTree(currentDir || '/');
  }
  
  function loadFileTree(dir) {
    fileTree.innerHTML = '<div class="file-tree-loading">Loading...</div>';
    
    // Update current directory
    currentDir = dir;
    updateBackButton();
    saveState();
    
    // Fetch directory listing
    const apiPath = dir === '/' ? '/' : dir;
    fetch('/__api__/files?path=' + encodeURIComponent(apiPath) + '&list=true')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.files) {
          renderFileTree(data.files, dir);
        } else {
          fileTree.innerHTML = '<div class="file-tree-loading">Error loading files</div>';
        }
      })
      .catch(() => {
        // Fallback: try to get directory listing
        fetchDirectoryListing(dir);
      });
  }
  
  function fetchDirectoryListing(dir) {
    fetch(dir === '/' ? '/' : dir)
      .then(res => res.text())
      .then(html => {
        // Parse HTML to extract file list (simplified approach)
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('table a[href]');
        const files = [];
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          const name = link.textContent.trim();
          if (href && !href.startsWith('..') && !href.startsWith('http')) {
            const fullPath = dir === '/' ? href : dir + '/' + href;
            files.push({
              name: name,
              path: fullPath.replace(/\/+/g, '/'),
              isDirectory: href.endsWith('/')
            });
          }
        });
        
        renderFileTree(files, dir);
      })
      .catch(() => {
        fileTree.innerHTML = '<div class="file-tree-loading">Error loading directory</div>';
      });
  }
  
  function renderFileTree(files, dir) {
    if (!files || files.length === 0) {
      fileTree.innerHTML = '<div class="file-tree-loading">No files</div>';
      return;
    }
    
    // Sort: folders first, then files
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    fileTree.innerHTML = '';
    
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-tree-item' + (file.isDirectory ? ' file-tree-folder' : '');
      item.dataset.path = file.path;
      item.dataset.isDirectory = file.isDirectory;
      item.dataset.name = file.name;
      
      // Normalize paths for comparison
      const normalizedCurrentPath = filePath ? filePath.replace(/\/+/g, '/') : '';
      const normalizedFilepath = file.path.replace(/\/+/g, '/');
      if (normalizedFilepath === normalizedCurrentPath) {
        item.classList.add('active');
      }
      
      const icon = document.createElement('span');
      icon.className = 'file-tree-item-icon';
      if (!file.isDirectory) {
        icon.textContent = '📄';
      }
      
      const name = document.createElement('span');
      name.className = 'file-tree-item-name';
      name.textContent = file.name;
      
      item.appendChild(icon);
      item.appendChild(name);
      
      // Left click
      if (file.isDirectory) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          // Navigate to folder
          loadFileTree(file.path);
        });
      } else {
        item.addEventListener('click', () => {
          switchToFile(file.path);
        });
      }
      
      // Right click for context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e, file.path, file.isDirectory, file.name);
      });
      
      // Double click to rename
      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        renameFile(file.path, file.name, file.isDirectory);
      });
      
      // Drag and drop for folders
      if (file.isDirectory) {
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.classList.add('drag-over');
        });
        
        item.addEventListener('dragleave', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.classList.remove('drag-over');
          
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            handleFileDrop(files, file.path);
          }
        });
      }
      
      fileTree.appendChild(item);
    });
  }
  
  function setupDragAndDrop() {
    // Enable drag and drop on file tree
    fileTree.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileTree.classList.add('drag-over');
    });
    
    fileTree.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove class if we're leaving the file tree entirely
      if (!fileTree.contains(e.relatedTarget)) {
        fileTree.classList.remove('drag-over');
      }
    });
    
    fileTree.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileTree.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // Check if we dropped over a folder
        const target = e.target.closest('.file-tree-folder');
        if (target && target.dataset.path) {
          // Drop into specific folder
          handleFileDrop(files, target.dataset.path);
        } else {
          // Drop into current directory
          handleFileDrop(files, currentDir || '/');
        }
      }
    });
  }
  
  function handleFileDrop(files, targetDir) {
    const normalizedDir = targetDir === '/' ? '' : targetDir.replace(/^\/+|\/+$/g, '');
    
    // Upload each file
    Array.from(files).forEach((file) => {
      uploadFile(file, normalizedDir);
    });
  }
  
  function uploadFile(file, targetDir) {
    const fileName = file.name;
    const targetPath = targetDir ? targetDir + '/' + fileName : fileName;
    
    // Show upload status
    status.textContent = `Uploading ${fileName}...`;
    status.className = 'status saving';
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      let isBinary = false;
      
      // If it's a data URL (binary file), extract the base64 part
      if (typeof content === 'string' && content.startsWith('data:')) {
        isBinary = true;
        // Extract base64 content (remove data:type;base64, prefix)
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          content = base64Match[1];
        } else {
          // Fallback: try to extract after comma
          const commaIndex = content.indexOf(',');
          if (commaIndex !== -1) {
            content = content.substring(commaIndex + 1);
          }
        }
      }
      
      // Upload file via API
      fetch('/__api__/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: targetPath, 
          content: content,
          isDirectory: false,
          isBinary: isBinary
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Reload file tree
          loadFileTree(currentDir);
          status.textContent = `Uploaded ${fileName}`;
          status.className = 'status saved';
          setTimeout(() => {
            if (!isDirty) {
              status.textContent = 'Ready';
              status.className = 'status';
            }
          }, 2000);
        } else {
          status.textContent = 'Error: ' + data.error;
          status.className = 'status error';
        }
      })
      .catch(err => {
        status.textContent = 'Error uploading file';
        status.className = 'status error';
        console.error(err);
      });
    };
    
    reader.onerror = () => {
      status.textContent = 'Error reading file';
      status.className = 'status error';
    };
    
    // Determine how to read the file
    const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
    const isTextFile = textTypes.some(type => file.type.startsWith(type)) || 
                       file.type === '' || 
                       fileName.endsWith('.txt') || 
                       fileName.endsWith('.html') || 
                       fileName.endsWith('.css') || 
                       fileName.endsWith('.js') ||
                       fileName.endsWith('.json') ||
                       fileName.endsWith('.md');
    
    if (isTextFile) {
      reader.readAsText(file);
    } else {
      // For binary files, read as data URL (base64)
      reader.readAsDataURL(file);
    }
  }
  
  function setupContextMenu() {
    // Close context menu when clicking elsewhere
    document.addEventListener('click', () => {
      contextMenu.style.display = 'none';
    });
    
    // Context menu items
    document.getElementById('contextNewFile').addEventListener('click', () => {
      createNewFile();
      contextMenu.style.display = 'none';
    });
    
    document.getElementById('contextNewFolder').addEventListener('click', () => {
      createNewFolder();
      contextMenu.style.display = 'none';
    });
    
    document.getElementById('contextRename').addEventListener('click', () => {
      const path = contextMenu.dataset.path;
      const name = contextMenu.dataset.name;
      const isDir = contextMenu.dataset.isDirectory === 'true';
      renameFile(path, name, isDir);
      contextMenu.style.display = 'none';
    });
    
    document.getElementById('contextDelete').addEventListener('click', () => {
      const path = contextMenu.dataset.path;
      const isDir = contextMenu.dataset.isDirectory === 'true';
      deleteFile(path, isDir);
      contextMenu.style.display = 'none';
    });
    
    // Right-click on empty space in file tree
    fileTree.addEventListener('contextmenu', (e) => {
      if (e.target === fileTree || e.target.classList.contains('file-tree-loading')) {
        e.preventDefault();
        showContextMenu(e, '', false, '', true); // Empty space - only show create options
      }
    });
  }
  
  function showContextMenu(e, path, isDirectory, name, onlyCreate = false) {
    contextMenu.dataset.path = path;
    contextMenu.dataset.name = name;
    contextMenu.dataset.isDirectory = isDirectory;
    
    // Position menu
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    
    // Show/hide menu items
    document.getElementById('contextRename').style.display = onlyCreate ? 'none' : 'block';
    document.getElementById('contextDelete').style.display = onlyCreate ? 'none' : 'block';
    document.querySelector('.context-menu-divider').style.display = onlyCreate ? 'none' : 'block';
  }
  
  function createNewFile() {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;
    
    const newPath = currentDir ? currentDir + '/' + fileName : fileName;
    
    fetch('/__api__/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath, content: '', isDirectory: false })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFileTree(currentDir);
        // Open the new file
        switchToFile(newPath);
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => {
      alert('Error creating file: ' + err.message);
    });
  }
  
  function createNewFolder() {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    
    const newPath = currentDir ? currentDir + '/' + folderName : folderName;
    
    fetch('/__api__/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath, content: '', isDirectory: true })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFileTree(currentDir);
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => {
      alert('Error creating folder: ' + err.message);
    });
  }
  
  function renameFile(path, oldName, isDirectory) {
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName === oldName) return;
    
    const parentDir = path.split('/').slice(0, -1).join('/') || '';
    const newPath = parentDir ? parentDir + '/' + newName : newName;
    
    fetch('/__api__/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path, newPath: newPath, isDirectory: isDirectory })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFileTree(currentDir);
        // If this is the current file, switch to new path
        if (path === filePath) {
          switchToFile(newPath);
        }
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => {
      alert('Error renaming: ' + err.message);
    });
  }
  
  function deleteFile(path, isDirectory) {
    if (!confirm(`Are you sure you want to delete ${isDirectory ? 'folder' : 'file'} "${path.split('/').pop()}"?`)) {
      return;
    }
    
    fetch('/__api__/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path, isDirectory: isDirectory })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFileTree(currentDir);
        // If this was the current file, close it
        if (path === filePath) {
          alert('File was deleted. Please close this tab.');
        }
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => {
      alert('Error deleting: ' + err.message);
    });
  }
  
  function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host;
    ws = new WebSocket(wsUrl);
    
    const serverOutput = document.getElementById('terminalServerOutput');
    
    ws.onopen = () => {
      console.log('Preview WebSocket connected');
    };
    
    ws.onclose = () => {
      console.log('Preview WebSocket disconnected - Reconnecting...');
      // Reconnect after 2 seconds
      setTimeout(setupWebSocket, 2000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle server logs
        if (data.type === 'serverLog' && serverOutput) {
          const line = document.createElement('div');
          line.className = `terminal-line ${data.level || 'log'}`;
          const metaStr = data.meta && Object.keys(data.meta).length > 0 
            ? ' ' + JSON.stringify(data.meta) 
            : '';
          line.textContent = `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.message}${metaStr}`;
          serverOutput.appendChild(line);
          serverOutput.scrollTop = serverOutput.scrollHeight;
        }
        
        // Handle file system events
        if (data.type === 'fileAdded' || data.type === 'fileDeleted' || 
            data.type === 'directoryAdded' || data.type === 'directoryDeleted') {
          handleFileSystemEvent(data);
        } else if (data.type === 'fileChanged') {
          // If the current file was changed externally, refresh preview
          const normalizePath = (p) => p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
          const currentPathNormalized = normalizePath(filePath);
          const changedPathNormalized = normalizePath(data.path);
          
          if (currentPathNormalized === changedPathNormalized) {
            // Refresh preview if current file changed
            const previewUrl = '/__preview-content__?file=' + encodeURIComponent(filePath) + '&t=' + Date.now();
            previewFrame.src = previewUrl;
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  }
  
  function handleFileSystemEvent(data) {
    // Normalize paths for comparison
    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
    const eventPath = normalizePath(data.path);
    const currentDirNormalized = normalizePath(currentDir || '/');
    
    // Check if the event is in the current directory or a parent
    const isInCurrentDir = eventPath.startsWith(currentDirNormalized + '/') || 
                          eventPath === currentDirNormalized ||
                          currentDirNormalized === '/';
    
    // Check if it's a parent directory change that affects current directory
    const isParentChange = currentDirNormalized.startsWith(eventPath + '/');
    
    if (isInCurrentDir || isParentChange) {
      // Reload file tree to reflect changes
      loadFileTree(currentDir);
    }
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
    }
  });
  
  function setupTerminal() {
    const tabs = document.querySelectorAll('.terminal-tab');
    const tabContents = document.querySelectorAll('.terminal-tab-content');
    const clientInput = document.getElementById('terminalClientInput');
    const powershellInput = document.getElementById('terminalPowerShellInput');
    const clientOutput = document.getElementById('terminalClientOutput');
    const serverOutput = document.getElementById('terminalServerOutput');
    const powershellOutput = document.getElementById('terminalPowerShellOutput');
    
    // Ensure inputs are enabled and visible
    if (clientInput) {
      clientInput.disabled = false;
      clientInput.style.pointerEvents = 'auto';
    }
    if (powershellInput) {
      powershellInput.disabled = false;
      powershellInput.style.pointerEvents = 'auto';
    }
    
    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => {
          content.classList.remove('active');
          // Handle different tab name formats - match the actual IDs in HTML
          let expectedId;
          if (tabName === 'powershell') {
            expectedId = 'terminalPowerShell';
          } else if (tabName === 'client') {
            expectedId = 'terminalClient';
          } else if (tabName === 'server') {
            expectedId = 'terminalServer';
          } else {
            expectedId = `terminal${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
          }
          
          if (content.id === expectedId) {
            content.classList.add('active');
            content.style.display = 'flex';
            
            // Make sure input container is visible
            const inputContainer = content.querySelector('.terminal-input-container');
            if (inputContainer) {
              inputContainer.style.display = 'flex';
            }
            
            // Focus input if it exists
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
        
        // Save active tab
        saveState();
      });
    });
    
    // Client terminal - capture console logs
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
    
    // Client terminal - execute JavaScript
    if (clientInput) {
      clientInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const command = clientInput.value.trim();
          if (command) {
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
          }
        }
      });
    }
    
    // PowerShell terminal - execute commands
    if (powershellInput) {
      powershellInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const command = powershellInput.value.trim();
          if (command) {
            addPowerShellLog(`PS> ${command}`, 'log');
            powershellInput.value = '';
            powershellInput.disabled = true;
            
            // Show loading indicator
            const loadingLine = document.createElement('div');
            loadingLine.className = 'terminal-line info';
            loadingLine.textContent = 'Executing...';
            loadingLine.id = 'powershell-loading';
            powershellOutput.appendChild(loadingLine);
            powershellOutput.scrollTop = powershellOutput.scrollHeight;
            
            // Execute command via API
            fetch('/__api__/terminal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: command, type: 'powershell' })
            })
            .then(res => res.json())
            .then(data => {
              // Remove loading indicator
              const loading = document.getElementById('powershell-loading');
              if (loading) loading.remove();
              
              if (data.success) {
                // Display output (stdout)
                if (data.output && data.output.trim()) {
                  // Split multi-line output
                  const lines = data.output.split('\n');
                  lines.forEach(line => {
                    if (line.trim()) {
                      addPowerShellLog(line, 'info');
                    }
                  });
                }
                // Display errors (stderr) - PowerShell often writes to stderr even on success
                if (data.error && data.error.trim()) {
                  const errorLines = data.error.split('\n');
                  errorLines.forEach(line => {
                    if (line.trim() && !line.includes('Warning:')) {
                      // Only show actual errors, not warnings
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
              // Remove loading indicator
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
    
    function addPowerShellLog(message, type = 'log') {
      if (!powershellOutput) return;
      const line = document.createElement('div');
      line.className = `terminal-line ${type}`;
      line.textContent = message;
      powershellOutput.appendChild(line);
      powershellOutput.scrollTop = powershellOutput.scrollHeight;
    }
  }
  
  function updateActiveFileTreeItem(path) {
    // Remove active class from all items
    const allItems = fileTree.querySelectorAll('.file-tree-item');
    allItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to the current file
    if (path) {
      const normalizedPath = path.replace(/\/+/g, '/');
      const activeItem = Array.from(allItems).find(item => {
        const itemPath = item.dataset.path.replace(/\/+/g, '/');
        return itemPath === normalizedPath;
      });
      
      if (activeItem) {
        activeItem.classList.add('active');
        // Scroll into view if needed
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
  
  function switchToFile(newPath) {
    if (newPath === filePath) return;
    
    // Check for unsaved changes
    if (isDirty && !confirm('You have unsaved changes. Switch file anyway?')) {
      return;
    }
    
    // Update file path
    filePath = newPath;
    
    // Update URL without reloading (app-like navigation)
    const newUrl = '/__preview__?file=' + encodeURIComponent(newPath);
    window.history.pushState({ file: newPath }, '', newUrl);
    
    // Update file name display
    fileName.textContent = newPath.split('/').pop();
    
    // Update current directory
    const newDir = newPath.split('/').slice(0, -1).join('/') || '';
    if (newDir !== currentDir) {
      currentDir = newDir;
      loadFileTree(currentDir);
    } else {
      // Just update the active item if we're in the same directory
      updateActiveFileTreeItem(newPath);
    }
    
    // Load the new file
    loadFile(newPath);
    
    // Save state
    saveState();
  }
  
  function updateStatus() {
    if (isDirty) {
      status.textContent = 'Modified';
      status.className = 'status';
    } else {
      status.textContent = 'Saved';
      status.className = 'status saved';
    }
  }
  
  function loadFile(path) {
    status.textContent = 'Loading...';
    status.className = 'status';
    
    // Check if it's an image file - images don't need to be loaded as text
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
    const isImage = imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
    
    if (isImage) {
      // For images, just show the preview (don't try to load as text)
      showImagePreview(path);
      status.textContent = 'Ready';
      status.className = 'status';
      // Clear editor or show a message
      editor.setValue('// Image file - cannot be edited as text');
      originalContent = '';
      isDirty = false;
      updateStatus();
      return;
    }
    
    fetch('/__api__/files?path=' + encodeURIComponent(path))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Set language based on file extension BEFORE setting value
          const detectedLanguage = getLanguage(path);
          const currentModel = editor.getModel();
          
          // Create or get model for this file
          let model = monaco.editor.getModels().find(m => m.uri.path === '/' + path);
          if (!model) {
            // Create new model
            const uri = monaco.Uri.parse('file:///' + path);
            model = monaco.editor.createModel(data.content, detectedLanguage, uri);
          } else {
            // Update existing model
            model.setValue(data.content);
            monaco.editor.setModelLanguage(model, detectedLanguage);
          }
          
          // Switch editor to this model
          editor.setModel(model);
          
          originalContent = data.content;
          isDirty = false;
          updateStatus();
          
          // Show HTML preview for non-image files
          showHtmlPreview();
          // Load initial preview via preview content route
          const previewUrl = '/__preview-content__?file=' + encodeURIComponent(path) + '&t=' + Date.now();
          previewFrame.src = previewUrl;
          
          // Setup link interception after iframe loads
          previewFrame.onload = () => {
            interceptPreviewLinks();
          };
        } else {
          status.textContent = 'Error: ' + data.error;
          status.className = 'status error';
        }
      })
      .catch(err => {
        status.textContent = 'Error loading file';
        status.className = 'status error';
        console.error(err);
      });
  }
  
  let previewUpdateTimeout = null;
  
  function updatePreview(content) {
    if (!previewFrame) return;
    
    // Debounce preview updates
    clearTimeout(previewUpdateTimeout);
    previewUpdateTimeout = setTimeout(() => {
      // Update preview cache and load via preview content route
      // This ensures proper base path for loading resources
      fetch('/__preview-content__?file=' + encodeURIComponent(filePath), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content
      })
      .then(() => {
        // Load via preview content route which injects base tag
        const previewUrl = '/__preview-content__?file=' + encodeURIComponent(filePath) + '&t=' + Date.now();
        previewFrame.src = previewUrl;
        
        // Setup link interception after iframe loads
        previewFrame.onload = () => {
          interceptPreviewLinks();
        };
      })
      .catch(err => {
        console.error('Error updating preview:', err);
        // Fallback to srcdoc if API fails
        updatePreviewFallback(content);
      });
    }, 300); // Debounce 300ms
  }
  
  function showImagePreview(imagePath) {
    // Hide iframe, show image preview
    previewFrame.style.display = 'none';
    imagePreview.style.display = 'flex';
    
    // Load image
    const imageUrl = '/' + imagePath.replace(/^\/+/, '');
    previewImage.src = imageUrl;
    previewImage.onerror = () => {
      previewImage.alt = 'Error loading image';
    };
    
    // Update title and show back button
    previewTitle.textContent = 'Image: ' + imagePath.split('/').pop();
    backToPreviewBtn.style.display = 'block';
  }
  
  function showHtmlPreview() {
    // Hide image preview, show iframe
    imagePreview.style.display = 'none';
    previewFrame.style.display = 'block';
    
    // Update title and hide back button
    previewTitle.textContent = 'Preview';
    backToPreviewBtn.style.display = 'none';
  }
  
  // Back to HTML preview button
  if (backToPreviewBtn) {
    backToPreviewBtn.addEventListener('click', () => {
      showHtmlPreview();
    });
  }
  
  function interceptPreviewLinks() {
    try {
      const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
      if (!iframeDoc) return;
      
      // Intercept image clicks
      iframeDoc.addEventListener('click', (e) => {
        const img = e.target.closest('img[src]');
        if (img) {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Resolve relative path
            let imagePath = src;
            if (!src.startsWith('/')) {
              const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
              const basePath = fileDir ? fileDir + '/' : '';
              imagePath = basePath + src;
            }
            imagePath = imagePath.replace(/\/+/g, '/').replace(/^\/+/, '');
            
            // Check if it's an image
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
            const isImage = imageExtensions.some(ext => imagePath.toLowerCase().endsWith(ext));
            
            if (isImage) {
              showImagePreview(imagePath);
            }
          }
        }
      }, true);
      
      // Intercept link clicks
      iframeDoc.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return; // Allow anchor links, mailto, tel
        }
        
        // If it's an external link or has target="_blank", let it open normally
        if (href.startsWith('http://') || href.startsWith('https://') || link.getAttribute('target') === '_blank') {
          return;
        }
        
        // Always prevent default for internal links to keep it app-like
        e.preventDefault();
        e.stopPropagation();
        
        // Intercept internal links
        e.preventDefault();
        
        // Resolve relative path
        let targetPath = href;
        if (!href.startsWith('/')) {
          // Relative path - resolve from current file's directory
          const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
          const basePath = fileDir ? fileDir + '/' : '';
          targetPath = basePath + href;
        }
        
        // Normalize path (remove double slashes, etc.)
        targetPath = targetPath.replace(/\/+/g, '/').replace(/^\/+/, '');
        
        // Check if it's an editable file that should be opened in editor
        const editableExtensions = ['.html', '.htm', '.css', '.js', '.json', '.md', '.txt', '.xml', '.yaml', '.yml'];
        const isEditable = editableExtensions.some(ext => targetPath.toLowerCase().endsWith(ext));
        
        if (isEditable) {
          // Switch to the file in the editor (app-like, no reload)
          switchToFile(targetPath);
        } else {
          // Check if it's an image file
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
          const isImage = imageExtensions.some(ext => targetPath.toLowerCase().endsWith(ext));
          
          if (isImage) {
            // Display image in preview
            showImagePreview(targetPath);
          } else {
            // For other files (PDFs, etc.), update preview iframe
            const previewUrl = '/__preview-content__?file=' + encodeURIComponent(targetPath) + '&t=' + Date.now();
            previewFrame.src = previewUrl;
          }
        }
      }, true);
    } catch (err) {
      console.error('Error intercepting links:', err);
    }
  }
  
  function updatePreviewFallback(content) {
    // Fallback method using srcdoc with base tag
    const fileDir = filePath.split('/').slice(0, -1).join('/') || '';
    const basePath = fileDir ? '/' + fileDir + '/' : '/';
    const baseUrl = window.location.origin + basePath;
    
    let modifiedContent = content;
    modifiedContent = modifiedContent.replace(/<base[^>]*>/gi, '');
    
    if (modifiedContent.match(/<head[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<head[^>]*>/i, (match) => {
        return match + `\n<base href="${baseUrl}">`;
      });
    } else if (modifiedContent.match(/<html[^>]*>/i)) {
      modifiedContent = modifiedContent.replace(/<html[^>]*>/i, (match) => {
        return match + `\n<head><base href="${baseUrl}"></head>`;
      });
    } else if (modifiedContent.trim().length > 0) {
      modifiedContent = `<!DOCTYPE html><html><head><base href="${baseUrl}"></head><body>${modifiedContent}</body></html>`;
    }
    
    previewFrame.srcdoc = modifiedContent;
  }
  
  function saveFile() {
    const content = editor.getValue();
    status.textContent = 'Saving...';
    status.className = 'status saving';
    
    fetch('/__api__/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: content })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        originalContent = content;
        isDirty = false;
        status.textContent = 'Saved';
        status.className = 'status saved';
        
        // Broadcast save event via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'editorSave',
            path: filePath,
            content: content
          }));
        }
        
        setTimeout(() => {
          if (!isDirty) {
            status.textContent = 'Ready';
            status.className = 'status';
          }
        }, 2000);
      } else {
        status.textContent = 'Error: ' + data.error;
        status.className = 'status error';
      }
    })
    .catch(err => {
      status.textContent = 'Error saving file';
      status.className = 'status error';
      console.error(err);
    });
  }
  
  function setupResizers() {
    const container = document.querySelector('.preview-container');
    const resizerExplorer = document.getElementById('resizerExplorer');
    const resizerEditor = document.getElementById('resizerEditor');
    const resizerTerminal = document.getElementById('resizerTerminal');
    const terminalPanel = document.getElementById('terminalPanel');
    
    // Global resize state (VS Code style)
    let activeResizer = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    
    // Constants
    const MIN_EXPLORER_WIDTH = 150;
    const MIN_EDITOR_WIDTH = 200;
    const MIN_PREVIEW_WIDTH = 200;
    const MIN_TERMINAL_HEIGHT = 100;
    const MAX_TERMINAL_HEIGHT = 500;
    const RESIZER_WIDTH = 4;
    
    // Global mouse handlers (works even when mouse leaves resizer)
    function handleGlobalMouseMove(e) {
      if (!activeResizer) return;
      
      const containerRect = container.getBoundingClientRect();
      
      switch (activeResizer) {
        case 'explorer':
          handleExplorerResize(e, containerRect);
          break;
        case 'editor':
          handleEditorResize(e, containerRect);
          break;
        case 'terminal':
          handleTerminalResize(e, containerRect);
          break;
      }
    }
    
    function handleGlobalMouseUp(e) {
      if (!activeResizer) return;
      
      // Clean up global state
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
      window.removeEventListener('blur', handleGlobalMouseUp);
      
      activeResizer = null;
      saveState();
    }
    
    // Explorer resizer handler
    function handleExplorerResize(e, containerRect) {
      if (fileExplorerPanel.classList.contains('collapsed')) return;
      
      const deltaX = e.clientX - startX;
      let newWidth = startWidth + deltaX;
      
      // Calculate constraints
      const minWidth = MIN_EXPLORER_WIDTH;
      const maxWidth = containerRect.width - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2);
      
      // Apply constraints
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      
      // Update explorer width
      fileExplorerPanel.style.width = newWidth + 'px';
      fileExplorerPanel.style.flex = 'none';
      
      // Ensure editor and preview maintain minimum widths
      const remainingWidth = containerRect.width - newWidth - RESIZER_WIDTH;
      if (editorPanel && previewPanel) {
        editorPanel.style.flex = '1 1 auto';
        previewPanel.style.flex = '1 1 auto';
        editorPanel.style.minWidth = MIN_EDITOR_WIDTH + 'px';
        previewPanel.style.minWidth = MIN_PREVIEW_WIDTH + 'px';
      }
    }
    
    // Editor resizer handler
    function handleEditorResize(e, containerRect) {
      if (previewPanel.classList.contains('collapsed')) return;
      
      const explorerWidth = fileExplorerPanel.classList.contains('collapsed') ? 0 : fileExplorerPanel.offsetWidth;
      const explorerResizerWidth = fileExplorerPanel.classList.contains('collapsed') ? 0 : RESIZER_WIDTH;
      const availableWidth = containerRect.width - explorerWidth - explorerResizerWidth - RESIZER_WIDTH;
      
      const deltaX = e.clientX - startX;
      let newEditorWidth = startWidth + deltaX;
      
      // Apply constraints
      newEditorWidth = Math.max(MIN_EDITOR_WIDTH, Math.min(newEditorWidth, availableWidth - MIN_PREVIEW_WIDTH));
      const newPreviewWidth = availableWidth - newEditorWidth;
      
      // Only apply if both panels meet minimum requirements
      if (newPreviewWidth >= MIN_PREVIEW_WIDTH) {
        editorPanel.style.flex = 'none';
        previewPanel.style.flex = 'none';
        editorPanel.style.width = newEditorWidth + 'px';
        previewPanel.style.width = newPreviewWidth + 'px';
      }
    }
    
    // Terminal resizer handler
    function handleTerminalResize(e, containerRect) {
      if (terminalPanel.classList.contains('collapsed')) return;
      
      const deltaY = e.clientY - startY;
      let newHeight = startHeight + deltaY;
      
      // Apply constraints
      newHeight = Math.max(MIN_TERMINAL_HEIGHT, Math.min(newHeight, MAX_TERMINAL_HEIGHT));
      
      terminalPanel.style.height = newHeight + 'px';
    }
    
    // Setup explorer resizer
    if (resizerExplorer) {
      resizerExplorer.addEventListener('mousedown', (e) => {
        if (fileExplorerPanel.classList.contains('collapsed')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        activeResizer = 'explorer';
        startX = e.clientX;
        startWidth = fileExplorerPanel.offsetWidth;
        
        // Setup global handlers
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mouseleave', handleGlobalMouseUp);
        window.addEventListener('blur', handleGlobalMouseUp);
      });
    }
    
    // Setup editor resizer
    if (resizerEditor) {
      resizerEditor.addEventListener('mousedown', (e) => {
        if (previewPanel.classList.contains('collapsed')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        activeResizer = 'editor';
        startX = e.clientX;
        startWidth = editorPanel.offsetWidth;
        
        // Setup global handlers
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mouseleave', handleGlobalMouseUp);
        window.addEventListener('blur', handleGlobalMouseUp);
      });
    }
    
    // Setup terminal resizer
    if (resizerTerminal && terminalPanel) {
      resizerTerminal.addEventListener('mousedown', (e) => {
        if (terminalPanel.classList.contains('collapsed')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        activeResizer = 'terminal';
        startY = e.clientY;
        startHeight = terminalPanel.offsetHeight;
        
        // Setup global handlers
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mouseleave', handleGlobalMouseUp);
        window.addEventListener('blur', handleGlobalMouseUp);
      });
      
      // Hide resizer if terminal is collapsed
      if (terminalPanel.classList.contains('collapsed')) {
        resizerTerminal.style.display = 'none';
      }
    }
  }
  
  // State management
  function saveState() {
    // Don't save during initialization/restoration
    if (isRestoringState) {
      console.log('saveState() called during restoration - skipping');
      return;
    }
    
    const terminalPanel = document.getElementById('terminalPanel');
    const toggleTerminal = document.getElementById('toggleTerminal');
    
    const explorerCollapsed = fileExplorerPanel.classList.contains('collapsed');
    const previewCollapsed = previewPanel.classList.contains('collapsed');
    const terminalCollapsed = terminalPanel ? terminalPanel.classList.contains('collapsed') : false;
    
    console.log('=== SAVING STATE ===');
    console.log('Explorer collapsed:', explorerCollapsed);
    console.log('Preview collapsed:', previewCollapsed);
    console.log('Terminal collapsed:', terminalCollapsed);
    
    const state = {
      filePath: filePath,
      currentDir: currentDir,
      explorerCollapsed: explorerCollapsed,
      previewCollapsed: previewCollapsed,
      terminalCollapsed: terminalCollapsed,
      terminalHeight: terminalPanel ? (terminalPanel.style.height || '200px') : '200px',
      explorerWidth: fileExplorerPanel.style.width || '250px',
      editorWidth: editorPanel.style.width || '',
      previewWidth: previewPanel.style.width || '',
      activeTerminalTab: document.querySelector('.terminal-tab.active')?.dataset.tab || 'client'
    };
    
    console.log('Saving state object:', state);
    
    try {
      localStorage.setItem('previewState', JSON.stringify(state));
      console.log('State saved successfully');
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }
  
  function restoreState() {
    try {
      const savedState = localStorage.getItem('previewState');
      if (!savedState) {
        console.log('No saved state found - initializing with defaults');
        // Initialize visibility with default state (all open)
        updateExplorerVisibility();
        updatePreviewVisibility();
        if (terminalPanel) {
          updateTerminalVisibility();
        }
        return;
      }
      
      const state = JSON.parse(savedState);
      console.log('Restoring state:', state);
      
      const terminalPanel = document.getElementById('terminalPanel');
      const resizerTerminal = document.getElementById('resizerTerminal');
      const toggleTerminal = document.getElementById('toggleTerminal');
      
      // Restore file path - switch if different (without reload)
      if (state.filePath && state.filePath !== filePath) {
        console.log('Switching to saved file:', state.filePath);
        // Use switchToFile but skip the unsaved changes check during restore
        filePath = state.filePath;
        fileName.textContent = state.filePath.split('/').pop();
        const newDir = state.filePath.split('/').slice(0, -1).join('/') || '';
        if (newDir !== currentDir) {
          currentDir = newDir;
          loadFileTree(currentDir);
        }
        loadFile(state.filePath);
        // Update URL without reload
        const newUrl = '/__preview__?file=' + encodeURIComponent(state.filePath);
        window.history.replaceState({ file: state.filePath }, '', newUrl);
        // Continue with restoring other state
      }
      
      // Restore explorer state
      if (state.explorerCollapsed !== undefined) {
        console.log('=== RESTORING EXPLORER STATE ===');
        console.log('Saved state explorerCollapsed:', state.explorerCollapsed);
        console.log('Current explorer has collapsed class:', fileExplorerPanel.classList.contains('collapsed'));
        
        // Clear any existing state first
        fileExplorerPanel.classList.remove('collapsed');
        console.log('After removing collapsed class, has collapsed:', fileExplorerPanel.classList.contains('collapsed'));
        
        if (state.explorerCollapsed) {
          fileExplorerPanel.classList.add('collapsed');
          toggleExplorer.textContent = '▶';
          console.log('Added collapsed class, has collapsed:', fileExplorerPanel.classList.contains('collapsed'));
        } else {
          fileExplorerPanel.classList.remove('collapsed'); // Ensure it's removed
          toggleExplorer.textContent = '◀';
          console.log('Explorer should be open, has collapsed:', fileExplorerPanel.classList.contains('collapsed'));
        }
        
        // Update visibility AFTER state is set
        updateExplorerVisibility();
        
        // Force reflow and verify
        requestAnimationFrame(() => {
          const height = fileExplorerPanel.offsetHeight;
          const width = window.getComputedStyle(fileExplorerPanel).width;
          console.log('Explorer panel offsetHeight:', height);
          console.log('Explorer panel computed width:', width);
          console.log('Explorer panel final collapsed state:', fileExplorerPanel.classList.contains('collapsed'));
        });
      } else {
        console.log('No explorer collapsed state in saved state');
      }
      if (state.explorerWidth) {
        console.log('Restoring explorer width:', state.explorerWidth);
        fileExplorerPanel.style.width = state.explorerWidth;
      }
      
      // Restore preview state
      if (state.previewCollapsed !== undefined) {
        console.log('=== RESTORING PREVIEW STATE ===');
        console.log('Saved state previewCollapsed:', state.previewCollapsed);
        console.log('Current preview has collapsed class:', previewPanel.classList.contains('collapsed'));
        
        // Clear any existing state first
        previewPanel.classList.remove('collapsed');
        console.log('After removing collapsed class, has collapsed:', previewPanel.classList.contains('collapsed'));
        
        if (state.previewCollapsed) {
          previewPanel.classList.add('collapsed');
          togglePreview.textContent = '▶';
          console.log('Added collapsed class, has collapsed:', previewPanel.classList.contains('collapsed'));
        } else {
          previewPanel.classList.remove('collapsed'); // Ensure it's removed
          togglePreview.textContent = '◀';
          console.log('Preview should be open, has collapsed:', previewPanel.classList.contains('collapsed'));
        }
        
        // Update visibility AFTER state is set
        updatePreviewVisibility();
        
        // Force reflow and verify
        requestAnimationFrame(() => {
          const height = previewPanel.offsetHeight;
          const width = window.getComputedStyle(previewPanel).width;
          console.log('Preview panel offsetHeight:', height);
          console.log('Preview panel computed width:', width);
          console.log('Preview panel final collapsed state:', previewPanel.classList.contains('collapsed'));
        });
      } else {
        console.log('No preview collapsed state in saved state');
      }
      
      // Restore panel widths
      if (state.editorWidth) {
        editorPanel.style.width = state.editorWidth;
        editorPanel.style.flex = 'none';
      }
      if (state.previewWidth) {
        previewPanel.style.width = state.previewWidth;
        previewPanel.style.flex = 'none';
      }
      
      // Restore terminal state
      if (terminalPanel) {
        if (state.terminalCollapsed !== undefined) {
          console.log('Restoring terminal collapsed:', state.terminalCollapsed);
          if (state.terminalCollapsed) {
            terminalPanel.classList.add('collapsed');
          } else {
            terminalPanel.classList.remove('collapsed');
            // Restore height only if not collapsed
            if (state.terminalHeight) {
              console.log('Restoring terminal height:', state.terminalHeight);
              terminalPanel.style.height = state.terminalHeight;
            }
          }
          // Update visibility after state is set
          updateTerminalVisibility();
          // Force reflow
          terminalPanel.offsetHeight;
        } else if (state.terminalHeight) {
          // If collapsed state not saved, just restore height
          console.log('Restoring terminal height (no collapsed state):', state.terminalHeight);
          terminalPanel.style.height = state.terminalHeight;
        }
      }
      
      // Restore active terminal tab (must happen after terminal is visible and setup)
      if (state.activeTerminalTab) {
        console.log('Restoring active terminal tab:', state.activeTerminalTab);
        // Wait for terminal setup to complete
        setTimeout(() => {
          const tab = document.querySelector(`.terminal-tab[data-tab="${state.activeTerminalTab}"]`);
          if (tab) {
            console.log('Switching to terminal tab:', tab);
            // Manually trigger the tab switch logic
            const tabName = tab.dataset.tab;
            const tabs = document.querySelectorAll('.terminal-tab');
            const tabContents = document.querySelectorAll('.terminal-tab-content');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => {
              content.classList.remove('active');
              let expectedId;
              if (tabName === 'powershell') {
                expectedId = 'terminalPowerShell';
              } else if (tabName === 'client') {
                expectedId = 'terminalClient';
              } else if (tabName === 'server') {
                expectedId = 'terminalServer';
              }
              
              if (content.id === expectedId) {
                content.classList.add('active');
                // Focus input if it exists
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
          } else {
            console.warn('Terminal tab not found:', state.activeTerminalTab);
          }
        }, 300);
      }
      
      // Restore current directory (only if it's different and file tree is already loaded)
      if (state.currentDir && state.currentDir !== currentDir) {
        console.log('Restoring directory:', state.currentDir);
        currentDir = state.currentDir;
        // Only reload if file tree is already loaded
        if (fileTree && fileTree.innerHTML !== '<div class="file-tree-loading">Loading...</div>') {
          loadFileTree(currentDir);
        }
      }
      
      console.log('State restored successfully');
      console.log('Current directory after restore:', currentDir);
      console.log('Explorer collapsed:', fileExplorerPanel.classList.contains('collapsed'));
      console.log('Preview collapsed:', previewPanel.classList.contains('collapsed'));
      console.log('Terminal collapsed:', terminalPanel ? terminalPanel.classList.contains('collapsed') : 'N/A');
    } catch (err) {
      console.error('Error restoring state:', err);
    }
  }
  
  // Reset settings function
  function resetSettings() {
    // Clear all localStorage settings
    localStorage.removeItem('previewState');
    localStorage.removeItem('fileExplorerSettings');
    
    // Reset explorer panel
    fileExplorerPanel.classList.remove('collapsed');
    fileExplorerPanel.style.width = '250px';
    fileExplorerPanel.style.maxWidth = '';
    fileExplorerPanel.style.flex = '';
    toggleExplorer.textContent = '◀';
    
    // Reset editor panel
    editorPanel.style.width = '';
    editorPanel.style.flex = '';
    editorPanel.style.minWidth = '';
    editorPanel.style.maxWidth = '';
    
    // Reset preview panel
    previewPanel.classList.remove('collapsed');
    previewPanel.style.width = '';
    previewPanel.style.flex = '';
    previewPanel.style.minWidth = '';
    previewPanel.style.maxWidth = '';
    togglePreview.textContent = '◀';
    
    // Reset terminal panel
    if (terminalPanel) {
      terminalPanel.classList.remove('collapsed');
      terminalPanel.style.height = '200px';
      
      // Reset terminal tab to client
      const tabs = document.querySelectorAll('.terminal-tab');
      const tabContents = document.querySelectorAll('.terminal-tab-content');
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });
      const clientTab = document.querySelector('.terminal-tab[data-tab="client"]');
      const clientContent = document.getElementById('terminalClient');
      if (clientTab && clientContent) {
        clientTab.classList.add('active');
        clientContent.classList.add('active');
        clientContent.style.display = 'flex';
      }
    }
    
    // Update visibility
    updateExplorerVisibility();
    updatePreviewVisibility();
    if (terminalPanel) {
      updateTerminalVisibility();
    }
    
    // Show feedback
    status.textContent = 'Settings reset';
    status.className = 'status saved';
    setTimeout(() => {
      status.textContent = 'Ready';
      status.className = 'status';
    }, 2000);
    
    console.log('Settings reset to defaults');
  }
  
  // Save state on various events
  window.addEventListener('beforeunload', () => {
    saveState();
    if (ws) {
      ws.close();
    }
  });
  
  // Save state periodically as well
  setInterval(saveState, 5000); // Save every 5 seconds
});
