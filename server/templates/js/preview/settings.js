window.PreviewSettings = (function() {
  let previewSettings = {
    autoRefreshPreview: true,
    pageTheme: 'dark',
    customThemeCSS: '',
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
        
        if (themeName === 'custom') {
          const customCSS = previewSettings.customThemeCSS || '';
          if (customCSS.trim() === '') {
            const response = await fetch(`/__api__/theme?name=dark`);
            if (response.ok) {
              const themeCss = await response.text();
              themeStyle.textContent = themeCss;
            } else {
              console.error('Failed to load fallback theme:', response.status);
            }
          } else {
            themeStyle.textContent = customCSS;
          }
        } else {
          const response = await fetch(`/__api__/theme?name=${encodeURIComponent(themeName)}`);
          if (response.ok) {
            const themeCss = await response.text();
            themeStyle.textContent = themeCss;
          } else {
            console.error('Failed to load theme:', response.status);
          }
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
        
        if (autoRefreshPreview) autoRefreshPreview.checked = previewSettings.autoRefreshPreview;
        if (pageTheme) {
          pageTheme.value = previewSettings.pageTheme;
          if (customThemeGroup) {
            customThemeGroup.style.display = previewSettings.pageTheme === 'custom' ? 'block' : 'none';
          }
        }
        if (customThemeCSS) customThemeCSS.value = previewSettings.customThemeCSS || '';
        if (editorFontSize) editorFontSize.value = previewSettings.editorFontSize;
        if (editorTheme) editorTheme.value = previewSettings.editorTheme;
        if (editorWordWrap) editorWordWrap.checked = previewSettings.editorWordWrap;
        if (editorLineNumbers) editorLineNumbers.checked = previewSettings.editorLineNumbers;
        if (editorTabSize) editorTabSize.value = previewSettings.editorTabSize;
        if (defaultExplorerVisible) defaultExplorerVisible.checked = previewSettings.defaultExplorerVisible;
        if (defaultTerminalVisible) defaultTerminalVisible.checked = previewSettings.defaultTerminalVisible;
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
          pageTheme.addEventListener('change', this.handleThemePreview);
        }
      }
    },

    closeSettings() {
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        const pageTheme = document.getElementById('pageTheme');
        if (pageTheme) {
          pageTheme.removeEventListener('change', this.handleThemePreview);
        }
        
        if (originalTheme !== null && originalTheme !== previewSettings.pageTheme) {
          this.loadTheme(originalTheme);
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
        this.loadTheme(pageTheme.value);
      }
    },

    resetToDefaults() {
      previewSettings = {
        autoRefreshPreview: true,
        pageTheme: 'dark',
        customThemeCSS: '',
        editorFontSize: 14,
        editorTheme: 'vs-dark',
        editorWordWrap: false,
        editorLineNumbers: true,
        editorTabSize: 4,
        defaultExplorerVisible: true,
        defaultTerminalVisible: false
      };
    }
  };
})();
