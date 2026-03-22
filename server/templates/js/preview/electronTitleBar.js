/**
 * Custom top bar: Electron (frameless window controls) or browser (same layout, window buttons hidden).
 */
window.PreviewElectronTitleBar = (function () {
  function updateMaxButton(btn, maximized) {
    if (!btn) return;
    btn.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
    btn.setAttribute('title', maximized ? 'Restore' : 'Maximize');
    btn.textContent = maximized ? '\u25a3' : '\u25a1';
  }

  function init() {
    const bar = document.getElementById('electronTitleBar');
    if (!bar) {
      return;
    }

    const api = window.electronAPI;
    const isElectron = api && api.isElectron;

    if (isElectron) {
      document.body.classList.add('electron-frameless');
      if (api.platform === 'darwin') {
        bar.classList.add('electron-title-bar--mac');
      }
    } else {
      document.body.classList.add('preview-browser-titlebar');
    }

    bar.hidden = false;

    const toolbarSlot = document.getElementById('electronTitleToolbarSlot');
    const previewActions = document.getElementById('previewHeaderActions');
    if (toolbarSlot && previewActions) {
      toolbarSlot.appendChild(previewActions);
      previewActions.classList.add('preview-actions--titlebar');
    }

    const electronTitleText = bar.querySelector('.electron-title-text');
    const modeIndicator = document.getElementById('modeIndicator');
    if (electronTitleText && modeIndicator) {
      electronTitleText.insertAdjacentElement('afterend', modeIndicator);
      modeIndicator.classList.add('mode-indicator--titlebar');
    }

    if (!isElectron) {
      return;
    }

    const minBtn = document.getElementById('electronTitleMinBtn');
    const maxBtn = document.getElementById('electronTitleMaxBtn');
    const closeBtn = document.getElementById('electronTitleCloseBtn');
    const drag = bar.querySelector('.electron-title-drag');

    if (minBtn) {
      minBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof api.minimizeWindow === 'function') {
          api.minimizeWindow();
        }
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof api.maximizeToggleWindow === 'function') {
          api.maximizeToggleWindow().then(function (res) {
            if (res && typeof res.maximized === 'boolean') {
              updateMaxButton(maxBtn, res.maximized);
            }
          });
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.close();
      });
    }

    if (typeof api.isWindowMaximized === 'function') {
      api.isWindowMaximized().then(function (m) {
        updateMaxButton(maxBtn, !!m);
      });
    }

    if (typeof api.onWindowChromeState === 'function') {
      api.onWindowChromeState(function (state) {
        if (state && typeof state.maximized === 'boolean') {
          updateMaxButton(maxBtn, state.maximized);
        }
      });
    }

    if (drag) {
      drag.addEventListener('dblclick', function (e) {
        if (e.target.closest('.electron-title-btn')) return;
        if (e.target.closest('.mode-indicator')) return;
        if (typeof api.maximizeToggleWindow === 'function') {
          api.maximizeToggleWindow().then(function (res) {
            if (res && typeof res.maximized === 'boolean') {
              updateMaxButton(maxBtn, res.maximized);
            }
          });
        }
      });
    }
  }

  return { init: init };
})();
