window.PreviewSyncChannel = (function() {
  return {
    setupSyncChannel(syncChannel, filePath, editor, originalContent, isDirty, updateStatus, previewFrame, handleTerminalCommand, editorPanel, previewPanel, updatePreviewVisibility, updateTerminalVisibility) {
      syncChannel.addEventListener('message', (event) => {
        const data = event.data;
        
        if (data.type === 'editor-content' && data.filePath === filePath && editor) {
          const currentValue = editor.getValue();
          if (currentValue !== data.content) {
            const position = editor.getPosition();
            const scrollTop = editor.getScrollTop();
            editor.setValue(data.content);
            originalContent.current = data.content;
            isDirty.current = data.isDirty || false;
            updateStatus();
            if (position) {
              editor.setPosition(position);
              editor.setScrollTop(scrollTop);
            }
          }
        }
        
        if (data.type === 'editor-cursor' && data.filePath === filePath && editor) {
          const pos = data.position;
          if (pos) {
            editor.setPosition(pos);
            editor.revealPositionInCenter(pos);
          }
        }
        
        if (data.type === 'preview-refresh-request') {
          if (previewFrame && previewFrame.style.display !== 'none') {
            previewFrame.src = previewFrame.src;
          }
        }
        
        if (data.type === 'terminal-output') {
          const { tab, output, append } = data;
          let tabName = tab;
          if (tab === 'powershell') {
            tabName = 'PowerShell';
          } else {
            tabName = tab.charAt(0).toUpperCase() + tab.slice(1);
          }
          const outputEl = document.getElementById(`terminal${tabName}Output`);
          if (outputEl) {
            if (append) {
              outputEl.textContent += output;
            } else {
              outputEl.textContent = output;
            }
            outputEl.scrollTop = outputEl.scrollHeight;
          }
        }
        
        if (data.type === 'terminal-clear') {
          const { tab } = data;
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
        }
        
        if (data.type === 'terminal-command') {
          handleTerminalCommand(data.tab, data.command);
        }
        
        if (data.type === 'popout-closed') {
          const terminalPanelEl = document.getElementById('terminalPanel');
          PreviewPopouts.handlePopoutClosed(data.popoutType, editorPanel, previewPanel, terminalPanelEl, updatePreviewVisibility, updateTerminalVisibility);
        }
        
        if (data.type === 'file-changed') {
          // Note: updatePreviewPopout is called directly from switchToFile,
          // so we don't need to call it here to avoid duplicate updates
          // Only update editor popout if needed
              if (PreviewPopouts.getEditorPopout() && !PreviewPopouts.getEditorPopout().closed) {
                // Note: We don't have access to previewSettings here, so the popout will need to get it from localStorage
                PreviewPopouts.updateEditorPopout(data.filePath, () => {
                  try {
                    const saved = localStorage.getItem('previewSettings');
                    return saved ? JSON.parse(saved) : { pageTheme: 'dark', customThemeCSS: '' };
                  } catch (e) {
                    return { pageTheme: 'dark', customThemeCSS: '' };
                  }
                });
              }
        }
      });
    }
  };
})();
