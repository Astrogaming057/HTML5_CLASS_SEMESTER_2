window.PreviewTabManager = (function() {
  let openTabs = [];
  let activeTabPath = null;
  let tabContainer = null;
  let switchToFileCallback = null;
  let getFilePathCallback = null;
  let isDirtyCallback = null;
  let customConfirmCallback = null;
  let updateActiveFileTreeItemCallback = null;
  let loadFileTreeCallback = null;
  let getCurrentDirCallback = null;
  let getEditorContentCallback = null;
  let setEditorContentCallback = null;
  let tabData = {};

  function getFileIcon(filePath) {
    // Check if it's a browser tab
    if (filePath && filePath.startsWith('browser://')) {
      return '🌐';
    }
    const ext = filePath.split('.').pop().toLowerCase();
    const iconMap = {
      'html': '🌐',
      'htm': '🌐',
      'css': '🎨',
      'js': '📜',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'xml': '📄',
      'yaml': '📄',
      'yml': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'webp': '🖼️'
    };
    return iconMap[ext] || '📄';
  }

  function getFileName(filePath) {
    // Check if it's a browser tab
    if (filePath && filePath.startsWith('browser://')) {
      return 'Browser';
    }
    return filePath.split('/').pop();
  }

  function createTabElement(filePath) {
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    tab.dataset.filePath = filePath;
    tab.draggable = true;
    
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.textContent = getFileIcon(filePath);
    
    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = getFileName(filePath);
    label.title = filePath;
    
    const unsavedIndicator = document.createElement('span');
    unsavedIndicator.className = 'tab-unsaved';
    unsavedIndicator.innerHTML = '●';
    unsavedIndicator.title = 'Unsaved changes';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTab(filePath);
    };
    
    tab.appendChild(icon);
    tab.appendChild(label);
    tab.appendChild(unsavedIndicator);
    tab.appendChild(closeBtn);
    
    const tabInfo = tabData[filePath];
    if (tabInfo && tabInfo.isDirty) {
      unsavedIndicator.style.display = 'inline';
    } else {
      unsavedIndicator.style.display = 'none';
    }
    
    tab.onclick = (e) => {
      if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
        switchToTab(filePath);
      }
    };
    
    // Drag and drop handlers
    tab.addEventListener('dragstart', (e) => {
      // Don't start drag if clicking on close button
      if (e.target === closeBtn || closeBtn.contains(e.target)) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', filePath);
      tab.classList.add('dragging');
    });
    
    tab.addEventListener('dragend', (e) => {
      tab.classList.remove('dragging');
      // Remove any drag-over classes from all tabs
      document.querySelectorAll('.editor-tab').forEach(t => {
        t.classList.remove('drag-over');
      });
    });
    
    tab.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingTab = document.querySelector('.editor-tab.dragging');
      if (!draggingTab || draggingTab === tab) return;
      
      const tabs = Array.from(tabContainer.querySelectorAll('.editor-tab'));
      const draggingIndex = tabs.indexOf(draggingTab);
      const currentIndex = tabs.indexOf(tab);
      
      tabs.forEach(t => t.classList.remove('drag-over'));
      
      if (draggingIndex < currentIndex) {
        tab.classList.add('drag-over');
      } else if (draggingIndex > currentIndex) {
        tab.classList.add('drag-over');
      }
    });
    
    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const draggedFilePath = e.dataTransfer.getData('text/plain');
      if (!draggedFilePath || draggedFilePath === filePath) return;
      
      const draggedIndex = openTabs.indexOf(draggedFilePath);
      const dropIndex = openTabs.indexOf(filePath);
      
      if (draggedIndex === -1 || dropIndex === -1) return;
      
      // Reorder the array
      openTabs.splice(draggedIndex, 1);
      openTabs.splice(dropIndex, 0, draggedFilePath);
      
      // Re-render tabs
      renderTabs();
    });
    
    return tab;
  }

  function renderTabs() {
    if (!tabContainer) return;
    
    tabContainer.innerHTML = '';
    
    openTabs.forEach(filePath => {
      const tab = createTabElement(filePath);
      if (filePath === activeTabPath) {
        tab.classList.add('active');
      }
      tabContainer.appendChild(tab);
    });
    
    if (openTabs.length === 0) {
      tabContainer.style.display = 'none';
    } else {
      tabContainer.style.display = 'flex';
    }
  }

  async function switchToTab(filePath) {
    if (filePath === activeTabPath) return;
    
    if (!openTabs.includes(filePath)) {
      await openTab(filePath);
      return;
    }
    
    if (activeTabPath && getEditorContentCallback) {
      const currentContent = getEditorContentCallback();
      const currentOriginal = typeof isDirtyCallback === 'function' ? 
        (tabData[activeTabPath]?.originalContent || '') : '';
      const currentIsDirty = currentContent !== currentOriginal;
      
      if (!tabData[activeTabPath]) {
        tabData[activeTabPath] = {};
      }
      tabData[activeTabPath].content = currentContent;
      tabData[activeTabPath].isDirty = currentIsDirty;
    }
    
    activeTabPath = filePath;
    renderTabs();
    
    // Check if it's a browser tab - don't try to load as file
    if (filePath && filePath.startsWith('browser://')) {
      if (switchToFileCallback) {
        await switchToFileCallback(filePath, false);
      }
      return;
    }
    
    const tabInfo = tabData[filePath];
    if (tabInfo && tabInfo.content !== undefined && setEditorContentCallback) {
      setEditorContentCallback(tabInfo.content, tabInfo.originalContent || tabInfo.content, filePath);
      if (switchToFileCallback) {
        await switchToFileCallback(filePath, true);
      }
    } else {
      if (switchToFileCallback) {
        await switchToFileCallback(filePath, false);
      }
    }
  }

  async function openTabWithoutConfirm(filePath) {
    if (openTabs.includes(filePath)) {
      await switchToTab(filePath);
      return;
    }
    
    if (activeTabPath && getEditorContentCallback) {
      const currentContent = getEditorContentCallback();
      const currentOriginal = typeof isDirtyCallback === 'function' ? 
        (tabData[activeTabPath]?.originalContent || '') : '';
      const currentIsDirty = currentContent !== currentOriginal;
      
      if (!tabData[activeTabPath]) {
        tabData[activeTabPath] = {};
      }
      tabData[activeTabPath].content = currentContent;
      tabData[activeTabPath].isDirty = currentIsDirty;
    }
    
    openTabs.push(filePath);
    activeTabPath = filePath;
    renderTabs();
    
    if (switchToFileCallback) {
      await switchToFileCallback(filePath, false);
    }
  }

  async function openTab(filePath) {
    if (openTabs.includes(filePath)) {
      await switchToTab(filePath);
      return;
    }
    
    if (activeTabPath && getEditorContentCallback) {
      const currentContent = getEditorContentCallback();
      const currentOriginal = typeof isDirtyCallback === 'function' ? 
        (tabData[activeTabPath]?.originalContent || '') : '';
      const currentIsDirty = currentContent !== currentOriginal;
      
      if (!tabData[activeTabPath]) {
        tabData[activeTabPath] = {};
      }
      tabData[activeTabPath].content = currentContent;
      tabData[activeTabPath].isDirty = currentIsDirty;
    }
    
    openTabs.push(filePath);
    activeTabPath = filePath;
    renderTabs();
    
    // Check if it's a browser tab - don't try to load as file
    if (filePath && filePath.startsWith('browser://')) {
      if (switchToFileCallback) {
        await switchToFileCallback(filePath, false);
      }
      return;
    }
    
    if (switchToFileCallback) {
      await switchToFileCallback(filePath, false);
    }
  }

  async function closeTab(filePath) {
    if (!openTabs.includes(filePath)) return;
    
    const tabInfo = tabData[filePath];
    const isDirty = tabInfo?.isDirty || false;
    const isActive = filePath === activeTabPath;
    
    if (isDirty && isActive) {
      const confirmed = await customConfirmCallback('You have unsaved changes. Close tab anyway?', true);
      if (!confirmed) {
        return;
      }
      if (confirmed === 'discard') {
        const currentPath = filePath;
        fetch('/__api__/files/editor', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentPath })
        }).catch(err => console.error('Error deleting cache file:', err));
        
        if (getEditorContentCallback) {
          const currentContent = getEditorContentCallback();
          const tabInfo = tabData[currentPath];
          if (tabInfo && tabInfo.originalContent !== undefined) {
            if (setEditorContentCallback) {
              setEditorContentCallback(tabInfo.originalContent, tabInfo.originalContent, currentPath);
            }
          }
        }
      }
    }
    
    const index = openTabs.indexOf(filePath);
    openTabs.splice(index, 1);
    delete tabData[filePath];
    
    if (isActive && openTabs.length > 0) {
      const newActiveIndex = Math.min(index, openTabs.length - 1);
      activeTabPath = openTabs[newActiveIndex];
      const newTabInfo = tabData[activeTabPath];
      if (newTabInfo && newTabInfo.content !== undefined && setEditorContentCallback) {
        setEditorContentCallback(newTabInfo.content, newTabInfo.originalContent || newTabInfo.content);
        if (switchToFileCallback) {
          await switchToFileCallback(activeTabPath, true);
        }
      } else {
        if (switchToFileCallback) {
          await switchToFileCallback(activeTabPath, false);
        }
      }
    } else if (openTabs.length === 0) {
      activeTabPath = null;
      // Clear editor when no tabs are open
      if (setEditorContentCallback) {
        setEditorContentCallback('', '', null);
      }
    }
    
    renderTabs();
  }

  function updateActiveTab(filePath) {
    if (openTabs.includes(filePath)) {
      activeTabPath = filePath;
      renderTabs();
    }
  }

  function updateTabDirtyState(filePath, isDirty, originalContent) {
    if (!tabData[filePath]) {
      tabData[filePath] = {};
    }
    tabData[filePath].isDirty = isDirty;
    if (originalContent !== undefined) {
      tabData[filePath].originalContent = originalContent;
    }
    renderTabs();
  }

  function setTabContent(filePath, content, originalContent) {
    if (!tabData[filePath]) {
      tabData[filePath] = {};
    }
    tabData[filePath].content = content;
    tabData[filePath].originalContent = originalContent || content;
    tabData[filePath].isDirty = content !== (originalContent || content);
    renderTabs();
  }

  function getActiveTab() {
    return activeTabPath;
  }

  function getOpenTabs() {
    return [...openTabs];
  }

  function getTabInfo(filePath) {
    return tabData[filePath] || null;
  }

  function renameTab(oldPath, newPath) {
    if (!openTabs.includes(oldPath)) return false;
    
    const tabInfo = tabData[oldPath];
    if (!tabInfo) return false;
    
    // Update the tab in the array
    const index = openTabs.indexOf(oldPath);
    openTabs[index] = newPath;
    
    // Move tab data to new path
    tabData[newPath] = tabInfo;
    delete tabData[oldPath];
    
    // Update active tab path if it was the renamed tab
    if (activeTabPath === oldPath) {
      activeTabPath = newPath;
    }
    
    renderTabs();
    return true;
  }

  function initialize(container, switchToFile, getFilePath, isDirty, customConfirm, updateActiveFileTreeItem, loadFileTree, getCurrentDir, getEditorContent, setEditorContent) {
    tabContainer = container;
    switchToFileCallback = switchToFile;
    getFilePathCallback = getFilePath;
    isDirtyCallback = isDirty;
    customConfirmCallback = customConfirm;
    updateActiveFileTreeItemCallback = updateActiveFileTreeItem;
    loadFileTreeCallback = loadFileTree;
    getCurrentDirCallback = getCurrentDir;
    getEditorContentCallback = getEditorContent;
    setEditorContentCallback = setEditorContent;
    
    if (tabContainer) {
      tabContainer.style.display = 'none';
    }
  }

  function switchToNextTab() {
    if (openTabs.length <= 1) return;
    const currentIndex = openTabs.indexOf(activeTabPath);
    const nextIndex = (currentIndex + 1) % openTabs.length;
    switchToTab(openTabs[nextIndex]);
  }

  function switchToPrevTab() {
    if (openTabs.length <= 1) return;
    const currentIndex = openTabs.indexOf(activeTabPath);
    const prevIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
    switchToTab(openTabs[prevIndex]);
  }

  function closeCurrentTab() {
    if (activeTabPath) {
      closeTab(activeTabPath);
    }
  }

  return {
    initialize,
    openTab,
    openTabWithoutConfirm,
    closeTab,
    switchToTab,
    switchToNextTab,
    switchToPrevTab,
    closeCurrentTab,
    updateActiveTab,
    updateTabDirtyState,
    setTabContent,
    getActiveTab,
    getOpenTabs,
    getTabInfo,
    renameTab
  };
})();
