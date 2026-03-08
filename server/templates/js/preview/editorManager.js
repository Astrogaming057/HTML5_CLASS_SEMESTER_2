window.PreviewEditorManager = (function() {
  let cacheEditorInstance = null;
  let liveEditorInstance = null;
  let isApplyingExternalChange = false;

  return {
    updateActiveFileTreeItem(path, fileTree) {
      const allItems = fileTree.querySelectorAll('.file-tree-item');
      allItems.forEach(item => {
        item.classList.remove('active');
      });
      
      if (path) {
        const normalizedPath = path.replace(/\/+/g, '/');
        const activeItem = Array.from(allItems).find(item => {
          const itemPath = item.dataset.path.replace(/\/+/g, '/');
          return itemPath === normalizedPath;
        });
        
        if (activeItem) {
          activeItem.classList.add('active');
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },

    async switchToFile(newPath, getFilePath, isDirty, customConfirm, fileName, getCurrentDir, loadFileTree, updateActiveFileTreeItem, loadFile, saveState) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      
      if (newPath === filePath) return;
      
      const isDirtyValue = typeof isDirty === 'object' && isDirty.current !== undefined ? isDirty.current : isDirty;
      if (isDirtyValue) {
        const confirmed = await customConfirm('You have unsaved changes. Switch file anyway?');
        if (!confirmed) {
          return;
        }
      }
      
      const updatedPath = newPath;
      const newUrl = '/__preview__?file=' + encodeURIComponent(newPath);
      window.history.pushState({ file: newPath }, '', newUrl);
      
      fileName.textContent = newPath.split('/').pop();
      
      const newDir = newPath.split('/').slice(0, -1).join('/') || '';
      if (newDir !== currentDir) {
        loadFileTree(newDir);
      } else {
        updateActiveFileTreeItem(newPath);
      }
      
      loadFile(newPath);
      saveState();
      
      return updatedPath;
    },

    updateStatus(isDirty, status) {
      if (isDirty) {
        status.textContent = 'Modified';
        status.className = 'status';
      } else {
        status.textContent = 'Saved';
        status.className = 'status saved';
      }
    },

    async loadFile(path, status, editor, previewFrame, previewSettings, fileTree, getLanguage, customCacheDialog, showImagePreview, showHtmlPreview, interceptPreviewLinks, setupPreviewLogInterception, updateStatus, originalContent, isDirty, isApplyingExternalChange) {
      status.textContent = 'Loading...';
      status.className = 'status';
      
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
      const isImage = imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
      
      if (isImage) {
        showImagePreview(path);
        status.textContent = 'Ready';
        status.className = 'status';
        editor.setValue('// Image file - cannot be edited as text');
        originalContent.current = '';
        isDirty.current = false;
        updateStatus();
        return { originalContent: originalContent.current, isDirty: isDirty.current };
      }
      
      try {
        const cacheResponse = await fetch('/__api__/files/editor?path=' + encodeURIComponent(path));
        const cacheData = await cacheResponse.json();
        
        const fileResponse = await fetch('/__api__/files?path=' + encodeURIComponent(path));
        const fileData = await fileResponse.json();
        
        if (!fileData.success) {
          status.textContent = 'Error: ' + fileData.error;
          status.className = 'status error';
          return { originalContent: originalContent.current, isDirty: isDirty.current };
        }
        
        if (cacheData.success && cacheData.exists && cacheData.content !== fileData.content) {
          const choice = await customCacheDialog(cacheData.content, fileData.content, path);
          
          if (choice === 'pull') {
            fileData.content = cacheData.content;
          } else if (choice === 'discard') {
            await fetch('/__api__/files/editor', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: path })
            });
            
            let previewUrl = '/__preview-content__?file=' + encodeURIComponent(path) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
            if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
              previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
            }
            previewUrl += '&t=' + Date.now();
            previewFrame.src = previewUrl;
          } else {
            status.textContent = 'Ready';
            status.className = 'status';
            return { originalContent: originalContent.current, isDirty: isDirty.current };
          }
        }
        
        const detectedLanguage = getLanguage(path);
        const currentModel = editor.getModel();
        
        originalContent.current = fileData.content;
        isDirty.current = false;
        
        isApplyingExternalChange.current = true;
        
        const normalizedPath = path.replace(/^\/+/, '');
        let model = monaco.editor.getModels().find(m => {
          const modelPath = m.uri.path.replace(/^\/+/, '');
          return modelPath === normalizedPath;
        });
        if (!model) {
          const uri = monaco.Uri.parse('file:///' + normalizedPath);
          model = monaco.editor.createModel(fileData.content, detectedLanguage, uri);
        } else {
          model.setValue(fileData.content);
          monaco.editor.setModelLanguage(model, detectedLanguage);
        }
        
        editor.setModel(model);
        
        const modelContent = editor.getValue();
        if (modelContent !== fileData.content) {
          console.warn('Model content mismatch after setModel. Setting value directly.');
          editor.setValue(fileData.content);
        }
        
        setTimeout(() => {
          isApplyingExternalChange.current = false;
          updateStatus();
        }, 100);
        
        const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
        
        if (!isPreviewPoppedOut && previewFrame) {
          const previewPanel = previewFrame.closest('#previewPanel');
          const isPreviewCollapsed = previewPanel && previewPanel.classList.contains('collapsed');
          
          if (!isPreviewCollapsed) {
            showHtmlPreview();
            let previewUrl = '/__preview-content__?file=' + encodeURIComponent(path) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
            if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
              previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
            }
            previewUrl += '&t=' + Date.now();
            previewFrame.src = previewUrl;
            previewFrame.onload = () => {
              interceptPreviewLinks();
              setTimeout(() => {
                if (setupPreviewLogInterception) {
                  setupPreviewLogInterception();
                }
              }, 100);
            };
          }
        }
        
        return { originalContent: originalContent.current, isDirty: isDirty.current };
      } catch (err) {
        status.textContent = 'Error loading file';
        status.className = 'status error';
        console.error(err);
        return { originalContent: originalContent.current, isDirty: isDirty.current };
      }
    },

    saveFile(editor, getFilePath, status, ws, originalContent, isDirty, updateStatus, saveToEditorTimeout) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      if (!editor || !editor.getModel()) {
        console.error('Editor or model not available');
        status.textContent = 'Error: Editor not ready';
        status.className = 'status error';
        return Promise.resolve({ originalContent: originalContent.current, isDirty: isDirty.current });
      }
      
      const content = editor.getValue();
      
      if (content === undefined || content === null) {
        console.error('Editor content is undefined or null, using originalContent');
        const fallbackContent = originalContent.current || '';
        status.textContent = 'Warning: Using fallback content';
        status.className = 'status error';
        return Promise.resolve({ originalContent: originalContent.current, isDirty: isDirty.current });
      }
      
      status.textContent = 'Saving...';
      status.className = 'status saving';
      
      if (saveToEditorTimeout && saveToEditorTimeout.current) {
        clearTimeout(saveToEditorTimeout.current);
      }
      
      return fetch('/__api__/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: content })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          originalContent.current = content;
          isDirty.current = false;
          status.textContent = 'Saved';
          status.className = 'status saved';
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'editorSave',
              path: filePath,
              content: content
            }));
          }
          
          const updatePreview = window.__previewUpdatePreview;
          if (updatePreview) {
            updatePreview(content);
          }
          
          setTimeout(() => {
            if (!isDirty.current) {
              status.textContent = 'Ready';
              status.className = 'status';
            }
          }, 2000);
          
          return { originalContent: originalContent.current, isDirty: isDirty.current };
        } else {
          status.textContent = 'Error: ' + data.error;
          status.className = 'status error';
          return { originalContent, isDirty };
        }
      })
      .catch(err => {
        status.textContent = 'Error saving file';
        status.className = 'status error';
        console.error(err);
        return { originalContent, isDirty };
      });
    },

    async customCacheDialog(cachedContent, liveContent, filePath, getLanguage, previewSettings, updateCachePreview) {
      return new Promise((resolve) => {
        const dialog = document.getElementById('cacheComparisonDialog');
        const closeBtn = document.getElementById('cacheComparisonClose');
        const useCacheBtn = document.getElementById('cacheComparisonUseCache');
        const useLiveBtn = document.getElementById('cacheComparisonUseLive');
        const cancelBtn = document.getElementById('cacheComparisonCancel');
        
        const detectedLanguage = getLanguage(filePath);
        
        const cleanup = () => {
          dialog.style.display = 'none';
          if (cacheEditorInstance) {
            cacheEditorInstance.dispose();
            cacheEditorInstance = null;
          }
          if (liveEditorInstance) {
            liveEditorInstance.dispose();
            liveEditorInstance = null;
          }
          useCacheBtn.onclick = null;
          useLiveBtn.onclick = null;
          cancelBtn.onclick = null;
          closeBtn.onclick = null;
          dialog.onkeydown = null;
          dialog.onclick = null;
        };
        
        const handleUseCache = () => {
          cleanup();
          resolve('pull');
        };
        
        const handleUseLive = () => {
          cleanup();
          resolve('discard');
        };
        
        const handleCancel = () => {
          cleanup();
          resolve('cancel');
        };
        
        useCacheBtn.onclick = handleUseCache;
        useLiveBtn.onclick = handleUseLive;
        cancelBtn.onclick = handleCancel;
        closeBtn.onclick = handleCancel;
        
        dialog.onkeydown = (e) => {
          if (e.key === 'Escape') {
            handleCancel();
          }
        };
        
        dialog.onclick = (e) => {
          if (e.target === dialog) {
            handleCancel();
          }
        };
        
        dialog.style.display = 'flex';
        
        setTimeout(async () => {
          const cacheEditorEl = document.getElementById('cacheEditor');
          const liveEditorEl = document.getElementById('liveEditor');
          const cachePreview = document.getElementById('cachePreview');
          const livePreview = document.getElementById('livePreview');
          
          if (cacheEditorEl && !cacheEditorInstance) {
            cacheEditorInstance = monaco.editor.create(cacheEditorEl, {
              value: cachedContent,
              language: detectedLanguage,
              theme: previewSettings.editorTheme,
              fontSize: previewSettings.editorFontSize,
              wordWrap: previewSettings.editorWordWrap ? 'on' : 'off',
              lineNumbers: previewSettings.editorLineNumbers ? 'on' : 'off',
              readOnly: true,
              minimap: { enabled: false }
            });
            
            cacheEditorInstance.onDidChangeModelContent(() => {
              const content = cacheEditorInstance.getValue();
              updateCachePreview(content, () => filePath, cachePreview, false);
            });
            
            updateCachePreview(cachedContent, () => filePath, cachePreview, false);
          }
          
          if (liveEditorEl && !liveEditorInstance) {
            liveEditorInstance = monaco.editor.create(liveEditorEl, {
              value: liveContent,
              language: detectedLanguage,
              theme: previewSettings.editorTheme,
              fontSize: previewSettings.editorFontSize,
              wordWrap: previewSettings.editorWordWrap ? 'on' : 'off',
              lineNumbers: previewSettings.editorLineNumbers ? 'on' : 'off',
              readOnly: true,
              minimap: { enabled: false }
            });
            
            liveEditorInstance.onDidChangeModelContent(() => {
              const content = liveEditorInstance.getValue();
              updateCachePreview(content, () => filePath, livePreview, true);
            });
            
            updateCachePreview(liveContent, () => filePath, livePreview, true);
          }
        }, 100);
      });
    },

    async updateCachePreview(content, getFilePath, previewFrame, isLive, previewSettings) {
      if (!previewFrame) return;
      
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      
      try {
        if (isLive) {
          let previewUrl = '/__preview-content__/live?file=' + encodeURIComponent(filePath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
          if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
            previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
          }
          previewUrl += '&t=' + Date.now();
          previewFrame.src = previewUrl;
        } else {
          await fetch('/__preview-content__?file=' + encodeURIComponent(filePath), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: content
          });
          
          let previewUrl = '/__preview-content__?file=' + encodeURIComponent(filePath) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
          if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
            previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
          }
          previewUrl += '&t=' + Date.now();
          previewFrame.src = previewUrl;
        }
      } catch (error) {
        console.error('Error updating cache preview:', error);
      }
    }
  };
})();
