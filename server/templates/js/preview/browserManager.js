window.PreviewBrowserManager = (function() {
  let browserTabs = []; // Internal browser tabs (multiple browser windows)
  let activeBrowserTabId = null;
  let browserTabsContainer = null;
  let browserContainer = null;
  let browserView = null;
  let urlInput = null;
  let backBtn = null;
  let forwardBtn = null;
  let refreshBtn = null;
  let editorElement = null;
  let tabData = {};
  let tabCounter = 0;
  const BROWSER_TAB_PREFIX = 'browser://';

  function generateTabId() {
    return `browser-tab-${++tabCounter}`;
  }

  function getTabTitle(url) {
    if (!url || url === 'about:blank') return 'New Tab';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || url;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  function normalizeUrl(url) {
    if (!url || url.trim() === '') return 'about:blank';
    url = url.trim();
    
    // Handle localhost URLs
    if (url.startsWith('localhost:') || url.match(/^localhost:\d+/)) {
      return 'http://' + url;
    }
    
    try {
      new URL(url);
      return url;
    } catch {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.includes('.') && !url.includes(' ')) {
        return 'https://' + url;
      }
      return 'https://www.google.com/search?q=' + encodeURIComponent(url);
    }
  }

  function createBrowserTabElement(tabId, url) {
    const tab = document.createElement('div');
    tab.className = 'browser-tab';
    tab.dataset.tabId = tabId;
    tab.draggable = true;
    
    const icon = document.createElement('span');
    icon.className = 'browser-tab-icon';
    icon.textContent = '🌐';
    
    const label = document.createElement('span');
    label.className = 'browser-tab-label';
    label.textContent = getTabTitle(url);
    label.title = url || 'New Tab';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'browser-tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeBrowserTab(tabId);
    };
    
    tab.appendChild(icon);
    tab.appendChild(label);
    tab.appendChild(closeBtn);
    
    tab.onclick = (e) => {
      if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
        switchToBrowserTab(tabId);
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
      e.dataTransfer.setData('text/plain', tabId);
      tab.classList.add('dragging');
    });
    
    tab.addEventListener('dragend', (e) => {
      tab.classList.remove('dragging');
      // Remove any drag-over classes from all tabs
      document.querySelectorAll('.browser-tab').forEach(t => {
        t.classList.remove('drag-over');
      });
    });
    
    tab.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingTab = document.querySelector('.browser-tab.dragging');
      if (!draggingTab || draggingTab === tab) return;
      
      const tabs = Array.from(browserTabsContainer.querySelectorAll('.browser-tab'));
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
      
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (!draggedTabId || draggedTabId === tabId) return;
      
      const draggedIndex = browserTabs.indexOf(draggedTabId);
      const dropIndex = browserTabs.indexOf(tabId);
      
      if (draggedIndex === -1 || dropIndex === -1) return;
      
      // Reorder the array
      browserTabs.splice(draggedIndex, 1);
      browserTabs.splice(dropIndex, 0, draggedTabId);
      
      // Re-render tabs and frames
      renderBrowserTabs();
      renderFrames();
    });
    
    return tab;
  }

  function createBrowserFrame(tabId, url) {
    const frame = document.createElement('iframe');
    frame.id = `browser-frame-${tabId}`;
    frame.className = 'browser-frame';
    frame.src = url || 'about:blank';
    frame.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals';
    
    // Create error overlay container
    const frameContainer = document.createElement('div');
    frameContainer.style.position = 'relative';
    frameContainer.style.width = '100%';
    frameContainer.style.height = '100%';
    
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'browser-frame-error';
    errorOverlay.style.display = 'none';
    errorOverlay.style.position = 'absolute';
    errorOverlay.style.top = '0';
    errorOverlay.style.left = '0';
    errorOverlay.style.right = '0';
    errorOverlay.style.bottom = '0';
    errorOverlay.style.background = 'var(--bg-primary)';
    errorOverlay.style.color = 'var(--text-primary)';
    errorOverlay.style.padding = '40px';
    errorOverlay.style.display = 'flex';
    errorOverlay.style.flexDirection = 'column';
    errorOverlay.style.alignItems = 'center';
    errorOverlay.style.justifyContent = 'center';
    errorOverlay.style.zIndex = '1000';
    errorOverlay.style.fontFamily = 'monospace';
    errorOverlay.style.textAlign = 'center';
    
    function updateErrorOverlay(displayUrl) {
      errorOverlay.innerHTML = `
        <h2 style="margin-bottom: 20px; color: var(--text-primary);">⚠️ Cannot display this page</h2>
        <p style="margin-bottom: 10px;">The website has blocked embedding in frames for security reasons (X-Frame-Options).</p>
        <p style="margin-bottom: 20px; color: var(--text-secondary);">This is a security feature that prevents websites from being embedded in iframes.</p>
        <a href="${displayUrl}" target="_blank" style="color: var(--border-active); text-decoration: underline; cursor: pointer; font-size: 14px;">Open in new window →</a>
      `;
    }
    
    frame.addEventListener('load', () => {
      // Hide error overlay initially
      errorOverlay.style.display = 'none';
      
      // Use setTimeout to check if frame actually loaded
      setTimeout(() => {
        try {
          const tabInfo = tabData[tabId];
          if (tabInfo) {
            // Try to access frame content - if it fails, it's likely X-Frame-Options
            const frameUrl = frame.contentWindow.location.href;
            tabInfo.url = frameUrl;
            
            if (tabId === activeBrowserTabId && urlInput) {
              urlInput.value = frameUrl;
            }
            
            const tab = browserTabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
            if (tab) {
              const label = tab.querySelector('.browser-tab-label');
              if (label) {
                label.textContent = getTabTitle(frameUrl);
                label.title = frameUrl;
              }
            }
            
            updateNavigationButtons();
            
            // Update inspector when frame loads
            if (tabId === activeBrowserTabId && window.PreviewInspectorManager) {
              window.PreviewInspectorManager.setFrame(frame);
            }
          }
        } catch (e) {
          // Cross-origin restrictions - likely X-Frame-Options
          const tabInfo = tabData[tabId];
          if (tabInfo) {
            const frameSrc = frame.src;
            tabInfo.url = frameSrc;
            
            // Show error overlay for blocked sites (not about:blank)
            if (frameSrc !== 'about:blank' && !frameSrc.startsWith('data:')) {
              updateErrorOverlay(frameSrc);
              errorOverlay.style.display = 'flex';
            }
            
            if (tabId === activeBrowserTabId && urlInput) {
              urlInput.value = frameSrc;
            }
          }
        }
      }, 500);
    });
    
    frameContainer.appendChild(frame);
    frameContainer.appendChild(errorOverlay);
    
    return frameContainer;
  }

  function renderBrowserTabs() {
    if (!browserTabsContainer) return;
    
    browserTabsContainer.innerHTML = '';
    
    // Always recreate the new tab button (event delegation handles clicks)
    const btn = document.createElement('button');
    btn.id = 'browserNewTabBtn';
    btn.className = 'browser-new-tab-btn';
    btn.textContent = '+';
    btn.title = 'New Tab';
    // Don't add click listener here - event delegation handles it
    browserTabsContainer.appendChild(btn);
    
    browserTabs.forEach(tabId => {
      const tabInfo = tabData[tabId];
      const tab = createBrowserTabElement(tabId, tabInfo?.url || 'about:blank');
      if (tabId === activeBrowserTabId) {
        tab.classList.add('active');
      }
      browserTabsContainer.appendChild(tab);
    });
  }

  function renderFrames() {
    if (!browserContainer) return;
    
    browserContainer.innerHTML = '';
    
    browserTabs.forEach(tabId => {
      const tabInfo = tabData[tabId];
      const frameContainer = tabInfo.frameContainer || tabInfo.frame;
      if (frameContainer) {
        frameContainer.style.display = tabId === activeBrowserTabId ? 'block' : 'none';
        browserContainer.appendChild(frameContainer);
      }
    });
  }

  function switchToBrowserTab(tabId) {
    if (tabId === activeBrowserTabId) return;
    
    activeBrowserTabId = tabId;
    renderBrowserTabs();
    renderFrames();
    
    const tabInfo = tabData[tabId];
    if (tabInfo && urlInput) {
      urlInput.value = tabInfo.url || 'about:blank';
    }
    
    // Update inspector with current frame
    if (tabInfo && tabInfo.frame && window.PreviewInspectorManager) {
      window.PreviewInspectorManager.setFrame(tabInfo.frame);
    }
    
    updateNavigationButtons();
  }

  function openBrowserTab(url = 'about:blank') {
    const tabId = generateTabId();
    const normalizedUrl = normalizeUrl(url);
    
    const frameContainer = createBrowserFrame(tabId, normalizedUrl);
    const frame = frameContainer.querySelector('iframe');
    
    if (!frame) {
      console.error('Failed to create browser frame');
      return null;
    }
    
    tabData[tabId] = {
      id: tabId,
      url: normalizedUrl,
      frame: frame,
      frameContainer: frameContainer,
      canGoBack: false,
      canGoForward: false
    };
    
    browserTabs.push(tabId);
    activeBrowserTabId = tabId;
    
    renderBrowserTabs();
    renderFrames();
    
    // Set frame in inspector
    if (window.PreviewInspectorManager) {
      window.PreviewInspectorManager.setFrame(frame);
    }
    
    if (urlInput) {
      urlInput.value = normalizedUrl;
    }
    
    updateNavigationButtons();
    
    return tabId;
  }

  function closeBrowserTab(tabId) {
    if (!browserTabs.includes(tabId)) return;
    
    const index = browserTabs.indexOf(tabId);
    browserTabs.splice(index, 1);
    
    const tabInfo = tabData[tabId];
    if (tabInfo) {
      if (tabInfo.frameContainer) {
        tabInfo.frameContainer.remove();
      } else if (tabInfo.frame) {
        tabInfo.frame.remove();
      }
    }
    delete tabData[tabId];
    
    if (tabId === activeBrowserTabId) {
      if (browserTabs.length > 0) {
        const newActiveIndex = Math.min(index, browserTabs.length - 1);
        activeBrowserTabId = browserTabs[newActiveIndex];
        switchToBrowserTab(activeBrowserTabId);
      } else {
        activeBrowserTabId = null;
        if (urlInput) {
          urlInput.value = '';
        }
        updateNavigationButtons();
        // If no browser tabs left, open a new one
        openBrowserTab('about:blank');
      }
    }
    
    renderBrowserTabs();
    renderFrames();
  }

  function navigateToUrl(url) {
    if (!activeBrowserTabId) {
      openBrowserTab(url);
      return;
    }
    
    const tabInfo = tabData[activeBrowserTabId];
    if (!tabInfo || !tabInfo.frame) return;
    
    const normalizedUrl = normalizeUrl(url);
    tabInfo.url = normalizedUrl;
    
    // Hide error overlay when navigating
    if (tabInfo.frameContainer) {
      const errorOverlay = tabInfo.frameContainer.querySelector('.browser-frame-error');
      if (errorOverlay) {
        errorOverlay.style.display = 'none';
      }
    }
    
    tabInfo.frame.src = normalizedUrl;
    
    if (urlInput) {
      urlInput.value = normalizedUrl;
    }
    
    const tab = browserTabsContainer.querySelector(`[data-tab-id="${activeBrowserTabId}"]`);
    if (tab) {
      const label = tab.querySelector('.browser-tab-label');
      if (label) {
        label.textContent = getTabTitle(normalizedUrl);
        label.title = normalizedUrl;
      }
    }
  }

  function goBack() {
    if (!activeBrowserTabId) return;
    const tabInfo = tabData[activeBrowserTabId];
    if (!tabInfo || !tabInfo.frame) return;
    
    try {
      tabInfo.frame.contentWindow.history.back();
      updateNavigationButtons();
    } catch (e) {
      console.error('Cannot go back:', e);
    }
  }

  function goForward() {
    if (!activeBrowserTabId) return;
    const tabInfo = tabData[activeBrowserTabId];
    if (!tabInfo || !tabInfo.frame) return;
    
    try {
      tabInfo.frame.contentWindow.history.forward();
      updateNavigationButtons();
    } catch (e) {
      console.error('Cannot go forward:', e);
    }
  }

  function refresh() {
    if (!activeBrowserTabId) return;
    const tabInfo = tabData[activeBrowserTabId];
    if (!tabInfo || !tabInfo.frame) return;
    
    // Hide error overlay on refresh
    if (tabInfo.frameContainer) {
      const errorOverlay = tabInfo.frameContainer.querySelector('.browser-frame-error');
      if (errorOverlay) {
        errorOverlay.style.display = 'none';
      }
    }
    
    tabInfo.frame.src = tabInfo.frame.src;
  }

  function updateNavigationButtons() {
    if (!activeBrowserTabId) {
      if (backBtn) backBtn.disabled = true;
      if (forwardBtn) forwardBtn.disabled = true;
      return;
    }
    
    const tabInfo = tabData[activeBrowserTabId];
    if (!tabInfo || !tabInfo.frame) {
      if (backBtn) backBtn.disabled = true;
      if (forwardBtn) forwardBtn.disabled = true;
      return;
    }
    
    try {
      if (backBtn) backBtn.disabled = false;
      if (forwardBtn) forwardBtn.disabled = false;
    } catch (e) {
      if (backBtn) backBtn.disabled = true;
      if (forwardBtn) forwardBtn.disabled = true;
    }
  }

  function showBrowserView() {
    if (!browserView || !editorElement) return;
    editorElement.style.display = 'none';
    browserView.style.display = 'flex';
  }

  function hideBrowserView() {
    if (!browserView || !editorElement) return;
    browserView.style.display = 'none';
    editorElement.style.display = 'block';
  }

  function openBrowserEditorTab() {
    const browserTabPath = BROWSER_TAB_PREFIX + 'browser';
    
    // Check if browser tab is already open
    if (window.PreviewTabManager) {
      const openTabs = window.PreviewTabManager.getOpenTabs();
      if (openTabs.includes(browserTabPath)) {
        window.PreviewTabManager.switchToTab(browserTabPath);
        return browserTabPath;
      }
      
      // Open as a new editor tab
      window.PreviewTabManager.openTab(browserTabPath);
      showBrowserView();
      
      // Create initial browser tab if none exist
      if (browserTabs.length === 0) {
        openBrowserTab('about:blank');
      }
      
      return browserTabPath;
    }
    
    return null;
  }

  function initialize(container, tabsContainer, navUrlInput, navBackBtn, navForwardBtn, navRefreshBtn, view, editor) {
    browserContainer = container;
    browserTabsContainer = tabsContainer;
    urlInput = navUrlInput;
    backBtn = navBackBtn;
    forwardBtn = navForwardBtn;
    refreshBtn = navRefreshBtn;
    browserView = view;
    editorElement = editor;
    
    if (!browserView) {
      console.error('Browser view element not provided');
      return;
    }
    if (!browserContainer) {
      console.error('Browser container element not provided');
      return;
    }
    if (!browserTabsContainer) {
      console.error('Browser tabs container element not provided');
      return;
    }
    
    if (urlInput) {
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          navigateToUrl(urlInput.value);
        }
      });
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', goBack);
    }
    
    if (forwardBtn) {
      forwardBtn.addEventListener('click', goForward);
    }
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refresh);
    }
    
    const goBtn = document.getElementById('browserGoBtn');
    if (goBtn) {
      goBtn.addEventListener('click', () => {
        if (urlInput) {
          navigateToUrl(urlInput.value);
        }
      });
    }
    
    // Use event delegation for the new tab button since it gets recreated
    if (browserTabsContainer) {
      browserTabsContainer.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'browserNewTabBtn' || e.target.classList.contains('browser-new-tab-btn'))) {
          e.preventDefault();
          e.stopPropagation();
          openBrowserTab('about:blank');
        }
      });
      
      // Initial render to create the button
      renderBrowserTabs();
    }
    
    // Initialize bookmark manager
    if (window.PreviewBookmarkManager) {
      const bookmarksContainer = document.getElementById('bookmarksContainer');
      const bookmarksMenu = document.getElementById('bookmarksMenu');
      const bookmarkDialog = document.getElementById('bookmarkDialog');
      
      if (bookmarksContainer && bookmarksMenu && bookmarkDialog) {
        window.PreviewBookmarkManager.initialize(
          bookmarksContainer,
          bookmarksMenu,
          bookmarkDialog,
          (url) => {
            if (activeBrowserTabId) {
              navigateToUrl(url);
            } else {
              openBrowserTab(url);
            }
          }
        );
        
        // Setup bookmark button
        const bookmarkBtn = document.getElementById('browserBookmarkBtn');
        if (bookmarkBtn) {
          bookmarkBtn.addEventListener('click', () => {
            const tabInfo = tabData[activeBrowserTabId];
            if (tabInfo && tabInfo.url && tabInfo.url !== 'about:blank') {
              const currentUrl = tabInfo.url;
              const currentTitle = getTabTitle(currentUrl);
              window.PreviewBookmarkManager.showAddDialog(currentUrl, currentTitle);
            }
          });
        }
        
        // Setup add bookmark button in menu
        const menuAddBtn = document.getElementById('bookmarksMenuAddBtn');
        if (menuAddBtn) {
          menuAddBtn.addEventListener('click', () => {
            const tabInfo = tabData[activeBrowserTabId];
            const currentUrl = tabInfo?.url || '';
            const currentTitle = tabInfo ? getTabTitle(currentUrl) : '';
            window.PreviewBookmarkManager.showAddDialog(currentUrl, currentTitle);
          });
        }
        
        // Setup menu close button
        const menuCloseBtn = bookmarksMenu.querySelector('.bookmarks-menu-close');
        if (menuCloseBtn) {
          menuCloseBtn.addEventListener('click', () => {
            window.PreviewBookmarkManager.hideMenu();
          });
        }
      }
    }
    
    // Setup toolbar buttons
    const focusBtn = document.getElementById('browserFocusBtn');
    const inspectorToggleBtn = document.getElementById('browserInspectorToggleBtn');
    
    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        // Toggle focus mode - highlight elements on hover and select them
        focusBtn.classList.toggle('active');
        if (window.PreviewInspectorManager) {
          window.PreviewInspectorManager.setFocusMode(focusBtn.classList.contains('active'));
        }
      });
    }
    
    if (inspectorToggleBtn) {
      // Check initial state
      const inspector = document.getElementById('browserInspector');
      if (inspector) {
        const isCollapsed = inspector.classList.contains('collapsed');
        inspectorToggleBtn.classList.toggle('active', !isCollapsed);
      }
      
      inspectorToggleBtn.addEventListener('click', () => {
        // Toggle inspector panel visibility
        const inspector = document.getElementById('browserInspector');
        if (inspector) {
          const isCollapsed = inspector.classList.contains('collapsed');
          inspector.classList.toggle('collapsed');
          inspectorToggleBtn.classList.toggle('active', !isCollapsed);
          
          const toggleBtn = document.getElementById('toggleInspectorBtn');
          if (toggleBtn) {
            toggleBtn.textContent = isCollapsed ? '◀' : '▶';
          }
        }
      });
    }
    
    // Update inspector button state when inspector is toggled via other means
    const toggleInspectorBtn = document.getElementById('toggleInspectorBtn');
    if (toggleInspectorBtn && inspectorToggleBtn) {
      const observer = new MutationObserver(() => {
        const inspector = document.getElementById('browserInspector');
        if (inspector) {
          const isCollapsed = inspector.classList.contains('collapsed');
          inspectorToggleBtn.classList.toggle('active', !isCollapsed);
        }
      });
      
      const inspector = document.getElementById('browserInspector');
      if (inspector) {
        observer.observe(inspector, { attributes: true, attributeFilter: ['class'] });
      }
    }
    
    // Start hidden
    if (browserView) {
      browserView.style.display = 'none';
    }
  }

  return {
    initialize,
    openBrowserEditorTab,
    openBrowserTab,
    closeBrowserTab,
    switchToBrowserTab,
    navigateToUrl,
    goBack,
    goForward,
    refresh,
    showBrowserView,
    hideBrowserView,
    isBrowserTab: (path) => path && path.startsWith(BROWSER_TAB_PREFIX),
    BROWSER_TAB_PREFIX
  };
})();
