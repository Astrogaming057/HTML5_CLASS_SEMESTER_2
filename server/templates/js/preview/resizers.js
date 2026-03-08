window.PreviewResizers = (function() {
  let resizeTimeout = null;
  const RESIZER_WIDTH = 4;
  const MIN_EXPLORER_WIDTH = 150;
  const MIN_EDITOR_WIDTH = 200;
  const MIN_PREVIEW_WIDTH = 200;
  const MIN_TERMINAL_HEIGHT = 100;
  const MAX_TERMINAL_HEIGHT = 500;

  return {
    handleWindowResize(adjustPanelsOnResize) {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        adjustPanelsOnResize();
      }, 100);
    },

    adjustPanelsOnResize(fileExplorerPanel, previewPanel, editorPanel) {
      const container = document.querySelector('.preview-container');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      
      const explorerCollapsed = fileExplorerPanel.classList.contains('collapsed');
      const previewCollapsed = previewPanel.classList.contains('collapsed');
      
      const explorerResizerWidth = explorerCollapsed ? 0 : RESIZER_WIDTH;
      const editorResizerWidth = previewCollapsed ? 0 : RESIZER_WIDTH;
      const availableWidth = containerWidth - explorerResizerWidth - editorResizerWidth;
      
      const currentExplorerWidth = explorerCollapsed ? 0 : fileExplorerPanel.offsetWidth;
      const currentEditorWidth = editorPanel.offsetWidth;
      const currentPreviewWidth = previewCollapsed ? 0 : previewPanel.offsetWidth;
      const totalCurrentWidth = currentExplorerWidth + currentEditorWidth + currentPreviewWidth + explorerResizerWidth + editorResizerWidth;
      
      if (totalCurrentWidth > containerWidth) {
        const scale = (containerWidth - explorerResizerWidth - editorResizerWidth) / (totalCurrentWidth - explorerResizerWidth - editorResizerWidth);
        
        if (!explorerCollapsed && fileExplorerPanel.style.width) {
          const explorerStyleWidth = parseInt(fileExplorerPanel.style.width) || currentExplorerWidth;
          const newExplorerWidth = Math.max(MIN_EXPLORER_WIDTH, Math.min(explorerStyleWidth * scale, containerWidth - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2)));
          fileExplorerPanel.style.width = newExplorerWidth + 'px';
        }
        
        if (previewCollapsed) {
          const newEditorWidth = Math.max(MIN_EDITOR_WIDTH, availableWidth - (explorerCollapsed ? 0 : fileExplorerPanel.offsetWidth));
          editorPanel.style.flex = 'none';
          editorPanel.style.width = newEditorWidth + 'px';
        } else {
          if (editorPanel.style.width && previewPanel.style.width) {
            const editorStyleWidth = parseInt(editorPanel.style.width) || currentEditorWidth;
            const previewStyleWidth = parseInt(previewPanel.style.width) || currentPreviewWidth;
            
            const newEditorWidth = Math.max(MIN_EDITOR_WIDTH, editorStyleWidth * scale);
            const newPreviewWidth = Math.max(MIN_PREVIEW_WIDTH, previewStyleWidth * scale);
            
            const totalNeeded = newEditorWidth + newPreviewWidth;
            const actualAvailable = availableWidth - (explorerCollapsed ? 0 : fileExplorerPanel.offsetWidth);
            if (totalNeeded > actualAvailable) {
              const editorRatio = newEditorWidth / totalNeeded;
              const previewRatio = newPreviewWidth / totalNeeded;
              editorPanel.style.width = Math.max(MIN_EDITOR_WIDTH, actualAvailable * editorRatio) + 'px';
              previewPanel.style.width = Math.max(MIN_PREVIEW_WIDTH, actualAvailable * previewRatio) + 'px';
            } else {
              editorPanel.style.width = newEditorWidth + 'px';
              previewPanel.style.width = newPreviewWidth + 'px';
            }
            
            editorPanel.style.flex = 'none';
            previewPanel.style.flex = 'none';
          } else {
            editorPanel.style.flex = '1 1 auto';
            previewPanel.style.flex = '1 1 auto';
          }
        }
      } else {
        const extraSpace = containerWidth - totalCurrentWidth;
        
        if (previewCollapsed) {
          if (editorPanel.style.width && editorPanel.style.width !== '') {
            const currentEditorStyleWidth = parseInt(editorPanel.style.width) || currentEditorWidth;
            const newEditorWidth = currentEditorStyleWidth + extraSpace;
            editorPanel.style.width = Math.max(MIN_EDITOR_WIDTH, newEditorWidth) + 'px';
            editorPanel.style.flex = 'none';
          } else {
            editorPanel.style.flex = '1 1 auto';
            editorPanel.style.width = '';
          }
        } else {
          if (editorPanel.style.width && previewPanel.style.width) {
            const editorStyleWidth = parseInt(editorPanel.style.width) || currentEditorWidth;
            const previewStyleWidth = parseInt(previewPanel.style.width) || currentPreviewWidth;
            const totalPanelWidth = editorStyleWidth + previewStyleWidth;
            
            if (totalPanelWidth > 0) {
              const editorRatio = editorStyleWidth / totalPanelWidth;
              const previewRatio = previewStyleWidth / totalPanelWidth;
              
              const newEditorWidth = editorStyleWidth + (extraSpace * editorRatio);
              const newPreviewWidth = previewStyleWidth + (extraSpace * previewRatio);
              
              editorPanel.style.width = Math.max(MIN_EDITOR_WIDTH, newEditorWidth) + 'px';
              previewPanel.style.width = Math.max(MIN_PREVIEW_WIDTH, newPreviewWidth) + 'px';
              editorPanel.style.flex = 'none';
              previewPanel.style.flex = 'none';
            }
          } else {
            editorPanel.style.flex = '1 1 auto';
            previewPanel.style.flex = '1 1 auto';
            editorPanel.style.width = '';
            previewPanel.style.width = '';
          }
        }
        
        if (!explorerCollapsed) {
          const explorerStyleWidth = parseInt(fileExplorerPanel.style.width) || currentExplorerWidth;
          if (explorerStyleWidth < MIN_EXPLORER_WIDTH) {
            fileExplorerPanel.style.width = MIN_EXPLORER_WIDTH + 'px';
          }
        }
        
        if (!previewCollapsed) {
          if (editorPanel.style.width) {
            const editorStyleWidth = parseInt(editorPanel.style.width) || currentEditorWidth;
            if (editorStyleWidth < MIN_EDITOR_WIDTH) {
              editorPanel.style.width = MIN_EDITOR_WIDTH + 'px';
            }
          }
          if (previewPanel.style.width) {
            const previewStyleWidth = parseInt(previewPanel.style.width) || currentPreviewWidth;
            if (previewStyleWidth < MIN_PREVIEW_WIDTH) {
              previewPanel.style.width = MIN_PREVIEW_WIDTH + 'px';
            }
          }
        }
      }
      
      if (!explorerCollapsed) {
        const maxExplorerWidth = previewCollapsed 
          ? containerWidth - MIN_EDITOR_WIDTH - RESIZER_WIDTH
          : containerWidth - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2);
        const currentExplorerWidth = fileExplorerPanel.offsetWidth;
        if (currentExplorerWidth > maxExplorerWidth) {
          fileExplorerPanel.style.width = maxExplorerWidth + 'px';
        }
      }
    },

    setupResizers(container, resizerExplorer, resizerEditor, resizerTerminal, terminalPanel, fileExplorerPanel, previewPanel, editorPanel, terminalAtBottom, saveState) {
      let activeResizer = null;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      
      function handleGlobalMouseMove(e) {
        if (!activeResizer) return;
        
        if (e.target && e.target.tagName !== 'IFRAME') {
          e.preventDefault();
        }
        e.stopPropagation();
        
        const containerRect = container.getBoundingClientRect();
        
        switch (activeResizer) {
          case 'explorer':
            handleExplorerResize(e, containerRect);
            break;
          case 'editor':
            handleEditorResize(e, containerRect);
            break;
          case 'terminal':
            handleTerminalResize(e, containerRect);
            break;
        }
      }
      
      function handleGlobalMouseUp(e) {
        if (!activeResizer) return;
        
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('resizing');
        window.removeEventListener('mousemove', handleGlobalMouseMove, true);
        window.removeEventListener('mouseup', handleGlobalMouseUp, true);
        document.removeEventListener('mousemove', handleGlobalMouseMove, true);
        document.removeEventListener('mouseup', handleGlobalMouseUp, true);
        window.removeEventListener('blur', handleGlobalMouseUp, true);
        
        activeResizer = null;
        saveState();
      }
      
      function handleExplorerResize(e, containerRect) {
        if (fileExplorerPanel.classList.contains('collapsed')) return;
        
        const previewCollapsed = previewPanel.classList.contains('collapsed');
        const deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;
        
        const minWidth = MIN_EXPLORER_WIDTH;
        let maxWidth;
        if (previewCollapsed) {
          maxWidth = containerRect.width - MIN_EDITOR_WIDTH - RESIZER_WIDTH;
        } else {
          maxWidth = containerRect.width - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH - (RESIZER_WIDTH * 2);
        }
        
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        
        fileExplorerPanel.style.width = newWidth + 'px';
        fileExplorerPanel.style.flex = 'none';
        
        const remainingWidth = containerRect.width - newWidth - RESIZER_WIDTH;
        if (editorPanel && previewPanel) {
          if (previewCollapsed) {
            editorPanel.style.flex = '1 1 auto';
            editorPanel.style.minWidth = MIN_EDITOR_WIDTH + 'px';
          } else {
            editorPanel.style.flex = '1 1 auto';
            previewPanel.style.flex = '1 1 auto';
            editorPanel.style.minWidth = MIN_EDITOR_WIDTH + 'px';
            previewPanel.style.minWidth = MIN_PREVIEW_WIDTH + 'px';
          }
        }
      }
      
      function handleEditorResize(e, containerRect) {
        const previewCollapsed = previewPanel.classList.contains('collapsed');
        
        const explorerWidth = fileExplorerPanel.classList.contains('collapsed') ? 0 : fileExplorerPanel.offsetWidth;
        const explorerResizerWidth = fileExplorerPanel.classList.contains('collapsed') ? 0 : RESIZER_WIDTH;
        const editorResizerWidth = RESIZER_WIDTH;
        const availableWidth = containerRect.width - explorerWidth - explorerResizerWidth - (previewCollapsed ? 0 : editorResizerWidth);
        
        const deltaX = e.clientX - startX;
        let newEditorWidth = startWidth + deltaX;
        
        if (previewCollapsed) {
          newEditorWidth = Math.max(MIN_EDITOR_WIDTH, Math.min(newEditorWidth, availableWidth));
          editorPanel.style.flex = 'none';
          editorPanel.style.width = newEditorWidth + 'px';
        } else {
          newEditorWidth = Math.max(MIN_EDITOR_WIDTH, Math.min(newEditorWidth, availableWidth - MIN_PREVIEW_WIDTH));
          const newPreviewWidth = availableWidth - newEditorWidth;
          
          if (newPreviewWidth < MIN_PREVIEW_WIDTH) {
            const constrainedPreviewWidth = MIN_PREVIEW_WIDTH;
            const constrainedEditorWidth = availableWidth - constrainedPreviewWidth;
            if (constrainedEditorWidth >= MIN_EDITOR_WIDTH) {
              editorPanel.style.flex = 'none';
              previewPanel.style.flex = 'none';
              editorPanel.style.width = constrainedEditorWidth + 'px';
              previewPanel.style.width = constrainedPreviewWidth + 'px';
            }
          } else {
            editorPanel.style.flex = 'none';
            previewPanel.style.flex = 'none';
            editorPanel.style.width = newEditorWidth + 'px';
            previewPanel.style.width = newPreviewWidth + 'px';
          }
        }
      }
      
      function handleTerminalResize(e, containerRect) {
        if (terminalPanel.classList.contains('collapsed')) return;
        
        const deltaY = e.clientY - startY;
        let newHeight;
        
        if (terminalAtBottom) {
          newHeight = startHeight - deltaY;
        } else {
          newHeight = startHeight + deltaY;
        }
        
        newHeight = Math.max(MIN_TERMINAL_HEIGHT, Math.min(newHeight, MAX_TERMINAL_HEIGHT));
        
        terminalPanel.style.height = newHeight + 'px';
      }
      
      if (resizerExplorer) {
        resizerExplorer.addEventListener('mousedown', (e) => {
          if (fileExplorerPanel.classList.contains('collapsed')) return;
          
          e.preventDefault();
          e.stopPropagation();
          
          activeResizer = 'explorer';
          startX = e.clientX;
          startWidth = fileExplorerPanel.offsetWidth;
          
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          document.body.classList.add('resizing');
          window.addEventListener('mousemove', handleGlobalMouseMove, true);
          window.addEventListener('mouseup', handleGlobalMouseUp, true);
          window.addEventListener('blur', handleGlobalMouseUp, true);
          document.addEventListener('mousemove', handleGlobalMouseMove, true);
          document.addEventListener('mouseup', handleGlobalMouseUp, true);
        });
      }
      
      if (resizerEditor) {
        resizerEditor.addEventListener('mousedown', (e) => {
          if (previewPanel.classList.contains('collapsed')) return;
          
          e.preventDefault();
          e.stopPropagation();
          
          activeResizer = 'editor';
          startX = e.clientX;
          startWidth = editorPanel.offsetWidth;
          
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          document.body.classList.add('resizing');
          window.addEventListener('mousemove', handleGlobalMouseMove, true);
          window.addEventListener('mouseup', handleGlobalMouseUp, true);
          window.addEventListener('blur', handleGlobalMouseUp, true);
          document.addEventListener('mousemove', handleGlobalMouseMove, true);
          document.addEventListener('mouseup', handleGlobalMouseUp, true);
        });
      }
      
      if (resizerTerminal && terminalPanel) {
        resizerTerminal.addEventListener('mousedown', (e) => {
          if (terminalPanel.classList.contains('collapsed')) return;
          
          e.preventDefault();
          e.stopPropagation();
          
          activeResizer = 'terminal';
          startY = e.clientY;
          startHeight = terminalPanel.offsetHeight;
          
          document.body.style.cursor = 'row-resize';
          document.body.style.userSelect = 'none';
          document.body.classList.add('resizing');
          window.addEventListener('mousemove', handleGlobalMouseMove, true);
          window.addEventListener('mouseup', handleGlobalMouseUp, true);
          window.addEventListener('blur', handleGlobalMouseUp, true);
          document.addEventListener('mousemove', handleGlobalMouseMove, true);
          document.addEventListener('mouseup', handleGlobalMouseUp, true);
        });
        
        if (terminalPanel.classList.contains('collapsed')) {
          resizerTerminal.style.display = 'none';
        }
      }
    }
  };
})();
