/**
 * VS Code–style bottom status bar: cursor, indent, encoding, EOL, language, zoom, notifications.
 * Requires #editorStatusBar in the DOM and Monaco editor passed to init(editor).
 */
window.PreviewStatusBar = (function () {
  let editorRef = null;
  let problemNavIndex = -1;
  const notifications = [];
  let notificationsDnd = false;
  let statusToastStack = null;
  const FONT_STEPS = [10, 12, 14, 16, 18, 20, 22];

  const LANG_LABELS = {
    plaintext: 'Plain Text',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    json: 'JSON',
    markdown: 'Markdown',
    xml: 'XML',
    yaml: 'YAML',
    python: 'Python',
    java: 'Java',
    csharp: 'C#',
    cpp: 'C++',
    c: 'C',
    rust: 'Rust',
    go: 'Go',
    php: 'PHP',
    ruby: 'Ruby',
    shell: 'Shell',
    powershell: 'PowerShell',
    sql: 'SQL',
    ini: 'INI',
    dockerfile: 'Dockerfile'
  };

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatLanguage(id) {
    if (!id || id === 'plaintext') return 'Plain Text';
    const lower = String(id).toLowerCase();
    if (LANG_LABELS[lower]) return LANG_LABELS[lower];
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function updateZoomLabel() {
    const btn = document.getElementById('statusZoomBtn');
    if (!btn || !editorRef) return;
    const fs = editorRef.getOption(monaco.editor.EditorOption.fontSize);
    btn.textContent = '🔍 ' + fs + 'px';
  }

  /** Short label for server root (BASE_DIR); full path in title tooltip */
  function formatWorkspaceShort(normalizedPath) {
    const p = (normalizedPath || '').replace(/\\/g, '/').trim();
    if (!p) return '📁 —';
    const parts = p.split('/').filter(Boolean);
    if (parts.length === 0) return '📁 /';
    const tail = parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p;
    return '📁 ' + tail;
  }

  function refreshWorkspacePath() {
    const el = document.getElementById('statusWorkspace');
    if (!el) return;
    fetch('/__api__/debug/base-dir', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      })
      .then(function (data) {
        const raw =
          (data && (data.resolvedBaseDir || data.baseDir || data.envBaseDir)) != null
            ? String(data.resolvedBaseDir || data.baseDir || data.envBaseDir)
            : '';
        const p = raw.replace(/\\/g, '/');
        el.title = p || '';
        el.textContent = formatWorkspaceShort(p);
      })
      .catch(function () {
        el.textContent = '📁 —';
        el.title = '';
      });
  }

  function refresh() {
    if (!editorRef) return;
    const model = editorRef.getModel();
    const cursorEl = document.getElementById('statusCursor');
    const indentEl = document.getElementById('statusIndent');
    const eolEl = document.getElementById('statusEol');
    const langEl = document.getElementById('statusLangLabel');

    if (!model) {
      if (cursorEl) cursorEl.textContent = 'Ln 1, Col 1';
      if (indentEl) indentEl.textContent = '—';
      if (eolEl) eolEl.textContent = 'LF';
      if (langEl) langEl.textContent = 'Plain Text';
      updateZoomLabel();
      updateProblemsCount();
      return;
    }

    const pos = editorRef.getPosition();
    let cursorText = 'Ln ' + pos.lineNumber + ', Col ' + pos.column;
    const sel = editorRef.getSelection();
    if (sel && !sel.isEmpty()) {
      const text = model.getValueInRange(sel);
      const n = text.length;
      cursorText += n ? ' | ' + n + (n === 1 ? ' char' : ' chars') : '';
    }
    if (cursorEl) cursorEl.textContent = cursorText;

    const opts = model.getOptions();
    if (indentEl) {
      indentEl.textContent = opts.insertSpaces
        ? 'Spaces: ' + opts.tabSize
        : 'Tab: ' + opts.tabSize;
    }

    if (eolEl) {
      const eol = model.getEOL();
      eolEl.textContent = eol === '\r\n' ? 'CRLF' : eol === '\r' ? 'CR' : 'LF';
    }

    if (langEl) {
      langEl.textContent = formatLanguage(model.getLanguageId());
    }

    updateZoomLabel();
  }

  /**
   * Count Monaco diagnostics (errors / warnings) for the active model.
   * Uses built-in language validation (HTML/CSS/JSON/TS/JS) when available.
   */
  function updateProblemsCount() {
    const errEl = document.getElementById('statusErrorCount');
    const warnEl = document.getElementById('statusWarningCount');
    const btn = document.getElementById('statusProblemsBtn');
    if (!errEl || !warnEl) return;

    if (!editorRef || typeof monaco === 'undefined') {
      errEl.textContent = '0';
      warnEl.textContent = '0';
      if (btn) btn.setAttribute('title', 'Problems — no editor');
      return;
    }

    const model = editorRef.getModel();
    if (!model) {
      errEl.textContent = '0';
      warnEl.textContent = '0';
      if (btn) btn.setAttribute('title', 'Problems — click to jump to next error or warning');
      return;
    }

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    let errors = 0;
    let warnings = 0;
    const Sev = monaco.MarkerSeverity;
    for (let i = 0; i < markers.length; i++) {
      const s = markers[i].severity;
      if (s === Sev.Error) errors++;
      else if (s === Sev.Warning) warnings++;
    }

    errEl.textContent = String(errors);
    warnEl.textContent = String(warnings);

    const total = errors + warnings;
    if (btn) {
      btn.setAttribute(
        'title',
        total
          ? errors + ' error(s), ' + warnings + ' warning(s) — click to open Problems tab and jump to next'
          : 'No problems — click opens Problems tab'
      );
    }
  }

  function goToNextProblem() {
    if (!editorRef || typeof monaco === 'undefined') return;
    const model = editorRef.getModel();
    if (!model) return;

    if (
      window.PreviewProblemsPanel &&
      typeof window.PreviewProblemsPanel.revealProblemsTab === 'function'
    ) {
      window.PreviewProblemsPanel.revealProblemsTab();
    }

    const Sev = monaco.MarkerSeverity;
    const markers = monaco.editor
      .getModelMarkers({ resource: model.uri })
      .filter(function (m) {
        return m.severity === Sev.Error || m.severity === Sev.Warning;
      })
      .sort(function (a, b) {
        if (a.startLineNumber !== b.startLineNumber) return a.startLineNumber - b.startLineNumber;
        return a.startColumn - b.startColumn;
      });

    if (markers.length === 0) return;

    problemNavIndex = (problemNavIndex + 1) % markers.length;
    const m = markers[problemNavIndex];
    editorRef.setPosition({
      lineNumber: m.startLineNumber,
      column: m.startColumn
    });
    editorRef.revealRangeInCenter(
      {
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn
      },
      monaco.editor.ScrollType.Smooth
    );
    editorRef.focus();
  }

  function renderNotificationsList() {
    const list = document.getElementById('statusNotificationsList');
    const empty = document.getElementById('statusNotificationsEmpty');
    if (!list || !empty) return;
    if (notifications.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = notifications
      .map(function (n) {
        const time = new Date(n.at).toLocaleTimeString();
        return (
          '<li class="editor-status-notifications-item">' +
          '<span class="editor-status-notifications-time">' +
          escapeHtml(time) +
          '</span>' +
          '<span class="editor-status-notifications-title">' +
          escapeHtml(n.title) +
          '</span>' +
          (n.sub
            ? '<span class="editor-status-notifications-sub">' + escapeHtml(n.sub) + '</span>'
            : '') +
          '</li>'
        );
      })
      .join('');
  }

  function updateBadge() {
    const badge = document.getElementById('statusNotifBadge');
    if (!badge) return;
    const n = notifications.length;
    if (n === 0) {
      badge.setAttribute('hidden', '');
      badge.textContent = '0';
    } else {
      badge.removeAttribute('hidden');
      badge.textContent = n > 99 ? '99+' : String(n);
    }
  }

  function loadNotificationsDnd() {
    try {
      notificationsDnd = sessionStorage.getItem('previewNotificationsDnd') === '1';
    } catch (e) {
      notificationsDnd = false;
    }
  }

  function saveNotificationsDnd() {
    try {
      sessionStorage.setItem('previewNotificationsDnd', notificationsDnd ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function updateDndToolbarButton() {
    const btn = document.getElementById('statusNotificationsDnd');
    if (!btn) return;
    btn.classList.toggle('is-active', notificationsDnd);
    btn.setAttribute('aria-pressed', notificationsDnd ? 'true' : 'false');
    btn.title = notificationsDnd ? 'Resume notifications' : 'Do not disturb';
    const icon = btn.querySelector('.notif-dnd-icon');
    if (icon) {
      icon.textContent = notificationsDnd ? '🔕' : '🔔';
    }
  }

  function clearNotificationsList() {
    notifications.length = 0;
    renderNotificationsList();
    updateBadge();
  }

  function recordClientEvent(title, sub) {
    if (notificationsDnd) return;
    notifications.unshift({
      at: Date.now(),
      title: title || '',
      sub: sub || ''
    });
    while (notifications.length > 40) {
      notifications.pop();
    }
    renderNotificationsList();
    updateBadge();
  }

  /** Toast + notification list (used for remote tunnel viewer connect/disconnect). */
  function showStatusToast(title, sub) {
    if (notificationsDnd) return;
    recordClientEvent(title, sub || '');
    if (!statusToastStack) {
      statusToastStack = document.createElement('div');
      statusToastStack.className = 'status-bar-toast-stack';
      statusToastStack.setAttribute('aria-live', 'polite');
      document.body.appendChild(statusToastStack);
    }
    const t = document.createElement('div');
    t.className = 'status-bar-toast';
    t.innerHTML =
      '<div class="status-bar-toast-title">' +
      escapeHtml(title) +
      '</div>' +
      (sub
        ? '<div class="status-bar-toast-sub">' + escapeHtml(sub) + '</div>'
        : '');
    statusToastStack.appendChild(t);
    setTimeout(function () {
      t.classList.add('status-bar-toast-out');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 300);
    }, 4200);
  }

  function cycleFontSize() {
    if (!editorRef || !window.PreviewSettings) return;
    const cur = editorRef.getOption(monaco.editor.EditorOption.fontSize);
    let idx = FONT_STEPS.indexOf(cur);
    if (idx < 0) {
      idx = FONT_STEPS.reduce(function (best, x, i) {
        return Math.abs(x - cur) < Math.abs(FONT_STEPS[best] - cur) ? i : best;
      }, 0);
    }
    const next = FONT_STEPS[(idx + 1) % FONT_STEPS.length];
    PreviewSettings.setSettings({ editorFontSize: next });
    PreviewSettings.savePreviewSettings();
    editorRef.updateOptions({ fontSize: next });
    updateZoomLabel();
    try {
      const el = document.getElementById('editorFontSize');
      if (el) el.value = String(next);
    } catch (e) {
      /* ignore */
    }
  }

  function closeAllPopoversExcept(exceptPopoverEl) {
    ['clientSessionsPopover', 'remoteViewersPopover', 'statusNotificationsPopover'].forEach(
      function (id) {
        const el = document.getElementById(id);
        if (el && el !== exceptPopoverEl) {
          el.setAttribute('hidden', '');
        }
      }
    );
  }

  function setupNotificationsUi() {
    const btn = document.getElementById('statusNotificationsBtn');
    const pop = document.getElementById('statusNotificationsPopover');
    if (!btn || !pop) return;

    loadNotificationsDnd();
    updateDndToolbarButton();

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = pop.hasAttribute('hidden');
      if (open) {
        closeAllPopoversExcept(pop);
        pop.removeAttribute('hidden');
        renderNotificationsList();
      } else {
        pop.setAttribute('hidden', '');
      }
    });

    const clearBtn = document.getElementById('statusNotificationsClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearNotificationsList();
      });
    }

    const dndBtn = document.getElementById('statusNotificationsDnd');
    if (dndBtn) {
      dndBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        notificationsDnd = !notificationsDnd;
        saveNotificationsDnd();
        updateDndToolbarButton();
      });
    }

    const closeBtn = document.getElementById('statusNotificationsClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        pop.setAttribute('hidden', '');
      });
    }

    pop.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('click', function () {
      if (pop && !pop.hasAttribute('hidden')) {
        pop.setAttribute('hidden', '');
      }
    });
  }

  function init(editor) {
    editorRef = editor;
    const zoomBtn = document.getElementById('statusZoomBtn');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', function (e) {
        e.preventDefault();
        cycleFontSize();
      });
    }

    setupNotificationsUi();
    renderNotificationsList();
    updateBadge();

    const problemsBtn = document.getElementById('statusProblemsBtn');
    if (problemsBtn) {
      problemsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goToNextProblem();
      });
    }

    editor.onDidChangeCursorPosition(function () {
      refresh();
    });
    editor.onDidChangeCursorSelection(function () {
      refresh();
    });
    editor.onDidChangeModelContent(function () {
      refresh();
    });
    editor.onDidChangeModel(function () {
      problemNavIndex = -1;
      refresh();
      updateProblemsCount();
    });

    if (typeof monaco !== 'undefined' && monaco.editor && typeof monaco.editor.onDidChangeMarkers === 'function') {
      monaco.editor.onDidChangeMarkers(function () {
        updateProblemsCount();
      });
    }

    refresh();
    updateProblemsCount();
    refreshWorkspacePath();
  }

  return {
    init: init,
    refresh: refresh,
    refreshWorkspacePath: refreshWorkspacePath,
    recordClientEvent: recordClientEvent,
    showStatusToast: showStatusToast,
    closeAllPopoversExcept: closeAllPopoversExcept
  };
})();
