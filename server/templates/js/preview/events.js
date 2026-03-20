window.PreviewEvents = (function() {
  return {
    setupKeyboardShortcuts(toggleFileExplorer, togglePreviewPanel, openFileSearch, openGlobalSearch, openHelpMenu, toggleTerminal, closeCurrentTab, switchToNextTab, switchToPrevTab, createNewFile, createNewFolder, openGitPanel, openSettings) {
      document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs/editors (except for some special cases)
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isContentEditable = target.isContentEditable;
        const isMonacoEditor = target.closest('.monaco-editor') !== null;
        
        // Allow shortcuts in Monaco editor for editor-specific commands
        const allowInEditor = isMonacoEditor && (
          (e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'Tab' || e.key === 'n' || e.key === 'k')
        );
        
        if (isInput && !allowInEditor) {
          return; // Don't trigger shortcuts when typing in regular inputs
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          e.stopPropagation();
          toggleFileExplorer();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
          // Ctrl+Shift+F for global search
          e.preventDefault();
          e.stopPropagation();
          if (openGlobalSearch && typeof openGlobalSearch === 'function') {
            openGlobalSearch();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !isInput) {
          // Ctrl+P for file search (only if not in input)
          e.preventDefault();
          e.stopPropagation();
          if (openFileSearch && typeof openFileSearch === 'function') {
            openFileSearch();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === '?') {
          // Ctrl+? for help menu
          e.preventDefault();
          e.stopPropagation();
          if (openHelpMenu && typeof openHelpMenu === 'function') {
            openHelpMenu();
          }
        } else if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
          // Ctrl+` for toggle terminal
          e.preventDefault();
          e.stopPropagation();
          if (toggleTerminal && typeof toggleTerminal === 'function') {
            toggleTerminal();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
          // Ctrl+Shift+V for toggle preview panel
          e.preventDefault();
          e.stopPropagation();
          togglePreviewPanel();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
          // Ctrl+Shift+E for focus file explorer
          e.preventDefault();
          e.stopPropagation();
          toggleFileExplorer();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'w' && !isContentEditable) {
          // Ctrl+W for close current tab
          e.preventDefault();
          e.stopPropagation();
          if (closeCurrentTab && typeof closeCurrentTab === 'function') {
            closeCurrentTab();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !isInput && !isContentEditable) {
          // Ctrl+Tab for next tab, Ctrl+Shift+Tab for previous tab
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            if (switchToPrevTab && typeof switchToPrevTab === 'function') {
              switchToPrevTab();
            }
          } else {
            if (switchToNextTab && typeof switchToNextTab === 'function') {
              switchToNextTab();
            }
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isInput && !isContentEditable) {
          // Ctrl+N for new file
          e.preventDefault();
          e.stopPropagation();
          if (createNewFile && typeof createNewFile === 'function') {
            createNewFile();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
          // Ctrl+Shift+N for new folder
          e.preventDefault();
          e.stopPropagation();
          if (createNewFolder && typeof createNewFolder === 'function') {
            createNewFolder();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
          // Ctrl+Shift+G for Git panel
          e.preventDefault();
          e.stopPropagation();
          if (openGitPanel && typeof openGitPanel === 'function') {
            openGitPanel();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
          // Ctrl+, for settings
          e.preventDefault();
          e.stopPropagation();
          if (openSettings && typeof openSettings === 'function') {
            openSettings();
          }
        } else if (e.key === 'F1') {
          // F1 for help menu
          e.preventDefault();
          e.stopPropagation();
          if (openHelpMenu && typeof openHelpMenu === 'function') {
            openHelpMenu();
          }
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
          const filePathGetter = window.__previewFilePath;
          const filePath = typeof filePathGetter === 'function' ? filePathGetter() : filePathGetter;
          if (filePath && typeof filePath === 'string') {
            const dirPath = filePath.split('/').slice(0, -1).join('/') || '';
            // Construct proper URL using current origin to ensure correct protocol and host
            const targetPath = dirPath ? '/' + dirPath + '/' : '/';
            try {
              const url = new URL(targetPath, window.location.origin);
              window.location.href = url.href;
            } catch (e) {
              // Fallback to relative path if URL construction fails
            window.location.href = targetPath;
            }
          } else {
            // No file open, go to root
            window.location.href = '/';
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
        if (window.__appClosing) {
          return;
        }
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
