/**
 * Source control: (1) Editor cache — ide_editor_cache vs saved files (local workflow).
 * (2) Git — real repository using workspace .git (fetch/pull/push, stage, commit) like other IDEs.
 */
window.PreviewGitStatusBar = (function () {
  let timer = null;

  async function refresh() {
    const el = document.getElementById('statusGitBranch');
    const sep = document.getElementById('statusGitSeparator');
    if (!el) return;
    try {
      const response = await fetch('/__api__/git/repo-status');
      const data = await response.json();
      if (!data.success || !data.isRepo) {
        el.hidden = true;
        if (sep) sep.hidden = true;
        return;
      }
      el.hidden = false;
      if (sep) sep.hidden = false;
      let label = 'Git: ' + (data.branch || 'HEAD');
      if (data.tracking && (data.ahead || data.behind)) {
        label += ' \u2191' + (data.ahead || 0) + ' \u2193' + (data.behind || 0);
      }
      if (data.files && data.files.length) {
        label += ' \u2022 ' + data.files.length;
      }
      el.textContent = label;
      el.title = data.tracking
        ? data.branch + ' \u2194 ' + data.tracking + (data.files && data.files.length ? ' \u2014 ' + data.files.length + ' change(s)' : '')
        : (data.branch || '') + (data.files && data.files.length ? ' \u2014 ' + data.files.length + ' change(s)' : '');
    } catch (_e) {
      el.hidden = true;
      if (sep) sep.hidden = true;
    }
  }

  return {
    init() {
      refresh();
      if (timer) clearInterval(timer);
      timer = setInterval(refresh, 20000);
    },
    refresh,
  };
})();

