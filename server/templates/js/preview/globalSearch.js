window.PreviewGlobalSearch = (function() {
  let dialog = null;
  let searchInput = null;
  let resultsContainer = null;
  let isSearching = false;
  let currentSearchTimeout = null;
  let searchAbortController = null;
  let virtualScrollCleanup = null;

  const SEARCH_BATCH_SIZE = 250;
  const SEARCH_CONCURRENCY = 3;
  /** Minimum extra pixels above/below viewport; also scaled by viewport height. */
  const VIRTUAL_OVERSCAN_BASE = 900;
  /** Extra file rows rendered outside the computed range (guards bad estimates). */
  const VIRTUAL_INDEX_BUFFER = 10;
  const ESTIMATE_MAX_ITEM_PX = 420;
  /** Below this many files, render all rows (real heights) — avoids virtual slab errors. */
  const MAX_FILES_FOR_FLAT_RENDER = 200;

  /**
   * Height guess for virtual scroll math only. Previews are capped server-side (~480 chars);
   * keep totals modest so padding + rows does not exceed real content by huge margins.
   */
  function estimateFileItemHeight(result) {
    const pathLines = Math.min(3, Math.max(1, Math.ceil(String(result.filePath || '').length / 80)));
    let h = 40 + pathLines * 22;

    const shown = Math.min(10, result.matches.length);
    const MAX_PREVIEW = 520;
    for (let m = 0; m < shown; m++) {
      const t = String((result.matches[m] && result.matches[m].text) || '');
      const len = Math.min(t.length, MAX_PREVIEW);
      const wrapLines = Math.min(8, Math.max(1, Math.ceil(len / 76)));
      h += 18 + wrapLines * 24;
    }
    if (result.matches.length > 10) {
      h += 28;
    }
    h += 8;
    return Math.min(ESTIMATE_MAX_ITEM_PX, Math.max(72, Math.round(h)));
  }

  function overscanForViewport(clientH) {
    return Math.max(VIRTUAL_OVERSCAN_BASE, Math.floor(clientH * 0.85));
  }

  function buildCumulativeHeights(results) {
    const cumulative = new Array(results.length + 1);
    cumulative[0] = 0;
    for (let i = 0; i < results.length; i++) {
      cumulative[i + 1] = cumulative[i] + estimateFileItemHeight(results[i]);
    }
    return cumulative;
  }

  /** First file index whose block may intersect the viewport (with overscan above). */
  function startIndexForScroll(cumulative, scrollTop, overscan) {
    const y = Math.max(0, scrollTop - overscan);
    let lo = 0;
    let hi = cumulative.length - 2;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (cumulative[mid + 1] <= y) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /** Last file index whose block may intersect the viewport (with overscan below). */
  function endIndexForScroll(cumulative, scrollBottom, overscan) {
    const y = scrollBottom + overscan;
    let lo = 0;
    let hi = cumulative.length - 2;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (cumulative[mid] < y) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }

  /**
   * Run async work over chunks with at most `concurrency` in flight (shared index queue).
   */
  async function runChunksWithConcurrency(chunks, concurrency, fn, signal) {
    if (chunks.length === 0) {
      return;
    }
    let next = 0;
    async function worker() {
      while (!signal.aborted) {
        const i = next++;
        if (i >= chunks.length) {
          break;
        }
        await fn(chunks[i], i);
      }
    }
    const n = Math.min(concurrency, chunks.length);
    await Promise.all(Array.from({ length: n }, () => worker()));
  }

  function createDialog() {
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'global-search-dialog';
    dialog.innerHTML = `
      <div class="global-search-content">
        <div class="global-search-header">
          <span class="global-search-title">Search (Ctrl+Shift+F)</span>
          <button class="global-search-close" id="globalSearchClose">✕</button>
        </div>
        <div class="global-search-input-container">
          <input type="text" id="globalSearchInput" class="global-search-input" placeholder="Search across all files..." autocomplete="off">
        </div>
        <div class="global-search-options">
          <label class="global-search-option">
            <input type="checkbox" id="globalSearchCaseSensitive" class="global-search-checkbox">
            <span>Case sensitive</span>
          </label>
          <label class="global-search-option">
            <input type="checkbox" id="globalSearchWholeWord" class="global-search-checkbox">
            <span>Whole word</span>
          </label>
        </div>
        <div class="global-search-meta" id="globalSearchMeta" aria-live="polite"></div>
        <div class="global-search-results" id="globalSearchResults">
          <div class="global-search-placeholder">Enter a search term to find matches across all files</div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    searchInput = dialog.querySelector('#globalSearchInput');
    resultsContainer = dialog.querySelector('#globalSearchResults');
    const closeBtn = dialog.querySelector('#globalSearchClose');

    closeBtn.addEventListener('click', () => close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    return dialog;
  }

  async function performSearch(query, caseSensitive, wholeWord) {
    if (virtualScrollCleanup) {
      virtualScrollCleanup();
      virtualScrollCleanup = null;
    }

    if (!query.trim()) {
      const meta = document.getElementById('globalSearchMeta');
      if (meta) {
        meta.textContent = '';
      }
      resultsContainer.innerHTML = '<div class="global-search-placeholder">Enter a search term to find matches across all files</div>';
      return;
    }

    if (searchAbortController) {
      searchAbortController.abort();
    }
    const controller = new AbortController();
    searchAbortController = controller;
    const signal = controller.signal;

    isSearching = true;
    const q = query.trim();
    const metaEl = document.getElementById('globalSearchMeta');
    if (metaEl) {
      metaEl.textContent = '';
    }
    resultsContainer.innerHTML =
      '<div class="global-search-loading">Searching… (listing files)</div>';

    try {
      const listRes = await fetch('/__api__/files/list-all', { signal, cache: 'no-store' });
      const listData = await listRes.json().catch(() => null);

      if (signal.aborted) {
        return;
      }
      if (!listData || !listData.success || !Array.isArray(listData.files)) {
        resultsContainer.innerHTML = `<div class="global-search-error">Error: ${(listData && listData.error) || 'Could not list files'}</div>`;
        return;
      }

      const paths = listData.files.map(function (f) {
        return f.path;
      });
      const chunks = chunkArray(paths, SEARCH_BATCH_SIZE);
      const totalBatches = chunks.length;

      if (totalBatches === 0) {
        resultsContainer.innerHTML = '<div class="global-search-no-results">No files to search</div>';
        return;
      }

      let completedBatches = 0;
      const merged = [];

      async function searchBatch(chunk) {
        const response = await fetch('/__api__/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            caseSensitive: caseSensitive,
            wholeWord: wholeWord,
            paths: chunk
          }),
          signal
        });
        const data = await response.json().catch(() => null);
        if (!data || !data.success) {
          throw new Error((data && data.error) || 'Search failed');
        }
        if (data.results && data.results.length) {
          for (let i = 0; i < data.results.length; i++) {
            merged.push(data.results[i]);
          }
        }
        completedBatches++;
        if (!signal.aborted && resultsContainer) {
          resultsContainer.innerHTML =
            '<div class="global-search-loading">Searching… (' +
            completedBatches +
            '/' +
            totalBatches +
            ' batches)</div>';
        }
      }

      await runChunksWithConcurrency(chunks, SEARCH_CONCURRENCY, searchBatch, signal);

      if (signal.aborted) {
        return;
      }

      merged.sort(function (a, b) {
        return String(a.filePath).localeCompare(String(b.filePath));
      });
      renderResults(merged, query);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return;
      }
      const msg = error && error.message ? error.message : 'Search failed';
      if (!signal.aborted && resultsContainer) {
        resultsContainer.innerHTML = `<div class="global-search-error">Error: ${msg}</div>`;
      }
    } finally {
      isSearching = false;
      if (searchAbortController === controller) {
        searchAbortController = null;
      }
    }
  }

  function highlightMatch(text, query, caseSensitive) {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(query), flags);
    return text.replace(regex, (match) => `<mark>${escapeHtml(match)}</mark>`);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** Safety cap if API ever returns a huge line (minified bundles). */
  const MAX_MATCH_DISPLAY_CHARS = 520;

  function trimMatchPreviewForDisplay(text) {
    if (!text || text.length <= MAX_MATCH_DISPLAY_CHARS) {
      return text;
    }
    return text.slice(0, MAX_MATCH_DISPLAY_CHARS) + '…';
  }

  function createFileItemElement(result, query, caseSensitive) {
    const fileItem = document.createElement('div');
    fileItem.className = 'global-search-file-item';

    const fileName = result.filePath.split('/').pop();
    const filePath = result.filePath;

    fileItem.innerHTML = `
        <div class="global-search-file-header" data-file="${escapeHtml(filePath)}">
          <span class="global-search-file-name">${escapeHtml(fileName)}</span>
          <span class="global-search-file-path">${escapeHtml(filePath)}</span>
          <span class="global-search-file-count">${result.matches.length} match${result.matches.length !== 1 ? 'es' : ''}</span>
        </div>
        <div class="global-search-matches">
          ${result.matches.slice(0, 10).map(match => `
            <div class="global-search-match" data-line="${match.line}" data-file="${escapeHtml(filePath)}">
              <span class="global-search-line-number">${match.line}</span>
              <span class="global-search-line-text">${highlightMatch(escapeHtml(trimMatchPreviewForDisplay(match.text)), query, caseSensitive)}</span>
            </div>
          `).join('')}
          ${result.matches.length > 10 ? `<div class="global-search-more">... and ${result.matches.length - 10} more matches</div>` : ''}
        </div>
      `;

    fileItem.querySelector('.global-search-file-header').addEventListener('click', () => {
      openFile(result.filePath);
    });

    fileItem.querySelectorAll('.global-search-match').forEach(matchEl => {
      matchEl.addEventListener('click', () => {
        const fp = matchEl.dataset.file;
        const line = parseInt(matchEl.dataset.line, 10);
        openFile(fp, line);
      });
    });

    return fileItem;
  }

  function renderResultsFlat(results, query, caseSensitive) {
    resultsContainer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'global-search-virtual-root global-search-virtual-root--flat';
    for (let i = 0; i < results.length; i++) {
      wrap.appendChild(createFileItemElement(results[i], query, caseSensitive));
    }
    resultsContainer.appendChild(wrap);
  }

  function renderResults(results, query) {
    if (virtualScrollCleanup) {
      virtualScrollCleanup();
      virtualScrollCleanup = null;
    }

    const meta = document.getElementById('globalSearchMeta');

    if (results.length === 0) {
      if (meta) {
        meta.textContent = '';
      }
      resultsContainer.innerHTML = '<div class="global-search-no-results">No matches found</div>';
      return;
    }

    const caseSensitive = document.getElementById('globalSearchCaseSensitive')?.checked || false;

    if (results.length <= MAX_FILES_FOR_FLAT_RENDER) {
      let totalMatches = 0;
      for (let i = 0; i < results.length; i++) {
        totalMatches += results[i].matches.length;
      }
      if (meta) {
        meta.textContent =
          results.length +
          ' file' +
          (results.length !== 1 ? 's' : '') +
          ' · ' +
          totalMatches +
          ' match' +
          (totalMatches !== 1 ? 'es' : '');
      }
      renderResultsFlat(results, query, caseSensitive);
      resultsContainer.scrollTop = 0;
      return;
    }

    const cumulative = buildCumulativeHeights(results);
    const totalHeight = cumulative[cumulative.length - 1];
    let totalMatches = 0;
    for (let i = 0; i < results.length; i++) {
      totalMatches += results[i].matches.length;
    }

    if (meta) {
      meta.textContent =
        results.length +
        ' file' +
        (results.length !== 1 ? 's' : '') +
        ' · ' +
        totalMatches +
        ' match' +
        (totalMatches !== 1 ? 'es' : '');
    }

    resultsContainer.innerHTML = '';

    const virtualRoot = document.createElement('div');
    virtualRoot.className = 'global-search-virtual-root';
    virtualRoot.style.position = 'relative';
    virtualRoot.style.width = '100%';

    resultsContainer.appendChild(virtualRoot);

    let scrollRaf = null;
    let lastStart = -1;
    let lastEnd = -1;

    function renderVisibleSlice(force) {
      const scrollTop = resultsContainer.scrollTop;
      const clientH = resultsContainer.clientHeight || 1;
      const scrollBottom = scrollTop + clientH;
      const overscan = overscanForViewport(clientH);
      let start = startIndexForScroll(cumulative, scrollTop, overscan);
      let end = endIndexForScroll(cumulative, scrollBottom, overscan);
      if (start > end) {
        end = start;
      }
      if (start < 0) {
        start = 0;
      }
      if (end >= results.length) {
        end = results.length - 1;
      }

      start = Math.max(0, start - VIRTUAL_INDEX_BUFFER);
      end = Math.min(results.length - 1, end + VIRTUAL_INDEX_BUFFER);

      if (!force && start === lastStart && end === lastEnd && virtualRoot.firstChild) {
        return;
      }
      lastStart = start;
      lastEnd = end;

      virtualRoot.textContent = '';
      const flow = document.createElement('div');
      flow.className = 'global-search-virtual-flow';
      flow.style.boxSizing = 'border-box';
      flow.style.width = '100%';
      flow.style.paddingTop = cumulative[start] + 'px';
      flow.style.paddingBottom = Math.max(0, totalHeight - cumulative[end + 1]) + 'px';

      for (let i = start; i <= end; i++) {
        flow.appendChild(createFileItemElement(results[i], query, caseSensitive));
      }
      virtualRoot.appendChild(flow);
      virtualRoot.offsetHeight;
      const gap = totalHeight - flow.offsetHeight;
      if (gap > 0.5) {
        const spacer = document.createElement('div');
        spacer.className = 'global-search-virtual-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.height = gap + 'px';
        spacer.style.width = '100%';
        virtualRoot.appendChild(spacer);
      }
    }

    const onScroll = function () {
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
      }
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        renderVisibleSlice(false);
      });
    };

    resultsContainer.addEventListener('scroll', onScroll, { passive: true });

    const onResize = function () {
      lastStart = -1;
      lastEnd = -1;
      requestAnimationFrame(function () {
        renderVisibleSlice(true);
      });
    };
    window.addEventListener('resize', onResize);

    virtualScrollCleanup = function () {
      resultsContainer.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = null;
      }
    };

    resultsContainer.scrollTop = 0;
    lastStart = -1;
    lastEnd = -1;
    renderVisibleSlice(true);
  }

  function openFile(filePath, line = null) {
    if (window.__previewSwitchToFile && typeof window.__previewSwitchToFile === 'function') {
      window.__previewSwitchToFile(filePath);
      if (line && window.__previewEditor) {
        setTimeout(() => {
          const editor = window.__previewEditor;
          if (editor && editor.setPosition) {
            editor.setPosition({ lineNumber: line, column: 1 });
            editor.revealLineInCenter(line);
          }
        }, 300);
      }
    }
    close();
  }

  function close() {
    if (virtualScrollCleanup) {
      virtualScrollCleanup();
      virtualScrollCleanup = null;
    }
    const meta = document.getElementById('globalSearchMeta');
    if (meta) {
      meta.textContent = '';
    }
    if (searchAbortController) {
      searchAbortController.abort();
      searchAbortController = null;
    }
    if (dialog) {
      dialog.style.display = 'none';
      if (searchInput) searchInput.value = '';
      if (currentSearchTimeout) {
        clearTimeout(currentSearchTimeout);
        currentSearchTimeout = null;
      }
    }
  }

  return {
    open(switchToFile, editor) {
      const dialogEl = createDialog();
      dialogEl.style.display = 'flex';
      
      window.__previewSwitchToFile = switchToFile;
      window.__previewEditor = editor;

      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);

      if (searchInput) {
        searchInput.onkeydown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        };

        searchInput.oninput = () => {
          if (currentSearchTimeout) {
            clearTimeout(currentSearchTimeout);
          }

          const query = searchInput.value;
          const caseSensitive = document.getElementById('globalSearchCaseSensitive')?.checked || false;
          const wholeWord = document.getElementById('globalSearchWholeWord')?.checked || false;

          currentSearchTimeout = setTimeout(() => {
            performSearch(query, caseSensitive, wholeWord);
          }, 300);
        };
      }

      // Setup option change handlers
      const caseSensitiveCheck = document.getElementById('globalSearchCaseSensitive');
      const wholeWordCheck = document.getElementById('globalSearchWholeWord');

      if (caseSensitiveCheck) {
        caseSensitiveCheck.onchange = () => {
          if (searchInput && searchInput.value.trim()) {
            const query = searchInput.value;
            const caseSensitive = caseSensitiveCheck.checked;
            const wholeWord = wholeWordCheck?.checked || false;
            performSearch(query, caseSensitive, wholeWord);
          }
        };
      }

      if (wholeWordCheck) {
        wholeWordCheck.onchange = () => {
          if (searchInput && searchInput.value.trim()) {
            const query = searchInput.value;
            const caseSensitive = caseSensitiveCheck?.checked || false;
            const wholeWord = wholeWordCheck.checked;
            performSearch(query, caseSensitive, wholeWord);
          }
        };
      }
    },

    close
  };
})();
