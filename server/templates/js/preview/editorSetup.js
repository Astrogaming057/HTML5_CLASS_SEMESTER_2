window.PreviewEditorSetup = (function() {
  return {
    createEditor(editorContainer, language, previewSettings) {
      return monaco.editor.create(editorContainer, {
        value: '',
        language: language,
        theme: previewSettings.editorTheme,
        fontSize: previewSettings.editorFontSize,
        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
        lineNumbers: previewSettings.editorLineNumbers ? 'on' : 'off',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        cursorStyle: 'line',
        automaticLayout: true,
        minimap: {
          enabled: true
        },
        wordWrap: previewSettings.editorWordWrap ? 'on' : 'off',
        formatOnPaste: true,
        formatOnType: true,
        tabSize: previewSettings.editorTabSize,
        insertSpaces: true,
        detectIndentation: true,
        renderWhitespace: 'selection',
        renderLineHighlight: 'all',
        bracketPairColorization: {
          enabled: true
        }
      });
    },

    setupEditorListeners(editor, getFilePath, syncChannel, originalContent, isDirty, updateStatus, updatePreview, saveToEditorTimeout, isApplyingExternalChange) {
      editor.onDidChangeModelContent(() => {
        if (isApplyingExternalChange && isApplyingExternalChange.current) {
          return;
        }
        
        const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
        syncChannel.postMessage({
          type: 'editor-content',
          filePath: filePath,
          content: editor.getValue(),
          isDirty: editor.getValue() !== originalContent.current
        });
        
        const position = editor.getPosition();
        if (position) {
          syncChannel.postMessage({
            type: 'editor-cursor',
            filePath: filePath,
            position: position
          });
        }
        
        const currentContent = editor.getValue();
        isDirty.current = currentContent !== originalContent.current;
        updateStatus();
        updatePreview(currentContent);
        
        if (saveToEditorTimeout.current) {
          clearTimeout(saveToEditorTimeout.current);
        }
        saveToEditorTimeout.current = setTimeout(() => {
          if (!filePath) {
            console.error('Cannot save to ide_editor_cache folder: filePath is not set');
            return;
          }
          
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
        const saveFile = window.__previewSaveFile;
        if (saveFile) {
          saveFile();
        }
      });
    }
  };
})();
