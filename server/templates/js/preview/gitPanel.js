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
  /** Wrapper: source control + commit graph (fills explorer when open). */
  let gitStackEl = null;
  let isVisible = false;
  let activeTab = 'local';

  /** @type {{ path: string, name: string }[]} */
  let localStagedFiles = [];

  /** @type {Map<string, object>} */
  const commitInfoCache = new Map();
  /** @type {Map<string, { success: boolean, files?: object[] }>} */
  const commitFilesCache = new Map();
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
    }
    const el = pointerEventRetargetToElement(e.target);
    if (!el || !el.closest) return false;
    if (el.closest('.git-graph-popover')) return true;
    if (el.closest('.git-graph-panel')) return true;
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
      '<span class="git-graph-popover-footer-sep" aria-hidden="true"></span>' +
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
    const sepEl = el.querySelector('.git-graph-popover-footer-sep');

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
    if (ghEl) {
      if (data.githubCommitUrl) {
        ghEl.href = data.githubCommitUrl;
        ghEl.hidden = false;
        if (sepEl) sepEl.hidden = false;
      } else {
        ghEl.removeAttribute('href');
        ghEl.hidden = true;
        if (sepEl) sepEl.hidden = true;
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
    if (authorEl) authorEl.textContent = 'Loading\u2026';
    if (timeEl) timeEl.textContent = '';
    if (msgEl) msgEl.textContent = '';
    if (statsEl) statsEl.textContent = '';
    if (pillsEl) pillsEl.textContent = '';
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

  function renderGitGraphFileList(container, files) {
    container.textContent = '';
    const list = Array.isArray(files) ? files : [];
    list.forEach(function (f) {
      const p = f.path || '';
      const kind = gitGraphFileIconKind(p);
      const parts = splitCommitDisplayPath(p);
      const row = document.createElement('div');
      row.className = 'git-graph-file-row';
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
          renderGitGraphFileList(fileList, data.files);
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

  function setExplorerSourceControlMode(on) {
    if (!on) {
      hideGraphPopover();
    }
    const filesPane = document.getElementById('explorerFilesPane');
    const stack = document.getElementById('gitExplorerStack');
    if (filesPane) filesPane.hidden = !!on;
    if (stack) stack.hidden = !on;
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
        return;
      }
      if (!data.commits || data.commits.length === 0) {
        list.innerHTML = '<div class="git-empty">No commits yet.</div>';
        return;
      }
      const branch = data.branch || '';
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
        if (c.isHead && branch) {
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
    await refreshGraph();
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

    const graphPanel = document.createElement('div');
    graphPanel.id = 'gitGraphPanel';
    graphPanel.className = 'git-graph-panel';
    graphPanel.innerHTML =
      '<div class="git-graph-header">' +
      '<span class="git-graph-title">GRAPH</span>' +
      '<div class="git-graph-toolbar">' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphFetchBtn" title="Fetch">Fetch</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphPullBtn" title="Pull">Pull</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphPushBtn" title="Push">Push</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphRefreshBtn" title="Refresh graph">\u21bb</button>' +
      '</div></div>' +
      '<div class="git-graph-list" id="gitGraphList"></div>';

    gitStackEl = document.createElement('div');
    gitStackEl.id = 'gitExplorerStack';
    gitStackEl.className = 'git-explorer-stack';
    gitStackEl.hidden = true;
    gitStackEl.appendChild(panel);
    gitStackEl.appendChild(graphPanel);

    const explorerBody = document.getElementById('explorerBody');
    if (explorerBody) {
      explorerBody.appendChild(gitStackEl);
    } else {
      const fileExplorerPanel = document.getElementById('fileExplorerPanel');
      const terminalPanel = document.getElementById('terminalPanel');
      if (fileExplorerPanel && terminalPanel && terminalPanel.parentNode === fileExplorerPanel) {
        fileExplorerPanel.insertBefore(gitStackEl, terminalPanel);
      } else if (fileExplorerPanel) {
        fileExplorerPanel.appendChild(gitStackEl);
      } else {
        document.body.appendChild(gitStackEl);
      }
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
    hideGraphPopover();
    setExplorerSourceControlMode(false);
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

    document.getElementById('gitGraphRefreshBtn')?.addEventListener('click', () => refreshGraph());
    document.getElementById('gitGraphFetchBtn')?.addEventListener('click', async function () {
      await repoFetch();
      await refreshGraph();
    });
    document.getElementById('gitGraphPullBtn')?.addEventListener('click', async function () {
      await repoPull();
      await refreshGraph();
    });
    document.getElementById('gitGraphPushBtn')?.addEventListener('click', async function () {
      await repoPush();
      await refreshGraph();
    });

    document.getElementById('gitGraphList')?.addEventListener(
      'scroll',
      function () {
        hideGraphPopover();
      },
      { passive: true }
    );
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
      createPanel();
      isVisible = !isVisible;

      if (isVisible) {
        setExplorerSourceControlMode(true);
        setActiveTab(activeTab);
        refreshGraph();
        if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
          PreviewGitStatusBar.refresh();
        }
      } else {
        closePanel();
      }
    },

    show() {
      createPanel();
      isVisible = true;
      setExplorerSourceControlMode(true);
      setActiveTab(activeTab);
      refreshGraph();
    },

    showRepoTab() {
      createPanel();
      isVisible = true;
      setExplorerSourceControlMode(true);
      setActiveTab('repo');
      refreshGraph();
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
