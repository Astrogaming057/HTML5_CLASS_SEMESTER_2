/**
 * Commit graph: log list, commit hover popover, per-commit file rows, expand/collapse.
 * Initialized by PreviewGitPanel with shared commit caches.
 */
window.PreviewGitPanelGraph = (function () {
  let commitInfoCache = null;
  let commitFilesCache = null;

  function init(opts) {
    commitInfoCache = opts.commitInfoCache;
    commitFilesCache = opts.commitFilesCache;
  }


  function formatRelativeTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const ms = Date.now() - d.getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 45) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + ' minute' + (min === 1 ? '' : 's') + ' ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' hour' + (hr === 1 ? '' : 's') + ' ago';
    const day = Math.floor(hr / 24);
    if (day < 7) return day + ' day' + (day === 1 ? '' : 's') + ' ago';
    const week = Math.floor(day / 7);
    if (week < 5) return week + ' week' + (week === 1 ? '' : 's') + ' ago';
    const month = Math.floor(day / 30);
    if (month < 12) return month + ' month' + (month === 1 ? '' : 's') + ' ago';
    const year = Math.floor(day / 365);
    return year + ' year' + (year === 1 ? '' : 's') + ' ago';
  }

  function formatAbsoluteDateTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
    } catch (_e) {
      return d.toLocaleString();
    }
  }

  function formatGitGraphPopoverWhenLine(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const rel = formatRelativeTime(d);
    const abs = formatAbsoluteDateTime(d);
    if (rel && abs) return rel + ' (' + abs + ')';
    return abs || rel || '';
  }

  function displayBranchLabel(branch) {
    let b = String(branch).trim();
    if (b.startsWith('remotes/')) b = b.slice('remotes/'.length);
    return b;
  }

  let graphPopoverEl = null;
  let graphPopoverShowTimer = null;
  let graphPopoverHideTimer = null;
  /** Row that opened the commit popover (for hover + positioning). */
  let graphPopoverAnchorRow = null;
  let graphPopoverResizeBound = false;
  let graphPopoverDismissBound = false;
  /** Reliable dismiss vs :hover (broken for position:fixed in some hosts). */
  let graphPopoverPointerOverRow = false;
  let graphPopoverPointerOverPopover = false;
  const GRAPH_POPOVER_SHOW_MS = 120;
  const GRAPH_POPOVER_HIDE_MS = 400;
  function isGraphPopoverActive(_row) {
    if (graphPopoverPointerOverPopover || graphPopoverPointerOverRow) return true;
    return false;
  }

  function pointerEventRetargetToElement(t) {
    if (!t) return null;
    if (t.nodeType === 1) return t;
    if (t.nodeType === 3 && t.parentElement) return t.parentElement;
    return null;
  }

  function graphPopoverPointerPathKeepsOpen(e) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    for (let i = 0; i < path.length; i++) {
      const n = path[i];
      if (n === document || n === window) break;
      if (!n || n.nodeType !== 1) continue;
      if (graphPopoverEl && (n === graphPopoverEl || graphPopoverEl.contains(n))) return true;
      if (n.classList && n.classList.contains('git-graph-panel')) return true;
      if (n.classList && n.classList.contains('git-graph-splitter')) return true;
      if (n.classList && n.classList.contains('git-stash-stack-panel')) return true;
      if (n.classList && n.classList.contains('git-stash-stack-splitter')) return true;
    }
    const el = pointerEventRetargetToElement(e.target);
    if (!el || !el.closest) return false;
    if (el.closest('.git-graph-popover')) return true;
    if (el.closest('.git-graph-panel')) return true;
    if (el.closest('.git-graph-splitter')) return true;
    if (el.closest('.git-stash-stack-panel')) return true;
    if (el.closest('.git-stash-stack-splitter')) return true;
    return false;
  }

  function hideGraphPopover() {
    if (graphPopoverShowTimer) {
      clearTimeout(graphPopoverShowTimer);
      graphPopoverShowTimer = null;
    }
    if (graphPopoverHideTimer) {
      clearTimeout(graphPopoverHideTimer);
      graphPopoverHideTimer = null;
    }
    graphPopoverAnchorRow = null;
    graphPopoverPointerOverRow = false;
    graphPopoverPointerOverPopover = false;
    if (graphPopoverEl) {
      graphPopoverEl.hidden = true;
    }
  }

  function scheduleHideGraphPopover() {
    if (graphPopoverHideTimer) clearTimeout(graphPopoverHideTimer);
    graphPopoverHideTimer = setTimeout(function () {
      graphPopoverHideTimer = null;
      const pop = graphPopoverEl;
      if (!pop || pop.hidden) return;
      if (graphPopoverPointerOverPopover || graphPopoverPointerOverRow) return;
      hideGraphPopover();
    }, GRAPH_POPOVER_HIDE_MS);
  }

  function onDocumentPointerDownDismissGraphPopover(e) {
    if (!graphPopoverEl || graphPopoverEl.hidden) return;
    if (graphPopoverPointerPathKeepsOpen(e)) return;
    hideGraphPopover();
  }

  function onDocumentKeydownDismissGraphPopover(e) {
    if (e.key !== 'Escape') return;
    if (!graphPopoverEl || graphPopoverEl.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    hideGraphPopover();
  }

  function ensureGraphPopover() {
    if (graphPopoverEl) return graphPopoverEl;
    const wrap = document.createElement('div');
    wrap.className = 'git-graph-popover';
    wrap.setAttribute('role', 'tooltip');
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="git-graph-popover-inner">' +
      '<div class="git-graph-popover-head">' +
      '<div class="git-graph-popover-author"></div>' +
      '<button type="button" class="git-graph-popover-close" aria-label="Close commit details">\u2715</button>' +
      '</div>' +
      '<div class="git-graph-popover-time"></div>' +
      '<div class="git-graph-popover-message"></div>' +
      '<div class="git-graph-popover-stats"></div>' +
      '<div class="git-graph-popover-pills"></div>' +
      '<div class="git-graph-popover-footer">' +
      '<code class="git-graph-popover-hash"></code>' +
      '<button type="button" class="git-graph-popover-copy" title="Copy commit hash" aria-label="Copy commit hash">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '</button>' +
      '<span class="git-graph-popover-footer-sep git-graph-popover-sep-diff" aria-hidden="true"></span>' +
      '<button type="button" class="git-graph-popover-diff">View changes</button>' +
      '<span class="git-graph-popover-footer-sep git-graph-popover-sep-gh" aria-hidden="true"></span>' +
      '<a class="git-graph-popover-github" target="_blank" rel="noopener noreferrer">Open on GitHub</a>' +
      '</div></div>';
    document.body.appendChild(wrap);
    graphPopoverEl = wrap;
    const copyBtn = wrap.querySelector('.git-graph-popover-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const h = copyBtn.dataset.fullHash || '';
        if (h && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(h);
        }
      });
    }
    const closeBtn = wrap.querySelector('.git-graph-popover-close');
    if (closeBtn) {
      function onClosePopover(e) {
        e.preventDefault();
        e.stopPropagation();
        hideGraphPopover();
      }
      closeBtn.addEventListener('click', onClosePopover);
      closeBtn.addEventListener('pointerdown', onClosePopover);
    }
    const popDiffBtn = wrap.querySelector('.git-graph-popover-diff');
    if (popDiffBtn && !popDiffBtn.dataset.boundCommitDiff) {
      popDiffBtn.dataset.boundCommitDiff = '1';
      popDiffBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const h = popDiffBtn.dataset.fullHash || '';
        if (h) {
          hideGraphPopover();
          void window.PreviewCommitDiffViewer.openMultiFileDiff(h);
        }
      });
      popDiffBtn.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
    }
    wrap.addEventListener('pointerenter', function () {
      graphPopoverPointerOverPopover = true;
      if (graphPopoverHideTimer) {
        clearTimeout(graphPopoverHideTimer);
        graphPopoverHideTimer = null;
      }
    });
    wrap.addEventListener('pointerleave', function () {
      graphPopoverPointerOverPopover = false;
      scheduleHideGraphPopover();
    });
    if (!graphPopoverResizeBound) {
      graphPopoverResizeBound = true;
      window.addEventListener('resize', function () {
        if (graphPopoverEl && !graphPopoverEl.hidden && graphPopoverAnchorRow) {
          positionGraphPopover(graphPopoverAnchorRow);
        }
      });
    }
    if (!graphPopoverDismissBound) {
      graphPopoverDismissBound = true;
      document.addEventListener('pointerdown', onDocumentPointerDownDismissGraphPopover, true);
      document.addEventListener('keydown', onDocumentKeydownDismissGraphPopover, true);
    }
    return wrap;
  }

  function positionGraphPopover(row) {
    const el = ensureGraphPopover();
    el.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const rect = row.getBoundingClientRect();
        const pw = el.offsetWidth;
        const ph = el.offsetHeight;
        let left = rect.right + 8;
        let top = rect.top + rect.height / 2 - ph / 2;
        if (left + pw > window.innerWidth - 8) {
          left = rect.left - pw - 8;
        }
        if (left < 8) left = 8;
        if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
        if (top < 8) top = 8;
        el.style.left = left + 'px';
        el.style.top = top + 'px';
      });
    });
  }

  function populateGraphPopover(data) {
    const el = ensureGraphPopover();
    const authorEl = el.querySelector('.git-graph-popover-author');
    const timeEl = el.querySelector('.git-graph-popover-time');
    const msgEl = el.querySelector('.git-graph-popover-message');
    const statsEl = el.querySelector('.git-graph-popover-stats');
    const pillsEl = el.querySelector('.git-graph-popover-pills');
    const hashEl = el.querySelector('.git-graph-popover-hash');
    const copyBtn = el.querySelector('.git-graph-popover-copy');
    const ghEl = el.querySelector('.git-graph-popover-github');
    const sepGhEl = el.querySelector('.git-graph-popover-sep-gh');
    const sepDiffEl = el.querySelector('.git-graph-popover-sep-diff');
    const diffBtn = el.querySelector('.git-graph-popover-diff');

    const author = (data.author || '').trim() || '(unknown)';
    if (authorEl) {
      authorEl.textContent = '';
      authorEl.appendChild(document.createTextNode(author));
      if (data.email) authorEl.title = data.email;
    }
    if (timeEl) {
      timeEl.textContent = formatGitGraphPopoverWhenLine(data.date);
      timeEl.title = data.date || '';
    }

    const fullMsg = (data.body && String(data.body).trim()) || (data.subject || '');
    if (msgEl) {
      msgEl.textContent = fullMsg || '(no message)';
    }

    if (statsEl) {
      statsEl.textContent = '';
      const fc = Number(data.filesChanged) || 0;
      const ins = Number(data.insertions) || 0;
      const del = Number(data.deletions) || 0;
      statsEl.appendChild(
        document.createTextNode(
          fc + ' file' + (fc === 1 ? '' : 's') + ' changed'
        )
      );
      if (ins) {
        statsEl.appendChild(document.createTextNode(', '));
        const s = document.createElement('span');
        s.className = 'git-graph-popover-stat-ins';
        s.textContent = ins + ' insertion' + (ins === 1 ? '' : 's') + '(+)';
        statsEl.appendChild(s);
      }
      if (del) {
        statsEl.appendChild(document.createTextNode(', '));
        const s = document.createElement('span');
        s.className = 'git-graph-popover-stat-del';
        s.textContent = del + ' deletion' + (del === 1 ? '' : 's') + '(-)';
        statsEl.appendChild(s);
      }
    }

    if (pillsEl) {
      pillsEl.textContent = '';
      const seen = new Set();
      const branches = Array.isArray(data.branches) ? data.branches : [];
      branches.forEach(function (b) {
        if (String(b).includes('->')) return;
        const label = displayBranchLabel(b);
        if (!label || seen.has(label)) return;
        seen.add(label);
        const pill = document.createElement('span');
        pill.className = /^remotes\//.test(String(b).trim())
          ? 'git-graph-popover-pill is-remote'
          : 'git-graph-popover-pill';
        pill.textContent = label;
        pill.title = b;
        pillsEl.appendChild(pill);
      });
    }

    const shortH = data.shortHash || (data.hash || '').slice(0, 7);
    if (hashEl) hashEl.textContent = shortH;
    if (copyBtn) {
      copyBtn.dataset.fullHash = data.hash || '';
    }
    if (diffBtn) {
      diffBtn.dataset.fullHash = data.hash || '';
      diffBtn.hidden = false;
    }
    if (sepDiffEl) sepDiffEl.hidden = false;
    if (ghEl) {
      if (data.githubCommitUrl) {
        ghEl.href = data.githubCommitUrl;
        ghEl.hidden = false;
        if (sepGhEl) sepGhEl.hidden = false;
      } else {
        ghEl.removeAttribute('href');
        ghEl.hidden = true;
        if (sepGhEl) sepGhEl.hidden = true;
      }
    }
  }

  async function showGraphPopoverForRow(row, hash) {
    if (!hash || !row) return;
    graphPopoverAnchorRow = row;
    const el = ensureGraphPopover();
    const authorEl = el.querySelector('.git-graph-popover-author');
    const timeEl = el.querySelector('.git-graph-popover-time');
    const msgEl = el.querySelector('.git-graph-popover-message');
    const statsEl = el.querySelector('.git-graph-popover-stats');
    const pillsEl = el.querySelector('.git-graph-popover-pills');
    const diffBtnLoad = el.querySelector('.git-graph-popover-diff');
    const sepDiffLoad = el.querySelector('.git-graph-popover-sep-diff');
    if (authorEl) authorEl.textContent = 'Loading\u2026';
    if (timeEl) timeEl.textContent = '';
    if (msgEl) msgEl.textContent = '';
    if (statsEl) statsEl.textContent = '';
    if (pillsEl) pillsEl.textContent = '';
    if (diffBtnLoad) diffBtnLoad.hidden = true;
    if (sepDiffLoad) sepDiffLoad.hidden = true;
    positionGraphPopover(row);

    let data = commitInfoCache.get(hash);
    if (!data) {
      try {
        const r = await fetch('/__api__/git/commit-info?hash=' + encodeURIComponent(hash));
        data = await r.json();
        if (data.success) {
          commitInfoCache.set(data.hash, data);
          commitInfoCache.set(hash, data);
        }
      } catch (_e) {
        data = { success: false, error: 'Request failed' };
      }
    }
    if (!data || !data.success) {
      if (msgEl) msgEl.textContent = (data && data.error) || 'Could not load commit';
      if (authorEl) authorEl.textContent = '';
      const diffBtnErr = el.querySelector('.git-graph-popover-diff');
      const sepDiffErr = el.querySelector('.git-graph-popover-sep-diff');
      if (diffBtnErr) diffBtnErr.hidden = true;
      if (sepDiffErr) sepDiffErr.hidden = true;
      if (!isGraphPopoverActive(row)) {
        hideGraphPopover();
        return;
      }
      positionGraphPopover(row);
      return;
    }
    if (!isGraphPopoverActive(row)) {
      hideGraphPopover();
      return;
    }
    populateGraphPopover(data);
    positionGraphPopover(row);
  }

  function splitCommitDisplayPath(path) {
    const clean = String(path || '').replace(/\\/g, '/');
    const i = clean.lastIndexOf('/');
    if (i < 0) return { name: clean, dir: '' };
    return { name: clean.slice(i + 1), dir: clean.slice(0, i) };
  }

  function gitGraphFileIconKind(path) {
    const name = String(path || '').replace(/\\/g, '/').split('/').pop() || '';
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
    if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'js';
    if (ext === 'css' || ext === 'scss' || ext === 'less') return 'css';
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'md';
    if (ext === 'ts' || ext === 'tsx') return 'ts';
    if (ext === 'py') return 'py';
    return 'file';
  }

  function gitGraphFileIconLabel(kind) {
    if (kind === 'js') return 'JS';
    if (kind === 'ts') return 'TS';
    if (kind === 'css') return '#';
    if (kind === 'html') return '<>';
    if (kind === 'json') return '{}';
    if (kind === 'md') return 'M\u2193';
    if (kind === 'py') return 'Py';
    return '\u25a1';
  }

  function renderGitGraphFileList(container, files, commitHash) {
    container.textContent = '';
    const list = Array.isArray(files) ? files : [];
    const hFull = commitHash || '';
    list.forEach(function (f) {
      const p = f.path || '';
      const kind = gitGraphFileIconKind(p);
      const parts = splitCommitDisplayPath(p);
      const row = document.createElement('div');
      row.className = 'git-graph-file-row';
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.title = 'Click to view diff';
      row.dataset.commitHash = hFull;
      row.dataset.filePath = p;
      if (f.oldPath) row.dataset.oldPath = f.oldPath;
      const icon = document.createElement('span');
      icon.className = 'git-graph-file-icon git-graph-file-icon-' + kind;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = gitGraphFileIconLabel(kind);
      const mid = document.createElement('div');
      mid.className = 'git-graph-file-mid';
      const nameEl = document.createElement('span');
      nameEl.className = 'git-graph-file-name';
      nameEl.textContent = parts.name;
      const dirEl = document.createElement('span');
      dirEl.className = 'git-graph-file-dir';
      dirEl.textContent = parts.dir ? parts.dir.replace(/\//g, '\\') : '';
      mid.appendChild(nameEl);
      if (parts.dir) mid.appendChild(dirEl);
      const statsWrap = document.createElement('span');
      statsWrap.className = 'git-graph-file-stats';
      const ins = f.insertions;
      const del = f.deletions;
      if (ins != null || del != null) {
        if (ins != null) {
          const sp = document.createElement('span');
          sp.className = 'git-graph-file-stats-ins';
          sp.textContent = '+' + ins;
          statsWrap.appendChild(sp);
        }
        if (del != null) {
          if (ins != null) statsWrap.appendChild(document.createTextNode(' '));
          const sn = document.createElement('span');
          sn.className = 'git-graph-file-stats-del';
          sn.textContent = '\u2212' + del;
          statsWrap.appendChild(sn);
        }
      } else {
        statsWrap.className = 'git-graph-file-stats git-graph-file-stats-muted';
        statsWrap.textContent = '\u2014';
        statsWrap.title = 'Binary or unavailable';
      }
      const st = document.createElement('span');
      st.className = 'git-graph-file-status';
      const raw = f.status || '';
      st.textContent = raw ? String(raw).charAt(0).toUpperCase() : '?';
      st.title = raw || '';
      row.appendChild(icon);
      row.appendChild(mid);
      row.appendChild(statsWrap);
      row.appendChild(st);
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.button !== 0) return;
        const hh = row.dataset.commitHash;
        const fp = row.dataset.filePath;
        if (!hh || !fp) return;
        const oldP = row.dataset.oldPath || '';
        hideGraphPopover();
        void window.PreviewCommitDiffViewer.openFileDiff(hh, fp, oldP);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          row.click();
        }
      });
      container.appendChild(row);
    });
  }

  async function toggleGitGraphBlock(block, hash) {
    if (!hash || !block) return;
    const expanded = block.querySelector('.git-graph-expanded');
    const fileList = block.querySelector('.git-graph-file-list');
    const row = block.querySelector('.git-graph-row');
    if (!expanded || !fileList || !row) return;
    const opening = expanded.hidden;
    if (opening) {
      expanded.hidden = false;
      block.classList.add('is-expanded');
      row.setAttribute('aria-expanded', 'true');
      if (fileList.dataset.loaded === '1') return;
      fileList.innerHTML = '<div class="git-graph-file-loading">Loading\u2026</div>';
      let data = commitFilesCache.get(hash);
      if (!data) {
        try {
          const r = await fetch('/__api__/git/commit-files?hash=' + encodeURIComponent(hash));
          data = await r.json();
          if (data.success && data.hash) {
            commitFilesCache.set(data.hash, data);
            commitFilesCache.set(hash, data);
          }
        } catch (_e) {
          data = { success: false, error: 'Request failed' };
        }
      }
      fileList.innerHTML = '';
      if (data && data.success && data.files) {
        fileList.dataset.loaded = '1';
        if (data.files.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'git-graph-file-loading';
          empty.textContent = 'No file changes in this commit.';
          fileList.appendChild(empty);
        } else {
          renderGitGraphFileList(fileList, data.files, data.hash || hash);
        }
      } else {
        const err = document.createElement('div');
        err.className = 'git-graph-file-error';
        err.textContent = (data && data.error) || 'Could not load files';
        fileList.appendChild(err);
      }
    } else {
      expanded.hidden = true;
      block.classList.remove('is-expanded');
      row.setAttribute('aria-expanded', 'false');
    }
  }

  function bindGraphRowExpand(block, hash) {
    const row = block.querySelector('.git-graph-row');
    if (!row || !hash) return;
    row.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();
      void toggleGitGraphBlock(block, hash);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void toggleGitGraphBlock(block, hash);
      }
    });
  }

  function bindGraphRowHover(row) {
    const hash = row.dataset.commitHash;
    if (!hash) return;
    row.addEventListener('pointerenter', function () {
      graphPopoverPointerOverRow = true;
      if (graphPopoverHideTimer) {
        clearTimeout(graphPopoverHideTimer);
        graphPopoverHideTimer = null;
      }
      graphPopoverShowTimer = setTimeout(function () {
        graphPopoverShowTimer = null;
        showGraphPopoverForRow(row, hash);
      }, GRAPH_POPOVER_SHOW_MS);
    });
    row.addEventListener('pointerleave', function () {
      graphPopoverPointerOverRow = false;
      if (graphPopoverShowTimer) {
        clearTimeout(graphPopoverShowTimer);
        graphPopoverShowTimer = null;
      }
      scheduleHideGraphPopover();
    });
  }
  async function refreshGraph() {
    const list = document.getElementById('gitGraphList');
    if (!list) return;
    list.innerHTML = '<div class="git-loading">Loading\u2026</div>';
    try {
      const r = await fetch('/__api__/git/log?limit=100');
      const data = await r.json();
      if (!data.success || !data.isRepo) {
        list.innerHTML = '<div class="git-empty">Open a Git repository to see commit history.</div>';
        const sh = document.getElementById('gitGraphSyncHint');
        if (sh) {
          sh.hidden = true;
          sh.textContent = '';
          sh.classList.remove('has-unpushed');
        }
        return;
      }
      const branch = data.branch || '';
      const branchTips = data.branchTips || [];
      const syncHint = document.getElementById('gitGraphSyncHint');
      if (syncHint) {
        const s = data.branchSync;
        if (s && s.upstream) {
          syncHint.hidden = false;
          if ((s.ahead || 0) > 0 || (s.behind || 0) > 0) {
            const parts = [];
            if (s.ahead > 0) parts.push(s.ahead + ' unpushed');
            if (s.behind > 0) parts.push(s.behind + ' behind ' + s.upstream);
            syncHint.textContent = parts.join(' · ');
            syncHint.title =
              'Local ' +
              (s.localRef || 'branch') +
              ' vs ' +
              s.upstream +
              ' (counts use your last fetch)';
            syncHint.classList.toggle('has-unpushed', s.ahead > 0);
          } else {
            syncHint.textContent = 'Synced with ' + s.upstream;
            syncHint.title = 'Local ' + (s.localRef || 'branch') + ' matches ' + s.upstream;
            syncHint.classList.remove('has-unpushed');
          }
        } else {
          syncHint.hidden = true;
          syncHint.textContent = '';
          syncHint.classList.remove('has-unpushed');
        }
      }
      if (!data.commits || data.commits.length === 0) {
        list.innerHTML = '<div class="git-empty">No commits yet.</div>';
        return;
      }
      list.innerHTML = '';
      commitFilesCache.clear();
      data.commits.forEach(function (c) {
        const block = document.createElement('div');
        block.className = 'git-graph-block';
        const row = document.createElement('div');
        row.className = 'git-graph-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-expanded', 'false');
        row.title = 'Click to expand or collapse files changed';
        if (c.hash) row.dataset.commitHash = c.hash;
        const rail = document.createElement('div');
        rail.className = 'git-graph-rail';
        const dot = document.createElement('span');
        dot.className = 'git-graph-dot' + (c.isHead ? ' is-head' : '');
        rail.appendChild(dot);
        const main = document.createElement('div');
        main.className = 'git-graph-main';
        const msg = document.createElement('div');
        msg.className = 'git-graph-msg';
        msg.textContent = c.subject || '(no message)';
        msg.title = (c.hash || '').slice(0, 12);
        main.appendChild(msg);
        const meta = document.createElement('div');
        meta.className = 'git-graph-meta';
        meta.textContent = c.author || '';
        main.appendChild(meta);
        const tags = document.createElement('div');
        tags.className = 'git-graph-tags';
        let showedTip = false;
        branchTips.forEach(function (tip) {
          if (c.hash === tip.hash) {
            showedTip = true;
            const pill = document.createElement('span');
            pill.className =
              'git-graph-branch-pill' + (tip.kind === 'remote' ? ' is-remote' : '');
            pill.textContent = tip.label;
            pill.title =
              tip.kind === 'remote'
                ? 'Remote tip: ' + tip.label + ' (last seen from fetch)'
                : 'Local branch tip: ' + tip.label;
            tags.appendChild(pill);
          }
        });
        if (!showedTip && c.isHead && branch) {
          const pill = document.createElement('span');
          pill.className = 'git-graph-branch-pill';
          pill.textContent = branch;
          pill.title = 'HEAD';
          tags.appendChild(pill);
        }
        row.appendChild(rail);
        row.appendChild(main);
        row.appendChild(tags);
        const expanded = document.createElement('div');
        expanded.className = 'git-graph-expanded';
        expanded.hidden = true;
        const expRail = document.createElement('div');
        expRail.className = 'git-graph-expand-rail';
        expRail.setAttribute('aria-hidden', 'true');
        const fileList = document.createElement('div');
        fileList.className = 'git-graph-file-list';
        expanded.appendChild(expRail);
        expanded.appendChild(fileList);
        block.appendChild(row);
        block.appendChild(expanded);
        list.appendChild(block);
        bindGraphRowHover(row);
        if (c.hash) bindGraphRowExpand(block, c.hash);
      });
    } catch (_e) {
      list.innerHTML = '<div class="git-empty">Could not load history.</div>';
    }
  }

  return {
    init: init,
    refreshGraph: refreshGraph,
    hideGraphPopover: hideGraphPopover,
    graphPopoverPointerPathKeepsOpen: graphPopoverPointerPathKeepsOpen,
  };
})();
