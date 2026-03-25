/**
 * Commit diff as an editor tab (virtual path gitdiff://…), same area as the in-editor browser.
 * Blobs: GET /__api__/git/commit-file-diff. Optional setCommitFilesLookup from gitPanel for cache.
 */
window.PreviewCommitDiffViewer = (function () {
  const GITDIFF_PREFIX = 'gitdiff://';
  const LCS_MAX_LINES = 5000;
  const LCS_MAX_CELLS = 5000 * 5000;
  const FOLD_EQ_THRESHOLD = 12;

  /** @type {Map<string, HTMLElement>} */
  const tabRoots = new Map();

  /** @type {null | (hash: string) => Promise<{ success?: boolean, hash?: string, files?: object[], error?: string }>} */
  let commitFilesLookup = null;

  function isGitDiffTab(p) {
    return !!(p && String(p).startsWith(GITDIFF_PREFIX));
  }

  function buildFileTabPath(hash, filePath, oldPath) {
    const h = String(hash || '').trim();
    const p = String(filePath || '');
    const enc = encodeURIComponent(p);
    if (oldPath) {
      return GITDIFF_PREFIX + 'f/' + h + '/' + enc + '/' + encodeURIComponent(String(oldPath));
    }
    return GITDIFF_PREFIX + 'f/' + h + '/' + enc;
  }

  function buildMultiTabPath(hash) {
    return GITDIFF_PREFIX + 'm/' + String(hash || '').trim();
  }

  function parseGitDiffTab(p) {
    if (!isGitDiffTab(p)) return null;
    const rest = String(p).slice(GITDIFF_PREFIX.length);
    if (rest.startsWith('m/')) {
      return { mode: 'multi', hash: rest.slice(2) };
    }
    if (rest.startsWith('f/')) {
      const after = rest.slice(2);
      const firstSlash = after.indexOf('/');
      if (firstSlash < 0) return null;
      const hash = after.slice(0, firstSlash);
      const rest2 = after.slice(firstSlash + 1);
      const secondSlash = rest2.indexOf('/');
      if (secondSlash === -1) {
        return {
          mode: 'file',
          hash,
          path: decodeURIComponent(rest2),
          oldPath: undefined,
        };
      }
      const oldDec = decodeURIComponent(rest2.slice(secondSlash + 1));
      return {
        mode: 'file',
        hash,
        path: decodeURIComponent(rest2.slice(0, secondSlash)),
        oldPath: oldDec || undefined,
      };
    }
    return null;
  }

  function getTabTitle(tabPath) {
    const spec = parseGitDiffTab(tabPath);
    if (!spec) return 'Git diff';
    const short = (spec.hash || '').slice(0, 7);
    if (spec.mode === 'multi') {
      return 'Commit ' + short;
    }
    const name =
      (spec.path || '').replace(/\\/g, '/').split('/').pop() ||
      spec.path ||
      'file';
    return name + ' \u00b7 ' + short;
  }

  function diffLinesLCS(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = new Array(m + 1);
    for (let i = 0; i <= m; i++) {
      dp[i] = new Uint16Array(n + 1);
    }
    for (let i = m - 1; i >= 0; i--) {
      const row = dp[i];
      const rowBelow = dp[i + 1];
      const ai = a[i];
      for (let j = n - 1; j >= 0; j--) {
        row[j] = ai === b[j] ? 1 + rowBelow[j + 1] : rowBelow[j] >= row[j + 1] ? rowBelow[j] : row[j + 1];
      }
    }
    const rows = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        rows.push({ type: 'eq', left: a[i], right: b[j], lnL: i + 1, lnR: j + 1 });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ type: 'del', left: a[i], right: '', lnL: i + 1, lnR: null });
        i++;
      } else {
        rows.push({ type: 'ins', left: '', right: b[j], lnL: null, lnR: j + 1 });
        j++;
      }
    }
    while (i < m) {
      rows.push({ type: 'del', left: a[i], right: '', lnL: i + 1, lnR: null });
      i++;
    }
    while (j < n) {
      rows.push({ type: 'ins', left: '', right: b[j], lnL: null, lnR: j + 1 });
      j++;
    }
    return rows;
  }

  function foldEqRuns(rows, threshold) {
    const out = [];
    let r = 0;
    while (r < rows.length) {
      if (rows[r].type !== 'eq') {
        out.push(rows[r]);
        r++;
        continue;
      }
      let end = r;
      while (end < rows.length && rows[end].type === 'eq') end++;
      const run = end - r;
      if (run <= threshold) {
        for (let k = r; k < end; k++) out.push(rows[k]);
      } else {
        const headN = Math.floor(threshold / 2);
        const tailN = threshold - headN;
        for (let k = r; k < r + headN; k++) out.push(rows[k]);
        out.push({ type: 'skip', count: run - threshold });
        for (let k = end - tailN; k < end; k++) out.push(rows[k]);
      }
      r = end;
    }
    return out;
  }

  function renderSideBySideRows(rows, tbody) {
    tbody.textContent = '';
    rows.forEach(function (row) {
      const tr = document.createElement('tr');
      if (row.type === 'skip') {
        tr.className = 'git-commit-diff-skip';
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent =
          row.count + ' unchanged line' + (row.count === 1 ? '' : 's') + ' folded';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      const lnL = document.createElement('td');
      const lcell = document.createElement('td');
      const lnR = document.createElement('td');
      const rcell = document.createElement('td');
      lnL.className = 'git-commit-diff-ln';
      lnR.className = 'git-commit-diff-ln';
      lcell.className = 'git-commit-diff-cell git-commit-diff-cell-old';
      rcell.className = 'git-commit-diff-cell git-commit-diff-cell-new';
      if (row.type === 'eq') {
        tr.className = 'git-commit-diff-row-eq';
        lnL.textContent = row.lnL != null ? String(row.lnL) : '';
        lnR.textContent = row.lnR != null ? String(row.lnR) : '';
        lcell.textContent = row.left;
        rcell.textContent = row.right;
      } else if (row.type === 'del') {
        tr.className = 'git-commit-diff-row-del';
        lnL.textContent = row.lnL != null ? String(row.lnL) : '';
        lnR.textContent = '';
        lcell.textContent = row.left;
      } else {
        tr.className = 'git-commit-diff-row-ins';
        lnR.textContent = row.lnR != null ? String(row.lnR) : '';
        lnL.textContent = '';
        rcell.textContent = row.right;
      }
      tr.appendChild(lnL);
      tr.appendChild(lcell);
      tr.appendChild(lnR);
      tr.appendChild(rcell);
      tbody.appendChild(tr);
    });
  }

  function renderPlainTwoPane(oldText, newText, body) {
    body.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'git-commit-diff-plain';
    const note = document.createElement('div');
    note.className = 'git-commit-diff-plain-note';
    note.textContent = 'Large file: full old and new text side by side (no line alignment).';
    const grid = document.createElement('div');
    grid.className = 'git-commit-diff-plain-grid';
    const preL = document.createElement('pre');
    const preR = document.createElement('pre');
    preL.textContent = oldText;
    preR.textContent = newText;
    grid.appendChild(preL);
    grid.appendChild(preR);
    wrap.appendChild(note);
    wrap.appendChild(grid);
    body.appendChild(wrap);
  }

  function renderBinaryNotice(body, filePath) {
    body.textContent = '';
    const d = document.createElement('div');
    d.className = 'git-commit-diff-binary';
    d.textContent = 'Binary or non-text file \u2014 diff not shown: ' + (filePath || '');
    body.appendChild(d);
  }

  function renderCommitFileDiffInto(body, payload) {
    body.textContent = '';
    if (payload.binary) {
      renderBinaryNotice(body, payload.path || '');
      return;
    }
    const oldT = payload.oldText != null ? String(payload.oldText) : '';
    const newT = payload.newText != null ? String(payload.newText) : '';
    const a = oldT.split(/\r?\n/);
    const b = newT.split(/\r?\n/);
    const useLcs =
      a.length <= LCS_MAX_LINES &&
      b.length <= LCS_MAX_LINES &&
      a.length * b.length <= LCS_MAX_CELLS;
    if (!useLcs) {
      renderPlainTwoPane(oldT, newT, body);
      return;
    }
    const rawRows = diffLinesLCS(a, b);
    const rows = foldEqRuns(rawRows, FOLD_EQ_THRESHOLD);
    const table = document.createElement('table');
    table.className = 'git-commit-diff-table';
    const tbody = document.createElement('tbody');
    renderSideBySideRows(rows, tbody);
    table.appendChild(tbody);
    body.appendChild(table);
  }

  async function fetchCommitFilesDefault(hash) {
    try {
      const r = await fetch('/__api__/git/commit-files?hash=' + encodeURIComponent(hash));
      return await r.json();
    } catch (_e) {
      return { success: false };
    }
  }

  async function resolveCommitFiles(hash) {
    if (commitFilesLookup) {
      try {
        const data = await commitFilesLookup(hash);
        if (data && data.success && data.files) return data;
      } catch (_e) {
        /* fall through */
      }
    }
    return fetchCommitFilesDefault(hash);
  }

  function renderMultiFileSections(container, fullHash, list) {
    container.textContent = '';
    list.forEach(function (f, idx) {
      const p = f.path || '';
      const sec = document.createElement('section');
      sec.className = 'git-commit-diff-file';
      if (idx > 0) sec.classList.add('is-collapsed');
      const headBtn = document.createElement('button');
      headBtn.type = 'button';
      headBtn.className = 'git-commit-diff-file-head';
      const status = f.status ? String(f.status) : '';
      headBtn.textContent = p + (status ? ' \u00b7 ' + status : '');
      const inner = document.createElement('div');
      inner.className = 'git-commit-diff-file-body';
      inner.hidden = idx > 0;
      headBtn.addEventListener('click', function () {
        inner.hidden = !inner.hidden;
        sec.classList.toggle('is-collapsed', inner.hidden);
      });
      sec.appendChild(headBtn);
      sec.appendChild(inner);
      container.appendChild(sec);
      inner.innerHTML = '<div class="git-commit-diff-loading">Loading\u2026</div>';
      const oldP = f.oldPath ? String(f.oldPath) : '';
      void (async function () {
        let q =
          '/__api__/git/commit-file-diff?hash=' +
          encodeURIComponent(fullHash) +
          '&path=' +
          encodeURIComponent(p);
        if (oldP) q += '&oldPath=' + encodeURIComponent(oldP);
        try {
          const r = await fetch(q);
          const d = await r.json();
          inner.textContent = '';
          if (!d.success) {
            const errEl = document.createElement('div');
            errEl.className = 'git-commit-diff-error';
            errEl.textContent = d.error || 'Could not load diff';
            inner.appendChild(errEl);
            return;
          }
          renderCommitFileDiffInto(inner, d);
        } catch (_e) {
          inner.textContent = '';
          const errEl = document.createElement('div');
          errEl.className = 'git-commit-diff-error';
          errEl.textContent = 'Request failed';
          inner.appendChild(errEl);
        }
      })();
    });
  }

  async function loadTabIntoRoot(tabPath, root) {
    const spec = parseGitDiffTab(tabPath);
    if (!spec) {
      root.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = 'Invalid diff tab';
      root.appendChild(errEl);
      return;
    }
    root.textContent = '';
    const inner = document.createElement('div');
    inner.className = 'git-diff-tab-inner';
    inner.innerHTML = '<div class="git-commit-diff-loading">Loading\u2026</div>';
    root.appendChild(inner);

    if (spec.mode === 'file') {
      let q =
        '/__api__/git/commit-file-diff?hash=' +
        encodeURIComponent(spec.hash) +
        '&path=' +
        encodeURIComponent(spec.path || '');
      if (spec.oldPath) q += '&oldPath=' + encodeURIComponent(spec.oldPath);
      try {
        const r = await fetch(q);
        const data = await r.json();
        inner.textContent = '';
        if (!data.success) {
          const errEl = document.createElement('div');
          errEl.className = 'git-commit-diff-error';
          errEl.textContent = data.error || 'Could not load diff';
          inner.appendChild(errEl);
          return;
        }
        renderCommitFileDiffInto(inner, data);
      } catch (_e) {
        inner.textContent = '';
        const errEl = document.createElement('div');
        errEl.className = 'git-commit-diff-error';
        errEl.textContent = 'Request failed';
        inner.appendChild(errEl);
      }
      return;
    }

    const data = await resolveCommitFiles(spec.hash);
    inner.textContent = '';
    if (!data || !data.success || !data.files || data.files.length === 0) {
      const errEl = document.createElement('div');
      errEl.className = 'git-commit-diff-error';
      errEl.textContent = (data && data.error) || 'No files in this commit';
      inner.appendChild(errEl);
      return;
    }
    const fullH = data.hash || spec.hash;
    renderMultiFileSections(inner, fullH, data.files);
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
    GITDIFF_PREFIX: GITDIFF_PREFIX,
    isGitDiffTab: isGitDiffTab,
    getTabTitle: getTabTitle,
    activateTab: activateTab,
    disposeTab: disposeTab,

    setCommitFilesLookup(fn) {
      commitFilesLookup = typeof fn === 'function' ? fn : null;
    },

    /** @deprecated Modal removed; noop for compatibility */
    close: function () {},

    openFileDiff: function (hash, filePath, oldPath) {
      const tabPath = buildFileTabPath(hash, filePath, oldPath);
      if (window.PreviewTabManager && typeof window.PreviewTabManager.openTab === 'function') {
        void window.PreviewTabManager.openTab(tabPath);
      }
    },

    openMultiFileDiff: function (hash) {
      const tabPath = buildMultiTabPath(hash);
      if (window.PreviewTabManager && typeof window.PreviewTabManager.openTab === 'function') {
        void window.PreviewTabManager.openTab(tabPath);
      }
    },
  };
})();
