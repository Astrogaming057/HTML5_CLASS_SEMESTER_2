/**
 * Electron main-window close: respond to main process so closing is not blocked
 * silently; report progress for “hang” diagnostics.
 */
window.PreviewElectronClose = (function() {
  let flowActive = false;

  function sendProgress(api, stage) {
    if (api && typeof api.sendCloseProgress === 'function') {
      try {
        api.sendCloseProgress(stage);
      } catch (_e) { /* ignore */ }
    }
  }

  return {
    setup(isDirty, wsRef, saveState, customConfirm) {
      const api = window.electronAPI;
      if (!api || typeof api.onAppCloseRequest !== 'function') {
        return;
      }

      api.onAppCloseRequest(async (_payload) => {
        if (flowActive) {
          sendProgress(api, 'Close already in progress…');
          return;
        }
        flowActive = true;
        try {
          window.__appClosing = true;
          sendProgress(api, 'Checking hex editor…');
          if (window.PreviewHexEditor && PreviewHexEditor.isActive && PreviewHexEditor.isActive()) {
            if (PreviewHexEditor.isDirty && PreviewHexEditor.isDirty()) {
              const ok = await customConfirm('Hex editor has unsaved changes. Close anyway?', true);
              if (!ok) {
                window.__appClosing = false;
                flowActive = false;
                if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
                return;
              }
            }
          }

          sendProgress(api, 'Checking editor tabs…');
          if (isDirty && isDirty.current) {
            const ok = await customConfirm('You have unsaved changes. Are you sure you want to close?', true);
            if (!ok) {
              window.__appClosing = false;
              flowActive = false;
              if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
              return;
            }
          }

          sendProgress(api, 'Saving workspace state…');
          try {
            if (typeof saveState === 'function') saveState();
          } catch (_e) { /* ignore */ }

          sendProgress(api, 'Closing WebSocket…');
          if (wsRef && wsRef.current) {
            try {
              wsRef.current.close();
            } catch (_e) { /* ignore */ }
          }

          sendProgress(api, 'Finishing shutdown…');
          if (typeof api.sendCloseReady === 'function') {
            api.sendCloseReady();
          }
        } catch (err) {
          console.error('[ElectronClose]', err);
          window.__appClosing = false;
          flowActive = false;
          sendProgress(api, 'Error: ' + (err && err.message ? err.message : String(err)));
          if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
        }
      });
    }
  };
})();
