window.PreviewUtils = {
  /**
   * Check if running in Electron app or browser
   * @returns {boolean} true if running in Electron app, false if in browser
   */
  isElectronApp() {
    return !!(window.electronAPI && window.electronAPI.isElectron);
  },

  getLanguage(filePath) {
    if (!filePath || typeof filePath !== 'string') return 'plaintext';
    const base = filePath.split('/').pop().split('\\').pop() || '';
    const lower = base.toLowerCase();
    if (lower === 'dockerfile') return 'dockerfile';

    const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
    const languages = {
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'javascriptreact',
      ts: 'typescript',
      tsx: 'typescriptreact',
      html: 'html',
      htm: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      json: 'json',
      md: 'markdown',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      sh: 'shell',
      bash: 'shell',
      bat: 'bat',
      ps1: 'powershell',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      sql: 'sql',
      vue: 'html',
      txt: 'plaintext',
    };
    return languages[ext] || 'plaintext';
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

      window.PreviewUtils.resetConfirmDialogPresentation();

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

  /**
   * Reset shared confirm/alert dialog out of "terminal" presentation (used by customConfirm + customAlert).
   */
  resetConfirmDialogPresentation() {
    const dialog = document.getElementById('customConfirmDialog');
    const plainEl = document.getElementById('customConfirmMessage');
    const preEl = document.getElementById('customConfirmMessageTerminal');
    const titleEl = document.getElementById('customConfirmTitle');
    const contentEl = document.getElementById('customConfirmContent');
    if (dialog) dialog.classList.remove('custom-prompt-dialog--terminal');
    if (contentEl) contentEl.classList.remove('custom-prompt-content--terminal');
    if (plainEl) {
      plainEl.removeAttribute('hidden');
      plainEl.style.display = '';
    }
    if (preEl) {
      preEl.setAttribute('hidden', '');
      preEl.textContent = '';
    }
    if (titleEl) titleEl.textContent = 'Confirm';
  },

  /**
   * Simple OK-only dialog (Electron webviews often block window.alert).
   * @param {string} message
   * @param {{ terminal?: boolean, title?: string }} [options] - terminal: monospace + shell styling; title: header (default "remote")
   */
  customAlert(message, options) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('customConfirmDialog');
      const messageEl = document.getElementById('customConfirmMessage');
      const preEl = document.getElementById('customConfirmMessageTerminal');
      const titleEl = document.getElementById('customConfirmTitle');
      const contentEl = document.getElementById('customConfirmContent');
      const okBtn = document.getElementById('customConfirmOk');
      const discardBtn = document.getElementById('customConfirmDiscard');
      const cancelBtn = document.getElementById('customConfirmCancel');
      const closeBtn = document.getElementById('customConfirmClose');
      if (!dialog || !messageEl || !okBtn || !cancelBtn) {
        console.error(message);
        resolve();
        return;
      }

      const opts = options && typeof options === 'object' ? options : {};
      const asTerminal = !!opts.terminal;

      window.PreviewUtils.resetConfirmDialogPresentation();

      const prevCancelDisplay = cancelBtn.style.display;
      const prevDiscardDisplay = discardBtn ? discardBtn.style.display : '';

      if (asTerminal && preEl && titleEl) {
        dialog.classList.add('custom-prompt-dialog--terminal');
        if (contentEl) contentEl.classList.add('custom-prompt-content--terminal');
        titleEl.textContent = opts.title || 'remote';
        messageEl.setAttribute('hidden', '');
        messageEl.textContent = '';
        preEl.removeAttribute('hidden');
        preEl.textContent = message == null ? '' : String(message);
      } else {
        messageEl.textContent = message == null ? '' : String(message);
        if (preEl) {
          preEl.setAttribute('hidden', '');
          preEl.textContent = '';
        }
      }

      dialog.style.display = 'flex';
      cancelBtn.style.display = 'none';
      if (discardBtn) discardBtn.style.display = 'none';

      const cleanup = () => {
        dialog.style.display = 'none';
        cancelBtn.style.display = prevCancelDisplay;
        if (discardBtn) discardBtn.style.display = prevDiscardDisplay;
        okBtn.onclick = null;
        closeBtn.onclick = null;
        dialog.onclick = null;
        dialog.onkeydown = null;
        window.PreviewUtils.resetConfirmDialogPresentation();
        resolve();
      };

      okBtn.onclick = cleanup;
      closeBtn.onclick = cleanup;
      dialog.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          cleanup();
        }
      };
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          cleanup();
        }
      };
      okBtn.focus();
    });
  },

  generateLogId(message, logType, timestamp) {
    return `${message}_${logType}_${timestamp}`;
  },

  isPreviewLoopbackHost() {
    const h = String(window.location.hostname || '').toLowerCase();
    return (
      h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
    );
  },

  /** Loopback base for this Astro Code server (injected as __ASTRO_PREVIEW_LOCAL_ORIGIN__). */
  getPreviewLoopbackBase() {
    let o = window.__ASTRO_PREVIEW_LOCAL_ORIGIN__;
    if (o && typeof o === 'string') {
      return o.replace(/\/+$/, '');
    }
    const p = window.location.port;
    return 'http://127.0.0.1:' + (p || '17456');
  },

  /**
   * After P2P/handoff the tab may be on a LAN host; local + remote-switch flows should use loopback.
   * @returns {boolean} true if navigation was started (caller should not reload)
   */
  redirectPreviewToLoopbackIfNeeded() {
    try {
      if (this.isPreviewLoopbackHost()) {
        return false;
      }
      const path = window.location.pathname || '';
      if (path.indexOf('/__preview__') !== 0) {
        return false;
      }
      const base = this.getPreviewLoopbackBase();
      const url =
        base + path + (window.location.search || '') + (window.location.hash || '');
      window.location.assign(url);
      return true;
    } catch (_e) {
      return false;
    }
  }
};
