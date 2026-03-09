window.PreviewTerminalUI = (function() {
  return {
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

    moveTerminalToBottomPosition(terminalPanel, container, fileExplorerPanel, terminalAtBottomRef, updateTerminalPositionButtons, saveState) {
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
      terminalAtBottomRef.current = true;
      
      updateTerminalPositionButtons();
      saveState();
    },

    moveTerminalToExplorerPosition(terminalPanel, container, fileExplorerPanel, terminalReopenBar, terminalAtBottomRef, updateTerminalPositionButtons, saveState) {
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
      terminalAtBottomRef.current = false;
      
      updateTerminalPositionButtons();
      saveState();
    },

    setupTerminalEventHandlers(toggleTerminal, terminalPanel, updateTerminalVisibility, saveState, moveTerminalToBottom, moveTerminalToExplorer, moveTerminalToBottomPosition, moveTerminalToExplorerPosition, reopenTerminalBtn) {
      if (toggleTerminal && terminalPanel) {
        toggleTerminal.addEventListener('click', () => {
          terminalPanel.classList.toggle('collapsed');
          updateTerminalVisibility();
          saveState();
        });
      }
      
      if (moveTerminalToBottom && terminalPanel) {
        moveTerminalToBottom.addEventListener('click', () => {
          moveTerminalToBottomPosition();
        });
      }
      
      if (moveTerminalToExplorer && terminalPanel) {
        moveTerminalToExplorer.addEventListener('click', () => {
          moveTerminalToExplorerPosition();
        });
      }
      
      if (reopenTerminalBtn && terminalPanel) {
        reopenTerminalBtn.addEventListener('click', () => {
          terminalPanel.classList.remove('collapsed');
          updateTerminalVisibility();
          saveState();
        });
      }
    }
  };
})();
