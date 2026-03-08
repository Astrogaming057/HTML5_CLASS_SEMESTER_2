window.PreviewGitPanel = (function() {
  let panel = null;
  let isVisible = false;

  async function getModifiedFiles() {
    try {
      // Get all files and check which ones have cached versions
      const response = await fetch('/__api__/files?path=/&list=true');
      const data = await response.json();
      
      if (!data.success || !data.files) return [];

      const modifiedFiles = [];
      
      async function checkFile(filePath) {
        try {
          const cacheResponse = await fetch(`/__api__/files/editor?path=${encodeURIComponent(filePath)}`);
          const cacheData = await cacheResponse.json();
          
          if (cacheData.success && cacheData.exists) {
            const fileResponse = await fetch(`/__api__/files?path=${encodeURIComponent(filePath)}`);
            const fileData = await fileResponse.json();
            
            if (fileData.success && cacheData.content !== fileData.content) {
              return { path: filePath, name: filePath.split('/').pop() };
            }
          }
        } catch (error) {
          console.error(`Error checking ${filePath}:`, error);
        }
        return null;
      }

      async function checkDirectory(dirPath) {
        try {
          const dirResponse = await fetch(`/__api__/files?path=${encodeURIComponent(dirPath)}&list=true`);
          const dirData = await dirResponse.json();
          
          if (dirData.success && dirData.files) {
            for (const file of dirData.files) {
              if (file.isDirectory) {
                if (file.name.toLowerCase() !== 'ide_editor_cache') {
                  await checkDirectory(file.path);
                }
              } else {
                const result = await checkFile(file.path);
                if (result) {
                  modifiedFiles.push(result);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error checking directory ${dirPath}:`, error);
        }
      }

      for (const file of data.files) {
        if (file.isDirectory) {
          if (file.name.toLowerCase() !== 'ide_editor_cache') {
            await checkDirectory(file.path);
          }
        } else {
          const result = await checkFile(file.path);
          if (result) {
            modifiedFiles.push(result);
          }
        }
      }

      return modifiedFiles;
    } catch (error) {
      console.error('Error getting modified files:', error);
      return [];
    }
  }

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'git-panel';
    panel.id = 'gitPanel';
    panel.innerHTML = `
      <div class="git-panel-header">
        <span class="git-panel-title">📦 Git</span>
        <button class="git-panel-close" id="gitPanelClose">✕</button>
      </div>
      <div class="git-panel-content">
        <div class="git-section">
          <div class="git-section-header">
            <span class="git-section-title">Modified Files</span>
            <button class="git-btn git-btn-small" id="gitRefreshBtn">🔄 Refresh</button>
          </div>
          <div class="git-files-list" id="gitModifiedFiles">
            <div class="git-loading">Loading...</div>
          </div>
        </div>
        <div class="git-section">
          <div class="git-section-header">
            <span class="git-section-title">Staged Files</span>
            <button class="git-btn git-btn-small" id="gitUnstageAllBtn">Unstage All</button>
          </div>
          <div class="git-files-list" id="gitStagedFiles">
            <div class="git-empty">No files staged</div>
          </div>
        </div>
        <div class="git-section">
          <div class="git-section-header">
            <span class="git-section-title">Commit</span>
          </div>
          <textarea id="gitCommitMessage" class="git-commit-input" placeholder="Enter commit message..." rows="3"></textarea>
          <div class="git-commit-actions">
            <button class="git-btn git-btn-primary" id="gitCommitBtn">Commit</button>
            <button class="git-btn git-btn-secondary" id="gitCancelBtn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    // Insert inside file explorer panel, after file tree
    const fileExplorerPanel = document.getElementById('fileExplorerPanel');
    const fileTree = document.getElementById('fileTree');
    if (fileExplorerPanel && fileTree) {
      // Insert after fileTree but before terminal panel if it exists
      const terminalPanel = document.getElementById('terminalPanel');
      if (terminalPanel && terminalPanel.parentNode === fileExplorerPanel) {
        fileExplorerPanel.insertBefore(panel, terminalPanel);
      } else {
        fileExplorerPanel.appendChild(panel);
      }
    } else if (fileExplorerPanel) {
      fileExplorerPanel.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    setupEventHandlers();
    return panel;
  }

  function setupEventHandlers() {
    const closeBtn = document.getElementById('gitPanelClose');
    const refreshBtn = document.getElementById('gitRefreshBtn');
    const unstageAllBtn = document.getElementById('gitUnstageAllBtn');
    const commitBtn = document.getElementById('gitCommitBtn');
    const cancelBtn = document.getElementById('gitCancelBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => toggle());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refresh());
    }

    if (unstageAllBtn) {
      unstageAllBtn.addEventListener('click', () => unstageAll());
    }

    if (commitBtn) {
      commitBtn.addEventListener('click', () => commit());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.getElementById('gitCommitMessage').value = '';
      });
    }
  }

  function renderModifiedFiles(files) {
    const container = document.getElementById('gitModifiedFiles');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '<div class="git-empty">No modified files</div>';
      return;
    }

    container.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'git-file-item';
      item.innerHTML = `
        <span class="git-file-name">${escapeHtml(file.name)}</span>
        <span class="git-file-path">${escapeHtml(file.path)}</span>
        <button class="git-btn git-btn-small" data-file="${escapeHtml(file.path)}" data-action="stage">Stage</button>
        <button class="git-btn git-btn-small" data-file="${escapeHtml(file.path)}" data-action="view">View</button>
      `;

      item.querySelector('[data-action="stage"]').addEventListener('click', () => stageFile(file.path));
      item.querySelector('[data-action="view"]').addEventListener('click', () => viewFile(file.path));

      container.appendChild(item);
    });
  }

  function renderStagedFiles(files) {
    const container = document.getElementById('gitStagedFiles');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = '<div class="git-empty">No files staged</div>';
      return;
    }

    container.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'git-file-item';
      item.innerHTML = `
        <span class="git-file-name">${escapeHtml(file.name)}</span>
        <span class="git-file-path">${escapeHtml(file.path)}</span>
        <button class="git-btn git-btn-small" data-file="${escapeHtml(file.path)}" data-action="unstage">Unstage</button>
      `;

      item.querySelector('[data-action="unstage"]').addEventListener('click', () => unstageFile(file.path));

      container.appendChild(item);
    });
  }

  let stagedFiles = [];

  function stageFile(filePath) {
    if (!stagedFiles.find(f => f.path === filePath)) {
      const fileName = filePath.split('/').pop();
      stagedFiles.push({ path: filePath, name: fileName });
      renderStagedFiles(stagedFiles);
      refresh(); // Refresh to update modified files list
    }
  }

  function unstageFile(filePath) {
    stagedFiles = stagedFiles.filter(f => f.path !== filePath);
    renderStagedFiles(stagedFiles);
    refresh(); // Refresh to update modified files list
  }

  function unstageAll() {
    stagedFiles = [];
    renderStagedFiles(stagedFiles);
    refresh();
  }

  function viewFile(filePath) {
    if (window.__previewSwitchToFile && typeof window.__previewSwitchToFile === 'function') {
      window.__previewSwitchToFile(filePath);
    }
  }

  async function commit() {
    const message = document.getElementById('gitCommitMessage')?.value.trim();
    if (!message) {
      alert('Please enter a commit message');
      return;
    }

    if (stagedFiles.length === 0) {
      alert('No files staged for commit');
      return;
    }

    // Save all staged files
    for (const file of stagedFiles) {
      try {
        const cacheResponse = await fetch(`/__api__/files/editor?path=${encodeURIComponent(file.path)}`);
        const cacheData = await cacheResponse.json();
        
        if (cacheData.success && cacheData.exists) {
          const saveResponse = await fetch('/__api__/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: file.path, content: cacheData.content })
          });
          
          if (saveResponse.ok) {
            // Delete from cache after saving
            await fetch('/__api__/files/editor', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: file.path })
            });
          }
        }
      } catch (error) {
        console.error(`Error committing ${file.path}:`, error);
      }
    }

    const committedCount = stagedFiles.length;
    
    // Clear staged files and commit message
    stagedFiles = [];
    renderStagedFiles(stagedFiles);
    document.getElementById('gitCommitMessage').value = '';
    
    // Refresh to show updated status
    refresh();
    
    alert(`Committed ${committedCount} file(s) with message: "${message}"`);
  }

  async function refresh() {
    const modifiedContainer = document.getElementById('gitModifiedFiles');
    if (modifiedContainer) {
      modifiedContainer.innerHTML = '<div class="git-loading">Loading...</div>';
    }

    const modifiedFiles = await getModifiedFiles();
    
    // Filter out staged files from modified files
    const unstagedFiles = modifiedFiles.filter(f => !stagedFiles.find(sf => sf.path === f.path));
    
    renderModifiedFiles(unstagedFiles);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    toggle() {
      const panelEl = createPanel();
      isVisible = !isVisible;
      
      if (isVisible) {
        panelEl.style.display = 'flex';
        refresh();
      } else {
        panelEl.style.display = 'none';
      }
    },

    show() {
      const panelEl = createPanel();
      isVisible = true;
      panelEl.style.display = 'flex';
      refresh();
    },

    hide() {
      if (panel) {
        isVisible = false;
        panel.style.display = 'none';
      }
    },

    refresh
  };
})();
