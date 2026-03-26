/**
 * Per-file git log in an editor tab (virtual path githistory://…), same host as commit diff / browser.
 */
window.PreviewFileHistoryViewer = (function () {
  const PREFIX = 'githistory://';

  /** @type {Map<string, HTMLElement>} */
  const tabRoots = new Map();

  function buildTabPath(filePath) {
    const p = String(filePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    return PREFIX + encodeURIComponent(p);
  }

  function parseTabPath(tabPath) {
    if (!tabPath || !String(tabPath).startsWith(PREFIX)) return null;
    try {
      return decodeURIComponent(String(tabPath).slice(PREFIX.length));
    } catch (_e) {
      return null;
    }
  }

  function isHistoryTab(p) {
    return !!(p && String(p).startsWith(PREFIX));
  }

  function getTabTitle(tabPath) {
    const path = parseTabPath(tabPath);
    if (!path) return 'History';
    const name = path.replace(/\\/g, '/').split('/').pop() || path;
    return name + ' \u00b7 History';
  }

  async function loadHistoryIntoRoot(tabPath, root) {
    const filePath = parseTabPath(tabPath);
    root.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'git-file-history-view';
    const loading = document.createElement('div');
    loading.className = 'git-commit-diff-loading';
    loading.textContent = 'Loading\u2026';
    wrap.appendChild(loading);
    root.appendChild(wrap);

    if (!filePath) {
      wrap.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = 'Invalid history tab';
      wrap.appendChild(errEl);
      return;
    }

    try {
      const r = await fetch('/__api__/git/file-log?path=' + encodeURIComponent(filePath));
      const d = await r.json();
      wrap.textContent = '';
      if (!d.success) {
        const errEl = document.createElement('div');
        errEl.className = 'git-commit-diff-error';
        errEl.textContent = d.error || 'Failed to load history';
        wrap.appendChild(errEl);
        return;
      }
      if (!d.isRepo) {
        const errEl = document.createElement('div');
        errEl.className = 'git-commit-diff-error';
        errEl.textContent = 'Not a Git repository';
        wrap.appendChild(errEl);
        return;
      }

      const h2 = document.createElement('h2');
      h2.className = 'git-file-history-heading';
      h2.textContent = 'Commit history: ' + filePath;
      wrap.appendChild(h2);

      if (!d.commits || d.commits.length === 0) {
        const p = document.createElement('p');
        p.className = 'git-file-history-empty';
        p.textContent = 'No commits for this path yet.';
        wrap.appendChild(p);
        return;
      }

      const list = document.createElement('ul');
      list.className = 'git-file-history-list';
      for (let i = 0; i < d.commits.length; i++) {
        const c = d.commits[i];
        const li = document.createElement('li');
        li.className = 'git-file-history-item';
        const row = document.createElement('div');
        row.className = 'git-file-history-row';
        const short = (c.hash || '').slice(0, 7);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'git-file-history-commit-btn';
        btn.textContent = (c.isHead ? 'HEAD \u00b7 ' : '') + short + ' \u2014 ' + (c.subject || '');
        btn.title = (c.hash || '') + '\n' + (c.author || '') + ' \u00b7 ' + (c.date || '');
        const fullHash = c.hash;
        btn.addEventListener('click', () => {
          if (
            window.PreviewCommitDiffViewer &&
            typeof window.PreviewCommitDiffViewer.openFileDiff === 'function'
          ) {
            PreviewCommitDiffViewer.openFileDiff(fullHash, filePath);
          }
        });
        row.appendChild(btn);
        const meta = document.createElement('span');
        meta.className = 'git-file-history-meta';
        meta.textContent = (c.author || '') + ' \u00b7 ' + (c.date || '');
        row.appendChild(meta);
        li.appendChild(row);
        list.appendChild(li);
      }
      wrap.appendChild(list);
    } catch (_e) {
      wrap.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = 'Request failed';
      wrap.appendChild(errEl);
    }
  }

  function activateTab(tabPath) {
    const host = document.getElementById('gitDiffEditorBody');
    if (!host) return;
    let root = tabRoots.get(tabPath);
    if (!root) {
      root = document.createElement('div');
      root.className = 'git-file-history-tab-root';
      tabRoots.set(tabPath, root);
      void loadHistoryIntoRoot(tabPath, root);
    }
    host.textContent = '';
    host.appendChild(root);
  }

  function disposeTab(tabPath) {
    tabRoots.delete(tabPath);
  }

  return {
    PREFIX: PREFIX,
    isHistoryTab: isHistoryTab,
    buildTabPath: buildTabPath,
    getTabTitle: getTabTitle,
    activateTab: activateTab,
    disposeTab: disposeTab,
    openFileHistory(filePath) {
      const tabPath = buildTabPath(filePath);
      if (window.PreviewTabManager && typeof window.PreviewTabManager.openTab === 'function') {
        void window.PreviewTabManager.openTab(tabPath);
      }
    },
  };
})();
