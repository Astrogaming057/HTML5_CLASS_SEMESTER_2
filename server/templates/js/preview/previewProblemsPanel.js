/**
 * IDE-style Problems list for the active Monaco model (errors / warnings / info).
 * Tab: bottom panel → Problems (see preview.html).
 */
window.PreviewProblemsPanel = (function () {
  let editorRef = null;
  let refreshScheduled = false;
  let filtersBound = false;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function uriBasename(uri) {
    if (!uri || !uri.path) return '';
    const p = String(uri.path).replace(/\\/g, '/');
    const parts = p.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
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

  function countBySeverity(markers) {
    const c = { error: 0, warning: 0, info: 0, hint: 0 };
    if (!markers.length || typeof monaco === 'undefined') return c;
    const Sev = monaco.MarkerSeverity;
    for (let i = 0; i < markers.length; i++) {
      const s = markers[i].severity;
      if (s === Sev.Error) c.error++;
      else if (s === Sev.Warning) c.warning++;
      else if (s === Sev.Info) c.info++;
      else if (s === Sev.Hint) c.hint++;
    }
    return c;
  }

  /** e.g. "2 errors · 1 warning · 1 info" */
  function formatSeveritySummary(counts) {
    const parts = [];
    if (counts.error) parts.push(counts.error + ' ' + (counts.error === 1 ? 'error' : 'errors'));
    if (counts.warning) parts.push(counts.warning + ' ' + (counts.warning === 1 ? 'warning' : 'warnings'));
    if (counts.info) parts.push(counts.info + ' info');
    if (counts.hint) parts.push(counts.hint + ' ' + (counts.hint === 1 ? 'hint' : 'hints'));
    return parts.join(' · ');
  }

  function getFilterFlags() {
    const errOnly = document.getElementById('problemsFilterErrorsOnly');
    const hideHints = document.getElementById('problemsFilterHideHints');
    return {
      errorsOnly: !!(errOnly && errOnly.checked),
      hideHints: !!(hideHints && hideHints.checked)
    };
  }

  function applyMarkerFilters(markers) {
    if (!markers.length || typeof monaco === 'undefined') return markers.slice();
    const Sev = monaco.MarkerSeverity;
    const f = getFilterFlags();
    let out = markers.slice();
    if (f.errorsOnly) {
      out = out.filter(function (m) {
        return m.severity === Sev.Error;
      });
    } else if (f.hideHints) {
      out = out.filter(function (m) {
        return m.severity !== Sev.Hint;
      });
    }
    return out;
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

  function copyText(text) {
    const t = text == null ? '' : String(text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(function () {
        fallbackCopy(t);
      });
    } else {
      fallbackCopy(t);
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      /* ignore */
    }
  }

  function updateTabSummary(summaryText, titleFull) {
    const el = document.getElementById('problemsTabSummary');
    if (!el) return;
    if (!summaryText) {
      el.textContent = '';
      el.hidden = true;
      el.removeAttribute('title');
      return;
    }
    el.textContent = ' · ' + summaryText;
    el.hidden = false;
    if (titleFull) el.setAttribute('title', titleFull);
  }

  function bindFiltersOnce() {
    if (filtersBound) return;
    const errOnly = document.getElementById('problemsFilterErrorsOnly');
    const hideHints = document.getElementById('problemsFilterHideHints');
    if (!errOnly || !hideHints) return;
    filtersBound = true;
    errOnly.addEventListener('change', function () {
      if (errOnly.checked) hideHints.checked = false;
      scheduleRefresh();
    });
    hideHints.addEventListener('change', function () {
      if (hideHints.checked) errOnly.checked = false;
      scheduleRefresh();
    });
  }

  function render() {
    bindFiltersOnce();

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
      updateTabSummary('', '');
      return;
    }

    const model = editorRef.getModel();
    if (!model) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No file open.';
      if (countEl) countEl.textContent = '';
      if (fileEl) fileEl.textContent = '';
      updateTabSummary('', '');
      return;
    }

    const markers = getMarkersForModel(model);
    const filtered = applyMarkerFilters(markers);
    const name = uriBasename(model.uri);

    if (fileEl) {
      fileEl.textContent = name ? name : '';
    }

    const totalCounts = countBySeverity(markers);
    const summaryFull = formatSeveritySummary(totalCounts);
    const titleFull =
      summaryFull || (markers.length === 0 ? 'No problems in this file' : String(markers.length) + ' items');

    if (countEl) {
      if (markers.length === 0) {
        countEl.textContent = '';
      } else {
        let line = summaryFull;
        if (filtered.length !== markers.length) {
          line += ' · Showing ' + filtered.length + ' of ' + markers.length;
        }
        countEl.textContent = line;
      }
    }

    updateTabSummary(markers.length ? summaryFull : '', titleFull);

    if (markers.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No problems in this file.';
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No problems match the current filter.';
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = filtered
      .map(function (m, idx) {
        const msg = (m.message || '(no message)').replace(/\r?\n/g, ' ');
        const loc = m.startLineNumber + ':' + m.startColumn;
        const sevClass = severityClass(m.severity);
        const icon = severityIcon(m.severity);
        return (
          '<div class="problems-row-wrap" role="listitem">' +
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
          '</button>' +
          '<button type="button" class="problems-row-copy" data-idx="' +
          idx +
          '" title="Copy message" aria-label="Copy problem message">Copy</button>' +
          '</div>'
        );
      })
      .join('');

    listEl.querySelectorAll('.problems-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(i) && filtered[i]) goToMarker(filtered[i]);
      });
    });

    listEl.querySelectorAll('.problems-row-copy').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(i) && filtered[i]) {
          const msg = (filtered[i].message || '').replace(/\r?\n/g, ' ');
          copyText(msg);
        }
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
