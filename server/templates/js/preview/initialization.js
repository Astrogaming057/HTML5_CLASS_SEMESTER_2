window.PreviewInitialization = (function() {
  return {
    initializeState(filePath, forceLoad, currentDirRef) {
      if (!filePath) {
        return { error: 'No file specified' };
      }
      
      currentDirRef.currentDir = filePath.split('/').slice(0, -1).join('/') || '';
      
      if (!forceLoad) {
        const savedState = localStorage.getItem('previewState');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            if (state.currentDir && state.currentDir !== currentDirRef.currentDir) {
              currentDirRef.currentDir = state.currentDir;
              console.log('Restored directory from state:', currentDirRef.currentDir);
            }
          } catch (err) {
            console.error('Error parsing saved state:', err);
          }
        }
      } else {
        console.log('Force load mode: skipping state restoration');
      }
      
      return { success: true };
    },

    initializeVisibility(resizerEditor, previewPanel) {
      if (resizerEditor && previewPanel) {
        if (previewPanel.classList.contains('collapsed')) {
          resizerEditor.style.display = 'none';
        }
      }
    },

    restoreOrLoadFile(forceLoad, filePath, loadFile, updateExplorerVisibility, updatePreviewVisibility, updateTerminalVisibility, restoreState, terminalPanel, isRestoringStateRef) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (forceLoad) {
            console.log('Force load: loading file directly without state restoration');
            loadFile(filePath);
            updateExplorerVisibility();
            updatePreviewVisibility();
            if (terminalPanel) {
              updateTerminalVisibility();
            }
          } else {
            restoreState();
            updateExplorerVisibility();
            updatePreviewVisibility();
            if (terminalPanel) {
              updateTerminalVisibility();
            }
          }
          isRestoringStateRef.current = false;
          console.log('State restoration complete - saving enabled');
        }, 300);
      });
    }
  };
})();
