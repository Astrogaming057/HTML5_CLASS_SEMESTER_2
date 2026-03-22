window.PreviewFileExplorer = (function() {
  let isRendering = false;
  let renderTimeout = null;
  let renderFileTreeFn = null;
  /** Normalized folder paths (no leading slash, e.g. projects/foo) left expanded in tree mode */
  let treeExpandedPaths = new Set();
  
  const module = {
    setupFileExplorer(getCurrentDir, loadFileTree) {
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      loadFileTree(currentDir || '/');
    },

    loadFileTree(dir, fileTree, currentDirRef, updateBackButton, saveState, renderFileTree, fetchDirectoryListing, expandTargetPath) {
      // Clear any pending render
      if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
      }
      
      fileTree.innerHTML = '<div class="file-tree-loading">Loading...</div>';
      
      const treeOn = PreviewSettings.getSettings().explorerTreeView === true;
      let dirStr = typeof dir === 'function' ? dir() : (typeof dir === 'string' ? dir : String(dir || '/'));
      
      if (treeOn) {
        dirStr = '/';
        currentDirRef.currentDir = '/';
        module.applyTreeExpandHints(expandTargetPath);
      } else {
        treeExpandedPaths.clear();
        currentDirRef.currentDir = dirStr;
      }
      
      updateBackButton();
      saveState();
      
      const apiPath = dirStr === '/' ? '/' : dirStr;
      fetch('/__api__/files?path=' + encodeURIComponent(apiPath) + '&list=true')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.files) {
            try {
              renderFileTree(data.files, dirStr);
            } catch (error) {
              console.error('Error rendering file explorer:', error);
              fileTree.innerHTML = '<div class="file-tree-loading">Error rendering files</div>';
            }
          } else {
            fileTree.innerHTML = '<div class="file-tree-loading">Error loading files</div>';
          }
        })
        .catch(() => {
          fetchDirectoryListing(dirStr);
        });
    },

    applyTreeExpandHints(expandTargetPath) {
      const raw = expandTargetPath;
      if (!raw || typeof raw !== 'string') return;
      const norm = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!norm) return;
      const segs = norm.split('/').filter(Boolean);
      if (segs.length < 2) return;
      segs.pop();
      let acc = '';
      for (const seg of segs) {
        acc = acc ? acc + '/' + seg : seg;
        treeExpandedPaths.add(acc);
      }
    },

    prepareFileList(files) {
      files = files.filter(file => !(file.name.toLowerCase() === 'ide_editor_cache' && file.isDirectory));
      const fileMap = new Map();
      files.forEach(file => {
        const normalizedPath = file.path.replace(/\/+/g, '/');
        if (!fileMap.has(normalizedPath)) {
          fileMap.set(normalizedPath, { ...file, path: normalizedPath });
        }
      });
      files = Array.from(fileMap.values());
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      return files;
    },

    async collectModifiedFiles(files) {
      const modifiedFiles = new Set();
      const checkPromises = files
        .filter(file => !file.isDirectory)
        .map(async (file) => {
          try {
            const cacheResponse = await fetch('/__api__/files/editor?path=' + encodeURIComponent(file.path));
            const cacheData = await cacheResponse.json();
            if (cacheData.success && cacheData.exists) {
              const fileResponse = await fetch('/__api__/files?path=' + encodeURIComponent(file.path));
              const fileData = await fileResponse.json();
              if (fileData.success && cacheData.content !== fileData.content) {
                modifiedFiles.add(file.path);
              }
            }
          } catch (error) {
            // Ignore
          }
        });
      await Promise.all(checkPromises);
      return modifiedFiles;
    },

    normalizeExplorerPath(p) {
      return String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    },

    emptyGitState() {
      return {
        isRepo: false,
        fileU: new Set(),
        fileM: new Set(),
        folderU: new Set(),
        folderM: new Set(),
      };
    },

    async getGitExplorerState() {
      const empty = module.emptyGitState();
      try {
        const res = await fetch('/__api__/git/repo-status');
        const data = await res.json();
        if (!data.success || !data.isRepo || !Array.isArray(data.files)) {
          return empty;
        }
        const fileU = new Set();
        const fileM = new Set();
        const folderU = new Set();
        const folderM = new Set();
        const addAncestors = (p, set) => {
          const norm = module.normalizeExplorerPath(p);
          if (!norm) return;
          let i = norm.lastIndexOf('/');
          while (i > 0) {
            const prefix = norm.slice(0, i);
            set.add(prefix);
            i = prefix.lastIndexOf('/');
          }
        };
        for (const f of data.files) {
          const p = module.normalizeExplorerPath(f.path);
          if (!p) continue;
          if (f.untracked) {
            fileU.add(p);
            addAncestors(p, folderU);
          } else {
            fileM.add(p);
            addAncestors(p, folderM);
          }
        }
        return { isRepo: true, fileU, fileM, folderU, folderM };
      } catch (_e) {
        return empty;
      }
    },

    gitFileBadge(normPath, gitState) {
      if (!gitState || !gitState.isRepo) return null;
      const n = module.normalizeExplorerPath(normPath);
      if (gitState.fileU.has(n)) return 'U';
      if (gitState.fileM.has(n)) return 'M';
      return null;
    },

    gitFolderBadge(folderNorm, gitState) {
      if (!gitState || !gitState.isRepo) return null;
      const fn = module.normalizeExplorerPath(folderNorm);
      if (gitState.folderU.has(fn)) return 'U';
      if (gitState.folderM.has(fn)) return 'M';
      return null;
    },

    appendExplorerBadges(item, localDirty, gitLetter) {
      const wrap = document.createElement('span');
      wrap.className = 'file-tree-status-badges';
      if (localDirty) {
        const s = document.createElement('span');
        s.className = 'file-tree-badge file-tree-badge-local';
        s.textContent = 'L';
        s.title = 'Editor cache differs from saved file on disk';
        wrap.appendChild(s);
      }
      if (gitLetter === 'U') {
        const s = document.createElement('span');
        s.className = 'file-tree-badge file-tree-badge-git-u';
        s.textContent = 'U';
        s.title = 'Untracked (Git)';
        wrap.appendChild(s);
      } else if (gitLetter === 'M') {
        const s = document.createElement('span');
        s.className = 'file-tree-badge file-tree-badge-git-m';
        s.textContent = 'M';
        s.title = 'Changed in Git';
        wrap.appendChild(s);
      }
      if (wrap.childNodes.length) {
        item.appendChild(wrap);
      }
    },

    applyExplorerRowTint(item, localDirty, gitLetter) {
      item.classList.remove('file-tree-local-l', 'file-tree-git-m', 'file-tree-git-u');
      if (localDirty) item.classList.add('file-tree-local-l');
      if (gitLetter === 'U') item.classList.add('file-tree-git-u');
      else if (gitLetter === 'M') item.classList.add('file-tree-git-m');
    },

    async loadTreeChildren(normPath, childrenWrap, ctx) {
      childrenWrap.innerHTML = '<div class="file-tree-loading">Loading...</div>';
      try {
        const res = await fetch('/__api__/files?path=' + encodeURIComponent(normPath) + '&list=true');
        const data = await res.json();
        if (data.success && data.files && data.files.length > 0) {
          childrenWrap.innerHTML = '';
          await module.renderTreeLevel(data.files, childrenWrap, ctx);
        } else if (data.success && data.files) {
          childrenWrap.innerHTML = '';
        } else {
          childrenWrap.innerHTML = '<div class="file-tree-loading">Empty</div>';
        }
      } catch (e) {
        console.error('Tree children load error:', e);
        childrenWrap.innerHTML = '<div class="file-tree-loading">Error loading</div>';
      }
    },

    async renderTreeLevel(files, container, ctx) {
      const list = module.prepareFileList(files);
      if (list.length === 0) return;
      if (!ctx.gitState) {
        ctx.gitState = await module.getGitExplorerState();
      }
      const modifiedFiles = await module.collectModifiedFiles(list);
      const filePath = typeof ctx.getFilePath === 'function' ? ctx.getFilePath() : ctx.getFilePath;
      for (const file of list) {
        if (!file.isDirectory) {
          module.appendTreeFileRow(container, file, filePath, modifiedFiles, ctx);
        } else {
          await module.appendTreeFolderBranch(container, file, filePath, modifiedFiles, ctx);
        }
      }
    },

    appendTreeFileRow(container, file, filePath, modifiedFiles, ctx) {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
      item.dataset.path = file.path;
      item.dataset.isDirectory = 'false';
      item.dataset.name = file.name;
      
      const normalizedCurrentPath = filePath ? filePath.replace(/\/+/g, '/') : '';
      const normalizedFilepath = file.path.replace(/\/+/g, '/');
      if (normalizedFilepath === normalizedCurrentPath) {
        item.classList.add('active');
      }
      
      const chevronSpacer = document.createElement('span');
      chevronSpacer.className = 'file-tree-chevron file-tree-chevron-spacer';
      chevronSpacer.setAttribute('aria-hidden', 'true');
      
      const icon = document.createElement('span');
      if (window.PreviewFileIcons && PreviewFileIcons.applyToIcon) {
        PreviewFileIcons.applyToIcon(icon, file.name, false);
      } else {
        icon.className = 'file-tree-item-icon';
        icon.textContent = '📄';
      }
      
      const name = document.createElement('span');
      name.className = 'file-tree-item-name';
      name.textContent = file.name;
      
      item.appendChild(chevronSpacer);
      item.appendChild(icon);
      item.appendChild(name);

      const localDirty = modifiedFiles.has(file.path);
      const gitLetter = module.gitFileBadge(file.path, ctx.gitState);
      module.appendExplorerBadges(item, localDirty, gitLetter);
      module.applyExplorerRowTint(item, localDirty, gitLetter);
      
      item.setAttribute('draggable', 'true');
      item.draggable = true;
      let isDragging = false;
      
      item.addEventListener('dragstart', (e) => {
        if (!e.dataTransfer) {
          e.preventDefault();
          return false;
        }
        isDragging = true;
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', file.path);
        } catch (err) {
          e.preventDefault();
          return false;
        }
        item.classList.add('dragging');
        const parentDir = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '/';
        setTimeout(() => {
          ctx.showParentFolderDropZone(parentDir);
        }, 0);
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        ctx.hideParentFolderDropZone();
        document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
        setTimeout(() => {
          isDragging = false;
        }, 100);
      });
      
      item.addEventListener('click', (e) => {
        if (isDragging || item.classList.contains('dragging')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        ctx.switchToFile(file.path);
      });
      
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.showContextMenu(e, file.path, false, file.name);
      });
      
      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        ctx.renameFile(file.path, file.name, false);
      });
      
      container.appendChild(item);
    },

    async appendTreeFolderBranch(container, file, filePath, modifiedFiles, ctx) {
      const norm = file.path.replace(/\/+/g, '/');
      const expanded = treeExpandedPaths.has(norm);
      
      const branch = document.createElement('div');
      branch.className = 'file-tree-branch' + (expanded ? ' expanded' : '');
      
      const row = document.createElement('div');
      row.className = 'file-tree-item file-tree-folder';
      row.dataset.path = file.path;
      row.dataset.isDirectory = 'true';
      row.dataset.name = file.name;
      
      const normalizedCurrentPath = filePath ? filePath.replace(/\/+/g, '/') : '';
      const normalizedFilepath = norm;
      if (normalizedFilepath === normalizedCurrentPath) {
        row.classList.add('active');
      }
      
      const chevron = document.createElement('span');
      chevron.className = 'file-tree-chevron';
      chevron.textContent = expanded ? '▼' : '▶';
      
      const icon = document.createElement('span');
      if (window.PreviewFileIcons && PreviewFileIcons.applyToIcon) {
        PreviewFileIcons.applyToIcon(icon, file.name, true);
      } else {
        icon.className = 'file-tree-item-icon';
      }
      
      const name = document.createElement('span');
      name.className = 'file-tree-item-name';
      name.textContent = file.name;
      
      row.appendChild(chevron);
      row.appendChild(icon);
      row.appendChild(name);

      const folderGitLetter = module.gitFolderBadge(norm, ctx.gitState);
      module.appendExplorerBadges(row, false, folderGitLetter);
      module.applyExplorerRowTint(row, false, folderGitLetter);
      
      row.setAttribute('draggable', 'true');
      row.draggable = true;
      let isDragging = false;
      
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'file-tree-children';
      
      branch.appendChild(row);
      branch.appendChild(childrenWrap);
      
      const toggle = async (ev) => {
        if (ev) ev.stopPropagation();
        const isOpen = treeExpandedPaths.has(norm);
        if (isOpen) {
          treeExpandedPaths.delete(norm);
          branch.classList.remove('expanded');
          chevron.textContent = '▶';
          childrenWrap.innerHTML = '';
        } else {
          treeExpandedPaths.add(norm);
          branch.classList.add('expanded');
          chevron.textContent = '▼';
          await module.loadTreeChildren(norm, childrenWrap, ctx);
        }
      };
      
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(e);
      });
      
      row.addEventListener('click', (e) => {
        if (e.target === chevron) return;
        if (isDragging || row.classList.contains('dragging')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        if (window.__previewSetExplorerDir) {
          window.__previewSetExplorerDir(file.path);
        }
        toggle(null);
      });
      
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.showContextMenu(e, file.path, true, file.name);
      });
      
      row.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        ctx.renameFile(file.path, file.name, true);
      });
      
      row.addEventListener('dragstart', (e) => {
        if (!e.dataTransfer) {
          e.preventDefault();
          return false;
        }
        isDragging = true;
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', file.path);
        } catch (err) {
          e.preventDefault();
          return false;
        }
        row.classList.add('dragging');
        setTimeout(() => {
          const parentDir = norm.includes('/') ? norm.split('/').slice(0, -1).join('/') : '/';
          ctx.showParentFolderDropZone(parentDir === '' ? '/' : parentDir);
        }, 0);
      });
      
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        ctx.hideParentFolderDropZone();
        document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
        setTimeout(() => {
          isDragging = false;
        }, 100);
      });
      
      row.addEventListener('dragover', (e) => {
        const hasTextPlain = e.dataTransfer.types.includes('text/plain');
        if (hasTextPlain) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over');
        }
      }, false);
      
      row.addEventListener('dragleave', (e) => {
        if (!row.contains(e.relatedTarget)) {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over');
        }
      });
      
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
          el.classList.remove('drag-over');
        });
        const draggedFilePath = e.dataTransfer.getData('text/plain');
        if (draggedFilePath && draggedFilePath.trim()) {
          if (draggedFilePath !== file.path && !file.path.startsWith(draggedFilePath + '/')) {
            ctx.moveFileToFolder(draggedFilePath, file.path);
          }
        } else {
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            ctx.handleFileDrop(files, file.path);
          }
        }
      });
      
      container.appendChild(branch);
      if (expanded) {
        await module.loadTreeChildren(norm, childrenWrap, ctx);
      }
    },

    async renderFileTreeTree(files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu, renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone) {
      if (isRendering) {
        if (renderTimeout) {
          clearTimeout(renderTimeout);
        }
        renderTimeout = setTimeout(() => {
          if (renderFileTreeFn) {
            renderFileTreeFn(files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu, renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone);
          }
        }, 50);
        return;
      }
      isRendering = true;
      try {
        if (!files || files.length === 0) {
          fileTree.innerHTML = '<div class="file-tree-loading">No files</div>';
          isRendering = false;
          return;
        }
        const ctx = {
          getFilePath,
          loadFileTree,
          switchToFile,
          showContextMenu,
          renameFile,
          moveFileToFolder,
          handleFileDrop,
          showParentFolderDropZone,
          hideParentFolderDropZone,
          gitState: null,
        };
        fileTree.innerHTML = '';
        const list = module.prepareFileList(files);
        await module.renderTreeLevel(list, fileTree, ctx);
      } catch (error) {
        console.error('Error rendering file tree:', error);
        fileTree.innerHTML = '<div class="file-tree-loading">Error rendering files</div>';
      }
      isRendering = false;
    },

    fetchDirectoryListing(dir, fileTree, renderFileTree) {
      const dirStr = typeof dir === 'function' ? dir() : (typeof dir === 'string' ? dir : String(dir || '/'));
      fetch(dirStr === '/' ? '/' : dirStr)
        .then(res => res.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const links = doc.querySelectorAll('table a[href]');
          const files = [];
          
          links.forEach(link => {
            const href = link.getAttribute('href');
            const name = link.textContent.trim();
            if (href && !href.startsWith('..') && !href.startsWith('http')) {
              const fullPath = dir === '/' ? href : dir + '/' + href;
              files.push({
                name: name,
                path: fullPath.replace(/\/+/g, '/'),
                isDirectory: href.endsWith('/')
              });
            }
          });
          
          renderFileTree(files, dir);
        })
        .catch(() => {
          fileTree.innerHTML = '<div class="file-tree-loading">Error loading directory</div>';
        });
    },

    async renderFileTree(files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu, renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone) {
      // Prevent concurrent renders
      if (isRendering) {
        // If already rendering, queue this render
        if (renderTimeout) {
          clearTimeout(renderTimeout);
        }
        renderTimeout = setTimeout(() => {
          if (renderFileTreeFn) {
            renderFileTreeFn(files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu, renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone);
          }
        }, 50);
        return;
      }
      
      isRendering = true;
      
      try {
      if (!files || files.length === 0) {
        fileTree.innerHTML = '<div class="file-tree-loading">No files</div>';
        isRendering = false;
        return;
      }
      
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      files = files.filter(file => !(file.name.toLowerCase() === 'ide_editor_cache' && file.isDirectory));
        
        // Deduplicate files by path to prevent duplicate entries
        const fileMap = new Map();
        files.forEach(file => {
          const normalizedPath = file.path.replace(/\/+/g, '/');
          if (!fileMap.has(normalizedPath)) {
            fileMap.set(normalizedPath, file);
          }
        });
        files = Array.from(fileMap.values());
      
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      fileTree.innerHTML = '';
      
      // Check for modified files (in cache but different from saved)
      const modifiedFiles = new Set();
      const checkPromises = files
        .filter(file => !file.isDirectory)
        .map(async (file) => {
          try {
            const cacheResponse = await fetch('/__api__/files/editor?path=' + encodeURIComponent(file.path));
            const cacheData = await cacheResponse.json();
            
            if (cacheData.success && cacheData.exists) {
              const fileResponse = await fetch('/__api__/files?path=' + encodeURIComponent(file.path));
              const fileData = await fileResponse.json();
              
              if (fileData.success && cacheData.content !== fileData.content) {
                modifiedFiles.add(file.path);
              }
            }
          } catch (error) {
            // Ignore errors, just don't mark as modified
          }
        });
      
      const gitPromise = module.getGitExplorerState();
      await Promise.all(checkPromises);
      const gitState = await gitPromise;
      
      files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-tree-item' + (file.isDirectory ? ' file-tree-folder' : '');
        item.dataset.path = file.path;
        item.dataset.isDirectory = file.isDirectory;
        item.dataset.name = file.name;
        
        const normalizedCurrentPath = filePath ? filePath.replace(/\/+/g, '/') : '';
        const normalizedFilepath = file.path.replace(/\/+/g, '/');
        if (normalizedFilepath === normalizedCurrentPath) {
          item.classList.add('active');
        }
        
        const icon = document.createElement('span');
        if (window.PreviewFileIcons && PreviewFileIcons.applyToIcon) {
          PreviewFileIcons.applyToIcon(icon, file.name, !!file.isDirectory);
        } else {
          icon.className = 'file-tree-item-icon';
          if (!file.isDirectory) {
            icon.textContent = '📄';
          }
        }
        
        const name = document.createElement('span');
        name.className = 'file-tree-item-name';
        name.textContent = file.name;
        
        item.appendChild(icon);
        item.appendChild(name);

        const localDirty = !file.isDirectory && modifiedFiles.has(file.path);
        const norm = module.normalizeExplorerPath(file.path);
        const gitLetter = file.isDirectory
          ? module.gitFolderBadge(norm, gitState)
          : module.gitFileBadge(norm, gitState);
        module.appendExplorerBadges(item, localDirty, gitLetter);
        module.applyExplorerRowTint(item, localDirty, gitLetter);
        
        item.setAttribute('draggable', 'true');
        item.draggable = true;
        
        let isDragging = false;
        
        item.addEventListener('mousedown', (e) => {
        });
        
        item.addEventListener('dragstart', (e) => {
          if (!e.dataTransfer) {
            console.error('dataTransfer not available in dragstart');
            e.preventDefault();
            return false;
          }
          
          isDragging = true;
          
          e.dataTransfer.effectAllowed = 'move';
          
          const fullPath = file.path;
          
          try {
            e.dataTransfer.setData('text/plain', fullPath);
          } catch (err) {
            console.error('Error setting drag data:', err);
            e.preventDefault();
            return false;
          }
          
          item.classList.add('dragging');
          
          setTimeout(() => {
            showParentFolderDropZone(dir);
          }, 0);
        });
        
        item.addEventListener('dragend', (e) => {
          item.classList.remove('dragging');
          hideParentFolderDropZone();
          document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
            el.classList.remove('drag-over');
          });
          setTimeout(() => {
            isDragging = false;
          }, 100);
        });
        
        if (file.isDirectory) {
          item.addEventListener('click', (e) => {
            if (isDragging || item.classList.contains('dragging')) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            loadFileTree(file.path);
          });
        } else {
          item.addEventListener('click', (e) => {
            if (isDragging || item.classList.contains('dragging')) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.stopPropagation();
            switchToFile(file.path);
          });
        }
        
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showContextMenu(e, file.path, file.isDirectory, file.name);
        });
        
        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          renameFile(file.path, file.name, file.isDirectory);
        });
        
        if (file.isDirectory) {
          item.addEventListener('dragover', (e) => {
            const hasTextPlain = e.dataTransfer.types.includes('text/plain');
            if (hasTextPlain) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              item.classList.add('drag-over');
            }
          }, false);
          
          item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
              e.preventDefault();
              e.stopPropagation();
              item.classList.remove('drag-over');
            }
          });
          
          item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
              el.classList.remove('drag-over');
            });
            
            const draggedFilePath = e.dataTransfer.getData('text/plain');
            
            if (draggedFilePath && draggedFilePath.trim()) {
              if (draggedFilePath !== file.path && !file.path.startsWith(draggedFilePath + '/')) {
                moveFileToFolder(draggedFilePath, file.path);
              }
            } else {
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                handleFileDrop(files, file.path);
              }
            }
          });
        }
        
        fileTree.appendChild(item);
      });
      
      isRendering = false;
      } catch (error) {
        console.error('Error rendering file tree:', error);
        isRendering = false;
      }
    },

    showParentFolderDropZone(currentDir, fileTree, moveFileToFolder) {
      if (!currentDir || currentDir === '/') return;
      
      let parentItem = fileTree.querySelector('.file-tree-item[data-path="__parent__"]');
      if (!parentItem) {
        parentItem = document.createElement('div');
        parentItem.className = 'file-tree-item file-tree-folder file-tree-parent';
        parentItem.dataset.path = '__parent__';
        parentItem.dataset.isDirectory = 'true';
        parentItem.dataset.name = '...';
        
        const name = document.createElement('span');
        name.className = 'file-tree-item-name';
        name.textContent = '...';
        
        parentItem.appendChild(name);
        
        parentItem.addEventListener('dragover', (e) => {
          const hasTextPlain = e.dataTransfer.types.includes('text/plain');
          if (hasTextPlain) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            parentItem.classList.add('drag-over');
          }
        }, false);
        
        parentItem.addEventListener('dragleave', (e) => {
          if (!parentItem.contains(e.relatedTarget)) {
            e.preventDefault();
            e.stopPropagation();
            parentItem.classList.remove('drag-over');
          }
        });
        
        parentItem.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          document.querySelectorAll('.file-tree-item.drag-over').forEach(el => {
            el.classList.remove('drag-over');
          });
          
          const draggedFilePath = e.dataTransfer.getData('text/plain');
          
          if (draggedFilePath && draggedFilePath.trim()) {
            const parentDir = currentDir.split('/').slice(0, -1).join('/') || '/';
            moveFileToFolder(draggedFilePath, parentDir);
          }
        });
        
        fileTree.insertBefore(parentItem, fileTree.firstChild);
      }
    },

    hideParentFolderDropZone(fileTree) {
      const parentItem = fileTree.querySelector('.file-tree-item[data-path="__parent__"]');
      if (parentItem) {
        parentItem.remove();
      }
    },

    moveFileToFolder(filePath, targetFolderPath, loadFileTree, switchToFile, status, isDirty) {
      const fileName = filePath.split('/').pop();
      const newPath = targetFolderPath === '/' ? fileName : targetFolderPath + '/' + fileName;
      
      const currentDir = filePath.split('/').slice(0, -1).join('/') || '/';
      if (currentDir === targetFolderPath) {
        return;
      }
      
      const item = document.querySelector(`.file-tree-item[data-path="${filePath}"]`);
      const isDirectory = item ? item.dataset.isDirectory === 'true' : false;
      
      fetch('/__api__/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: filePath, 
          newPath: newPath, 
          isDirectory: isDirectory 
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadFileTree(currentDir);
          if (filePath === filePath) {
            switchToFile(newPath);
          }
          if (targetFolderPath !== currentDir) {
            setTimeout(() => {
              if (currentDir === targetFolderPath) {
                loadFileTree(targetFolderPath);
              }
            }, 100);
          }
          status.textContent = `Moved ${fileName}`;
          status.className = 'status saved';
          setTimeout(() => {
            if (!isDirty) {
              status.textContent = 'Ready';
              status.className = 'status';
            }
          }, 2000);
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(err => {
        alert('Error moving file: ' + err.message);
      });
    },

    setupDragAndDrop(fileTree, currentDir, handleFileDrop) {
      fileTree.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          fileTree.classList.add('drag-over');
        }
      });
      
      fileTree.addEventListener('dragleave', (e) => {
        if (!fileTree.contains(e.relatedTarget)) {
          e.preventDefault();
          e.stopPropagation();
          fileTree.classList.remove('drag-over');
        }
      });
      
      fileTree.addEventListener('drop', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          fileTree.classList.remove('drag-over');
          
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            const target = e.target.closest('.file-tree-folder');
            if (target && target.dataset.path) {
              handleFileDrop(files, target.dataset.path);
            } else {
              handleFileDrop(files, currentDir || '/');
            }
          }
        }
      });
    },

    handleFileDrop(files, targetDir, uploadFile) {
      const normalizedDir = targetDir === '/' ? '' : targetDir.replace(/^\/+|\/+$/g, '');
      
      Array.from(files).forEach((file) => {
        uploadFile(file, normalizedDir);
      });
    },

    uploadFile(file, targetDir, status, isDirty, loadFileTree, getCurrentDir) {
      const fileName = file.name;
      const targetPath = targetDir ? targetDir + '/' + fileName : fileName;
      
      status.textContent = `Uploading ${fileName}...`;
      status.className = 'status saving';
      
      const reader = new FileReader();
      reader.onload = (e) => {
        let content = e.target.result;
        let isBinary = false;
        
        if (typeof content === 'string' && content.startsWith('data:')) {
          isBinary = true;
          const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            content = base64Match[1];
          } else {
            const commaIndex = content.indexOf(',');
            if (commaIndex !== -1) {
              content = content.substring(commaIndex + 1);
            }
          }
        }
        
        fetch('/__api__/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: targetPath, 
            content: content,
            isDirectory: false,
            isBinary: isBinary
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // File watcher will automatically refresh via WebSocket, no need to manually refresh
            status.textContent = `Uploaded ${fileName}`;
            status.className = 'status saved';
            setTimeout(() => {
              if (!isDirty) {
                status.textContent = 'Ready';
                status.className = 'status';
              }
            }, 2000);
          } else {
            status.textContent = 'Error: ' + data.error;
            status.className = 'status error';
          }
        })
        .catch(err => {
          status.textContent = 'Error uploading file';
          status.className = 'status error';
          console.error(err);
        });
      };
      
      reader.onerror = () => {
        status.textContent = 'Error reading file';
        status.className = 'status error';
      };
      
      const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
      const isTextFile = textTypes.some(type => file.type.startsWith(type)) || 
                         file.type === '' || 
                         fileName.endsWith('.txt') || 
                         fileName.endsWith('.html') || 
                         fileName.endsWith('.css') || 
                         fileName.endsWith('.js') ||
                         fileName.endsWith('.json') ||
                         fileName.endsWith('.md');
      
      if (isTextFile) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    },

    setupContextMenu(contextMenu, fileTree, createNewFile, createNewFolder, renameFile, deleteFile, showContextMenu, openHexEditor) {
      document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextNewFile').addEventListener('click', () => {
        const dir = contextMenu.dataset.createTargetDir;
        createNewFile(dir);
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextNewFolder').addEventListener('click', () => {
        const dir = contextMenu.dataset.createTargetDir;
        createNewFolder(dir);
        contextMenu.style.display = 'none';
      });
      
      const contextOpenHex = document.getElementById('contextOpenHex');
      if (contextOpenHex && typeof openHexEditor === 'function') {
        contextOpenHex.addEventListener('click', () => {
          const p = contextMenu.dataset.path || '';
          if (p) {
            openHexEditor(p);
          }
          contextMenu.style.display = 'none';
        });
      }

      document.getElementById('contextRename').addEventListener('click', () => {
        const path = contextMenu.dataset.path;
        const name = contextMenu.dataset.name;
        const isDir = contextMenu.dataset.isDirectory === 'true';
        renameFile(path, name, isDir);
        contextMenu.style.display = 'none';
      });

      function copyToClipboard(text) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {
            // Fallback below
          });
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          try {
            document.execCommand('copy');
          } catch (e) {
            console.error('Copy failed:', e);
          }
          document.body.removeChild(textarea);
        }
      }

      const copyPathItem = document.getElementById('contextCopyPath');
      if (copyPathItem) {
        copyPathItem.addEventListener('click', () => {
          const path = contextMenu.dataset.path || '';
          if (path) {
            // Use workspace-root-style path as-is
            copyToClipboard(path);
          }
          contextMenu.style.display = 'none';
        });
      }

      const copyRelItem = document.getElementById('contextCopyRelativePath');
      if (copyRelItem) {
        copyRelItem.addEventListener('click', () => {
          const path = contextMenu.dataset.path || '';
          if (path) {
            // Relative path = trim leading slashes
            const rel = path.replace(/^\/+/, '');
            copyToClipboard(rel);
          }
          contextMenu.style.display = 'none';
        });
      }

      const minifyItem = document.getElementById('contextMinifyToNew');
      if (minifyItem) {
        minifyItem.addEventListener('click', async () => {
          const path = contextMenu.dataset.path || '';
          const isDir = contextMenu.dataset.isDirectory === 'true';
          if (!path || isDir) {
            alert('Select a file to minify.');
            contextMenu.style.display = 'none';
            return;
          }

          try {
            // Read file contents
            const readRes = await fetch('/__api__/files?path=' + encodeURIComponent(path));
            const readData = await readRes.json();
            if (!readData.success || typeof readData.content !== 'string') {
              alert('Unable to read file for minify.');
              contextMenu.style.display = 'none';
              return;
            }

            // Minify content
            const minRes = await fetch('/__api__/minify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: readData.content,
                filePath: path
              })
            });
            const minData = await minRes.json().catch(() => null);
            if (!minData || !minData.success) {
              alert('Minify failed: ' + ((minData && minData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            // Build new file name with -min before extension
            const slashIndex = path.lastIndexOf('/');
            const dirPart = slashIndex !== -1 ? path.slice(0, slashIndex) : '';
            const baseName = slashIndex !== -1 ? path.slice(slashIndex + 1) : path;
            const dotIndex = baseName.lastIndexOf('.');
            let newBase;
            if (dotIndex > 0) {
              newBase = baseName.slice(0, dotIndex) + '-min' + baseName.slice(dotIndex);
            } else {
              newBase = baseName + '-min';
            }
            const newPath = dirPart ? `${dirPart}/${newBase}` : newBase;

            // Save new file
            const saveRes = await fetch('/__api__/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: newPath,
                content: minData.minified,
                isDirectory: false
              })
            });
            const saveData = await saveRes.json().catch(() => null);
            if (!saveData || !saveData.success) {
              alert('Failed to save minified file: ' + ((saveData && saveData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            alert(`Minified copy saved as ${newBase}`);
          } catch (err) {
            console.error('Minify-to-new error:', err);
            alert('Error while minifying file: ' + (err.message || err));
          } finally {
            contextMenu.style.display = 'none';
          }
        });
      }
      
      document.getElementById('contextDelete').addEventListener('click', () => {
        const path = contextMenu.dataset.path;
        const isDir = contextMenu.dataset.isDirectory === 'true';
        deleteFile(path, isDir);
        contextMenu.style.display = 'none';
      });

      // Compress submenu handlers (zip / 7z / tar.gz)
      const compressMenu = document.getElementById('contextCompress');
      const compressSubmenu = document.getElementById('contextCompressSubmenu');
      const compressZip = document.getElementById('contextCompressZip');
      const compress7z = document.getElementById('contextCompress7z');
      const compressTarGz = document.getElementById('contextCompressTarGz');
      const extractItem = document.getElementById('contextExtract');

      if (compressMenu && compressSubmenu) {
        // Show submenu when hovering over the Compress item
        compressMenu.addEventListener('mouseenter', () => {
          compressSubmenu.style.display = 'block';
        });

        compressMenu.addEventListener('mouseleave', (e) => {
          if (!compressMenu.contains(e.relatedTarget)) {
            compressSubmenu.style.display = 'none';
          }
        });

        compressSubmenu.addEventListener('mouseleave', () => {
          compressSubmenu.style.display = 'none';
        });
      }

      function handleCompressClick(format) {
        const path = contextMenu.dataset.path;
        const isDir = contextMenu.dataset.isDirectory === 'true';

        if (!path) {
          alert('No file or folder selected to compress.');
          return;
        }

        module.compressPath(path, format, isDir)
          .catch(err => {
            console.error('Error compressing:', err);
            alert('Error compressing: ' + (err.message || err));
          })
          .finally(() => {
            contextMenu.style.display = 'none';
            if (compressSubmenu) {
              compressSubmenu.style.display = 'none';
            }
          });
      }

      if (compressZip) {
        compressZip.addEventListener('click', () => handleCompressClick('zip'));
      }
      if (compress7z) {
        compress7z.addEventListener('click', () => handleCompressClick('7z'));
      }
      if (compressTarGz) {
        compressTarGz.addEventListener('click', () => handleCompressClick('tar.gz'));
      }

      if (extractItem) {
        extractItem.addEventListener('click', () => {
          const path = contextMenu.dataset.path;
          const isDir = contextMenu.dataset.isDirectory === 'true';

          if (!path || isDir) {
            alert('Select an archive file to extract.');
            return;
          }

          module.extractArchive(path)
            .catch(err => {
              console.error('Error extracting:', err);
              alert('Error extracting: ' + (err.message || err));
            })
            .finally(() => {
              contextMenu.style.display = 'none';
              if (compressSubmenu) {
                compressSubmenu.style.display = 'none';
              }
            });
        });
      }
      
      const minifyInPlaceItem = document.getElementById('contextMinifyInPlace');
      const minifyToNewItem = document.getElementById('contextMinifyToNew');

      if (minifyInPlaceItem) {
        minifyInPlaceItem.addEventListener('click', async () => {
          const path = contextMenu.dataset.path || '';
          const isDir = contextMenu.dataset.isDirectory === 'true';
          if (!path || isDir) {
            alert('Select a file to minify.');
            contextMenu.style.display = 'none';
            return;
          }

          try {
            const readRes = await fetch('/__api__/files?path=' + encodeURIComponent(path));
            const readData = await readRes.json();
            if (!readData.success || typeof readData.content !== 'string') {
              alert('Unable to read file for minify.');
              contextMenu.style.display = 'none';
              return;
            }

            const minRes = await fetch('/__api__/minify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: readData.content,
                filePath: path
              })
            });
            const minData = await minRes.json().catch(() => null);
            if (!minData || !minData.success) {
              alert('Minify failed: ' + ((minData && minData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            const saveRes = await fetch('/__api__/files', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: path,
                content: minData.minified
              })
            });
            const saveData = await saveRes.json().catch(() => null);
            if (!saveData || !saveData.success) {
              alert('Failed to save minified file: ' + ((saveData && saveData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            alert('File minified in place.');
          } catch (err) {
            console.error('Minify-in-place error:', err);
            alert('Error while minifying file: ' + (err.message || err));
          } finally {
            contextMenu.style.display = 'none';
          }
        });
      }

      if (minifyToNewItem) {
        minifyToNewItem.addEventListener('click', async () => {
          const path = contextMenu.dataset.path || '';
          const isDir = contextMenu.dataset.isDirectory === 'true';
          if (!path || isDir) {
            alert('Select a file to minify.');
            contextMenu.style.display = 'none';
            return;
          }

          try {
            // Read file contents
            const readRes = await fetch('/__api__/files?path=' + encodeURIComponent(path));
            const readData = await readRes.json();
            if (!readData.success || typeof readData.content !== 'string') {
              alert('Unable to read file for minify.');
              contextMenu.style.display = 'none';
              return;
            }

            // Minify content
            const minRes = await fetch('/__api__/minify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: readData.content,
                filePath: path
              })
            });
            const minData = await minRes.json().catch(() => null);
            if (!minData || !minData.success) {
              alert('Minify failed: ' + ((minData && minData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            // Build new file name with -min before extension
            const slashIndex = path.lastIndexOf('/');
            const dirPart = slashIndex !== -1 ? path.slice(0, slashIndex) : '';
            const baseName = slashIndex !== -1 ? path.slice(slashIndex + 1) : path;
            const dotIndex = baseName.lastIndexOf('.');
            let newBase;
            if (dotIndex > 0) {
              newBase = baseName.slice(0, dotIndex) + '-min' + baseName.slice(dotIndex);
            } else {
              newBase = baseName + '-min';
            }
            const newPath = dirPart ? `${dirPart}/${newBase}` : newBase;

            // Save new file
            const saveRes = await fetch('/__api__/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: newPath,
                content: minData.minified,
                isDirectory: false
              })
            });
            const saveData = await saveRes.json().catch(() => null);
            if (!saveData || !saveData.success) {
              alert('Failed to save minified file: ' + ((saveData && saveData.error) || 'Unknown error'));
              contextMenu.style.display = 'none';
              return;
            }

            alert(`Minified copy saved as ${newBase}`);
          } catch (err) {
            console.error('Minify-to-new error:', err);
            alert('Error while minifying file: ' + (err.message || err));
          } finally {
            contextMenu.style.display = 'none';
          }
        });
      }

      fileTree.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.file-tree-item')) {
          return;
        }
        e.preventDefault();
        const branch = e.target.closest('.file-tree-branch');
        if (branch) {
          const row = branch.querySelector(':scope > .file-tree-item.file-tree-folder');
          if (row && row.dataset.path) {
            showContextMenu(e, row.dataset.path, true, row.dataset.name || '', false);
            return;
          }
        }
        showContextMenu(e, '', false, '', true);
      });
    },

    showContextMenu(e, path, isDirectory, name, contextMenu, onlyCreate = false, getFallbackCreateDir) {
      const normSeg = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

      let createTargetDir = '';
      if (!path) {
        createTargetDir = typeof getFallbackCreateDir === 'function' ? normSeg(getFallbackCreateDir()) : '';
      } else if (isDirectory) {
        createTargetDir = normSeg(path);
      } else {
        const np = normSeg(path);
        const i = np.lastIndexOf('/');
        createTargetDir = i === -1 ? '' : np.slice(0, i);
      }

      contextMenu.dataset.path = path;
      contextMenu.dataset.name = name;
      contextMenu.dataset.isDirectory = isDirectory;
      contextMenu.dataset.createTargetDir = createTargetDir;

      contextMenu.style.display = 'block';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      
      document.getElementById('contextRename').style.display = onlyCreate ? 'none' : 'block';
      document.getElementById('contextDelete').style.display = onlyCreate ? 'none' : 'block';
      document.querySelector('.context-menu-divider').style.display = onlyCreate ? 'none' : 'block';

      const copyPathItem = document.getElementById('contextCopyPath');
      const copyRelItem = document.getElementById('contextCopyRelativePath');
      const minifyInPlaceItem = document.getElementById('contextMinifyInPlace');
      const minifyItem = document.getElementById('contextMinifyToNew');
      const hasTarget = !!path && !onlyCreate;
      if (copyPathItem) {
        copyPathItem.style.display = hasTarget ? 'block' : 'none';
      }
      if (copyRelItem) {
        copyRelItem.style.display = hasTarget ? 'block' : 'none';
      }
      const lower = (path || '').toLowerCase();
      const canMinify =
        hasTarget &&
        (lower.endsWith('.html') ||
         lower.endsWith('.htm') ||
         lower.endsWith('.css') ||
         lower.endsWith('.js') ||
         lower.endsWith('.mjs') ||
         lower.endsWith('.cjs') ||
         lower.endsWith('.json') ||
         lower.endsWith('.jsonc'));

      if (minifyInPlaceItem) {
        minifyInPlaceItem.style.display = canMinify ? 'block' : 'none';
      }
      if (minifyItem) {
        minifyItem.style.display = canMinify ? 'block' : 'none';
      }

      const openHexItem = document.getElementById('contextOpenHex');
      if (openHexItem) {
        const isDir = contextMenu.dataset.isDirectory === 'true';
        openHexItem.style.display = hasTarget && !isDir ? 'block' : 'none';
      }

      // Hide compress submenu every time menu opens so it isn't stuck open
      const compressSubmenu = document.getElementById('contextCompressSubmenu');
      if (compressSubmenu) {
        compressSubmenu.style.display = 'none';
      }

      // Only show Compress / Extract when a concrete file is selected
      const compressMenu = document.getElementById('contextCompress');
      const compressDivider = document.getElementById('contextCompressDivider');
      const extractItem = document.getElementById('contextExtract');
      const lowerPath = (path || '').toLowerCase();
      const isArchive = lowerPath.endsWith('.zip') || lowerPath.endsWith('.7z') || lowerPath.endsWith('.tar.gz') || lowerPath.endsWith('.tgz');

      if (compressMenu) {
        compressMenu.style.display = hasTarget ? 'block' : 'none';
      }
      if (compressDivider) {
        compressDivider.style.display = hasTarget ? 'block' : 'none';
      }
      if (extractItem) {
        extractItem.style.display = hasTarget && isArchive ? 'block' : 'none';
      }
    },

    async compressPath(path, format, isDirectory) {
      try {
        const response = await fetch('/__api__/files/compress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, format, isDirectory })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Compression failed');
        }

        const outputName = data.outputFile || '';
        alert(`Compressed to ${outputName || 'archive'} successfully.`);
      } catch (error) {
        console.error('compressPath error:', error);
        throw error;
      }
    },

    async extractArchive(path) {
      try {
        const response = await fetch('/__api__/files/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Extraction failed');
        }

        alert('Archive extracted successfully.');
      } catch (error) {
        console.error('extractArchive error:', error);
        throw error;
      }
    },

    async createNewFile(customPrompt, getCurrentDir, loadFileTree, switchToFile, targetDirOverride) {
      const fileName = await customPrompt('Enter file name:');
      if (!fileName) return;

      const normSeg = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
      const rawDir = (targetDirOverride !== undefined && targetDirOverride !== null)
        ? String(targetDirOverride)
        : getCurrentDir();
      const currentDir = normSeg(rawDir);
      const newPath = currentDir ? currentDir + '/' + fileName : fileName;
      
      fetch('/__api__/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, content: '', isDirectory: false })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // File watcher will automatically refresh via WebSocket, no need to manually refresh
          // Don't automatically open the file - let user open it manually if needed
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(err => {
        alert('Error creating file: ' + err.message);
      });
    },

    async createNewFolder(customPrompt, getCurrentDir, loadFileTree, targetDirOverride) {
      const folderName = await customPrompt('Enter folder name:');
      if (!folderName) return;

      const normSeg = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
      const rawDir = (targetDirOverride !== undefined && targetDirOverride !== null)
        ? String(targetDirOverride)
        : getCurrentDir();
      const currentDir = normSeg(rawDir);
      const newPath = currentDir ? currentDir + '/' + folderName : folderName;
      
      fetch('/__api__/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, content: '', isDirectory: true })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // File watcher will automatically refresh via WebSocket, no need to manually refresh
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(err => {
        alert('Error creating folder: ' + err.message);
      });
    },

    async renameFile(path, oldName, isDirectory, customPrompt, getCurrentDir, loadFileTree, filePath, switchToFile, renameTabCallback, updateEditorPath, updatePreviewPath, updateUIForRename) {
      const newName = await customPrompt('Enter new name:', oldName);
      if (!newName || newName === oldName) return;
      
      const parentDir = path.split('/').slice(0, -1).join('/') || '';
      const newPath = parentDir ? parentDir + '/' + newName : newName;
      
      fetch('/__api__/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path, newPath: newPath, isDirectory: isDirectory })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Get current file path (handle both function and value)
          const currentFilePath = typeof filePath === 'function' ? filePath() : filePath;
          
          // If the renamed file is currently open, update editor, preview, and tab
          if (path === currentFilePath) {
            // Rename the tab if it exists
            if (renameTabCallback && typeof renameTabCallback === 'function') {
              renameTabCallback(path, newPath);
            }
            
            // Update editor path and preview without reloading
            if (updateEditorPath && typeof updateEditorPath === 'function') {
              updateEditorPath(newPath, path);
            }
            
            if (updatePreviewPath && typeof updatePreviewPath === 'function') {
              updatePreviewPath(newPath);
            }
            
            // Update UI (URL, file name display, etc.) without reloading file
            if (updateUIForRename && typeof updateUIForRename === 'function') {
              updateUIForRename(newPath);
            } else {
              // Fallback to switchToFile if updateUIForRename not provided
            switchToFile(newPath);
            }
          }
          
          // File watcher will automatically refresh via WebSocket events (unlink + add)
          // No need to manually call loadFileTree here - it will be handled by WebSocket
          // with proper debouncing to prevent duplicate refreshes
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(err => {
        alert('Error renaming: ' + err.message);
      });
    },

    async deleteFile(path, isDirectory, customConfirm, getCurrentDir, loadFileTree, filePath, closeTabCallback) {
      const confirmed = await customConfirm(`Are you sure you want to delete ${isDirectory ? 'folder' : 'file'} "${path.split('/').pop()}"?`);
      if (!confirmed) {
        return;
      }
      
      fetch('/__api__/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path, isDirectory: isDirectory })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadFileTree(getCurrentDir());
          // Close the tab if the deleted file is open
          if (closeTabCallback && typeof closeTabCallback === 'function') {
            closeTabCallback(path);
          }
        } else {
          alert('Error: ' + data.error);
        }
      })
      .catch(err => {
        alert('Error deleting: ' + err.message);
      });
    }
  };
  
  // Store reference for debounced re-render (flat vs tree)
  renderFileTreeFn = function(
    files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu,
    renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
  ) {
    if (PreviewSettings.getSettings().explorerTreeView) {
      module.renderFileTreeTree(
        files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu,
        renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
      );
    } else {
      module.renderFileTree(
        files, dir, fileTree, getFilePath, loadFileTree, switchToFile, showContextMenu,
        renameFile, moveFileToFolder, handleFileDrop, showParentFolderDropZone, hideParentFolderDropZone
      );
    }
  };
  
  return module;
})();
