window.PreviewState = (function() {
  return {
    saveState(isRestoringState, filePath, currentDir, fileExplorerPanel, previewPanel, editorPanel, terminalAtBottom) {
      if (isRestoringState) {
        console.log('saveState() called during restoration - skipping');
        return;
      }
      
      const terminalPanel = document.getElementById('terminalPanel');
      
      const explorerCollapsed = fileExplorerPanel.classList.contains('collapsed');
      const previewPopout = PreviewPopouts.getPreviewPopout();
      const isPreviewPoppedOut = previewPopout && !previewPopout.closed;
      const previewCollapsed = isPreviewPoppedOut || previewPanel.classList.contains('collapsed');
      const terminalCollapsed = terminalPanel ? terminalPanel.classList.contains('collapsed') : false;
      
      console.log('=== SAVING STATE ===');
      console.log('Explorer collapsed:', explorerCollapsed);
      console.log('Preview collapsed:', previewCollapsed);
      console.log('Terminal collapsed:', terminalCollapsed);
      
      const state = {
        filePath: filePath,
        currentDir: currentDir,
        explorerCollapsed: explorerCollapsed,
        previewCollapsed: previewCollapsed,
        terminalCollapsed: terminalCollapsed,
        terminalHeight: terminalPanel ? (terminalPanel.style.height || '200px') : '200px',
        terminalAtBottom: terminalAtBottom,
        explorerWidth: fileExplorerPanel.style.width || '250px',
        editorWidth: editorPanel.style.width || '',
        previewWidth: previewPanel.style.width || '',
        activeTerminalTab: document.querySelector('.terminal-tab.active')?.dataset.tab || 'client'
      };
      
      console.log('Saving state object:', state);
      
      try {
        localStorage.setItem('previewState', JSON.stringify(state));
        console.log('State saved successfully');
      } catch (err) {
        console.error('Error saving state:', err);
      }
    },

    restoreState(forceLoad, filePath, currentDir, previewSettings, fileExplorerPanel, toggleExplorer, previewPanel, togglePreview, editorPanel, terminalPanel, fileName, loadFileTree, loadFile, updateExplorerVisibility, updatePreviewVisibility, updateTerminalVisibility, moveTerminalToBottomPosition, moveTerminalToExplorerPosition) {
      try {
        const savedState = localStorage.getItem('previewState');
        if (!savedState) {
          console.log('No saved state found - initializing with defaults');
          
          if (!previewSettings.defaultExplorerVisible) {
            fileExplorerPanel.classList.add('collapsed');
            toggleExplorer.textContent = '▶';
          }
          if (!previewSettings.defaultTerminalVisible && terminalPanel) {
            terminalPanel.classList.add('collapsed');
            const toggleTerminal = document.getElementById('toggleTerminal');
            if (toggleTerminal) {
              toggleTerminal.textContent = '+';
            }
          }
          
          updateExplorerVisibility();
          updatePreviewVisibility();
          if (terminalPanel) {
            updateTerminalVisibility();
          }
          return { filePath, currentDir };
        }
        
        const state = JSON.parse(savedState);
        console.log('Restoring state:', state);
        
        const resizerTerminal = document.getElementById('resizerTerminal');
        const toggleTerminal = document.getElementById('toggleTerminal');
        
        let restoredFilePath = filePath;
        let restoredCurrentDir = currentDir;
        
        if (!forceLoad && state.filePath && state.filePath !== filePath) {
          console.log('Switching to saved file:', state.filePath);
          restoredFilePath = state.filePath;
          fileName.textContent = state.filePath.split('/').pop();
          const newDir = state.filePath.split('/').slice(0, -1).join('/') || '';
          if (newDir !== currentDir) {
            restoredCurrentDir = newDir;
            loadFileTree(restoredCurrentDir);
          }
          loadFile(state.filePath);
          const newUrl = '/__preview__?file=' + encodeURIComponent(state.filePath);
          window.history.replaceState({ file: state.filePath }, '', newUrl);
        } else if (forceLoad) {
          console.log('Force load: using file from URL, not restoring saved file');
        }
        
        if (state.explorerCollapsed !== undefined) {
          console.log('=== RESTORING EXPLORER STATE ===');
          fileExplorerPanel.classList.remove('collapsed');
          
          if (state.explorerCollapsed) {
            fileExplorerPanel.classList.add('collapsed');
            toggleExplorer.textContent = '▶';
          } else {
            fileExplorerPanel.classList.remove('collapsed');
            toggleExplorer.textContent = '◀';
          }
          
          updateExplorerVisibility();
          
          requestAnimationFrame(() => {
            const height = fileExplorerPanel.offsetHeight;
            const width = window.getComputedStyle(fileExplorerPanel).width;
            console.log('Explorer panel offsetHeight:', height);
            console.log('Explorer panel computed width:', width);
            console.log('Explorer panel final collapsed state:', fileExplorerPanel.classList.contains('collapsed'));
          });
        }
        if (state.explorerWidth) {
          console.log('Restoring explorer width:', state.explorerWidth);
          fileExplorerPanel.style.width = state.explorerWidth;
        }
        
        if (state.previewCollapsed !== undefined) {
          console.log('=== RESTORING PREVIEW STATE ===');
          const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
          
          if (isPreviewPoppedOut) {
            PreviewPopouts.enforcePreviewCollapsed(previewPanel);
            togglePreview.textContent = '▶';
          } else {
            if (state.previewCollapsed) {
              previewPanel.classList.add('collapsed');
              togglePreview.textContent = '▶';
            } else {
              previewPanel.classList.remove('collapsed');
              togglePreview.textContent = '◀';
            }
          }
          
          updatePreviewVisibility();
          
          requestAnimationFrame(() => {
            const height = previewPanel.offsetHeight;
            const width = window.getComputedStyle(previewPanel).width;
            console.log('Preview panel offsetHeight:', height);
            console.log('Preview panel computed width:', width);
            console.log('Preview panel final collapsed state:', previewPanel.classList.contains('collapsed'));
          });
        }
        
        if (state.editorWidth) {
          editorPanel.style.width = state.editorWidth;
          editorPanel.style.flex = 'none';
        }
        if (state.previewWidth) {
          previewPanel.style.width = state.previewWidth;
          previewPanel.style.flex = 'none';
        }
        
        if (terminalPanel) {
          if (state.terminalAtBottom !== undefined) {
            console.log('Restoring terminal position:', state.terminalAtBottom ? 'bottom' : 'explorer');
            if (state.terminalAtBottom) {
              moveTerminalToBottomPosition();
            } else {
              moveTerminalToExplorerPosition();
            }
          }
          
          if (state.terminalCollapsed !== undefined) {
            console.log('Restoring terminal collapsed:', state.terminalCollapsed);
            if (state.terminalCollapsed) {
              terminalPanel.classList.add('collapsed');
            } else {
              terminalPanel.classList.remove('collapsed');
              if (state.terminalHeight) {
                console.log('Restoring terminal height:', state.terminalHeight);
                terminalPanel.style.height = state.terminalHeight;
              }
            }
            updateTerminalVisibility();
            terminalPanel.offsetHeight;
          } else if (state.terminalHeight) {
            console.log('Restoring terminal height (no collapsed state):', state.terminalHeight);
            terminalPanel.style.height = state.terminalHeight;
          }
        }
        
        if (state.activeTerminalTab) {
          console.log('Restoring active terminal tab:', state.activeTerminalTab);
          setTimeout(() => {
            const tab = document.querySelector(`.terminal-tab[data-tab="${state.activeTerminalTab}"]`);
            if (tab) {
              console.log('Switching to terminal tab:', tab);
              const tabName = tab.dataset.tab;
              const tabs = document.querySelectorAll('.terminal-tab');
              const tabContents = document.querySelectorAll('.terminal-tab-content');
              
              tabs.forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
              
              tabContents.forEach(content => {
                content.classList.remove('active');
                let expectedId;
                if (tabName === 'powershell') {
                  expectedId = 'terminalPowerShell';
                } else if (tabName === 'client') {
                  expectedId = 'terminalClient';
                } else if (tabName === 'server') {
                  expectedId = 'terminalServer';
                } else if (tabName === 'log') {
                  expectedId = 'terminalLog';
                }
                
                if (content.id === expectedId) {
                  content.classList.add('active');
                  const input = content.querySelector('.terminal-input');
                  if (input) {
                    input.disabled = false;
                    input.style.pointerEvents = 'auto';
                    input.style.display = 'block';
                    setTimeout(() => {
                      input.focus();
                    }, 100);
                  }
                } else {
                  content.style.display = 'none';
                }
              });
            } else {
              console.warn('Terminal tab not found:', state.activeTerminalTab);
            }
          }, 300);
        }
        
        if (state.currentDir && state.currentDir !== restoredCurrentDir) {
          console.log('Restoring directory:', state.currentDir);
          restoredCurrentDir = state.currentDir;
          const fileTree = document.getElementById('fileTree');
          if (fileTree && fileTree.innerHTML !== '<div class="file-tree-loading">Loading...</div>') {
            loadFileTree(restoredCurrentDir);
          }
        }
        
        console.log('State restored successfully');
        console.log('Current directory after restore:', restoredCurrentDir);
        console.log('Explorer collapsed:', fileExplorerPanel.classList.contains('collapsed'));
        console.log('Preview collapsed:', previewPanel.classList.contains('collapsed'));
        console.log('Terminal collapsed:', terminalPanel ? terminalPanel.classList.contains('collapsed') : 'N/A');
        
        return { filePath: restoredFilePath, currentDir: restoredCurrentDir };
      } catch (err) {
        console.error('Error restoring state:', err);
        return { filePath, currentDir };
      }
    },

    resetSettings(fileExplorerPanel, toggleExplorer, previewPanel, togglePreview, editorPanel, terminalPanel, updateExplorerVisibility, updatePreviewVisibility, updateTerminalVisibility, status) {
      localStorage.removeItem('previewState');
      localStorage.removeItem('fileExplorerSettings');
      
      fileExplorerPanel.classList.remove('collapsed');
      fileExplorerPanel.style.width = '250px';
      fileExplorerPanel.style.maxWidth = '';
      fileExplorerPanel.style.flex = '';
      toggleExplorer.textContent = '◀';
      
      editorPanel.style.width = '';
      editorPanel.style.flex = '';
      editorPanel.style.minWidth = '';
      editorPanel.style.maxWidth = '';
      
      const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();

      if (!isPreviewPoppedOut) {
        previewPanel.classList.remove('collapsed');
        previewPanel.style.width = '';
        previewPanel.style.flex = '';
        previewPanel.style.minWidth = '';
        previewPanel.style.maxWidth = '';
        togglePreview.textContent = '◀';
      } else {
        PreviewPopouts.enforcePreviewCollapsed(previewPanel);
        togglePreview.textContent = '▶';
      }
      
      if (terminalPanel) {
        terminalPanel.classList.remove('collapsed');
        terminalPanel.style.height = '200px';
        
        const tabs = document.querySelectorAll('.terminal-tab');
        const tabContents = document.querySelectorAll('.terminal-tab-content');
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });
        const clientTab = document.querySelector('.terminal-tab[data-tab="client"]');
        const clientContent = document.getElementById('terminalClient');
        if (clientTab && clientContent) {
          clientTab.classList.add('active');
          clientContent.classList.add('active');
          clientContent.style.display = 'flex';
        }
      }
      
      updateExplorerVisibility();
      updatePreviewVisibility();
      if (terminalPanel) {
        updateTerminalVisibility();
      }
      
      status.textContent = 'Settings reset';
      status.className = 'status saved';
      setTimeout(() => {
        status.textContent = 'Ready';
        status.className = 'status';
      }, 2000);
      
      console.log('Settings reset to defaults');
    }
  };
})();
