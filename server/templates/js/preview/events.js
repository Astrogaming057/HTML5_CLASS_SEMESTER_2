window.PreviewEvents = (function() {
  return {
    setupKeyboardShortcuts(toggleFileExplorer, togglePreviewPanel) {
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          toggleFileExplorer();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
          e.preventDefault();
          togglePreviewPanel();
        }
      });
    },

    setupButtonHandlers(saveBtn, refreshBtn, closeBtn, backToFilesBtn, updatePreview, filePath, customConfirm, isDirty, openPreviewPopout, openTerminalPopout, togglePreviewPanel) {
      saveBtn.addEventListener('click', () => {
        const saveFile = window.__previewSaveFile;
        if (saveFile) {
          saveFile();
        }
      });
      
      refreshBtn.addEventListener('click', () => {
        const editor = window.__previewEditor;
        if (editor) {
          const updatePreviewFn = window.__previewUpdatePreview;
          if (updatePreviewFn) {
            updatePreviewFn(editor.getValue());
          }
        }
        const syncChannel = window.__previewSyncChannel;
        if (syncChannel) {
          syncChannel.postMessage({
            type: 'preview-refresh'
          });
        }
      });
      
      if (backToFilesBtn) {
        backToFilesBtn.addEventListener('click', () => {
          const filePath = window.__previewFilePath;
          if (filePath) {
            const dirPath = filePath.split('/').slice(0, -1).join('/') || '';
            const targetPath = dirPath ? '/' + dirPath + '/' : '/';
            window.location.href = targetPath;
          }
        });
      }
      
      closeBtn.addEventListener('click', async () => {
        const isDirty = window.__previewIsDirty;
        const customConfirm = window.__previewCustomConfirm;
        if (isDirty && isDirty.current) {
          const confirmed = await customConfirm('You have unsaved changes. Are you sure you want to close?');
          if (!confirmed) {
            return;
          }
        }
        window.close();
      });
      
      const popoutPreviewBtn = document.getElementById('popoutPreview');
      const popoutTerminalBtn = document.getElementById('popoutTerminal');
      
      if (popoutPreviewBtn) {
        popoutPreviewBtn.addEventListener('click', (e) => {
          console.log('Preview popout clicked');
          openPreviewPopout();
          togglePreviewPanel();
        });
      }
      
      if (popoutTerminalBtn) {
        popoutTerminalBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Terminal popout clicked');
          openTerminalPopout();
        });
      }
    },

    setupPanelToggleHandlers(toggleExplorer, togglePreview, toggleFileExplorer, togglePreviewPanel) {
      toggleExplorer.addEventListener('click', () => {
        toggleFileExplorer();
      });
      
      togglePreview.addEventListener('click', () => {
        togglePreviewPanel();
      });
    },

    setupReopenHandlers(reopenExplorerBtn, fileExplorerPanel, updateExplorerVisibility, saveState, reopenPreviewBtn, previewPanel, updatePreviewVisibility, togglePreview, refreshPreview) {
      if (reopenExplorerBtn && fileExplorerPanel) {
        reopenExplorerBtn.addEventListener('click', () => {
          fileExplorerPanel.classList.remove('collapsed');
          updateExplorerVisibility();
          saveState();
        });
      }
      
      if (reopenPreviewBtn && previewPanel) {
        reopenPreviewBtn.addEventListener('click', () => {
          const previewPopout = PreviewPopouts.getPreviewPopout();
          const isPreviewPoppedOut = previewPopout && !previewPopout.closed;
          
          if (!isPreviewPoppedOut) {
            previewPanel.classList.remove('collapsed');
            const previewFrame = document.getElementById('previewFrame');
            if (previewFrame) {
              previewFrame.style.display = 'block';
            }
            updatePreviewVisibility();
            togglePreview.textContent = '◀';
            if (refreshPreview) {
              refreshPreview();
            }
            saveState();
          }
        });
      }
    },

    setupBackButton(backBtn, goBackFolder) {
      backBtn.addEventListener('click', () => {
        goBackFolder();
      });
    },

    setupBeforeUnload(isDirty, ws, saveState) {
      window.addEventListener('beforeunload', (e) => {
        if (isDirty && isDirty.current) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
      
      window.addEventListener('beforeunload', () => {
        saveState();
        if (ws && ws.current) {
          ws.current.close();
        }
      });
      
      setInterval(saveState, 5000);
    },

    setupPopstate(filePathRef, fileName, currentDirRef, loadFileTree, updateActiveFileTreeItem, loadFile, saveState) {
      window.addEventListener('popstate', (e) => {
        if (e.state && e.state.file) {
          const newPath = e.state.file;
          if (newPath !== filePathRef.current) {
            filePathRef.current = newPath;
            fileName.textContent = newPath.split('/').pop();
            const newDir = newPath.split('/').slice(0, -1).join('/') || '';
            if (newDir !== currentDirRef.currentDir) {
              currentDirRef.currentDir = newDir;
              loadFileTree(newDir);
            } else {
              updateActiveFileTreeItem(newPath);
            }
            loadFile(newPath);
            saveState();
          }
        }
      });
    }
  };
})();
