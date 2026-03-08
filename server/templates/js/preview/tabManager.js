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
    return filePath.split('/').pop();
  }

  function createTabElement(filePath) {
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    tab.dataset.filePath = filePath;
    
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

  return {
    initialize,
    openTab,
    openTabWithoutConfirm,
    closeTab,
    switchToTab,
    updateActiveTab,
    updateTabDirtyState,
    setTabContent,
    getActiveTab,
    getOpenTabs,
    getTabInfo
  };
})();
