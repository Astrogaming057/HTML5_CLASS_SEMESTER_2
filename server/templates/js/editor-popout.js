const urlParams = new URLSearchParams(window.location.search);
const filePath = urlParams.get('file');
const originalUrl = urlParams.get('original');
const theme = urlParams.get('theme') || 'dark';
const customCSS = urlParams.get('customCSS') ? atob(urlParams.get('customCSS')) : '';

let editor = null;
let originalContent = '';
let isDirty = false;

const channel = new BroadcastChannel('preview-sync');

// Load theme
async function loadTheme(themeName, customCSS) {
  const themeStyle = document.getElementById('theme-style');
  if (!themeStyle) return;
  
  try {
    if (themeName === 'custom' && customCSS) {
      themeStyle.textContent = customCSS;
    } else {
      const response = await fetch(`/__api__/theme?name=${encodeURIComponent(themeName)}`);
      if (response.ok) {
        const themeCss = await response.text();
        themeStyle.textContent = themeCss;
      }
    }
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

// Load theme on page load
loadTheme(theme, customCSS);

// Listen for theme changes
channel.addEventListener('message', (event) => {
  if (event.data.type === 'file-changed' && event.data.theme) {
    loadTheme(event.data.theme, event.data.customCSS);
  } else if (event.data.type === 'theme-changed') {
    loadTheme(event.data.theme, event.data.customCSS);
  }
});

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
        wordWrap: 'on',
        folding: true,
        foldingStrategy: 'auto',
        foldingHighlight: true,
        showFoldingControls: 'always'
      });
      
             channel.addEventListener('message', (event) => {
               if (event.data.type === 'theme-changed') {
                 // Update theme when it changes in the main window
                 try {
                   const saved = localStorage.getItem('previewSettings');
                   const settings = saved ? JSON.parse(saved) : {};
                   settings.pageTheme = event.data.theme || 'dark';
                   if (event.data.customCSS) {
                     settings.customThemeCSS = event.data.customCSS;
                   }
                   localStorage.setItem('previewSettings', JSON.stringify(settings));
                   
                   const newThemeInfo = getTheme();
                   // Update Monaco editor theme
                   if (newThemeInfo.theme === 'custom' && newThemeInfo.customCSS) {
                     monaco.editor.defineTheme('customTheme', {
                       base: 'vs-dark',
                       inherit: true,
                       rules: [],
                       colors: {}
                     });
                     monaco.editor.setTheme('customTheme');
                   } else if (newThemeInfo.theme === 'dark') {
                     monaco.editor.setTheme('vs-dark');
                   } else if (newThemeInfo.theme === 'light') {
                     monaco.editor.setTheme('vs-light');
                   } else if (monaco.editor.BuiltinTheme && monaco.editor.BuiltinTheme.hasOwnProperty(newThemeInfo.theme)) {
                     monaco.editor.setTheme(newThemeInfo.theme);
                   }
                   
                   // Update overall popout theme via injected CSS
                   const themeStyle = document.getElementById('theme-style');
                   if (themeStyle) {
                     if (newThemeInfo.theme === 'custom' && newThemeInfo.customCSS) {
                       themeStyle.textContent = newThemeInfo.customCSS;
                     } else {
                       fetch(`/__api__/theme?name=${encodeURIComponent(newThemeInfo.theme)}`)
                         .then(res => res.text())
                         .then(css => {
                           if (themeStyle) themeStyle.textContent = css;
                         })
                         .catch(err => console.error('Error loading theme:', err));
                     }
                   }
                 } catch (e) {
                   console.error('Error updating theme in editor popout:', e);
                 }
               } else if (event.data.type === 'editor-content' && event.data.filePath === filePath) {
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
        readOnly: true,
        folding: true,
        foldingStrategy: 'auto',
        showFoldingControls: 'always'
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
