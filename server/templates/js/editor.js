// Get file path from URL
const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');

// Generate unique session ID for this editor tab
const sessionId = 'editor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

let editor = null;
let originalContent = '';
let isDirty = false;
let ws = null;
let isApplyingExternalChange = false;
let lastSavedContent = '';
let lastSaveTime = 0;
const IGNORE_EXTERNAL_CHANGES_MS = 2000; // Ignore file watcher notifications for 2 seconds after save

// Merge dialog state
let mergeCurrentEditor = null;
let mergeExternalEditor = null;
let mergeResultEditor = null;
let pendingExternalContent = null;

// Language mapping
function getLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const languages = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'sh': 'shell',
    'bash': 'shell',
    'bat': 'bat',
    'ps1': 'powershell',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'vue': 'vue',
    'dockerfile': 'dockerfile',
    'txt': 'plaintext'
  };
  return languages[ext] || 'plaintext';
}

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
  const editorContainer = document.getElementById('editor');
  const saveBtn = document.getElementById('saveBtn');
  const closeBtn = document.getElementById('closeBtn');
  const status = document.getElementById('status');
  const fileName = document.getElementById('fileName');
  
  if (!filePath) {
    status.textContent = 'Error: No file specified';
    status.className = 'status error';
    return;
  }
  
  fileName.textContent = filePath.split('/').pop();
  const language = getLanguage(filePath);
  
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
    },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'matchingDocuments'
  });
  
  // Load file content
  loadFile(filePath);
  
  // Setup WebSocket connection for sync
  setupWebSocket();
  
  // Track changes
  editor.onDidChangeModelContent(() => {
    if (isApplyingExternalChange) return;
    
    const currentContent = editor.getValue();
    isDirty = currentContent !== originalContent;
    updateStatus();
    
    // Broadcast changes to other editors (debounced)
    debounceBroadcastChange(currentContent);
  });
  
  // Save on Ctrl+S
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveFile();
  });
  
  // Save button
  saveBtn.addEventListener('click', saveFile);
  
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
        lastSavedContent = content;
        lastSaveTime = Date.now(); // Track when we saved
        isDirty = false;
        status.textContent = 'Saved';
        status.className = 'status saved';
        
        // Broadcast save to other editors (with our session ID so we can ignore our own)
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'editorSave',
            path: filePath,
            content: content,
            sessionId: sessionId
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
  
  function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Editor WebSocket connected');
      // Register this editor with session ID
      ws.send(JSON.stringify({
        type: 'editorOpen',
        path: filePath,
        sessionId: sessionId
      }));
    };
    
    ws.onclose = () => {
      console.log('Editor WebSocket disconnected');
      status.textContent = 'Disconnected - Reconnecting...';
      status.className = 'status error';
      // Reconnect after 2 seconds
      setTimeout(setupWebSocket, 2000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'fileChanged') {
          // File was changed externally (by file watcher)
          handleExternalFileChange(data.path);
        } else if (data.type === 'editorSave') {
          // Another editor tab saved the file
          if (data.path === filePath) {
            // Ignore if this is our own save (check session ID)
            if (data.sessionId === sessionId) {
              console.log('Ignoring editorSave (our own save, sessionId:', sessionId, ')');
              return;
            }
            
            // Ignore if no sessionId and we just saved (likely from API broadcast of our own save)
            if (!data.sessionId) {
              const timeSinceSave = Date.now() - lastSaveTime;
              if (timeSinceSave < 1000 && data.content === lastSavedContent) {
                console.log('Ignoring editorSave (no sessionId, but matches our recent save)');
                return;
              }
            }
            
            // This is a save from another editor tab
            // Only handle if content is actually different
            if (data.content !== lastSavedContent) {
              handleExternalSave(data.content);
            }
          }
        } else if (data.type === 'editorChange') {
          // Another editor tab made changes (optional - for real-time sync)
          // This could be used for collaborative editing in the future
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  }
  
  function handleExternalFileChange(changedPath) {
    // Normalize paths for comparison
    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
    const currentPathNormalized = normalizePath(filePath);
    const changedPathNormalized = normalizePath(changedPath);
    
    if (currentPathNormalized === changedPathNormalized) {
      // Ignore file watcher notifications if we just saved (within last 2 seconds)
      const timeSinceSave = Date.now() - lastSaveTime;
      if (timeSinceSave < IGNORE_EXTERNAL_CHANGES_MS) {
        // This is likely from our own save, ignore it
        console.log('Ignoring file watcher notification (recent save)');
        return;
      }
      
      // Check if the file content actually changed by fetching it
      fetch('/__api__/files?path=' + encodeURIComponent(filePath))
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const currentContent = editor.getValue();
            const fileContent = data.content;
            
            // If content matches what we have, ignore (might be from our save)
            if (fileContent === currentContent || fileContent === lastSavedContent) {
              console.log('File content matches, ignoring external change notification');
              return;
            }
            
            // Content is actually different - this is a real external change
            if (isDirty) {
              // User has unsaved changes - show merge dialog
              pendingExternalContent = fileContent;
              showMergeDialog(currentContent, fileContent);
            } else {
              // No unsaved changes, just reload
              loadFile(filePath);
              status.textContent = 'File reloaded';
              status.className = 'status saved';
              setTimeout(() => {
                if (!isDirty) {
                  status.textContent = 'Ready';
                  status.className = 'status';
                }
              }, 2000);
            }
          }
        })
        .catch(err => {
          console.error('Error checking file content:', err);
        });
    }
  }
  
  function handleExternalSave(content) {
    // Double-check this isn't our own save that got delayed
    const timeSinceSave = Date.now() - lastSaveTime;
    if (timeSinceSave < 1000 && content === lastSavedContent) {
      console.log('Ignoring external save (matches our recent save)');
      return;
    }
    
    if (isDirty) {
      // We have unsaved changes, but another editor saved - show merge dialog
      pendingExternalContent = content;
      showMergeDialog(editor.getValue(), content);
    } else {
      // No unsaved changes, just sync
      isApplyingExternalChange = true;
      editor.setValue(content);
      originalContent = content;
      lastSavedContent = content;
      lastSaveTime = Date.now(); // Update save time to prevent loops
      isApplyingExternalChange = false;
      status.textContent = 'Synced from other editor';
      status.className = 'status saved';
      setTimeout(() => {
        if (!isDirty) {
          status.textContent = 'Ready';
          status.className = 'status';
        }
      }, 2000);
    }
  }
  
  let broadcastTimeout = null;
  function debounceBroadcastChange(content) {
    // Debounce broadcasts to avoid too many messages
    clearTimeout(broadcastTimeout);
    broadcastTimeout = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'editorChange',
          path: filePath,
          content: content
        }));
      }
    }, 500); // Wait 500ms after last change
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
    }
  });
  
  // Merge dialog functions
  function showMergeDialog(currentContent, externalContent) {
    const dialog = document.getElementById('mergeDialog');
    dialog.style.display = 'flex';
    pendingExternalContent = externalContent;
  }
  
  window.closeMergeDialog = function() {
    const dialog = document.getElementById('mergeDialog');
    dialog.style.display = 'none';
    const mergeView = document.getElementById('mergeView');
    mergeView.style.display = 'none';
    
    // Cleanup merge editors
    if (mergeCurrentEditor) {
      mergeCurrentEditor.dispose();
      mergeCurrentEditor = null;
    }
    if (mergeExternalEditor) {
      mergeExternalEditor.dispose();
      mergeExternalEditor = null;
    }
    if (mergeResultEditor) {
      mergeResultEditor.dispose();
      mergeResultEditor = null;
    }
  };
  
  window.handleMergeChoice = function(choice) {
    if (choice === 'keep') {
      // Keep current changes, ignore external
      closeMergeDialog();
      status.textContent = 'Modified (external change ignored)';
      status.className = 'status';
    } else if (choice === 'accept') {
      // Accept external changes, discard current
      isApplyingExternalChange = true;
      editor.setValue(pendingExternalContent);
      originalContent = pendingExternalContent;
      lastSavedContent = pendingExternalContent;
      lastSaveTime = Date.now();
      isDirty = false;
      isApplyingExternalChange = false;
      updateStatus();
      closeMergeDialog();
      status.textContent = 'External changes applied';
      status.className = 'status saved';
      setTimeout(() => {
        if (!isDirty) {
          status.textContent = 'Ready';
          status.className = 'status';
        }
      }, 2000);
    } else if (choice === 'merge') {
      // Show merge view
      const mergeView = document.getElementById('mergeView');
      mergeView.style.display = 'block';
      
      // Initialize merge editors
      const currentContent = editor.getValue();
      const externalContent = pendingExternalContent;
      
      // Create editors for comparison
      if (!mergeCurrentEditor) {
        mergeCurrentEditor = monaco.editor.create(document.getElementById('mergeCurrent'), {
          value: currentContent,
          language: getLanguage(filePath),
          theme: 'vs-dark',
          readOnly: true,
          fontSize: 12,
          minimap: { enabled: false }
        });
      } else {
        mergeCurrentEditor.setValue(currentContent);
      }
      
      if (!mergeExternalEditor) {
        mergeExternalEditor = monaco.editor.create(document.getElementById('mergeExternal'), {
          value: externalContent,
          language: getLanguage(filePath),
          theme: 'vs-dark',
          readOnly: true,
          fontSize: 12,
          minimap: { enabled: false }
        });
      } else {
        mergeExternalEditor.setValue(externalContent);
      }
      
      if (!mergeResultEditor) {
        mergeResultEditor = monaco.editor.create(document.getElementById('mergeResult'), {
          value: currentContent, // Start with current as default
          language: getLanguage(filePath),
          theme: 'vs-dark',
          readOnly: false,
          fontSize: 12,
          minimap: { enabled: false }
        });
      } else {
        mergeResultEditor.setValue(currentContent);
      }
      
      // Sync scrolling
      mergeCurrentEditor.onDidScrollChange(() => {
        const scrollTop = mergeCurrentEditor.getScrollTop();
        const scrollLeft = mergeCurrentEditor.getScrollLeft();
        mergeExternalEditor.setScrollTop(scrollTop);
        mergeExternalEditor.setScrollLeft(scrollLeft);
        mergeResultEditor.setScrollTop(scrollTop);
        mergeResultEditor.setScrollLeft(scrollLeft);
      });
      
      mergeExternalEditor.onDidScrollChange(() => {
        const scrollTop = mergeExternalEditor.getScrollTop();
        const scrollLeft = mergeExternalEditor.getScrollLeft();
        mergeCurrentEditor.setScrollTop(scrollTop);
        mergeCurrentEditor.setScrollLeft(scrollLeft);
        mergeResultEditor.setScrollTop(scrollTop);
        mergeResultEditor.setScrollLeft(scrollLeft);
      });
    }
  };
  
  window.applyMerge = function() {
    if (!mergeResultEditor) return;
    
    const mergedContent = mergeResultEditor.getValue();
    isApplyingExternalChange = true;
    editor.setValue(mergedContent);
    originalContent = mergedContent;
    lastSavedContent = mergedContent;
    lastSaveTime = Date.now();
    isDirty = true; // Mark as dirty since it's a merge
    isApplyingExternalChange = false;
    updateStatus();
    closeMergeDialog();
    status.textContent = 'Merge applied';
    status.className = 'status saved';
  };
  
  window.cancelMerge = function() {
    closeMergeDialog();
  };
});
