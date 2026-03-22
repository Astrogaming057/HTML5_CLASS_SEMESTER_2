window.PreviewSettings = (function() {
  let previewSettings = {
    autoRefreshPreview: true,
    pageTheme: 'dark',
    customThemeCSS: '',
    applyThemeToPreviewFrame: false,
    editorFontSize: 14,
    editorTheme: 'vs-dark',
    editorWordWrap: false,
    editorLineNumbers: true,
    editorTabSize: 4,
    defaultExplorerVisible: true,
    defaultTerminalVisible: false,
    explorerTreeView: true
  };

  let originalTheme = null;
  let originalHardwareAcceleration = null;

  return {
    getSettings() {
      return previewSettings;
    },

    setSettings(newSettings) {
      previewSettings = { ...previewSettings, ...newSettings };
    },

    loadPreviewSettings() {
      const saved = localStorage.getItem('previewSettings');
      if (saved) {
        try {
          previewSettings = { ...previewSettings, ...JSON.parse(saved) };
        } catch (e) {
          console.error('Error loading preview settings:', e);
        }
      }
      this.applyPreviewSettings();
      this.applyThemeToPreviewFrame();
    },

    savePreviewSettings() {
      try {
        localStorage.setItem('previewSettings', JSON.stringify(previewSettings));
      } catch (e) {
        console.error('Error saving preview settings:', e);
      }
    },

    async loadTheme(themeName) {
      try {
        const themeStyle = document.getElementById('theme-style');
        if (!themeStyle) {
          console.error('Theme style element not found');
          return;
        }
        
        let themeCss = '';
        if (themeName === 'custom') {
          const customCSS = previewSettings.customThemeCSS || '';
          if (customCSS.trim() === '') {
            const response = await fetch(`/__api__/theme?name=dark`);
            if (response.ok) {
              themeCss = await response.text();
              themeStyle.textContent = themeCss;
            } else {
              console.error('Failed to load fallback theme:', response.status);
            }
          } else {
            themeCss = customCSS;
            themeStyle.textContent = customCSS;
          }
        } else {
          const response = await fetch(`/__api__/theme?name=${encodeURIComponent(themeName)}`);
          if (response.ok) {
            themeCss = await response.text();
            themeStyle.textContent = themeCss;
          } else {
            console.error('Failed to load theme:', response.status);
          }
        }
        
        // Broadcast theme change to all popout windows
        try {
          const channel = new BroadcastChannel('preview-sync');
          channel.postMessage({
            type: 'theme-changed',
            theme: themeName,
            customCSS: themeName === 'custom' ? previewSettings.customThemeCSS || '' : ''
          });
          setTimeout(() => channel.close(), 50);
        } catch (err) {
          console.error('Error broadcasting theme change:', err);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    },

    applyPreviewSettings(editor) {
      if (editor) {
        editor.updateOptions({
          fontSize: previewSettings.editorFontSize,
          theme: previewSettings.editorTheme,
          wordWrap: previewSettings.editorWordWrap ? 'on' : 'off',
          lineNumbers: previewSettings.editorLineNumbers ? 'on' : 'off',
          tabSize: previewSettings.editorTabSize
        });
        if (window.PreviewStatusBar && typeof window.PreviewStatusBar.refresh === 'function') {
          window.PreviewStatusBar.refresh();
        }
      }
      
      this.loadTheme(previewSettings.pageTheme);
      
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        const autoRefreshPreview = document.getElementById('autoRefreshPreview');
        const pageTheme = document.getElementById('pageTheme');
        const customThemeCSS = document.getElementById('customThemeCSS');
        const customThemeGroup = document.getElementById('customThemeGroup');
        const editorFontSize = document.getElementById('editorFontSize');
        const editorTheme = document.getElementById('editorTheme');
        const editorWordWrap = document.getElementById('editorWordWrap');
        const editorLineNumbers = document.getElementById('editorLineNumbers');
        const editorTabSize = document.getElementById('editorTabSize');
        const defaultExplorerVisible = document.getElementById('defaultExplorerVisible');
        const defaultTerminalVisible = document.getElementById('defaultTerminalVisible');
        const explorerTreeView = document.getElementById('explorerTreeView');
        const applyThemeToPreviewFrame = document.getElementById('applyThemeToPreviewFrame');
        const useHardwareAcceleration = document.getElementById('useHardwareAcceleration');
        
        if (autoRefreshPreview) autoRefreshPreview.checked = previewSettings.autoRefreshPreview;
        if (pageTheme) {
          pageTheme.value = previewSettings.pageTheme;
          if (customThemeGroup) {
            customThemeGroup.style.display = previewSettings.pageTheme === 'custom' ? 'block' : 'none';
          }
        }
        if (customThemeCSS) customThemeCSS.value = previewSettings.customThemeCSS || '';
        if (applyThemeToPreviewFrame) applyThemeToPreviewFrame.checked = previewSettings.applyThemeToPreviewFrame;
        if (editorFontSize) editorFontSize.value = previewSettings.editorFontSize;
        if (editorTheme) editorTheme.value = previewSettings.editorTheme;
        if (editorWordWrap) editorWordWrap.checked = previewSettings.editorWordWrap;
        if (editorLineNumbers) editorLineNumbers.checked = previewSettings.editorLineNumbers;
        if (editorTabSize) editorTabSize.value = previewSettings.editorTabSize;
        if (defaultExplorerVisible) defaultExplorerVisible.checked = previewSettings.defaultExplorerVisible;
        if (defaultTerminalVisible) defaultTerminalVisible.checked = previewSettings.defaultTerminalVisible;
        if (explorerTreeView) explorerTreeView.checked = previewSettings.explorerTreeView === true;
      }
      
      // Always apply theme to preview frame (not just when settings panel is open)
      this.applyThemeToPreviewFrame();
    },

    async openSettings() {
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        originalTheme = previewSettings.pageTheme;
        this.applyPreviewSettings();
        
        // Show/hide hardware acceleration setting based on Electron availability
        const hwAccelGroup = document.getElementById('hardwareAccelGroup');
        if (hwAccelGroup) {
          if (window.electronAPI && window.electronAPI.isElectron) {
            hwAccelGroup.style.display = 'block';
            // Load hardware acceleration setting from Electron
            try {
              const hwAccel = await window.electronAPI.getHardwareAcceleration();
              console.log('[Settings] Loaded hardware acceleration value:', hwAccel, typeof hwAccel);
              originalHardwareAcceleration = hwAccel; // Store original value
              const useHardwareAcceleration = document.getElementById('useHardwareAcceleration');
              if (useHardwareAcceleration) {
                useHardwareAcceleration.checked = hwAccel === true;
                console.log('[Settings] Set checkbox to:', useHardwareAcceleration.checked);
              } else {
                console.error('[Settings] useHardwareAcceleration element not found');
              }
            } catch (e) {
              console.error('[Settings] Error loading hardware acceleration setting:', e);
              originalHardwareAcceleration = false;
            }
          } else {
            hwAccelGroup.style.display = 'none';
          }
        }
        
        // Show/hide working directory setting based on Electron availability
        const workingDirGroup = document.getElementById('workingDirectoryGroup');
        if (workingDirGroup) {
          if (window.electronAPI && window.electronAPI.isElectron) {
            workingDirGroup.style.display = 'block';
            // Load working directory from Electron
            try {
              const workingDir = await window.electronAPI.getWorkingDirectory();
              const workingDirPath = document.getElementById('workingDirectoryPath');
              if (workingDirPath) {
                workingDirPath.value = workingDir || 'Not set (using default)';
                workingDirPath.setAttribute('data-original-path', workingDir || '');
              }
              // Hide restart prompt when opening settings (will show again if changed)
              const workingDirRestartPrompt = document.getElementById('workingDirectoryRestartPrompt');
              if (workingDirRestartPrompt) {
                workingDirRestartPrompt.style.display = 'none';
              }
            } catch (e) {
              console.error('Error loading working directory:', e);
              const workingDirPath = document.getElementById('workingDirectoryPath');
              if (workingDirPath) {
                workingDirPath.value = 'Error loading directory';
                workingDirPath.setAttribute('data-original-path', '');
              }
            }
          } else {
            workingDirGroup.style.display = 'none';
          }
        }
        
        settingsPanel.style.display = 'flex';
        
        const pageTheme = document.getElementById('pageTheme');
        if (pageTheme) {
          pageTheme.addEventListener('change', PreviewSettings.handleThemePreview);
        }
      }
    },

    closeSettings(skipThemeRevert = false) {
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        const pageTheme = document.getElementById('pageTheme');
        if (pageTheme) {
          pageTheme.removeEventListener('change', PreviewSettings.handleThemePreview);
        }
        
        if (!skipThemeRevert && originalTheme !== null && originalTheme !== previewSettings.pageTheme) {
          PreviewSettings.loadTheme(originalTheme);
          previewSettings.pageTheme = originalTheme;
        }
        
        originalTheme = null;
        settingsPanel.style.display = 'none';
      }
    },

    handleThemePreview() {
      const pageTheme = document.getElementById('pageTheme');
      const customThemeGroup = document.getElementById('customThemeGroup');
      
      if (pageTheme && pageTheme.value) {
        if (customThemeGroup) {
          customThemeGroup.style.display = pageTheme.value === 'custom' ? 'block' : 'none';
        }
        PreviewSettings.loadTheme(pageTheme.value);
        // Re-apply theme to preview frame if enabled
        PreviewSettings.applyThemeToPreviewFrame();
      }
    },

    applyThemeToPreviewFrame() {
      const previewFrame = document.getElementById('previewFrame');
      const previewContainer = document.getElementById('previewContainer');
      
      if (previewSettings.applyThemeToPreviewFrame) {
        if (previewFrame) {
          previewFrame.classList.add('theme-applied');
        }
        if (previewContainer) {
          previewContainer.classList.add('theme-applied');
        }
      } else {
        if (previewFrame) {
          previewFrame.classList.remove('theme-applied');
        }
        if (previewContainer) {
          previewContainer.classList.remove('theme-applied');
        }
      }
    },

    resetToDefaults() {
      previewSettings = {
        autoRefreshPreview: true,
        pageTheme: 'dark',
        customThemeCSS: '',
        applyThemeToPreviewFrame: false,
        editorFontSize: 14,
        editorTheme: 'vs-dark',
        editorWordWrap: false,
        editorLineNumbers: true,
        editorTabSize: 4,
        defaultExplorerVisible: true,
        defaultTerminalVisible: false,
        explorerTreeView: true
      };
      this.savePreviewSettings();
    },
    
    getOriginalHardwareAcceleration() {
      return originalHardwareAcceleration;
    }
  };
})();
