/**
 * Local file save timeline (per-file patches under ide_editor_cache/.file_timeline).
 */
window.PreviewFileTimeline = (function () {
  const LS_TIMELINE_H = 'astroExplorerTimelineHeightPx';
  const LS_TIMELINE_COLLAPSED = 'astroExplorerTimelineCollapsed';
  const LS_TIMELINE_ANCHOR = 'astroExplorerTimelineAnchorPath';
  const TIMELINE_H_MIN = 80;
  const TIMELINE_H_MAX = 900;

  let listEl = null;
  let refreshBtn = null;
  let currentPathForList = '';
  /** Last workspace file path we showed saves for (persisted; used when active tab is virtual). */
  let anchorWorkspacePath = '';
  let timelinePanel = null;
  let timelineSplitter = null;
  let explorerStackEl = null;
  let timelineResizeActive = false;

  function isVirtualPath(p) {
    return (
      !p ||
      p.startsWith('browser://') ||
      p.startsWith('gitdiff://') ||
      p.startsWith('githistory://') ||
      p.startsWith('filetimeline://')
    );
  }

  function normalizeFsPath(p) {
    return String(p || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
  }

  function readAnchorFromStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(LS_TIMELINE_ANCHOR) || '' : '';
    } catch (_e) {
      return '';
    }
  }

  function persistAnchor(p) {
    const n = normalizeFsPath(p);
    if (!n) return;
    anchorWorkspacePath = n;
    try {
      localStorage.setItem(LS_TIMELINE_ANCHOR, n);
    } catch (_e) {
      /* ignore */
    }
  }

  /**
   * Map active tab path to a real workspace file path when possible (editor tabs, save-diff, git history, single-file commit diff).
   */
  function workspacePathFromActiveTab(activePath) {
    const p = String(activePath || '').trim();
    if (!p) return '';
    if (!isVirtualPath(p)) {
      return normalizeFsPath(p);
    }
    if (p.startsWith('filetimeline://')) {
      const spec =
        window.PreviewFileTimelineDiffViewer &&
        typeof window.PreviewFileTimelineDiffViewer.parseTabPath === 'function'
          ? window.PreviewFileTimelineDiffViewer.parseTabPath(p)
          : null;
      return spec && spec.path ? normalizeFsPath(spec.path) : '';
    }
    if (p.startsWith('githistory://')) {
      const pref = window.PreviewFileHistoryViewer && window.PreviewFileHistoryViewer.PREFIX;
      if (pref && p.startsWith(pref)) {
        try {
          return normalizeFsPath(decodeURIComponent(p.slice(pref.length)));
        } catch (_e) {
          return '';
        }
      }
    }
    if (p.startsWith('gitdiff://')) {
      const parse =
        window.PreviewCommitDiffViewer && typeof window.PreviewCommitDiffViewer.parseGitDiffTab === 'function'
          ? window.PreviewCommitDiffViewer.parseGitDiffTab
          : null;
      if (typeof parse === 'function') {
        const spec = parse(p);
        if (spec && spec.mode === 'file' && spec.path) {
          return normalizeFsPath(spec.path);
        }
      }
    }
    return '';
  }

  function formatWhen(ts) {
    const t = typeof ts === 'number' ? ts : parseInt(ts, 10);
    if (!t) return '';
    const d = new Date(t);
    const now = Date.now();
    const sec = Math.round((now - t) / 1000);
    if (sec < 60) return 'now';
    if (sec < 3600) return Math.floor(sec / 60) + ' min';
    if (sec < 86400) return Math.floor(sec / 3600) + ' hr';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function setTimelinePanelHeightPx(panel, px) {
    if (!panel) return;
    const h = Math.min(TIMELINE_H_MAX, Math.max(TIMELINE_H_MIN, Math.round(px)));
    panel.style.flex = '0 0 ' + h + 'px';
    panel.style.height = h + 'px';
  }

  function readTimelineHeightPx() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_TIMELINE_H) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= TIMELINE_H_MIN && n <= TIMELINE_H_MAX) {
      return n;
    }
    return 180;
  }

  function applyTimelineLayoutFromStorage() {
    if (!timelinePanel) return;
    setTimelinePanelHeightPx(timelinePanel, readTimelineHeightPx());
    const collapsed =
      typeof localStorage !== 'undefined' && localStorage.getItem(LS_TIMELINE_COLLAPSED) === '1';
    if (collapsed) {
      timelinePanel.classList.add('is-collapsed');
      if (timelineSplitter) timelineSplitter.hidden = true;
      const btn = document.getElementById('explorerTimelineCollapseBtn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '\u25b6';
        btn.title = 'Expand timeline';
        btn.setAttribute('aria-label', 'Expand timeline');
      }
    } else if (timelineSplitter) {
      timelineSplitter.hidden = false;
    }
  }

  function setupTimelineResize() {
    const splitter = timelineSplitter;
    const panel = timelinePanel;
    const stackEl = explorerStackEl;
    if (!splitter || !panel || !stackEl) return;

    function onPointerDown(e) {
      if (panel.classList.contains('is-collapsed')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      timelineResizeActive = true;
      const startY = e.clientY;
      const startH = panel.getBoundingClientRect().height;
      splitter.setPointerCapture(e.pointerId);

      function onMove(ev) {
        if (!timelineResizeActive) return;
        const dy = ev.clientY - startY;
        let next = startH - dy;
        const stackH = stackEl.getBoundingClientRect().height;
        const maxT = Math.min(TIMELINE_H_MAX, Math.max(TIMELINE_H_MIN, stackH - 120));
        next = Math.min(Math.max(TIMELINE_H_MIN, next), maxT);
        setTimelinePanelHeightPx(panel, next);
      }

      function onUp(ev) {
        timelineResizeActive = false;
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
          localStorage.setItem(LS_TIMELINE_H, String(Math.round(h)));
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

  function setupCollapseToggle() {
    document.getElementById('explorerTimelineCollapseBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const p = timelinePanel;
      const spl = timelineSplitter;
      const btn = document.getElementById('explorerTimelineCollapseBtn');
      if (!p || !btn) return;
      const willCollapse = !p.classList.contains('is-collapsed');
      p.classList.toggle('is-collapsed', willCollapse);
      if (spl) spl.hidden = willCollapse;
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
      btn.textContent = willCollapse ? '\u25b6' : '\u25bc';
      btn.title = willCollapse ? 'Expand timeline' : 'Collapse timeline';
      btn.setAttribute('aria-label', willCollapse ? 'Expand timeline' : 'Collapse timeline');
      try {
        localStorage.setItem(LS_TIMELINE_COLLAPSED, willCollapse ? '1' : '0');
      } catch (_err) {
        /* ignore */
      }
      if (!willCollapse) {
        setTimelinePanelHeightPx(p, readTimelineHeightPx());
      }
    });
  }

  function clearList() {
    if (!listEl) return;
    listEl.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'explorer-timeline-empty';
    empty.textContent = 'Save the file to build history.';
    listEl.appendChild(empty);
  }

  async function refreshForPath(activeTabPath) {
    if (!listEl) return;

    if (!anchorWorkspacePath) {
      anchorWorkspacePath = readAnchorFromStorage();
    }

    const extracted = workspacePathFromActiveTab(activeTabPath);
    if (extracted) {
      persistAnchor(extracted);
    }

    const target = extracted || anchorWorkspacePath;
    if (!target) {
      currentPathForList = '';
      clearList();
      return;
    }

    currentPathForList = target;
    listEl.textContent = '';
    try {
      const r = await fetch('/__api__/files/timeline?path=' + encodeURIComponent(target));
      const d = await r.json();
      if (!d.success || !d.events || d.events.length === 0) {
        clearList();
        return;
      }
      for (let i = 0; i < d.events.length; i++) {
        const ev = d.events[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'explorer-timeline-item';
        btn.setAttribute('role', 'listitem');
        const inner = document.createElement('span');
        inner.className = 'explorer-timeline-item-inner';

        const title = document.createElement('span');
        title.className = 'explorer-timeline-item-title';
        const sum = (ev.summary || '').trim();
        title.textContent = sum || 'Saved version';

        const sub = document.createElement('span');
        sub.className = 'explorer-timeline-item-sub';
        const whenEl = document.createElement('span');
        whenEl.className = 'explorer-timeline-item-when';
        whenEl.textContent = formatWhen(ev.t);
        const hint = document.createElement('span');
        hint.className = 'explorer-timeline-item-hint';
        hint.textContent = 'Compare';
        sub.appendChild(whenEl);
        sub.appendChild(document.createTextNode(' \u00b7 '));
        sub.appendChild(hint);

        inner.appendChild(title);
        inner.appendChild(sub);
        btn.appendChild(inner);

        const idx = typeof ev.index === 'number' ? ev.index : 0;
        btn.addEventListener('click', function () {
          openSaveDiffTab(target, idx, ev.t);
        });
        listEl.appendChild(btn);
      }
    } catch (_e) {
      clearList();
    }
  }

  function openSaveDiffTab(filePath, index, savedAt) {
    if (
      window.PreviewFileTimelineDiffViewer &&
      typeof window.PreviewFileTimelineDiffViewer.openTimelineDiff === 'function'
    ) {
      window.PreviewFileTimelineDiffViewer.openTimelineDiff(filePath, index, savedAt);
    }
  }

  function init() {
    listEl = document.getElementById('explorerTimelineList');
    refreshBtn = document.getElementById('explorerTimelineRefresh');
    timelinePanel = document.getElementById('explorerTimelineWrap');
    timelineSplitter = document.getElementById('explorerTimelineSplitter');
    explorerStackEl = document.getElementById('explorerBody');

    applyTimelineLayoutFromStorage();
    setupTimelineResize();
    setupCollapseToggle();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        void refreshForPath(currentPathForList);
      });
    }
  }

  return {
    init: init,
    refreshForPath: refreshForPath,
  };
})();
