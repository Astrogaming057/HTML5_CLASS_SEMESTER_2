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
    defaultTerminalVisible: false
  };

  let originalTheme = null;

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
        const applyThemeToPreviewFrame = document.getElementById('applyThemeToPreviewFrame');
        
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
        
        // Apply theme to preview frame if enabled
        this.applyThemeToPreviewFrame();
      }
    },

    openSettings() {
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        originalTheme = previewSettings.pageTheme;
        this.applyPreviewSettings();
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
        defaultTerminalVisible: false
      };
      this.savePreviewSettings();
    }
  };
})();
