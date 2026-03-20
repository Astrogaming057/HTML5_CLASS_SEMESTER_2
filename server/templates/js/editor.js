const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');

const sessionId = 'editor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

let editor = null;
let originalContent = '';
let isDirty = false;
let ws = null;
let isApplyingExternalChange = false;
let lastSavedContent = '';
let lastSaveTime = 0;
const IGNORE_EXTERNAL_CHANGES_MS = 2000;

let mergeCurrentEditor = null;
let mergeExternalEditor = null;
let mergeResultEditor = null;
let pendingExternalContent = null;

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
    folding: true,
    foldingStrategy: 'auto',
    foldingHighlight: true,
    showFoldingControls: 'always',
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'matchingDocuments'
  });
  
  loadFile(filePath);
  
  setupWebSocket();
  
  let saveToEditorTimeout = null;
  
  editor.onDidChangeModelContent(() => {
    if (isApplyingExternalChange) return;
    
    const currentContent = editor.getValue();
    isDirty = currentContent !== originalContent;
    updateStatus();
    
    debounceBroadcastChange(currentContent);
    
    if (saveToEditorTimeout) {
      clearTimeout(saveToEditorTimeout);
    }
    saveToEditorTimeout = setTimeout(() => {
      fetch('/__api__/files/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: currentContent })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.error('Error saving to ide_editor_cache folder:', data.error);
        }
      })
      .catch(err => {
        console.error('Error saving to ide_editor_cache folder:', err);
      });
    }, 50);
  });
  
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveFile();
  });
  
  saveBtn.addEventListener('click', saveFile);
  
  closeBtn.addEventListener('click', () => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
      window.close();
    });
    
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
  
  async function loadFile(path) {
    status.textContent = 'Loading...';
    
    try {
      // Check for cache first
      const cacheResponse = await fetch('/__api__/files/editor?path=' + encodeURIComponent(path));
      const cacheData = await cacheResponse.json();
      
      // Load actual file
      const fileResponse = await fetch('/__api__/files?path=' + encodeURIComponent(path));
      const fileData = await fileResponse.json();
      
      if (!fileData.success) {
        status.textContent = 'Error: ' + fileData.error;
        status.className = 'status error';
        return;
      }
      
      // If cache exists and is different from actual file, prompt user
      if (cacheData.success && cacheData.exists && cacheData.content !== fileData.content) {
        const choice = await customCacheDialog('Unsaved changes found in cache. What would you like to do?');
        
        if (choice === 'pull') {
          // Load from cache
          fileData.content = cacheData.content;
        } else if (choice === 'discard') {
          // Delete cache
          await fetch('/__api__/files/editor', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
          });
        } else {
          // User cancelled, don't load
          status.textContent = 'Ready';
          status.className = 'status';
          return;
        }
      }
      
      editor.setValue(fileData.content);
      originalContent = fileData.content;
      isDirty = false;
      updateStatus();
      
      const detectedLanguage = getLanguage(path);
      monaco.editor.setModelLanguage(editor.getModel(), detectedLanguage);
    } catch (err) {
      status.textContent = 'Error loading file';
      status.className = 'status error';
      console.error(err);
    }
  }
  
  function customCacheDialog(message) {
    return new Promise((resolve) => {
      // Create a simple dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
      
      const content = document.createElement('div');
      content.style.cssText = 'background: #2d2d2d; padding: 20px; border-radius: 8px; min-width: 400px; max-width: 500px;';
      
      const messageEl = document.createElement('p');
      messageEl.textContent = message;
      messageEl.style.cssText = 'margin: 0 0 20px 0; color: #cccccc;';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
      
      const pullBtn = document.createElement('button');
      pullBtn.textContent = 'Pull from Cache';
      pullBtn.className = 'btn btn-primary';
      pullBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';
      
      const discardBtn = document.createElement('button');
      discardBtn.textContent = 'Discard';
      discardBtn.className = 'btn btn-secondary';
      discardBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';
      
      buttonContainer.appendChild(pullBtn);
      buttonContainer.appendChild(discardBtn);
      buttonContainer.appendChild(cancelBtn);
      
      content.appendChild(messageEl);
      content.appendChild(buttonContainer);
      dialog.appendChild(content);
      document.body.appendChild(dialog);
      
      pullBtn.focus();
      
      const cleanup = () => {
        document.body.removeChild(dialog);
      };
      
      pullBtn.onclick = () => {
        cleanup();
        resolve('pull');
      };
      
      discardBtn.onclick = () => {
        cleanup();
        resolve('discard');
      };
      
      cancelBtn.onclick = () => {
        cleanup();
        resolve('cancel');
      };
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          cleanup();
          resolve('cancel');
        }
      };
      
      dialog.onkeydown = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve('cancel');
        }
      };
    });
  }
  
  function saveFile() {
    const content = editor.getValue();
    status.textContent = 'Saving...';
    status.className = 'status saving';
    
    if (saveToEditorTimeout) {
      clearTimeout(saveToEditorTimeout);
      saveToEditorTimeout = null;
    }
    
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
        lastSaveTime = Date.now();
        isDirty = false;
        status.textContent = 'Saved';
        status.className = 'status saved';
        
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
      setTimeout(setupWebSocket, 2000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'fileChanged') {
          handleExternalFileChange(data.path);
        } else if (data.type === 'editorSave') {
          if (data.path === filePath) {
            if (data.sessionId === sessionId) {
              console.log('Ignoring editorSave (our own save, sessionId:', sessionId, ')');
              return;
            }
            
            if (!data.sessionId) {
              const timeSinceSave = Date.now() - lastSaveTime;
              if (timeSinceSave < 1000 && data.content === lastSavedContent) {
                console.log('Ignoring editorSave (no sessionId, but matches our recent save)');
                return;
              }
            }
            
            if (data.content !== lastSavedContent) {
              handleExternalSave(data.content);
            }
          }
        } else if (data.type === 'editorChange') {
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  }
  
  function handleExternalFileChange(changedPath) {
    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\\/g, '/');
    const currentPathNormalized = normalizePath(filePath);
    const changedPathNormalized = normalizePath(changedPath);
    
    if (currentPathNormalized === changedPathNormalized) {
      const timeSinceSave = Date.now() - lastSaveTime;
      if (timeSinceSave < IGNORE_EXTERNAL_CHANGES_MS) {
        console.log('Ignoring file watcher notification (recent save)');
        return;
      }
      
      fetch('/__api__/files?path=' + encodeURIComponent(filePath))
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const currentContent = editor.getValue();
            const fileContent = data.content;
            
            if (fileContent === currentContent || fileContent === lastSavedContent) {
              console.log('File content matches, ignoring external change notification');
              return;
            }
            
            if (isDirty) {
              pendingExternalContent = fileContent;
              showMergeDialog(currentContent, fileContent);
            } else {
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
    const timeSinceSave = Date.now() - lastSaveTime;
    if (timeSinceSave < 1000 && content === lastSavedContent) {
      console.log('Ignoring external save (matches our recent save)');
      return;
    }
    
    if (isDirty) {
      pendingExternalContent = content;
      showMergeDialog(editor.getValue(), content);
    } else {
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
  
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
    }
  });
  
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
      closeMergeDialog();
      status.textContent = 'Modified (external change ignored)';
      status.className = 'status';
    } else if (choice === 'accept') {
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
      const mergeView = document.getElementById('mergeView');
      mergeView.style.display = 'block';
      
      const currentContent = editor.getValue();
      const externalContent = pendingExternalContent;
      
      if (!mergeCurrentEditor) {
        mergeCurrentEditor = monaco.editor.create(document.getElementById('mergeCurrent'), {
          value: currentContent,
          language: getLanguage(filePath),
          theme: 'vs-dark',
          readOnly: true,
          fontSize: 12,
          minimap: { enabled: false },
          folding: true,
          foldingStrategy: 'auto',
          showFoldingControls: 'always'
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
          minimap: { enabled: false },
          folding: true,
          foldingStrategy: 'auto',
          showFoldingControls: 'always'
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
          minimap: { enabled: false },
          folding: true,
          foldingStrategy: 'auto',
          showFoldingControls: 'always'
        });
      } else {
        mergeResultEditor.setValue(currentContent);
      }
      
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
