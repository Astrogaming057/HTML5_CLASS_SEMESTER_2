const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');
const originalUrl = urlParams.get('original');

let editor = null;
let originalContent = '';
let isDirty = false;

const channel = new BroadcastChannel('preview-sync');

function getLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = {
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
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sql': 'sql',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml'
  };
  return langMap[ext] || 'plaintext';
}

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
  const editorContainer = document.getElementById('editor');
  const language = getLanguage(filePath);
  
  fetch(`/__api__/files?path=${encodeURIComponent(filePath)}`)
    .then(res => res.json())
    .then(data => {
      originalContent = data.content || '';
      
      editor = monaco.editor.create(editorContainer, {
        value: originalContent,
        language: language,
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: true },
        wordWrap: 'on'
      });
      
      channel.addEventListener('message', (event) => {
        if (event.data.type === 'editor-content' && event.data.filePath === filePath) {
          const currentValue = editor.getValue();
          if (currentValue !== event.data.content) {
            const position = editor.getPosition();
            const scrollTop = editor.getScrollTop();
            editor.setValue(event.data.content);
            originalContent = event.data.content;
            isDirty = event.data.isDirty || false;
            if (position) {
              editor.setPosition(position);
              editor.setScrollTop(scrollTop);
            }
          }
        } else if (event.data.type === 'editor-cursor' && event.data.filePath === filePath) {
          const pos = event.data.position;
          if (pos) {
            editor.setPosition(pos);
            editor.revealPositionInCenter(pos);
          }
        }
      });
      
      let changeTimeout = null;
      editor.onDidChangeModelContent(() => {
        isDirty = editor.getValue() !== originalContent;
        
        if (changeTimeout) clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => {
          channel.postMessage({
            type: 'editor-content',
            filePath: filePath,
            content: editor.getValue(),
            isDirty: isDirty
          });
        }, 100);
      });
      
      editor.onDidChangeCursorPosition((e) => {
        channel.postMessage({
          type: 'editor-cursor',
          filePath: filePath,
          position: e.position
        });
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveFile();
      });
    })
    .catch(err => {
      console.error('Error loading file:', err);
      editor = monaco.editor.create(editorContainer, {
        value: 'Error loading file',
        language: 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        readOnly: true
      });
    });
});

function saveFile() {
  if (!editor || !filePath) return;
  
  const content = editor.getValue();
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
      channel.postMessage({
        type: 'editor-content',
        filePath: filePath,
        content: content,
        isDirty: false
      });
    }
  })
  .catch(err => {
    console.error('Error saving file:', err);
  });
}

document.getElementById('closePopout').addEventListener('click', () => {
  window.close();
});

window.addEventListener('beforeunload', () => {
  channel.postMessage({
    type: 'popout-closed',
    popoutType: 'editor'
  });
});
