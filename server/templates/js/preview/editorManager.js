window.PreviewEditorManager = (function() {
  let cacheEditorInstance = null;
  let liveEditorInstance = null;
  let isApplyingExternalChange = false;

  const VIEW_ONLY_IMAGE_PLACEHOLDER = '// Image file - cannot be edited as text';
  const VIEW_ONLY_DOCUMENT_PLACEHOLDER =
    '// Document file - not editable as text. Use the Preview panel to view it.';
  const VIEW_ONLY_BINARY_PLACEHOLDER =
    '// Binary / archive: preview panel hidden. Use Hex editor from the file context menu, or open a text/HTML file.';

  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
  const DOCUMENT_EXTENSIONS = [
    '.doc', '.docx', '.rtf', '.odt',
    '.pdf',
    '.ppt', '.pptx', '.odp',
    '.xls', '.xlsx', '.ods',
  ];

  function isImagePath(path) {
    const lower = (path || '').toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  function isDocumentPath(path) {
    const lower = (path || '').toLowerCase();
    return DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  function pathIsViewOnly(path) {
    return isImagePath(path) || isDocumentPath(path);
  }

  /** Executables / archives — hide preview; not useful as UTF-8 text. */
  const BINARY_NO_PREVIEW_EXTENSIONS = [
    '.exe', '.dll', '.msi', '.com', '.sys',
    '.app', '.dmg', '.deb', '.rpm',
    '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2', '.xz',
    '.wasm', '.so', '.dylib', '.apk', '.ipa',
    '.bin',
  ];

  function pathIsBinaryNoPreview(path) {
    const lower = (path || '').toLowerCase();
    return BINARY_NO_PREVIEW_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  return {
    isViewOnlyPath(path) {
      return pathIsViewOnly(path);
    },

    isBinaryNoPreviewPath(path) {
      return pathIsBinaryNoPreview(path);
    },

    applyEditorReadOnlyForPath(editor, path) {
      if (!editor) return;
      editor.updateOptions({ readOnly: pathIsViewOnly(path) || pathIsBinaryNoPreview(path) });
    },

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

    async switchToFile(newPath, getFilePath, isDirty, customConfirm, fileName, getCurrentDir, loadFileTree, updateActiveFileTreeItem, loadFile, saveState, skipCache) {
      const filePath = typeof getFilePath === 'function' ? getFilePath() : getFilePath;
      const currentDir = typeof getCurrentDir === 'function' ? getCurrentDir() : getCurrentDir;
      
      if (newPath === filePath && !skipCache) return;
      
      if (!skipCache) {
      const isDirtyValue = typeof isDirty === 'object' && isDirty.current !== undefined ? isDirty.current : isDirty;
      if (isDirtyValue) {
        const confirmed = await customConfirm('You have unsaved changes. Switch file anyway?', true);
        if (!confirmed) {
          return;
        }
        if (confirmed === 'discard') {
          const currentPath = typeof getFilePath === 'function' ? getFilePath() : '';
          if (currentPath) {
            await fetch('/__api__/files/editor', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: currentPath })
            });
            const fileResponse = await fetch('/__api__/files?path=' + encodeURIComponent(currentPath));
            const fileData = await fileResponse.json();
            if (fileData.success) {
              if (typeof isDirty === 'object' && isDirty.current !== undefined) {
                isDirty.current = false;
              }
            }
          }
        }
      }
      }
      
      const updatedPath = newPath;
      const newUrl = '/__preview__?file=' + encodeURIComponent(newPath);
      window.history.pushState({ file: newPath }, '', newUrl);
      
      fileName.textContent = newPath.split('/').pop();
      
      const treeExplorer = typeof PreviewSettings !== 'undefined' && PreviewSettings.getSettings().explorerTreeView === true;
      if (treeExplorer) {
        updateActiveFileTreeItem(newPath);
      } else {
        const newDirForApi = window.PreviewFileExplorer && typeof PreviewFileExplorer.parentDirFromFilePath === 'function'
          ? PreviewFileExplorer.parentDirFromFilePath(newPath)
          : (newPath.split('/').slice(0, -1).join('/') || '/');
        const dirsMatch = window.PreviewFileExplorer && typeof PreviewFileExplorer.explorerDirsMatch === 'function'
          ? PreviewFileExplorer.explorerDirsMatch(newDirForApi, currentDir)
          : (newDirForApi === currentDir || (newDirForApi === '/' && (currentDir === '' || currentDir === '/')));
        if (!dirsMatch) {
          loadFileTree(newDirForApi, undefined, { silent: true });
        } else {
          updateActiveFileTreeItem(newPath);
        }
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

    async loadFile(path, status, editor, previewFrame, previewSettings, fileTree, getLanguage, customCacheDialog, showImagePreview, showHtmlPreview, interceptPreviewLinks, setupPreviewLogInterception, updateStatus, originalContent, isDirty, isApplyingExternalChange, skipCache, isPreviewPinned, binaryUiHandlers) {
      status.textContent = 'Loading...';
      status.className = 'status';

      if (binaryUiHandlers && typeof binaryUiHandlers.hideBinaryPrompt === 'function') {
        binaryUiHandlers.hideBinaryPrompt();
      }
      
      const isImage = isImagePath(path);
      const isDocument = isDocumentPath(path);
      
      if (isImage) {
        showImagePreview(path);
        status.textContent = 'Ready';
        status.className = 'status';
        // Must match editor buffer: originalContent '' made getValue() !== originalContent → always "Modified"
        isApplyingExternalChange.current = true;
        editor.updateOptions({ readOnly: true });
        originalContent.current = VIEW_ONLY_IMAGE_PLACEHOLDER;
        isDirty.current = false;
        editor.setValue(VIEW_ONLY_IMAGE_PLACEHOLDER);
        setTimeout(() => {
          isApplyingExternalChange.current = false;
          updateStatus();
        }, 100);
        return { originalContent: originalContent.current, isDirty: isDirty.current };
      }

      if (isDocument) {
        // For document-like files, don't attempt to load as text into the editor.
        status.textContent = 'Ready';
        status.className = 'status';
        isApplyingExternalChange.current = true;
        editor.updateOptions({ readOnly: true });
        originalContent.current = VIEW_ONLY_DOCUMENT_PLACEHOLDER;
        isDirty.current = false;
        editor.setValue(VIEW_ONLY_DOCUMENT_PLACEHOLDER);

        const isPreviewPoppedOut = PreviewPopouts.isPreviewPoppedOut();
        const pinned = typeof isPreviewPinned === 'function' ? isPreviewPinned() : false;

        if (!isPreviewPoppedOut && previewFrame && !pinned) {
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
              if (setupPreviewLogInterception) {
                setTimeout(() => {
                  setupPreviewLogInterception();
                }, 100);
              }
            };
          }
        }

        setTimeout(() => {
          isApplyingExternalChange.current = false;
          updateStatus();
        }, 100);
        return { originalContent: originalContent.current, isDirty: isDirty.current };
      }

      if (pathIsBinaryNoPreview(path)) {
        status.textContent = 'Ready';
        status.className = 'status';
        isApplyingExternalChange.current = true;
        editor.updateOptions({ readOnly: true });
        isDirty.current = false;
        const usePrompt = binaryUiHandlers && typeof binaryUiHandlers.showBinaryPrompt === 'function';
        if (usePrompt) {
          originalContent.current = '';
          editor.setValue('');
        } else {
          originalContent.current = VIEW_ONLY_BINARY_PLACEHOLDER;
          editor.setValue(VIEW_ONLY_BINARY_PLACEHOLDER);
        }
        setTimeout(() => {
          isApplyingExternalChange.current = false;
          updateStatus();
        }, 100);
        if (usePrompt) {
          binaryUiHandlers.showBinaryPrompt(path);
        }
        if (typeof window.__previewBeginForcedPanel === 'function') {
          window.__previewBeginForcedPanel();
        }
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
        
        if (!skipCache && cacheData.success && cacheData.exists && cacheData.content !== fileData.content && customCacheDialog) {
          const choice = await customCacheDialog(cacheData.content, fileData.content, path);
          
          if (choice === 'pull') {
            fileData.content = cacheData.content;
          } else if (choice === 'discard') {
            await fetch('/__api__/files/editor', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: path })
            });
            
            const pinned = typeof isPreviewPinned === 'function' ? isPreviewPinned() : false;
            if (!pinned) {
              let previewUrl = '/__preview-content__?file=' + encodeURIComponent(path) + '&theme=' + encodeURIComponent(previewSettings.pageTheme);
              if (previewSettings.pageTheme === 'custom' && previewSettings.customThemeCSS) {
                previewUrl += '&customCSS=' + encodeURIComponent(btoa(previewSettings.customThemeCSS));
              }
              previewUrl += '&t=' + Date.now();
              previewFrame.src = previewUrl;
            }
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
        
        editor.updateOptions({ readOnly: false });
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
        const pinned = typeof isPreviewPinned === 'function' ? isPreviewPinned() : false;
        
        if (!isPreviewPoppedOut && previewFrame && !pinned) {
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

      if (pathIsBinaryNoPreview(filePath)) {
        status.textContent = 'Binary file — use Hex editor to edit';
        status.className = 'status';
        return Promise.resolve({ originalContent: originalContent.current, isDirty: isDirty.current });
      }
      
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
              minimap: { enabled: false },
              folding: true,
              foldingStrategy: 'auto',
              foldingHighlight: true,
              showFoldingControls: 'always'
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
              minimap: { enabled: false },
              folding: true,
              foldingStrategy: 'auto',
              foldingHighlight: true,
              showFoldingControls: 'always'
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
