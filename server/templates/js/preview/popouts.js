window.PreviewPopouts = (function() {
  let editorPopout = null;
  let previewPopout = null;
  let terminalPopout = null;
  let previewPanelObserver = null;
  let updatePreviewPopoutTimeout = null;
  let lastPreviewPopoutFilePath = null;

  function isPreviewPoppedOut() {
    return previewPopout && !previewPopout.closed;
  }

  function enforcePreviewCollapsed(previewPanel) {
    if (!previewPanel) return;
    
    if (isPreviewPoppedOut()) {
      if (!previewPanel.classList.contains('collapsed')) {
        previewPanel.classList.add('collapsed');
        const previewFrame = document.getElementById('previewFrame');
        if (previewFrame) {
          previewFrame.style.display = 'none';
        }
      }
    }
  }

  function setupPreviewPanelObserver(previewPanel) {
    if (!previewPanel || previewPanelObserver) return;
    
    let observerTimeout = null;
    
    previewPanelObserver = new MutationObserver((mutations) => {
      if (isPreviewPoppedOut()) {
        // Clear any pending timeout
        if (observerTimeout) {
          clearTimeout(observerTimeout);
        }
        
        // Use setTimeout to avoid race conditions
        // This allows other code to complete before we enforce the collapsed state
        observerTimeout = setTimeout(() => {
          // Double-check that preview is still popped out (might have closed during delay)
          if (!isPreviewPoppedOut()) {
            return;
          }
          
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              if (!previewPanel.classList.contains('collapsed')) {
                enforcePreviewCollapsed(previewPanel);
              }
            }
          });
        }, 10); // Small delay to allow async operations to complete
      }
    });
    
    previewPanelObserver.observe(previewPanel, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  return {
    getEditorPopout() {
      return editorPopout;
    },

    setEditorPopout(popout) {
      editorPopout = popout;
    },

    getPreviewPopout() {
      return previewPopout;
    },
    
    isPreviewPoppedOut() {
      return previewPopout && !previewPopout.closed;
    },
    
    enforcePreviewCollapsed(previewPanel) {
      enforcePreviewCollapsed(previewPanel);
    },
    
    setupPreviewPanelObserver(previewPanel) {
      setupPreviewPanelObserver(previewPanel);
    },

    setPreviewPopout(popout) {
      previewPopout = popout;
    },

    getTerminalPopout() {
      return terminalPopout;
    },

    setTerminalPopout(popout) {
      terminalPopout = popout;
    },

    openEditorPopout(getFilePath) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      console.log('openEditorPopout called, filePath:', filePath);
      if (editorPopout && !editorPopout.closed) {
        editorPopout.focus();
        this.updateEditorPopout(filePath);
        return;
      }
      
      const url = `/__popout__/editor?file=${encodeURIComponent(filePath)}&original=${encodeURIComponent(window.location.href)}`;
      console.log('Opening editor popout:', url);
      editorPopout = window.open(url, 'editor-popout', 'width=800,height=600,resizable=yes,scrollbars=yes');
      
      if (!editorPopout) {
        console.error('Failed to open editor popout - popup blocked?');
        alert('Popup blocked. Please allow popups for this site.');
      }
    },
    
    updateEditorPopout(filePath) {
      if (editorPopout && !editorPopout.closed) {
        const url = `/__popout__/editor?file=${encodeURIComponent(filePath)}&original=${encodeURIComponent(window.location.href)}`;
        editorPopout.location.href = url;
      }
    },

    openPreviewPopout(getFilePath, previewPanel, updatePreviewVisibility) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      if (previewPopout && !previewPopout.closed) {
        previewPopout.focus();
        this.updatePreviewPopout(filePath);
        return;
      }
      
      const url = `/__popout__/preview?file=${encodeURIComponent(filePath)}`;
      previewPopout = window.open(url, 'preview-popout', 'width=800,height=600,resizable=yes,scrollbars=yes');
      
      if (!previewPopout) {
        console.error('[PreviewPopouts] Failed to open preview popout - popup blocked?');
        alert('Popup blocked. Please allow popups for this site.');
        return;
      }
      
      if (previewPanel) {
        previewPanel.classList.add('collapsed');
        const previewFrame = document.getElementById('previewFrame');
        if (previewFrame) {
          previewFrame.style.display = 'none';
        }
        
        setupPreviewPanelObserver(previewPanel);
        
        if (updatePreviewVisibility) {
          updatePreviewVisibility();
        }
      }
    },
    
    updatePreviewPopout(filePath) {
      if (previewPopout && !previewPopout.closed) {
        // Debounce updates to prevent spam - only update if file actually changed
        if (filePath === lastPreviewPopoutFilePath) {
          return;
        }
        
        // Clear any pending update
        if (updatePreviewPopoutTimeout) {
          clearTimeout(updatePreviewPopoutTimeout);
        }
        
        // Debounce the update
        updatePreviewPopoutTimeout = setTimeout(() => {
          lastPreviewPopoutFilePath = filePath;
          
          // Use BroadcastChannel to update the popout instead of navigating
          // This avoids triggering beforeunload which sends popout-closed message
          try {
            const channel = new BroadcastChannel('preview-sync');
            channel.postMessage({
              type: 'file-changed',
              filePath: filePath
            });
            // Close channel after a short delay
            setTimeout(() => channel.close(), 50);
          } catch (err) {
            console.error('[PreviewPopouts] Error sending file-changed message:', err);
            // Fallback to URL change if BroadcastChannel fails
            const url = `/__popout__/preview?file=${encodeURIComponent(filePath)}`;
            previewPopout.location.href = url;
          }
        }, 100); // 100ms debounce
      }
    },

    openTerminalPopout(terminalPanel, updateTerminalVisibility) {
      console.log('openTerminalPopout called');
      if (terminalPopout && !terminalPopout.closed) {
        terminalPopout.focus();
        return;
      }
      
      const url = `/__popout__/terminal`;
      console.log('Opening terminal popout:', url);
      terminalPopout = window.open(url, 'terminal-popout', 'width=800,height=600,resizable=yes,scrollbars=yes');
      
      if (!terminalPopout) {
        console.error('Failed to open terminal popout - popup blocked?');
        alert('Popup blocked. Please allow popups for this site.');
        return;
      }
      
      if (terminalPanel) {
        terminalPanel.classList.add('collapsed');
        const toggleTerminalBtn = document.getElementById('toggleTerminal');
        if (toggleTerminalBtn) {
          toggleTerminalBtn.textContent = '+';
        }
        const resizerTerminalEl = document.getElementById('resizerTerminal');
        if (resizerTerminalEl) {
          resizerTerminalEl.style.display = 'none';
        }
        const terminalReopenBarEl = document.getElementById('terminalReopenBar');
        if (terminalReopenBarEl) {
          terminalReopenBarEl.style.display = 'flex';
        }
        if (updateTerminalVisibility) {
          updateTerminalVisibility();
        }
        const terminalClientOutput = document.getElementById('terminalClientOutput');
        const terminalPowerShellOutput = document.getElementById('terminalPowerShellOutput');
        if (terminalClientOutput) {
          terminalClientOutput.style.display = 'none';
        }
        if (terminalPowerShellOutput) {
          terminalPowerShellOutput.style.display = 'none';
        }
      }
    },

    handlePopoutClosed(popoutType, editorPanel, previewPanel, terminalPanel, updatePreviewVisibility, updateTerminalVisibility) {
      if (popoutType === 'editor') {
        // Double-check the popout is actually closed before handling
        if (editorPopout && !editorPopout.closed) {
          return;
        }
        editorPopout = null;
        if (editorPanel) {
          editorPanel.classList.remove('collapsed');
        }
      } else if (popoutType === 'preview') {
        // Double-check the popout is actually closed before handling
        // This prevents false positives from beforeunload during navigation
        if (previewPopout && !previewPopout.closed) {
          return;
        }
        
        previewPopout = null;
        
        if (previewPanelObserver) {
          previewPanelObserver.disconnect();
          previewPanelObserver = null;
        }
        
        if (previewPanel) {
          previewPanel.classList.remove('collapsed');
          const previewFrame = document.getElementById('previewFrame');
          if (previewFrame) {
            previewFrame.style.display = 'block';
          }
          if (updatePreviewVisibility) {
            updatePreviewVisibility();
          }
        }
      } else if (popoutType === 'terminal') {
        terminalPopout = null;
        if (terminalPanel) {
          terminalPanel.classList.remove('collapsed');
          const toggleTerminalBtn = document.getElementById('toggleTerminal');
          if (toggleTerminalBtn) {
            toggleTerminalBtn.textContent = '−';
          }
          const resizerTerminalEl = document.getElementById('resizerTerminal');
          if (resizerTerminalEl) {
            resizerTerminalEl.style.display = 'block';
          }
          const terminalReopenBarEl = document.getElementById('terminalReopenBar');
          if (terminalReopenBarEl) {
            terminalReopenBarEl.style.display = 'none';
          }
          const terminalClientOutput = document.getElementById('terminalClientOutput');
          const terminalPowerShellOutput = document.getElementById('terminalPowerShellOutput');
          if (terminalClientOutput) {
            terminalClientOutput.style.display = 'block';
          }
          if (terminalPowerShellOutput) {
            terminalPowerShellOutput.style.display = 'block';
          }
          if (updateTerminalVisibility) {
            updateTerminalVisibility();
          }
        }
      }
    }
  };
})();
