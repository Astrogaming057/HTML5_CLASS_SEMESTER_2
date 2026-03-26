/**
 * Electron main-window close: respond to main process so closing is not blocked
 * silently; report progress for “hang” diagnostics.
 *
 * Client-side hang timer starts first on title-bar ✕ (armClose), before window.close / IPC,
 * so the 5s window is measured from the actual click.
 */
window.PreviewElectronClose = (function() {
  let flowActive = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let hangUiTimer = null;
  let lastProgressStage = '';

  const HANG_UI_DELAY_MS = 5000;

  function yieldToMacrotask() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  function clearHangUiTimer() {
    if (hangUiTimer) {
      clearTimeout(hangUiTimer);
      hangUiTimer = null;
    }
  }

  function scheduleHangUiTimer() {
    clearHangUiTimer();
    hangUiTimer = setTimeout(function () {
      hangUiTimer = null;
      tryShowHangDialog();
    }, HANG_UI_DELAY_MS);
  }

  function clearClientCloseArm() {
    try {
      delete window.__closeHangClientArmed;
    } catch (_e) {
      window.__closeHangClientArmed = false;
    }
  }

  function tryShowHangDialog() {
    const clientArmed = !!window.__closeHangClientArmed;
    const ipcReady = flowActive && window.__appClosing;
    if (!ipcReady && !clientArmed) return;

    const el = ensureHangOverlay();
    applyHangDialogContent();
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    const waitBtn = document.getElementById('electronCloseHangWait');
    if (waitBtn) waitBtn.focus();
  }

  function applyHangDialogContent() {
    const title = document.getElementById('electronCloseHangTitle');
    const lead = document.getElementById('electronCloseHangLead');
    const progress = document.getElementById('electronCloseHangProgress');
    if (title) {
      title.textContent = 'Close is taking longer than usual';
    }
    if (lead) {
      lead.textContent =
        'This is taking longer than usual — it appears the close process may be hanging. ' +
        'You can keep waiting for a clean shutdown or force the app to exit.';
    }
    if (progress) {
      progress.textContent = lastProgressStage
        ? 'Latest step: ' + lastProgressStage
        : 'Waiting for the editor and background tasks to finish…';
    }
  }

  function ensureHangOverlay() {
    let el = document.getElementById('electronCloseHangOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'electronCloseHangOverlay';
    el.className = 'electron-close-hang-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'electronCloseHangTitle');
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<div class="electron-close-hang-dialog">' +
      '<div class="electron-close-hang-badge" aria-hidden="true">Slow close</div>' +
      '<h2 id="electronCloseHangTitle" class="electron-close-hang-title">Close is taking longer than usual</h2>' +
      '<p id="electronCloseHangLead" class="electron-close-hang-lead"></p>' +
      '<p id="electronCloseHangProgress" class="electron-close-hang-progress"></p>' +
      '<div class="electron-close-hang-actions">' +
      '<button type="button" class="btn btn-secondary electron-close-hang-wait" id="electronCloseHangWait">Keep waiting</button>' +
      '<button type="button" class="btn electron-close-hang-force" id="electronCloseHangForce">Force close</button>' +
      '</div>' +
      '<p class="electron-close-hang-footnote">Force close ends the process immediately and may discard unsaved changes.</p>' +
      '</div>';

    document.body.appendChild(el);

    document.getElementById('electronCloseHangForce').addEventListener('click', function () {
      const api = window.electronAPI;
      if (api && typeof api.forceCloseApp === 'function') {
        clearHangUiTimer();
        clearClientCloseArm();
        api.forceCloseApp();
      }
    });

    document.getElementById('electronCloseHangWait').addEventListener('click', function () {
      hideHangOverlay();
      window.__closeHangClientArmed = true;
      scheduleHangUiTimer();
    });

    return el;
  }

  function hideHangOverlay() {
    const el = document.getElementById('electronCloseHangOverlay');
    if (!el) return;
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
  }

  /**
   * Title-bar ✕: start the 5s client hang timer immediately (before window.close → IPC).
   */
  function armClose() {
    if (!window.electronAPI || !window.electronAPI.isElectron) return;
    window.__closeHangClientArmed = true;
    lastProgressStage = 'Close requested…';
    scheduleHangUiTimer();
  }

  function sendProgress(api, stage) {
    lastProgressStage = typeof stage === 'string' ? stage : String(stage);
    if (window.electronAPI && api && typeof api.sendCloseProgress === 'function') {
      try {
        api.sendCloseProgress(stage);
      } catch (_e) {
        /* ignore */
      }
    }
    const overlay = document.getElementById('electronCloseHangOverlay');
    const progressEl = document.getElementById('electronCloseHangProgress');
    if (overlay && !overlay.hasAttribute('hidden') && progressEl) {
      progressEl.textContent = 'Latest step: ' + lastProgressStage;
    }
  }

  /**
   * Dirty text tabs: active buffer from editor; inactive from tab snapshot (last switch).
   */
  function collectDirtyEditorSnapshots(isDirtyRef, getEditorValue, getFilePath) {
    const out = [];
    const getEditorValueSafe = typeof getEditorValue === 'function' ? getEditorValue : function () {
      return '';
    };
    const getFilePathSafe = typeof getFilePath === 'function' ? getFilePath : function () {
      return null;
    };

    const tm = window.PreviewTabManager;
    if (tm && typeof tm.getOpenTabs === 'function') {
      const tabs = tm.getOpenTabs();
      const active = typeof tm.getActiveTab === 'function' ? tm.getActiveTab() : null;
      if (tabs && tabs.length > 0) {
        for (let i = 0; i < tabs.length; i++) {
          const p = tabs[i];
          if (
            !p ||
            p.startsWith('browser://') ||
            p.startsWith('gitdiff://') ||
            p.startsWith('githistory://')
          ) {
            continue;
          }
          const info = typeof tm.getTabInfo === 'function' ? tm.getTabInfo(p) : null;
          const isActive = p === active;
          const tabDirty = isActive ? !!(isDirtyRef && isDirtyRef.current) : !!(info && info.isDirty);
          if (!tabDirty) continue;
          let content;
          if (isActive) content = getEditorValueSafe();
          else content = info ? info.content : undefined;
          if (content === undefined) continue;
          out.push({ path: p, content: content });
        }
        return out;
      }
    }

    const fp = getFilePathSafe();
    if (fp && isDirtyRef && isDirtyRef.current) {
      out.push({ path: fp, content: getEditorValueSafe() });
    }
    return out;
  }

  /**
   * If ide_editor_cache already matches the buffer, close without prompting.
   * Otherwise POST current buffer to cache; only prompt if sync fails.
   */
  function syncEditorSnapshotsWithServerCache(snapshots) {
    if (!snapshots.length) {
      return Promise.resolve({ ok: true });
    }
    return Promise.all(
      snapshots.map(function (snap) {
        const filePath = snap.path;
        const content = snap.content;
        return (async function () {
          try {
            const q = encodeURIComponent(filePath);
            const getRes = await fetch('/__api__/files/editor?path=' + q);
            const getData = await getRes.json();
            if (getData.success && getData.exists && getData.content === content) {
              return true;
            }
            const postRes = await fetch('/__api__/files/editor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, content: content })
            });
            const postData = await postRes.json();
            return postData.success === true;
          } catch (e) {
            console.error('[ElectronClose] editor cache sync', e);
            return false;
          }
        })();
      })
    ).then(function (results) {
      return { ok: results.every(Boolean) };
    });
  }

  return {
    armClose,

    setup(isDirty, wsRef, saveState, customConfirm, deps) {
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
        lastProgressStage = '';
        try {
          window.__appClosing = true;
          /**
           * If title bar already armed the client timer on ✕, do not reschedule — keeps 5s from click.
           * Otherwise (e.g. Alt+F4): start timer now.
           */
          if (!window.__closeHangClientArmed) {
            scheduleHangUiTimer();
          } else {
            clearClientCloseArm();
          }

          await yieldToMacrotask();

          sendProgress(api, 'Checking hex editor…');
          if (window.PreviewHexEditor && PreviewHexEditor.isActive && PreviewHexEditor.isActive()) {
            if (PreviewHexEditor.isDirty && PreviewHexEditor.isDirty()) {
              const ok = await customConfirm('Hex editor has unsaved changes. Close anyway?', true);
              if (!ok) {
                window.__appClosing = false;
                flowActive = false;
                clearHangUiTimer();
                clearClientCloseArm();
                hideHangOverlay();
                if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
                return;
              }
            }
          }

          sendProgress(api, 'Checking editor cache…');
          const getEditorValue = deps && typeof deps.getEditorValue === 'function' ? deps.getEditorValue : null;
          const getFilePath = deps && typeof deps.getFilePath === 'function' ? deps.getFilePath : null;
          const dirtySnapshots = collectDirtyEditorSnapshots(isDirty, getEditorValue, getFilePath);
          let needUnsavedConfirm = false;
          if (dirtySnapshots.length > 0) {
            const syncResult = await syncEditorSnapshotsWithServerCache(dirtySnapshots);
            if (!syncResult.ok) {
              needUnsavedConfirm = true;
            }
          } else if (isDirty && isDirty.current) {
            needUnsavedConfirm = true;
          }
          if (needUnsavedConfirm) {
            const ok = await customConfirm('You have unsaved changes. Are you sure you want to close?', true);
            if (!ok) {
              window.__appClosing = false;
              flowActive = false;
              clearHangUiTimer();
              clearClientCloseArm();
              hideHangOverlay();
              if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
              return;
            }
          }

          sendProgress(api, 'Saving workspace state…');
          try {
            if (typeof saveState === 'function') saveState();
          } catch (_e) {
            /* ignore */
          }

          await yieldToMacrotask();

          sendProgress(api, 'Closing WebSocket…');
          await new Promise(function (resolve) {
            setTimeout(function () {
              try {
                if (wsRef && wsRef.current) {
                  wsRef.current.close();
                }
              } catch (_e) {
                /* ignore */
              }
              resolve();
            }, 0);
          });
          await yieldToMacrotask();

          sendProgress(api, 'Finishing shutdown…');
          clearHangUiTimer();
          clearClientCloseArm();
          hideHangOverlay();
          if (typeof api.sendCloseReady === 'function') {
            api.sendCloseReady();
          }
        } catch (err) {
          console.error('[ElectronClose]', err);
          window.__appClosing = false;
          flowActive = false;
          clearHangUiTimer();
          clearClientCloseArm();
          hideHangOverlay();
          const msg = 'Error: ' + (err && err.message ? err.message : String(err));
          sendProgress(api, msg);
          if (typeof api.sendCloseAborted === 'function') api.sendCloseAborted();
        }
      });
    }
  };
})();
