/**
 * IDE-style Problems list for the active Monaco model (errors / warnings / info).
 * Tab: bottom panel → Problems (see preview.html).
 */
window.PreviewProblemsPanel = (function () {
  let editorRef = null;
  let refreshScheduled = false;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function uriBasename(uri) {
    if (!uri || !uri.path) return '';
    const p = String(uri.path).replace(/\\/g, '/');
    const parts = p.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : p;
  }

  function getMarkersForModel(model) {
    if (!model || typeof monaco === 'undefined') return [];
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const Sev = monaco.MarkerSeverity;
    return markers
      .filter(function (m) {
        return (
          m.severity === Sev.Error ||
          m.severity === Sev.Warning ||
          m.severity === Sev.Info ||
          m.severity === Sev.Hint
        );
      })
      .sort(function (a, b) {
        if (a.startLineNumber !== b.startLineNumber) return a.startLineNumber - b.startLineNumber;
        return a.startColumn - b.startColumn;
      });
  }

  function severityClass(sev) {
    const Sev = monaco.MarkerSeverity;
    if (sev === Sev.Error) return 'problems-row-severity-error';
    if (sev === Sev.Warning) return 'problems-row-severity-warning';
    if (sev === Sev.Info) return 'problems-row-severity-info';
    return 'problems-row-severity-hint';
  }

  function severityIcon(sev) {
    const Sev = monaco.MarkerSeverity;
    if (sev === Sev.Error) return '×';
    if (sev === Sev.Warning) return '⚠';
    if (sev === Sev.Info) return 'ⓘ';
    return '·';
  }

  function goToMarker(m) {
    if (!editorRef || !m) return;
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

  function render() {
    const listEl = document.getElementById('problemsPanelList');
    const emptyEl = document.getElementById('problemsPanelEmpty');
    const countEl = document.getElementById('problemsPanelCount');
    const fileEl = document.getElementById('problemsPanelFile');
    if (!listEl || !emptyEl) return;

    if (!editorRef) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'Editor not ready.';
      if (countEl) countEl.textContent = '';
      if (fileEl) fileEl.textContent = '';
      return;
    }

    const model = editorRef.getModel();
    if (!model) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No file open.';
      if (countEl) countEl.textContent = '';
      if (fileEl) fileEl.textContent = '';
      return;
    }

    const markers = getMarkersForModel(model);
    const name = uriBasename(model.uri);

    if (fileEl) {
      fileEl.textContent = name ? name : '';
    }

    if (countEl) {
      const Sev = monaco.MarkerSeverity;
      let err = 0;
      let warn = 0;
      for (let i = 0; i < markers.length; i++) {
        const s = markers[i].severity;
        if (s === Sev.Error) err++;
        else if (s === Sev.Warning) warn++;
      }
      if (markers.length === 0) {
        countEl.textContent = '';
      } else if (err || warn) {
        countEl.textContent =
          err + ' ⨉, ' + warn + ' ⚠' + (markers.length > err + warn ? ' +' + (markers.length - err - warn) : '');
      } else {
        countEl.textContent = markers.length + ' (info/hint)';
      }
    }

    if (markers.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No problems in this file.';
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = markers
      .map(function (m, idx) {
        const msg = (m.message || '(no message)').replace(/\r?\n/g, ' ');
        const loc = m.startLineNumber + ':' + m.startColumn;
        const sevClass = severityClass(m.severity);
        const icon = severityIcon(m.severity);
        return (
          '<button type="button" class="problems-row ' +
          sevClass +
          '" data-idx="' +
          idx +
          '" title="' +
          escapeHtml(loc + ' — ' + msg) +
          '">' +
          '<span class="problems-row-icon" aria-hidden="true">' +
          escapeHtml(icon) +
          '</span>' +
          '<span class="problems-row-main">' +
          '<span class="problems-row-message">' +
          escapeHtml(msg) +
          '</span>' +
          '<span class="problems-row-meta">' +
          escapeHtml(loc) +
          (m.source ? ' · ' + escapeHtml(m.source) : '') +
          '</span>' +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    listEl.querySelectorAll('.problems-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(i) && markers[i]) goToMarker(markers[i]);
      });
    });
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(function () {
      refreshScheduled = false;
      render();
    });
  }

  function init(editor) {
    editorRef = editor;

    editor.onDidChangeModel(function () {
      scheduleRefresh();
    });
    editor.onDidChangeModelContent(function () {
      scheduleRefresh();
    });

    if (typeof monaco !== 'undefined' && monaco.editor && typeof monaco.editor.onDidChangeMarkers === 'function') {
      monaco.editor.onDidChangeMarkers(function () {
        scheduleRefresh();
      });
    }

    render();
  }

  /** Switch bottom panel to Problems tab (e.g. from status bar). */
  function revealProblemsTab() {
    const tab = document.querySelector('.terminal-tab[data-tab="problems"]');
    if (tab) tab.click();
  }

  return {
    init: init,
    refresh: render,
    revealProblemsTab: revealProblemsTab
  };
})();
