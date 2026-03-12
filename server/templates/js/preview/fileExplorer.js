window.PreviewFileExplorer = (function() {
  let isRendering = false;
  let renderTimeout = null;
  let renderFileTreeFn = null;
  
  const module = {
    setupFileExplorer(getCurrentDir, loadFileTree) {
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      loadFileTree(currentDir || '/');
    },

    loadFileTree(dir, fileTree, currentDirRef, updateBackButton, saveState, renderFileTree, fetchDirectoryListing) {
      // Clear any pending render
      if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
      }
      
      fileTree.innerHTML = '<div class="file-tree-loading">Loading...</div>';
      
      const dirStr = typeof dir === 'function' ? dir() : (typeof dir === 'string' ? dir : String(dir || '/'));
      currentDirRef.currentDir = dirStr;
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
              console.error('Error calling renderFileTree:', error);
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
      
      await Promise.all(checkPromises);
      
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
        icon.className = 'file-tree-item-icon';
        if (!file.isDirectory) {
          icon.textContent = '📄';
        }
        
        const name = document.createElement('span');
        name.className = 'file-tree-item-name';
        name.textContent = file.name;
        
        item.appendChild(icon);
        item.appendChild(name);
        
        // Add "M" indicator for modified files
        if (!file.isDirectory && modifiedFiles.has(file.path)) {
          const modifiedIndicator = document.createElement('span');
          modifiedIndicator.className = 'file-tree-modified';
          modifiedIndicator.textContent = 'M';
          modifiedIndicator.title = 'Modified (unsaved changes)';
          item.appendChild(modifiedIndicator);
        }
        
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

    setupContextMenu(contextMenu, fileTree, createNewFile, createNewFolder, renameFile, deleteFile, showContextMenu) {
      document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextNewFile').addEventListener('click', () => {
        createNewFile();
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextNewFolder').addEventListener('click', () => {
        createNewFolder();
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextRename').addEventListener('click', () => {
        const path = contextMenu.dataset.path;
        const name = contextMenu.dataset.name;
        const isDir = contextMenu.dataset.isDirectory === 'true';
        renameFile(path, name, isDir);
        contextMenu.style.display = 'none';
      });
      
      document.getElementById('contextDelete').addEventListener('click', () => {
        const path = contextMenu.dataset.path;
        const isDir = contextMenu.dataset.isDirectory === 'true';
        deleteFile(path, isDir);
        contextMenu.style.display = 'none';
      });
      
      fileTree.addEventListener('contextmenu', (e) => {
        if (e.target === fileTree || e.target.classList.contains('file-tree-loading')) {
          e.preventDefault();
          showContextMenu(e, '', false, '', true);
        }
      });
    },

    showContextMenu(e, path, isDirectory, name, contextMenu, onlyCreate = false) {
      contextMenu.dataset.path = path;
      contextMenu.dataset.name = name;
      contextMenu.dataset.isDirectory = isDirectory;
      
      contextMenu.style.display = 'block';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      
      document.getElementById('contextRename').style.display = onlyCreate ? 'none' : 'block';
      document.getElementById('contextDelete').style.display = onlyCreate ? 'none' : 'block';
      document.querySelector('.context-menu-divider').style.display = onlyCreate ? 'none' : 'block';
    },

    async createNewFile(customPrompt, getCurrentDir, loadFileTree, switchToFile) {
      const fileName = await customPrompt('Enter file name:');
      if (!fileName) return;
      
      const currentDir = getCurrentDir();
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

    async createNewFolder(customPrompt, getCurrentDir, loadFileTree) {
      const folderName = await customPrompt('Enter folder name:');
      if (!folderName) return;
      
      const currentDir = getCurrentDir();
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
  
  // Store reference to renderFileTree for recursive calls
  renderFileTreeFn = module.renderFileTree;
  
  return module;
})();
