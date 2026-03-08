window.PreviewGlobalSearch = (function() {
  let dialog = null;
  let searchInput = null;
  let resultsContainer = null;
  let isSearching = false;
  let currentSearchTimeout = null;

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
    if (!query.trim()) {
      resultsContainer.innerHTML = '<div class="global-search-placeholder">Enter a search term to find matches across all files</div>';
      return;
    }

    isSearching = true;
    resultsContainer.innerHTML = '<div class="global-search-loading">Searching...</div>';

    try {
      const response = await fetch('/__api__/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          caseSensitive: caseSensitive,
          wholeWord: wholeWord
        })
      });
      
      const data = await response.json();
      
      isSearching = false;
      
      if (data.success && data.results) {
        renderResults(data.results, query);
      } else {
        resultsContainer.innerHTML = `<div class="global-search-error">Error: ${data.error || 'Search failed'}</div>`;
      }
    } catch (error) {
      isSearching = false;
      resultsContainer.innerHTML = `<div class="global-search-error">Error: ${error.message}</div>`;
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

  function renderResults(results, query) {
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="global-search-no-results">No matches found</div>';
      return;
    }

    resultsContainer.innerHTML = '';
    const caseSensitive = document.getElementById('globalSearchCaseSensitive')?.checked || false;

    results.forEach((result) => {
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
              <span class="global-search-line-text">${highlightMatch(escapeHtml(match.text), query, caseSensitive)}</span>
            </div>
          `).join('')}
          ${result.matches.length > 10 ? `<div class="global-search-more">... and ${result.matches.length - 10} more matches</div>` : ''}
        </div>
      `;

      // Add click handlers
      fileItem.querySelector('.global-search-file-header').addEventListener('click', () => {
        openFile(result.filePath);
      });

      fileItem.querySelectorAll('.global-search-match').forEach(matchEl => {
        matchEl.addEventListener('click', () => {
          const filePath = matchEl.dataset.file;
          const line = parseInt(matchEl.dataset.line);
          openFile(filePath, line);
        });
      });

      resultsContainer.appendChild(fileItem);
    });
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
