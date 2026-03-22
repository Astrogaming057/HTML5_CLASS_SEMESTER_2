/**
 * Workspace replace across files (Preview) — mirrors Find in Files batching.
 */
window.PreviewReplaceInFiles = (function () {
  let dialog = null;
  let findInput = null;
  let replaceInput = null;
  let resultsContainer = null;
  let replaceAbortController = null;

  const BATCH_SIZE = 250;
  const CONCURRENCY = 3;

  let lastPreviewFiles = [];
  let lastTotalMatches = 0;

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }

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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createDialog() {
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'global-search-dialog replace-in-files-dialog';
    dialog.innerHTML = `
      <div class="global-search-content">
        <div class="global-search-header">
          <span class="global-search-title">Replace in Files (Ctrl+Shift+H)</span>
          <button type="button" class="global-search-close" id="replaceInFilesClose" aria-label="Close">✕</button>
        </div>
        <div class="global-search-input-container">
          <input type="text" id="replaceInFilesFind" class="global-search-input" placeholder="Find" autocomplete="off">
        </div>
        <div class="global-search-input-container">
          <input type="text" id="replaceInFilesReplaceWith" class="global-search-input" placeholder="Replace with" autocomplete="off">
        </div>
        <div class="global-search-options">
          <label class="global-search-option">
            <input type="checkbox" id="replaceInFilesCaseSensitive" class="global-search-checkbox">
            <span>Case sensitive</span>
          </label>
          <label class="global-search-option">
            <input type="checkbox" id="replaceInFilesWholeWord" class="global-search-checkbox">
            <span>Whole word</span>
          </label>
        </div>
        <div class="replace-in-files-actions">
          <button type="button" class="btn btn-secondary" id="replaceInFilesPreviewBtn">Preview</button>
          <button type="button" class="btn btn-primary" id="replaceInFilesApplyBtn">Replace all</button>
        </div>
        <div class="global-search-meta" id="replaceInFilesMeta" aria-live="polite"></div>
        <div class="global-search-results" id="replaceInFilesResults">
          <div class="global-search-placeholder">Enter a search term, then Preview or Replace all</div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    findInput = dialog.querySelector('#replaceInFilesFind');
    replaceInput = dialog.querySelector('#replaceInFilesReplaceWith');
    resultsContainer = dialog.querySelector('#replaceInFilesResults');

    dialog.querySelector('#replaceInFilesClose').addEventListener('click', function () {
      close();
    });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });

    return dialog;
  }

  async function runBatchedReplace(query, replacement, caseSensitive, wholeWord, dryRun, signal) {
    const listRes = await fetch('/__api__/files/list-all', { signal, cache: 'no-store' });
    const listData = await listRes.json().catch(function () {
      return null;
    });

    if (signal.aborted) {
      return { files: [], totalMatches: 0, error: 'aborted' };
    }
    if (!listData || !listData.success || !Array.isArray(listData.files)) {
      return {
        files: [],
        totalMatches: 0,
        error: (listData && listData.error) || 'Could not list files'
      };
    }

    const paths = listData.files.map(function (f) {
      return f.path;
    });
    const chunks = chunkArray(paths, BATCH_SIZE);
    const merged = [];
    let totalMatches = 0;

    async function oneBatch(chunk) {
      const response = await fetch('/__api__/search/replace-in-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          replacement: replacement,
          caseSensitive: caseSensitive,
          wholeWord: wholeWord,
          dryRun: dryRun,
          paths: chunk
        }),
        signal: signal
      });
      const data = await response.json().catch(function () {
        return null;
      });
      if (!data || !data.success) {
        throw new Error((data && data.error) || 'Replace request failed');
      }
      if (data.files && data.files.length) {
        for (let i = 0; i < data.files.length; i++) {
          merged.push(data.files[i]);
        }
      }
      if (typeof data.totalMatches === 'number') {
        totalMatches += data.totalMatches;
      }
    }

    await runChunksWithConcurrency(chunks, CONCURRENCY, oneBatch, signal);

    merged.sort(function (a, b) {
      return String(a.filePath).localeCompare(String(b.filePath));
    });

    return { files: merged, totalMatches: totalMatches, error: null };
  }

  function renderFileList(files) {
    resultsContainer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'global-search-virtual-root global-search-virtual-root--flat';

    for (let i = 0; i < files.length; i++) {
      const row = document.createElement('div');
      row.className = 'global-search-file-item replace-in-files-preview-row';
      const fp = files[i].filePath;
      const n = files[i].matches;
      row.innerHTML =
        '<div class="global-search-file-header" data-file="' +
        escapeHtml(fp) +
        '">' +
        '<span class="global-search-file-name">' +
        escapeHtml(fp.split('/').pop()) +
        '</span>' +
        '<span class="global-search-file-path">' +
        escapeHtml(fp) +
        '</span>' +
        '<span class="global-search-file-count">' +
        n +
        ' match' +
        (n !== 1 ? 'es' : '') +
        '</span>' +
        '</div>';
      row.querySelector('.global-search-file-header').addEventListener('click', function () {
        if (typeof window.__previewSwitchToFile === 'function') {
          window.__previewSwitchToFile(fp);
        }
        close();
      });
      wrap.appendChild(row);
    }
    resultsContainer.appendChild(wrap);
  }

  function close() {
    if (replaceAbortController) {
      replaceAbortController.abort();
      replaceAbortController = null;
    }
    const meta = document.getElementById('replaceInFilesMeta');
    if (meta) {
      meta.textContent = '';
    }
    lastPreviewFiles = [];
    lastTotalMatches = 0;
    if (dialog) {
      dialog.style.display = 'none';
      if (findInput) findInput.value = '';
      if (replaceInput) replaceInput.value = '';
    }
  }

  return {
    /**
     * @param {function(string): void} switchToFile
     * @param {*} _editor unused (parity with global search)
     * @param {function(string[]): void} [afterApply] paths modified on disk
     */
    open(switchToFile, _editor, afterApply) {
      const dialogEl = createDialog();
      dialogEl.style.display = 'flex';

      window.__previewSwitchToFile = switchToFile;

      const metaEl = document.getElementById('replaceInFilesMeta');
      const previewBtn = document.getElementById('replaceInFilesPreviewBtn');
      const applyBtn = document.getElementById('replaceInFilesApplyBtn');

      lastPreviewFiles = [];
      lastTotalMatches = 0;
      if (resultsContainer) {
        resultsContainer.innerHTML =
          '<div class="global-search-placeholder">Enter a search term, then Preview or Replace all</div>';
      }
      if (metaEl) metaEl.textContent = '';

      setTimeout(function () {
        if (findInput) findInput.focus();
      }, 100);

      function getOptions() {
        return {
          query: (findInput && findInput.value) || '',
          replacement: (replaceInput && replaceInput.value) || '',
          caseSensitive: document.getElementById('replaceInFilesCaseSensitive')?.checked || false,
          wholeWord: document.getElementById('replaceInFilesWholeWord')?.checked || false
        };
      }

      async function doPreview() {
        const o = getOptions();
        if (!o.query.trim()) {
          if (metaEl) metaEl.textContent = '';
          if (resultsContainer) {
            resultsContainer.innerHTML =
              '<div class="global-search-error">Enter text to find</div>';
          }
          lastPreviewFiles = [];
          lastTotalMatches = 0;
          return;
        }

        if (replaceAbortController) {
          replaceAbortController.abort();
        }
        const controller = new AbortController();
        replaceAbortController = controller;
        const signal = controller.signal;

        if (metaEl) metaEl.textContent = '';
        if (resultsContainer) {
          resultsContainer.innerHTML = '<div class="global-search-loading">Preview…</div>';
        }

        try {
          const result = await runBatchedReplace(
            o.query,
            o.replacement,
            o.caseSensitive,
            o.wholeWord,
            true,
            signal
          );
          if (signal.aborted) return;
          if (result.error && result.error !== 'aborted') {
            if (resultsContainer) {
              resultsContainer.innerHTML =
                '<div class="global-search-error">Error: ' + escapeHtml(result.error) + '</div>';
            }
            return;
          }

          lastPreviewFiles = result.files || [];
          lastTotalMatches = result.totalMatches || 0;

          if (lastPreviewFiles.length === 0) {
            if (metaEl) metaEl.textContent = 'No matches';
            if (resultsContainer) {
              resultsContainer.innerHTML = '<div class="global-search-no-results">No matches found</div>';
            }
            return;
          }

          if (metaEl) {
            metaEl.textContent =
              lastPreviewFiles.length +
              ' file' +
              (lastPreviewFiles.length !== 1 ? 's' : '') +
              ' · ' +
              lastTotalMatches +
              ' match' +
              (lastTotalMatches !== 1 ? 'es' : '');
          }
          renderFileList(lastPreviewFiles);
        } catch (err) {
          if (err && err.name === 'AbortError') {
            return;
          }
          const msg = err && err.message ? err.message : 'Preview failed';
          if (!signal.aborted && resultsContainer) {
            resultsContainer.innerHTML =
              '<div class="global-search-error">Error: ' + escapeHtml(msg) + '</div>';
          }
        } finally {
          if (replaceAbortController === controller) {
            replaceAbortController = null;
          }
        }
      }

      function invalidatePreview() {
        lastPreviewFiles = [];
        lastTotalMatches = 0;
      }

      if (findInput) {
        findInput.oninput = invalidatePreview;
      }
      if (replaceInput) {
        replaceInput.oninput = invalidatePreview;
      }
      const caseEl = document.getElementById('replaceInFilesCaseSensitive');
      const wholeEl = document.getElementById('replaceInFilesWholeWord');
      if (caseEl) {
        caseEl.onchange = invalidatePreview;
      }
      if (wholeEl) {
        wholeEl.onchange = invalidatePreview;
      }

      async function doApply() {
        const o = getOptions();
        if (!o.query.trim()) {
          if (resultsContainer) {
            resultsContainer.innerHTML =
              '<div class="global-search-error">Enter text to find</div>';
          }
          return;
        }

        if (lastPreviewFiles.length === 0) {
          await doPreview();
        }
        if (lastPreviewFiles.length === 0) {
          return;
        }

        const confirmFn = window.__previewCustomConfirm;
        const msg =
          'Replace ' +
          lastTotalMatches +
          ' occurrence' +
          (lastTotalMatches !== 1 ? 's' : '') +
          ' in ' +
          lastPreviewFiles.length +
          ' file' +
          (lastPreviewFiles.length !== 1 ? 's' : '') +
          '?';
        let ok = false;
        if (typeof confirmFn === 'function') {
          const r = await confirmFn(msg, true);
          ok = r === true;
        } else {
          ok = window.confirm(msg);
        }
        if (!ok) {
          return;
        }

        if (replaceAbortController) {
          replaceAbortController.abort();
        }
        const controller = new AbortController();
        replaceAbortController = controller;
        const signal = controller.signal;

        if (metaEl) metaEl.textContent = '';
        if (resultsContainer) {
          resultsContainer.innerHTML = '<div class="global-search-loading">Replacing…</div>';
        }

        try {
          const oApply = getOptions();
          const result = await runBatchedReplace(
            oApply.query,
            oApply.replacement,
            oApply.caseSensitive,
            oApply.wholeWord,
            false,
            signal
          );
          if (signal.aborted) return;
          if (result.error && result.error !== 'aborted') {
            if (resultsContainer) {
              resultsContainer.innerHTML =
                '<div class="global-search-error">Error: ' + escapeHtml(result.error) + '</div>';
            }
            return;
          }

          const modifiedPaths = (result.files || []).map(function (f) {
            return f.filePath;
          });
          if (metaEl) {
            metaEl.textContent =
              'Replaced in ' +
              modifiedPaths.length +
              ' file' +
              (modifiedPaths.length !== 1 ? 's' : '');
          }
          if (resultsContainer) {
            resultsContainer.innerHTML =
              '<div class="global-search-placeholder">Done. You can close this dialog or run another replace.</div>';
          }
          lastPreviewFiles = [];
          lastTotalMatches = 0;

          if (typeof afterApply === 'function') {
            afterApply(modifiedPaths);
          }
        } catch (err) {
          if (err && err.name === 'AbortError') {
            return;
          }
          const msg = err && err.message ? err.message : 'Replace failed';
          if (!signal.aborted && resultsContainer) {
            resultsContainer.innerHTML =
              '<div class="global-search-error">Error: ' + escapeHtml(msg) + '</div>';
          }
        } finally {
          if (replaceAbortController === controller) {
            replaceAbortController = null;
          }
        }
      }

      if (findInput) {
        findInput.onkeydown = function (e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        };
      }
      if (replaceInput) {
        replaceInput.onkeydown = function (e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        };
      }

      if (previewBtn) {
        previewBtn.onclick = function () {
          doPreview();
        };
      }
      if (applyBtn) {
        applyBtn.onclick = function () {
          doApply();
        };
      }
    },

    close: close
  };
})();