window.PreviewGitPanel = (function () {
  let panel = null;
  let isVisible = false;
  let activeTab = 'local';

  /** @type {{ path: string, name: string }[]} */
  let localStagedFiles = [];

  async function getModifiedFiles() {
    try {
      const response = await fetch('/__api__/git/modified');
      const data = await response.json();
      if (data.success && data.files) {
        return data.files;
      }
      return [];
    } catch (error) {
      console.error('Error getting modified files:', error);
      return [];
    }
  }

  function isStagedGitEntry(f) {
    if (f.untracked) return false;
    const ix = f.index;
    return ix !== ' ' && ix !== '?';
  }

  function isUnstagedGitEntry(f) {
    if (f.untracked) return true;
    const wt = f.worktree;
    return wt !== ' ' && wt !== '?';
  }

  function xyLabel(f) {
    if (f.untracked) return 'U';
    return (f.xy || '').replace(/\s/g, '\u00b7');
  }

  async function apiPostJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return response.json();
  }

  async function refreshRepoTab() {
    const notRepoEl = document.getElementById('gitRepoNotRepo');
    const errEl = document.getElementById('gitRepoError');
    const metaEl = document.getElementById('gitRepoMeta');
    const stagedEl = document.getElementById('gitRepoStagedList');
    const changesEl = document.getElementById('gitRepoChangesList');
    if (!stagedEl || !changesEl) return;

    stagedEl.innerHTML = '<div class="git-loading">Loading\u2026</div>';
    changesEl.innerHTML = '<div class="git-loading">Loading\u2026</div>';
    if (notRepoEl) notRepoEl.hidden = true;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (metaEl) metaEl.textContent = '';

    try {
      const response = await fetch('/__api__/git/repo-status');
      const data = await response.json();

      if (!data.success) {
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = data.error || 'Git status failed';
        }
        stagedEl.innerHTML = '';
        changesEl.innerHTML = '';
        const uBtn = document.getElementById('gitRepoUnstageAllBtn');
        const sBtn = document.getElementById('gitRepoStageAllBtn');
        if (uBtn) uBtn.disabled = true;
        if (sBtn) sBtn.disabled = true;
        return;
      }

      if (!data.isRepo) {
        if (notRepoEl) notRepoEl.hidden = false;
        stagedEl.innerHTML = '';
        changesEl.innerHTML = '';
        const uBtn = document.getElementById('gitRepoUnstageAllBtn');
        const sBtn = document.getElementById('gitRepoStageAllBtn');
        if (uBtn) uBtn.disabled = true;
        if (sBtn) sBtn.disabled = true;
        return;
      }

      if (metaEl) {
        let m = data.branch || 'HEAD';
        if (data.tracking) {
          m += ' \u2194 ' + data.tracking;
        }
        if (data.detached) {
          m += ' (detached)';
        }
        if (data.noCommits) {
          m += ' \u2014 no commits yet';
        }
        metaEl.textContent = m;
      }

      const files = data.files || [];
      const staged = files.filter(isStagedGitEntry);
      const changes = files.filter(isUnstagedGitEntry);

      function row(f, mode) {
        const p = f.path;
        const item = document.createElement('div');
        item.className = 'git-repo-file-row';
        item.title = p;

        const xy = document.createElement('span');
        xy.className = 'git-repo-xy';
        xy.setAttribute('aria-hidden', 'true');
        xy.textContent = xyLabel(f);

        const textWrap = document.createElement('div');
        textWrap.className = 'git-repo-row-text';
        const base = document.createElement('span');
        base.className = 'git-repo-basename';
        base.textContent = p.split('/').pop() || p;
        const rel = document.createElement('span');
        rel.className = 'git-repo-relpath';
        rel.textContent = p;
        textWrap.appendChild(base);
        textWrap.appendChild(rel);

        const actions = document.createElement('div');
        actions.className = 'git-repo-row-actions';
        if (mode === 'staged') {
          const u = document.createElement('button');
          u.type = 'button';
          u.className = 'git-btn git-btn-small git-btn-gitrow';
          u.textContent = 'Unstage';
          u.addEventListener('click', function (e) {
            e.stopPropagation();
            unstageRepoPath(p);
          });
          actions.appendChild(u);
        } else {
          const s = document.createElement('button');
          s.type = 'button';
          s.className = 'git-btn git-btn-small git-btn-gitrow';
          s.textContent = 'Stage';
          s.addEventListener('click', function (e) {
            e.stopPropagation();
            stageRepoPath(p);
          });
          actions.appendChild(s);
        }
        const v = document.createElement('button');
        v.type = 'button';
        v.className = 'git-btn git-btn-small git-btn-gitrow';
        v.textContent = 'Open';
        v.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.__previewSwitchToFile && typeof window.__previewSwitchToFile === 'function') {
            window.__previewSwitchToFile(p);
          }
        });
        actions.appendChild(v);

        item.appendChild(xy);
        item.appendChild(textWrap);
        item.appendChild(actions);
        return item;
      }

      stagedEl.innerHTML = '';
      if (staged.length === 0) {
        stagedEl.innerHTML = '<div class="git-empty">Nothing staged</div>';
      } else {
        staged.forEach((f) => stagedEl.appendChild(row(f, 'staged')));
      }

      changesEl.innerHTML = '';
      if (changes.length === 0) {
        changesEl.innerHTML = '<div class="git-empty">No changes</div>';
      } else {
        changes.forEach((f) => changesEl.appendChild(row(f, 'changes')));
      }

      const unstageAllBtn = document.getElementById('gitRepoUnstageAllBtn');
      const stageAllBtn = document.getElementById('gitRepoStageAllBtn');
      if (unstageAllBtn) {
        unstageAllBtn.disabled = staged.length === 0;
      }
      if (stageAllBtn) {
        stageAllBtn.disabled = changes.length === 0;
      }

      if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
        PreviewGitStatusBar.refresh();
      }
    } catch (error) {
      console.error('Git repo refresh', error);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = error.message || String(error);
      }
      stagedEl.innerHTML = '';
      changesEl.innerHTML = '';
      const uBtn = document.getElementById('gitRepoUnstageAllBtn');
      const sBtn = document.getElementById('gitRepoStageAllBtn');
      if (uBtn) uBtn.disabled = true;
      if (sBtn) sBtn.disabled = true;
    }
  }

  async function stageRepoPath(filePath) {
    const data = await apiPostJson('/__api__/git/stage', { paths: [filePath] });
    if (!data.success) {
      alert(data.error || 'Stage failed');
      return;
    }
    await refreshRepoTab();
  }

  async function unstageRepoPath(filePath) {
    const data = await apiPostJson('/__api__/git/unstage', { paths: [filePath] });
    if (!data.success) {
      alert(data.error || 'Unstage failed');
      return;
    }
    await refreshRepoTab();
  }

  async function repoCommit() {
    const input = document.getElementById('gitRepoCommitMessage');
    const message = input && input.value ? input.value.trim() : '';
    if (!message) {
      alert('Enter a commit message');
      return;
    }
    const data = await apiPostJson('/__api__/git/commit', { message: message });
    if (!data.success) {
      alert(data.error || 'Commit failed');
      return;
    }
    if (input) input.value = '';
    await refreshRepoTab();
  }

  async function repoFetch() {
    const data = await apiPostJson('/__api__/git/fetch', {});
    if (!data.success) {
      alert(data.error || 'Fetch failed');
      return;
    }
    await refreshRepoTab();
  }

  async function repoPull() {
    const data = await apiPostJson('/__api__/git/pull', {});
    if (!data.success) {
      alert(data.error || 'Pull failed');
      return;
    }
    await refreshRepoTab();
  }

  async function repoPush() {
    const data = await apiPostJson('/__api__/git/push', {});
    if (!data.success) {
      alert(data.error || 'Push failed');
      return;
    }
    await refreshRepoTab();
  }

  async function repoStageAll() {
    const data = await apiPostJson('/__api__/git/stage-all', {});
    if (!data.success) {
      alert(data.error || 'Stage all failed');
      return;
    }
    await refreshRepoTab();
  }

  async function repoUnstageAll() {
    const data = await apiPostJson('/__api__/git/unstage-all', {});
    if (!data.success) {
      alert(data.error || 'Unstage all failed');
      return;
    }
    await refreshRepoTab();
  }

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'git-panel';
    panel.id = 'gitPanel';
    panel.innerHTML =
      '<div class="git-panel-header">' +
      '<span class="git-panel-title">Source control</span>' +
      '<button type="button" class="git-panel-close" id="gitPanelClose" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<div class="git-panel-tabs" role="tablist">' +
      '<button type="button" class="git-panel-tab is-active" id="gitTabLocal" role="tab" aria-selected="true" data-git-tab="local">Editor cache</button>' +
      '<button type="button" class="git-panel-tab" id="gitTabRepo" role="tab" aria-selected="false" data-git-tab="repo">Git</button>' +
      '</div>' +
      '<div class="git-panel-tab-panel" id="gitPanelLocalWrap" role="tabpanel">' +
      '<div class="git-panel-content">' +
      '<div class="git-section">' +
      '<div class="git-section-header">' +
      '<span class="git-section-title">Unsaved in editor cache</span>' +
      '<button type="button" class="git-btn git-btn-small" id="gitLocalRefreshBtn">Refresh</button>' +
      '</div>' +
      '<p class="git-panel-hint">Files that differ from disk because of the debounced editor cache (<code>ide_editor_cache</code>). Stage here to write them to the workspace before a Git commit.</p>' +
      '<div class="git-files-list" id="gitLocalModifiedFiles"><div class="git-loading">Loading\u2026</div></div>' +
      '</div>' +
      '<div class="git-section">' +
      '<div class="git-section-header">' +
      '<span class="git-section-title">Staged for save</span>' +
      '<button type="button" class="git-btn git-btn-small" id="gitLocalUnstageAllBtn">Clear</button>' +
      '</div>' +
      '<div class="git-files-list" id="gitLocalStagedFiles"><div class="git-empty">None</div></div>' +
      '</div>' +
      '<div class="git-section">' +
      '<div class="git-section-header"><span class="git-section-title">Write to workspace</span></div>' +
      '<textarea id="gitLocalNote" class="git-commit-input" placeholder="Optional note (shown in confirmation only)" rows="2"></textarea>' +
      '<div class="git-commit-actions">' +
      '<button type="button" class="git-btn git-btn-primary" id="gitLocalApplyBtn">Save staged to disk</button>' +
      '<button type="button" class="git-btn git-btn-secondary" id="gitLocalClearNoteBtn">Clear note</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="git-panel-tab-panel" id="gitPanelRepoWrap" role="tabpanel" hidden>' +
      '<div class="git-panel-content git-repo-content">' +
      '<div id="gitRepoNotRepo" class="git-repo-banner" hidden>This folder is not a Git repository. Run <code>git init</code> in the workspace or open a cloned project.</div>' +
      '<div id="gitRepoError" class="git-repo-error" hidden></div>' +
      '<div class="git-repo-toolbar">' +
      '<span class="git-repo-meta" id="gitRepoMeta"></span>' +
      '<div class="git-repo-toolbar-btns">' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoRefreshBtn">Refresh</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoFetchBtn">Fetch</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoPullBtn">Pull</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoPushBtn">Push</button>' +
      '</div></div>' +
      '<div class="git-section">' +
      '<div class="git-section-header">' +
      '<span class="git-section-title">Staged</span>' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoUnstageAllBtn" disabled>Unstage all</button>' +
      '</div>' +
      '<div class="git-files-list git-repo-files-list" id="gitRepoStagedList"></div>' +
      '</div>' +
      '<div class="git-section">' +
      '<div class="git-section-header">' +
      '<span class="git-section-title">Changes</span>' +
      '<button type="button" class="git-btn git-btn-small" id="gitRepoStageAllBtn" disabled>Stage all</button>' +
      '</div>' +
      '<div class="git-files-list git-repo-files-list" id="gitRepoChangesList"></div>' +
      '</div>' +
      '<div class="git-section">' +
      '<div class="git-section-header"><span class="git-section-title">Commit</span></div>' +
      '<textarea id="gitRepoCommitMessage" class="git-commit-input" placeholder="Commit message" rows="3"></textarea>' +
      '<div class="git-commit-actions">' +
      '<button type="button" class="git-btn git-btn-primary" id="gitRepoCommitBtn">Commit</button>' +
      '</div></div>' +
      '</div></div>';

    const fileExplorerPanel = document.getElementById('fileExplorerPanel');
    const fileTree = document.getElementById('fileTree');
    if (fileExplorerPanel && fileTree) {
      const terminalPanel = document.getElementById('terminalPanel');
      if (terminalPanel && terminalPanel.parentNode === fileExplorerPanel) {
        fileExplorerPanel.insertBefore(panel, terminalPanel);
      } else {
        fileExplorerPanel.appendChild(panel);
      }
    } else if (fileExplorerPanel) {
      fileExplorerPanel.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    setupEventHandlers();
    return panel;
  }

  function setActiveTab(tab) {
    activeTab = tab === 'repo' ? 'repo' : 'local';
    const tLocal = document.getElementById('gitTabLocal');
    const tRepo = document.getElementById('gitTabRepo');
    const wLocal = document.getElementById('gitPanelLocalWrap');
    const wRepo = document.getElementById('gitPanelRepoWrap');
    if (tLocal && tRepo) {
      tLocal.classList.toggle('is-active', activeTab === 'local');
      tRepo.classList.toggle('is-active', activeTab === 'repo');
      tLocal.setAttribute('aria-selected', activeTab === 'local' ? 'true' : 'false');
      tRepo.setAttribute('aria-selected', activeTab === 'repo' ? 'true' : 'false');
    }
    if (wLocal && wRepo) {
      wLocal.hidden = activeTab !== 'local';
      wRepo.hidden = activeTab !== 'repo';
    }
    if (activeTab === 'repo') {
      refreshRepoTab();
    } else {
      refreshLocalTab();
    }
  }

  function closePanel() {
    isVisible = false;
    if (panel) {
      panel.style.display = 'none';
    }
  }

  function setupEventHandlers() {
    const closeBtn = panel ? panel.querySelector('#gitPanelClose') : document.getElementById('gitPanelClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
      });
    }

    document.getElementById('gitTabLocal')?.addEventListener('click', () => setActiveTab('local'));
    document.getElementById('gitTabRepo')?.addEventListener('click', () => setActiveTab('repo'));

    document.getElementById('gitLocalRefreshBtn')?.addEventListener('click', () => refreshLocalTab());
    document.getElementById('gitLocalUnstageAllBtn')?.addEventListener('click', () => localUnstageAll());
    document.getElementById('gitLocalApplyBtn')?.addEventListener('click', () => localApplyToDisk());
    document.getElementById('gitLocalClearNoteBtn')?.addEventListener('click', () => {
      const n = document.getElementById('gitLocalNote');
      if (n) n.value = '';
    });

    document.getElementById('gitRepoRefreshBtn')?.addEventListener('click', () => refreshRepoTab());
    document.getElementById('gitRepoFetchBtn')?.addEventListener('click', () => repoFetch());
    document.getElementById('gitRepoPullBtn')?.addEventListener('click', () => repoPull());
    document.getElementById('gitRepoPushBtn')?.addEventListener('click', () => repoPush());
    document.getElementById('gitRepoCommitBtn')?.addEventListener('click', () => repoCommit());
    document.getElementById('gitRepoStageAllBtn')?.addEventListener('click', () => repoStageAll());
    document.getElementById('gitRepoUnstageAllBtn')?.addEventListener('click', () => repoUnstageAll());
  }

  function renderLocalModifiedFiles(files) {
    const container = document.getElementById('gitLocalModifiedFiles');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '<div class="git-empty">No differences between cache and disk</div>';
      return;
    }

    container.innerHTML = '';
    files.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'git-file-item';
      item.innerHTML =
        '<span class="git-file-name">' +
        escapeHtml(file.name) +
        '</span>' +
        '<span class="git-file-path">' +
        escapeHtml(file.path) +
        '</span>' +
        '<button type="button" class="git-btn git-btn-small" data-action="stage">Stage</button>' +
        '<button type="button" class="git-btn git-btn-small" data-action="view">Open</button>';

      item.querySelector('[data-action="stage"]').addEventListener('click', () => localStageFile(file.path, file.name));
      item.querySelector('[data-action="view"]').addEventListener('click', () => {
        if (window.__previewSwitchToFile && typeof window.__previewSwitchToFile === 'function') {
          window.__previewSwitchToFile(file.path);
        }
      });

      container.appendChild(item);
    });
  }

  function renderLocalStagedFiles() {
    const container = document.getElementById('gitLocalStagedFiles');
    if (!container) return;

    if (localStagedFiles.length === 0) {
      container.innerHTML = '<div class="git-empty">None</div>';
      return;
    }

    container.innerHTML = '';
    localStagedFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'git-file-item';
      item.innerHTML =
        '<span class="git-file-name">' +
        escapeHtml(file.name) +
        '</span>' +
        '<span class="git-file-path">' +
        escapeHtml(file.path) +
        '</span>' +
        '<button type="button" class="git-btn git-btn-small" data-action="unstage">Remove</button>';

      item.querySelector('[data-action="unstage"]').addEventListener('click', () => localUnstageFile(file.path));

      container.appendChild(item);
    });
  }

  function localStageFile(filePath, fileName) {
    if (!localStagedFiles.find((f) => f.path === filePath)) {
      localStagedFiles.push({ path: filePath, name: fileName });
      renderLocalStagedFiles();
      refreshLocalTab();
    }
  }

  function localUnstageFile(filePath) {
    localStagedFiles = localStagedFiles.filter((f) => f.path !== filePath);
    renderLocalStagedFiles();
    refreshLocalTab();
  }

  function localUnstageAll() {
    localStagedFiles = [];
    renderLocalStagedFiles();
    refreshLocalTab();
  }

  async function localApplyToDisk() {
    const note = document.getElementById('gitLocalNote');
    const noteText = note && note.value ? note.value.trim() : '';

    if (localStagedFiles.length === 0) {
      alert('Stage files from the list above first');
      return;
    }

    for (const file of localStagedFiles) {
      try {
        const cacheResponse = await fetch('/__api__/files/editor?path=' + encodeURIComponent(file.path));
        const cacheData = await cacheResponse.json();

        if (cacheData.success && cacheData.exists) {
          const saveResponse = await fetch('/__api__/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: file.path, content: cacheData.content }),
          });

          if (saveResponse.ok) {
            await fetch('/__api__/files/editor', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: file.path }),
            });
          }
        }
      } catch (error) {
        console.error('Error saving ' + file.path + ':', error);
      }
    }

    const n = localStagedFiles.length;
    localStagedFiles = [];
    renderLocalStagedFiles();
    if (note) note.value = '';
    await refreshLocalTab();
    alert('Saved ' + n + ' file(s) to the workspace.' + (noteText ? ' Note: ' + noteText : ''));
  }

  async function refreshLocalTab() {
    const modifiedContainer = document.getElementById('gitLocalModifiedFiles');
    if (modifiedContainer) {
      modifiedContainer.innerHTML = '<div class="git-loading">Loading\u2026</div>';
    }

    const modifiedFiles = await getModifiedFiles();
    const unstaged = modifiedFiles.filter((f) => !localStagedFiles.find((sf) => sf.path === f.path));
    renderLocalModifiedFiles(unstaged);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    toggle() {
      const panelEl = createPanel();
      isVisible = !isVisible;

      if (isVisible) {
        panelEl.style.display = 'flex';
        setActiveTab(activeTab);
        if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
          PreviewGitStatusBar.refresh();
        }
      } else {
        panelEl.style.display = 'none';
      }
    },

    show() {
      const panelEl = createPanel();
      isVisible = true;
      panelEl.style.display = 'flex';
      setActiveTab(activeTab);
    },

    showRepoTab() {
      const panelEl = createPanel();
      isVisible = true;
      panelEl.style.display = 'flex';
      setActiveTab('repo');
    },

    hide: closePanel,

    refresh() {
      if (activeTab === 'repo') {
        return refreshRepoTab();
      }
      return refreshLocalTab();
    },
  };
})();
