/**
 * Save snapshot vs current buffer as an editor tab (virtual path filetimeline://…).
 * Same shell as commit diff / history; uses colored side-by-side rows via PreviewCommitDiffViewer.renderTextPairDiffInto.
 */
window.PreviewFileTimelineDiffViewer = (function () {
  const PREFIX = 'filetimeline://';

  /** @type {Map<string, HTMLElement>} */
  const tabRoots = new Map();

  function normPath(p) {
    return String(p || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
  }

  function buildTabPath(filePath, index, savedAt) {
    const p = normPath(filePath);
    const enc = encodeURIComponent(p);
    const idx = typeof index === 'number' && index >= 0 ? index : 0;
    const t = typeof savedAt === 'number' ? savedAt : parseInt(savedAt, 10) || 0;
    return PREFIX + enc + '/' + idx + '/' + t;
  }

  function parseTabPath(tabPath) {
    if (!tabPath || !String(tabPath).startsWith(PREFIX)) return null;
    const rest = String(tabPath).slice(PREFIX.length);
    const i = rest.lastIndexOf('/');
    if (i < 0) return null;
    const i2 = rest.lastIndexOf('/', i - 1);
    if (i2 < 0) return null;
    const encPath = rest.slice(0, i2);
    const indexPart = rest.slice(i2 + 1, i);
    const tPart = rest.slice(i + 1);
    let path = '';
    try {
      path = decodeURIComponent(encPath);
    } catch (_e) {
      return null;
    }
    const index = parseInt(indexPart, 10);
    const t = parseInt(tPart, 10);
    if (!Number.isFinite(index) || index < 0) return null;
    return { path: normPath(path), index, t: Number.isFinite(t) ? t : 0 };
  }

  function isTimelineDiffTab(p) {
    return !!(p && String(p).startsWith(PREFIX));
  }

  function getTabTitle(tabPath) {
    const spec = parseTabPath(tabPath);
    if (!spec) return 'Save diff';
    const name = spec.path.split('/').pop() || spec.path || 'file';
    let sub = '';
    if (spec.t) {
      sub =
        'save ' +
        new Date(spec.t).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    }
    return sub ? name + ' \u00b7 ' + sub : name + ' \u00b7 timeline';
  }

  async function resolveNewText(filePath) {
    const active =
      window.PreviewTabManager && typeof PreviewTabManager.getActiveTab === 'function'
        ? PreviewTabManager.getActiveTab()
        : null;
    if (
      active === filePath &&
      window.__previewEditor &&
      typeof window.__previewEditor.getValue === 'function'
    ) {
      return window.__previewEditor.getValue();
    }
    const info =
      window.PreviewTabManager && typeof PreviewTabManager.getTabInfo === 'function'
        ? PreviewTabManager.getTabInfo(filePath)
        : null;
    if (info && typeof info.content === 'string') {
      return info.content;
    }
    try {
      const r = await fetch('/__api__/files?path=' + encodeURIComponent(filePath));
      const d = await r.json();
      if (d.success && typeof d.content === 'string') {
        return d.content;
      }
    } catch (_e) {
      /* fall through */
    }
    return '';
  }

  async function loadTabIntoRoot(tabPath, root) {
    const spec = parseTabPath(tabPath);
    root.textContent = '';
    const inner = document.createElement('div');
    inner.className = 'git-diff-tab-inner';
    inner.innerHTML = '<div class="git-commit-diff-loading">Loading\u2026</div>';
    root.appendChild(inner);

    if (!spec) {
      inner.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = 'Invalid timeline diff tab';
      inner.appendChild(errEl);
      return;
    }

    try {
      const r = await fetch(
        '/__api__/files/timeline/snapshot?path=' +
          encodeURIComponent(spec.path) +
          '&index=' +
          encodeURIComponent(String(spec.index))
      );
      const d = await r.json();
      inner.textContent = '';
      if (!d.success || typeof d.content !== 'string') {
        const errEl = document.createElement('div');
        errEl.className = 'git-commit-diff-error';
        errEl.textContent = d.error || 'Could not load saved snapshot';
        inner.appendChild(errEl);
        return;
      }
      const hint = document.createElement('div');
      hint.className = 'file-timeline-diff-caption';
      hint.textContent =
        'At save (left) vs current editor buffer for this file, or disk if the file is not open in a tab (right). Red \u2212 / green + alignment like Git diffs.';
      inner.appendChild(hint);
      const body = document.createElement('div');
      body.className = 'file-timeline-diff-body';
      inner.appendChild(body);
      const after = await resolveNewText(spec.path);
      if (
        window.PreviewCommitDiffViewer &&
        typeof window.PreviewCommitDiffViewer.renderTextPairDiffInto === 'function'
      ) {
        window.PreviewCommitDiffViewer.renderTextPairDiffInto(body, d.content, after);
      } else {
        body.textContent = '';
        const errEl = document.createElement('div');
        errEl.className = 'git-commit-diff-error';
        errEl.textContent = 'Diff renderer unavailable';
        body.appendChild(errEl);
      }
    } catch (_e) {
      inner.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = 'Request failed';
      inner.appendChild(errEl);
    }
  }

  function activateTab(tabPath) {
    const host = document.getElementById('gitDiffEditorBody');
    if (!host) return;
    let root = tabRoots.get(tabPath);
    if (!root) {
      root = document.createElement('div');
      root.className = 'git-diff-tab-root';
      tabRoots.set(tabPath, root);
      void loadTabIntoRoot(tabPath, root);
    }
    host.textContent = '';
    host.appendChild(root);
  }

  function disposeTab(tabPath) {
    tabRoots.delete(tabPath);
  }

  return {
    PREFIX: PREFIX,
    parseTabPath: parseTabPath,
    isTimelineDiffTab: isTimelineDiffTab,
    buildTabPath: buildTabPath,
    getTabTitle: getTabTitle,
    activateTab: activateTab,
    disposeTab: disposeTab,
    openTimelineDiff(filePath, index, savedAt) {
      const tabPath = buildTabPath(filePath, index, savedAt);
      if (window.PreviewTabManager && typeof window.PreviewTabManager.openTab === 'function') {
        void window.PreviewTabManager.openTab(tabPath);
      }
    },
  };
})();
