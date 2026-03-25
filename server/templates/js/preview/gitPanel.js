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
        window.__previewDiscordGitBranch = '';
        window.__previewDiscordGitRepo = '';
        window.__previewDiscordGitOwner = '';
        if (window.PreviewDiscordPresence && typeof window.PreviewDiscordPresence.onGitMetadataUpdated === 'function') {
          window.PreviewDiscordPresence.onGitMetadataUpdated();
        }
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
      window.__previewDiscordGitBranch = data.branch || '';
      window.__previewDiscordGitRepo = data.gitRepo || '';
      window.__previewDiscordGitOwner = data.gitOwner || '';
      if (window.PreviewDiscordPresence && typeof window.PreviewDiscordPresence.onGitMetadataUpdated === 'function') {
        window.PreviewDiscordPresence.onGitMetadataUpdated();
      }
    } catch (_e) {
      el.hidden = true;
      if (sep) sep.hidden = true;
      window.__previewDiscordGitBranch = '';
      window.__previewDiscordGitRepo = '';
      window.__previewDiscordGitOwner = '';
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
  if (window.PreviewCommitDiffViewer && typeof PreviewCommitDiffViewer.setCommitFilesLookup === 'function') {
    PreviewCommitDiffViewer.setCommitFilesLookup(async function (hash) {
      let data = commitFilesCache.get(hash);
      if (data && data.files) return data;
      try {
        const r = await fetch('/__api__/git/commit-files?hash=' + encodeURIComponent(hash));
        data = await r.json();
        if (data.success && data.hash) {
          commitFilesCache.set(data.hash, data);
          commitFilesCache.set(hash, data);
        }
        return data;
      } catch (_e) {
        return { success: false };
      }
    });
  }
  if (window.PreviewGitPanelGraph && typeof PreviewGitPanelGraph.init === 'function') {
    PreviewGitPanelGraph.init({ commitInfoCache, commitFilesCache });
  }

  const LS_LOCAL_STASH = 'astroEditorLocalStashList';
  const LS_STASH_H = 'astroGitStashHeightPx';
  const LS_STASH_COLLAPSED = 'astroGitStashCollapsed';
  let localStashPopoverEl = null;
  let stashPopoverDismissBound = false;
  let stashPopoverResizeBound = false;
  /** @type {{ id: string, label: string, note: string, files: { path: string, name: string }[], savedAt: string }[]} */
  let localStashEntries = [];

  const LS_GRAPH_H = 'astroGitGraphHeightPx';
  const LS_GRAPH_COLLAPSED = 'astroGitGraphCollapsed';
  const GRAPH_H_MIN = 80;
  const GRAPH_H_MAX = 900;
  let graphResizeActive = false;

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

  function loadLocalStashFromStorage() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_LOCAL_STASH) : null;
      if (!raw) {
        localStashEntries = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStashEntries = parsed.filter(
          (e) =>
            e &&
            typeof e.id === 'string' &&
            Array.isArray(e.files) &&
            e.files.every((f) => f && typeof f.path === 'string')
        );
      } else {
        localStashEntries = [];
      }
    } catch (_e) {
      localStashEntries = [];
    }
  }

  function persistLocalStash() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_LOCAL_STASH, JSON.stringify(localStashEntries));
      }
    } catch (_e) {
      /* ignore */
    }
  }

  function positionStashPopoverNearButton(anchor, popEl) {
    if (!anchor || !popEl) return;
    popEl.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const r = anchor.getBoundingClientRect();
        const pw = popEl.offsetWidth;
        const ph = popEl.offsetHeight;
        let left = r.left;
        let top = r.bottom + 6;
        if (left + pw > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - pw - 8);
        }
        if (left < 8) left = 8;
        if (top + ph > window.innerHeight - 8) {
          top = r.top - ph - 6;
        }
        if (top < 8) top = 8;
        popEl.style.left = left + 'px';
        popEl.style.top = top + 'px';
      });
    });
  }

  function hideLocalStashPopover() {
    if (localStashPopoverEl) {
      localStashPopoverEl.hidden = true;
      localStashPopoverEl.dataset.open = '';
    }
  }

  function hideAllStashPopovers() {
    hideLocalStashPopover();
  }

  function ensureStashPopoverDismiss() {
    if (stashPopoverDismissBound) return;
    stashPopoverDismissBound = true;
    document.addEventListener(
      'pointerdown',
      function (e) {
        const t = e.target;
        if (t && t.nodeType === 1) {
          if (
            t.closest &&
            (t.closest('#gitLocalStashBtn') ||
              t.closest('.git-stash-popover-local'))
          ) {
            return;
          }
        }
        hideAllStashPopovers();
      },
      true
    );
    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key !== 'Escape') return;
        hideAllStashPopovers();
      },
      true
    );
  }

  function ensureLocalStashPopover() {
    if (localStashPopoverEl) return localStashPopoverEl;
    const wrap = document.createElement('div');
    wrap.className = 'git-graph-popover git-stash-anchor-popover git-stash-popover-local';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Editor cache stash');
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="git-stash-popover-inner">' +
      '<div class="git-stash-popover-head">' +
      '<span class="git-stash-popover-title">Editor cache stash</span>' +
      '<button type="button" class="git-graph-popover-close git-stash-popover-close" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<p class="git-stash-popover-desc">Save or restore the <strong>Staged for save</strong> file list in this browser (local only).</p>' +
      '<div class="git-stash-popover-actions">' +
      '<button type="button" class="git-btn git-btn-small git-local-stash-save">Save staging list</button>' +
      '</div>' +
      '<div class="git-stash-popover-list" id="localStashPopoverList"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    localStashPopoverEl = wrap;
    wrap.querySelector('.git-stash-popover-close')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideLocalStashPopover();
    });
    wrap.querySelector('.git-local-stash-save')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      void localStashSaveCurrent();
    });
    ensureStashPopoverDismiss();
    ensureStashPopoverResize();
    return wrap;
  }

  function ensureStashPopoverResize() {
    if (stashPopoverResizeBound) return;
    stashPopoverResizeBound = true;
    window.addEventListener('resize', function () {
      const lBtn = document.getElementById('gitLocalStashBtn');
      if (localStashPopoverEl && !localStashPopoverEl.hidden && lBtn) {
        positionStashPopoverNearButton(lBtn, localStashPopoverEl);
      }
    });
  }

  /** @type {'notice'|'confirm'|'prompt'|null} */
  let gitPanelModalKind = null;
  let gitPanelModalEl = null;
  let gitPanelModalResolve = null;
  let gitPanelModalKeydownBound = false;

  function closeGitPanelModal(result) {
    const fn = gitPanelModalResolve;
    gitPanelModalResolve = null;
    gitPanelModalKind = null;
    if (gitPanelModalEl) {
      gitPanelModalEl.hidden = true;
      gitPanelModalEl.setAttribute('aria-hidden', 'true');
    }
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    if (fn) fn(result);
  }

  function dismissGitPanelModal() {
    if (!gitPanelModalResolve) return;
    const kind = gitPanelModalKind;
    const fn = gitPanelModalResolve;
    gitPanelModalResolve = null;
    gitPanelModalKind = null;
    if (gitPanelModalEl) {
      gitPanelModalEl.hidden = true;
      gitPanelModalEl.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    if (fn) {
      if (kind === 'confirm') fn(false);
      else if (kind === 'prompt') fn(null);
      else fn(undefined);
    }
  }

  function ensureGitPanelGenericModal() {
    if (gitPanelModalEl) return gitPanelModalEl;
    const overlay = document.createElement('div');
    overlay.className = 'git-stash-reason-overlay git-panel-generic-modal';
    overlay.id = 'gitPanelGenericModal';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="git-stash-reason-dialog git-panel-generic-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="gitPanelModalTitle">' +
      '<div class="git-stash-reason-head">' +
      '<h2 id="gitPanelModalTitle" class="git-stash-reason-title">Message</h2>' +
      '<button type="button" class="git-stash-reason-close" id="gitPanelModalCloseBtn" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<p id="gitPanelModalBody" class="git-stash-reason-lead git-panel-modal-body"></p>' +
      '<input type="text" id="gitPanelModalInput" class="git-stash-reason-input git-panel-modal-input-single" hidden />' +
      '<div id="gitPanelModalActions" class="git-stash-reason-actions"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        if (gitPanelModalKind === 'notice') closeGitPanelModal(undefined);
        else if (gitPanelModalKind === 'confirm') closeGitPanelModal(false);
        else if (gitPanelModalKind === 'prompt') closeGitPanelModal(null);
      }
    });
    const box = overlay.querySelector('.git-panel-generic-modal-dialog');
    if (box) {
      box.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
    document.getElementById('gitPanelModalCloseBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (gitPanelModalKind === 'notice') closeGitPanelModal(undefined);
      else if (gitPanelModalKind === 'confirm') closeGitPanelModal(false);
      else if (gitPanelModalKind === 'prompt') closeGitPanelModal(null);
    });

    if (!gitPanelModalKeydownBound) {
      gitPanelModalKeydownBound = true;
      document.addEventListener(
        'keydown',
        function (e) {
          if (!gitPanelModalEl || gitPanelModalEl.hidden) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            if (gitPanelModalKind === 'notice') closeGitPanelModal(undefined);
            else if (gitPanelModalKind === 'confirm') closeGitPanelModal(false);
            else if (gitPanelModalKind === 'prompt') closeGitPanelModal(null);
          }
        },
        true
      );
    }

    gitPanelModalEl = overlay;
    return overlay;
  }

  /**
   * @param {string} message
   * @param {string} [title]
   * @returns {Promise<void>}
   */
  function showGitPanelNotice(message, title) {
    if (gitPanelModalResolve) {
      return Promise.resolve();
    }
    gitPanelModalKind = 'notice';
    const overlay = ensureGitPanelGenericModal();
    const titleEl = document.getElementById('gitPanelModalTitle');
    const bodyEl = document.getElementById('gitPanelModalBody');
    const inputEl = document.getElementById('gitPanelModalInput');
    const actionsEl = document.getElementById('gitPanelModalActions');
    if (titleEl) titleEl.textContent = title || 'Message';
    if (bodyEl) bodyEl.textContent = String(message || '');
    if (inputEl) {
      inputEl.hidden = true;
      inputEl.value = '';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'git-btn git-btn-primary';
      ok.textContent = 'OK';
      ok.addEventListener('click', function (e) {
        e.preventDefault();
        closeGitPanelModal(undefined);
      });
      actionsEl.appendChild(ok);
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    return new Promise(function (resolve) {
      gitPanelModalResolve = resolve;
    });
  }

  /**
   * @param {string} message
   * @param {string} [title]
   * @param {{ confirmLabel?: string, cancelLabel?: string, destructive?: boolean }} [opts]
   * @returns {Promise<boolean>}
   */
  function showGitPanelConfirm(message, title, opts) {
    opts = opts || {};
    if (gitPanelModalResolve) {
      return Promise.resolve(false);
    }
    gitPanelModalKind = 'confirm';
    const overlay = ensureGitPanelGenericModal();
    const titleEl = document.getElementById('gitPanelModalTitle');
    const bodyEl = document.getElementById('gitPanelModalBody');
    const inputEl = document.getElementById('gitPanelModalInput');
    const actionsEl = document.getElementById('gitPanelModalActions');
    if (titleEl) titleEl.textContent = title || 'Confirm';
    if (bodyEl) bodyEl.textContent = String(message || '');
    if (inputEl) {
      inputEl.hidden = true;
      inputEl.value = '';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'git-btn git-btn-secondary';
      cancel.textContent = opts.cancelLabel || 'Cancel';
      cancel.addEventListener('click', function (e) {
        e.preventDefault();
        closeGitPanelModal(false);
      });
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'git-btn git-btn-primary' + (opts.destructive ? ' git-panel-modal-btn-danger' : '');
      ok.textContent = opts.confirmLabel || 'OK';
      ok.addEventListener('click', function (e) {
        e.preventDefault();
        closeGitPanelModal(true);
      });
      actionsEl.appendChild(cancel);
      actionsEl.appendChild(ok);
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    return new Promise(function (resolve) {
      gitPanelModalResolve = resolve;
    });
  }

  /**
   * @param {string} message
   * @param {string} [title]
   * @param {{ defaultValue?: string, placeholder?: string, confirmLabel?: string, cancelLabel?: string }} [opts]
   * @returns {Promise<string|null>}
   */
  function showGitPanelPrompt(message, title, opts) {
    opts = opts || {};
    if (gitPanelModalResolve) {
      return Promise.resolve(null);
    }
    gitPanelModalKind = 'prompt';
    const overlay = ensureGitPanelGenericModal();
    const titleEl = document.getElementById('gitPanelModalTitle');
    const bodyEl = document.getElementById('gitPanelModalBody');
    const inputEl = document.getElementById('gitPanelModalInput');
    const actionsEl = document.getElementById('gitPanelModalActions');
    if (titleEl) titleEl.textContent = title || 'Input';
    if (bodyEl) bodyEl.textContent = String(message || '');
    if (inputEl) {
      inputEl.hidden = false;
      inputEl.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
      inputEl.placeholder = opts.placeholder || '';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'git-btn git-btn-secondary';
      cancel.textContent = opts.cancelLabel || 'Cancel';
      cancel.addEventListener('click', function (e) {
        e.preventDefault();
        closeGitPanelModal(null);
      });
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'git-btn git-btn-primary';
      ok.textContent = opts.confirmLabel || 'OK';
      ok.addEventListener('click', function (e) {
        e.preventDefault();
        const v = inputEl ? String(inputEl.value || '').trim() : '';
        closeGitPanelModal(v);
      });
      actionsEl.appendChild(cancel);
      actionsEl.appendChild(ok);
    }
    if (inputEl) {
      inputEl.onkeydown = function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          closeGitPanelModal(String(inputEl.value || '').trim());
        }
      };
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    return new Promise(function (resolve) {
      gitPanelModalResolve = resolve;
      requestAnimationFrame(function () {
        if (inputEl) inputEl.focus();
      });
    });
  }

  function renderLocalStashPopoverList() {
    const list = document.getElementById('localStashPopoverList');
    if (!list) return;
    loadLocalStashFromStorage();
    if (localStashEntries.length === 0) {
      list.innerHTML = '<div class="git-stash-popover-empty">No saved staging lists.</div>';
      return;
    }
    list.innerHTML = '';
    localStashEntries.forEach(function (entry) {
      const row = document.createElement('div');
      row.className = 'git-stash-popover-row';
      const main = document.createElement('div');
      main.className = 'git-stash-popover-row-main';
      const title = document.createElement('div');
      title.className = 'git-stash-popover-msg';
      title.textContent = entry.label || entry.id;
      const meta = document.createElement('div');
      meta.className = 'git-stash-popover-meta';
      const n = (entry.files && entry.files.length) || 0;
      let when = '';
      if (entry.savedAt) {
        const d = new Date(entry.savedAt);
        if (!isNaN(d.getTime())) {
          when = formatRelativeTime(d) + ' — ' + formatAbsoluteDateTime(d);
        }
      }
      meta.textContent = n + ' file' + (n === 1 ? '' : 's') + (when ? ' · ' + when : '');
      main.appendChild(title);
      main.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = 'git-stash-popover-row-actions';
      function btn(label, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'git-btn git-btn-small';
        b.textContent = label;
        b.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          fn();
        });
        actions.appendChild(b);
      }
      btn('Apply', function () {
        void localStashApply(entry.id, false);
      });
      btn('Pop', function () {
        void localStashApply(entry.id, true);
      });
      btn('Drop', function () {
        void (async function () {
          const ok = await showGitPanelConfirm(
            'Remove this saved staging list?',
            'Editor cache stash',
            { confirmLabel: 'Remove', destructive: true }
          );
          if (!ok) return;
          localStashEntries = localStashEntries.filter((e) => e.id !== entry.id);
          persistLocalStash();
          renderLocalStashPopoverList();
        })();
      });
      row.appendChild(main);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  async function localStashSaveCurrent() {
    loadLocalStashFromStorage();
    if (localStagedFiles.length === 0) {
      await showGitPanelNotice('Stage files in “Staged for save” first.', 'Editor cache stash');
      return;
    }
    const labelIn = await showGitPanelPrompt(
      'Label for this saved list (optional)',
      'Editor cache stash',
      { defaultValue: 'Stash ' + (localStashEntries.length + 1) }
    );
    if (labelIn === null) return;
    const noteEl = document.getElementById('gitLocalNote');
    const noteText = noteEl && noteEl.value ? String(noteEl.value).trim() : '';
    const entry = {
      id: 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      label: (labelIn && String(labelIn).trim()) || 'Stash',
      note: noteText,
      files: localStagedFiles.map((f) => ({ path: f.path, name: f.name })),
      savedAt: new Date().toISOString(),
    };
    localStashEntries.unshift(entry);
    persistLocalStash();
    renderLocalStashPopoverList();
  }

  async function localStashApply(id, dropAfter) {
    loadLocalStashFromStorage();
    const entry = localStashEntries.find((e) => e.id === id);
    if (!entry || !entry.files) {
      await showGitPanelNotice('Saved list not found.', 'Editor cache stash');
      return;
    }
    localStagedFiles = entry.files.map((f) => ({
      path: f.path,
      name: f.name || (f.path && f.path.split('/').pop()) || f.path,
    }));
    renderLocalStagedFiles();
    void refreshLocalTab();
    if (dropAfter) {
      localStashEntries = localStashEntries.filter((e) => e.id !== id);
      persistLocalStash();
    }
    renderLocalStashPopoverList();
    if (entry.note && document.getElementById('gitLocalNote')) {
      const n = document.getElementById('gitLocalNote');
      if (n) n.value = entry.note;
    }
  }

  function toggleLocalStashPopover() {
    const btn = document.getElementById('gitLocalStashBtn');
    const el = ensureLocalStashPopover();
    if (!el.hidden && el.dataset.open === '1') {
      hideLocalStashPopover();
      return;
    }
    el.dataset.open = '1';
    renderLocalStashPopoverList();
    if (btn) positionStashPopoverNearButton(btn, el);
    else el.hidden = false;
  }

  function setExplorerSourceControlMode(on) {
    if (!on) {
      if (window.PreviewGitPanelGraph && typeof PreviewGitPanelGraph.hideGraphPopover === 'function') {
        PreviewGitPanelGraph.hideGraphPopover();
      }
      hideAllStashPopovers();
      if (window.PreviewGitPanelStash && typeof PreviewGitPanelStash.dismissStashReasonDialog === 'function') {
        PreviewGitPanelStash.dismissStashReasonDialog();
      }
      dismissGitPanelModal();
    }
    const filesPane = document.getElementById('explorerFilesPane');
    const stack = document.getElementById('gitExplorerStack');
    if (filesPane) filesPane.hidden = !!on;
    if (stack) stack.hidden = !on;
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
    const text = await response.text();
    if (!text) {
      return {
        success: response.ok,
        error: response.ok ? undefined : 'Empty response (' + response.status + ')',
      };
    }
    try {
      return JSON.parse(text);
    } catch (_e) {
      return {
        success: false,
        error: 'Bad response (' + response.status + '): ' + text.slice(0, 200),
      };
    }
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
          const st = document.createElement('button');
          st.type = 'button';
          st.className = 'git-btn git-btn-small git-btn-gitrow';
          st.textContent = 'Stash';
          st.title = f.untracked ? 'Stash only this file (includes untracked)' : 'Stash only this file';
          st.addEventListener('click', function (e) {
            e.stopPropagation();
            void PreviewGitPanelStash.stashRepoPathSingleFile(p, f.untracked);
          });
          actions.appendChild(st);
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
      await showGitPanelNotice(data.error || 'Stage failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function unstageRepoPath(filePath) {
    const data = await apiPostJson('/__api__/git/unstage', { paths: [filePath] });
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Unstage failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function repoCommit() {
    const input = document.getElementById('gitRepoCommitMessage');
    const message = input && input.value ? input.value.trim() : '';
    if (!message) {
      await showGitPanelNotice('Enter a commit message in the box below.', 'Commit');
      return;
    }
    const data = await apiPostJson('/__api__/git/commit', { message: message });
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Commit failed', 'Git');
      return;
    }
    if (input) input.value = '';
    await refreshRepoTab();
    await PreviewGitPanelGraph.refreshGraph();
  }

  async function repoFetch() {
    const data = await apiPostJson('/__api__/git/fetch', {});
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Fetch failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function repoPull() {
    const data = await apiPostJson('/__api__/git/pull', {});
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Pull failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function repoPush() {
    const data = await apiPostJson('/__api__/git/push', {});
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Push failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function repoStageAll() {
    const data = await apiPostJson('/__api__/git/stage-all', {});
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Stage all failed', 'Git');
      return;
    }
    await refreshRepoTab();
  }

  async function repoUnstageAll() {
    const data = await apiPostJson('/__api__/git/unstage-all', {});
    if (!data.success) {
      await showGitPanelNotice(data.error || 'Unstage all failed', 'Git');
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
      '<div class="git-section-header-actions">' +
      '<button type="button" class="git-btn git-btn-small" id="gitLocalStashBtn" title="Editor cache stash">Stash\u2026</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitLocalRefreshBtn">Refresh</button>' +
      '</div>' +
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

    const stashPanel = document.createElement('div');
    stashPanel.id = 'gitStashStackPanel';
    stashPanel.className = 'git-graph-panel git-stash-stack-panel';
    stashPanel.innerHTML =
      '<div class="git-graph-header">' +
      '<div class="git-graph-header-left">' +
      '<div class="git-graph-title-row">' +
      '<button type="button" class="git-graph-collapse-btn" id="gitStashCollapseBtn" aria-expanded="true" aria-label="Collapse stash list" title="Collapse stash list">\u25bc</button>' +
      '<span class="git-graph-title">STASH</span>' +
      '</div>' +
      '</div>' +
      '<div class="git-graph-toolbar">' +
      '<button type="button" class="git-btn git-btn-small" id="gitStashPushTrackedBtn" title="Stash tracked changes">Stash</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitStashPushUntrackedBtn" title="Stash including untracked (-u)">+Untracked</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitStashStackRefreshBtn" title="Refresh stash list">\u21bb</button>' +
      '</div></div>' +
      '<div class="git-graph-body">' +
      '<div class="git-graph-list" id="gitStashStackList"></div>' +
      '</div>';

    const graphPanel = document.createElement('div');
    graphPanel.id = 'gitGraphPanel';
    graphPanel.className = 'git-graph-panel';
    graphPanel.innerHTML =
      '<div class="git-graph-header">' +
      '<div class="git-graph-header-left">' +
      '<div class="git-graph-title-row">' +
      '<button type="button" class="git-graph-collapse-btn" id="gitGraphCollapseBtn" aria-expanded="true" aria-label="Collapse graph" title="Collapse graph">\u25bc</button>' +
      '<span class="git-graph-title">GRAPH</span>' +
      '<span class="git-graph-sync-hint" id="gitGraphSyncHint" hidden></span>' +
      '</div>' +
      '</div>' +
      '<div class="git-graph-toolbar">' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphFetchBtn" title="Fetch">Fetch</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphPullBtn" title="Pull">Pull</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphPushBtn" title="Push">Push</button>' +
      '<button type="button" class="git-btn git-btn-small" id="gitGraphRefreshBtn" title="Refresh graph">\u21bb</button>' +
      '</div></div>' +
      '<div class="git-graph-body">' +
      '<div class="git-graph-list" id="gitGraphList"></div>' +
      '</div>';

    const graphSplitter = document.createElement('div');
    graphSplitter.className = 'git-graph-splitter';
    graphSplitter.id = 'gitGraphSplitter';
    graphSplitter.setAttribute('role', 'separator');
    graphSplitter.setAttribute('aria-orientation', 'horizontal');
    graphSplitter.setAttribute('aria-label', 'Resize commit graph');

    const stashSplitter = document.createElement('div');
    stashSplitter.className = 'git-graph-splitter git-stash-stack-splitter';
    stashSplitter.id = 'gitStashStackSplitter';
    stashSplitter.setAttribute('role', 'separator');
    stashSplitter.setAttribute('aria-orientation', 'horizontal');
    stashSplitter.setAttribute('aria-label', 'Resize stash list');

    gitStackEl = document.createElement('div');
    gitStackEl.id = 'gitExplorerStack';
    gitStackEl.className = 'git-explorer-stack';
    gitStackEl.hidden = true;
    gitStackEl.appendChild(panel);
    gitStackEl.appendChild(stashSplitter);
    gitStackEl.appendChild(stashPanel);
    gitStackEl.appendChild(graphSplitter);
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

    applyStashStackLayoutFromStorage(stashPanel, stashSplitter);
    applyGitGraphLayoutFromStorage(graphPanel, graphSplitter);

    setupEventHandlers();
    setupStackPanelResize(stashSplitter, stashPanel, gitStackEl, LS_STASH_H);
    setupStackPanelResize(graphSplitter, graphPanel, gitStackEl, LS_GRAPH_H);
    return panel;
  }

  function readStashHeightPx() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_STASH_H) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= GRAPH_H_MIN && n <= GRAPH_H_MAX) {
      return n;
    }
    return 160;
  }

  function readGraphHeightPx() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_GRAPH_H) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= GRAPH_H_MIN && n <= GRAPH_H_MAX) {
      return n;
    }
    return 200;
  }

  function setGraphPanelHeightPx(gp, px) {
    const h = Math.min(GRAPH_H_MAX, Math.max(GRAPH_H_MIN, Math.round(px)));
    gp.style.flex = '0 0 ' + h + 'px';
    gp.style.height = h + 'px';
  }

  function applyStashStackLayoutFromStorage(stashPanel, splitter) {
    if (!stashPanel) return;
    setGraphPanelHeightPx(stashPanel, readStashHeightPx());
    const collapsed =
      typeof localStorage !== 'undefined' && localStorage.getItem(LS_STASH_COLLAPSED) === '1';
    if (collapsed) {
      stashPanel.classList.add('is-collapsed');
      if (splitter) splitter.hidden = true;
      const btn = document.getElementById('gitStashCollapseBtn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '\u25b6';
        btn.title = 'Expand stash';
        btn.setAttribute('aria-label', 'Expand stash');
      }
    } else if (splitter) {
      splitter.hidden = false;
    }
  }

  function applyGitGraphLayoutFromStorage(graphPanel, splitter) {
    if (!graphPanel) return;
    setGraphPanelHeightPx(graphPanel, readGraphHeightPx());
    const collapsed =
      typeof localStorage !== 'undefined' && localStorage.getItem(LS_GRAPH_COLLAPSED) === '1';
    if (collapsed) {
      graphPanel.classList.add('is-collapsed');
      if (splitter) splitter.hidden = true;
      const btn = document.getElementById('gitGraphCollapseBtn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '\u25b6';
        btn.title = 'Expand graph';
        btn.setAttribute('aria-label', 'Expand graph');
      }
    } else if (splitter) {
      splitter.hidden = false;
    }
  }

  function setupStackPanelResize(splitter, panel, stackEl, lsKey) {
    if (!splitter || !panel || !stackEl) return;

    function onPointerDown(e) {
      if (panel.classList.contains('is-collapsed')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      graphResizeActive = true;
      const startY = e.clientY;
      const startH = panel.getBoundingClientRect().height;
      splitter.setPointerCapture(e.pointerId);

      function onMove(ev) {
        if (!graphResizeActive) return;
        const dy = ev.clientY - startY;
        /* Invert: drag splitter down → shrink panel; drag up → grow (matches IDE splitters). */
        let next = startH - dy;
        const stackH = stackEl.getBoundingClientRect().height;
        const maxG = Math.min(GRAPH_H_MAX, Math.max(GRAPH_H_MIN, stackH - 120));
        next = Math.min(Math.max(GRAPH_H_MIN, next), maxG);
        setGraphPanelHeightPx(panel, next);
      }

      function onUp(ev) {
        graphResizeActive = false;
        try {
          splitter.releasePointerCapture(ev.pointerId);
        } catch (_err) {
          /* ignore */
        }
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
        splitter.removeEventListener('pointercancel', onUp);
        const h = panel.getBoundingClientRect().height;
        try {
          localStorage.setItem(lsKey, String(Math.round(h)));
        } catch (_e) {
          /* ignore */
        }
      }

      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
      splitter.addEventListener('pointercancel', onUp);
    }

    splitter.addEventListener('pointerdown', onPointerDown);
  }

  function setActiveTab(tab) {
    hideAllStashPopovers();
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
    if (window.PreviewGitPanelGraph && typeof PreviewGitPanelGraph.hideGraphPopover === 'function') {
      PreviewGitPanelGraph.hideGraphPopover();
    }
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
    document.getElementById('gitLocalStashBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleLocalStashPopover();
    });
    document.getElementById('gitRepoCommitBtn')?.addEventListener('click', () => repoCommit());
    document.getElementById('gitRepoStageAllBtn')?.addEventListener('click', () => repoStageAll());
    document.getElementById('gitRepoUnstageAllBtn')?.addEventListener('click', () => repoUnstageAll());

    document.getElementById('gitGraphRefreshBtn')?.addEventListener('click', () => PreviewGitPanelGraph.refreshGraph());
    document.getElementById('gitGraphFetchBtn')?.addEventListener('click', async function () {
      await repoFetch();
      await PreviewGitPanelGraph.refreshGraph();
    });
    document.getElementById('gitGraphPullBtn')?.addEventListener('click', async function () {
      await repoPull();
      await PreviewGitPanelGraph.refreshGraph();
    });
    document.getElementById('gitGraphPushBtn')?.addEventListener('click', async function () {
      await repoPush();
      await PreviewGitPanelGraph.refreshGraph();
    });

    document.getElementById('gitStashStackRefreshBtn')?.addEventListener('click', () => PreviewGitPanelStash.refreshStashStackList());
    document.getElementById('gitStashPushTrackedBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      void PreviewGitPanelStash.gitStashPush(false);
    });
    document.getElementById('gitStashPushUntrackedBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      void PreviewGitPanelStash.gitStashPush(true);
    });

    document.getElementById('gitStashCollapseBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const sp = document.getElementById('gitStashStackPanel');
      const spl = document.getElementById('gitStashStackSplitter');
      const btn = document.getElementById('gitStashCollapseBtn');
      if (!sp || !btn) return;
      const willCollapse = !sp.classList.contains('is-collapsed');
      sp.classList.toggle('is-collapsed', willCollapse);
      if (spl) spl.hidden = willCollapse;
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      btn.textContent = willCollapse ? '\u25b6' : '\u25bc';
      btn.title = willCollapse ? 'Expand stash' : 'Collapse stash list';
      btn.setAttribute('aria-label', willCollapse ? 'Expand stash' : 'Collapse stash list');
      try {
        localStorage.setItem(LS_STASH_COLLAPSED, willCollapse ? '1' : '0');
      } catch (_err) {
        /* ignore */
      }
      if (!willCollapse) {
        setGraphPanelHeightPx(sp, readStashHeightPx());
      }
    });

    document.getElementById('gitGraphCollapseBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const gp = document.getElementById('gitGraphPanel');
      const sp = document.getElementById('gitGraphSplitter');
      const btn = document.getElementById('gitGraphCollapseBtn');
      if (!gp || !btn) return;
      const willCollapse = !gp.classList.contains('is-collapsed');
      gp.classList.toggle('is-collapsed', willCollapse);
      if (sp) sp.hidden = willCollapse;
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      btn.textContent = willCollapse ? '\u25b6' : '\u25bc';
      btn.title = willCollapse ? 'Expand graph' : 'Collapse graph';
      btn.setAttribute('aria-label', willCollapse ? 'Expand graph' : 'Collapse graph');
      try {
        localStorage.setItem(LS_GRAPH_COLLAPSED, willCollapse ? '1' : '0');
      } catch (_err) {
        /* ignore */
      }
      if (!willCollapse) {
        setGraphPanelHeightPx(gp, readGraphHeightPx());
      }
    });

    document.getElementById('gitGraphList')?.addEventListener(
      'scroll',
      function () {
        PreviewGitPanelGraph.hideGraphPopover();
      },
      { passive: true }
    );
    document.getElementById('gitStashStackList')?.addEventListener(
      'scroll',
      function () {
        PreviewGitPanelGraph.hideGraphPopover();
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
      await showGitPanelNotice('Stage files from the list above first.', 'Editor cache');
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
    await showGitPanelNotice(
      'Saved ' + n + ' file(s) to the workspace.' + (noteText ? ' Note: ' + noteText : ''),
      'Editor cache'
    );
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

  if (window.PreviewGitPanelStash && typeof PreviewGitPanelStash.init === 'function') {
    PreviewGitPanelStash.init({
      apiPostJson: apiPostJson,
      showGitPanelNotice: showGitPanelNotice,
      showGitPanelConfirm: showGitPanelConfirm,
      refreshRepoTab: refreshRepoTab,
      refreshGraph: function () {
        return window.PreviewGitPanelGraph && typeof PreviewGitPanelGraph.refreshGraph === 'function'
          ? PreviewGitPanelGraph.refreshGraph()
          : Promise.resolve();
      },
    });
  }

  return {
    toggle() {
      createPanel();
      isVisible = !isVisible;

      if (isVisible) {
        setExplorerSourceControlMode(true);
        setActiveTab(activeTab);
        PreviewGitPanelGraph.refreshGraph();
        void PreviewGitPanelStash.refreshStashStackList();
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
      PreviewGitPanelGraph.refreshGraph();
      void PreviewGitPanelStash.refreshStashStackList();
    },

    showRepoTab() {
      createPanel();
      isVisible = true;
      setExplorerSourceControlMode(true);
      setActiveTab('repo');
      PreviewGitPanelGraph.refreshGraph();
      void PreviewGitPanelStash.refreshStashStackList();
    },

    hide: closePanel,

    refresh() {
      if (activeTab === 'repo') {
        void PreviewGitPanelStash.refreshStashStackList();
        return refreshRepoTab();
      }
      return refreshLocalTab();
    },
  };
})();
