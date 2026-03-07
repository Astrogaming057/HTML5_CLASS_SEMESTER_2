// Get file path from URL
const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');

let originalContent = '';
let isDirty = false;

// Initialize editor
document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('editor');
  const saveBtn = document.getElementById('saveBtn');
  const closeBtn = document.getElementById('closeBtn');
  const status = document.getElementById('status');
  const fileName = document.getElementById('fileName');
  
  if (!filePath) {
    status.textContent = 'Error: No file specified';
    status.className = 'status error';
    editor.disabled = true;
    return;
  }
  
  fileName.textContent = filePath.split('/').pop();
  originalContent = editor.value;
  
  // Load file content
  loadFile(filePath);
  
  // Track changes
  editor.addEventListener('input', () => {
    isDirty = editor.value !== originalContent;
    updateStatus();
  });
  
  // Save on Ctrl+S
  editor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
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
          editor.value = data.content;
          originalContent = data.content;
          isDirty = false;
          updateStatus();
          // Apply syntax highlighting
          applySyntaxHighlighting(editor, path);
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
    const content = editor.value;
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
  
  function applySyntaxHighlighting(textarea, filePath) {
    // Basic syntax highlighting using a simple approach
    // For better highlighting, consider using a library like Prism.js or highlight.js
    const ext = filePath.split('.').pop().toLowerCase();
    const language = getLanguage(ext);
    
    // This is a simplified version - for production, use a proper syntax highlighter
    textarea.style.color = '#d4d4d4';
  }
  
  function getLanguage(ext) {
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
      'sh': 'bash',
      'bat': 'batch',
      'ps1': 'powershell',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return languages[ext] || 'text';
  }
});
