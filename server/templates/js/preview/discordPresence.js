
window.PreviewDiscordPresence = (function () {
  let idleTimeoutMs = 300000;
  let idleTimer = null;
  let throttleTimer = null;
  let lastThrottlePush = 0;
  let editorRef = null;
  let getFilePath = null;
  let getCurrentDir = null;
  let getLanguageFn = null;
  let statusPollTimer = null;
  let statusPollIntervalMs = 1000;
  let moFile = null;
  let moWs = null;

  const THROTTLE_MS = 2000;

  function getProblemCounts(ed) {
    const out = {
      total: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      hints: 0
    };
    try {
      const m = ed && ed.getModel && ed.getModel();
      if (!m || typeof monaco === 'undefined' || !monaco.editor || !monaco.editor.getModelMarkers) {
        return out;
      }
      const markers = monaco.editor.getModelMarkers({ resource: m.uri });
      const Sev = monaco.MarkerSeverity;
      out.total = markers.length;
      for (let i = 0; i < markers.length; i++) {
        const s = markers[i].severity;
        if (s === Sev.Error) out.errors++;
        else if (s === Sev.Warning) out.warnings++;
        else if (s === Sev.Info) out.infos++;
        else if (s === Sev.Hint) out.hints++;
      }
    } catch (e) {
      /* ignore */
    }
    return out;
  }

  function buildPayload(isIdle) {
    const ed = editorRef;
    const filePath = getFilePath ? getFilePath() : '';
    const currentDir = getCurrentDir ? getCurrentDir() : '';
    let line = 1;
    let column = 1;
    let lineCount = 0;
    if (ed) {
      const pos = ed.getPosition && ed.getPosition();
      if (pos) {
        line = pos.lineNumber;
        column = pos.column;
      }
      const m = ed.getModel && ed.getModel();
      if (m && m.getLineCount) {
        lineCount = m.getLineCount();
      }
    }
    let language = 'plaintext';
    if (ed && ed.getModel && ed.getModel()) {
      language = ed.getModel().getLanguageId() || 'plaintext';
    } else if (filePath && getLanguageFn) {
      language = getLanguageFn(filePath) || 'plaintext';
    }
    const prob = getProblemCounts(ed);
    return {
      filePath: filePath || '',
      currentDir: currentDir || '',
      language: language || 'plaintext',
      line: line,
      column: column,
      lineCount: lineCount,
      problemsCount: prob.total,
      problemErrors: prob.errors,
      problemWarnings: prob.warnings,
      problemInfos: prob.infos,
      problemHints: prob.hints,
      isIdle: !!isIdle,
      gitBranch: typeof window.__previewDiscordGitBranch === 'string' ? window.__previewDiscordGitBranch : '',
      gitRepo: typeof window.__previewDiscordGitRepo === 'string' ? window.__previewDiscordGitRepo : '',
      gitOwner: typeof window.__previewDiscordGitOwner === 'string' ? window.__previewDiscordGitOwner : ''
    };
  }

  function applyStatusToBar(st) {
    const btn = document.getElementById('statusDiscordRpc');
    const sep = document.getElementById('statusDiscordSep');
    if (!btn) return;
    if (!window.electronAPI || !window.electronAPI.isElectron) {
      btn.hidden = true;
      if (sep) sep.hidden = true;
      return;
    }
    if (!st || !st.enabled) {
      btn.hidden = true;
      if (sep) sep.hidden = true;
      btn.title = '';
      if (statusPollIntervalMs !== 5000) {
        statusPollIntervalMs = 5000;
        scheduleStatusPoll();
      }
      return;
    }

    btn.hidden = false;
    if (sep) sep.hidden = false;

    btn.classList.remove(
      'is-discord-live',
      'is-discord-error',
      'is-discord-off',
      'is-discord-disabled',
      'is-discord-connecting'
    );

    if (!st.clientIdConfigured) {
      btn.textContent = 'RPC: No App ID';
      btn.title = 'Set Application ID in Settings';
      btn.classList.add('is-discord-error');
    } else if (st.connecting) {
      btn.textContent = 'RPC: Connecting...';
      btn.title = 'Connecting to Discord…';
      btn.classList.add('is-discord-connecting');
    } else if (st.connected) {
      btn.textContent = 'RPC Connected';
      const parts = [];
      if (st.lastSummary) parts.push('Last: ' + st.lastSummary);
      if (st.lastOkAt) {
        try {
          parts.push('Updated ' + new Date(st.lastOkAt).toLocaleTimeString());
        } catch (_e) {
          /* ignore */
        }
      }
      btn.title = parts.join('\n') || 'Connected to Discord';
      btn.classList.add('is-discord-live');
    } else {
      btn.textContent = 'RPC: Disconnected';
      btn.title =
        (st.lastError ? 'Error: ' + st.lastError + '\n' : '') +
        'Tip: start the Discord desktop app and check your Application ID.';
      btn.classList.add('is-discord-error');
    }

    if (window.electronAPI && st) {
      const wantFast =
        st.enabled &&
        st.clientIdConfigured &&
        !st.connected &&
        (st.connecting || !st.lastError);
      const nextMs = wantFast ? 1200 : 5000;
      if (nextMs !== statusPollIntervalMs) {
        statusPollIntervalMs = nextMs;
        scheduleStatusPoll();
      }
    }
  }

  function scheduleStatusPoll() {
    if (statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
    statusPollTimer = setInterval(function () {
      refreshStatusBar();
    }, statusPollIntervalMs);
  }

  function refreshStatusBar() {
    if (!window.electronAPI || typeof window.electronAPI.discordGetStatus !== 'function') {
      applyStatusToBar(null);
      return Promise.resolve();
    }
    return window.electronAPI.discordGetStatus().then(applyStatusToBar).catch(function () {
      applyStatusToBar({ enabled: false });
    });
  }

  function push(isIdle) {
    if (!window.electronAPI || typeof window.electronAPI.discordUpdateActivity !== 'function') {
      return Promise.resolve();
    }
    return window.electronAPI
      .discordUpdateActivity(buildPayload(isIdle))
      .then(function (res) {
        applyStatusToBar(res);
      })
      .catch(function (e) {
        console.warn('Discord update activity:', e);
        refreshStatusBar();
      });
  }

  function scheduleIdle() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    idleTimer = setTimeout(function () {
      idleTimer = null;
      push(true);
    }, idleTimeoutMs);
  }

  function onActivity() {
    scheduleIdle();
    const now = Date.now();
    if (now - lastThrottlePush < THROTTLE_MS) {
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
      throttleTimer = setTimeout(function () {
        throttleTimer = null;
        lastThrottlePush = Date.now();
        push(false);
      }, THROTTLE_MS - (now - lastThrottlePush));
      return;
    }
    lastThrottlePush = now;
    push(false);
  }

  function onGitMetadataUpdated() {
    lastThrottlePush = 0;
    onActivity();
  }

  function wireStatusBarClick() {
    const btn = document.getElementById('statusDiscordRpc');
    if (!btn || btn.dataset.discordClickBound) return;
    btn.dataset.discordClickBound = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.PreviewSettings && typeof window.PreviewSettings.openSettings === 'function') {
        window.PreviewSettings.openSettings();
      }
      setTimeout(function () {
        const det = document.querySelector('.settings-discord-dropdown');
        if (det) {
          try {
            det.open = true;
          } catch (_err) {
            /* ignore */
          }
          det.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 100);
    });
  }

  function wireMutationObservers() {
    const fileNameEl = document.getElementById('fileName');
    if (fileNameEl && typeof MutationObserver !== 'undefined' && !moFile) {
      moFile = new MutationObserver(function () {
        lastThrottlePush = 0;
        onActivity();
      });
      moFile.observe(fileNameEl, { childList: true, characterData: true, subtree: true });
    }
    const wsEl = document.getElementById('statusWorkspace');
    if (wsEl && typeof MutationObserver !== 'undefined' && !moWs) {
      moWs = new MutationObserver(function () {
        lastThrottlePush = 0;
        onActivity();
      });
      moWs.observe(wsEl, { childList: true, characterData: true, subtree: true, attributes: true });
    }
  }

  function refreshConfig() {
    if (!window.electronAPI || typeof window.electronAPI.discordGetConfig !== 'function') {
      return Promise.resolve();
    }
    return window.electronAPI.discordGetConfig().then(function (res) {
      const sec = res && res.config && res.config.idleTimeoutSec;
      const n = parseInt(String(sec != null ? sec : 300), 10);
      idleTimeoutMs = Number.isFinite(n) ? Math.min(86400000, Math.max(30000, n * 1000)) : 300000;
      applyStatusToBar(res);
      scheduleIdle();
    });
  }

  function startStatusPolling() {
    statusPollIntervalMs = 5000;
    scheduleStatusPoll();
  }

  function init(opts) {
    if (!window.electronAPI || !window.electronAPI.isElectron) {
      return;
    }
    editorRef = opts && opts.editor;
    getFilePath = opts && opts.getFilePath;
    getCurrentDir = opts && opts.getCurrentDir;
    getLanguageFn = opts && opts.getLanguage;
    if (!editorRef) {
      return;
    }

    wireStatusBarClick();
    wireMutationObservers();
    startStatusPolling();

    refreshConfig().then(function () {
      onActivity();
    });
    refreshStatusBar();

    if (editorRef.onDidChangeCursorPosition) {
      editorRef.onDidChangeCursorPosition(function () {
        onActivity();
      });
    }
    if (editorRef.onDidChangeModelContent) {
      editorRef.onDidChangeModelContent(function () {
        onActivity();
      });
    }
    if (editorRef.onDidChangeModel) {
      editorRef.onDidChangeModel(function () {
        lastThrottlePush = 0;
        onActivity();
      });
    }

    try {
      if (typeof monaco !== 'undefined' && monaco.editor && typeof monaco.editor.onDidChangeMarkers === 'function') {
        monaco.editor.onDidChangeMarkers(function () {
          onActivity();
        });
      }
    } catch (_e) {
      /* older Monaco builds */
    }

    window.addEventListener('focus', function () {
      onActivity();
    });
  }

  return {
    init: init,
    refreshConfig: refreshConfig,
    refreshStatusBar: refreshStatusBar,
    onGitMetadataUpdated: onGitMetadataUpdated
  };
})();
