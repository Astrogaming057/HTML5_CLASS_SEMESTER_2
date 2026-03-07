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
  const status = document.getElementById('status');
  const fileName = document.getElementById('fileName');
  previewFrame = document.getElementById('previewFrame');
  fileTree = document.getElementById('fileTree');
  const toggleExplorer = document.getElementById('toggleExplorer');
  const toggleExplorerBtn = document.getElementById('toggleExplorerBtn');
  const fileExplorerPanel = document.getElementById('fileExplorerPanel');
  const backBtn = document.getElementById('backBtn');
  const editorPanel = document.getElementById('editorPanel');
  const previewPanel = document.getElementById('previewPanel');
  const togglePreview = document.getElementById('togglePreview');
  const togglePreviewBtn = document.getElementById('togglePreviewBtn');
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
  
  // Setup file explorer
  setupFileExplorer();
  
  // Setup context menu
  setupContextMenu();
  
  // Setup drag and drop
  setupDragAndDrop();
  
  // Setup WebSocket connection for sync
  setupWebSocket();
  
  // Toggle explorer button (in panel)
  toggleExplorer.addEventListener('click', () => {
    toggleFileExplorer();
  });
  
  // Toggle explorer button (in header)
  toggleExplorerBtn.addEventListener('click', () => {
    toggleFileExplorer();
  });
  
  // Toggle preview button (in panel)
  togglePreview.addEventListener('click', () => {
    togglePreviewPanel();
  });
  
  // Toggle preview button (in header)
  togglePreviewBtn.addEventListener('click', () => {
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
    fileExplorerPanel.classList.toggle('collapsed');
    toggleExplorer.textContent = isCollapsed ? '◀' : '▶';
    updateBackButton();
  }
  
  function togglePreviewPanel() {
    const isCollapsed = previewPanel.classList.contains('collapsed');
    previewPanel.classList.toggle('collapsed');
    
    // Hide/show resizer based on preview state
    if (resizerEditor) {
      if (previewPanel.classList.contains('collapsed')) {
        resizerEditor.style.display = 'none';
      } else {
        resizerEditor.style.display = 'block';
      }
    }
    
    togglePreview.textContent = isCollapsed ? '◀' : '▶';
  }
  
  // Initialize resizer visibility
  if (resizerEditor && previewPanel) {
    if (previewPanel.classList.contains('collapsed')) {
      resizerEditor.style.display = 'none';
    }
  }
  
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
      const normalizedCurrentPath = filePath.replace(/\/+/g, '/');
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
  
  function switchToFile(newPath) {
    if (newPath === filePath) return;
    
    // Check for unsaved changes
    if (isDirty && !confirm('You have unsaved changes. Switch file anyway?')) {
      return;
    }
    
    // Update URL and reload
    const newUrl = '/__preview__?file=' + encodeURIComponent(newPath);
    window.location.href = newUrl;
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
    fetch('/__api__/files?path=' + encodeURIComponent(path))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          editor.setValue(data.content);
          originalContent = data.content;
          isDirty = false;
          updateStatus();
          
          // Load initial preview via preview content route
          const previewUrl = '/__preview-content__?file=' + encodeURIComponent(path);
          previewFrame.src = previewUrl;
          
          // Setup link interception after iframe loads
          previewFrame.onload = () => {
            interceptPreviewLinks();
          };
          
          // Set language based on file extension
          const detectedLanguage = getLanguage(path);
          monaco.editor.setModelLanguage(editor.getModel(), detectedLanguage);
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
  
  function interceptPreviewLinks() {
    try {
      const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
      if (!iframeDoc) return;
      
      // Intercept link clicks
      iframeDoc.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return; // Allow anchor links, mailto, tel
        }
        
        // If it's an external link, let it open normally
        if (href.startsWith('http://') || href.startsWith('https://')) {
          return;
        }
        
        // Intercept internal links
        e.preventDefault();
        
        // Resolve relative path
        let targetPath = href;
        if (!href.startsWith('/')) {
          // Relative path - resolve from current directory
          const baseDir = currentDir || '/';
          targetPath = baseDir + '/' + href;
          targetPath = targetPath.replace(/\/+/g, '/');
        }
        
        // Remove leading slash for API
        if (targetPath.startsWith('/')) {
          targetPath = targetPath.substring(1);
        }
        
        // Check if it's an HTML file
        if (targetPath.match(/\.(html|htm)$/i)) {
          // Switch to that file in the editor
          switchToFile(targetPath);
        } else {
          // For other files, just update preview
          const previewUrl = '/__preview-content__?file=' + encodeURIComponent(targetPath);
          previewFrame.src = previewUrl;
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
    
    // Resizer between file explorer and editor
    if (resizerExplorer) {
      let isResizingExplorer = false;
      
      resizerExplorer.addEventListener('mousedown', (e) => {
        isResizingExplorer = true;
        document.addEventListener('mousemove', handleExplorerResize);
        document.addEventListener('mouseup', stopExplorerResize);
        e.preventDefault();
      });
      
      function handleExplorerResize(e) {
        if (!isResizingExplorer || fileExplorerPanel.classList.contains('collapsed')) return;
        
        const containerRect = container.getBoundingClientRect();
        const newExplorerWidth = e.clientX - containerRect.left;
        
        if (newExplorerWidth >= 150 && newExplorerWidth <= containerRect.width * 0.5) {
          fileExplorerPanel.style.width = newExplorerWidth + 'px';
        }
      }
      
      function stopExplorerResize() {
        isResizingExplorer = false;
        document.removeEventListener('mousemove', handleExplorerResize);
        document.removeEventListener('mouseup', stopExplorerResize);
      }
    }
    
    // Resizer between editor and preview
    if (resizerEditor) {
      let isResizingEditor = false;
      
      resizerEditor.addEventListener('mousedown', (e) => {
        isResizingEditor = true;
        document.addEventListener('mousemove', handleEditorResize);
        document.addEventListener('mouseup', stopEditorResize);
        e.preventDefault();
      });
      
      function handleEditorResize(e) {
        if (!isResizingEditor || previewPanel.classList.contains('collapsed')) return;
        
        const containerRect = container.getBoundingClientRect();
        const explorerWidth = fileExplorerPanel.classList.contains('collapsed') ? 0 : fileExplorerPanel.offsetWidth;
        const relativeX = e.clientX - containerRect.left - explorerWidth;
        const availableWidth = containerRect.width - explorerWidth;
        const editorPercent = (relativeX / availableWidth) * 100;
        
        if (editorPercent >= 20 && editorPercent <= 80) {
          editorPanel.style.flex = 'none';
          previewPanel.style.flex = 'none';
          editorPanel.style.width = editorPercent + '%';
          previewPanel.style.width = (100 - editorPercent) + '%';
        }
      }
      
      function stopEditorResize() {
        isResizingEditor = false;
        document.removeEventListener('mousemove', handleEditorResize);
        document.removeEventListener('mouseup', stopEditorResize);
      }
    }
  }
});
