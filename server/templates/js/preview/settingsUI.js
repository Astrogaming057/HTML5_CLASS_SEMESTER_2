window.PreviewSettingsUI = (function() {
  return {
    setupSettingsEventHandlers(settingsBtn, settingsPanel, settingsCloseBtn, saveSettingsBtn, resetSettingsBtn2, resetSettingsBtn, status, editor, customConfirm, resetSettings) {
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          console.log('Settings button clicked');
          PreviewSettings.openSettings();
        });
      } else {
        console.error('Settings button not found!');
      }
      
      if (!settingsPanel) {
        console.error('Settings panel not found!');
      }
      
      if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => PreviewSettings.closeSettings());
      }
      
      if (settingsPanel) {
        settingsPanel.addEventListener('click', (e) => {
          if (e.target === settingsPanel) {
            PreviewSettings.closeSettings();
          }
        });
      }
      
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
          const autoRefreshPreview = document.getElementById('autoRefreshPreview');
          const pageTheme = document.getElementById('pageTheme');
          const customThemeCSS = document.getElementById('customThemeCSS');
          const editorFontSize = document.getElementById('editorFontSize');
          const editorTheme = document.getElementById('editorTheme');
          const editorWordWrap = document.getElementById('editorWordWrap');
          const editorLineNumbers = document.getElementById('editorLineNumbers');
          const editorTabSize = document.getElementById('editorTabSize');
          const defaultExplorerVisible = document.getElementById('defaultExplorerVisible');
          const defaultTerminalVisible = document.getElementById('defaultTerminalVisible');
          const applyThemeToPreviewFrame = document.getElementById('applyThemeToPreviewFrame');
          
          PreviewSettings.setSettings({
            autoRefreshPreview: autoRefreshPreview ? autoRefreshPreview.checked : true,
            pageTheme: pageTheme ? pageTheme.value : 'dark',
            customThemeCSS: customThemeCSS ? customThemeCSS.value : '',
            applyThemeToPreviewFrame: applyThemeToPreviewFrame ? applyThemeToPreviewFrame.checked : false,
            editorFontSize: editorFontSize ? parseInt(editorFontSize.value) : 14,
            editorTheme: editorTheme ? editorTheme.value : 'vs-dark',
            editorWordWrap: editorWordWrap ? editorWordWrap.checked : false,
            editorLineNumbers: editorLineNumbers ? editorLineNumbers.checked : true,
            editorTabSize: editorTabSize ? parseInt(editorTabSize.value) : 4,
            defaultExplorerVisible: defaultExplorerVisible ? defaultExplorerVisible.checked : true,
            defaultTerminalVisible: defaultTerminalVisible ? defaultTerminalVisible.checked : false
          });
          
          const pageThemeEl = document.getElementById('pageTheme');
          if (pageThemeEl) {
            pageThemeEl.removeEventListener('change', PreviewSettings.handleThemePreview);
          }
          
          PreviewSettings.savePreviewSettings();
          
          PreviewSettings.loadTheme(PreviewSettings.getSettings().pageTheme).then(() => {
            PreviewSettings.applyPreviewSettings(editor);
            // Apply theme to preview frame after settings are saved
            PreviewSettings.applyThemeToPreviewFrame();
            PreviewSettings.closeSettings(true); // Skip theme revert when saving
            
            status.textContent = 'Settings saved';
            status.className = 'status saved';
            setTimeout(() => {
              status.textContent = 'Ready';
              status.className = 'status';
            }, 2000);
          }).catch((error) => {
            console.error('Error applying theme:', error);
            PreviewSettings.applyPreviewSettings(editor);
            PreviewSettings.closeSettings(true); // Skip theme revert when saving
            
            status.textContent = 'Settings saved (theme load failed)';
            status.className = 'status error';
            setTimeout(() => {
              status.textContent = 'Ready';
              status.className = 'status';
            }, 2000);
          });
        });
      }
      
      const loadDarkExampleBtn = document.getElementById('loadDarkExampleBtn');
      const loadLightExampleBtn = document.getElementById('loadLightExampleBtn');
      const clearCustomThemeBtn = document.getElementById('clearCustomThemeBtn');
      
      if (loadDarkExampleBtn) {
        loadDarkExampleBtn.addEventListener('click', async () => {
          try {
            const response = await fetch('/__api__/theme?name=dark');
            if (response.ok) {
              const darkCSS = await response.text();
              const customThemeCSS = document.getElementById('customThemeCSS');
              if (customThemeCSS) {
                customThemeCSS.value = darkCSS;
              }
            }
          } catch (error) {
            console.error('Error loading dark example:', error);
          }
        });
      }
      
      if (loadLightExampleBtn) {
        loadLightExampleBtn.addEventListener('click', async () => {
          try {
            const response = await fetch('/__api__/theme?name=light');
            if (response.ok) {
              const lightCSS = await response.text();
              const customThemeCSS = document.getElementById('customThemeCSS');
              if (customThemeCSS) {
                customThemeCSS.value = lightCSS;
              }
            }
          } catch (error) {
            console.error('Error loading light example:', error);
          }
        });
      }
      
      if (clearCustomThemeBtn) {
        clearCustomThemeBtn.addEventListener('click', () => {
          const customThemeCSS = document.getElementById('customThemeCSS');
          if (customThemeCSS) {
            customThemeCSS.value = '';
          }
        });
      }

      // Add real-time toggle for applyThemeToPreviewFrame
      const applyThemeToPreviewFrameCheck = document.getElementById('applyThemeToPreviewFrame');
      if (applyThemeToPreviewFrameCheck) {
        applyThemeToPreviewFrameCheck.addEventListener('change', () => {
          const settings = PreviewSettings.getSettings();
          settings.applyThemeToPreviewFrame = applyThemeToPreviewFrameCheck.checked;
          PreviewSettings.setSettings(settings);
          PreviewSettings.applyThemeToPreviewFrame();
        });
      }
      
      if (resetSettingsBtn2) {
        resetSettingsBtn2.addEventListener('click', () => {
          PreviewSettings.resetToDefaults();
          
          const pageThemeEl = document.getElementById('pageTheme');
          if (pageThemeEl) {
            pageThemeEl.value = 'dark';
          }
          
          PreviewSettings.loadTheme('dark').then(() => {
            PreviewSettings.applyPreviewSettings(editor);
            
            status.textContent = 'Settings reset to defaults (preview)';
            status.className = 'status saved';
            setTimeout(() => {
              status.textContent = 'Ready';
              status.className = 'status';
            }, 2000);
          }).catch((error) => {
            console.error('Error loading theme:', error);
            PreviewSettings.applyPreviewSettings(editor);
            status.textContent = 'Settings reset to defaults (preview)';
            status.className = 'status saved';
            setTimeout(() => {
              status.textContent = 'Ready';
              status.className = 'status';
            }, 2000);
          });
        });
      }
      
      if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', async () => {
          const confirmed = await customConfirm('Are you sure you want to reset all settings? This will clear panel sizes, positions, and preferences.');
          if (confirmed) {
            resetSettings();
          }
        });
      }
    }
  };
})();
