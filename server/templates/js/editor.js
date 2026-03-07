// Get file path from URL
const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');

let editor = null;
let originalContent = '';
let isDirty = false;

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
  
  // Track changes
  editor.onDidChangeModelContent(() => {
    const currentContent = editor.getValue();
    isDirty = currentContent !== originalContent;
    updateStatus();
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
        isDirty = false;
        status.textContent = 'Saved';
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
      status.textContent = 'Error saving file';
      status.className = 'status error';
      console.error(err);
    });
  }
});
