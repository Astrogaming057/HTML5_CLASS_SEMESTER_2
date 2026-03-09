window.PreviewFileSearch = (function() {
  let fileList = [];
  let filteredFiles = [];
  let selectedIndex = 0;
  let dialog = null;
  let input = null;
  let resultsList = null;

  async function getAllFiles() {
    try {
      const response = await fetch('/__api__/files/list-all');
      const data = await response.json();
      
      if (data.success && data.files) {
        return data.files.map(file => ({
          name: file.name,
          path: file.path,
          displayPath: file.path
        }));
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
    return [];
  }

  function createDialog() {
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.className = 'file-search-dialog';
    dialog.innerHTML = `
      <div class="file-search-content">
        <div class="file-search-header">
          <span class="file-search-title">Quick Open (Ctrl+P)</span>
          <button class="file-search-close" id="fileSearchClose">✕</button>
        </div>
        <div class="file-search-input-container">
          <input type="text" id="fileSearchInput" class="file-search-input" placeholder="Type to search files..." autocomplete="off">
        </div>
        <div class="file-search-results" id="fileSearchResults">
          <div class="file-search-loading">Loading files...</div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    input = dialog.querySelector('#fileSearchInput');
    resultsList = dialog.querySelector('#fileSearchResults');
    const closeBtn = dialog.querySelector('#fileSearchClose');

    closeBtn.addEventListener('click', () => close());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    return dialog;
  }

  function filterFiles(query) {
    if (!query.trim()) {
      filteredFiles = fileList.slice(0, 50); // Limit to 50 for performance
      return;
    }

    const lowerQuery = query.toLowerCase();
    filteredFiles = fileList
      .filter(file => {
        const nameMatch = file.name.toLowerCase().includes(lowerQuery);
        const pathMatch = file.path.toLowerCase().includes(lowerQuery);
        return nameMatch || pathMatch;
      })
      .sort((a, b) => {
        // Prioritize name matches over path matches
        const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
        const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }

  function renderResults() {
    if (!resultsList) return;

    if (filteredFiles.length === 0) {
      resultsList.innerHTML = '<div class="file-search-no-results">No files found</div>';
      return;
    }

    resultsList.innerHTML = '';
    filteredFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = `file-search-item ${index === selectedIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <span class="file-search-item-name">${escapeHtml(file.name)}</span>
        <span class="file-search-item-path">${escapeHtml(file.path)}</span>
      `;
      item.addEventListener('click', () => selectFile(file));
      resultsList.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function selectFile(file) {
    if (window.__previewSwitchToFile && typeof window.__previewSwitchToFile === 'function') {
      window.__previewSwitchToFile(file.path);
    }
    close();
  }

  function updateSelection() {
    const items = resultsList.querySelectorAll('.file-search-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
    });
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function close() {
    if (dialog) {
      dialog.style.display = 'none';
      selectedIndex = 0;
      if (input) input.value = '';
    }
  }

  return {
    async open(switchToFile) {
      const dialogEl = createDialog();
      dialogEl.style.display = 'flex';
      
      // Store switchToFile function globally for access
      window.__previewSwitchToFile = switchToFile;

      // Always fetch fresh file list from server
      resultsList.innerHTML = '<div class="file-search-loading">Loading files...</div>';
      fileList = await getAllFiles();
      filterFiles('');
      renderResults();

      // Focus input
      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);

      // Setup input handler
      if (input) {
        input.onkeydown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < filteredFiles.length - 1) {
              selectedIndex++;
              updateSelection();
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
              selectedIndex--;
              updateSelection();
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredFiles[selectedIndex]) {
              selectFile(filteredFiles[selectedIndex]);
            }
          } else {
            // Let the input update, then filter
            setTimeout(() => {
              filterFiles(input.value);
              selectedIndex = 0;
              renderResults();
            }, 0);
          }
        };

        input.oninput = () => {
          filterFiles(input.value);
          selectedIndex = 0;
          renderResults();
        };
      }
    },

    close
  };
})();
