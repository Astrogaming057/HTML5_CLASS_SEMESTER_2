window.PreviewUtils = {
  /**
   * Check if running in Electron app or browser
   * @returns {boolean} true if running in Electron app, false if in browser
   */
  isElectronApp() {
    return !!(window.electronAPI && window.electronAPI.isElectron);
  },

  getLanguage(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    if (ext === 'html' || ext === 'htm') {
      return 'html';
    }
    return 'html';
  },

  customPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
      const dialog = document.getElementById('customPromptDialog');
      const input = document.getElementById('customPromptInput');
      const titleEl = document.getElementById('customPromptTitle');
      const okBtn = document.getElementById('customPromptOk');
      const cancelBtn = document.getElementById('customPromptCancel');
      const closeBtn = document.getElementById('customPromptClose');
      
      titleEl.textContent = title;
      input.value = defaultValue;
      dialog.style.display = 'flex';
      input.focus();
      input.select();
      
      const cleanup = () => {
        dialog.style.display = 'none';
        input.value = '';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
        input.onkeydown = null;
      };
      
      const handleOk = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value || null);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };
      
      okBtn.onclick = handleOk;
      cancelBtn.onclick = handleCancel;
      closeBtn.onclick = handleCancel;
      
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          handleOk();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          handleCancel();
        }
      };
    });
  },

  customConfirm(message, showDiscard = false) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('customConfirmDialog');
      const messageEl = document.getElementById('customConfirmMessage');
      const okBtn = document.getElementById('customConfirmOk');
      const discardBtn = document.getElementById('customConfirmDiscard');
      const cancelBtn = document.getElementById('customConfirmCancel');
      const closeBtn = document.getElementById('customConfirmClose');
      
      messageEl.textContent = message;
      dialog.style.display = 'flex';
      
      if (discardBtn) {
        discardBtn.style.display = showDiscard ? 'inline-block' : 'none';
      }
      
      okBtn.focus();
      
      const cleanup = () => {
        dialog.style.display = 'none';
        okBtn.onclick = null;
        if (discardBtn) discardBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
        dialog.onkeydown = null;
      };
      
      const handleOk = () => {
        cleanup();
        resolve(true);
      };
      
      const handleDiscard = () => {
        cleanup();
        resolve('discard');
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      okBtn.onclick = handleOk;
      if (discardBtn) {
        discardBtn.onclick = handleDiscard;
      }
      cancelBtn.onclick = handleCancel;
      closeBtn.onclick = handleCancel;
      
      const handleKeydown = (e) => {
        if (e.key === 'Enter') {
          handleOk();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };
      dialog.onkeydown = handleKeydown;
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          handleCancel();
        }
      };
    });
  },

  generateLogId(message, logType, timestamp) {
    return `${message}_${logType}_${timestamp}`;
  }
};
