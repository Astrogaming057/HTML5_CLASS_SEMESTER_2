window.PreviewUI = (function() {
  const MIN_EDITOR_WIDTH = 200;
  const MIN_PREVIEW_WIDTH = 200;

  return {
    toggleFileExplorer(fileExplorerPanel, toggleExplorer, updateExplorerVisibility, updateBackButton, saveState) {
      const isCollapsed = fileExplorerPanel.classList.contains('collapsed');
      console.log('toggleFileExplorer called, current state:', isCollapsed);
      fileExplorerPanel.classList.toggle('collapsed');
      const newState = fileExplorerPanel.classList.contains('collapsed');
      console.log('toggleFileExplorer new state:', newState);
      toggleExplorer.textContent = newState ? '▶' : '◀';
      updateExplorerVisibility();
      updateBackButton();
      saveState();
    },

    updateExplorerVisibility(fileExplorerPanel) {
      const isCollapsed = fileExplorerPanel.classList.contains('collapsed');
      const explorerReopenBar = document.getElementById('explorerReopenBar');
      const resizerExplorer = document.getElementById('resizerExplorer');
      
      console.log('updateExplorerVisibility, collapsed:', isCollapsed);
      
      if (explorerReopenBar) {
        explorerReopenBar.style.display = isCollapsed ? 'flex' : 'none';
        console.log('Explorer reopen bar display:', explorerReopenBar.style.display);
      }
      
      if (resizerExplorer) {
        resizerExplorer.style.display = isCollapsed ? 'none' : 'block';
      }
    },

    togglePreviewPanel(previewPanel, togglePreview, updatePreviewVisibility, saveState, refreshPreview) {
      const isCollapsed = previewPanel.classList.contains('collapsed');
      previewPanel.classList.toggle('collapsed');
      const newState = previewPanel.classList.contains('collapsed');
      
      // If opening the preview (was collapsed, now not collapsed), show the frame
      if (isCollapsed && !newState) {
        const previewFrame = document.getElementById('previewFrame');
        if (previewFrame) {
          previewFrame.style.display = 'block';
        }
        if (refreshPreview) {
          refreshPreview();
        }
      }
      
      updatePreviewVisibility();
      togglePreview.textContent = newState ? '▶' : '◀';
      
      saveState();
    },

    updatePreviewVisibility(previewPanel, editorPanel, resizerEditor) {
      const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
      
      if (isPreviewPoppedOut) {
        PreviewPopouts.enforcePreviewCollapsed(previewPanel);
      }
      
      const isCollapsed = previewPanel.classList.contains('collapsed');
      const previewReopenBar = document.getElementById('previewReopenBar');
      const container = document.querySelector('.preview-container');
      
      if (resizerEditor) {
        resizerEditor.style.display = isCollapsed ? 'none' : 'block';
      }
      
      if (previewReopenBar) {
        previewReopenBar.style.display = isCollapsed ? 'flex' : 'none';
      }
      
      if (container) {
        if (isCollapsed) {
          container.classList.add('preview-collapsed');
        } else {
          container.classList.remove('preview-collapsed');
        }
      }
      
      if (isCollapsed) {
        const currentWidth = editorPanel.style.width;
        if (currentWidth && currentWidth !== '') {
          editorPanel.dataset.previousWidth = currentWidth;
        }
        editorPanel.style.flex = '1 1 auto';
        editorPanel.style.minWidth = MIN_EDITOR_WIDTH + 'px';
        editorPanel.style.width = '';
      } else {
        if (editorPanel.dataset.previousWidth) {
          editorPanel.style.width = editorPanel.dataset.previousWidth;
          editorPanel.style.flex = 'none';
          delete editorPanel.dataset.previousWidth;
        } else if (!editorPanel.style.width || editorPanel.style.width === '') {
          editorPanel.style.flex = '1 1 auto';
        }
      }
    },

    updateTerminalVisibility(terminalPanel, toggleTerminal, resizerTerminal, terminalReopenBar) {
      if (!terminalPanel) return;
      const isCollapsed = terminalPanel.classList.contains('collapsed');
      
      if (toggleTerminal) {
        toggleTerminal.textContent = isCollapsed ? '+' : '−';
      }
      
      if (resizerTerminal) {
        resizerTerminal.style.display = isCollapsed ? 'none' : 'block';
      }
      
      if (terminalReopenBar) {
        terminalReopenBar.style.display = isCollapsed ? 'flex' : 'none';
      }
    },

    updateTerminalPositionButtons(moveTerminalToBottom, moveTerminalToExplorer, terminalAtBottom) {
      if (moveTerminalToBottom) {
        moveTerminalToBottom.style.display = terminalAtBottom ? 'none' : 'inline-block';
      }
      if (moveTerminalToExplorer) {
        moveTerminalToExplorer.style.display = terminalAtBottom ? 'inline-block' : 'none';
      }
    },

    moveTerminalToBottomPosition(terminalPanel, container, fileExplorerPanel, terminalReopenBar, updateTerminalPositionButtons, saveState) {
      if (!terminalPanel || !container || !fileExplorerPanel) return;
      
      const fileTree = document.getElementById('fileTree');
      if (fileTree && terminalPanel.parentNode === fileExplorerPanel) {
        fileExplorerPanel.removeChild(terminalPanel);
      }
      
      let mainContentWrapper = container.querySelector('.main-content-wrapper');
      if (!mainContentWrapper) {
        mainContentWrapper = document.createElement('div');
        mainContentWrapper.className = 'main-content-wrapper';
        
        const children = Array.from(container.children);
        children.forEach(child => {
          if (child !== terminalPanel && 
              !child.classList.contains('main-content-wrapper')) {
            mainContentWrapper.appendChild(child);
          }
        });
        
        container.appendChild(mainContentWrapper);
      }
      
      container.appendChild(terminalPanel);
      
      terminalPanel.classList.add('at-bottom');
      container.classList.add('terminal-at-bottom');
      
      updateTerminalPositionButtons(true);
      saveState();
      
      return true;
    },

    moveTerminalToExplorerPosition(terminalPanel, container, fileExplorerPanel, terminalReopenBar, updateTerminalPositionButtons, saveState) {
      if (!terminalPanel || !container || !fileExplorerPanel) return;
      
      const mainContentWrapper = container.querySelector('.main-content-wrapper');
      if (mainContentWrapper) {
        const children = Array.from(mainContentWrapper.children);
        children.forEach(child => {
          container.insertBefore(child, mainContentWrapper);
        });
        container.removeChild(mainContentWrapper);
      }
      
      if (terminalPanel.parentNode === container) {
        container.removeChild(terminalPanel);
      }
      
      const fileTree = document.getElementById('fileTree');
      if (fileTree) {
        fileExplorerPanel.insertBefore(terminalReopenBar, fileTree.nextSibling);
        fileExplorerPanel.insertBefore(terminalPanel, terminalReopenBar.nextSibling);
      } else {
        fileExplorerPanel.appendChild(terminalReopenBar);
        fileExplorerPanel.appendChild(terminalPanel);
      }
      
      terminalPanel.classList.remove('at-bottom');
      container.classList.remove('terminal-at-bottom');
      
      updateTerminalPositionButtons(false);
      saveState();
      
      return false;
    },

    updateBackButton(backBtn, currentDir) {
      backBtn.disabled = !currentDir || currentDir === '/';
    },

    goBackFolder(currentDir, loadFileTree, updateBackButton) {
      if (!currentDir || currentDir === '/') return currentDir;
      
      const currentDirStr = typeof currentDir === 'string' ? currentDir : (currentDir.currentDir || '');
      if (!currentDirStr || currentDirStr === '/') return currentDirStr;
      
      const parentDir = currentDirStr.split('/').slice(0, -1).join('/') || '/';
      loadFileTree(parentDir);
      updateBackButton();
      return parentDir;
    }
  };
})();
