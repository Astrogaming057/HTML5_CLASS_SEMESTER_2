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
        saveSettingsBtn.addEventListener('click', async () => {
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
          const remoteEnabled = document.getElementById('remoteEnabled');
          const remoteLabel = document.getElementById('remoteLabel');
          const remoteUsername = document.getElementById('remoteUsername');
          const remotePassword = document.getElementById('remotePassword');
          const remoteMachineSelect = document.getElementById('remoteMachineSelect');
          const useHardwareAcceleration = document.getElementById('useHardwareAcceleration');
          
          // Check if hardware acceleration setting changed
          let hwAccelChanged = false;
          if (window.electronAPI && window.electronAPI.isElectron && useHardwareAcceleration) {
            try {
              // Get original value from PreviewSettings (stored when settings opened)
              const originalHwAccel = PreviewSettings.getOriginalHardwareAcceleration ? PreviewSettings.getOriginalHardwareAcceleration() : null;
              const newHwAccel = useHardwareAcceleration.checked;
              
              // Compare against original value, or get current if original not available
              let oldHwAccel = originalHwAccel;
              if (oldHwAccel === null || oldHwAccel === undefined) {
                oldHwAccel = await window.electronAPI.getHardwareAcceleration();
              }
              
              hwAccelChanged = oldHwAccel !== newHwAccel;
              
              if (hwAccelChanged) {
                await window.electronAPI.setHardwareAcceleration(newHwAccel);
                // Show restart prompt in settings panel
                const restartPrompt = document.getElementById('restartPrompt');
                if (restartPrompt) {
                  restartPrompt.style.display = 'block';
                }
                // Show restart confirmation modal
                const restartModal = document.getElementById('restartConfirmModal');
                if (restartModal) {
                  restartModal.style.display = 'flex';
                }
                // Don't continue with saving other settings yet - wait for user choice
                return;
              } else {
                // Hide restart prompt if setting didn't change
                const restartPrompt = document.getElementById('restartPrompt');
                if (restartPrompt) {
                  restartPrompt.style.display = 'none';
                }
              }
            } catch (e) {
              console.error('Error handling hardware acceleration setting:', e);
            }
          }
          
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
            defaultTerminalVisible: defaultTerminalVisible ? defaultTerminalVisible.checked : false,
            remoteEnabled: remoteEnabled ? remoteEnabled.checked : false,
            remoteLabel: remoteLabel ? remoteLabel.value || (remoteEnabled && remoteEnabled.checked ? 'Remote' : 'Local') : 'Local',
            remoteUsername: remoteUsername ? remoteUsername.value || '' : '',
            remotePassword: remotePassword ? remotePassword.value || '' : '',
            remoteSelectedMachineId: remoteMachineSelect ? remoteMachineSelect.value || '' : ''
          });
          
          const pageThemeEl = document.getElementById('pageTheme');
          if (pageThemeEl) {
            pageThemeEl.removeEventListener('change', PreviewSettings.handleThemePreview);
          }
          
          PreviewSettings.savePreviewSettings();

          // Persist remote engine config to Electron (for next restart)
          if (window.electronAPI && window.electronAPI.isElectron) {
            try {
              const enableRemote = remoteEnabled ? remoteEnabled.checked : false;
              const userToken = remoteUsername ? remoteUsername.value || '' : '';
              const machineId = remoteMachineSelect ? remoteMachineSelect.value || '' : '';

              window.electronAPI.setRemoteConfig({
                enableRemote,
                // Proxy URL stays whatever the app is already configured with;
                // we only persist enable + identity from here.
                proxyUrl: '',
                userToken,
                machineId
              }).then(() => {
                console.log('[Settings] Remote engine config saved, restart required to fully apply');
              }).catch(err => {
                console.error('Error saving remote engine config:', err);
              });
            } catch (e) {
              console.error('Error calling setRemoteConfig:', e);
            }
          }

          // Notify server about remote session (best-effort, no hard fail)
          try {
            const body = {
              enabled: remoteEnabled ? remoteEnabled.checked : false,
              username: remoteUsername ? remoteUsername.value || '' : '',
              password: remotePassword ? remotePassword.value || '' : '',
              selectedMachineId: remoteMachineSelect ? remoteMachineSelect.value || '' : ''
            };
            fetch('/__remote__/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            }).catch(err => {
              console.error('Failed to update remote session on server', err);
            });
          } catch (e) {
            console.error('Error sending remote session to server', e);
          }
          
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
        resetSettingsBtn2.addEventListener('click', async () => {
          // Check if hardware acceleration needs to be reset
          if (window.electronAPI && window.electronAPI.isElectron) {
            try {
              const oldHwAccel = await window.electronAPI.getHardwareAcceleration();
              if (oldHwAccel !== true) {
                await window.electronAPI.setHardwareAcceleration(true);
                const useHardwareAcceleration = document.getElementById('useHardwareAcceleration');
                if (useHardwareAcceleration) {
                  useHardwareAcceleration.checked = true;
                }
                // Show restart prompt and modal
                const restartPrompt = document.getElementById('restartPrompt');
                if (restartPrompt) {
                  restartPrompt.style.display = 'block';
                }
                const restartModal = document.getElementById('restartConfirmModal');
                if (restartModal) {
                  restartModal.style.display = 'flex';
                }
                // Don't continue with reset - wait for user to choose restart option
                PreviewSettings.resetToDefaults();
                PreviewSettings.savePreviewSettings();
                PreviewSettings.applyPreviewSettings(editor);
                return;
              }
            } catch (e) {
              console.error('Error resetting hardware acceleration setting:', e);
            }
          }
          
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
      
      // Handle restart buttons in settings panel
      const restartNowBtn = document.getElementById('restartNowBtn');
      const restartLaterBtn = document.getElementById('restartLaterBtn');
      
      if (restartNowBtn) {
        restartNowBtn.addEventListener('click', async () => {
          await handleRestartNow(status, editor);
        });
      }
      
      if (restartLaterBtn) {
        restartLaterBtn.addEventListener('click', () => {
          const restartPrompt = document.getElementById('restartPrompt');
          if (restartPrompt) {
            restartPrompt.style.display = 'none';
          }
        });
      }
      
      // Handle working directory selection button
      const selectWorkingDirBtn = document.getElementById('selectWorkingDirectoryBtn');
      if (selectWorkingDirBtn && window.electronAPI && window.electronAPI.isElectron) {
        selectWorkingDirBtn.addEventListener('click', async () => {
          try {
            const result = await window.electronAPI.selectWorkingDirectory();
            if (result && result.success) {
              const workingDirPath = document.getElementById('workingDirectoryPath');
              if (workingDirPath) {
                workingDirPath.value = result.path;
                // Update the original path so we know it changed
                workingDirPath.setAttribute('data-original-path', result.path);
                
                // Show restart confirmation modal immediately
                const restartModal = document.getElementById('restartConfirmModal');
                if (restartModal) {
                  // Update modal message to be specific about working directory
                  const modalBody = restartModal.querySelector('.restart-confirm-body p');
                  if (modalBody) {
                    modalBody.innerHTML = `The working directory has been changed to:<br><strong>${result.path}</strong><br><br>This requires a restart to take effect. Would you like to restart now?`;
                  }
                  restartModal.style.display = 'flex';
                  
                  // Store that this is a working directory restart
                  restartModal.setAttribute('data-restart-type', 'working-directory');
                } else {
                  // Fallback to inline prompt if modal not found
                  const restartPrompt = document.getElementById('workingDirectoryRestartPrompt');
                  if (restartPrompt) {
                    restartPrompt.style.display = 'block';
                  }
                }
              }
            } else {
              alert('Failed to select working directory');
            }
          } catch (e) {
            console.error('Error selecting working directory:', e);
            alert('Error selecting working directory: ' + e.message);
          }
        });
      }
      
      // Handle working directory restart buttons
      const workingDirRestartNowBtn = document.getElementById('workingDirectoryRestartNowBtn');
      const workingDirRestartLaterBtn = document.getElementById('workingDirectoryRestartLaterBtn');
      
      if (workingDirRestartNowBtn) {
        workingDirRestartNowBtn.addEventListener('click', async () => {
          await handleRestartNow(status, editor);
        });
      }
      
      if (workingDirRestartLaterBtn) {
        workingDirRestartLaterBtn.addEventListener('click', () => {
          const restartPrompt = document.getElementById('workingDirectoryRestartPrompt');
          if (restartPrompt) {
            restartPrompt.style.display = 'none';
          }
        });
      }
      
      // Handle restart confirmation modal buttons
      const restartConfirmBtn = document.getElementById('restartConfirmBtn');
      const restartCancelBtn = document.getElementById('restartCancelBtn');
      
      const restartConfirmModal = document.getElementById('restartConfirmModal');
      
      if (restartConfirmBtn) {
        restartConfirmBtn.addEventListener('click', async () => {
          if (restartConfirmModal) {
            restartConfirmModal.style.display = 'none';
          }
          // Also hide the inline restart prompt if it's visible
          const restartPrompt = document.getElementById('workingDirectoryRestartPrompt');
          if (restartPrompt) {
            restartPrompt.style.display = 'none';
          }
          await handleRestartNow(status, editor);
        });
      }
      
      if (restartCancelBtn) {
        restartCancelBtn.addEventListener('click', () => {
          if (restartConfirmModal) {
            restartConfirmModal.style.display = 'none';
          }
          // Also hide the inline restart prompt if it's visible
          const restartPrompt = document.getElementById('workingDirectoryRestartPrompt');
          if (restartPrompt) {
            restartPrompt.style.display = 'none';
          }
        });
      }
      
      // Close modal when clicking outside
      if (restartConfirmModal) {
        restartConfirmModal.addEventListener('click', (e) => {
          if (e.target === restartConfirmModal) {
            restartConfirmModal.style.display = 'none';
            // Also hide the inline restart prompt if it's visible
            const restartPrompt = document.getElementById('workingDirectoryRestartPrompt');
            if (restartPrompt) {
              restartPrompt.style.display = 'none';
            }
          }
        });
      }
      
      // Helper function to handle restart
      async function handleRestartNow(status, editor) {
        // Save all settings first
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
        
        PreviewSettings.savePreviewSettings();
        PreviewSettings.closeSettings(true);
        
        // Restart the app
        try {
          await window.electronAPI.restartApp();
        } catch (e) {
          console.error('Error restarting app:', e);
          if (status) {
            status.textContent = 'Error restarting app. Please restart manually.';
            status.className = 'status error';
            setTimeout(() => {
              status.textContent = 'Ready';
              status.className = 'status';
            }, 3000);
          }
        }
      }
      
      // Monitor hardware acceleration checkbox changes
      if (useHardwareAcceleration) {
        useHardwareAcceleration.addEventListener('change', async () => {
          if (window.electronAPI && window.electronAPI.isElectron) {
            try {
              // Get original value from PreviewSettings (stored when settings opened)
              const originalHwAccel = PreviewSettings.getOriginalHardwareAcceleration ? PreviewSettings.getOriginalHardwareAcceleration() : null;
              const newHwAccel = useHardwareAcceleration.checked;
              
              // Compare against original value
              let oldHwAccel = originalHwAccel;
              if (oldHwAccel === null || oldHwAccel === undefined) {
                oldHwAccel = await window.electronAPI.getHardwareAcceleration();
              }
              
              if (oldHwAccel !== newHwAccel) {
                // Don't save yet - just show the prompt
                // The actual save will happen when "Save Settings" is clicked
                const restartPrompt = document.getElementById('restartPrompt');
                if (restartPrompt) {
                  restartPrompt.style.display = 'block';
                }
              } else {
                const restartPrompt = document.getElementById('restartPrompt');
                if (restartPrompt) {
                  restartPrompt.style.display = 'none';
                }
              }
            } catch (e) {
              console.error('Error handling hardware acceleration change:', e);
            }
          }
        });
      }
    }
  };
})();
