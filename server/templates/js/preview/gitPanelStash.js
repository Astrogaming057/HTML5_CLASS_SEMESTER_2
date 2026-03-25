/**
 * Git stash (stack list, push, apply/pop/drop, reason dialog). Editor-cache stash stays in gitPanel.js.
 */
window.PreviewGitPanelStash = (function () {
  let deps = null;

  function init(d) {
    deps = d;
  }

  function apiPostJson(url, body) {
    return deps.apiPostJson(url, body);
  }
  function showGitPanelNotice(message, title) {
    return deps.showGitPanelNotice(message, title);
  }
  function showGitPanelConfirm(message, title, opts) {
    return deps.showGitPanelConfirm(message, title, opts);
  }
  async function refreshRepoTab() {
    return deps.refreshRepoTab();
  }
  async function refreshGraph() {
    return deps.refreshGraph();
  }

  let stashReasonOverlayEl = null;
  let stashReasonDialogResolve = null;

  function closeStashReasonDialog(result) {
    const fn = stashReasonDialogResolve;
    stashReasonDialogResolve = null;
    if (stashReasonOverlayEl) {
      stashReasonOverlayEl.hidden = true;
      stashReasonOverlayEl.setAttribute('aria-hidden', 'true');
    }
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    if (fn) fn(result);
  }

  function ensureStashReasonDialog() {
    if (stashReasonOverlayEl) return stashReasonOverlayEl;
    const overlay = document.createElement('div');
    overlay.className = 'git-stash-reason-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="git-stash-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="gitStashReasonTitle">' +
      '<div class="git-stash-reason-head">' +
      '<h2 id="gitStashReasonTitle" class="git-stash-reason-title">Stash</h2>' +
      '<button type="button" class="git-stash-reason-close" data-stash-reason-action="cancel" aria-label="Close">\u2715</button>' +
      '</div>' +
      '<p class="git-stash-reason-lead">Add a reason for this stash, or stash without a message.</p>' +
      '<p class="git-stash-reason-detail" id="gitStashReasonDetail" hidden></p>' +
      '<label class="git-stash-reason-label" for="gitStashReasonInput">Reason (optional)</label>' +
      '<textarea id="gitStashReasonInput" class="git-stash-reason-input" rows="3" placeholder="Why you are stashing\u2026"></textarea>' +
      '<div class="git-stash-reason-actions">' +
      '<button type="button" class="git-btn git-btn-primary" data-stash-reason-action="with-reason">Stash with reason</button>' +
      '<button type="button" class="git-btn git-btn-secondary" data-stash-reason-action="without">Stash without message</button>' +
      '<button type="button" class="git-btn git-btn-secondary" data-stash-reason-action="cancel">Cancel</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        e.preventDefault();
        closeStashReasonDialog(null);
      }
    });
    const dialogBox = overlay.querySelector('.git-stash-reason-dialog');
    if (dialogBox) {
      dialogBox.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    overlay.querySelectorAll('[data-stash-reason-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.getAttribute('data-stash-reason-action');
        const ta = document.getElementById('gitStashReasonInput');
        const raw = ta && ta.value ? String(ta.value).trim() : '';
        if (action === 'cancel') {
          closeStashReasonDialog(null);
          return;
        }
        if (action === 'without') {
          closeStashReasonDialog('');
          return;
        }
        if (action === 'with-reason') {
          closeStashReasonDialog(raw);
        }
      });
    });

    document.addEventListener(
      'keydown',
      function onKey(e) {
        if (!stashReasonOverlayEl || stashReasonOverlayEl.hidden) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeStashReasonDialog(null);
        }
      },
      true
    );

    stashReasonOverlayEl = overlay;
    return overlay;
  }

  /**
   * @param {{ heading?: string, detailPath?: string }} opts
   * @returns {Promise<string|null>} Resolved stash message, or null if cancelled.
   */
  function openStashReasonDialog(opts) {
    opts = opts || {};
    if (stashReasonDialogResolve) {
      return Promise.resolve(null);
    }
    const overlay = ensureStashReasonDialog();
    const titleEl = overlay.querySelector('.git-stash-reason-title');
    const detailEl = document.getElementById('gitStashReasonDetail');
    const ta = document.getElementById('gitStashReasonInput');
    if (titleEl) {
      titleEl.textContent = opts.heading || 'Stash';
    }
    if (detailEl) {
      const dp = opts.detailPath ? String(opts.detailPath).trim() : '';
      if (dp) {
        detailEl.hidden = false;
        detailEl.textContent = 'File: ' + dp;
      } else {
        detailEl.hidden = true;
        detailEl.textContent = '';
      }
    }
    if (ta) {
      ta.value = '';
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    return new Promise(function (resolve) {
      stashReasonDialogResolve = resolve;
      requestAnimationFrame(function () {
        if (ta) {
          ta.focus();
        }
      });
    });
  }

  async function gitStashPush(includeUntracked, paths, fixedMessage) {
    let messageStr = '';
    if (fixedMessage !== undefined && fixedMessage !== null) {
      messageStr = String(fixedMessage).trim();
    } else {
      const detailPath =
        paths && paths.length === 1 ? paths[0] : paths && paths.length ? paths.join(', ') : '';
      const asked = await openStashReasonDialog({
        heading: 'Stash changes',
        detailPath: detailPath,
      });
      if (asked === null) return;
      messageStr = asked;
    }
    const body = {
      message: messageStr,
      includeUntracked: !!includeUntracked,
    };
    if (paths && paths.length) {
      body.paths = paths;
    }
    try {
      const data = await apiPostJson('/__api__/git/stash/push', body);
      if (!data || !data.success) {
        await showGitPanelNotice((data && data.error) || 'Stash failed', 'Stash');
        return;
      }
      await refreshRepoTab();
      await refreshStashStackList();
      await refreshGraph();
      if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
        PreviewGitStatusBar.refresh();
      }
    } catch (err) {
      console.error('git stash push', err);
      await showGitPanelNotice(err && err.message ? err.message : 'Stash request failed', 'Stash');
    }
  }

  function normalizeGitRepoPath(p) {
    return String(p || '').replace(/\\/g, '/');
  }

  async function stashRepoPathSingleFile(filePath, untracked) {
    await gitStashPush(!!untracked, [normalizeGitRepoPath(filePath)]);
  }

  async function refreshStashStackList() {
    const list = document.getElementById('gitStashStackList');
    if (!list) return;
    list.innerHTML = '<div class="git-stash-popover-loading">Loading\u2026</div>';
    try {
      const r = await fetch('/__api__/git/stash');
      const data = await r.json();
      if (!data.success || !data.isRepo) {
        list.innerHTML =
          '<div class="git-stash-popover-empty">' +
          (data.isRepo === false ? 'Not a Git repository.' : (data.error || 'Could not load stashes.')) +
          '</div>';
        return;
      }
      const stashes = data.stashes || [];
      if (stashes.length === 0) {
        list.innerHTML = '<div class="git-stash-popover-empty">No stashes yet.</div>';
        return;
      }
      list.innerHTML = '';
      stashes.forEach(function (s) {
        const row = document.createElement('div');
        row.className = 'git-stash-popover-row';
        const main = document.createElement('div');
        main.className = 'git-stash-popover-row-main';
        const refEl = document.createElement('code');
        refEl.className = 'git-stash-popover-ref';
        refEl.textContent = s.ref || '';
        const msgEl = document.createElement('div');
        msgEl.className = 'git-stash-popover-msg';
        msgEl.textContent = s.message || '';
        msgEl.title = s.message || '';
        main.appendChild(refEl);
        main.appendChild(msgEl);
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
            void fn();
          });
          actions.appendChild(b);
        }
        btn('Apply', async function () {
          const d = await apiPostJson('/__api__/git/stash/apply', { ref: s.ref });
          if (!d.success) {
            await showGitPanelNotice(d.error || 'Apply failed', 'Stash');
            return;
          }
          await refreshRepoTab();
          await refreshStashStackList();
          if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
            PreviewGitStatusBar.refresh();
          }
        });
        btn('Pop', async function () {
          const ok = await showGitPanelConfirm(
            'Pop ' +
              s.ref +
              '? This applies the stash and removes it from the list.',
            'Pop stash',
            { confirmLabel: 'Pop' }
          );
          if (!ok) return;
          const d = await apiPostJson('/__api__/git/stash/pop', { ref: s.ref });
          if (!d.success) {
            await showGitPanelNotice(d.error || 'Pop failed', 'Stash');
            return;
          }
          await refreshRepoTab();
          await refreshGraph();
          await refreshStashStackList();
          if (window.PreviewGitStatusBar && typeof PreviewGitStatusBar.refresh === 'function') {
            PreviewGitStatusBar.refresh();
          }
        });
        btn('Drop', async function () {
          const ok = await showGitPanelConfirm(
            'Drop ' + s.ref + '? This cannot be undone.',
            'Drop stash',
            { confirmLabel: 'Drop', destructive: true }
          );
          if (!ok) return;
          const d = await apiPostJson('/__api__/git/stash/drop', { ref: s.ref });
          if (!d.success) {
            await showGitPanelNotice(d.error || 'Drop failed', 'Stash');
            return;
          }
          await refreshStashStackList();
        });
        row.appendChild(main);
        row.appendChild(actions);
        list.appendChild(row);
      });
    } catch (_e) {
      list.innerHTML = '<div class="git-stash-popover-empty">Could not load stashes.</div>';
    }
  }

  return {
    init: init,
    refreshStashStackList: refreshStashStackList,
    gitStashPush: gitStashPush,
    stashRepoPathSingleFile: stashRepoPathSingleFile,
    dismissStashReasonDialog: function () {
      closeStashReasonDialog(null);
    },
  };
})();
